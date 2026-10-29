/* ============================================================
 * TRAE宝表情工厂 · APNG 编码器（v1.11.0 新增）
 * ------------------------------------------------------------
 * 零依赖纯浏览器端 APNG 编码：输入逐帧 canvas，
 * 输出无限循环播放的 APNG Blob（PNG 兼容格式）。
 *
 *   TraeApng.encode({ width, height, delayMs, frames, onProgress })
 *     → Promise<Blob>
 *     frames: [HTMLCanvasElement]（每帧整幅画面）
 *
 * 实现要点：
 *   - 每帧先 canvas.toBlob 生成 PNG（用浏览器自带 zlib 压缩，
 *     全彩无损——像素表情的 40×28 像素点不会被量化抹平）
 *   - 从每帧 PNG 中解析出 IDAT 数据，重新包装为 APNG 结构：
 *     sig + IHDR + acTL + fcTL/IDAT(第1帧) + [fcTL + fdAT]*n + IEND
 *   - dispose_op = NONE、blend_op = SOURCE：每帧整幅覆盖，
 *     与 GIF 的 disposal=2 语义一致，透明背景不叠影
 *   - acTL num_plays = 0 → 无限循环；delay 分母取 1000（毫秒精度）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- CRC32（PNG 标准） ---------------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------------- PNG chunk 组装 ----------------
   * chunk = length(4BE) + type(4) + data + crc32(type+data)
   */
  function buildChunk(type, data) {
    var buf = new ArrayBuffer(8 + data.length + 4);
    var view = new DataView(buf);
    var bytes = new Uint8Array(buf);
    view.setUint32(0, data.length);
    for (var i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
    bytes.set(data, 8);
    var crcInput = bytes.subarray(4, 8 + data.length);
    view.setUint32(8 + data.length, crc32(crcInput));
    return buf;
  }


  /* 从单帧 PNG 二进制中解析：尺寸校验 + 拼接所有 IDAT 的原始数据 */
  function extractPngIdat(pngBytes, expectW, expectH) {
    if (pngBytes.length < 8) throw new Error('PNG 数据不完整');
    var view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
    var off = 8, idats = [], w = 0, h = 0;
    while (off + 8 <= pngBytes.length) {
      var len = view.getUint32(off);
      var type = String.fromCharCode(pngBytes[off + 4], pngBytes[off + 5], pngBytes[off + 6], pngBytes[off + 7]);
      if (type === 'IHDR') {
        w = view.getUint32(off + 8); h = view.getUint32(off + 12);
        if (w !== expectW || h !== expectH) throw new Error('帧尺寸与设定不符：' + w + '×' + h);
      } else if (type === 'IDAT') {
        idats.push(pngBytes.subarray(off + 8, off + 8 + len));
      } else if (type === 'IEND') {
        break;
      }
      off += 12 + len;   // length(4) + type(4) + data + crc(4)
    }
    if (!idats.length) throw new Error('未找到 IDAT');
    // 多个 IDAT 顺序合并为一个 fdAT 数据体
    var total = 0; idats.forEach(function (d) { total += d.length; });
    var merged = new Uint8Array(total), p = 0;
    idats.forEach(function (d) { merged.set(d, p); p += d.length; });
    return merged;
  }

  function canvasToPngBytes(cv) {
    return new Promise(function (resolve, reject) {
      if (cv.toBlob) {
        cv.toBlob(function (b) {
          if (!b) { reject(new Error('帧编码失败')); return; }
          b.arrayBuffer().then(function (ab) { resolve(new Uint8Array(ab)); });
        }, 'image/png');
      } else {
        reject(new Error('当前环境不支持 canvas.toBlob'));
      }
    });
  }

  /* ---------------- APNG 编码主流程 ----------------
   * 结构：sig + IHDR + acTL + [fcTL + IDAT(首帧)] + [fcTL + fdAT]* + IEND
   * 逐帧串行 toBlob（保持帧顺序与内存平稳），onProgress 报告 0~1。
   */
  function encode(opts) {
    var width = opts.width, height = opts.height;
    var frames = opts.frames || [];
    var delayMs = Math.max(20, Math.round(opts.delayMs || 100));
    if (!frames.length) return Promise.reject(new Error('没有可编码的帧'));
    if (frames.length > 100) frames = frames.slice(0, 100);   // 防御性上限

    var PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    var parts = [];        // Blob 分片：sig + 各 chunk
    var seq = 0;           // fcTL / fdAT 共用的序列号计数器
    parts.push(PNG_SIG);

    /* acTL：帧数 + 循环次数（0 = 无限）。
     * PNG 规范要求 IHDR 必须紧跟签名作为第一个 chunk，
     * acTL 只需出现在第一个 IDAT 之前——因此这里先构建，等首帧 IHDR 入列后再 push。 */
    var acTLBuf = (function () {
      var b = new ArrayBuffer(8), v = new DataView(b);
      v.setUint32(0, frames.length);
      v.setUint32(4, 0);
      return buildChunk('acTL', new Uint8Array(b));
    })();

    function fcTLBody() {
      // width height xoff yoff delay_num delay_den dispose blend
      var b = new ArrayBuffer(26), v = new DataView(b);
      v.setUint32(0, seq++);          // sequence number
      v.setUint32(4, width);
      v.setUint32(8, height);
      v.setUint32(12, 0);             // x offset
      v.setUint32(16, 0);             // y offset
      v.setUint16(20, delayMs);       // delay numerator（毫秒数）
      v.setUint16(22, 1000);          // delay denominator → 秒 = delayMs/1000
      b[24] = 0;                      // dispose_op = NONE
      b[25] = 0;                      // blend_op = SOURCE（整幅覆盖）
      return new Uint8Array(b);
    }
    function fdATBody(idat) {
      var b = new Uint8Array(4 + idat.length), v = new DataView(b.buffer);
      v.setUint32(0, seq++);
      b.set(idat, 4);
      return b;
    }

    var chain = Promise.resolve();
    frames.forEach(function (cv, i) {
      chain = chain.then(function () {
        return canvasToPngBytes(cv).then(function (pngBytes) {
          var idat = extractPngIdat(pngBytes, width, height);
          if (i === 0) {
            // 首帧前需要 IHDR：从首帧 PNG 原样摘出（位深 / 色彩类型等元数据不丢）
            var v = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
            parts.push(buildChunk('IHDR', pngBytes.subarray(16, 16 + v.getUint32(8))));
            parts.push(acTLBuf);   // 规范顺序：IHDR 之后、首个 IDAT 之前
            parts.push(buildChunk('fcTL', fcTLBody()));
            parts.push(buildChunk('IDAT', idat));
          } else {
            parts.push(buildChunk('fcTL', fcTLBody()));
            parts.push(buildChunk('fdAT', fdATBody(idat)));
          }
          if (opts.onProgress) opts.onProgress((i + 1) / frames.length);
        });
      });
    });

    return chain.then(function () {
      parts.push(buildChunk('IEND', new Uint8Array(0)));
      return new Blob(parts, { type: 'image/png' });
    });
  }

  window.TraeApng = { encode: encode };
})();
