/* ============================================================
   TRAE宝表情工厂 — 渲染引擎与交互
   角色三特征：方形头部 · 屏幕表情（像素 LED）· 黑色机身
   ============================================================ */
(function () {
  'use strict';

  var FW = 40, FH = 28;          // 表情像素网格（屏幕局部）
  var BASE = 1024;               // 渲染基准尺寸
  var NOGLOW = /noglow/.test(location.search);   // ?noglow=1 → 无辉光渲染（像素画导出用）

  /* ---------------- 调色板 ---------------- */
  var C = {
    cyan: '#9ff7e4', white: '#f2ffff', red: '#ff5a4e', pink: '#ff9bd3',
    gold: '#ffd75e', blue: '#6fcbff', green: '#8ef58e', ink: '#0b1014'
  };

  /* ---------------- 像素绘图原语 ---------------- */
  function makePen(f) {
    var pen = {
      col: C.cyan,
      set: function (c) { this.col = c; return this; },
      px: function (x, y, w, h) { f.fillStyle = this.col; f.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); },
      rect: function (x0, y0, x1, y1) { this.px(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1); },
      diamond: function (cx, cy, r) {
        for (var dy = -r; dy <= r; dy++) {
          var w = r - Math.abs(dy);
          this.px(cx - w, cy + dy, 2 * w + 1, 1);
        }
      },
      arcUp: function (cx, cy, w, h) { // ∩
        for (var i = 0; i <= w; i++) {
          var t = Math.PI * i / w;
          this.px(cx - w / 2 + i, cy - Math.round(Math.sin(t) * h), 1, 2);
        }
      },
      arcDown: function (cx, cy, w, h) { // ∪
        for (var i = 0; i <= w; i++) {
          var t = Math.PI * i / w;
          this.px(cx - w / 2 + i, cy + Math.round(Math.sin(t) * h), 1, 2);
        }
      },
      hline: function (cx, cy, w) { this.px(cx - w / 2, cy, w, 2); },
      heart: function (cx, cy, s) {
        var pat = [
          '.##.##.',
          '#######',
          '#######',
          '.#####.',
          '..###..',
          '...#...'
        ];
        drawPat(this, pat, cx, cy, s);
      },
      star: function (cx, cy, s) {
        var pat = [
          '...#...',
          '...#...',
          '..###..',
          '#######',
          '.#####.',
          '..#.#..',
          '.#...#.'
        ];
        drawPat(this, pat, cx, cy, s);
      },
      ring: function (cx, cy, r) {
        for (var a = 0; a < 64; a++) {
          var t = a / 64 * Math.PI * 2;
          this.px(cx + Math.round(Math.cos(t) * r), cy + Math.round(Math.sin(t) * r));
        }
      },
      spiral: function (cx, cy, r) {
        var pts = [];
        for (var a = 0; a < 90; a++) {
          var t = a / 90 * Math.PI * 4;
          var rr = r * a / 90;
          pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
        }
        for (var i = 0; i < pts.length; i++) this.px(pts[i][0], pts[i][1], 2, 2);
      },
      drop: function (cx, cy, s) { // 汗滴/泪滴（下圆上尖）
        var pat = ['..#..', '..#..', '.###.', '#####', '#####', '.###.'];
        drawPat(this, pat, cx, cy, s);
      },
      zzz: function (cx, cy, s) {
        drawPat(this, ['##..#', '..#..', '.#...', '#..##'], cx, cy, s);
      },
      qmark: function (cx, cy, s) {
        var pat = ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'];
        drawPat(this, pat, cx, cy, s);
      },
      anger: function (cx, cy, s) { // 漫画怒筋
        var pat = [
          '#..#',
          '.##.',
          '#..#'
        ];
        drawPat(this, pat, cx, cy, s);
        drawPat(this, ['.#.', '#.#', '.#.'], cx + 5 * s, cy, s);
      }
    };
    return pen;
  }
  function drawPat(pen, pat, cx, cy, s) {
    var W = pat[0].length, H = pat.length;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (pat[y][x] === '#') pen.px(cx - W * s / 2 + x * s, cy - H * s / 2 + y * s, s, s);
    }
  }

  /* ---------------- 表情库 ---------------- */
  // 网格 40×28；双眼中心 (12,12) (28,12)；嘴 (20,19)
  var BUILTIN_FACES = [
    { id: 'normal', label: '平常心', glow: C.cyan, draw: function (p) {
        p.set('#e8fffc'); p.diamond(12, 13, 3.6); p.diamond(28, 13, 3.6);
      } },
    { id: 'happy', label: '开心', glow: C.cyan, draw: function (p) {
        p.set(C.cyan); p.arcUp(12, 11, 10, 3.2); p.arcUp(28, 11, 10, 3.2);
        p.arcDown(20, 17, 8, 2.4);
      } },
    { id: 'laugh', label: '大笑', glow: C.cyan, draw: function (p) {
        p.set(C.cyan); p.arcUp(12, 10, 11, 3.6); p.arcUp(28, 10, 11, 3.6);
        p.rect(15, 16, 25, 17); p.rect(14, 17, 26, 21); p.rect(15, 22, 25, 22);
      } },
    { id: 'angry', label: '生气', glow: C.red, draw: function (p) {
        p.set(C.red);
        for (var i = 0; i <= 8; i++) { p.px(7 + i, 15 - Math.round(i * .62), 1, 3); p.px(33 - i, 15 - Math.round(i * .62), 1, 3); }
        p.rect(9, 14, 14, 15); p.rect(26, 14, 31, 15);
      } },
    { id: 'rage', label: '暴怒', glow: C.red, draw: function (p) {
        p.set(C.red);
        for (var i = 0; i <= 9; i++) { p.px(6 + i, 15 - Math.round(i * .7), 1, 4); p.px(34 - i, 15 - Math.round(i * .7), 1, 4); }
        p.rect(8, 13, 14, 16); p.rect(26, 13, 32, 16);
        p.anger(30, 4, 1.4);
      } },
    { id: 'cry', label: '大哭', glow: C.blue, draw: function (p) {
        p.set(C.blue);
        p.arcDown(12, 9, 9, 2.6); p.arcDown(28, 9, 9, 2.6);
        p.rect(11, 15, 13, 24); p.rect(27, 15, 29, 22);
        p.rect(12, 25, 13, 25); p.rect(27, 23, 29, 23);
        p.rect(9, 19, 10, 21); p.rect(30, 17, 31, 19);
      } },
    { id: 'sad', label: '委屈', glow: C.blue, draw: function (p) {
        p.set(C.blue);
        p.arcDown(12, 11, 8, 2); p.arcDown(28, 11, 8, 2);
        p.drop(8, 18, 1.2);
        p.set(C.white); p.hline(20, 19, 6);
      } },
    { id: 'love', label: '爱心眼', glow: C.pink, draw: function (p) {
        p.set(C.pink);
        p.heart(12, 12, 1.5); p.heart(28, 12, 1.5);
        p.arcDown(20, 18, 7, 2);
      } },
    { id: 'star', label: '星星眼', glow: C.gold, draw: function (p) {
        p.set(C.gold);
        p.star(12, 12, 1.4); p.star(28, 12, 1.4);
        p.arcDown(20, 18, 7, 2);
      } },
    { id: 'dizzy', label: '晕', glow: C.green, draw: function (p) {
        p.set(C.green);
        p.spiral(12, 12, 5); p.spiral(28, 12, 5);
        p.hline(20, 20, 5);
      } },
    { id: 'sleep', label: '困', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.hline(12, 12, 8); p.hline(28, 12, 8);
        p.zzz(34, 6, 1.3);
        p.hline(20, 18, 4);
      } },
    { id: 'speechless', label: '无语', glow: C.white, draw: function (p) {
        p.set(C.white);
        p.hline(12, 12, 9); p.hline(28, 12, 9);
      } },
    { id: 'doubt', label: '疑问', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.diamond(11, 12, 3.4); p.diamond(26, 12, 2.2);
        p.set(C.gold); p.qmark(35, 9, 1.6);
        p.set(C.cyan); p.rect(18, 19, 22, 19);
      } },
    { id: 'cool', label: '墨镜', glow: C.cyan, draw: function (p) {
        p.set('#04070a');
        p.rect(5, 9, 35, 10);
        p.rect(6, 11, 17, 15); p.rect(23, 11, 34, 15);
        p.rect(18, 11, 22, 13);
        p.set(C.white); p.px(8, 12, 3, 1); p.px(25, 12, 3, 1);
        p.set(C.cyan); p.arcUp(22, 19, 10, 2);
      } },
    { id: 'blush', label: '脸红', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.diamond(12, 12, 3.6); p.diamond(28, 12, 3.6);
        p.set(C.pink); p.rect(6, 17, 9, 19); p.rect(31, 17, 34, 19);
        p.set(C.cyan); p.arcDown(20, 17, 7, 2);
      } },
    { id: 'sweat', label: '流汗', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.diamond(11, 13, 3.4); p.diamond(26, 13, 3.4);
        p.set(C.blue); p.drop(35, 6, 1.5);
        p.set(C.cyan); p.hline(19, 20, 5);
      } },
    { id: 'grin', label: '坏笑', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.diamond(12, 12, 3.4);
        p.arcUp(28, 12, 8, 3);
        p.arcUp(22, 19, 9, 2.4);
      } },
    { id: 'shock', label: '惊讶', glow: C.white, draw: function (p) {
        p.set(C.white);
        p.ring(12, 12, 4); p.px(12, 12, 2, 2);
        p.ring(28, 12, 4); p.px(28, 12, 2, 2);
        p.ring(20, 19, 2);
      } },
    // 三轮补充：眨眼 / 吐舌 / 燃烧 / 思考 / 慌张 / 加载中
    { id: 'wink', label: '眨眼', glow: C.cyan, draw: function (p) {
        p.set(C.cyan); p.diamond(12, 12, 3.6);
        p.arcUp(28, 13, 9, 2.6);
        p.arcDown(20, 17, 8, 2.4);
      } },
    { id: 'tongue', label: '吐舌', glow: C.cyan, draw: function (p) {
        p.set(C.cyan); p.diamond(12, 11, 3.4); p.diamond(28, 11, 3.4);
        p.arcUp(20, 17, 9, 2.4);
        p.set(C.pink); p.rect(18, 18, 22, 21); p.rect(19, 22, 21, 23);
      } },
    { id: 'fire', label: '燃烧', glow: C.gold, draw: function (p) {
        p.set(C.gold);
        for (var i = 0; i <= 9; i++) {
          p.px(7 + i, 16 - Math.round(i * .55), 1, 3);
          p.px(33 - i, 16 - Math.round(i * .55), 1, 3);
        }
        p.rect(9, 13, 13, 14); p.rect(27, 13, 31, 14);
        p.set(C.red); p.rect(17, 18, 23, 20);
        p.px(20, 16, 1, 2);
      } },
    { id: 'think', label: '思考', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        p.diamond(11, 10, 2.8); p.diamond(27, 10, 2.8);
        p.px(9, 8, 1, 1); p.px(25, 8, 1, 1);
        p.hline(20, 20, 5);
        p.set(C.gold);
        p.rect(30, 9, 31, 10); p.rect(33, 6, 34, 7); p.rect(36, 3, 37, 4);
      } },
    { id: 'panic', label: '慌张', glow: C.white, draw: function (p) {
        p.set(C.white);
        p.ring(11, 11, 4); p.px(11, 11, 2, 2);
        p.ring(29, 11, 4); p.px(29, 11, 2, 2);
        p.set(C.blue); p.drop(4, 19, 1.2); p.drop(36, 17, 1.4);
        p.set(C.white); p.arcDown(20, 19, 7, 1.4);
      } },
    { id: 'loading', label: '加载中', glow: C.cyan, draw: function (p) {
        p.set(C.cyan);
        for (var a = 0; a < 52; a++) {
          var t = a / 64 * Math.PI * 2;
          p.px(12 + Math.round(Math.cos(t) * 4.2), 12 + Math.round(Math.sin(t) * 4.2));
          p.px(28 + Math.round(Math.cos(t + 1.3) * 4.2), 12 + Math.round(Math.sin(t + 1.3) * 4.2));
        }
        p.set(C.white); p.px(18, 20, 1, 1); p.px(20, 20, 1, 1); p.px(22, 20, 1, 1);
      } }
  ];

  /* ---------------- 表情二次创作（v1.9.0） ---------------- */
  // 内置表情也能改：名称 / 眼睛亮度 / 发光色 / 像素。只存改动（覆盖记录），未改动的内置表情仍走官方原画。
  var FACE_EDIT_KEY = 'traeEmoji.faceEdit.v1';
  var FACE_EDITS = {};                          // { [内置表情 id]: { label, glow, bright, cells } }
  var BRIGHT_MIN = 0.4, BRIGHT_MAX = 1.6;       // 眼睛亮度范围（1 = 官方亮度）

  function clampBright(v) {
    v = +v;
    if (!isFinite(v)) v = 1;
    return Math.max(BRIGHT_MIN, Math.min(BRIGHT_MAX, Math.round(v * 100) / 100));
  }
  function faceBright(def) { return (def && def.bright != null) ? clampBright(def.bright) : 1; }
  // 亮度同时作用于像素与 LED 辉光：像素在缓存位图里乘系数，辉光色按同一系数换算
  function brightenCanvas(cv, k) {
    if (!k || Math.abs(k - 1) < 0.001) return cv;
    var c = cv.getContext('2d');
    var img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      d[i] = Math.min(255, Math.round(d[i] * k));
      d[i + 1] = Math.min(255, Math.round(d[i + 1] * k));
      d[i + 2] = Math.min(255, Math.round(d[i + 2] * k));
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function brightHex(hex, k) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m || Math.abs(k - 1) < 0.001) return hex;
    var n = parseInt(m[1], 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * k));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * k));
    var b = Math.min(255, Math.round((n & 255) * k));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function faceGlow(def) { return brightHex(def.glow || C.cyan, faceBright(def)) || (def.glow || C.cyan); }
  function builtinFace(id) {
    for (var i = 0; i < BUILTIN_FACES.length; i++) if (BUILTIN_FACES[i].id === id) return BUILTIN_FACES[i];
    return null;
  }
  function isBuiltinFace(id) { return !!builtinFace(id); }
  function editedFaceDef(base, e) {
    return {
      id: base.id, label: e.label || base.label, glow: e.glow || base.glow,
      bright: clampBright(e.bright), cells: e.cells, edited: true, baseId: base.id,
      draw: function (p) { drawCells(p, e.cells); }
    };
  }
  // 把表情当前像素栅格化成 40×28 数据（内置表情进入编辑器做二次创作的底稿）
  function faceCellsOf(id) {
    var cv = getFaceCanvas(id).cv;
    var data = cv.getContext('2d').getImageData(0, 0, FW, FH).data;
    var cells = gridBlank(FW, FH);
    for (var i = 0; i < FW * FH; i++) {
      if (data[i * 4 + 3] > 8) {
        cells[i] = '#' + [0, 1, 2].map(function (k) {
          return ('0' + data[i * 4 + k].toString(16)).slice(-2);
        }).join('');
      }
    }
    return cells;
  }
  function faceEditSanitize(id, e) {
    var base = builtinFace(id);
    if (!base || !e || typeof e !== 'object') return null;
    if (!Array.isArray(e.cells) || e.cells.length !== FW * FH) return null;
    return {
      label: (typeof e.label === 'string' && e.label.trim() ? e.label.trim() : base.label).slice(0, 8),
      glow: /^#[0-9a-f]{6}$/i.test(e.glow || '') ? e.glow : base.glow,
      bright: clampBright(e.bright),
      cells: e.cells.slice()
    };
  }
  function loadFaceEdits() {
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem(FACE_EDIT_KEY) || '{}') || {}; }
    catch (e) { raw = {}; }
    FACE_EDITS = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    Object.keys(raw).forEach(function (id) {
      var rec = faceEditSanitize(id, raw[id]);
      if (rec) FACE_EDITS[id] = rec;
    });
  }
  function persistFaceEdits() {
    try { localStorage.setItem(FACE_EDIT_KEY, JSON.stringify(FACE_EDITS)); return true; }
    catch (e) { return false; }
  }

  /* ---------------- 自定义表情（像素画板产出） ---------------- */
  // 存储结构：{ id, label, glow, cells: 40×28 的颜色数组（空串=透明） }
  var CUSTOM_KEY = 'traeEmoji.customFaces.v1';
  var CUSTOM_MAX = 24;
  var CUSTOM_FACES = [];
  var FACES = BUILTIN_FACES.slice();   // 内置 + 自定义（就地增删，保证外部引用不失效）

  function drawCells(p, cells) {
    for (var y = 0; y < FH; y++) for (var x = 0; x < FW; x++) {
      var c = cells[y * FW + x];
      if (c) { p.col = c; p.px(x, y, 1, 1); }
    }
  }
  function customDef(rec) {
    return {
      id: rec.id, label: rec.label, glow: rec.glow, bright: clampBright(rec.bright),
      custom: true, cells: rec.cells,
      draw: function (p) { drawCells(p, rec.cells); }
    };
  }
  function loadCustomFaces() {
    try { CUSTOM_FACES = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]') || []; }
    catch (e) { CUSTOM_FACES = []; }
    if (!Array.isArray(CUSTOM_FACES)) CUSTOM_FACES = [];
    CUSTOM_FACES = CUSTOM_FACES.filter(function (r) {
      return r && r.id && Array.isArray(r.cells) && r.cells.length === FW * FH;
    });
    rebuildFaces();
  }
  function rebuildFaces() {
    FACES.length = 0;
    BUILTIN_FACES.forEach(function (d) {
      var e = FACE_EDITS[d.id];
      FACES.push(e ? editedFaceDef(d, e) : d);   // 二次创作过的内置表情走覆盖记录
    });
    CUSTOM_FACES.forEach(function (r) { FACES.push(customDef(r)); });
    fillAnimFace2();   // 表情列表变化（自定义增删 / 内置改名）→ 同步「第二表情」下拉
  }
  function persistCustomFaces() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(CUSTOM_FACES)); return true; }
    catch (e) { return false; }
  }
  loadFaceEdits();     // 需早于 rebuildFaces，否则内置表情的二次创作不会生效
  loadCustomFaces();

  /* ---------------- 手绘模型：3D 骨骼引擎 ---------------- */
  // 世界坐标：y 向下、z 朝观众，单位 = 1024 画布像素；透视相机在 -z。
  // 比例两轮校准：官方「全景图」（侧/正/3-4/背四视角，站立姿态）+ 五视图转面对照
  // （02-角色五视图-turnaround 的正/侧/背/顶，统一按头宽归一逐视角比对，2026-10-28 二轮）：
  // 头 402×306×360（宽:高:深 = 1 : 0.761 : 0.896），躯干 175×162×152，
  // 臂截面 58 贴躯干两侧，腿 82 宽 ×116 深，脚 84 宽 ×142 深；屏幕占头宽 0.75、上缘下移 64。
  var V3 = {
    rotX: function (a, t) { var c = Math.cos(t), s = Math.sin(t); return [a[0], a[1] * c - a[2] * s, a[1] * s + a[2] * c]; },
    norm: function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  };
  var CAM = { D: 3200, pitch: 0.055, cx: 512, cy: 660, zoom: 1.36 };
  // 光照拟合全景图实测：左侧面 55 / 顶 52 / 背 51 / 正面 48 → 高环境光 + 左上后方弱方向光
  var LIGHT = V3.norm([-0.84, -0.477, -0.356]);
  var LUM_A = 0.873, LUM_D = 0.151;

  function mMul(A, B) {
    var a = A.r, b = B.r, r = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return {
      r: r, t: [
        a[0] * B.t[0] + a[1] * B.t[1] + a[2] * B.t[2] + A.t[0],
        a[3] * B.t[0] + a[4] * B.t[1] + a[5] * B.t[2] + A.t[1],
        a[6] * B.t[0] + a[7] * B.t[1] + a[8] * B.t[2] + A.t[2]
      ]
    };
  }
  function mT(v) { return { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [v[0], v[1], v[2]] }; }
  function mS(v) { return { r: [v, 0, 0, 0, v, 0, 0, 0, v], t: [0, 0, 0] }; }
  function mRX(t) { var c = Math.cos(t), s = Math.sin(t); return { r: [1, 0, 0, 0, c, -s, 0, s, c], t: [0, 0, 0] }; }
  function mRY(t) { var c = Math.cos(t), s = Math.sin(t); return { r: [c, 0, s, 0, 1, 0, -s, 0, c], t: [0, 0, 0] }; }
  function mRZ(t) { var c = Math.cos(t), s = Math.sin(t); return { r: [c, -s, 0, s, c, 0, 0, 0, 1], t: [0, 0, 0] }; }
  function applyM(m, v) {
    var r = m.r;
    return [r[0] * v[0] + r[1] * v[1] + r[2] * v[2] + m.t[0],
            r[3] * v[0] + r[4] * v[1] + r[5] * v[2] + m.t[1],
            r[6] * v[0] + r[7] * v[1] + r[8] * v[2] + m.t[2]];
  }
  function rotOnly(m, v) {
    var r = m.r;
    return [r[0] * v[0] + r[1] * v[1] + r[2] * v[2],
            r[3] * v[0] + r[4] * v[1] + r[5] * v[2],
            r[6] * v[0] + r[7] * v[1] + r[8] * v[2]];
  }

  // 2026-10-28 三轮校准：头部回归「整块长方体 + 左下角缺角」，面部为凸出的显示器
  // 头 370×316×336（宽:高:深 = 1 : 0.854 : 0.908）——比二轮校准更窄、后脑更短，
  // 玻璃宽/头宽随之升到 0.81，贴近官方正视图实测（0.81）；
  // 屏幕占比按官方正视图实测：玻璃高 0.68H、上缘下移 53（下方留 47 的「下巴」）
  // 显示器为凸出式装配件：边框板凸出前脸 12、玻璃再内凹 4，侧/顶视可见台阶（五视图/官方一致）
  // 骨骼按 MC 式简化：头 / 躯干 / 双臂（肩关节）/ 双腿（髋关节）+ 随腿脚掌，
  // 原骨骼取消肘、膝关节；v1.7 在前臂节点上附加局部变换，默认仍保持单段外观
  //
  // ── 全身塑形引擎（v1.8.0）──────────────────────────────
  // BODY_BASE：官方标准体型的实测基准尺寸（v1.7.4 定稿，含派生量的官方实测值）。
  // BODY_REST：十项体型比例，全部 = 1 即官方标准体型（默认档）。
  // GEO3D：当前生效几何 —— applyBody 依据比例派生写入；全部为 1 时逐字段严格等于
  //        旧硬编码字面量（官方观感像素级不变）。骨骼 / 渲染 / IK / 缩略图均读 GEO3D，
  //        体型改一处全局生效。派生公式在 f=1 时只做 ×1 与 ±0 运算，不引入浮点误差。
  var BODY_BASE = {
    headW: 370, headH: 316, headD: 336, headY: -233.5,
    screenW: 274, screenH: 216, screenTopOff: 53,
    // v1.6.1：屏幕玻璃从「单面贴图」改为「有厚度的深色实体」，外廓与边框外框同大、
    // 纵深 34 且前表面内凹 4（bezelRecess）；边框只保留前沿一圈薄板（bezelDepth 8），
    // 于是凸出前脸的那 12 里，只有最外 8 是边框色、其余都是深色玻璃侧壁——
    // 斜视角看到的是「屏幕本体」而不是一块与机身同色的板。
    // v1.6.2：边框要「任何角度都看得见」，光靠前脸薄板不行——转到 90° 前脸投影面积为 0 就整圈消失了。
    // 因此边框改成真正有厚度的框条（纵深 20：从前脸内 8 一直到凸出端 12），比玻璃更靠外，
    // 玻璃外廓再向内缩 glassInset（3）；侧视角于是读到「浅色边框包着深色屏体」的实体断面。
    // v1.7.1：边框纵深 20 → 26（前表面位置不变，向头部内侧多嵌 6），
    // 保证任何视角下边框都与脸面体积重叠，不会出现「边框浮在脸外」的缝。
    // v1.7.3：玻璃纵深 34 → 22，让玻璃的 z 范围完全落在边框纵深之内（玻璃 154~176 / 边框 154~180）。
    // 否则转角约 50° 以上时，玻璃左侧壁会比边框多露出 (34-26)×sinθ ≈ 7 的投影，
    // 在边框与机身之间形成一条 10px 的深色竖带——这就是被读成「缝隙」的那条暗线。
    // v1.8.0：边框 / 玻璃 / 缺角均为结构特征件，尺寸固定，不随体型缩放。
    bezelPad: 5, bezelProtrude: 12, bezelDepth: 26, bezelRecess: 4, glassInset: 3, glassDepth: 22,
    // 缺角整体落在「脸面边框」里：脸边到屏幕板边的间距 43，缺口宽 40、高 38，
    // 与屏幕板左边/下沿各留 3~4 的空隙，保证屏幕板（含凸出台阶）完全不遮挡缺角
    notchW: 40, notchH: 38, notchD: 58,
    torsoW: 175, torsoH: 162, torsoOy: 0, torsoD: 152,
    shoulderX: 113, shoulderY: -76,
    armW: 29, armLen: 140, handW: 58, handH: 8, handD: 56,
    hipX: 42, hipY: 74, legW: 41, legD: 58, legLen: 102,
    footW: 36, footH: 8, footD: 142
  };
  // 十项比例：头三围 / 屏幕占比 / 躯干宽长 / 四肢粗细 / 臂长 / 腿长 / 脚掌长度
  var BODY_REST = { headW: 1, headH: 1, headD: 1, screen: 1, torsoW: 1, torsoH: 1,
    limb: 1, armLen: 1, legLen: 1, foot: 1 };
  var GEO3D = {};           // 当前生效几何（applyBody 派生写入；调试句柄引用同一对象）
  var CAM_OFFICIAL = null;   // 官方构图的头顶/脚底投影锚点（首次 applyBody 时记录，用于取景自适应）
  function bodyClone(f) {
    var o = {}, k;
    for (k in BODY_REST) o[k] = f && f[k] !== undefined ? +f[k] : BODY_REST[k];
    return o;
  }
  // 比例只接受滑杆范围内的数值（导入的 JSON / 旧存档一并钳制）
  function bodyFactorClamp(key, v) {
    for (var i = 0; i < BODY_SLIDER_DEFS.length; i++) {
      var d = BODY_SLIDER_DEFS[i];
      if (d[0] === key) return Math.max(d[2], Math.min(d[3], +v || 1));
    }
    return 1;
  }
  function bodySanitize(f) {
    var o = bodyClone();
    for (var k in o) o[k] = bodyFactorClamp(k, f && f[k]);
    return o;
  }
  function bodyEq(a, b) {
    return Object.keys(BODY_REST).every(function (k) { return +a[k] === +b[k]; });
  }
  // 站立姿态下角色头顶 / 脚底的世界坐标 y（bounce=0，不含呼吸与跳动）
  function bodyExtents() {
    return [GEO3D.headY - GEO3D.headH / 2, GEO3D.hipY + GEO3D.legLen + GEO3D.footH * 2];
  }
  // 取景自适应（v1.8.0）：超高体型把全身投影高度压回官方构图高度（等比缩 zoom），
  // 再把头顶锚定到官方头顶位置；官方体型 zoom/cy 一步不动（保证像素级不变）。
  function fitCamera() {
    var ext = bodyExtents();
    if (!CAM_OFFICIAL) {   // 首次调用 = 官方体型：只记录锚点，CAM 维持源码标定值
      CAM_OFFICIAL = { top: projectV([0, ext[0], 0])[1], bottom: projectV([0, ext[1], 0])[1] };
      return;
    }
    CAM.zoom = 1.36; CAM.cy = 660;
    var t = projectV([0, ext[0], 0])[1], b = projectV([0, ext[1], 0])[1];
    var fit = CAM_OFFICIAL.bottom - CAM_OFFICIAL.top;
    if (b - t > fit) {
      CAM.zoom = 1.36 * fit / (b - t);
      t = projectV([0, ext[0], 0])[1];
    }
    CAM.cy = 660 + (CAM_OFFICIAL.top - t);
  }
  // 体型 → 几何：直接量 = 基准 × 比例（IEEE 的 ×1 精确不变）；联动量用「基准 + Δ」形式；
  // 官方档逐字段等于 BODY_BASE。屏幕占比受缺角硬约束：左缘给缺角留缝、下缘不越过缺角顶。
  function applyBody(f) {
    f = f || (S && S.body) || BODY_REST;
    var B = BODY_BASE;
    GEO3D.headW = B.headW * f.headW;
    GEO3D.headH = B.headH * f.headH;
    GEO3D.headD = B.headD * f.headD;
    // 屏幕：随头部三围整体缩放，再乘占比比例；占比过大时按缺角边界收口
    GEO3D.screenW = Math.min(B.screenW * f.screen * f.headW, GEO3D.headW - B.notchW - 32);
    GEO3D.screenH = Math.min(B.screenH * f.screen * f.headH, GEO3D.headH - B.notchH * 2 - 22);
    GEO3D.screenTopOff = (GEO3D.headH - GEO3D.screenH) / 2 + 3;   // 官方：垂直略偏下（53 = 50 + 3）
    GEO3D.notchW = B.notchW; GEO3D.notchH = B.notchH; GEO3D.notchD = B.notchD;
    GEO3D.bezelPad = B.bezelPad; GEO3D.bezelProtrude = B.bezelProtrude; GEO3D.bezelDepth = B.bezelDepth;
    GEO3D.bezelRecess = B.bezelRecess; GEO3D.glassInset = B.glassInset; GEO3D.glassDepth = B.glassDepth;
    GEO3D.torsoW = B.torsoW * f.torsoW;
    GEO3D.torsoH = B.torsoH * f.torsoH;
    GEO3D.torsoD = B.torsoD * f.torsoW;   // 厚度随躯干宽（围度）联动
    GEO3D.torsoOy = B.torsoOy;
    GEO3D.armW = B.armW * f.limb;
    GEO3D.armLen = B.armLen * f.armLen;
    GEO3D.handW = GEO3D.armW * 2;          // 官方关系：手宽 = 2×臂宽、手厚随臂厚
    GEO3D.handD = GEO3D.armW * 2 - 2;
    GEO3D.handH = B.handH;
    GEO3D.legW = B.legW * f.limb;
    GEO3D.legD = B.legD * f.limb;
    GEO3D.legLen = B.legLen * f.legLen;
    GEO3D.footW = GEO3D.legW - 5;          // 官方关系：脚宽 = 腿宽 - 5
    GEO3D.footH = B.footH;
    GEO3D.footD = B.footD * f.foot;
    // 关节位置随躯干 / 头联动（官方关系：肩X = 躯干半宽+臂半宽+11、肩Y = 躯干顶+5、
    // 髋Y = 躯干半高-7、髋X = 0.24×躯干宽、颈部咬合 5.5）
    GEO3D.shoulderX = B.shoulderX + (GEO3D.torsoW - B.torsoW) / 2 + (GEO3D.armW - B.armW) / 2;
    GEO3D.shoulderY = B.shoulderY - (GEO3D.torsoH - B.torsoH) / 2;
    GEO3D.hipX = B.hipX + (GEO3D.torsoW - B.torsoW) * 0.24;
    GEO3D.hipY = B.hipY + (GEO3D.torsoH - B.torsoH) / 2;
    GEO3D.headY = B.headY - (GEO3D.torsoH - B.torsoH) / 2 - (GEO3D.headH - B.headH) / 2;
    fitCamera();
    return GEO3D;
  }
  applyBody(BODY_REST);   // 模块加载即派生官方几何（此帧同时记录 CAM_OFFICIAL 锚点）

  var REST_RIG = {
    bodyYaw: 0, bodyPitch: 0, bodyRoll: 0, headYaw: 0, headPitch: 0,
    lArmSide: 2, lArmFront: 10, rArmSide: 2, rArmFront: 10,
    lLegSide: 0, lLegFront: 0, rLegSide: 0, rLegFront: 0, bounce: 0
  };
  function rigClone(r) { var o = {}, k; for (k in REST_RIG) o[k] = (r && r[k]) || 0; return o; }

  // v1.7.0：部位附加变换叠加在原骨骼之上；左右上臂 / 前臂 / 手 / 腿 / 脚均可独立选择
  var PART_DEFS = [
    { id: 'head', label: '头部' }, { id: 'neck', label: '颈部' }, { id: 'torso', label: '躯干' },
    { id: 'armL', label: '左上臂' }, { id: 'forearmL', label: '左前臂' }, { id: 'handL', label: '左手' },
    { id: 'armR', label: '右上臂' }, { id: 'forearmR', label: '右前臂' }, { id: 'handR', label: '右手' },
    { id: 'legL', label: '左腿' }, { id: 'footL', label: '左脚' },
    { id: 'legR', label: '右腿' }, { id: 'footR', label: '右脚' }
  ];
  var PART_REST = { scale: 1, rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0 };
  function partClone(p) {
    var o = {}, k;
    for (k in PART_REST) o[k] = p && p[k] !== undefined ? +p[k] : PART_REST[k];
    return o;
  }
  function createPartStates(src) {
    var o = {};
    PART_DEFS.forEach(function (d) { o[d.id] = partClone(src && src[d.id]); });
    return o;
  }
  function isPartRest(p) {
    if (!p) return true;
    return Object.keys(PART_REST).every(function (k) { return +p[k] === PART_REST[k]; });
  }

  // 姿势 = 原骨骼角度组（肩摆 / 髋摆）；v1.7 的肘部弯曲由部位附加变换独立驱动
  // 全部姿势均为程序绘制，底部自绘参考图仅作展示，不进入生成链路
  var RIG_POSES = {
    pstand: { label: '站立', rig: rigClone(REST_RIG) },
    pwave: { label: '打招呼', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 120, lArmFront: 12, headYaw: -8, bodyRoll: -3 }) },
    pcheer: { label: '庆祝', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 120, rArmSide: 120, lArmFront: 6, rArmFront: 6, bounce: -26 }) },
    pshrug: { label: '摊手', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 74, rArmSide: 74, lArmFront: -16, rArmFront: -16, headPitch: -6 }) },
    pakimbo: { label: '叉腰', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 38, rArmSide: 38, lArmFront: 4, rArmFront: 4 }) },
    prun: { label: '奔跑', rig: Object.assign(rigClone(REST_RIG), { lArmFront: -46, rArmFront: 40, lLegFront: -34, rLegFront: 30, bodyPitch: 7, bodyRoll: -3, bounce: -12 }) },
    // 复刻官方 5 姿势（站立已有 pstand，此处新增跳跃/敲键盘/比心/骑马）
    pjump: { label: '跳跃', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 42, rArmSide: 42, lArmFront: -18, rArmFront: -18, lLegFront: -22, rLegFront: 22, headPitch: -8, bounce: -58 }) },
    plaptop: { label: '敲键盘', rig: Object.assign(rigClone(REST_RIG), { lArmFront: -58, rArmFront: -58, lArmSide: 12, rArmSide: 12, headPitch: 14, bodyPitch: 8 }) },
    plove: { label: '比心', rig: Object.assign(rigClone(REST_RIG), { lArmSide: 120, rArmSide: 120, lArmFront: -22, rArmFront: -22, headYaw: -6, bodyRoll: -2 }) },
    pride: { label: '骑马', rig: Object.assign(rigClone(REST_RIG), { lArmFront: -22, rArmFront: -22, lLegSide: 32, rLegSide: 32, lLegFront: -8, rLegFront: -8, bodyPitch: -4 }) }
  };
  var PROC_POSES = RIG_POSES; // 兼容旧引用

  function shadeHex(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    // 亮色自动等比压缩亮度（v1.5.0）：避免最亮面削顶发白，换浅色后仍保留正/侧/顶明暗层次
    var max = Math.max(r, g, b);
    if (max * f > 255) f = 255 / max;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  function buildSkeleton(rig) {
    var g = GEO3D, R = Math.PI / 180; // 骨骼角度单位 = 度
    // 外壳配色（v1.5.0）：手 / 脚沿用官方「比本肢略亮」的关系，缺口阴影按头色等比压暗
    var P = S.skin || SKIN_OFFICIAL, parts = S.parts || createPartStates();
    // v1.6.0：缺口阴影片对比度收窄（.78 → .86），避免斜视角下读成「内部黑洞」
    var handCol = skinMix(P.arm, 1.16), footCol = skinMix(P.leg, 1.19), notchCol = skinMix(P.head, .86);
    var torso = { part: 'torso', pos: [0, rig.bounce || 0, 0], rot: [rig.bodyPitch * R, rig.bodyYaw * R, rig.bodyRoll * R] };
    // 屏幕装配件：环形边框（凸出前脸）+ 凹槽内的深色玻璃实体 + 贴在前面的表情面
    var sy0 = -g.headH / 2 + g.screenTopOff;
    var bzW = g.screenW + g.bezelPad * 2;
    // 颈部是头身连接节点。代理盒只用于点选 / 高亮，不参与实体绘制，默认外观与 v1.6.2 完全一致。
    var neck = {
      part: 'neck', pos: [0, g.headY, 0], rot: [0, 0, 0],
      boxes: [{ s: [46, 6, 46], o: [0, g.headH / 2, 0], col: P.torso, proxy: true, pick: 2 }]
    };
    var head = {
      part: 'head', pos: [0, 0, 0], rot: [rig.headPitch * R, rig.headYaw * R, 0],
      boxes: [
        // 主头盒：整块长方体，底面止于缺角顶（edge:'self' 消除拼块接缝线，读作一整块）
        { s: [g.headW / 2, (g.headH - g.notchH) / 2, g.headD / 2],
          o: [0, -g.notchH / 2, 0], col: P.head, edge: 'self' },
        // 缺角右侧补块：底带右半（含缺口以右全部深度）
        { s: [(g.headW - g.notchW) / 2, g.notchH / 2, g.headD / 2],
          o: [g.notchW / 2, g.headH / 2 - g.notchH / 2, 0], col: P.head, edge: 'self' },
        // 缺角后侧补块：底带左端只保留缺口深度之后的部分，形成 L 形缺角
        { s: [g.notchW / 2, g.notchH / 2, (g.headD - g.notchD) / 2],
          o: [-g.headW / 2 + g.notchW / 2, g.headH / 2 - g.notchH / 2, -g.notchD / 2],
          col: P.head, edge: 'self' },
        // 缺口内壁阴影片：贴合缺口后壁（v1.6.0 由「内缩 2 留亮边」改为「铺满开口」，
        // 否则斜视角下亮边会把凹槽读成外凸的内壁板）
        { s: [g.notchW / 2, g.notchH / 2, 0.8],
          o: [-g.headW / 2 + g.notchW / 2, g.headH / 2 - g.notchH / 2, g.headD / 2 - g.notchD + 0.8],
          col: notchCol },
        // 屏幕边框（v1.6.1）：由「一块实心盒子」改为「环形四条边」，只占最外 8 深（前沿薄板），
        // 中间留出真正的凹槽；配合下方同外廓的玻璃实体，凸出部分的内侧是深色屏体。
        // v1.7.2：四条边框改用面色描边（edge:'self'）。深色描边压在边框与头前脸的交界上，
        // 会被读成「边框没有贴住脸、中间有一条缝」；同色描边让边框从脸面平滑长出。
        { s: [bzW / 2, g.bezelPad / 2, g.bezelDepth / 2],
          o: [0, sy0 - g.bezelPad / 2, g.headD / 2 + g.bezelProtrude - g.bezelDepth / 2],
          col: P.bezel, front: 1, edge: 'self' },
        { s: [bzW / 2, g.bezelPad / 2, g.bezelDepth / 2],
          o: [0, sy0 + g.screenH + g.bezelPad / 2, g.headD / 2 + g.bezelProtrude - g.bezelDepth / 2],
          col: P.bezel, front: 1, edge: 'self' },
        { s: [(bzW - g.screenW) / 4, g.screenH / 2, g.bezelDepth / 2],
          o: [-(bzW + g.screenW) / 4, sy0 + g.screenH / 2, g.headD / 2 + g.bezelProtrude - g.bezelDepth / 2],
          col: P.bezel, front: 1, edge: 'self' },
        { s: [(bzW - g.screenW) / 4, g.screenH / 2, g.bezelDepth / 2],
          o: [(bzW + g.screenW) / 4, sy0 + g.screenH / 2, g.headD / 2 + g.bezelProtrude - g.bezelDepth / 2],
          col: P.bezel, front: 1, edge: 'self' },
        // 屏幕玻璃（v1.6.1 实体化；v1.6.2 外廓内缩 glassInset，让边框侧壁露在它外侧）：
        // 前表面比边框前沿内凹 4，正面藏在边框框条后面（观感不变）；
        // v1.7.3 起纵深收窄到 22，与边框后缘齐平，任何转角下玻璃侧壁都不会露出边框之外。
        { s: [(bzW - g.glassInset * 2) / 2, (g.screenH + g.bezelPad * 2 - g.glassInset * 2) / 2, g.glassDepth / 2],
          o: [0, sy0 + g.screenH / 2,
              g.headD / 2 + g.bezelProtrude - g.bezelRecess - g.glassDepth / 2],
          col: '#161b18', front: 0.6, edge: 'self' }
      ]
    };
    // 静止时仍绘制 v1.6.2 的原始整臂网格，并用两个不绘制的代理盒区分上臂 / 前臂点选；
    // 只有前臂发生局部调整时才切换成分段实体，既保留默认像素，也允许真实肘部形变。
    function arm(side, sV, fV) {
      var suffix = side < 0 ? 'L' : 'R', joinRest = isPartRest(parts['forearm' + suffix]);
      var upper = {
        part: 'arm' + suffix,
        pos: [side * g.shoulderX, g.shoulderY, 0], rot: [fV * R, 0, (side < 0 ? sV : -sV) * R],
        boxes: [
          { s: [g.armW, g.armLen / 2, g.armW + 15], o: [0, g.armLen / 2, 0], col: P.arm,
            joinRest: joinRest, mergedRest: true, noPick: true },
          { s: [g.armW, g.armLen / 4, g.armW + 15], o: [0, g.armLen / 4, 0], col: P.arm,
            joinRest: joinRest, splitPart: true },
          { s: [g.armW, g.armLen / 4, g.armW + 15], o: [0, g.armLen / 4, 0], col: P.arm,
            joinRest: joinRest, restProxy: true, proxy: true }
        ]
      };
      var hand = {
        part: 'hand' + suffix, pos: [0, g.armLen / 2 - 2, 0], rot: [0, 0, 0],
        boxes: [{ s: [g.handW / 2, g.handH, g.handD / 2], o: [0, 2, 0], col: handCol }]
      };
      upper.children = [{
        part: 'forearm' + suffix, pos: [0, g.armLen / 2, 0], rot: [0, 0, 0],
        boxes: [
          // v1.7.1：前臂实体盒向肘部内侧延伸 8，与前臂旋转产生的楔形缺口重叠，避免弯肘露缝
          { s: [g.armW, g.armLen / 4 + 7, g.armW + 15], o: [0, g.armLen / 4 - 9, 0], col: P.arm,
            joinRest: joinRest, splitPart: true },
          { s: [g.armW, g.armLen / 4 + 7, g.armW + 15], o: [0, g.armLen / 4 - 9, 0], col: P.arm,
            joinRest: joinRest, restProxy: true, proxy: true }
        ],
        children: [hand]
      }];
      return upper;
    }
    // 腿：单段刚体（髋关节前后摆 + 侧摆），脚掌挂在腿末端一起转，不做膝弯
    // v1.6.0：同理删除「髋关节填充」盒体（上端外露到躯干下沿之外）
    function leg(side, fV, sV) {
      var suffix = side < 0 ? 'L' : 'R';
      return {
        part: 'leg' + suffix,
        pos: [side * g.hipX, g.hipY, 0], rot: [fV * R, 0, (side < 0 ? sV : -sV) * R],
        boxes: [{ s: [g.legW, g.legLen / 2, g.legD], o: [0, g.legLen / 2, 0], col: P.leg }],
        children: [{
          part: 'foot' + suffix, pos: [0, g.legLen, 0], rot: [0, 0, 0],
          // v1.7.1：脚掌向上延伸到腿内 8（默认被腿体积遮住，观感不变），脚掌单独旋转时不再露缝
          boxes: [{ s: [g.footW, g.footH + 4, g.footD / 2], o: [0, 4, 10], col: footCol }]
        }]
      };
    }
    neck.children = [head];
    torso.children = [
      neck,
      arm(-1, rig.lArmSide, rig.lArmFront),
      arm(1, rig.rArmSide, rig.rArmFront),
      leg(-1, rig.lLegFront, rig.lLegSide),
      leg(1, rig.rLegFront, rig.rLegSide),
      // 躯干实体保持在原来的收集顺序末尾；根节点已承担部位变换，这里不再重复叠加。
      { part: 'torso', noAdj: true, pos: [0, 0, 0], rot: [0, 0, 0],
        boxes: [{ s: [g.torsoW / 2, g.torsoH / 2, g.torsoD / 2], o: [0, g.torsoOy, 0], col: P.torso }] }
    ];
    var nodes = {};
    (function mapNodes(node) {
      if (node.part) nodes[node.part] = node;
      (node.children || []).forEach(mapNodes);
    })(torso);
    return { root: torso, head: head, handL: nodes.handL, nodes: nodes };
  }

  // 原骨骼矩阵之后叠加部位局部 T × R × S；父级变换自然带动全部子级。
  function updateSkeletonMatrices(sk) {
    (function traverse(node, pm) {
      var rot = node.rot || [0, 0, 0];
      var local = mMul(mT(node.pos), mMul(mRX(rot[0]), mMul(mRY(rot[1]), mRZ(rot[2]))));
      var p = !node.noAdj && node.part && S.parts && S.parts[node.part];
      if (p) {
        var adj = mMul(mT([p.x, p.y, p.z]),
          mMul(mRX(p.rx * Math.PI / 180), mMul(mRY(p.ry * Math.PI / 180),
            mMul(mRZ(p.rz * Math.PI / 180), mS(p.scale)))));
        local = mMul(local, adj);
      }
      node._m = mMul(pm, local);
      (node.children || []).forEach(function (c) { traverse(c, node._m); });
    })(sk.root, mIdent0());
    return sk;
  }

  var FACE_DEFS = [
    [[4, 5, 7, 6], [0, 0, 1]], [[1, 0, 2, 3], [0, 0, -1]],
    [[5, 1, 3, 7], [1, 0, 0]], [[0, 4, 6, 2], [-1, 0, 0]],
    [[2, 6, 7, 3], [0, 1, 0]], [[0, 1, 5, 4], [0, -1, 0]]
  ];

  function projectV(v) {
    var vv = V3.rotX(v, CAM.pitch);
    var k = CAM.D / (CAM.D - vv[2]); // 相机在 +z：越远（z 越负）越小
    return [CAM.cx + vv[0] * k * CAM.zoom, CAM.cy + vv[1] * k * CAM.zoom, vv[2]];
  }

  /* ---------------- 场景道具（世界坐标系，不随角色骨骼转动） ---------------- */
  // 返回与角色 boxes 同构的 { s:[hx,hy,hz], o:[cx,cy,cz], col:'#hex' } 数组
  function buildProps(poseId) {
    var B = [];
    if (poseId === 'plaptop') {
      // 桌面（角色前方，台面在腰际）
      B.push({ s: [150, 5, 80], o: [0, 52, 130], col: '#4a3b2a' });
      // 桌腿（前侧两根）
      B.push({ s: [6, 52, 6], o: [-130, 104, 190], col: '#3a2d1f' });
      B.push({ s: [6, 52, 6], o: [130, 104, 190], col: '#3a2d1f' });
      // 笔记本底座
      B.push({ s: [48, 3, 32], o: [0, 47, 128], col: '#2a2d30' });
      // 笔记本屏幕（斜立薄板，向后倾 ~20°，用两个盒近似斜面）
      B.push({ s: [48, 30, 2], o: [0, 22, 100], col: '#1c1f22' });
      B.push({ s: [44, 26, 1], o: [0, 24, 101], col: '#0e2a22' });
    } else if (poseId === 'pride') {
      // 马身
      B.push({ s: [52, 32, 95], o: [0, 108, -5], col: '#5a3a1c' });
      // 马头（前上方）
      B.push({ s: [20, 26, 24], o: [0, 76, 82], col: '#5a3a1c' });
      // 马耳
      B.push({ s: [4, 10, 4], o: [-8, 60, 78], col: '#4a2e12' });
      B.push({ s: [4, 10, 4], o: [8, 60, 78], col: '#4a2e12' });
      // 马腿 ×4
      [[-38, 160, 45], [38, 160, 45], [-38, 160, -55], [38, 160, -55]].forEach(function (p) {
        B.push({ s: [8, 52, 8], o: p, col: '#4a2e12' });
      });
      // 马尾
      B.push({ s: [6, 34, 6], o: [0, 96, -96], col: '#3a250e' });
      // 缰绳（细条，从马头连到角色手部）
      B.push({ s: [2, 2, 30], o: [0, 62, 60], col: '#2a1a0a' });
    }
    return B;
  }

  // 把道具 boxes 以恒等矩阵（世界坐标）加入 faces 列表
  function collectProps(faces, poseId) {
    buildProps(poseId).forEach(function (box) {
      var s3 = box.s, o = box.o, c = [];
      for (var i = 0; i < 8; i++) {
        c.push([o[0] + (i & 1 ? s3[0] : -s3[0]),
                o[1] + (i & 2 ? s3[1] : -s3[1]),
                o[2] + (i & 4 ? s3[2] : -s3[2])]);
      }
      FACE_DEFS.forEach(function (fd) {
        var nW = fd[1]; // 恒等矩阵：法线即面朝向
        var ctr = [(c[fd[0][0]][0] + c[fd[0][1]][0] + c[fd[0][2]][0] + c[fd[0][3]][0]) / 4,
                   (c[fd[0][0]][1] + c[fd[0][1]][1] + c[fd[0][2]][1] + c[fd[0][3]][1]) / 4,
                   (c[fd[0][0]][2] + c[fd[0][1]][2] + c[fd[0][2]][2] + c[fd[0][3]][2]) / 4];
        // v1.7.1：与角色面统一口径（法线归一化 + 投影面积兜底），否则道具仍会边角消失
        var nV = V3.rotX(V3.norm(nW), CAM.pitch);
        var vDir = V3.norm([ctr[0], ctr[1], ctr[2] - CAM.D]);
        if (V3.dot(nV, vDir) > 0.05) return;
        var pts = fd[0].map(function (i) { return projectV(c[i]); });
        var a2 = 0;
        for (var q = 0; q < 4; q++) {
          var pa = pts[q], pb = pts[(q + 1) % 4];
          a2 += pa[0] * pb[1] - pb[0] * pa[1];
        }
        if (a2 < 2) return;
        var lum = LUM_A + LUM_D * Math.max(0, V3.dot(nW, LIGHT));
        // 道具与角色共用同一排序口径（最近点），否则马身 / 桌面会和腿面比错量纲
        faces.push({ pts: pts, col: shadeHex(box.col, lum),
          z: Math.max(c[fd[0][0]][2], c[fd[0][1]][2], c[fd[0][2]][2], c[fd[0][3]][2]) });
      });
    });
  }

  var PART_FACE_CACHE = [];   // 主预览的可见部位面：用于点选与预览层高亮（导出画布不覆盖）

  function renderProcedural(ctx, s, deviceScale, rigArg, faceArg) {
    var rig = rigArg || S.rig || REST_RIG;
    var g = GEO3D, k = s / BASE;
    deviceScale = deviceScale || k;
    ctx.save();
    ctx.scale(k, k);

    // 地面：接触阴影（光从左上来 → 影子偏右）+ 淡倒影
    var groundY = CAM.cy + (g.hipY + g.legLen + g.footH * 2) * CAM.zoom * 1.04
      - (rig.bounce || 0) * CAM.zoom * .3;
    var refGrad = ctx.createLinearGradient(0, groundY - 6, 0, groundY + 118 * CAM.zoom);
    refGrad.addColorStop(0, 'rgba(20,22,24,.13)');
    refGrad.addColorStop(1, 'rgba(20,22,24,0)');
    ctx.fillStyle = refGrad;
    ctx.beginPath();
    ctx.ellipse(CAM.cx + 14 * CAM.zoom, groundY + 52 * CAM.zoom, 128 * CAM.zoom, 52 * CAM.zoom, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,12,14,.20)';
    ctx.beginPath();
    ctx.ellipse(CAM.cx + 40 * CAM.zoom, groundY + 4, 176 * CAM.zoom / 1.38, 18 * CAM.zoom / 1.38, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,12,14,.13)';
    ctx.beginPath();
    ctx.ellipse(CAM.cx + 88 * CAM.zoom, groundY + 8, 240 * CAM.zoom / 1.38, 24 * CAM.zoom / 1.38, 0, 0, 7);
    ctx.fill();

    var sk = updateSkeletonMatrices(buildSkeleton(rig));
    LAST_SK = sk;   // v1.10.0：缓存当帧骨骼，供挂载式贴纸取部位世界矩阵（动画逐帧更新）

    // 屏幕装配件（边框 + 玻璃）贴在头前脸上，排序必须排在「头正面」之后。
    // 头正面是个大四边形，转角后它离相机最近的那个角 z 会远大于屏幕件自身四角的 z，
    // 按「面最近点 z」排序时会把整块边框 / 玻璃压低、被头前脸盖掉（斜视角看不到屏幕边框的原因）。
    // 这里先取头正面四角的最近点 z，作为屏幕件的排序下限（见 collect 里的 box.front）。
    var hzm = sk.head._m, hhw = g.headW / 2, hhh = g.headH / 2;
    var headFrontZ = Math.max(
      applyM(hzm, [-hhw, -hhh, g.headD / 2])[2], applyM(hzm, [hhw, -hhh, g.headD / 2])[2],
      applyM(hzm, [hhw, hhh, g.headD / 2])[2], applyM(hzm, [-hhw, hhh, g.headD / 2])[2]);

    // 收集所有面（画家算法）
    var faces = [];
    (function collect(node) {
      (node.boxes || []).forEach(function (box) {
        // 静止：原始整臂 + 分段选择代理；前臂调整后：分段实体，代理与整臂退场。
        if (box.mergedRest && !box.joinRest) return;
        if (box.splitPart && box.joinRest) return;
        if (box.restProxy && !box.joinRest) return;
        var s3 = box.s, o = box.o, c = [];
        for (var i = 0; i < 8; i++) {
          c.push(applyM(node._m, [o[0] + (i & 1 ? s3[0] : -s3[0]), o[1] + (i & 2 ? s3[1] : -s3[1]), o[2] + (i & 4 ? s3[2] : -s3[2])]));
        }
        FACE_DEFS.forEach(function (fd) {
          var nW = rotOnly(node._m, fd[1]);
          var ctr = [(c[fd[0][0]][0] + c[fd[0][1]][0] + c[fd[0][2]][0] + c[fd[0][3]][0]) / 4,
                     (c[fd[0][0]][1] + c[fd[0][1]][1] + c[fd[0][2]][1] + c[fd[0][3]][1]) / 4,
                     (c[fd[0][0]][2] + c[fd[0][1]][2] + c[fd[0][2]][2] + c[fd[0][3]][2]) / 4];
          // v1.7.1：法线先归一化。部位整体缩放会等比例放大法线长度，dot 随之放大，
          // 放大后的部件「接近垂直」的面就会被 0.001 阈值误判成背面，整块薄片凭空消失。
          var nV = V3.rotX(V3.norm(nW), CAM.pitch);
          var vDir = V3.norm([ctr[0], ctr[1], ctr[2] - CAM.D]); // 相机在 +z
          if (V3.dot(nV, vDir) > 0.05) return;   // 明确背面才快速剔除
          var pts = fd[0].map(function (i) { return projectV(c[i]); });
          // 投影有向面积兜底（与 v1.6.1 屏幕判据同口径）：dot 落在 0~0.05 的临界薄面
          // 靠面积判断，避免「侧视角手 / 脚 / 边框整块消失」，也保证收窄是连续的。
          var area2 = 0;
          for (var q = 0; q < 4; q++) {
            var pa2 = pts[q], pb2 = pts[(q + 1) % 4];
            area2 += pa2[0] * pb2[1] - pb2[0] * pa2[1];
          }
          if (area2 < 2) return;
          var lum = LUM_A + LUM_D * Math.max(0, V3.dot(nW, LIGHT));
          // v1.6.0：排序键取「该面在相机方向的最近点」(max z)，而非面中心。
          // 按面中心排序时，大面（如头侧壁，中心 z≈0）会被整体画在贴近它的近侧面（举手手臂，z≈44）之后，
          // 形成「手臂穿过头部 / 远侧面盖住近侧面」的假透明；改用最近点后，谁真正更靠前谁后画。
          var zNear = Math.max(c[fd[0][0]][2], c[fd[0][1]][2], c[fd[0][2]][2], c[fd[0][3]][2]);
          // 屏幕装配件：下限 = 头正面最近点 z，保证永远画在头前脸之后（凸出装配件物理上就在它前面）
          // front 值就是这个下限台阶：边框薄板 1、玻璃实体 0.6 —— 台阶差保留了「边框压在玻璃之前」
          // 的真实前后关系（否则两者被钳到同一个 z，稳定排序会让后插入的玻璃前脸盖掉整圈边框）。
          if (box.front) zNear = Math.max(zNear, headFrontZ + box.front);
          faces.push({ pts: pts, col: shadeHex(box.col, lum), z: zNear, edge: box.edge,
            part: box.noPick ? null : node.part, proxy: !!box.proxy, pick: box.pick || 0 });
        });
      });
      (node.children || []).forEach(collect);
    })(sk.root);

    // 屏幕（头正面玻璃 + 表情），深度略提前保证画在头正面之后
    var hm = sk.head._m;
    var sy0 = -g.headH / 2 + g.screenTopOff;
    var gz = g.headD / 2 + g.bezelProtrude - 4;   // 玻璃比边框前沿内凹 4
    var sq = [
      applyM(hm, [-g.screenW / 2, sy0, gz]),
      applyM(hm, [g.screenW / 2, sy0, gz]),
      applyM(hm, [g.screenW / 2, sy0 + g.screenH, gz]),
      applyM(hm, [-g.screenW / 2, sy0 + g.screenH, gz])
    ];
    // 屏幕面可见性（v1.6.1）：由「3D 法线 × 视线点积」改为「屏幕空间投影的有向面积」。
    // 点积把「头不在相机光轴上（y≈-233）+ 相机 3.15° 俯角」一并算了进去，法线还剩一点朝相机
    // 也会被判成背面（实测 headPitch=25° + 总转角 90° 时 z 分量已为 -0.046 仍被剔除），
    // 于是屏幕整块消失、露出机身色。有向面积为正 = 正面朝向（屏幕坐标 y 向下）；
    // 留 2px² 死区，转角过程为连续收窄，不会从 11% 直接跳 0。
    var sp = sq.map(projectV), area2 = 0;
    for (var fi = 0; fi < 4; fi++) {
      var pa = sp[fi], pb = sp[(fi + 1) % 4];
      area2 += pa[0] * pb[1] - pb[0] * pa[1];
    }
    if (area2 > 2) {
      // 屏幕排序锚定：取屏幕四角与头正面（headFrontZ）的最大 z，再越过凸出的边框前沿，
      // 保证表情面永远压在边框薄板与玻璃实体之上。
      var scrNear = Math.max(sq[0][2], sq[1][2], sq[2][2], sq[3][2]);
      faces.push({ screen: true, part: 'head', pts: sp, z: Math.max(scrNear, headFrontZ) + g.bezelProtrude + 4 });
    }

    // 场景道具（桌子/笔记本/马等，世界坐标系，不随角色转动）
    collectProps(faces, S.pose);

    faces.sort(function (a, b) { return a.z - b.z; }); // 远（z 小）先画
    if (ctx === stageCtx) PART_FACE_CACHE = faces;
    faces.forEach(function (f) {
      if (f.proxy) return;                 // 颈部等连接节点只提供点选代理，不改变默认实体外观
      if (f.screen) {
        applyFace(ctx, f.pts, { face: faceArg || S.face, cover: true, coverColor: '#161b18', glowScale: NOGLOW ? 0 : deviceScale, persp: true });
        ctx.save();
        ctx.beginPath();
        f.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.beginPath();
      f.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fillStyle = f.col;
      ctx.fill();
      // v1.7.1：先按面色外扩半像素描边，填平相邻面在斜视角拼合处的亚像素缝
      // （侧视 / 抬手时出现的细黑线），再叠深色描边保留块与块的转折
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // edge:'self' = 用面色描边（盖住拼块接缝的毛边，同时不画出内部接缝线）；
      // 缺省 = 深色描边，勾勒块与块的转折
      ctx.strokeStyle = f.edge === 'self' ? f.col : 'rgba(0,0,0,.16)';
      ctx.lineWidth = f.edge === 'self' ? 2.2 : 1.6;
      ctx.stroke();
    });

    // 打招呼特效：骨骼驱动——单臂高举时出现波动线（MC 式单段臂，侧摆 > 120° 才算举手）
    if (rig.lArmSide > 120 && rig.rArmSide < 60) {
      var handP = projectV(applyM(sk.handL._m, [0, 2, 0]));
      ctx.strokeStyle = 'rgba(159,247,228,.9)';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      // v1.7.1：弧线整体外移 12，避免与手臂 / 头部围出一小块封闭空白（上举时被读成「缝隙」）
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(handP[0] - 62 - i * 17, handP[1] - 18 - i * 7, 14 + i * 5, Math.PI * .75, Math.PI * 1.45);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function mIdent0() { return { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }; }

  /* ---------------- 背景 ---------------- */
  var BGS = [
    { id: 'none', label: '透明' },
    { id: 'studio', label: '影棚' },
    { id: 'white', label: '纯白' },
    { id: 'cream', label: '奶油' },
    { id: 'mint', label: '薄荷' },
    { id: 'dark', label: '墨黑' },
    { id: 'cyanDeep', label: '深青' },
    { id: 'sunset', label: '橙霞' },
    { id: 'violet', label: '暮紫' },
    { id: 'grid', label: '科技网格' },
    { id: 'rays', label: '放射线' },
    { id: 'dots', label: '波点' },
    { id: 'night', label: '星空' }
  ];

  /* ---------------- 贴纸（可自由摆放的图层） ---------------- */
  // 定义字段：u = 1024 基准下每格像素、r = 半径（格）、col = 辉光色、draw(p, k) 以原点为心绘制
  var STICKERS = [
    { id: 'sweat', label: '汗滴', col: C.blue, u: 26, r: 3.2, draw: function (p, k) { p.drop(0, 0, k); } },
    { id: 'anger', label: '怒气', col: C.red, u: 16, r: 5.2, draw: function (p, k) { p.anger(-2.25 * k, 0, k); } },
    { id: 'zzz', label: 'Zzz', col: C.cyan, u: 30, r: 3.1, draw: function (p, k) { p.zzz(0, 0, k); } },
    { id: 'sparkle', label: '星光', col: C.gold, u: 30, r: 2.9, draw: function (p, k) {
        [[0, 0, 1.5], [1.15, -1.35, .95], [-1.25, -1.7, .62]].forEach(function (q) {
          var x = q[0] * k, y = q[1] * k, r = q[2] * k;
          p.px(x - r, y - r * .18, r * 2, r * .36);
          p.px(x - r * .18, y - r, r * .36, r * 2);
        });
      } },
    { id: 'hearts', label: '爱心', col: C.pink, u: 10, r: 10.5, draw: function (p, k) {
        p.heart(-7 * k, 2 * k, k); p.heart(3 * k, -2 * k, .8 * k); p.heart(9 * k, 3 * k, .6 * k);
      } },
    { id: 'notes', label: '音符', col: C.cyan, u: 24, r: 3.8, draw: function (p, k) {
        drawPat(p, ['####..#', '####..#', '####..#', '...#..#', '.###.##'], 0, 0, k);
      } },
    { id: 'bulb', label: '灯泡', col: C.gold, u: 26, r: 3.1, draw: function (p, k) {
        drawPat(p, ['.###.', '#...#', '#...#', '.###.', '..#..', '.###.'], 0, 0, k);
      } },
    { id: 'qmark', label: '问号', col: C.gold, u: 26, r: 3.1, draw: function (p, k) { p.qmark(0, 0, k); } }
  ];
  // 旧版固定位 → 实例化后的默认落点（1024 基准坐标）；一键套系沿用这些落点
  var STICKER_HOME = { sweat: [830, 210], anger: [820, 190], zzz: [830, 170], sparkle: [180, 200], hearts: [190, 210], notes: [830, 200], bulb: [830, 190], qmark: [840, 200] };
  var ST_IMG_BASE = 240;        // 图片贴纸在 1024 基准下的最长边
  var ST_IMG_MAX = 512;         // 上传图片归一化后的最长边
  var ST_MAX = 12;              // 画布贴纸上限
  var ST_KEY = 'traeEmoji.stickers.v1';

  function findSticker(id) { return STICKERS.find(function (s) { return s.id === id; }); }

  /* ---------------- 文案预设与套系 ---------------- */
  var TEXT_PRESETS = ['爱你哟', '收到', '加油鸭', '让我想想', '我看好你哟', '不愧是你',
    '令人挠头', '摸鱼中', '在写了别催', '已读乱回', '救命', '绝了', '开摆', '碎啦'];

  var PRESETS = [
    { id: 'p1', label: '爱你哟', pose: 'plove', face: 'love', bg: 'none', text: { content: '爱你哟', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 }, stickers: { hearts: true } },
    { id: 'p2', label: '收到', pose: 'pstand', face: 'cool', bg: 'none', text: { content: '收到', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1.1 }, stickers: {} },
    { id: 'p3', label: '加油鸭', pose: 'pcheer', face: 'happy', bg: 'none', text: { content: '加油鸭', pos: 'bottom', style: 'meme', color: '#ffd75e', size: 1 }, stickers: { sparkle: true } },
    { id: 'p4', label: '让我想想', pose: 'plaptop', face: 'doubt', bg: 'none', text: { content: '让我想想', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 }, stickers: {} },
    { id: 'p5', label: '我看好你哟', pose: 'pwave', face: 'star', bg: 'none', text: { content: '我看好你哟', pos: 'bottom', style: 'meme', color: '#ffffff', size: .95 }, stickers: { sparkle: true } },
    { id: 'p6', label: '不愧是你', pose: 'pjump', face: 'laugh', bg: 'none', text: { content: '不愧是你', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 }, stickers: {} },
    { id: 'p7', label: '摸鱼中', pose: 'plaptop', face: 'speechless', bg: 'none', text: { content: '摸鱼中', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 }, stickers: {} },
    { id: 'p8', label: '崩溃中', pose: 'pstand', face: 'rage', bg: 'none', text: { content: '崩溃中', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1.05 }, stickers: { anger: true } }
  ];

  /* ---------------- 角色配色（v1.5.0 皮肤换色） ---------------- */
  var SKIN_KEY = 'traeEmoji.skin.v1';
  var SKIN_PARTS = [
    { key: 'head', label: '头部' },
    { key: 'torso', label: '躯干' },
    { key: 'arm', label: '手臂' },
    { key: 'leg', label: '腿部' },
    { key: 'bezel', label: '屏幕边框' }
  ];
  // 官方外壳配色：以头色为基准，其余部位保持官方明度关系（躯干 .82 / 手臂 .80 / 腿 .86 / 边框 .92）
  var SKIN_OFFICIAL = { head: '#373834', torso: '#2d2e2b', arm: '#2c2d2a', leg: '#2f302d', bezel: '#33342f' };
  var SKIN_RATIO = { head: 1, torso: .82, arm: .80, leg: .86, bezel: .92 };
  var SKIN_PRESETS = [
    { id: 'official', label: '官方炭灰', base: '#373834' },
    { id: 'snow', label: '纯白', base: '#f1f1ec' },
    { id: 'cream', label: '米白', base: '#e9dfcd' },
    { id: 'mint', label: '薄荷', base: '#a9e4cc' },
    { id: 'sakura', label: '樱花粉', base: '#f2bdcd' },
    { id: 'sky', label: '天青蓝', base: '#a9c9ef' },
    { id: 'lemon', label: '柠檬黄', base: '#f2da8d' },
    { id: 'violet', label: '暮紫', base: '#b9a9dc' }
  ];

  function hex6(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; }
  function rgbOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgbHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }
  // 基准色 × 系数（<1 变暗 / >1 提亮）：保持色相，用于由「头色」派生全身配色
  function skinMix(hex, f) {
    var c = rgbOf(hex);
    return rgbHex(c[0] * f, c[1] * f, c[2] * f);
  }
  function skinFromBase(base) {
    base = hex6(base) || SKIN_OFFICIAL.head;
    var o = {};
    SKIN_PARTS.forEach(function (p) { o[p.key] = skinMix(base, SKIN_RATIO[p.key]); });
    return o;
  }
  function skinClone(s) {
    var o = {};
    SKIN_PARTS.forEach(function (p) { o[p.key] = hex6(s && s[p.key]) || SKIN_OFFICIAL[p.key]; });
    return o;
  }
  function skinEq(a, b) {
    return SKIN_PARTS.every(function (p) { return a[p.key] === b[p.key]; });
  }
  function loadSkin() {
    try { S.skin = skinClone(JSON.parse(localStorage.getItem(SKIN_KEY) || 'null')); }
    catch (e) { S.skin = skinClone(SKIN_OFFICIAL); }
  }
  function saveSkin() {
    try { localStorage.setItem(SKIN_KEY, JSON.stringify(S.skin)); } catch (e) { }
  }

  /* ---------------- 状态 ---------------- */
  var S = {
    pose: 'pstand', face: 'normal', bg: 'none', rig: null,
    parts: createPartStates(), selPart: null,          // v1.7.0：各部位局部尺寸 / 角度 / 位移与选中态
    body: bodyClone(),                                  // v1.8.0：全身体型比例（十项，1 = 官方标准）
    text: { content: '', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 },
    stickerItems: [], selSticker: null,          // 贴纸实例（数组顺序 = 层级顺序，由底到顶）
    bgFit: 'cover', bgOffX: 0, bgOffY: 0,   // 自定义背景：显示方式与位置微调（% of 画布）
    anim: null,                                   // 循环动画（v1.4.0）：见 ANIM_REST
    skin: skinFromBase(SKIN_OFFICIAL.head)        // 外壳配色（v1.5.0）：头 / 躯干 / 手臂 / 腿 / 屏幕边框
  };

  /* ---------------- 循环动画（v1.4.0） ---------------- */
  var ANIM_KEY = 'traeEmoji.anim.v1';
  var ANIM_OFF_KEY = 'traeEmoji.animAutoOff.v1';   // v1.9.0：一次性迁移标记（旧存档不再自动播放）
  // v1.9.0：默认不自动播放，进页面先看到静态姿势；点「▶ 播放预览」才开始
  var ANIM_REST = { playing: false, breath: 6, sway: 3, walk: 10, switchOn: false, face2: 'wink', period: 1.6 };
  function animClone(a) {
    var o = {}, k;   // 以默认值为底，避免旧存档缺字段
    for (k in ANIM_REST) o[k] = (a && a[k] !== undefined) ? a[k] : ANIM_REST[k];
    return o;
  }
  S.anim = animClone();
  function animActive() {   // 是否有可播放的动画内容且处于播放状态
    var a = S.anim;
    return !!(a.playing && (a.breath > 0 || a.sway > 0 || a.walk > 0 || a.switchOn));
  }
  // t ∈ [0,1) 为循环相位：在用户骨骼基础上叠加动画偏移（不污染 S.rig）
  function effectiveRig(t) {
    var rig = rigClone(S.rig || REST_RIG);
    if (t == null) return rig;
    var a = S.anim, s = Math.sin(t * Math.PI * 2);
    if (a.breath > 0) rig.bounce = (rig.bounce || 0) + a.breath * s;      // 呼吸：身体上下起伏
    if (a.sway > 0) rig.bodyYaw = (rig.bodyYaw || 0) + a.sway * s;        // 摇摆：绕身体中轴左右转，中心点不动
    if (a.walk > 0) {                                                      // 走路式四肢交叉摆动（左臂↔右腿、右臂↔左腿）
      rig.lArmFront = (rig.lArmFront || 0) + a.walk * s;
      rig.rArmFront = (rig.rArmFront || 0) - a.walk * s;
      rig.lLegFront = (rig.lLegFront || 0) - a.walk * .8 * s;
      rig.rLegFront = (rig.rLegFront || 0) + a.walk * .8 * s;
    }
    return rig;
  }
  // 表情切换：周期末 10% 短促闪现第二表情（默认眨眼，约 160ms），其余时间为主表情
  function effectiveFace(t) {
    if (t == null || !S.anim.switchOn) return S.face;
    return t >= 0.9 ? S.anim.face2 : S.face;
  }
  function loadAnim() {
    var needOff = true;   // 旧存档（v1.8.0 及以前）默认 playing:true，需一次性强制暂停
    try {
      var raw = localStorage.getItem(ANIM_KEY);
      if (raw) S.anim = animClone(JSON.parse(raw));
      needOff = !localStorage.getItem(ANIM_OFF_KEY);
    } catch (e) { /* 存储不可用：默认值本身就是暂停 */ }
    if (needOff) {
      S.anim.playing = false;
      try { localStorage.setItem(ANIM_OFF_KEY, '1'); } catch (e) { }
      saveAnim();
    }
  }
  function saveAnim() {
    try { localStorage.setItem(ANIM_KEY, JSON.stringify(S.anim)); } catch (e) { }
  }

  /* ---------------- 关键帧动画（v1.11.0） ---------------- */
  // 时间轴 = 一组按时刻排序的关键帧，每帧是骨骼角度的全量快照；
  // 相邻帧之间 smoothstep 插值，循环时长 = 末帧时刻 - 首帧时刻。
  // 播放 / 播放头停留均不写入 S.rig（所见即所得，退出查看即回到当前骨骼）。
  var KF_KEY = 'traeEmoji.kf.v1';
  var KF_SAVED_KEY = 'traeEmoji.kfSaved.v1';   // 「我的动作」库
  var KF_SAVED_MAX = 12;
  var KF = { frames: [], playing: false, viewT: null };   // viewT=null 表示不在时间轴查看模式

  function kfClone(f) { return { t: +f.t, rig: rigClone(f.rig) }; }
  function kfSanitize(fs) {   // 导入 / 读取时收敛：0~30s、必须有 rig、按时刻排序
    var out = [];
    (fs || []).forEach(function (f) {
      if (!f || typeof f.t !== 'number' || f.t < 0 || f.t > 30 || !f.rig) return;
      out.push(kfClone(f));
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function kfSave() { try { localStorage.setItem(KF_KEY, JSON.stringify(KF.frames)); } catch (e) { } }
  function kfLoad() {
    try {
      var raw = localStorage.getItem(KF_KEY);
      if (raw) KF.frames = kfSanitize(JSON.parse(raw));
    } catch (e) { KF.frames = []; }
  }
  function kfActive() { return KF.frames.length >= 2; }             // 可播放：至少 2 帧
  function kfDur() {
    return KF.frames.length >= 2 ? Math.max(0.1, KF.frames[KF.frames.length - 1].t - KF.frames[0].t) : 0;
  }
  function kfEase(u) { return u * u * (3 - 2 * u); }                // smoothstep：帧间平滑加减速

  // tt 秒 → 插值骨骼（首帧前保持首帧，末帧后保持末帧）
  function kfRigAt(tt) {
    var fs = KF.frames;
    if (!fs.length) return rigClone(S.rig || REST_RIG);
    if (tt <= fs[0].t) return rigClone(fs[0].rig);
    var last = fs[fs.length - 1];
    if (tt >= last.t) return rigClone(last.rig);
    for (var i = 0; i < fs.length - 1; i++) {
      var a = fs[i], b = fs[i + 1];
      if (tt >= a.t && tt <= b.t) {
        var u = (b.t - a.t) < 1e-6 ? 1 : (tt - a.t) / (b.t - a.t);
        var e = kfEase(u), rig = rigClone(a.rig);
        for (var k in rig) rig[k] = a.rig[k] + (b.rig[k] - a.rig[k]) * e;
        return rig;
      }
    }
    return rigClone(last.rig);
  }

  // 按时间轴时刻渲染整幅画面（预览与 GIF / APNG 导出共用；ui=true 只用于预览层）
  function renderKfView(ctx, s, ui, tt) {
    ctx.clearRect(0, 0, s, s);
    renderBg(ctx, S.bg, s);
    renderProcedural(ctx, s, undefined, kfRigAt(tt));
    renderStickers(ctx, s, ui);
    renderText(ctx, s);
    if (ui) {
      drawPartOverlay(ctx, s);
      drawIkOverlay(ctx, s);
    }
  }

  // 退出时间轴查看（播放 / 播放头停留），预览回到当前骨骼静态——骨骼编辑入口统一调用
  function kfExitView() {
    var was = KF.playing || KF.viewT != null;
    KF.playing = false; KF.viewT = null;
    stopKfLoop();
    if (was) { syncKfUI(); repaint(); }
  }
  // 播放关键帧时暂停循环动画；反之亦然（两套动画互斥，避免叠加失控）
  function kfPauseLoopAnim() {
    if (S.anim.playing) { S.anim.playing = false; saveAnim(); syncAnimUI(); }
  }

  /* ---- 动作预设：每帧只写增量字段，载入时补全站立基准 ---- */
  var KF_PRESETS = [
    { id: 'wave', label: '招手', frames: [
      { t: 0, rig: { lArmSide: 118, lArmFront: 16, headYaw: -6 } },
      { t: 0.4, rig: { lArmSide: 118, lArmFront: -20, headYaw: -6 } },
      { t: 0.8, rig: { lArmSide: 118, lArmFront: 46, headYaw: -6 } },
      { t: 1.2, rig: { lArmSide: 118, lArmFront: -20, headYaw: -6 } },
      { t: 1.6, rig: { lArmSide: 118, lArmFront: 16, headYaw: -6 } }
    ] },
    { id: 'nod', label: '点头', frames: [
      { t: 0, rig: { } },
      { t: 0.35, rig: { headPitch: -13 } },
      { t: 0.7, rig: { } },
      { t: 1.0, rig: { headPitch: -10 } },
      { t: 1.3, rig: { } }
    ] },
    { id: 'shake', label: '摇头', frames: [
      { t: 0, rig: { } },
      { t: 0.4, rig: { headYaw: -17 } },
      { t: 0.8, rig: { headYaw: 17 } },
      { t: 1.2, rig: { headYaw: -12 } },
      { t: 1.5, rig: { } }
    ] },
    { id: 'hop', label: '开心跳', frames: [
      { t: 0, rig: { lArmSide: 34, rArmSide: 34 } },
      { t: 0.35, rig: { lArmSide: 62, rArmSide: 62, lArmFront: -14, rArmFront: -14, bounce: -34 } },
      { t: 0.7, rig: { lArmSide: 34, rArmSide: 34 } },
      { t: 1.05, rig: { lArmSide: 62, rArmSide: 62, lArmFront: -14, rArmFront: -14, bounce: -34 } },
      { t: 1.4, rig: { lArmSide: 34, rArmSide: 34 } }
    ] },
    { id: 'glance', label: '左右看', frames: [
      { t: 0, rig: { } },
      { t: 0.5, rig: { headYaw: -19, bodyYaw: -6 } },
      { t: 1.0, rig: { } },
      { t: 1.5, rig: { headYaw: 19, bodyYaw: 6 } },
      { t: 2.0, rig: { } }
    ] },
    { id: 'dance', label: '扭腰摇摆', frames: [
      { t: 0, rig: { lArmSide: 30, rArmSide: 30 } },
      { t: 0.6, rig: { lArmSide: 30, rArmSide: 30, bodyYaw: 9, bodyRoll: -4, lArmFront: 22, rArmFront: -22, bounce: -6 } },
      { t: 1.2, rig: { lArmSide: 30, rArmSide: 30 } },
      { t: 1.8, rig: { lArmSide: 30, rArmSide: 30, bodyYaw: -9, bodyRoll: 4, lArmFront: -22, rArmFront: 22, bounce: -6 } },
      { t: 2.4, rig: { lArmSide: 30, rArmSide: 30 } }
    ] },
    { id: 'cheer', label: '举手欢呼', frames: [
      { t: 0, rig: { lArmSide: 116, rArmSide: 116, lArmFront: 8, rArmFront: 8 } },
      { t: 0.5, rig: { lArmSide: 130, rArmSide: 130, lArmFront: -10, rArmFront: -10, bounce: -20 } },
      { t: 1.0, rig: { lArmSide: 116, rArmSide: 116, lArmFront: 8, rArmFront: 8 } },
      { t: 1.5, rig: { lArmSide: 130, rArmSide: 130, lArmFront: -10, rArmFront: -10, bounce: -20 } },
      { t: 2.0, rig: { lArmSide: 116, rArmSide: 116, lArmFront: 8, rArmFront: 8 } }
    ] }
  ];
  /* ---- 时间轴编辑操作 ---- */
  function kfSortSave() {
    KF.frames.sort(function (a, b) { return a.t - b.t; });
    kfSave();
  }
  // 在播放头时刻（无查看态则接在末尾）用当前骨骼打一帧；同位置（<0.05s）覆盖旧帧
  function kfAddFrame() {
    var t = KF.viewT != null ? KF.viewT
      : (KF.frames.length ? Math.round((KF.frames[KF.frames.length - 1].t + 0.4) * 100) / 100 : 0);
    var near = -1;
    for (var i = 0; i < KF.frames.length; i++) if (Math.abs(KF.frames[i].t - t) < 0.05) { near = i; break; }
    var f = { t: Math.round(t * 100) / 100, rig: rigClone(S.rig || REST_RIG) };
    if (near >= 0) KF.frames[near] = f; else KF.frames.push(f);
    kfSortSave(); syncKfUI();
    toast(near >= 0 ? '已覆盖 ' + f.t.toFixed(2) + 's 处的关键帧' : '已打关键帧 @ ' + f.t.toFixed(2) + 's');
  }
  // 载入动作（预设 / 库 / 导入）：全新时间轴；预设姿态是绝对的，统一切回站立姿势
  function kfLoadFrames(fs, label) {
    KF.frames = kfSanitize(fs);
    setPose('pstand');
    KF.playing = false; KF.viewT = KF.frames.length ? KF.frames[0].t : null;
    kfSave(); syncKfUI(); repaint();
    toast('已载入「' + label + '」' + (kfActive() ? '，点 ▶ 播放预览' : ''));
  }
  // 多段串联：把动作关键帧整体平移接在时间轴末尾（留 0.4s 过渡缓冲，衔接处姿势平滑收拢），追加后直接播放预览
  function kfAppendFrames(fs, label) {
    if (!fs || !fs.length) return;
    var base = KF.frames.length ? Math.round((KF.frames[KF.frames.length - 1].t + 0.4) * 100) / 100 : 0;
    var shifted = fs.map(function (f) {
      return { t: Math.round((f.t + base) * 100) / 100, rig: rigClone(f.rig) };
    });
    if (!KF.frames.length) KF.frames = shifted;
    else KF.frames = KF.frames.concat(shifted);
    KF.viewT = null;
    kfSortSave();
    KF.playing = kfActive();   // 串联即预览
    syncKfUI(); repaint();
    toast('已串联「' + label + '」，共 ' + KF.frames.length + ' 帧 · ' + kfDur().toFixed(1) + 's');
  }

  /* ---- 我的动作库（命名保存 / 载入 / 删除，随本机持久化） ---- */
  var kfSaved = [];
  function loadKfSaved() {
    kfSaved = [];
    try {
      var raw = localStorage.getItem(KF_SAVED_KEY);
      if (raw) JSON.parse(raw).forEach(function (rec) {
        if (rec && rec.name && rec.frames && rec.frames.length) {
          kfSaved.push({ name: String(rec.name).trim().slice(0, 12), frames: kfSanitize(rec.frames) });
        }
      });
    } catch (e) { }
  }
  function persistKfSaved() {
    try { localStorage.setItem(KF_SAVED_KEY, JSON.stringify(kfSaved.slice(0, KF_SAVED_MAX))); } catch (e) { }
  }
  function saveKfNamed(name, frames) {
    name = name.trim().slice(0, 12);
    if (!name) { toast('请先给动作起个名字'); return; }
    if (!frames.length) { toast('时间轴上还没有关键帧'); return; }
    for (var i = 0; i < kfSaved.length; i++) {
      if (kfSaved[i].name === name) {
        kfSaved[i].frames = kfSanitize(frames);
        persistKfSaved(); rebuildKfSavedUI(); rebuildKfAppendSel();
        toast('已更新动作「' + name + '」'); return;
      }
    }
    kfSaved.unshift({ name: name, frames: kfSanitize(frames) });
    if (kfSaved.length > KF_SAVED_MAX) kfSaved.length = KF_SAVED_MAX;
    persistKfSaved(); rebuildKfSavedUI(); rebuildKfAppendSel();
    toast('已保存动作「' + name + '」');
  }


  /* ---------------- 资源加载 ---------------- */
  var faceCache = {};     // 表情位图缓存

  function getFaceCanvas(faceId) {
    if (faceCache[faceId]) return faceCache[faceId];
    var def = FACES.find(function (f) { return f.id === faceId; }) || FACES[0];
    var cv = document.createElement('canvas');
    cv.width = FW; cv.height = FH;
    var f = cv.getContext('2d');
    def.draw(makePen(f));
    var k = faceBright(def);
    if (k !== 1) brightenCanvas(cv, k);   // v1.9.0：眼睛亮度烘焙进缓存位图
    faceCache[faceId] = { cv: cv, def: def };
    return faceCache[faceId];
  }

  /* ---------------- 几何工具 ---------------- */
  function rotPt(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }

  function boxPath(ctx, cx, cy, w, h, ang) {
    var pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
      .map(function (p) { var r = rotPt(p[0], p[1], ang); return [cx + r[0], cy + r[1]]; });
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    return pts;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 透视纹理映射（双三角形仿射） ---------------- */
  // flipDiag: 换对角线拆分方向（用于辉光叠加消接缝）；shadowColor/shadowBlur: 传辉光参数
  function mapTex(ctx, img, P, shadowColor, shadowBlur, flipDiag) {
    var W = img.width, H = img.height;
    function tri(p0, p1, p2, u0, u1, u2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      ctx.closePath(); ctx.clip();
      var dux = u1[0] - u0[0], duy = u1[1] - u0[1], dvx = u2[0] - u0[0], dvy = u2[1] - u0[1];
      var det = dux * dvy - duy * dvx;
      if (!det) { ctx.restore(); return; }
      var d1x = p1[0] - p0[0], d1y = p1[1] - p0[1], d2x = p2[0] - p0[0], d2y = p2[1] - p0[1];
      var a = (d1x * dvy - d2x * duy) / det;
      var b = (d1y * dvy - d2y * duy) / det;
      var c = (d2x * dux - d1x * dvx) / det;
      var d = (d2y * dux - d1y * dvx) / det;
      var e = p0[0] - a * u0[0] - c * u0[1];
      var f = p0[1] - b * u0[0] - d * u0[1];
      ctx.transform(a, b, c, d, e, f);
      if (shadowColor) { ctx.shadowColor = shadowColor; ctx.shadowBlur = shadowBlur; }
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    if (flipDiag) {
      tri(P[1], P[2], P[3], [W, 0], [W, H], [0, H]);
      tri(P[1], P[3], P[0], [W, 0], [0, H], [0, 0]);
    } else {
      tri(P[0], P[1], P[2], [0, 0], [W, 0], [W, H]);
      tri(P[0], P[2], P[3], [0, 0], [W, H], [0, H]);
    }
  }

  /* ---------------- 屏幕应用（填充 + 晕影 + 像素脸） ---------------- */
  // quad: [[x,y]×4] TL,TR,BR,BL（画布坐标）；cover+coverColor: 覆盖原有脸并加晕影
  // glowScale: 辉光模糊的设备像素比例（阴影不受 CTM 影响，需手动缩放）
  // persp: 四边形来自 3D 投影，用双三角映射保证透视正确
  function applyFace(ctx, quad, opts) {
    var TL = quad[0], TR = quad[1], BR = quad[2], BL = quad[3];
    var cx = (TL[0] + TR[0] + BR[0] + BL[0]) / 4, cy = (TL[1] + TR[1] + BR[1] + BL[1]) / 4;
    var face = getFaceCanvas(opts.face);
    var glowScale = (opts.glowScale != null) ? opts.glowScale : 1;

    if (opts.cover && opts.coverColor) {
      var inset = quad.map(function (p) { return [cx + (p[0] - cx) * .992, cy + (p[1] - cy) * .992]; });
      ctx.save();
      ctx.beginPath();
      inset.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fillStyle = opts.coverColor;
      ctx.fill();
      // 晕影：玻璃内暗角
      var r = Math.max(Math.hypot(TR[0] - TL[0], TR[1] - TL[1]), Math.hypot(BL[0] - TL[0], BL[1] - TL[1]));
      var g = ctx.createRadialGradient(cx, cy, r * .45, cx, cy, r * .78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.42)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    var ux = (TR[0] - TL[0]) / FW, uy = (TR[1] - TL[1]) / FW;
    var vx = (BL[0] - TL[0]) / FH, vy = (BL[1] - TL[1]) / FH;
    if (opts.persp) {
      // 3D 投影四边形：辉光两次三角映射（双对角线消除接缝），像素一次精确映射
      if (glowScale > 0) {
        mapTex(ctx, face.cv, quad, faceGlow(face.def), 26 * glowScale, false);
        mapTex(ctx, face.cv, quad, faceGlow(face.def), 26 * glowScale, true);
      }
      ctx.imageSmoothingEnabled = false;
      mapTex(ctx, face.cv, quad, null, 0, false);
      return;
    }
    ctx.save();
    ctx.translate(TL[0], TL[1]);
    ctx.transform(ux, uy, vx, vy, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (glowScale > 0) {
      ctx.shadowColor = faceGlow(face.def);
      ctx.shadowBlur = 26 * glowScale;
      ctx.drawImage(face.cv, 0, 0);
      ctx.shadowBlur = 10 * glowScale;
      ctx.drawImage(face.cv, 0, 0);
      ctx.shadowBlur = 0;
    }
    ctx.drawImage(face.cv, 0, 0);
    ctx.restore();
  }

  /* ---------------- 自定义背景（本地上传图片） ---------------- */
  // 存储结构：{ name, data: dataURL, fit, offX, offY }；图片归一化到最长边 1024（对齐最高导出档）
  var BG_KEY = 'traeEmoji.customBg.v1';
  var BG_MAX = 1024, BG_OFF_MAX = 30;
  var bgImg = null;        // 当前背景图（归一化后的 canvas / Image）
  var bgData = null;       // 归一化图的 dataURL（持久化用）
  var bgName = '';
  var bgCustomTile = null;
  var bgEl = {};

  function clampOff(v) { v = Math.round(+v || 0); return Math.max(-BG_OFF_MAX, Math.min(BG_OFF_MAX, v)); }

  function drawCustomBg(ctx, s) {
    if (!bgImg) return;                        // 还没选图：保持透明
    var w = bgImg.naturalWidth || bgImg.width, h = bgImg.naturalHeight || bgImg.height;
    if (!w || !h) return;
    var k = s / BASE;
    var mode = S.bgFit || 'cover';
    var ox = S.bgOffX * s / 100, oy = S.bgOffY * s / 100;
    ctx.save();
    if (mode === 'tile') {
      // 平铺：原图尺寸重复；偏移与缩放都跟随画布比例，各导出尺寸构图一致
      var pat = ctx.createPattern(bgImg, 'repeat');
      if (!pat) { ctx.restore(); return; }
      ctx.scale(k, k);
      ctx.translate(ox / k, oy / k);
      ctx.fillStyle = pat;
      ctx.fillRect(-ox / k, -oy / k, s / k, s / k);
      ctx.restore();
      return;
    }
    var sc = (mode === 'contain' ? Math.min : Math.max)(s / w, s / h);
    var dw = w * sc, dh = h * sc;
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bgImg, (s - dw) / 2 + ox, (s - dh) / 2 + oy, dw, dh);
    ctx.restore();
  }

  function hasAlphaPixels(c, w, h) {
    var d = c.getImageData(0, 0, w, h).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    return false;
  }

  function applyBgFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('请选择图片文件（JPG / PNG / WebP）'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var raw = new Image();
      raw.onload = function () {
        var sc = Math.min(1, BG_MAX / Math.max(raw.naturalWidth, raw.naturalHeight));
        var cw = Math.max(1, Math.round(raw.naturalWidth * sc));
        var ch = Math.max(1, Math.round(raw.naturalHeight * sc));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var c = cv.getContext('2d');
        c.drawImage(raw, 0, 0, cw, ch);
        bgImg = cv;
        bgName = file.name;
        S.bgFit = 'cover'; S.bgOffX = 0; S.bgOffY = 0;
        var data = null;
        try {
          // 带透明像素的图存 PNG，普通照片存 JPEG（体积小，避免撑爆 localStorage）
          data = cv.toDataURL(hasAlphaPixels(c, cw, ch) ? 'image/png' : 'image/jpeg', .9);
        } catch (e) { data = null; }
        setBg('custom');
        syncBgUI();
        refreshCustomBgTile();
        var ok = data ? saveBg(data) : false;
        toast(ok ? '已应用背景「' + bgName + '」' : '已应用背景「' + bgName + '」（本机存储不可用，刷新后需重新选择）');
      };
      raw.onerror = function () { toast('这张图片打不开，换一张试试'); };
      raw.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function saveBg(dataArg) {
    if (dataArg) bgData = dataArg;
    if (!bgData) return false;
    try {
      localStorage.setItem(BG_KEY, JSON.stringify({
        name: bgName, data: bgData, fit: S.bgFit, offX: S.bgOffX, offY: S.bgOffY
      }));
      return true;
    } catch (e) { return false; }
  }

  function loadCustomBg() {
    var rec;
    try { rec = JSON.parse(localStorage.getItem(BG_KEY) || 'null'); } catch (e) { rec = null; }
    if (!rec || typeof rec.data !== 'string') return;
    var img = new Image();
    img.onload = function () {
      bgImg = img;
      bgData = rec.data;
      bgName = rec.name || '';
      S.bgFit = (rec.fit === 'contain' || rec.fit === 'tile') ? rec.fit : 'cover';
      S.bgOffX = clampOff(rec.offX);
      S.bgOffY = clampOff(rec.offY);
      syncBgUI();
      refreshCustomBgTile();
    };
    img.onerror = function () {
      try { localStorage.removeItem(BG_KEY); } catch (e) {}
    };
    img.src = rec.data;
  }

  function openBgPicker() {
    if (!bgEl.file) return;
    bgEl.file.value = '';   // 允许重复选同一张图
    bgEl.file.click();
  }

  function clearCustomBg() {
    if (!bgImg) return;
    if (!window.confirm('移除自定义背景「' + (bgName || '自定义图片') + '」？图片只存在本机浏览器，移除后需重新选择。')) return;
    bgImg = null; bgData = null; bgName = '';
    try { localStorage.removeItem(BG_KEY); } catch (e) {}
    if (S.bg === 'custom') setBg('none');
    syncBgUI(); refreshCustomBgTile(); repaint();
    toast('已移除自定义背景');
  }

  function buildCustomBgThumb() {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    if (!bgImg) {                        // 未选图：显示加号入口
      c.save();
      c.strokeStyle = C.cyan; c.lineWidth = 6; c.lineCap = 'round';
      c.shadowColor = C.cyan; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(60, 38); c.lineTo(60, 82); c.moveTo(38, 60); c.lineTo(82, 60); c.stroke();
      c.restore();
      return cv;
    }
    var w = bgImg.naturalWidth || bgImg.width, h = bgImg.naturalHeight || bgImg.height;
    var sc = Math.max(120 / w, 120 / h);
    c.imageSmoothingEnabled = true;
    c.drawImage(bgImg, (120 - w * sc) / 2, (120 - h * sc) / 2, w * sc, h * sc);
    return cv;
  }

  function refreshCustomBgTile() {
    if (!bgCustomTile) return;
    var old = bgCustomTile.querySelector('canvas');
    var cv = buildCustomBgThumb();
    if (old) bgCustomTile.replaceChild(cv, old);
    else bgCustomTile.insertBefore(cv, bgCustomTile.firstChild);
  }

  function syncBgUI() {
    if (!bgEl.name) return;
    bgEl.name.textContent = bgImg ? (bgName || '自定义图片') : '未选择图片';
    bgEl.pick.textContent = bgImg ? '🖼 更换图片' : '🖼 选择图片';
    bgEl.clear.classList.toggle('hidden', !bgImg);
    bgEl.adjust.classList.toggle('hidden', !bgImg);
    setActive(bgEl.fit, S.bgFit);
    bgEl.offX.value = S.bgOffX;
    bgEl.offY.value = S.bgOffY;
    bgEl.offXVal.textContent = S.bgOffX + '%';
    bgEl.offYVal.textContent = S.bgOffY + '%';
  }

  function bindBgUI() {
    bgEl.pick = document.getElementById('bgPick');
    bgEl.file = document.getElementById('bgFile');
    bgEl.clear = document.getElementById('bgClear');
    bgEl.name = document.getElementById('bgName');
    bgEl.adjust = document.getElementById('bgAdjust');
    bgEl.fit = document.getElementById('bgFit');
    bgEl.offX = document.getElementById('bgOffX');
    bgEl.offY = document.getElementById('bgOffY');
    bgEl.offXVal = document.getElementById('bgOffXVal');
    bgEl.offYVal = document.getElementById('bgOffYVal');

    bgEl.pick.onclick = openBgPicker;
    bgEl.file.onchange = function () {
      var f = bgEl.file.files && bgEl.file.files[0];
      if (f) applyBgFile(f);
    };
    bgEl.clear.onclick = clearCustomBg;
    [].forEach.call(bgEl.fit.children, function (b) {
      b.onclick = function () {
        S.bgFit = b.dataset.v;
        if (bgImg && S.bg !== 'custom') setBg('custom'); else repaint();
        syncBgUI();
        saveBg();
      };
    });
    [['offX', 'bgOffX'], ['offY', 'bgOffY']].forEach(function (pair) {
      var input = bgEl[pair[0]], out = bgEl[pair[0] + 'Val'];
      input.addEventListener('input', function () {
        S[pair[1]] = clampOff(input.value);
        out.textContent = S[pair[1]] + '%';
        if (bgImg && S.bg !== 'custom') setBg('custom'); else repaint();
      });
      input.addEventListener('change', function () { saveBg(); });
    });
  }

  /* ---------------- 背景渲染 ---------------- */
  function renderBg(ctx, id, s) {
    if (id === 'custom') { drawCustomBg(ctx, s); return; }
    if (id === 'none') return;
    function grad(c1, c2) { var g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }
    switch (id) {
      case 'white': ctx.fillStyle = '#ffffff'; break;
      case 'studio': {
        var wall = ctx.createLinearGradient(0, 0, 0, s * .78);
        wall.addColorStop(0, '#b1aeac'); wall.addColorStop(1, '#a29f9d');
        ctx.fillStyle = wall; ctx.fillRect(0, 0, s, s);
        var floor = ctx.createLinearGradient(0, s * .78, 0, s);
        floor.addColorStop(0, '#9a9795'); floor.addColorStop(1, '#8b8886');
        ctx.fillStyle = floor; ctx.fillRect(0, s * .78, s, s * .22);
        ctx.fillStyle = 'rgba(255,255,255,.30)';
        ctx.fillRect(0, s * .78 - 1, s, 2);
        return;
      }
      case 'cream': ctx.fillStyle = '#fff3dd'; break;
      case 'mint': ctx.fillStyle = '#e4fff4'; break;
      case 'dark': ctx.fillStyle = '#14171a'; break;
      case 'cyanDeep': ctx.fillStyle = grad('#0c2f28', '#123f36'); break;
      case 'sunset': ctx.fillStyle = grad('#ffd9a0', '#ff9a8a'); break;
      case 'violet': ctx.fillStyle = grad('#2a2350', '#5b3f8f'); break;
      case 'grid': ctx.fillStyle = '#0e1417'; break;
      case 'rays': ctx.fillStyle = '#fff6d8'; break;
      case 'dots': ctx.fillStyle = '#fdf6ec'; break;
      case 'night': ctx.fillStyle = grad('#0b1026', '#1d2440'); break;
    }
    ctx.fillRect(0, 0, s, s);
    var i;
    if (id === 'grid') {
      ctx.strokeStyle = 'rgba(87,230,196,.16)'; ctx.lineWidth = s / 512;
      for (i = 0; i <= 16; i++) {
        ctx.beginPath(); ctx.moveTo(i * s / 16, 0); ctx.lineTo(i * s / 16, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * s / 16); ctx.lineTo(s, i * s / 16); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(87,230,196,.08)';
      ctx.beginPath(); ctx.arc(s * .5, s * .55, s * .38, 0, 7); ctx.fill();
    } else if (id === 'rays') {
      ctx.save(); ctx.translate(s / 2, s * .42);
      ctx.fillStyle = '#ffe9a8';
      for (i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s, -s * .12); ctx.lineTo(-s, s * .12); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    } else if (id === 'dots') {
      ctx.fillStyle = 'rgba(87,230,196,.35)';
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        ctx.beginPath(); ctx.arc((x + (y % 2) * .5) * s / 8, (y + .5) * s / 8, s / 44, 0, 7); ctx.fill();
      }
    } else if (id === 'night') {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      var rnd = mulberry(7);
      for (i = 0; i < 60; i++) {
        var rr = rnd() * s / 220 + s / 500;
        ctx.beginPath(); ctx.arc(rnd() * s, rnd() * s, rr, 0, 7); ctx.fill();
      }
    }
  }
  function mulberry(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 贴纸（实例渲染：位置 / 缩放 / 旋转 / 层级） ---------------- */
  // v1.10.0：最近一次 renderProcedural 的骨骼缓存。挂载式贴纸从这里取部位世界矩阵，
  // 动画 / 拖手柄逐帧渲染时自动跟随更新；缩略图只画角色，不会读到过期骨骼。
  var LAST_SK = null;

  // 各部位的贴纸默认锚点（部位节点局部坐标，随 GEO3D 体型联动）：
  // 头顶上方给「帽子位」，躯干取前面板给「徽章位」，肢体取中段 / 末端中心。
  function stickerAnchor(part) {
    var g = GEO3D;
    switch (part) {
      case 'head': return [0, -g.headH / 2 - 14, 0];
      case 'neck': return [0, 0, 0];
      case 'torso': return [0, g.torsoOy, g.torsoD / 2];
      case 'armL': case 'armR': return [0, g.armLen / 2, 0];
      case 'forearmL': case 'forearmR': return [0, g.armLen / 4 - 2, 0];
      case 'handL': case 'handR': return [0, 2, 0];
      case 'legL': case 'legR': return [0, g.legLen / 2, 0];
      case 'footL': case 'footR': return [0, 4, 10];
    }
    return [0, 0, 0];
  }

  // 挂载式贴纸的部位锚点投影（1024 基准坐标，不含用户偏移 dx/dy）。
  // 骨骼不可用（尚未渲染）时返回 null，调用方回退自由式坐标。
  function stickerMountBase(it) {
    if (!it.mount || !LAST_SK) return null;
    var node = LAST_SK.nodes[it.mount.part];
    if (!node) return null;
    return projectV(applyM(node._m, stickerAnchor(it.mount.part)));
  }

  // 贴纸统一变换：返回 [cx, cy, rotDeg, scaleMul]（1024 基准）。
  // 自由式 = 画布坐标 + 自身旋转；挂载式 = 部位锚点投影 + 偏移，
  // 并跟随肢体方向产生附加旋转、跟随部位缩放产生倍率（走路 / 抬手 / 捏体型时贴纸跟着走）。
  function stickerXform(it) {
    var rot = it.rot || 0;
    if (!it.mount) return [it.x / 100 * BASE, it.y / 100 * BASE, rot, 1];
    var base = stickerMountBase(it);
    if (!base) return [it.x / 100 * BASE, it.y / 100 * BASE, rot, 1];
    var node = LAST_SK.nodes[it.mount.part];
    // 跟随旋转：肢体局部 +Y（骨骼延伸方向，静止时指向世界下方）投影后的偏角，
    // 相对「竖直向下」为 0°——手臂侧摆 / 抬起多少度，贴纸就随多少度，点头 / 摆腿同理。
    var dir = rotOnly(node._m, [0, 1, 0]);
    var w = applyM(node._m, stickerAnchor(it.mount.part));
    var p2 = projectV([w[0] + dir[0] * 30, w[1] + dir[1] * 30, w[2] + dir[2] * 30]);
    var follow = Math.atan2(p2[0] - base[0], p2[1] - base[1]) * 180 / Math.PI;
    // 跟随缩放：部位矩阵 X 轴单位向量的长度 = 该部位的附加 scale（捏粗细 / 放大时贴纸同步）
    var scaleMul = Math.hypot.apply(null, rotOnly(node._m, [1, 0, 0]));
    return [base[0] + (it.mount.dx || 0), base[1] + (it.mount.dy || 0), rot + follow, scaleMul || 1];
  }

  function stickerRadiusUnit(it) {
    var sc = it.scale || 1;
    if (it.t === 'img') return (ST_IMG_BASE / 2) * sc;
    var def = findSticker(it.ref);
    return def ? def.r * def.u * sc : 60 * sc;
  }

  // unit = 1 个 1024 基准像素在当前画布尺寸下的倍数；调用前需已 translate 到实例中心
  function drawStickerCore(ctx, it, unit) {
    var sc = it.scale || 1;
    if (it.t === 'img') {
      var img = it.img;
      if (!img) return;
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) return;
      var side = ST_IMG_BASE * sc * unit;
      var dw = w >= h ? side : side * w / h;
      var dh = w >= h ? side * h / w : side;
      ctx.imageSmoothingEnabled = !it.pixel;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      return;
    }
    var def = findSticker(it.ref);
    if (!def) return;
    ctx.imageSmoothingEnabled = true;
    ctx.shadowColor = def.col;
    ctx.shadowBlur = 24 * sc * unit;   // 阴影不受 CTM 影响，按画布比例手动缩放
    var p = makePen(ctx);
    p.set(def.col);
    p.px = function (x, y, w, h) { ctx.fillStyle = def.col; ctx.fillRect(x, y, w || 1, h || 1); };
    def.draw(p, def.u * sc * unit);
    ctx.shadowBlur = 0;
  }

  function drawStickerItem(ctx, it, s) {
    var xf = stickerXform(it), k = s / BASE;
    ctx.save();
    ctx.translate(xf[0] * k, xf[1] * k);
    if (xf[2]) ctx.rotate(xf[2] * Math.PI / 180);
    drawStickerCore(ctx, it, k * xf[3]);
    ctx.restore();
  }

  // 缩略图：把实例按比例塞进 box 方框
  function drawStickerThumbOf(ctx, it, box) {
    ctx.save();
    ctx.translate(box / 2, box / 2);
    drawStickerCore(ctx, it, (box * .46) / Math.max(1, stickerRadiusUnit(it)));
    ctx.restore();
  }

  // 半宽 / 半高（1024 基准单位）：内建贴纸为正方形，图片贴纸保留原图长宽比
  function stickerBoxUnit(it) {
    var r = stickerRadiusUnit(it);
    if (it.t === 'img' && it.img) {
      var w = it.img.naturalWidth || it.img.width, h = it.img.naturalHeight || it.img.height;
      if (!w || !h) return [r, r];
      return w >= h ? [r, r * h / w] : [r * w / h, r];
    }
    return [r, r];
  }

  function drawStickerSelection(ctx, it, s) {
    var k = s / BASE;
    var xf = stickerXform(it);
    var box = stickerBoxUnit(it);
    var hw = box[0] * k * xf[3] * 1.04, hh = box[1] * k * xf[3] * 1.04;
    ctx.save();
    ctx.translate(xf[0] * k, xf[1] * k);
    if (xf[2]) ctx.rotate(xf[2] * Math.PI / 180);
    ctx.strokeStyle = 'rgba(115,249,154,.95)';
    ctx.lineWidth = Math.max(1.5, 2.5 * k);
    ctx.setLineDash([7 * k, 5 * k]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(115,249,154,.95)';
    var hs = Math.max(2, 4 * k);
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (p) {
      ctx.fillRect(p[0] - hs, p[1] - hs, hs * 2, hs * 2);
    });
    ctx.restore();
  }

  function renderStickers(ctx, s, ui) {
    S.stickerItems.forEach(function (it) { drawStickerItem(ctx, it, s); });
    if (!ui) return;                                   // 导出不画选中框
    var sel = selStickerItem();
    if (sel) drawStickerSelection(ctx, sel, s);
  }

  /* ---------------- 文字 ---------------- */
  function renderText(ctx, s) {
    var t = S.text;
    if (t.pos === 'none' || !t.content) return;
    var size = 118 * t.size * (s / BASE);
    var lines = t.content.split('\n');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 ' + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    // 自适应缩放
    var maxW = s * .88;
    var w = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
    if (w > maxW) { size *= maxW / w; ctx.font = '900 ' + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif'; }
    var lineH = size * 1.18;
    var blockH = lineH * lines.length;
    var cy0 = t.pos === 'top' ? s * .155 + blockH / 2 : s * .885 - blockH / 2;
    ctx.translate(s / 2, cy0);
    ctx.rotate(-1.6 * Math.PI / 180);
    lines.forEach(function (line, i) {
      var y = (i - (lines.length - 1) / 2) * lineH;
      if (t.style === 'bubble') {
        var w2 = ctx.measureText(line).width;
        var padX = size * .42, padY = size * .3;
        roundRect(ctx, -w2 / 2 - padX, y - lineH / 2 - padY * .1, w2 + padX * 2, lineH * .92 + padY, size * .35);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.fillStyle = t.color === '#ffffff' ? '#1a1d20' : t.color;
        ctx.fillText(line, 0, y + size * .04);
        // 尾巴：下方文字尾巴朝上指，上方文字尾巴朝下指
        var bh = lineH * .92 + padY;
        var ty = y + (t.pos === 'top' ? bh / 2 : -bh / 2);
        var tip = t.pos === 'top' ? ty + size * .3 : ty - size * .3;
        ctx.beginPath();
        ctx.moveTo(-size * .18, ty); ctx.lineTo(size * .22, ty); ctx.lineTo(0, tip);
        ctx.closePath(); ctx.fill();
      } else if (t.style === 'neon') {
        ctx.shadowColor = t.color; ctx.shadowBlur = size * .35;
        ctx.fillStyle = t.color;
        ctx.fillText(line, 0, y);
        ctx.fillText(line, 0, y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.font = '700 ' + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
        ctx.fillText(line, 0, y);
        ctx.font = '900 ' + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      } else { // meme
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeStyle = 'rgba(10,12,14,.95)';
        ctx.lineWidth = size * .18;
        ctx.strokeText(line, 0, y);
        ctx.fillStyle = t.color;
        ctx.fillText(line, 0, y);
      }
    });
    ctx.restore();
  }

  /* ---------------- 总渲染 ---------------- */
  // ui = true 时额外绘制「贴纸选中框」（仅预览用，导出传 false）
  // t ∈ [0,1) 为动画相位（v1.4.0）：不传则按当前静态状态渲染（PNG 导出用）
  function render(ctx, s, ui, t) {
    ctx.clearRect(0, 0, s, s);
    renderBg(ctx, S.bg, s);
    // 全部姿势均走手绘 3D 管线，底部自绘参考图仅作展示，不进入生成
    if (PROC_POSES[S.pose]) {
      var rig = (t == null) ? (S.rig || REST_RIG) : effectiveRig(t);
      renderProcedural(ctx, s, undefined, rig, t == null ? null : effectiveFace(t));
    }
    renderStickers(ctx, s, ui);
    renderText(ctx, s);
    if (ui) {
      drawPartOverlay(ctx, s);       // v1.7.0：部位选中高亮只在预览层
      drawIkOverlay(ctx, s);         // 肢体手柄高亮只在预览层，导出不含
    }
  }

  var stage = document.getElementById('stage');
  var stageCtx = stage.getContext('2d');
  /* ---------------- 预览动画循环（v1.4.0） + 关键帧播放（v1.11.0） ---------------- */
  var animRAF = 0;
  function animPhase() {
    return (performance.now() / 1000 % S.anim.period) / S.anim.period;
  }
  function animLoop() {
    animRAF = 0;
    if (!animActive()) return;
    render(stageCtx, BASE, true, animPhase());
    animRAF = requestAnimationFrame(animLoop);
  }
  var kfRAF = 0, kfT0 = 0, kfBase = 0;
  function startKfLoop() {   // 关键帧循环播放：viewT 持续推进，播放头 UI 同步跟随
    kfT0 = performance.now();
    kfBase = KF.viewT != null ? KF.viewT : 0;
    (function step(now) {
      kfRAF = 0;
      if (!KF.playing || !kfActive()) { KF.playing = false; syncKfUI(); return; }
      var dur = kfDur();
      KF.viewT = (kfBase + (now - kfT0) / 1000) % dur;
      renderKfView(stageCtx, BASE, true, KF.viewT);
      syncKfHead();
      kfRAF = requestAnimationFrame(step);
    })(performance.now());
  }
  function stopKfLoop() {
    if (kfRAF) { cancelAnimationFrame(kfRAF); kfRAF = 0; }
  }
  function repaint() {
    document.getElementById('bgChecker').classList.toggle('show', S.bg === 'none');
    // 渲染优先级（互斥）：关键帧播放 > 播放头停留 > 循环动画 > 当前骨骼静态
    if (KF.playing && kfActive()) {
      if (!kfRAF) startKfLoop();
      return;
    }
    stopKfLoop();
    if (KF.viewT != null) {
      renderKfView(stageCtx, BASE, true, KF.viewT);
      return;
    }
    if (animActive()) {
      if (!animRAF) animRAF = requestAnimationFrame(animLoop);   // 循环帧里自绘
    } else {
      if (animRAF) { cancelAnimationFrame(animRAF); animRAF = 0; }
      render(stageCtx, BASE, true);
    }
  }

  /* ---------------- 缩略图 ---------------- */
  function thumbCanvas(px) {
    var cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    return cv;
  }
  function buildPoseThumb(id) {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    c.save(); c.scale(120 / BASE, 120 / BASE);
    renderProcedural(c, BASE, 120 / BASE, RIG_POSES[id].rig);
    c.restore();
    return cv;
  }
  function buildFaceThumb(def) {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    c.fillStyle = '#10171b';
    roundRect(c, 8, 16, 104, 76, 8); c.fill();
    var fc = getFaceCanvas(def.id).cv;
    c.imageSmoothingEnabled = false;
    c.save();
    c.shadowColor = faceGlow(def); c.shadowBlur = 10;
    c.drawImage(fc, 14, 22, 92, 64);
    c.restore();
    c.drawImage(fc, 14, 22, 92, 64);
    return cv;
  }
  function buildBgThumb(def) {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    var keep = S.bg; S.bg = def.id;
    renderBg(c, def.id, 120);
    S.bg = keep;
    return cv;
  }
  function buildStickerThumb(def) {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    c.save();
    c.translate(60, 60);
    drawStickerCore(c, { t: 'b', ref: def.id, scale: 1, rot: 0 }, 46 / (def.r * def.u));
    c.restore();
    return cv;
  }
  function buildPlusThumb() {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    c.save();
    c.strokeStyle = C.cyan; c.lineWidth = 6; c.lineCap = 'round';
    c.shadowColor = C.cyan; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(60, 38); c.lineTo(60, 82); c.moveTo(38, 60); c.lineTo(82, 60); c.stroke();
    c.restore();
    return cv;
  }

  /* ---------------- UI 构建 ---------------- */
  function optTile(canvas, label, active) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (active ? ' active' : '');
    b.appendChild(canvas);
    var lab = document.createElement('div');
    lab.className = 'opt-label';
    lab.textContent = label;
    b.appendChild(lab);
    return b;
  }

  // 保存底部参考图：数据地址 → Blob → 本地下载
  function saveGalleryImage(g) {
    var m = /^data:image\/([a-z0-9+.-]+);base64,/i.exec(g.data || '');
    var mime = m ? 'image/' + m[1].toLowerCase() : 'image/jpeg';
    var ext = mime === 'image/jpeg' ? 'jpg' : mime.replace('image/', '');
    var bin = atob((g.data || '').split(',')[1] || '');
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    download(new Blob([buf], { type: mime }), 'TRAE宝-' + g.label.replace(/·/g, '-') + '.' + ext);
    toast('已保存参考图「' + g.label + '」');
  }

  function buildOptions() {
    // 全部姿势均为手绘 3D 模型（底部参考图同为自绘图稿，不用于生成）
    var proc = document.getElementById('poseProc');
    Object.keys(PROC_POSES).forEach(function (id) {
      var b = optTile(buildPoseThumb(id), PROC_POSES[id].label, S.pose === id);
      b.dataset.v = id;
      b.onclick = function () { setPose(id); };
      proc.appendChild(b);
    });
    // 表情（内置 + 自定义 + 「自己画」入口）
    buildFaceGrid();
    // 背景
    var bg = document.getElementById('bgGrid');
    BGS.forEach(function (def) {
      var b = optTile(buildBgThumb(def), def.label, S.bg === def.id);
      b.dataset.v = def.id;
      b.onclick = function () { setBg(def.id); };
      bg.appendChild(b);
    });
    // 自定义背景入口（上传本地图片；未选图时点它即打开文件选择）
    bgCustomTile = optTile(buildCustomBgThumb(), '自定义图', S.bg === 'custom');
    bgCustomTile.dataset.v = 'custom';
    bgCustomTile.classList.add('opt-custom');
    var bgPen = document.createElement('span');
    bgPen.className = 'opt-edit';
    bgPen.textContent = '✎';
    bgPen.title = '更换背景图片';
    bgPen.onclick = function (e) { e.stopPropagation(); openBgPicker(); };
    bgCustomTile.appendChild(bgPen);
    bgCustomTile.onclick = function () {
      if (!bgImg) { openBgPicker(); return; }
      setBg('custom');
    };
    bg.appendChild(bgCustomTile);
    // 贴纸：点选即往画布添加一个实例（可重复添加）
    var sg = document.getElementById('stickerGrid');
    STICKERS.forEach(function (def) {
      var b = optTile(buildStickerThumb(def), def.label, false);
      b.dataset.v = def.id;
      b.onclick = function () { addBuiltinSticker(def.id); };
      sg.appendChild(b);
    });
    var upTile = optTile(buildPlusThumb(), '上传图片', false);
    upTile.classList.add('opt-add');
    upTile.title = '上传本地图片作为贴纸';
    upTile.onclick = openStickerPicker;
    sg.appendChild(upTile);
    var drawTile = optTile(buildPlusThumb(), '自己画', false);
    drawTile.classList.add('opt-add');
    drawTile.title = '打开 32×32 像素画板，自己画一张贴纸';
    drawTile.onclick = openStickerEditor;
    sg.appendChild(drawTile);
    // 文案预设
    var tp = document.getElementById('textPresets');
    TEXT_PRESETS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = t;
      b.onclick = function () {
        document.getElementById('textInput').value = t;
        S.text.content = t;
        if (S.text.pos === 'none') setTextPos('bottom');
        repaint();
      };
      tp.appendChild(b);
    });
    // 套系
    var pc = document.getElementById('presetChips');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label;
      b.onclick = function () { applyPreset(p); };
      pc.appendChild(b);
    });
    // 参考图（自绘图稿，支持单张保存）
    var gal = document.getElementById('gallery');
    ASSETS.gallery.forEach(function (g) {
      var fig = document.createElement('figure');
      fig.className = 'g'; fig.style.margin = '0';
      var im = new Image(); im.src = g.data; im.alt = g.label; im.loading = 'lazy';
      var cap = document.createElement('figcaption'); cap.textContent = g.label;
      var save = document.createElement('button');
      save.type = 'button'; save.className = 'g-save'; save.textContent = '⬇ 保存';
      save.title = '保存这张参考图（' + g.label + '）';
      save.onclick = function () { saveGalleryImage(g); };
      fig.appendChild(im); fig.appendChild(cap); fig.appendChild(save);
      gal.appendChild(fig);
    });
  }

  /* ---------------- 角色配色面板（v1.5.0） ---------------- */
  var skinEl = { parts: {} };
  var skinThumbTimer = 0;

  function buildSkinUI() {
    var wrap = document.getElementById('skinPresets');
    SKIN_PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'skin-preset'; b.dataset.v = p.id;
      var dot = document.createElement('i'); dot.style.background = p.base;
      var lab = document.createElement('span'); lab.textContent = p.label;
      b.appendChild(dot); b.appendChild(lab);
      b.onclick = function () { applySkinBase(p.base, p.label); };
      wrap.appendChild(b);
    });
    var parts = document.getElementById('skinParts');
    SKIN_PARTS.forEach(function (p) {
      var row = document.createElement('label');
      row.className = 'skin-part';
      var input = document.createElement('input');
      input.type = 'color'; input.value = S.skin[p.key];
      var name = document.createElement('span');
      name.className = 'skin-part-name'; name.textContent = p.label;
      var hex = document.createElement('b'); hex.textContent = S.skin[p.key];
      input.addEventListener('input', function () {
        S.skin[p.key] = hex6(input.value) || S.skin[p.key];
        syncSkinUI();
        skinChanged();
      });
      row.appendChild(input); row.appendChild(name); row.appendChild(hex);
      parts.appendChild(row);
      skinEl.parts[p.key] = { input: input, hex: hex };
    });
    skinEl.global = document.getElementById('skinGlobal');
    skinEl.globalHex = document.getElementById('skinGlobalHex');
    skinEl.global.addEventListener('input', function () {
      applySkinBase(skinEl.global.value, null, true);   // 拖动取色时不打断操作，不弹提示
    });
    document.getElementById('skinOfficial').onclick = function () {
      applySkinBase(SKIN_OFFICIAL.head, '官方配色');
    };
    syncSkinUI();
  }

  function syncSkinUI() {
    if (!skinEl.global) return;
    SKIN_PARTS.forEach(function (p) {
      var it = skinEl.parts[p.key];
      it.input.value = S.skin[p.key];
      it.hex.textContent = S.skin[p.key];
    });
    skinEl.global.value = S.skin.head;
    skinEl.globalHex.textContent = S.skin.head;
    [].forEach.call(document.getElementById('skinPresets').children, function (b) {
      var def = SKIN_PRESETS.find(function (p) { return p.id === b.dataset.v; });
      b.classList.toggle('active', !!def && skinEq(S.skin, skinFromBase(def.base)));
    });
  }

  // 配色变化：存本机 + 重绘预览 + 防抖刷新 10 张姿势缩略图（拖动取色时避免每帧重建）
  function skinChanged() {
    saveSkin();
    repaint();
    clearTimeout(skinThumbTimer);
    skinThumbTimer = setTimeout(refreshPoseThumbs, 160);
  }

  function refreshPoseThumbs() {
    var grid = document.getElementById('poseProc');
    [].forEach.call(grid.children, function (b) {
      if (!b.dataset.v || !RIG_POSES[b.dataset.v]) return;
      b.replaceChild(buildPoseThumb(b.dataset.v), b.firstChild);
    });
  }

  function applySkinBase(base, label, quiet) {
    S.skin = skinFromBase(base);
    syncSkinUI();
    skinChanged();
    if (!quiet && label) toast('已切换配色「' + label + '」');
  }

  /* ---------------- 表情格子（内置 + 自定义 + 自己画） ---------------- */
  function buildFaceGrid() {
    var fg = document.getElementById('faceGrid');
    fg.innerHTML = '';
    FACES.forEach(function (def) {
      var b = optTile(buildFaceThumb(def), def.label, S.face === def.id);
      b.dataset.v = def.id;
      b.onclick = function () { setFace(def.id); };
      // v1.9.0：内置与自定义表情都能二次创作（改名 / 调眼睛亮度 / 改像素）
      var builtin = isBuiltinFace(def.id);
      b.classList.add(builtin ? 'opt-builtin-edit' : 'opt-custom');
      if (builtin && FACE_EDITS[def.id]) b.classList.add('opt-edited');
      var pen = document.createElement('span');
      pen.className = 'opt-edit';
      pen.textContent = '✎';
      pen.title = builtin ? '二次创作这个内置表情（改名 / 调眼睛亮度 / 改像素）' : '编辑 / 删除这个自定义表情';
      pen.onclick = function (e) { e.stopPropagation(); openFaceEditor(def); };
      b.appendChild(pen);
      fg.appendChild(b);
    });
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'opt opt-add';
    add.title = '打开像素画板，自己画一个表情';
    add.appendChild(buildAddFaceThumb());
    var lab = document.createElement('div');
    lab.className = 'opt-label';
    lab.textContent = '自己画';
    add.appendChild(lab);
    add.onclick = function () { openFaceEditor(null); };
    fg.appendChild(add);
  }
  function buildAddFaceThumb() {
    var cv = thumbCanvas(120), c = cv.getContext('2d');
    c.fillStyle = '#10171b';
    roundRect(c, 8, 16, 104, 76, 8); c.fill();
    c.save();
    c.strokeStyle = C.cyan; c.lineWidth = 6; c.lineCap = 'round';
    c.shadowColor = C.cyan; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(60, 36); c.lineTo(60, 72); c.moveTo(42, 54); c.lineTo(78, 54); c.stroke();
    c.restore();
    return cv;
  }

  /* ---------------- 像素网格工具（表情画板 / 贴纸画板共用） ---------------- */
  var GRID_UNDO_MAX = 40;

  function gridBlank(w, h) {
    var a = new Array(w * h);
    for (var i = 0; i < a.length; i++) a[i] = '';
    return a;
  }
  function gridStamp(E, x, y) {
    var col = E.tool === 'eraser' ? '' : E.color;
    var n = E.size, off = Math.floor((n - 1) / 2);
    for (var dy = 0; dy < n; dy++) for (var dx = 0; dx < n; dx++) {
      var px = x - off + dx, py = y - off + dy;
      if (px < 0 || px >= E.W || py < 0 || py >= E.H) continue;
      E.cells[py * E.W + px] = col;
      if (E.mirror) E.cells[py * E.W + (E.W - 1 - px)] = col;
    }
  }
  function gridLine(E, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    for (;;) {
      gridStamp(E, x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  function gridFlood(E, x, y, col) {
    var target = E.cells[y * E.W + x];
    if (target === col) return;
    var stack = [[x, y]];
    while (stack.length) {
      var p = stack.pop(), cx = p[0], cy = p[1];
      if (cx < 0 || cx >= E.W || cy < 0 || cy >= E.H) continue;
      if (E.cells[cy * E.W + cx] !== target) continue;
      E.cells[cy * E.W + cx] = col;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function gridPushUndo(E) {
    E.undo.push(E.cells.slice());
    if (E.undo.length > GRID_UNDO_MAX) E.undo.shift();
  }
  function gridCellAt(cv, e, w, h) {
    var r = cv.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * w);
    var y = Math.floor((e.clientY - r.top) / r.height * h);
    if (x < 0 || x >= w || y < 0 || y >= h) return null;
    return [x, y];
  }
  function gridRender(E, cv, cell, centerLine) {
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#0a1114'; c.fillRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < E.H; y++) for (var x = 0; x < E.W; x++) {
      var col = E.cells[y * E.W + x];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * cell, y * cell, cell, cell);
    }
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(87,230,196,.10)';
    for (var i = 0; i <= E.W; i++) {
      c.beginPath(); c.moveTo(i * cell + .5, 0); c.lineTo(i * cell + .5, E.H * cell); c.stroke();
    }
    for (var j = 0; j <= E.H; j++) {
      c.beginPath(); c.moveTo(0, j * cell + .5); c.lineTo(E.W * cell, j * cell + .5); c.stroke();
    }
    if (centerLine) {
      c.strokeStyle = 'rgba(87,230,196,.22)';
      c.beginPath(); c.moveTo(E.W * cell / 2 + .5, 0); c.lineTo(E.W * cell / 2 + .5, E.H * cell); c.stroke();
    }
  }

  /* ---------------- 像素画板通用：20 色板 / 三种取色（v1.9.1） ---------------- */
  // 表情画板与贴纸画板共用；除预设色板外，还可自定义取色 / 屏幕取色 / 画板吸管
  var GRID_PALETTE = [
    ['#9ff7e4', '青'], ['#f2ffff', '白'], ['#ff5a4e', '红'], ['#ff9bd3', '粉'],
    ['#ffd75e', '黄'], ['#6fcbff', '蓝'], ['#8ef58e', '绿'], ['#ffa14a', '橙'],
    ['#c9a2ff', '紫'], ['#1a1d20', '黑'], ['#57e6c4', '薄荷'], ['#38e8ff', '天蓝'],
    ['#d7fcae', '青柠'], ['#ff4d8d', '玫红'], ['#b57a4a', '棕'], ['#9aa3a8', '灰'],
    ['#ffe9a3', '奶油'], ['#a0f0ff', '冰蓝'], ['#ffcf4d', '琥珀'], ['#e0c3ff', '浅紫']
  ];
  function gridPickCell(E, x, y) {     // 画板吸管：取已有像素颜色，取到后自动切回画笔
    var col = E.cells[y * E.W + x];
    if (!col) return null;
    E.color = col;
    if (E.tool === 'pick') E.tool = 'pen';
    return col;
  }
  function screenPickColor(apply) {    // 屏幕取色：EyeDropper API（Chrome / Edge 等支持）
    if (!window.EyeDropper) { toast('当前浏览器不支持屏幕取色，请用「🎨 自定义颜色」或「💧 吸管」'); return; }
    var ed;
    try { ed = new window.EyeDropper(); }
    catch (e) { toast('屏幕取色启动失败，请用「🎨 自定义颜色」'); return; }
    ed.open().then(function (res) {
      if (res && res.sRGBHex) apply(res.sRGBHex.toLowerCase());
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;   // 用户主动取消，不打扰
      toast('屏幕取色不可用（需 https 或 localhost），请用「🎨 自定义颜色」');
    });
  }
  function isHexColor(v) { return /^#[0-9a-f]{6}$/i.test(v || ''); }
  function gridSafeColor(v, fallback) { return isHexColor(v) ? v.toLowerCase() : fallback; }

  /* ---------------- 像素表情画板 ---------------- */
  var FE_COLORS = GRID_PALETTE;
  var FE_CELL = 14;
  var FE = { W: FW, H: FH, cells: [], color: FE_COLORS[0][0], tool: 'pen', size: 1, mirror: false, undo: [], editing: null, drawing: false, last: null };
  var feEl = {};

  function feBlank() { return gridBlank(FW, FH); }

  function feBind() {
    feEl.modal = document.getElementById('faceEditor');
    feEl.canvas = document.getElementById('feCanvas');
    feEl.preview = document.getElementById('fePreview');
    feEl.name = document.getElementById('feName');
    feEl.glow = document.getElementById('feGlow');
    feEl.bright = document.getElementById('feBright');
    feEl.brightVal = document.getElementById('feBrightVal');
    feEl.mirror = document.getElementById('feMirror');
    feEl.del = document.getElementById('feDelete');
    feEl.title = document.getElementById('feTitle');
    feEl.palette = document.getElementById('feColors');
    feEl.sizeWrap = document.getElementById('feSize');
    feEl.custom = document.getElementById('feCustom');
    feEl.colorInput = document.getElementById('feColor');
    feEl.screen = document.getElementById('feScreen');
    feEl.hex = document.getElementById('feHex');
    feEl.hexVal = document.getElementById('feHexVal');

    FE_COLORS.forEach(function (pair) {
      var sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'fe-sw'; sw.dataset.c = pair[0];
      sw.style.setProperty('--c', pair[0]); sw.title = pair[1];
      sw.onclick = function () { feApplyColor(pair[0], true); };
      feEl.palette.appendChild(sw);
      if (pair[0] === '#1a1d20') return;   // 黑色发光不可见，不进发光色下拉
      var op = document.createElement('option');
      op.value = pair[0]; op.textContent = pair[1];
      feEl.glow.appendChild(op);
    });
    // 自定义取色：隐藏的 type=color 挂到「🎨 自定义颜色」按钮上
    feEl.custom.onclick = function () {
      feEl.colorInput.value = feCurrentHex();
      feEl.colorInput.click();
    };
    feEl.colorInput.addEventListener('input', function () { feApplyColor(feEl.colorInput.value, true); });
    feEl.screen.onclick = function () { screenPickColor(function (hex) { feApplyColor(hex, false); }); };
    [].forEach.call(document.querySelectorAll('#feTools .fe-tool'), function (b) {
      b.onclick = function () { FE.tool = b.dataset.tool; feSyncTools(); };
    });
    [].forEach.call(feEl.sizeWrap.querySelectorAll('.fe-size'), function (b) {
      b.onclick = function () { FE.size = +b.dataset.s; feSyncTools(); };
    });
    feEl.mirror.onchange = function () { FE.mirror = feEl.mirror.checked; };
    feEl.glow.onchange = function () { fePreview(); };
    feEl.bright.addEventListener('input', function () {   // v1.9.0：眼睛亮度实时预览
      feEl.brightVal.textContent = Math.round(feBrightValue() * 100) + '%';
      fePreview();
    });

    feEl.canvas.addEventListener('pointerdown', function (e) {
      var p = feCellAt(e);
      if (!p) return;
      e.preventDefault();
      if (FE.tool === 'pick') {                       // v1.9.1：画板吸管
        var got = gridPickCell(FE, p[0], p[1]);
        if (got) { feSyncTools(); toast('已拾取颜色 ' + got); }
        else toast('这一格是透明的，换一格再吸');
        return;
      }
      feEl.canvas.setPointerCapture(e.pointerId);
      fePushUndo();
      if (FE.tool === 'fill') {
        feFlood(p[0], p[1], FE.color);
      } else {
        FE.drawing = true; FE.last = p;
        feStamp(p[0], p[1]);
      }
      fePaintUpdate();
    });
    feEl.canvas.addEventListener('pointermove', function (e) {
      if (!FE.drawing) return;
      var p = feCellAt(e);
      if (!p) return;
      if (FE.last) feLine(FE.last[0], FE.last[1], p[0], p[1]);
      FE.last = p;
      fePaintUpdate();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      feEl.canvas.addEventListener(t, function () { FE.drawing = false; FE.last = null; });
    });

    document.getElementById('feClose').onclick = closeFaceEditor;
    document.getElementById('feUndo').onclick = function () {
      if (!FE.undo.length) return;
      FE.cells = FE.undo.pop();
      fePaintUpdate();
    };
    document.getElementById('feClear').onclick = function () {
      fePushUndo();
      FE.cells = feBlank();
      fePaintUpdate();
    };
    document.getElementById('feTpl').onclick = function () {
      fePushUndo();
      feLoadTemplate('normal');
      fePaintUpdate();
    };
    document.getElementById('feSave').onclick = feSave;
    feEl.del.onclick = feDelete;
    feEl.modal.addEventListener('click', function (e) { if (e.target === feEl.modal) closeFaceEditor(); });
    document.addEventListener('keydown', function (e) {
      if (feEl.modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeFaceEditor();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (FE.undo.length) { FE.cells = FE.undo.pop(); fePaintUpdate(); }
      }
    });
  }

  function feSyncTools() {
    [].forEach.call(document.querySelectorAll('#feTools .fe-tool'), function (b) {
      b.classList.toggle('active', b.dataset.tool === FE.tool);
    });
    [].forEach.call(feEl.sizeWrap.querySelectorAll('.fe-size'), function (b) {
      b.classList.toggle('active', +b.dataset.s === FE.size);
    });
    [].forEach.call(feEl.palette.children, function (b) {
      b.classList.toggle('active', b.dataset.c === FE.color);
    });
    if (feEl.hex) {
      feEl.hex.style.setProperty('--c', feCurrentHex());
      feEl.hexVal.textContent = feCurrentHex();
    }
  }
  function feCurrentHex() { return isHexColor(FE.color) ? FE.color : FE_COLORS[0][0]; }
  function feApplyColor(hex, quiet) {
    FE.color = gridSafeColor(hex, FE_COLORS[0][0]);
    if (FE.tool === 'eraser' || FE.tool === 'pick') FE.tool = 'pen';
    if (feEl.colorInput) feEl.colorInput.value = FE.color;
    feSyncTools();
    if (!quiet) toast('已取到颜色 ' + FE.color);
  }

  function openFaceEditor(def) {
    FE.editing = def || null;
    var builtin = !!(def && isBuiltinFace(def.id));
    // 内置表情先栅格化成像素底稿；已二次创作过的直接读存档 cells（避免亮度被重复烘焙）
    FE.cells = def ? (def.cells ? def.cells.slice() : faceCellsOf(def.id)) : feBlank();
    FE.undo = [];
    FE.tool = 'pen';
    FE.size = 1;
    FE.mirror = false;
    FE.color = FE_COLORS[0][0];
    FE.drawing = false; FE.last = null;
    if (!feEl.modal) feBind();
    feEl.name.value = def ? def.label : '';
    feEl.glow.value = def ? def.glow : FE_COLORS[0][0];
    feEl.colorInput.value = FE.color;   // 自定义取色器与当前画笔色同步
    var pct = Math.round(faceBright(def) * 100);
    feEl.bright.value = Math.max(40, Math.min(160, pct));
    feEl.brightVal.textContent = pct + '%';
    feEl.mirror.checked = false;
    var canRestore = builtin && !!FACE_EDITS[def.id];
    feEl.del.classList.toggle('hidden', !def || (builtin && !canRestore));
    feEl.del.textContent = builtin ? '↺ 还原官方表情' : '删除这个表情';
    feEl.title.textContent = builtin ? '二次创作内置表情' : (def ? '编辑表情' : '画一个新表情');
    feEl.modal.classList.remove('hidden');
    feSyncTools();
    fePaintUpdate();
    setTimeout(function () { feEl.name.focus(); }, 30);
  }
  function closeFaceEditor() {
    if (!feEl.modal) return;
    feEl.modal.classList.add('hidden');
    FE.editing = null;
    FE.drawing = false; FE.last = null;
  }

  function feCellAt(e) { return gridCellAt(feEl.canvas, e, FW, FH); }
  function feStamp(x, y) { gridStamp(FE, x, y); }
  function feLine(x0, y0, x1, y1) { gridLine(FE, x0, y0, x1, y1); }
  function feFlood(x, y, col) { gridFlood(FE, x, y, col); }
  function fePushUndo() { gridPushUndo(FE); }
  function feLoadTemplate(id) { FE.cells = faceCellsOf(id); }

  function fePaintUpdate() {
    feRenderGrid();
    fePreview();
  }
  function feRenderGrid() { gridRender(FE, feEl.canvas, FE_CELL, true); }
  function fePreview() {
    var cv = feEl.preview, c = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#10171b';
    roundRect(c, 6, 8, w - 12, h - 16, 10); c.fill();
    var tmp = document.createElement('canvas');
    tmp.width = FW; tmp.height = FH;
    drawCells(makePen(tmp.getContext('2d')), FE.cells);
    var k = feBrightValue();
    brightenCanvas(tmp, k);   // 预览同步眼睛亮度
    var dw = w - 40, dh = dw * FH / FW;
    var dx = (w - dw) / 2, dy = (h - dh) / 2;
    c.imageSmoothingEnabled = false;
    c.save();
    c.shadowColor = brightHex(feGlowInput(), k) || FE_COLORS[0][0];
    c.shadowBlur = 16;
    c.drawImage(tmp, dx, dy, dw, dh);
    c.restore();
    c.drawImage(tmp, dx, dy, dw, dh);
  }
  function feGlowInput() { return feEl.glow.value || FE_COLORS[0][0]; }
  function feBrightValue() { return clampBright((+feEl.bright.value || 100) / 100); }

  function feSave() {
    var label = (feEl.name.value || '').trim().slice(0, 8) || '我的表情';
    var glow = feGlowInput();
    var bright = feBrightValue();
    var ink = false;
    for (var i = 0; i < FE.cells.length; i++) if (FE.cells[i]) { ink = true; break; }
    if (!ink) { toast('画板是空的，先画两个眼睛吧'); return; }
    var target = FE.editing ? FE.editing.id : null;
    var rec = null, ok = true, builtin = !!(target && isBuiltinFace(target));
    if (builtin) {
      // 内置表情：保存为覆盖记录（名称 / 发光色 / 眼睛亮度 / 像素），随时可「还原官方表情」
      FACE_EDITS[target] = { label: label, glow: glow, bright: bright, cells: FE.cells.slice() };
      ok = persistFaceEdits();
      delete faceCache[target];
    } else {
      if (target) {
        rec = CUSTOM_FACES.find(function (r) { return r.id === target; });
        if (!rec) { toast('这个表情已经不在了'); closeFaceEditor(); return; }
        rec.label = label; rec.glow = glow; rec.bright = bright; rec.cells = FE.cells.slice();
        delete faceCache[rec.id];
      } else {
        if (CUSTOM_FACES.length >= CUSTOM_MAX) { toast('自定义表情最多 ' + CUSTOM_MAX + ' 个，先删掉一些'); return; }
        rec = {
          id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100),
          label: label, glow: glow, bright: bright, cells: FE.cells.slice()
        };
        CUSTOM_FACES.push(rec);
      }
      ok = persistCustomFaces();
    }
    var id = target || rec.id;
    rebuildFaces();
    buildFaceGrid();
    setFace(id);
    closeFaceEditor();
    toast((builtin ? '已二次创作「' : '已保存「') + label + '」' + (ok ? '' : '（本地存储不可用，刷新会丢失）'));
  }
  function feDelete() {
    if (!FE.editing) return;
    var id = FE.editing.id;
    if (isBuiltinFace(id)) {
      // 内置表情：清掉覆盖记录即还原官方原画（名称 / 亮度 / 像素一并复位）
      if (!FACE_EDITS[id]) { closeFaceEditor(); return; }
      delete FACE_EDITS[id];
      persistFaceEdits();
      delete faceCache[id];
      rebuildFaces();
      buildFaceGrid();
      setFace(id);
      closeFaceEditor();
      toast('已还原官方表情「' + builtinFace(id).label + '」');
      return;
    }
    var rec = CUSTOM_FACES.find(function (r) { return r.id === id; });
    if (!rec) { closeFaceEditor(); return; }
    if (!window.confirm('删除自定义表情「' + rec.label + '」？此操作不可恢复。')) return;
    CUSTOM_FACES = CUSTOM_FACES.filter(function (r) { return r.id !== rec.id; });
    delete faceCache[rec.id];
    var wasCur = S.face === rec.id;
    persistCustomFaces();
    rebuildFaces();
    buildFaceGrid();
    if (wasCur) setFace('normal');
    closeFaceEditor();
    toast('已删除「' + rec.label + '」');
  }

  /* ---------------- 贴纸：实例、持久化与交互 ---------------- */
  var stEl = {};
  var stSeq = 0;
  var stSaveWarned = false;

  function uid() { stSeq++; return 'sk' + Date.now().toString(36) + stSeq; }
  function clampPct(v) { v = +v || 0; return Math.max(0, Math.min(100, Math.round(v * 10) / 10)); }
  function clampScale(v) { v = +v || 1; return Math.max(.25, Math.min(3, Math.round(v * 20) / 20)); }
  function clampRot(v) { v = +v || 0; return Math.max(-180, Math.min(180, Math.round(v))); }

  function selStickerItem() {
    if (!S.selSticker) return null;
    return S.stickerItems.find(function (it) { return it.uid === S.selSticker; }) || null;
  }

  function makeBuiltinStickerItem(id) {
    var def = findSticker(id);
    var home = STICKER_HOME[id] || [BASE / 2, BASE / 2];
    return {
      uid: uid(), t: 'b', ref: id, name: def ? def.label : id,
      x: home[0] / BASE * 100, y: home[1] / BASE * 100, scale: 1, rot: 0
    };
  }

  // 一键套系仍是旧版布尔表，这里转成实例（沿用旧版落点，画面效果保持一致）
  function presetStickerItems(map) {
    var out = [];
    Object.keys(map || {}).forEach(function (id) {
      if (map[id] && findSticker(id)) out.push(makeBuiltinStickerItem(id));
    });
    return out;
  }

  function addBuiltinSticker(id) {
    if (S.stickerItems.length >= ST_MAX) { toast('画布贴纸最多 ' + ST_MAX + ' 个，先删掉一些'); return; }
    var it = makeBuiltinStickerItem(id);
    var n = S.stickerItems.length;
    if (n) {   // 连续添加时轻微错位，避免完全重叠（第一张保持默认落点）
      it.x = clampPct(it.x + ((n % 3) - 1) * 4);
      it.y = clampPct(it.y + ((n % 2) - .5) * 5);
    }
    S.stickerItems.push(it);
    S.selSticker = it.uid;
    stickerChanged();
  }

  function selectSticker(uidVal) {
    S.selSticker = uidVal || null;
    rebuildStickerList();
    syncStickerCtl();
    repaint();
  }

  function stickerChanged() {
    rebuildStickerList();
    syncStickerCtl();
    repaint();
    saveStickersSoon();
  }

  function layerSticker(cmd) {
    var it = selStickerItem();
    if (!it) return;
    var i = S.stickerItems.indexOf(it);
    var j = cmd === 'up' ? i + 1 : cmd === 'down' ? i - 1 : cmd === 'top' ? S.stickerItems.length - 1 : 0;
    if (j === i || j < 0 || j >= S.stickerItems.length) return;
    S.stickerItems.splice(i, 1);
    S.stickerItems.splice(j, 0, it);
    stickerChanged();
  }

  function deleteSelectedSticker() {
    var it = selStickerItem();
    if (!it) return;
    S.stickerItems = S.stickerItems.filter(function (x) { return x !== it; });
    S.selSticker = null;
    stickerChanged();
  }

  function clearStickers() {
    if (!S.stickerItems.length) return;
    if (!window.confirm('清空画布上的全部贴纸（共 ' + S.stickerItems.length + ' 张）？此操作不可恢复。')) return;
    S.stickerItems = [];
    S.selSticker = null;
    stickerChanged();
  }

  /* ---------------- 贴纸：挂载到部位（v1.10.0） ---------------- */
  function clampMountOff(v) { v = +v || 0; return Math.max(-260, Math.min(260, Math.round(v))); }

  function mountPartId(part) {
    for (var i = 0; i < PART_DEFS.length; i++) if (PART_DEFS[i].id === part) return part;
    return null;
  }

  // 挂载 / 卸下 / 按部位替换：
  // - part 为空 = 卸下：把当前挂载投影位置写回画布坐标，恢复自由摆放（不丢贴纸）
  // - part 合法 = 挂载：同一部位同时只挂一张，新挂载会替换旧贴纸（旧贴纸直接移除）
  function setStickerMount(it, part) {
    if (!it) return;
    part = part ? mountPartId(part) : null;
    if (part) {
      var def = partDef(part);
      var replaced = null;
      S.stickerItems.forEach(function (o) {
        if (o !== it && o.mount && o.mount.part === part) replaced = o;
      });
      if (replaced) {
        S.stickerItems = S.stickerItems.filter(function (x) { return x !== replaced; });
        toast('已替换「' + (def ? def.label : part) + '」上原有的挂载贴纸');
      }
      it.mount = { part: part, dx: 0, dy: 0 };
    } else if (it.mount) {
      var xf = stickerXform(it);   // 卸下瞬间的屏幕位置 → 画布百分比，贴纸原地变自由式
      it.x = clampPct(xf[0] / BASE * 100);
      it.y = clampPct(xf[1] / BASE * 100);
      delete it.mount;
    }
    stickerChanged();
  }

  /* ---------------- 贴纸：持久化 ---------------- */
  function serializableStickers() {
    return S.stickerItems.map(function (it) {
      return {
        uid: it.uid, t: it.t, ref: it.ref || null, src: it.src || null, pixel: !!it.pixel,
        name: it.name || '', x: it.x, y: it.y, scale: it.scale || 1, rot: it.rot || 0,
        mount: it.mount ? { part: it.mount.part, dx: it.mount.dx || 0, dy: it.mount.dy || 0 } : null
      };
    });
  }

  function hydrateStickerItems(list) {
    S.selSticker = null;
    S.stickerItems = (Array.isArray(list) ? list : []).filter(function (raw) {
      if (!raw || (raw.t === 'img' ? typeof raw.src !== 'string' || !raw.src : !findSticker(raw.ref))) return false;
      return true;
    }).slice(0, ST_MAX).map(function (raw) {
      var it = {
        uid: raw.uid || uid(),
        t: raw.t === 'img' ? 'img' : 'b',
        ref: raw.ref || null, src: raw.src || null, pixel: !!raw.pixel,
        name: String(raw.name || '').slice(0, 8),
        x: clampPct(raw.x), y: clampPct(raw.y), scale: clampScale(raw.scale), rot: clampRot(raw.rot)
      };
      // v1.10.0：恢复挂载信息（部位 id 非法时丢弃，回退为自由摆放）
      var mp = raw.mount && mountPartId(raw.mount.part);
      if (mp) it.mount = { part: mp, dx: clampMountOff(raw.mount.dx), dy: clampMountOff(raw.mount.dy) };
      if (it.t === 'img') {
        var img = new Image();
        img.onload = function () { repaint(); rebuildStickerList(); };
        img.src = it.src;
        it.img = img;
      } else {
        var def = findSticker(it.ref);
        it.name = it.name || (def ? def.label : '贴纸');
      }
      return it;
    });
  }

  function loadStickers() {
    var rec = null;
    try { rec = JSON.parse(localStorage.getItem(ST_KEY) || 'null'); } catch (e) { rec = null; }
    if (!rec) return;
    hydrateStickerItems(rec.items || rec);
  }

  function saveStickers() {
    try {
      localStorage.setItem(ST_KEY, JSON.stringify({ v: 1, items: serializableStickers() }));
      return true;
    } catch (e) {
      if (!stSaveWarned) {
        stSaveWarned = true;
        toast('本机存储空间不足，贴纸刷新后可能丢失');
      }
      return false;
    }
  }
  function saveStickersSoon() {
    clearTimeout(saveStickersSoon._t);
    saveStickersSoon._t = setTimeout(saveStickers, 260);
  }

  /* ---------------- 贴纸：上传图片 ---------------- */
  function openStickerPicker() {
    if (!stEl.file) return;
    stEl.file.value = '';   // 允许重复选同一张图
    stEl.file.click();
  }

  function applyStickerFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('请选择图片文件（JPG / PNG / WebP）'); return; }
    if (S.stickerItems.length >= ST_MAX) { toast('画布贴纸最多 ' + ST_MAX + ' 个，先删掉一些'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var raw = new Image();
      raw.onload = function () {
        var sc = Math.min(1, ST_IMG_MAX / Math.max(raw.naturalWidth, raw.naturalHeight));
        var cw = Math.max(1, Math.round(raw.naturalWidth * sc));
        var ch = Math.max(1, Math.round(raw.naturalHeight * sc));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var c = cv.getContext('2d');
        c.drawImage(raw, 0, 0, cw, ch);
        var data = null;
        try {
          // 带透明像素存 PNG，普通照片存 JPEG（体积小，避免撑爆 localStorage）
          data = cv.toDataURL(hasAlphaPixels(c, cw, ch) ? 'image/png' : 'image/jpeg', .9);
        } catch (e) { data = null; }
        var name = file.name.replace(/\.\w+$/, '').slice(0, 8) || '图片';
        var it = { uid: uid(), t: 'img', src: data, pixel: false, name: name, x: 50, y: 50, scale: 1, rot: 0, img: cv };
        S.stickerItems.push(it);
        S.selSticker = it.uid;
        stickerChanged();
        toast(data ? '已添加贴纸「' + name + '」' : '已添加贴纸（本机存储不可用，刷新会丢失）');
      };
      raw.onerror = function () { toast('这张图片打不开，换一张试试'); };
      raw.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- 贴纸：列表与控制面板 ---------------- */
  function rebuildStickerList() {
    if (!stEl.list) return;
    stEl.list.innerHTML = '';
    if (!S.stickerItems.length) {
      var p = document.createElement('p');
      p.className = 'st-empty';
      p.textContent = '画布上还没有贴纸：点上方任意一款添加。';
      stEl.list.appendChild(p);
      return;
    }
    S.stickerItems.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-chip' + (it.uid === S.selSticker ? ' active' : '');
      var mountDef = it.mount ? partDef(it.mount.part) : null;
      b.title = (it.name || '贴纸') + ' · 第 ' + (i + 1) + ' 层（由底到顶）'
        + (mountDef ? ' · 已挂载：' + mountDef.label : '');
      var cv = thumbCanvas(44);
      drawStickerThumbOf(cv.getContext('2d'), it, 44);
      b.appendChild(cv);
      var lab = document.createElement('span');
      lab.textContent = (mountDef ? '📌' : '') + (it.name || '贴纸');
      b.appendChild(lab);
      b.onclick = function () { selectSticker(it.uid); };
      stEl.list.appendChild(b);
    });
  }

  function syncStickerCtl() {
    if (!stEl.ctl) return;
    var it = selStickerItem();
    stEl.ctl.classList.toggle('hidden', !it);
    if (!it) return;
    stEl.name.textContent = it.name || '贴纸';
    var m = it.mount, def = m ? partDef(m.part) : null;
    // 挂载式：显示偏移滑杆；自由式：显示画布位置滑杆
    if (stEl.xItem) stEl.xItem.classList.toggle('hidden', !!m);
    if (stEl.yItem) stEl.yItem.classList.toggle('hidden', !!m);
    if (stEl.dxItem) stEl.dxItem.classList.toggle('hidden', !m);
    if (stEl.dyItem) stEl.dyItem.classList.toggle('hidden', !m);
    if (stEl.mount) {
      if (stEl.mount.value !== (m ? m.part : '')) stEl.mount.value = m ? m.part : '';
      stEl.mountVal.textContent = def ? def.label : '自由摆放';
    }
    if (m) {
      stEl.dx.value = m.dx || 0;
      stEl.dy.value = m.dy || 0;
      stEl.dxVal.textContent = String(m.dx || 0);
      stEl.dyVal.textContent = String(m.dy || 0);
    } else {
      stEl.x.value = Math.round(it.x);
      stEl.y.value = Math.round(it.y);
      stEl.xVal.textContent = Math.round(it.x) + '%';
      stEl.yVal.textContent = Math.round(it.y) + '%';
    }
    stEl.scale.value = it.scale || 1;
    stEl.rot.value = Math.round(it.rot || 0);
    stEl.scaleVal.textContent = (it.scale || 1).toFixed(2) + '×';
    stEl.rotVal.textContent = Math.round(it.rot || 0) + '°';
  }

  function stBind() {
    stEl.file = document.getElementById('stickerFile');
    stEl.list = document.getElementById('stickerList');
    stEl.ctl = document.getElementById('stickerCtl');
    stEl.name = document.getElementById('stickerSelName');
    stEl.x = document.getElementById('stX'); stEl.xVal = document.getElementById('stXVal');
    stEl.y = document.getElementById('stY'); stEl.yVal = document.getElementById('stYVal');
    stEl.xItem = document.getElementById('stXItem'); stEl.yItem = document.getElementById('stYItem');
    stEl.dx = document.getElementById('stDx'); stEl.dxVal = document.getElementById('stDxVal');
    stEl.dy = document.getElementById('stDy'); stEl.dyVal = document.getElementById('stDyVal');
    stEl.dxItem = document.getElementById('stDxItem'); stEl.dyItem = document.getElementById('stDyItem');
    stEl.mount = document.getElementById('stMount'); stEl.mountVal = document.getElementById('stMountVal');
    stEl.scale = document.getElementById('stScale'); stEl.scaleVal = document.getElementById('stScaleVal');
    stEl.rot = document.getElementById('stRot'); stEl.rotVal = document.getElementById('stRotVal');

    // 挂载部位下拉：自由摆放 + 全部可选部位
    if (stEl.mount) {
      var optFree = document.createElement('option');
      optFree.value = ''; optFree.textContent = '自由摆放（画布坐标）';
      stEl.mount.appendChild(optFree);
      PART_DEFS.forEach(function (d) {
        var o = document.createElement('option');
        o.value = d.id; o.textContent = d.label;
        stEl.mount.appendChild(o);
      });
      stEl.mount.addEventListener('change', function () {
        var it = selStickerItem();
        if (!it) return;
        setStickerMount(it, stEl.mount.value);
      });
    }

    stEl.file.onchange = function () {
      var f = stEl.file.files && stEl.file.files[0];
      if (f) applyStickerFile(f);
      stEl.file.value = '';
    };
    [['x', 'x'], ['y', 'y'], ['scale', 'scale'], ['rot', 'rot']].forEach(function (pair) {
      var input = stEl[pair[0]];
      input.addEventListener('input', function () {
        var it = selStickerItem();
        if (!it) return;
        if (pair[1] === 'x') it.x = clampPct(input.value);
        else if (pair[1] === 'y') it.y = clampPct(input.value);
        else if (pair[1] === 'scale') it.scale = clampScale(input.value);
        else it.rot = clampRot(input.value);
        syncStickerCtl();
        repaint();
      });
      input.addEventListener('change', function () { saveStickersSoon(); });
    });
    // 挂载偏移滑杆（v1.10.0）
    [['dx', 'dx'], ['dy', 'dy']].forEach(function (pair) {
      var input = stEl[pair[0]];
      input.addEventListener('input', function () {
        var it = selStickerItem();
        if (!it || !it.mount) return;
        it.mount[pair[1]] = clampMountOff(input.value);
        syncStickerCtl();
        repaint();
      });
      input.addEventListener('change', function () { saveStickersSoon(); });
    });
    document.getElementById('stickerDeselect').onclick = function () { selectSticker(null); };
    document.getElementById('stickerDelete').onclick = deleteSelectedSticker;
    document.getElementById('stickerClear').onclick = clearStickers;
    [].forEach.call(document.querySelectorAll('#stickerCtl .sticker-layer button'), function (b) {
      b.onclick = function () { layerSticker(b.dataset.v); };
    });
  }

  /* ---------------- 贴纸画板（32 × 32） ---------------- */
  var SE_COLORS = GRID_PALETTE;   // v1.9.1：与表情画板共用 20 色板
  var SE_W = 32, SE_H = 32, SE_CELL = 15;
  var SE = { W: SE_W, H: SE_H, cells: [], color: SE_COLORS[0][0], tool: 'pen', size: 1, mirror: false, undo: [], drawing: false, last: null };
  var seEl = {};

  function seBind() {
    seEl.modal = document.getElementById('stickerEditor');
    seEl.canvas = document.getElementById('seCanvas');
    seEl.preview = document.getElementById('sePreview');
    seEl.name = document.getElementById('seName');
    seEl.tools = document.getElementById('seTools');
    seEl.sizeWrap = document.getElementById('seSize');
    seEl.palette = document.getElementById('seColors');
    seEl.mirror = document.getElementById('seMirror');
    seEl.custom = document.getElementById('seCustom');
    seEl.colorInput = document.getElementById('seColor');
    seEl.screen = document.getElementById('seScreen');
    seEl.hex = document.getElementById('seHex');
    seEl.hexVal = document.getElementById('seHexVal');

    SE_COLORS.forEach(function (pair) {
      var sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'fe-sw'; sw.dataset.c = pair[0];
      sw.style.setProperty('--c', pair[0]); sw.title = pair[1];
      sw.onclick = function () { seApplyColor(pair[0], true); };
      seEl.palette.appendChild(sw);
    });
    seEl.custom.onclick = function () {
      seEl.colorInput.value = seCurrentHex();
      seEl.colorInput.click();
    };
    seEl.colorInput.addEventListener('input', function () { seApplyColor(seEl.colorInput.value, true); });
    seEl.screen.onclick = function () { screenPickColor(function (hex) { seApplyColor(hex, false); }); };
    [].forEach.call(seEl.tools.querySelectorAll('.fe-tool'), function (b) {
      b.onclick = function () { SE.tool = b.dataset.tool; seSyncTools(); };
    });
    [].forEach.call(seEl.sizeWrap.querySelectorAll('.fe-size'), function (b) {
      b.onclick = function () { SE.size = +b.dataset.s; seSyncTools(); };
    });
    seEl.mirror.onchange = function () { SE.mirror = seEl.mirror.checked; };

    seEl.canvas.addEventListener('pointerdown', function (e) {
      var p = gridCellAt(seEl.canvas, e, SE_W, SE_H);
      if (!p) return;
      e.preventDefault();
      if (SE.tool === 'pick') {                      // v1.9.1：画板吸管
        var got = gridPickCell(SE, p[0], p[1]);
        if (got) { seSyncTools(); toast('已拾取颜色 ' + got); }
        else toast('这一格是透明的，换一格再吸');
        return;
      }
      seEl.canvas.setPointerCapture(e.pointerId);
      gridPushUndo(SE);
      if (SE.tool === 'fill') {
        gridFlood(SE, p[0], p[1], SE.color);
      } else {
        SE.drawing = true; SE.last = p;
        gridStamp(SE, p[0], p[1]);
      }
      sePaintUpdate();
    });
    seEl.canvas.addEventListener('pointermove', function (e) {
      if (!SE.drawing) return;
      var p = gridCellAt(seEl.canvas, e, SE_W, SE_H);
      if (!p) return;
      if (SE.last) gridLine(SE, SE.last[0], SE.last[1], p[0], p[1]);
      SE.last = p;
      sePaintUpdate();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      seEl.canvas.addEventListener(t, function () { SE.drawing = false; SE.last = null; });
    });

    document.getElementById('seClose').onclick = closeStickerEditor;
    document.getElementById('seUndo').onclick = function () {
      if (!SE.undo.length) return;
      SE.cells = SE.undo.pop();
      sePaintUpdate();
    };
    document.getElementById('seClear').onclick = function () {
      gridPushUndo(SE);
      SE.cells = gridBlank(SE_W, SE_H);
      sePaintUpdate();
    };
    document.getElementById('seSave').onclick = seSave;
    seEl.modal.addEventListener('click', function (e) { if (e.target === seEl.modal) closeStickerEditor(); });
    document.addEventListener('keydown', function (e) {
      if (seEl.modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeStickerEditor();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (SE.undo.length) { SE.cells = SE.undo.pop(); sePaintUpdate(); }
      }
    });
  }

  function seSyncTools() {
    [].forEach.call(seEl.tools.querySelectorAll('.fe-tool'), function (b) {
      b.classList.toggle('active', b.dataset.tool === SE.tool);
    });
    [].forEach.call(seEl.sizeWrap.querySelectorAll('.fe-size'), function (b) {
      b.classList.toggle('active', +b.dataset.s === SE.size);
    });
    [].forEach.call(seEl.palette.children, function (b) {
      b.classList.toggle('active', b.dataset.c === SE.color);
    });
    if (seEl.hex) {
      seEl.hex.style.setProperty('--c', seCurrentHex());
      seEl.hexVal.textContent = seCurrentHex();
    }
  }
  function seCurrentHex() { return isHexColor(SE.color) ? SE.color : SE_COLORS[0][0]; }
  function seApplyColor(hex, quiet) {
    SE.color = gridSafeColor(hex, SE_COLORS[0][0]);
    if (SE.tool === 'eraser' || SE.tool === 'pick') SE.tool = 'pen';
    if (seEl.colorInput) seEl.colorInput.value = SE.color;
    seSyncTools();
    if (!quiet) toast('已取到颜色 ' + SE.color);
  }

  function openStickerEditor() {
    SE.cells = gridBlank(SE_W, SE_H);
    SE.undo = [];
    SE.tool = 'pen'; SE.size = 1; SE.mirror = false;
    SE.color = SE_COLORS[0][0];
    SE.drawing = false; SE.last = null;
    if (!seEl.modal) seBind();
    seEl.name.value = '';
    seEl.colorInput.value = SE.color;
    seEl.mirror.checked = false;
    seEl.modal.classList.remove('hidden');
    seSyncTools();
    sePaintUpdate();
    setTimeout(function () { seEl.name.focus(); }, 30);
  }

  function closeStickerEditor() {
    if (!seEl.modal) return;
    seEl.modal.classList.add('hidden');
    SE.drawing = false; SE.last = null;
  }

  function sePaintUpdate() {
    gridRender(SE, seEl.canvas, SE_CELL, false);
    sePreview();
  }

  function sePreview() {
    var cv = seEl.preview, c = cv.getContext('2d');
    var w = cv.width, h = cv.height, sq = 12;
    c.clearRect(0, 0, w, h);
    for (var y = 0; y < h; y += sq) for (var x = 0; x < w; x += sq) {
      c.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#151b1f' : '#0f1417';
      c.fillRect(x, y, sq, sq);
    }
    var tmp = document.createElement('canvas');
    tmp.width = SE_W; tmp.height = SE_H;
    var tc = tmp.getContext('2d');
    for (var yy = 0; yy < SE_H; yy++) for (var xx = 0; xx < SE_W; xx++) {
      var col = SE.cells[yy * SE_W + xx];
      if (col) { tc.fillStyle = col; tc.fillRect(xx, yy, 1, 1); }
    }
    var box = Math.min(w, h) - 24;
    c.imageSmoothingEnabled = false;
    c.drawImage(tmp, (w - box) / 2, (h - box) / 2, box, box);
  }

  function seSave() {
    var label = (seEl.name.value || '').trim().slice(0, 8) || '我的贴纸';
    var ink = false;
    for (var i = 0; i < SE.cells.length; i++) if (SE.cells[i]) { ink = true; break; }
    if (!ink) { toast('画板还是空的，先画点东西'); return; }
    if (S.stickerItems.length >= ST_MAX) { toast('画布贴纸最多 ' + ST_MAX + ' 个，先删掉一些'); return; }
    var cv = document.createElement('canvas');
    cv.width = SE_W; cv.height = SE_H;
    var c = cv.getContext('2d');
    for (var y = 0; y < SE_H; y++) for (var x = 0; x < SE_W; x++) {
      var col = SE.cells[y * SE_W + x];
      if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    }
    var src = null;
    try { src = cv.toDataURL('image/png'); } catch (e) { src = null; }
    var it = { uid: uid(), t: 'img', src: src, pixel: true, name: label, x: 50, y: 50, scale: 1, rot: 0, img: cv };
    S.stickerItems.push(it);
    S.selSticker = it.uid;
    closeStickerEditor();
    stickerChanged();
    toast(src ? '已添加贴纸「' + label + '」' : '已添加贴纸（本机存储不可用，刷新会丢失）');
  }

  /* ---------------- 状态切换 ---------------- */
  function setActive(groupEl, v) {
    [].forEach.call(groupEl.children, function (c) {
      c.classList.toggle('active', c.dataset.v === v);
    });
  }
  function setPose(id) {
    S.pose = id;
    if (RIG_POSES[id]) { S.rig = rigClone(RIG_POSES[id].rig); syncRigUI(); }
    setActive(document.getElementById('poseProc'), id); repaint();
  }
  function setFace(id) { S.face = id; setActive(document.getElementById('faceGrid'), id); repaint(); }
  function setBg(id) { S.bg = id; setActive(document.getElementById('bgGrid'), id); repaint(); }
  function setTextPos(v) {
    S.text.pos = v;
    [].forEach.call(document.getElementById('textPos').children, function (c) { c.classList.toggle('active', c.dataset.v === v); });
  }
  function setTextStyle(v) {
    S.text.style = v;
    [].forEach.call(document.getElementById('textStyle').children, function (c) { c.classList.toggle('active', c.dataset.v === v); });
  }
  function applyPreset(p) {
    S.pose = p.pose; S.face = p.face; S.bg = p.bg;
    S.text = JSON.parse(JSON.stringify(p.text));
    S.stickerItems = presetStickerItems(p.stickers);
    S.selSticker = null;
    document.getElementById('textInput').value = S.text.content;
    document.getElementById('textSize').value = S.text.size;
    setTextPos(S.text.pos); setTextStyle(S.text.style);
    setActive(document.getElementById('textColor'), S.text.color);
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    rebuildStickerList();
    syncStickerCtl();
    repaint();
    saveStickersSoon();
    toast('已应用套系「' + p.label + '」');
  }

  /* ---------------- 骨骼滑杆与画布拖拽 ---------------- */
  var RIG_DEFS = [
    ['bodyYaw', '身体 · 左右转', -50, 50], ['bodyPitch', '身体 · 前后倾', -25, 25], ['bodyRoll', '身体 · 侧倾', -20, 20],
    ['headYaw', '头 · 左右转', -40, 40], ['headPitch', '头 · 点头', -25, 25],
    ['lArmSide', '左臂 · 侧摆', 0, 170], ['lArmFront', '左臂 · 前后摆', -70, 70],
    ['rArmSide', '右臂 · 侧摆', 0, 170], ['rArmFront', '右臂 · 前后摆', -70, 70],
    ['lLegSide', '左腿 · 侧摆', 0, 60], ['lLegFront', '左腿 · 前后摆', -45, 45],
    ['rLegSide', '右腿 · 侧摆', 0, 60], ['rLegFront', '右腿 · 前后摆', -45, 45]
  ];
  var rigInputs = {};
  function buildRigUI() {
    var grid = document.getElementById('rigSliders');
    RIG_DEFS.forEach(function (d) {
      var wrap = document.createElement('div');
      wrap.className = 'rig-item';
      var lab = document.createElement('label');
      var name = document.createElement('span'); name.textContent = d[1];
      var val = document.createElement('b'); val.textContent = '0°';
      lab.appendChild(name); lab.appendChild(val);
      var input = document.createElement('input');
      input.type = 'range'; input.min = d[2]; input.max = d[3]; input.step = 1; input.value = 0;
      input.addEventListener('input', function () {
        if (!S.rig) S.rig = rigClone(REST_RIG);
        S.rig[d[0]] = +input.value;
        val.textContent = input.value + '°';
        repaint();
      });
      wrap.appendChild(lab); wrap.appendChild(input);
      grid.appendChild(wrap);
      rigInputs[d[0]] = { input: input, val: val };
    });
    document.getElementById('btnRigZero').onclick = function () {
      S.rig = rigClone(REST_RIG);
      syncRigUI();
      repaint();
    };
  }
  function syncRigUI() {
    var rig = S.rig || REST_RIG;
    RIG_DEFS.forEach(function (d) {
      var v = rig[d[0]] || 0;
      rigInputs[d[0]].input.value = v;
      rigInputs[d[0]].val.textContent = Math.round(v) + '°';
    });
  }

  /* ---------------- 指定部位调整（v1.7.0） ---------------- */
  var PART_SLIDER_DEFS = [
    ['scale', '整体尺寸', 0.5, 1.6, 0.05],
    ['rx', '绕 X 轴旋转', -180, 180, 1], ['ry', '绕 Y 轴旋转', -180, 180, 1], ['rz', '绕 Z 轴旋转', -180, 180, 1],
    ['x', '局部 X 位移', -120, 120, 1], ['y', '局部 Y 位移', -120, 120, 1], ['z', '局部 Z 位移', -120, 120, 1]
  ];
  var partInputs = {};
  function partDef(id) {
    for (var i = 0; i < PART_DEFS.length; i++) if (PART_DEFS[i].id === id) return PART_DEFS[i];
    return null;
  }
  function partValueText(key, v) {
    if (key === 'scale') return (+v).toFixed(2) + '×';
    if (key === 'rx' || key === 'ry' || key === 'rz') return Math.round(v) + '°';
    return String(Math.round(v));
  }
  function selectPart(id, reveal) {
    if (id && !partDef(id)) return;
    S.selPart = id || null;
    syncPartUI();
    if (reveal) activateTab('part');
    repaint();
  }
  function buildPartUI() {
    var chips = document.getElementById('partChips');
    PART_DEFS.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.part = d.id; b.textContent = d.label;
      b.onclick = function () { selectPart(d.id); };
      chips.appendChild(b);
    });
    var grid = document.getElementById('partSliders');
    PART_SLIDER_DEFS.forEach(function (d) {
      var wrap = document.createElement('div'); wrap.className = 'rig-item';
      var lab = document.createElement('label');
      var name = document.createElement('span'); name.textContent = d[1];
      var val = document.createElement('b');
      lab.appendChild(name); lab.appendChild(val);
      var input = document.createElement('input');
      input.type = 'range'; input.min = d[2]; input.max = d[3]; input.step = d[4];
      input.addEventListener('input', function () {
        if (!S.selPart) return;
        var v = +input.value;
        S.parts[S.selPart][d[0]] = v;
        val.textContent = partValueText(d[0], v);
        document.getElementById('partReset').disabled = isPartRest(S.parts[S.selPart]);
        syncPartResetState();
        repaint();
      });
      wrap.appendChild(lab); wrap.appendChild(input); grid.appendChild(wrap);
      partInputs[d[0]] = { input: input, val: val };
    });
    document.getElementById('partDeselect').onclick = function () { selectPart(null); };
    document.getElementById('partReset').onclick = function () {
      if (!S.selPart) return;
      S.parts[S.selPart] = partClone();
      syncPartUI(); repaint();
    };
    document.getElementById('partAllReset').onclick = function () {
      if (!window.confirm('确定将所有部位的尺寸、角度和位移恢复默认吗？')) return;
      S.parts = createPartStates();
      syncPartUI(); repaint();
    };
    syncPartUI();
  }
  function syncPartResetState() {
    var allRest = PART_DEFS.every(function (d) { return isPartRest(S.parts[d.id]); });
    document.getElementById('partAllReset').disabled = allRest;
  }
  function syncPartUI() {
    if (!partInputs.scale) return;
    var id = S.selPart, def = partDef(id), p = id ? S.parts[id] : null;
    document.getElementById('partSelName').textContent = def ? def.label : '未选择部位';
    document.getElementById('partDeselect').disabled = !id;
    document.getElementById('partReset').disabled = !id || isPartRest(p);
    [].forEach.call(document.getElementById('partChips').children, function (b) {
      b.classList.toggle('active', b.dataset.part === id);
    });
    PART_SLIDER_DEFS.forEach(function (d) {
      var ref = partInputs[d[0]], v = p ? p[d[0]] : PART_REST[d[0]];
      ref.input.disabled = !p; ref.input.value = v;
      ref.val.textContent = partValueText(d[0], v);
    });
    syncPartResetState();
  }

  /* ---------------- 全身体型面板（v1.8.0） ---------------- */
  var BODY_KEY = 'traeEmoji.body.v1';          // 当前体型比例
  var BODY_SAVED_KEY = 'traeEmoji.bodySaved.v1'; // 命名保存的体型列表
  var BODY_SAVED_MAX = 12;
  var BODY_SLIDER_DEFS = [
    ['headW', '头部 · 宽', .7, 1.4, .01], ['headH', '头部 · 高', .7, 1.4, .01], ['headD', '头部 · 深', .7, 1.4, .01],
    ['screen', '屏幕 · 占比', .6, 1.12, .01],
    ['torsoW', '躯干 · 宽', .7, 1.4, .01], ['torsoH', '躯干 · 长', .7, 1.4, .01],
    ['limb', '四肢 · 粗细', .6, 1.6, .01], ['armLen', '手臂 · 长度', .7, 1.35, .01],
    ['legLen', '腿 · 长度', .7, 1.35, .01], ['foot', '脚掌 · 长度', .7, 1.5, .01]
  ];
  // 预设只写与官方标准的偏差项（缺省 = 1）；官方标准为默认档
  var BODY_PRESETS = [
    { id: 'official', label: '官方标准', f: {} },
    { id: 'chibi', label: 'Q版大头', f: { headW: 1.18, headH: 1.1, headD: 1.12, screen: 1.02,
      torsoW: .92, torsoH: .84, limb: .9, armLen: .86, legLen: .8, foot: .88 } },
    { id: 'tall', label: '高挑细身', f: { headW: .95, headH: .92, headD: .95, screen: .96,
      torsoW: .9, torsoH: 1.12, limb: .92, armLen: 1.12, legLen: 1.3, foot: 1.06 } },
    { id: 'strong', label: '壮实魁梧', f: { headW: .96, headH: .98, torsoW: 1.26, torsoH: 1.06,
      limb: 1.42, armLen: 1.02, legLen: .98, foot: 1.16 } },
    { id: 'mini', label: '迷你袖珍', f: { headW: .88, headH: .88, headD: .88, torsoW: .86, torsoH: .86,
      limb: .86, armLen: .86, legLen: .86, foot: .86 } },
    { id: 'bigscreen', label: '大屏旗舰', f: { headW: 1.1, headH: 1.06, headD: 1.04, screen: 1.12,
      torsoW: 1.04, limb: 1.05, armLen: 1.05, foot: 1.04 } },
    { id: 'longleg', label: '长腿仔', f: { headW: .98, headH: .96, legLen: 1.34, torsoH: .9, torsoW: .94,
      limb: .94, armLen: 1.06, foot: 1.12 } },
    { id: 'blocky', label: '方块厚实', f: { headW: 1.14, headH: 1.14, headD: 1.14,
      torsoW: 1.12, torsoH: 1.12, limb: 1.12, foot: 1.05 } }
  ];
  var bodySaved = [];       // [{ name, f }]：命名保存的体型
  var bodyInputs = {};
  var bodyEl = {};
  var bodyThumbTimer = 0;

  function loadBody() {
    try {
      var raw = localStorage.getItem(BODY_KEY);
      if (raw) S.body = bodySanitize(bodyClone(JSON.parse(raw)));
    } catch (e) { /* 存储不可用则用默认值 */ }
    applyBody(S.body);
  }
  function saveBody() {
    try { localStorage.setItem(BODY_KEY, JSON.stringify(S.body)); } catch (e) { }
  }
  function loadBodySaved() {
    bodySaved = [];
    try {
      var raw = localStorage.getItem(BODY_SAVED_KEY);
      (JSON.parse(raw) || []).forEach(function (rec) {
        if (rec && typeof rec.name === 'string' && rec.name.trim()) {
          bodySaved.push({ name: rec.name.trim().slice(0, 12), f: bodySanitize(bodyClone(rec.f)) });
        }
      });
    } catch (e) { /* 存储不可用则留空 */ }
  }
  function persistBodySaved() {
    try { localStorage.setItem(BODY_SAVED_KEY, JSON.stringify(bodySaved.slice(0, BODY_SAVED_MAX))); } catch (e) { }
  }

  // 体型变化：派生几何 → 存本机 → 同步面板 → 重绘 → 防抖刷新 10 张姿势缩略图
  function bodyChanged(label) {
    applyBody(S.body);
    saveBody();
    syncBodyUI();
    repaint();
    clearTimeout(bodyThumbTimer);
    bodyThumbTimer = setTimeout(refreshPoseThumbs, 160);
    if (label) toast('已应用体型「' + label + '」');
  }
  function applyBodyPreset(p) {
    S.body = bodySanitize(bodyClone(p.f));
    bodyChanged(p.label);
  }
  // 随机体型：各项在 0.78 ~ 1.28 之间独立抽取（不越过滑杆范围，避免极端组合）
  function randomBody() {
    var f = bodyClone();
    BODY_SLIDER_DEFS.forEach(function (d) {
      var lo = Math.max(d[2], .78), hi = Math.min(d[3], 1.28);
      f[d[0]] = Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;
    });
    S.body = f;
    bodyChanged('随机');
  }
  function saveCurrentBody() {
    var name = (bodyEl.name.value || '').trim();
    if (!name) { toast('先给体型起个名字'); bodyEl.name.focus(); return; }
    saveBodyNamed(name, bodyClone(S.body));
    bodyEl.name.value = '';
    toast('已保存体型「' + name + '」');
  }
  function saveBodyNamed(name, f) {
    for (var i = 0; i < bodySaved.length; i++) {
      if (bodySaved[i].name === name) { bodySaved[i].f = bodySanitize(bodyClone(f)); persistBodySaved(); rebuildBodySavedUI(); syncBodyUI(); return; }
    }
    bodySaved.unshift({ name: name, f: bodySanitize(bodyClone(f)) });
    if (bodySaved.length > BODY_SAVED_MAX) bodySaved.length = BODY_SAVED_MAX;
    persistBodySaved();
    rebuildBodySavedUI();
    syncBodyUI();
  }
  function rebuildBodySavedUI() {
    var wrap = document.getElementById('bodySaved');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!bodySaved.length) {
      var tip = document.createElement('span');
      tip.className = 'body-saved-empty';
      tip.textContent = '还没有保存的体型';
      wrap.appendChild(tip);
      return;
    }
    bodySaved.forEach(function (rec) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.title = '点击应用「' + rec.name + '」';
      var lab = document.createElement('span'); lab.textContent = rec.name;
      var del = document.createElement('i'); del.className = 'chip-del'; del.textContent = '✕'; del.title = '删除';
      del.onclick = function (e) {
        e.stopPropagation();
        bodySaved.splice(bodySaved.indexOf(rec), 1);
        persistBodySaved(); rebuildBodySavedUI(); syncBodyUI();
      };
      b.appendChild(lab); b.appendChild(del);
      b.onclick = function () { S.body = bodySanitize(bodyClone(rec.f)); bodyChanged(rec.name); };
      wrap.appendChild(b);
    });
  }
  // 导出：JSON 文件（含版本与名称，便于分享）
  function exportBody() {
    var data = { v: 1, app: 'traeEmoji', name: '我的体型', f: bodyClone(S.body) };
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'TRAE宝-体型.json');
  }
  // 导入：应用 + 存入「我的体型」；比例一律按滑杆范围钳制
  function importBodyFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        var f = d && (d.f || d.body);
        if (!f || typeof f !== 'object') throw new Error('缺少体型参数 f');
        S.body = bodySanitize(bodyClone(f));
        var name = d && typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 12) : '导入的体型';
        saveBodyNamed(name, S.body);
        bodyChanged(name);
      } catch (err) { toast('导入失败：' + (err && err.message || '文件格式不正确')); }
    };
    rd.onerror = function () { toast('导入失败：文件读取错误'); };
    rd.readAsText(file);
  }
  function buildBodyUI() {
    var grid = document.getElementById('bodySliders');
    BODY_SLIDER_DEFS.forEach(function (d) {
      var wrap = document.createElement('div'); wrap.className = 'rig-item';
      var lab = document.createElement('label');
      var name = document.createElement('span'); name.textContent = d[1];
      var val = document.createElement('b'); val.textContent = '×1.00';
      lab.appendChild(name); lab.appendChild(val);
      var input = document.createElement('input');
      input.type = 'range'; input.min = d[2]; input.max = d[3]; input.step = d[4]; input.value = 1;
      input.addEventListener('input', function () {
        S.body[d[0]] = +input.value;
        val.textContent = '×' + (+input.value).toFixed(2);
        bodyChanged();
      });
      wrap.appendChild(lab); wrap.appendChild(input);
      grid.appendChild(wrap);
      bodyInputs[d[0]] = { input: input, val: val };
    });
    var pres = document.getElementById('bodyPresets');
    BODY_PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.v = p.id; b.textContent = p.label;
      b.onclick = function () { applyBodyPreset(p); };
      pres.appendChild(b);
    });
    var rnd = document.createElement('button');
    rnd.type = 'button'; rnd.className = 'chip'; rnd.dataset.v = 'random'; rnd.textContent = '🎲 随机体型';
    rnd.onclick = randomBody;
    pres.appendChild(rnd);
    bodyEl.official = document.getElementById('bodyOfficial');
    bodyEl.official.onclick = function () { S.body = bodyClone(); bodyChanged('官方标准'); };
    bodyEl.name = document.getElementById('bodyName');
    document.getElementById('bodySaveBtn').onclick = saveCurrentBody;
    document.getElementById('bodyExport').onclick = exportBody;
    bodyEl.file = document.getElementById('bodyFile');
    document.getElementById('bodyImport').onclick = function () { bodyEl.file.value = ''; bodyEl.file.click(); };
    bodyEl.file.addEventListener('change', function () {
      if (this.files && this.files[0]) importBodyFile(this.files[0]);
    });
    rebuildBodySavedUI();
    syncBodyUI();
  }
  function syncBodyUI() {
    if (!bodyEl.official) return;   // 面板尚未构建
    BODY_SLIDER_DEFS.forEach(function (d) {
      var it = bodyInputs[d[0]], v = S.body[d[0]];
      it.input.value = v;
      it.val.textContent = '×' + (+v).toFixed(2);
    });
    [].forEach.call(document.getElementById('bodyPresets').children, function (b) {
      var active = false;
      for (var i = 0; i < BODY_PRESETS.length; i++) {
        if (BODY_PRESETS[i].id !== b.dataset.v) continue;
        active = bodyEq(S.body, bodySanitize(bodyClone(BODY_PRESETS[i].f)));
        break;
      }
      b.classList.toggle('active', active);
    });
    bodyEl.official.disabled = bodyEq(S.body, BODY_REST);
  }

  /* ---------------- 肢体拖拽 · IK 反解 ---------------- */
  // 画布上直接拖手 / 脚：在屏幕空间做数值反解（粗网格 + 逐级细化），
  // 解出的两角度直接写回 S.rig（与 13 个滑杆共用同一份状态，互相同步）；
  // 拖头 = 朝向增量（headYaw / headPitch），不做位置反解。
  var ikDrag = null;    // 拖动中：{ def, offX, offY }
  var ikHover = null;   // 悬停 / 抓取中的手柄（IK_DEFS 项）
  var IK_ANCHOR = 0.02; // 反解惩罚项：同等命中时优先保留当前角度，避免拖动瞬间跳角

  function posedSkeleton(rig) {
    return updateSkeletonMatrices(buildSkeleton(rig || S.rig || REST_RIG));
  }

  // 顺序即拾取优先级（hitLimb 自后向前）：手 / 脚优先，头部最后，避免举手时抢走头部手柄
  var IK_DEFS = [
    { id: 'head', label: '头部', kind: 'head', keys: ['headYaw', 'headPitch'], r: 64 },
    { id: 'handL', label: '左手', kind: 'arm', sign: -1, keys: ['lArmSide', 'lArmFront'], r: 40 },
    { id: 'handR', label: '右手', kind: 'arm', sign: 1, keys: ['rArmSide', 'rArmFront'], r: 40 },
    { id: 'footL', label: '左脚', kind: 'leg', sign: -1, keys: ['lLegSide', 'lLegFront'], r: 44 },
    { id: 'footR', label: '右脚', kind: 'leg', sign: 1, keys: ['rLegSide', 'rLegFront'], r: 44 }
  ];
  function ikRange(key) {
    for (var i = 0; i < RIG_DEFS.length; i++) if (RIG_DEFS[i][0] === key) return [RIG_DEFS[i][2], RIG_DEFS[i][3]];
    return [-180, 180];
  }
  // 手柄位置（1024 基准画布坐标）
  function ikPos(def, rig, sk) {
    // IK 与实际渲染共用同一套部位矩阵，部位缩放 / 旋转 / 位移后手柄仍贴合目标。
    sk = sk || posedSkeleton(rig);
    var node = sk.nodes[def.id];
    if (def.kind === 'arm') return projectV(applyM(node._m, [0, 2, 0]));
    if (def.kind === 'leg') return projectV(applyM(node._m, [0, 8, 10]));
    return projectV(applyM(sk.head._m, [0, -GEO3D.headH / 2 + GEO3D.screenTopOff + GEO3D.screenH / 2,
      GEO3D.headD / 2 + GEO3D.bezelProtrude]));   // 屏幕面中心
  }
  function hitLimb(cx, cy) {
    var rig = S.rig || REST_RIG, sk = posedSkeleton(rig);
    for (var i = IK_DEFS.length - 1; i >= 0; i--) {
      var d = IK_DEFS[i], p = ikPos(d, rig, sk);
      if (Math.hypot(cx - p[0], cy - p[1]) <= d.r) return d;
    }
    return null;
  }
  function pointInPolygon(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if (((a[1] > y) !== (b[1] > y)) &&
          (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
    }
    return inside;
  }
  function hitPart(cx, cy) {
    var i, f, handId = null;
    // 颈部连接区默认被头 / 躯干遮住，给小代理区独立的拾取优先级。
    for (i = PART_FACE_CACHE.length - 1; i >= 0; i--) {
      f = PART_FACE_CACHE[i];
      if (f.part && f.pick && pointInPolygon(cx, cy, f.pts)) return f.part;
    }
    // 静止整臂代理会盖住手部投影：允许手部穿过「同侧上臂 / 前臂」代理被点选，
    // 但不能穿过更近的头 / 躯干等无关部位，避免把遮挡关系整体绕过。
    for (i = PART_FACE_CACHE.length - 1; i >= 0; i--) {
      f = PART_FACE_CACHE[i];
      if ((f.part === 'handL' || f.part === 'handR') && pointInPolygon(cx, cy, f.pts)) { handId = f.part; break; }
    }
    for (i = PART_FACE_CACHE.length - 1; i >= 0; i--) {
      f = PART_FACE_CACHE[i];
      if (!f.part || f.pick || !pointInPolygon(cx, cy, f.pts)) continue;
      if (handId && (f.part === 'arm' + handId.slice(-1) || f.part === 'forearm' + handId.slice(-1))) continue;
      return f.part;
    }
    return null;
  }
  // 两自由度屏幕空间反解：11×11 粗网格 + 7 轮 3×3 细化（约 180 次投影，单帧内可忽略）
  function ikSolve(def, tx, ty) {
    if (!S.rig) S.rig = rigClone(REST_RIG);
    var rig = S.rig, kA = def.keys[0], kB = def.keys[1];
    var rA = ikRange(kA), rB = ikRange(kB);
    var a0 = rig[kA] || 0, b0 = rig[kB] || 0;
    var bestA = a0, bestB = b0, bestD = Infinity;
    function test(a, b) {
      rig[kA] = a; rig[kB] = b;
      var p = ikPos(def, rig);
      var d = (p[0] - tx) * (p[0] - tx) + (p[1] - ty) * (p[1] - ty)
        + IK_ANCHOR * ((a - a0) * (a - a0) + (b - b0) * (b - b0));
      if (d < bestD - 1e-4) { bestD = d; bestA = a; bestB = b; }
    }
    test(a0, b0);   // 当前角度作为候选，保证「抓哪里就从哪里开始」，不会跳角
    var NA = 10, NB = 10, i, j;
    for (i = 0; i <= NA; i++) for (j = 0; j <= NB; j++)
      test(rA[0] + (rA[1] - rA[0]) * i / NA, rB[0] + (rB[1] - rB[0]) * j / NB);
    var spanA = (rA[1] - rA[0]) / NA, spanB = (rB[1] - rB[0]) / NB;
    for (var it = 0; it < 7; it++) {
      var ca = bestA, cb = bestB;
      for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) {
        test(Math.max(rA[0], Math.min(rA[1], ca + i * spanA)),
             Math.max(rB[0], Math.min(rB[1], cb + j * spanB)));
      }
      spanA *= 0.45; spanB *= 0.45;
    }
    rig[kA] = Math.max(rA[0], Math.min(rA[1], bestA));
    rig[kB] = Math.max(rB[0], Math.min(rB[1], bestB));
    return rig;
  }
  // 手柄高亮：只在预览层（ui=true）绘制，导出不含
  function drawIkOverlay(ctx, s) {
    var def = ikDrag ? ikDrag.def : ikHover;
    if (!def) return;
    var p = ikPos(def, S.rig || REST_RIG);
    var k = s / BASE;
    ctx.save();
    ctx.strokeStyle = 'rgba(115,249,154,.9)';
    ctx.lineWidth = Math.max(1.6, 2.4 * k);
    ctx.setLineDash([7 * k, 5 * k]);
    ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, def.r * k, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(115,249,154,.95)';
    ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, Math.max(1.4, 3 * k), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawPartOverlay(ctx, s) {
    if (!S.selPart) return;
    var k = s / BASE;
    ctx.save();
    ctx.strokeStyle = 'rgba(115,249,154,.96)';
    ctx.fillStyle = 'rgba(115,249,154,.09)';
    ctx.lineWidth = Math.max(1.8, 2.6 * k);
    ctx.setLineDash([8 * k, 5 * k]);
    PART_FACE_CACHE.forEach(function (f) {
      if (f.part !== S.selPart) return;
      ctx.beginPath();
      f.pts.forEach(function (p, i) {
        if (i) ctx.lineTo(p[0] * k, p[1] * k); else ctx.moveTo(p[0] * k, p[1] * k);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }
  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // 画布交互：优先拖动贴纸 → 拖手 / 脚 / 头（IK）→ 空白处拖动转身
  (function drag() {
    var mode = null, lx = 0, ly = 0, offX = 0, offY = 0;
    var pendingPart = null, moved = false, downX = 0, downY = 0;
    function toCanvas(e) {
      var r = stage.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * BASE, (e.clientY - r.top) / r.height * BASE];
    }
    function hitSticker(cx, cy) {
      for (var i = S.stickerItems.length - 1; i >= 0; i--) {   // 顶层优先
        var it = S.stickerItems[i];
        var xf = stickerXform(it);   // v1.10.0：挂载式贴纸按部位锚点 + 偏移命中
        var dx = cx - xf[0], dy = cy - xf[1];
        var box = stickerBoxUnit(it);
        var a = -xf[2] * Math.PI / 180;
        var ca = Math.cos(a), sa = Math.sin(a);
        var lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;   // 反向旋转到贴纸本地坐标
        var m = box[0] * xf[3] * 1.08, n = box[1] * xf[3] * 1.08;
        if (Math.abs(lx) <= m && Math.abs(ly) <= n) return it;
      }
      return null;
    }
    function isProc() { return !!PROC_POSES[S.pose]; }
    stage.addEventListener('pointerdown', function (e) {
      var p = toCanvas(e);
      pendingPart = null; moved = false; downX = e.clientX; downY = e.clientY;
      var hit = hitSticker(p[0], p[1]);
      if (hit) {
        e.preventDefault();
        selectSticker(hit.uid);
        mode = 'sticker';
        var hf = stickerXform(hit);   // v1.10.0：挂载式按当前投影中心算抓取偏移
        offX = p[0] - hf[0];
        offY = p[1] - hf[1];
        stage.setPointerCapture(e.pointerId);
        return;
      }
      if (S.selSticker) selectSticker(null);
      if (!isProc()) { repaint(); return; }
      kfExitView();   // v1.11.0：拖动身体 / 肢体前退出时间轴查看，IK 调整即时可见
      pendingPart = hitPart(p[0], p[1]);
      var limb = hitLimb(p[0], p[1]);
      if (limb) {
        e.preventDefault();
        if (!S.rig) S.rig = rigClone(REST_RIG);
        var hp = ikPos(limb, S.rig);
        ikDrag = { def: limb, offX: hp[0] - p[0], offY: hp[1] - p[1] };   // 抓取偏移，按下瞬间不跳
        ikHover = limb;
        mode = 'limb'; lx = e.clientX; ly = e.clientY;
        stage.setPointerCapture(e.pointerId);
        repaint();
        return;
      }
      mode = 'body'; lx = e.clientX; ly = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (mode && Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
      if (mode === 'sticker') {
        var it = selStickerItem();
        if (!it) return;
        var p = toCanvas(e);
        if (it.mount) {
          // v1.10.0：挂载式拖动 = 调整相对部位锚点的偏移（贴纸仍钉在部位上）
          var base = stickerMountBase(it) || [0, 0];
          it.mount.dx = clampMountOff(p[0] - offX - base[0]);
          it.mount.dy = clampMountOff(p[1] - offY - base[1]);
        } else {
          it.x = clampPct((p[0] - offX) / BASE * 100);
          it.y = clampPct((p[1] - offY) / BASE * 100);
        }
        syncStickerCtl();
        repaint();
        return;
      }
      if (mode === 'limb') {
        var d = ikDrag.def;
        if (d.kind === 'head') {   // 头：朝向增量（与身体拖动同一套手感，夹在点头范围内）
          if (!S.rig) S.rig = rigClone(REST_RIG);
          S.rig.headYaw = clampNum((S.rig.headYaw || 0) + (e.clientX - lx) * 0.3, -40, 40);
          S.rig.headPitch = clampNum((S.rig.headPitch || 0) + (e.clientY - ly) * 0.22, -25, 25);
          lx = e.clientX; ly = e.clientY;
        } else {
          var q = toCanvas(e);
          ikSolve(d, q[0] + ikDrag.offX, q[1] + ikDrag.offY);
        }
        syncRigUI();
        repaint();
        return;
      }
      if (mode === 'body') {
        if (!S.rig) S.rig = rigClone(REST_RIG);
        S.rig.bodyYaw = Math.max(-50, Math.min(50, S.rig.bodyYaw + (e.clientX - lx) * 0.35));
        S.rig.bodyPitch = Math.max(-25, Math.min(25, S.rig.bodyPitch + (e.clientY - ly) * 0.25));
        lx = e.clientX; ly = e.clientY;
        syncRigUI();
        repaint();
        return;
      }
      var q = toCanvas(e);
      var lim = isProc() ? hitLimb(q[0], q[1]) : null;
      if ((lim ? lim.id : null) !== (ikHover && ikHover.id)) { ikHover = lim; repaint(); }   // 悬停目标变化才重绘
      var partHover = !lim && isProc() ? hitPart(q[0], q[1]) : null;
      stage.style.cursor = hitSticker(q[0], q[1]) ? 'move' : (lim ? 'grab' : (partHover ? 'pointer' : ''));
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      stage.addEventListener(t, function (e) {
        var finishedMode = mode;
        if (finishedMode === 'sticker') saveStickersSoon();
        if (finishedMode === 'limb') { ikDrag = null; ikHover = null; syncRigUI(); repaint(); }
        // 单击与拖动分流：未越过 5px 阈值才选择部位，不改变原 IK / 转身手感。
        if (e.type === 'pointerup' && !moved && (finishedMode === 'limb' || finishedMode === 'body')) {
          if (pendingPart) selectPart(pendingPart, true); else selectPart(null);
        }
        pendingPart = null; mode = null;
      });
    });
    stage.addEventListener('pointerleave', function () {
      stage.style.cursor = '';
      if (ikHover) { ikHover = null; repaint(); }
    });

    // Delete / Esc：删除或取消选中贴纸（输入框内不拦截；两个画板弹窗打开时不响应）
    document.addEventListener('keydown', function (e) {
      if (!S.selSticker) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      if ((seEl.modal && !seEl.modal.classList.contains('hidden')) ||
          !document.getElementById('faceEditor').classList.contains('hidden')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedSticker(); }
      else if (e.key === 'Escape') selectSticker(null);
    });
  })();

  /* ---------------- 交互绑定 ---------------- */
  function activateTab(id) {
    var t = document.querySelector('.tab[data-tab="' + id + '"]');
    if (!t) return;
    if (id !== 'mo') kfExitView();   // v1.11.0：切离「动作」页即退出时间轴查看，回当前骨骼所见即所得
    [].forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    [].forEach.call(document.querySelectorAll('.tab-body'), function (b) { b.classList.add('hidden'); });
    document.getElementById('tab-' + id).classList.remove('hidden');
  }
  [].forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () { activateTab(t.dataset.tab); };
  });
  document.getElementById('textInput').addEventListener('input', function (e) {
    S.text.content = e.target.value.trim(); repaint();
  });
  [].forEach.call(document.getElementById('textPos').children, function (b) {
    b.onclick = function () { setTextPos(b.dataset.v); repaint(); };
  });
  [].forEach.call(document.getElementById('textStyle').children, function (b) {
    b.onclick = function () { setTextStyle(b.dataset.v); repaint(); };
  });
  [].forEach.call(document.getElementById('textColor').children, function (b) {
    b.onclick = function () {
      S.text.color = b.dataset.v;
      setActive(document.getElementById('textColor'), b.dataset.v);
      repaint();
    };
  });
  document.getElementById('textSize').addEventListener('input', function (e) {
    S.text.size = parseFloat(e.target.value); repaint();
  });

  document.getElementById('btnReset').onclick = function () {
    S.pose = 'pstand'; S.face = 'normal'; S.bg = 'none';
    S.rig = rigClone(REST_RIG); syncRigUI();
    S.parts = createPartStates(); S.selPart = null; syncPartUI();
    S.body = bodyClone(); bodyChanged();   // v1.8.0：体型一并还原官方标准
    S.text = { content: '', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 };
    S.stickerItems = [];
    S.selSticker = null;
    document.getElementById('textInput').value = '';
    document.getElementById('textSize').value = 1;
    setTextPos('bottom'); setTextStyle('meme');
    setActive(document.getElementById('textColor'), '#ffffff');
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    S.anim = animClone(); syncAnimUI();
    KF.frames = []; KF.playing = false; KF.viewT = null;   // v1.11.0：关键帧时间轴一并清空（「我的动作」库保留）
    stopKfLoop(); kfSave(); syncKfUI();
    applySkinBase(SKIN_OFFICIAL.head, null, true);   // v1.5.0：配色一并还原官方
    stickerChanged();
  };
  document.getElementById('btnRandom').onclick = function () {
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var poses = Object.keys(PROC_POSES);
    S.pose = pick(poses);
    S.face = pick(FACES).id;
    if (Math.random() < .6) S.bg = pick(BGS).id;
    S.stickerItems = [];
    STICKERS.forEach(function (x) { if (Math.random() < .18) S.stickerItems.push(makeBuiltinStickerItem(x.id)); });
    S.selSticker = null;
    if (Math.random() < .75) {
      S.text.content = pick(TEXT_PRESETS);
      document.getElementById('textInput').value = S.text.content;
    }
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    // 手绘姿势时给骨骼一点随机摆动，制造惊喜
    if (PROC_POSES[S.pose] && Math.random() < .6) {
      var rr = S.rig, rnd = function (a, b) { return Math.round(a + Math.random() * (b - a)); };
      rr.bodyYaw = rnd(-28, 28); rr.headYaw = rnd(-26, 26); rr.headPitch = rnd(-14, 10);
      rr.lArmSide = rnd(0, 165); rr.rArmSide = rnd(0, 165);
      rr.lArmFront = rnd(-55, 55); rr.rArmFront = rnd(-55, 55);
      rr.lLegSide = rnd(0, 40); rr.rLegSide = rnd(0, 40);
      rr.lLegFront = rnd(-30, 30); rr.rLegFront = rnd(-30, 30);
      rr.bounce = pick([0, 0, -12, -26]);
      syncRigUI();
    }
    stickerChanged();
  };

  /* ---------------- 动画面板（v1.4.0） ---------------- */
  var animEl = {};
  // 填充「第二表情」下拉；列表变化（自定义表情增删）时由 rebuildFaces 回调
  function fillAnimFace2() {
    var sel = animEl && animEl.face2;   // 模块加载早期（rebuildFaces）可能先于此执行，animEl/S.anim 尚未初始化
    if (!sel || !S.anim) return;
    var keep = S.anim.face2;
    sel.innerHTML = '';
    FACES.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f.id; o.textContent = f.label;
      sel.appendChild(o);
    });
    var ok = FACES.some(function (f) { return f.id === keep; });
    if (!ok) keep = FACES.some(function (f) { return f.id === 'wink'; }) ? 'wink' : FACES[0].id;
    S.anim.face2 = keep;
    sel.value = keep;
  }
  function syncAnimUI() {
    var a = S.anim;
    if (!animEl.play) return;
    var has = a.breath > 0 || a.sway > 0 || a.walk > 0 || a.switchOn;
    animEl.play.textContent = a.playing ? '⏸ 暂停预览' : '▶ 播放预览';
    animEl.status.textContent = !has ? '未启用：调一个滑杆即可开始'
      : (a.playing ? '循环播放中' : '已暂停（导出 GIF 不受影响）');
    animEl.breath.value = a.breath;
    animEl.breathVal.textContent = a.breath > 0 ? String(a.breath) : '关';
    animEl.sway.value = a.sway;
    animEl.swayVal.textContent = a.sway > 0 ? a.sway + '°' : '关';
    animEl.walk.value = a.walk;
    animEl.walkVal.textContent = a.walk > 0 ? a.walk + '°' : '关';
    animEl.period.value = a.period;
    animEl.periodVal.textContent = a.period.toFixed(1) + 's';
    animEl.switchOn.checked = !!a.switchOn;
    if (animEl.face2.value !== a.face2) animEl.face2.value = a.face2;
  }
  function buildAnimUI() {
    animEl.play = document.getElementById('animPlay');
    animEl.status = document.getElementById('animStatus');
    animEl.breath = document.getElementById('animBreath');
    animEl.breathVal = document.getElementById('animBreathVal');
    animEl.sway = document.getElementById('animSway');
    animEl.swayVal = document.getElementById('animSwayVal');
    animEl.walk = document.getElementById('animWalk');
    animEl.walkVal = document.getElementById('animWalkVal');
    animEl.period = document.getElementById('animPeriod');
    animEl.periodVal = document.getElementById('animPeriodVal');
    animEl.switchOn = document.getElementById('animSwitch');
    animEl.face2 = document.getElementById('animFace2');
    fillAnimFace2();
    animEl.play.onclick = function () {
      S.anim.playing = !S.anim.playing;
      if (S.anim.playing) kfExitView();   // v1.11.0：与关键帧动画互斥
      saveAnim(); syncAnimUI(); repaint();
    };
    function bind(input, fn) {
      input.addEventListener('input', function () {
        fn(input.type === 'checkbox' ? input.checked : parseFloat(input.value));
        saveAnim(); syncAnimUI(); repaint();
      });
    }
    bind(animEl.breath, function (v) { S.anim.breath = Math.round(v); });
    bind(animEl.sway, function (v) { S.anim.sway = Math.round(v); });
    bind(animEl.walk, function (v) { S.anim.walk = Math.round(v); });
    bind(animEl.period, function (v) { S.anim.period = v; });
    bind(animEl.switchOn, function (v) { S.anim.switchOn = !!v; });
    animEl.face2.addEventListener('change', function () {
      S.anim.face2 = animEl.face2.value;
      saveAnim(); repaint();
    });
    syncAnimUI();
  }

  /* ---------------- 动作面板（v1.11.0：关键帧时间轴） ---------------- */
  var kfEl = {};
  function buildKfThumb(f) {   // 关键帧缩略：透明底小图，直观看出每帧姿势
    var cv = thumbCanvas(60), c = cv.getContext('2d');
    c.save(); c.scale(60 / BASE, 60 / BASE);
    renderProcedural(c, BASE, 60 / BASE, f.rig);
    c.restore();
    return cv;
  }
  function syncKfHead() {   // 只更新播放头滑杆（播放循环里逐帧调用，不重建列表）
    if (!kfEl.head) return;
    var dur = kfDur();
    kfEl.head.max = String(Math.max(dur, 0.1));
    if (KF.viewT != null) {
      kfEl.head.value = String(Math.min(KF.viewT, dur));
      kfEl.headVal.textContent = KF.viewT.toFixed(2) + 's';
    } else {
      kfEl.headVal.textContent = '—';
    }
  }
  function rebuildKfList() {   // 关键帧列表：时刻编辑 + 缩略 + 载入 / 更新 / 删除
    var box = kfEl.list;
    if (!box) return;
    box.innerHTML = '';
    if (!KF.frames.length) {
      var tip = document.createElement('p');
      tip.className = 'kf-empty';
      tip.textContent = '时间轴还是空的：点一个动作预设，或在「骨骼」页摆好姿势后点「打关键帧」。';
      box.appendChild(tip);
      return;
    }
    KF.frames.forEach(function (f, i) {
      var row = document.createElement('div'); row.className = 'kf-row';
      var tIn = document.createElement('input');
      tIn.type = 'number'; tIn.className = 'kf-t'; tIn.value = f.t.toFixed(2);
      tIn.min = '0'; tIn.max = '30'; tIn.step = '0.05'; tIn.title = '关键帧时刻（秒）';
      tIn.addEventListener('change', function () {
        var v = Math.max(0, Math.min(30, parseFloat(tIn.value)));
        if (isNaN(v)) { tIn.value = f.t.toFixed(2); return; }
        f.t = Math.round(v * 100) / 100;
        kfSortSave(); syncKfUI(); repaint();
      });
      row.appendChild(tIn);
      var thumb = document.createElement('span'); thumb.className = 'kf-thumb';
      thumb.appendChild(buildKfThumb(f));
      row.appendChild(thumb);
      var tag = document.createElement('span');
      tag.className = 'kf-tag';
      tag.textContent = i === 0 ? '首帧' : (i === KF.frames.length - 1 ? '末帧' : '#' + (i + 1));
      row.appendChild(tag);
      var bLoad = document.createElement('button');
      bLoad.type = 'button'; bLoad.className = 'btn ghost sticker-mini'; bLoad.textContent = '⇥ 载入到骨骼';
      bLoad.title = '把这一帧的姿势载入当前骨骼，去「骨骼」页或画布上继续微调';
      bLoad.onclick = function () {
        S.rig = rigClone(f.rig);
        KF.playing = false; KF.viewT = null; stopKfLoop();
        syncRigUI(); syncKfUI(); repaint();
        toast('已载入 ' + f.t.toFixed(2) + 's 帧姿势到骨骼');
      };
      row.appendChild(bLoad);
      var bUpd = document.createElement('button');
      bUpd.type = 'button'; bUpd.className = 'btn ghost sticker-mini'; bUpd.textContent = '⟳ 更新';
      bUpd.title = '用当前骨骼姿势覆盖这一帧';
      bUpd.onclick = function () {
        f.rig = rigClone(S.rig || REST_RIG);
        kfSave(); syncKfUI();
        toast('已用当前骨骼更新 ' + f.t.toFixed(2) + 's 处的关键帧');
      };
      row.appendChild(bUpd);
      var bDel = document.createElement('button');
      bDel.type = 'button'; bDel.className = 'btn ghost sticker-mini kf-del'; bDel.textContent = '✕';
      bDel.title = '删除这一帧';
      bDel.onclick = function () {
        KF.frames.splice(KF.frames.indexOf(f), 1);
        if (KF.frames.length < 2) { KF.playing = false; if (KF.frames.length === 0) KF.viewT = null; }
        kfSave(); syncKfUI(); repaint();
        toast('已删除 ' + f.t.toFixed(2) + 's 处的关键帧');
      };
      row.appendChild(bDel);
      box.appendChild(row);
    });
  }
  function rebuildKfSavedUI() {   // 「我的动作」库 chips：点选载入，✕ 删除
    var box = kfEl.saved;
    if (!box) return;
    box.innerHTML = '';
    if (!kfSaved.length) {
      var tip = document.createElement('span');
      tip.className = 'kf-empty';
      tip.textContent = '还没有保存的动作，串好时间轴后命名保存即可复用。';
      box.appendChild(tip);
      return;
    }
    kfSaved.forEach(function (rec) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = rec.name;
      b.title = '载入「' + rec.name + '」（' + rec.frames.length + ' 帧 · ' +
        (rec.frames[rec.frames.length - 1].t - rec.frames[0].t).toFixed(1) + 's）';
      b.onclick = function () { kfLoadFrames(rec.frames, rec.name); };
      var x = document.createElement('i');
      x.className = 'chip-del'; x.textContent = '✕'; x.title = '删除「' + rec.name + '」';
      x.onclick = function (e) {
        e.stopPropagation();
        kfSaved.splice(kfSaved.indexOf(rec), 1);
        persistKfSaved(); rebuildKfSavedUI(); rebuildKfAppendSel();
        toast('已删除动作「' + rec.name + '」');
      };
      b.appendChild(x);
      box.appendChild(b);
    });
  }
  function rebuildKfAppendSel() {   // 串联源：7 款预设 + 我的动作
    var sel = kfEl.appendSel;
    if (!sel) return;
    sel.innerHTML = '';
    KF_PRESETS.forEach(function (p) {
      var o = document.createElement('option'); o.value = 'p:' + p.id; o.textContent = '预设 · ' + p.label;
      sel.appendChild(o);
    });
    kfSaved.forEach(function (rec, i) {
      var o = document.createElement('option'); o.value = 's:' + i; o.textContent = '我的 · ' + rec.name;
      sel.appendChild(o);
    });
  }
  function kfAppendSource() {   // 解析串联下拉的 value → 关键帧数组副本
    var v = kfEl.appendSel.value, m = /^([ps]):(.+)$/.exec(v);
    if (!m) return null;
    if (m[1] === 'p') {
      for (var i = 0; i < KF_PRESETS.length; i++) if (KF_PRESETS[i].id === m[2]) return KF_PRESETS[i];
    } else {
      var rec = kfSaved[+m[2]];
      if (rec) return { label: rec.name, frames: rec.frames };
    }
    return null;
  }
  function syncKfUI() {
    if (!kfEl.play) return;
    var has = kfActive();
    kfEl.play.textContent = KF.playing ? '⏸ 暂停' : '▶ 播放预览';
    kfEl.play.disabled = !has;
    kfEl.stop.disabled = !KF.playing && KF.viewT == null;
    kfEl.status.textContent = !KF.frames.length ? '时间轴为空'
      : (!has ? '只有 1 帧，再打一帧即可播放'
        : (KF.playing ? '循环播放中 · ' : '已暂停 · ') + KF.frames.length + ' 帧 · ' + kfDur().toFixed(1) + 's 循环');
    kfEl.add.disabled = false;
    kfEl.clear.disabled = !KF.frames.length;
    kfEl.gif.disabled = !has;
    kfEl.apng.disabled = !has;
    kfEl.export.disabled = !KF.frames.length;
    kfEl.head.disabled = !has;
    syncKfHead();
    rebuildKfList();
    rebuildKfAppendSel();
    rebuildKfSavedUI();
  }
  function buildKfUI() {
    kfEl.play = document.getElementById('kfPlay');
    kfEl.stop = document.getElementById('kfStop');
    kfEl.status = document.getElementById('kfStatus');
    kfEl.head = document.getElementById('kfHead');
    kfEl.headVal = document.getElementById('kfHeadVal');
    kfEl.add = document.getElementById('kfAdd');
    kfEl.clear = document.getElementById('kfClear');
    kfEl.list = document.getElementById('kfList');
    kfEl.presetBox = document.getElementById('kfPresets');
    kfEl.appendSel = document.getElementById('kfAppendSel');
    kfEl.append = document.getElementById('kfAppend');
    kfEl.name = document.getElementById('kfName');
    kfEl.save = document.getElementById('kfSaveBtn');
    kfEl.saved = document.getElementById('kfSaved');
    kfEl.export = document.getElementById('kfExport');
    kfEl.import = document.getElementById('kfImport');
    kfEl.file = document.getElementById('kfFile');
    kfEl.gif = document.getElementById('kfGif');
    kfEl.apng = document.getElementById('kfApng');

    kfEl.play.onclick = function () {
      if (!kfActive()) { toast('至少需要 2 个关键帧才能播放'); return; }
      KF.playing = !KF.playing;
      if (KF.playing) kfPauseLoopAnim();   // 与循环动画互斥
      if (!KF.playing) stopKfLoop();
      syncKfUI(); repaint();
    };
    kfEl.stop.onclick = function () { kfExitView(); };   // 回到当前骨骼静态
    kfEl.head.addEventListener('input', function () {   // 播放头拖动 = 暂停并定位
      if (!kfActive()) return;
      KF.playing = false; stopKfLoop();
      KF.viewT = Math.max(0, Math.min(kfDur(), parseFloat(kfEl.head.value) || 0));
      syncKfHead();
      renderKfView(stageCtx, BASE, true, KF.viewT);
      kfEl.play.textContent = '▶ 播放预览';
      kfEl.stop.disabled = false;
    });
    kfEl.add.onclick = function () { kfAddFrame(); };
    kfEl.clear.onclick = function () {   // 清空 = 二次确认（危险操作）
      if (!KF.frames.length) return;
      if (!kfEl.clear._confirm) {
        kfEl.clear._confirm = true; kfEl.clear.textContent = '再点一次确认清空';
        setTimeout(function () { kfEl.clear._confirm = false; kfEl.clear.textContent = '↺ 清空时间轴'; }, 2500);
        return;
      }
      kfEl.clear._confirm = false; kfEl.clear.textContent = '↺ 清空时间轴';
      KF.frames = []; KF.playing = false; KF.viewT = null; stopKfLoop();
      kfSave(); syncKfUI(); repaint();
      toast('时间轴已清空（「我的动作」库不受影响）');
    };
    KF_PRESETS.forEach(function (p) {   // 预设 chips：点选载入
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label;
      b.title = '载入预设「' + p.label + '」（' + p.frames.length + ' 帧 · ' +
        (p.frames[p.frames.length - 1].t - p.frames[0].t).toFixed(1) + 's）';
      b.onclick = function () { kfLoadFrames(p.frames, p.label); };
      kfEl.presetBox.appendChild(b);
    });
    kfEl.append.onclick = function () {   // 多段串联：追加后直接播放
      var src = kfAppendSource();
      if (!src) { toast('请选择要串联的动作'); return; }
      kfAppendFrames(src.frames, src.label);
    };
    kfEl.save.onclick = function () { saveKfNamed(kfEl.name.value, KF.frames); };
    kfEl.name.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveKfNamed(kfEl.name.value, KF.frames);
    });
    kfEl.export.onclick = function () {   // 动作 JSON 导出（含名称，可分享）
      if (!KF.frames.length) { toast('时间轴上还没有关键帧'); return; }
      var data = { v: 1, name: kfEl.name.value.trim() || '我的动作', frames: kfSanitize(KF.frames) };
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        'TRAE宝-动作-' + data.name + '.json');
      toast('动作已导出（' + KF.frames.length + ' 帧）');
    };
    kfEl.import.onclick = function () { kfEl.file.click(); };
    kfEl.file.addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      var file = this.files[0];
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var data = JSON.parse(fr.result);
          var fs = data && data.frames;
          if (!Array.isArray(fs) || fs.length < 2) { toast('动作文件格式不对：需要至少 2 个关键帧'); return; }
          var ok = kfSanitize(fs);
          if (ok.length < 2) { toast('动作文件里没有有效的关键帧'); return; }
          kfLoadFrames(ok, data.name || '导入动作');
        } catch (err) {
          toast('动作导入失败：' + (err && err.message || err));
        }
      };
      fr.readAsText(file);
      this.value = '';
    });
    kfEl.gif.onclick = function () { exportKfGif(this); };
    kfEl.apng.onclick = function () { exportKfApng(this); };
    syncKfUI();
  }

  /* ---- 关键帧动图导出：GIF（兼容性）/ APNG（全彩无损） ---- */
  function kfSamplePlan() {   // 采样计划：12fps 起步，8~48 帧钳制，与循环时长对齐
    var dur = kfDur();
    var n = Math.max(8, Math.min(48, Math.round(dur * 12)));
    return { n: n, dur: dur, delayMs: Math.max(20, Math.round(dur * 1000 / n / 10) * 10) };
  }
  function exportKfGif(btn) {
    if (!window.TraeGif) { toast('GIF 编码器未加载，请检查 js/gif-encoder.js'); return; }
    var size = parseInt(document.getElementById('exportSize').value, 10);
    var plan = kfSamplePlan();
    btn.disabled = true;
    toast('正在采集 ' + plan.n + ' 帧关键帧动画…');
    setTimeout(function () {
      try {
        var frames = [];
        for (var i = 0; i < plan.n; i++) {
          var cv = document.createElement('canvas');
          cv.width = cv.height = size;
          var c2 = cv.getContext('2d');
          renderKfView(c2, size, false, i / plan.n * plan.dur);
          frames.push({ data: c2.getImageData(0, 0, size, size).data });
        }
        window.TraeGif.encode({
          width: size, height: size, delayMs: plan.delayMs, frames: frames,
          onProgress: function (p) { toast('GIF 编码中… ' + Math.round(p * 100) + '%'); }
        }).then(function (blob) {
          btn.disabled = false;
          download(blob, 'TRAE宝-动作-' + S.pose + '-' + S.face + '.gif');
          toast('GIF 已导出（' + plan.n + ' 帧 · ' + Math.round(blob.size / 1024) + 'KB）');
        }).catch(function () {
          btn.disabled = false;
          toast('GIF 编码失败，请重试');
        });
      } catch (err) {
        btn.disabled = false;
        toast('GIF 导出失败：' + (err && err.message || err));
      }
    }, 30);
  }
  function exportKfApng(btn) {
    if (!window.TraeApng) { toast('APNG 编码器未加载，请检查 js/apng-encoder.js'); return; }
    var size = parseInt(document.getElementById('exportSize').value, 10);
    var plan = kfSamplePlan();
    btn.disabled = true;
    toast('正在采集 ' + plan.n + ' 帧关键帧动画…');
    setTimeout(function () {
      try {
        var frames = [];
        for (var i = 0; i < plan.n; i++) {
          var cv = document.createElement('canvas');
          cv.width = cv.height = size;
          renderKfView(cv.getContext('2d'), size, false, i / plan.n * plan.dur);
          frames.push(cv);
        }
        window.TraeApng.encode({
          width: size, height: size, delayMs: plan.delayMs, frames: frames,
          onProgress: function (p) { toast('APNG 编码中… ' + Math.round(p * 100) + '%'); }
        }).then(function (blob) {
          btn.disabled = false;
          download(blob, 'TRAE宝-动作-' + S.face + '.png');
          toast('APNG 已导出（' + plan.n + ' 帧 · ' + Math.round(blob.size / 1024) + 'KB）');
        }).catch(function () {
          btn.disabled = false;
          toast('APNG 编码失败，请重试');
        });
      } catch (err) {
        btn.disabled = false;
        toast('APNG 导出失败：' + (err && err.message || err));
      }
    }, 30);
  }

  /* ---------------- 导出 ---------------- */
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function exportCanvas(size) {
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    render(cv.getContext('2d'), size);
    return cv;
  }
  function fileName(tag) {
    return 'TRAE宝-' + S.pose + '-' + S.face + '-' + (tag || Date.now()) + '.png';
  }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  document.getElementById('btnDownload').onclick = function () {
    var size = parseInt(document.getElementById('exportSize').value, 10);
    exportCanvas(size).toBlob(function (b) {
      download(b, fileName());
      toast('已下载 ' + size + '×' + size + ' PNG');
    }, 'image/png');
  };
  document.getElementById('btnCopy').onclick = function () {
    var cv = exportCanvas(480);
    if (!navigator.clipboard || !window.ClipboardItem) {
      toast('当前环境不支持复制图片，请用「下载表情」');
      return;
    }
    cv.toBlob(function (b) {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
        .then(function () { toast('已复制到剪贴板，去聊天框粘贴吧'); })
        .catch(function () { toast('复制失败，请用「下载表情」'); });
    }, 'image/png');
  };
  document.getElementById('btnBatch').onclick = function () {
    var i = 0;
    // 贴纸实例含 Image 对象，快照前先序列化成可 JSON 的纯数据
    var keep = JSON.stringify({
      pose: S.pose, face: S.face, bg: S.bg, rig: S.rig, parts: S.parts, text: S.text,
      bgFit: S.bgFit, bgOffX: S.bgOffX, bgOffY: S.bgOffY,
      stickerItems: serializableStickers()
    });
    function next() {
      if (i >= PRESETS.length) {
        restoreState(JSON.parse(keep));
        toast('套系 8 张已全部导出');
        return;
      }
      applyPreset(PRESETS[i]);
      var cv = exportCanvas(parseInt(document.getElementById('exportSize').value, 10));
      cv.toBlob(function (b) {
        download(b, 'TRAE宝套系-' + (i + 1) + '-' + PRESETS[i].label + '.png');
        i++;
        setTimeout(next, 450);
      }, 'image/png');
    }
    next();
  };

  /* ---------------- GIF 动图导出（v1.4.0；v1.11.0 起关键帧优先） ---------------- */
  var GIF_FRAMES = 16;
  document.getElementById('btnGif').onclick = function () {
    // v1.11.0：时间轴上有动作时导出关键帧动画，否则保持循环动画导出
    if (kfActive()) { exportKfGif(this); return; }
    var a = S.anim;
    if (!(a.breath > 0 || a.sway > 0 || a.walk > 0 || a.switchOn)) {
      toast('请先在「动画」页打开呼吸、摇摆、四肢摆动或表情切换');
      return;
    }
    if (!window.TraeGif) { toast('GIF 编码器未加载，请检查 js/gif-encoder.js'); return; }
    var btn = this;
    var size = parseInt(document.getElementById('exportSize').value, 10);
    var delayMs = Math.max(20, Math.round(a.period * 1000 / GIF_FRAMES / 10) * 10);
    btn.disabled = true;
    toast('正在采集 ' + GIF_FRAMES + ' 帧动画…');
    setTimeout(function () {
      try {
        // 均匀采样一个循环周期；离屏渲染不经过预览层（无选中框、无手柄）
        var frames = [];
        for (var i = 0; i < GIF_FRAMES; i++) {
          var cv = document.createElement('canvas');
          cv.width = cv.height = size;
          var c2 = cv.getContext('2d');
          render(c2, size, false, i / GIF_FRAMES);
          frames.push({ data: c2.getImageData(0, 0, size, size).data });
        }
        window.TraeGif.encode({
          width: size, height: size, delayMs: delayMs, frames: frames,
          onProgress: function (p) { toast('GIF 编码中… ' + Math.round(p * 100) + '%'); }
        }).then(function (blob) {
          btn.disabled = false;
          download(blob, 'TRAE宝-动画-' + S.pose + '-' + S.face + '.gif');
          toast('GIF 已导出（' + GIF_FRAMES + ' 帧 · ' + Math.round(blob.size / 1024) + 'KB）');
        }).catch(function () {
          btn.disabled = false;
          toast('GIF 编码失败，请重试');
        });
      } catch (err) {
        btn.disabled = false;
        toast('GIF 导出失败：' + (err && err.message || err));
      }
    }, 30);
  };

  function restoreState(st) {
    S.pose = st.pose; S.face = st.face; S.bg = st.bg;
    S.text = JSON.parse(JSON.stringify(st.text));
    S.bgFit = st.bgFit || 'cover'; S.bgOffX = st.bgOffX || 0; S.bgOffY = st.bgOffY || 0;
    hydrateStickerItems(st.stickerItems || []);
    document.getElementById('textInput').value = S.text.content;
    document.getElementById('textSize').value = S.text.size;
    setTextPos(S.text.pos); setTextStyle(S.text.style);
    setActive(document.getElementById('textColor'), S.text.color);
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    S.rig = st.rig ? rigClone(st.rig) : rigClone(REST_RIG); // setPose 会载入预设姿势，这里恢复用户自定义骨骼
    S.parts = st.parts ? createPartStates(st.parts) : createPartStates();
    S.selPart = null;
    syncRigUI(); syncPartUI();
    rebuildStickerList();
    syncStickerCtl();
    repaint();
    saveStickersSoon();
  }

  /* ---------------- 头像 logo ---------------- */
  (function logo() {
    var cv = document.getElementById('logoCanvas');
    var c = cv.getContext('2d');
    c.fillStyle = '#d7fcae'; c.fillRect(0, 0, 52, 52);
    c.fillStyle = '#232a2e'; roundRect(c, 8, 12, 36, 28, 4); c.fill();
    c.fillStyle = '#0e1418'; c.fillRect(13, 17, 26, 16);
    c.save();
    c.shadowColor = '#73f99a'; c.shadowBlur = 6;
    c.fillStyle = '#73f99a';
    [[19, 25], [33, 25]].forEach(function (p) {
      c.beginPath();
      c.moveTo(p[0], p[1] - 4); c.lineTo(p[0] + 3.4, p[1]); c.lineTo(p[0], p[1] + 4); c.lineTo(p[0] - 3.4, p[1]);
      c.closePath(); c.fill();
    });
    c.restore();
  })();

  /* ---------------- 启动 ---------------- */
  // 调试/高级用法句柄
  window.__traeEmoji = { S: S, repaint: repaint, exportCanvas: exportCanvas, stickers: { add: addBuiltinSticker, remove: deleteSelectedSticker, select: selectSticker, clear: clearStickers }, parts: { defs: PART_DEFS, select: selectPart, hit: hitPart, reset: function () { S.parts = createPartStates(); syncPartUI(); repaint(); } }, FACES: FACES, setFace: setFace, setPose: setPose, setBg: setBg, faceEdit: { edits: function () { return FACE_EDITS; }, open: openFaceEditor, cells: faceCellsOf, bright: faceBright, canvas: getFaceCanvas }, skin: { presets: SKIN_PRESETS, official: SKIN_OFFICIAL, setBase: applySkinBase, mix: skinMix, state: function () { return S.skin; } }, body: { rest: BODY_REST, defs: BODY_SLIDER_DEFS, presets: BODY_PRESETS, saved: function () { return bodySaved.slice(); }, state: function () { return bodyClone(S.body); }, set: function (f, label) { S.body = bodySanitize(bodyClone(f)); bodyChanged(label); }, apply: applyBody }, ik: { defs: IK_DEFS, pos: ikPos, solve: ikSolve, hit: hitLimb, state: function () { return { drag: ikDrag, hover: ikHover && ikHover.id }; } }, kf: { presets: KF_PRESETS, frames: function () { return KF.frames; }, rigAt: kfRigAt, load: kfLoadFrames, append: kfAppendFrames, dur: kfDur, saved: function () { return kfSaved; }, state: function () { return { playing: KF.playing, viewT: KF.viewT }; } }, dbg3d: { buildSkeleton: buildSkeleton, updateSkeletonMatrices: updateSkeletonMatrices, projectV: projectV, GEO3D: GEO3D, applyM: applyM, mIdent0: mIdent0, mMul: mMul, mT: mT, mS: mS, mRX: mRX, mRY: mRY, mRZ: mRZ, V3: V3, CAM: CAM, FACE_DEFS: FACE_DEFS, rotOnly: rotOnly, shadeHex: shadeHex, LIGHT: LIGHT } };
  function init() {
    feBind();
    seBind();
    buildRigUI();
    syncRigUI();
    buildPartUI();
    loadBody();        // v1.8.0：恢复本机保存的体型比例（需早于缩略图构建）
    loadBodySaved();
    loadSkin();          // v1.5.0：恢复本机保存的外壳配色（需早于缩略图构建）
    buildOptions();
    buildSkinUI();
    buildBodyUI();     // v1.8.0：体型面板（滑杆 / 预设 / 保存 / 导入导出）
    stBind();
    loadStickers();
    rebuildStickerList();
    syncStickerCtl();
    bindBgUI();
    syncBgUI();
    loadCustomBg();
    loadAnim();        // v1.4.0：恢复本机保存的动画设置
    buildAnimUI();
    kfLoad();          // v1.11.0：恢复本机保存的关键帧时间轴（默认不自动播放）
    loadKfSaved();
    buildKfUI();
    repaint();
  }
  init();
})();
