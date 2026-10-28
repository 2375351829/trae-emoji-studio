/* ============================================================
 * TRAE宝表情工厂 · GIF 编码器（v1.4.0 新增）
 * ------------------------------------------------------------
 * 零依赖纯浏览器端 GIF89a 编码：输入 RGBA 像素帧序列，
 * 输出可无限循环播放的 GIF Blob。
 *
 *   TraeGif.encode({ width, height, delayMs, frames, onProgress })
 *     → Promise<Blob>
 *     frames: [{ data: Uint8ClampedArray }]（getImageData().data）
 *
 * 实现要点：
 *   - 每帧独立局部色板：统计精确颜色，≤255 色直接用；
 *     超出时 median cut 加权切分到 ≤255 色，再留 1 个透明槽位
 *   - 透明：alpha < 128 的像素走调色板透明索引（GCE 透明标志）
 *   - LZW 压缩：LSB-first 位打包，码宽随字典增长，字典满自动 CLEAR 重置
 *   - NETSCAPE2.0 扩展实现无限循环；disposal=2 逐帧还原背景（透明不叠影）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- median cut 颜色量化 ---------------- */
  // histo: Map<rgb(24bit), count> → 调色板 [[r,g,b], ...]（≤ maxColors 色）
  function quantize(histo, maxColors) {
    var colors = [];
    histo.forEach(function (n, rgb) {
      colors.push({ r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255, n: n });
    });
    if (colors.length <= maxColors) {
      return colors.map(function (c) { return [c.r, c.g, c.b]; });
    }
    // 盒子按最长轴、以出现次数加权中位切分
    function axisOf(box) {
      var rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
      for (var i = 0; i < box.length; i++) {
        var c = box[i];
        if (c.r < rmin) rmin = c.r; if (c.r > rmax) rmax = c.r;
        if (c.g < gmin) gmin = c.g; if (c.g > gmax) gmax = c.g;
        if (c.b < bmin) bmin = c.b; if (c.b > bmax) bmax = c.b;
      }
      var dr = rmax - rmin, dg = gmax - gmin, db = bmax - bmin;
      var span = Math.max(dr, dg, db);
      var axis = (dr >= dg && dr >= db) ? 'r' : (dg >= db ? 'g' : 'b');
      return { axis: axis, span: span };
    }
    var boxes = [colors.slice()];
    while (boxes.length < maxColors) {
      // 选「像素数 × 跨度」最大且可切的盒子
      var bi = -1, bscore = 0, binfo = null;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (b.length < 2) continue;
        var info = axisOf(b);
        var total = 0;
        for (var j = 0; j < b.length; j++) total += b[j].n;
        var score = total * info.span;
        if (score > bscore) { bscore = score; bi = i; binfo = info; }
      }
      if (bi < 0) break;   // 全部盒子只剩 1 色
      var box = boxes[bi];
      box.sort(function (a, b2) { return a[binfo.axis] - b2[binfo.axis]; });
      // 加权中位切分（保证两半都非空）
      var total = 0;
      for (var k = 0; k < box.length; k++) total += box[k].n;
      var acc = 0, mid = 0;
      for (var k2 = 0; k2 < box.length - 1; k2++) {
        acc += box[k2].n;
        if (acc >= total / 2) { mid = k2 + 1; break; }
      }
      if (mid < 1) mid = 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    // 每盒取加权平均色
    return boxes.map(function (box) {
      var r = 0, g = 0, bl = 0, n = 0, i2;
      for (i2 = 0; i2 < box.length; i2++) {
        var c = box[i2];
        r += c.r * c.n; g += c.g * c.n; bl += c.b * c.n; n += c.n;
      }
      n = n || 1;
      return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
    });
  }

  /* ---------------- 像素 → 调色板索引 ---------------- */
  // 精确色直接命中；其余用 15bit 缓存 + 最近色线性查找（结果缓存）
  function buildMapper(palette) {
    var exact = new Map();
    palette.forEach(function (c, i) { exact.set((c[0] << 16) | (c[1] << 8) | c[2], i); });
    var cache = new Map();
    return function (r, g, b) {
      var e = exact.get((r << 16) | (g << 8) | b);
      if (e !== undefined) return e;
      var key15 = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var hit = cache.get(key15);
      if (hit !== undefined) return hit;
      var bi = 0, bd = Infinity;
      for (var i = 0; i < palette.length; i++) {
        var c = palette[i];
        var dr = r - c[0], dg = g - c[1], db = b - c[2];
        var d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; bi = i; }
      }
      cache.set(key15, bi);
      return bi;
    };
  }

  /* ---------------- LZW 压缩（GIF 变体） ---------------- */
  // indices: Uint8Array（调色板索引序列），返回完整 LZW 字节数组（未分块）
  function lzwEncode(minCodeSize, indices) {
    var CLEAR = 1 << minCodeSize, EOI = CLEAR + 1;
    var width = minCodeSize + 1, next = EOI + 1;
    var dict = new Map();          // key: cur * 4096 + k → code
    var out = [];
    var acc = 0, bits = 0;

    function emit(code) {
      acc |= code << bits;
      bits += width;
      while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
    }

    emit(CLEAR);
    if (!indices.length) { emit(EOI); if (bits > 0) out.push(acc & 255); return out; }

    var cur = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var k = indices[i];
      var key = cur * 4096 + k;
      var found = dict.get(key);
      if (found !== undefined) { cur = found; continue; }
      emit(cur);
      if (next < 4096) {
        // 标准 GIF：码宽递增在「分配该条目之前」判断（即将分配的码达到 2^width 时先增宽）
        if (next >= (1 << width) && width < 12) width++;
        dict.set(key, next++);
      } else {
        emit(CLEAR);                                        // 字典满 → 重置
        dict = new Map(); next = EOI + 1; width = minCodeSize + 1;
      }
      cur = k;
    }
    emit(cur);
    emit(EOI);
    if (bits > 0) out.push(acc & 255);
    return out;
  }

  /* ---------------- 单帧写入 ---------------- */
  function writeFrame(out, rgba, W, H, delay10) {
    // 1. 统计不透明像素颜色直方图
    var histo = new Map(), hasTransparent = false, i;
    for (i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) { hasTransparent = true; continue; }
      var key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      histo.set(key, (histo.get(key) || 0) + 1);
    }
    // 2. 量化调色板（≤255 色，留 1 槽给透明）
    var palette = quantize(histo, 255);
    var transparentIdx = -1;
    if (hasTransparent) {
      transparentIdx = palette.length;
      palette.push([0, 0, 0]);
    }
    // 3. 补齐到 2 的幂（GIF 色板尺寸要求）
    var sizePow = 1;
    while (sizePow < palette.length || sizePow < 2) sizePow <<= 1;
    var sizeExp = Math.round(Math.log(sizePow) / Math.LN2) - 1;
    var minCodeSize = Math.max(2, sizeExp + 1);

    // 4. 图形控制扩展（disposal=2 还原背景 → 透明 GIF 不叠影）
    var packed = (2 << 2) | (transparentIdx >= 0 ? 1 : 0);
    out.push(0x21, 0xF9, 0x04, packed, delay10 & 255, (delay10 >> 8) & 255,
      transparentIdx >= 0 ? transparentIdx & 255 : 0, 0x00);

    // 5. 图像描述符 + 局部色板
    out.push(0x2C);
    out.push(0, 0);          // left = 0
    out.push(0, 0);          // top = 0
    out.push(W & 255, (W >> 8) & 255);
    out.push(H & 255, (H >> 8) & 255);
    out.push(0x80 | (sizeExp & 7));   // 局部色板标志 + 尺寸指数
    for (i = 0; i < sizePow; i++) {
      var c = palette[i] || [0, 0, 0];
      out.push(c[0], c[1], c[2]);
    }

    // 6. 像素 → 索引 → LZW → 子块包装
    var map = buildMapper(palette);
    var n = W * H;
    var indices = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      var p = i * 4;
      indices[i] = (rgba[p + 3] < 128) ? transparentIdx : map(rgba[p], rgba[p + 1], rgba[p + 2]);
    }
    out.push(minCodeSize);
    var lzw = lzwEncode(minCodeSize, indices);
    for (i = 0; i < lzw.length; i += 255) {
      var len = Math.min(255, lzw.length - i);
      out.push(len);
      for (var j = 0; j < len; j++) out.push(lzw[i + j]);
    }
    out.push(0);   // 数据块终止符
  }

  /* ---------------- 对外接口 ---------------- */
  window.TraeGif = {
    /**
     * 编码 GIF。
     * @param {Object} opt
     *   width / height  画布尺寸（像素）
     *   delayMs         每帧延迟（毫秒，会取整到 10ms 单位）
     *   frames          [{ data: Uint8ClampedArray }]（RGBA）
     *   onProgress      可选，进度回调 (0~1)
     * @returns {Promise<Blob>} image/gif
     */
    encode: function (opt) {
      return new Promise(function (resolve, reject) {
        var W = opt.width, H = opt.height;
        var frames = opt.frames || [];
        var delay10 = Math.max(2, Math.round((opt.delayMs || 100) / 10));
        var out = [];
        // 文件头 GIF89a + 逻辑屏幕描述符（无全局色板）
        out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
        out.push(W & 255, (W >> 8) & 255, H & 255, (H >> 8) & 255);
        out.push(0x00, 0x00, 0x00);
        // NETSCAPE2.0 无限循环扩展
        out.push(0x21, 0xFF, 0x0B);
        var ns = 'NETSCAPE2.0';
        for (var c = 0; c < ns.length; c++) out.push(ns.charCodeAt(c));
        out.push(0x03, 0x01, 0x00, 0x00, 0x00);

        var i = 0;
        function step() {
          try {
            if (i >= frames.length) {
              out.push(0x3B);   // Trailer
              resolve(new Blob([new Uint8Array(out)], { type: 'image/gif' }));
              return;
            }
            writeFrame(out, frames[i].data, W, H, delay10);
            i++;
            if (opt.onProgress) opt.onProgress(i / frames.length);
            setTimeout(step, 0);   // 让出主线程，页面不卡死
          } catch (err) {
            reject(err);
          }
        }
        step();
      });
    }
  };
})();
