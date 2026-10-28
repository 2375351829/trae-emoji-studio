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
      id: rec.id, label: rec.label, glow: rec.glow, custom: true, cells: rec.cells,
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
    BUILTIN_FACES.forEach(function (d) { FACES.push(d); });
    CUSTOM_FACES.forEach(function (r) { FACES.push(customDef(r)); });
  }
  function persistCustomFaces() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(CUSTOM_FACES)); return true; }
    catch (e) { return false; }
  }
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
  // 取消肘、膝关节（肢段一体的刚体旋转，不做弯曲）
  var GEO3D = {
    headW: 370, headH: 316, headD: 336, headY: -233.5,
    screenW: 274, screenH: 216, screenTopOff: 53,
    bezelPad: 5, bezelProtrude: 12, bezelDepth: 34,
    // 缺角整体落在「脸面边框」里：脸边到屏幕板边的间距 43，缺口宽 40、高 38，
    // 与屏幕板左边/下沿各留 3~4 的空隙，保证屏幕板（含凸出台阶）完全不遮挡缺角
    notchW: 40, notchH: 38, notchD: 58,
    torsoW: 175, torsoH: 162, torsoOy: 0, torsoD: 152,
    shoulderX: 113, shoulderY: -76,
    armW: 29, armLen: 140, handW: 58, handH: 8, handD: 56,
    hipX: 42, hipY: 74, legW: 41, legD: 58, legLen: 102,
    footW: 36, footH: 8, footD: 142
  };

  var REST_RIG = {
    bodyYaw: 0, bodyPitch: 0, bodyRoll: 0, headYaw: 0, headPitch: 0,
    lArmSide: 2, lArmFront: 10, rArmSide: 2, rArmFront: 10,
    lLegSide: 0, lLegFront: 0, rLegSide: 0, rLegFront: 0, bounce: 0
  };
  function rigClone(r) { var o = {}, k; for (k in REST_RIG) o[k] = (r && r[k]) || 0; return o; }

  // 姿势 = 骨骼角度组（手绘模型，MC 式单段肢体：只有肩摆 / 髋摆，没有肘膝）
  // 全部姿势均为程序绘制，官方 PNG 仅作底部参考图，不进入生成链路
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
    var r = Math.min(255, Math.round((n >> 16 & 255) * f));
    var g = Math.min(255, Math.round((n >> 8 & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function buildSkeleton(rig) {
    var g = GEO3D, R = Math.PI / 180; // 骨骼角度单位 = 度
    var torso = { pos: [0, rig.bounce || 0, 0], rot: [rig.bodyPitch * R, rig.bodyYaw * R, rig.bodyRoll * R] };
    // 屏幕装配件：边框盒（凸出前脸）+ 玻璃面（再内凹 bezelRecess）
    var sy0 = -g.headH / 2 + g.screenTopOff;
    var bzW = g.screenW + g.bezelPad * 2, bzH = g.screenH + g.bezelPad * 2;
    var head = {
      pos: [0, g.headY, 0], rot: [rig.headPitch * R, rig.headYaw * R, 0],
      boxes: [
        // 主头盒：整块长方体，底面止于缺角顶（edge:'self' 消除拼块接缝线，读作一整块）
        { s: [g.headW / 2, (g.headH - g.notchH) / 2, g.headD / 2],
          o: [0, -g.notchH / 2, 0], col: '#373834', edge: 'self' },
        // 缺角右侧补块：底带右半（含缺口以右全部深度）
        { s: [(g.headW - g.notchW) / 2, g.notchH / 2, g.headD / 2],
          o: [g.notchW / 2, g.headH / 2 - g.notchH / 2, 0], col: '#373834', edge: 'self' },
        // 缺角后侧补块：底带左端只保留缺口深度之后的部分，形成 L 形缺角
        { s: [g.notchW / 2, g.notchH / 2, (g.headD - g.notchD) / 2],
          o: [-g.headW / 2 + g.notchW / 2, g.headH / 2 - g.notchH / 2, -g.notchD / 2],
          col: '#373834', edge: 'self' },
        // 缺口内壁阴影片：只贴在缺口后壁上（四周内缩 2，留一圈亮边读作凹入），不影响侧/背视
        { s: [g.notchW / 2 - 2, g.notchH / 2 - 2, 0.8],
          o: [-g.headW / 2 + g.notchW / 2, g.headH / 2 - g.notchH / 2, g.headD / 2 - g.notchD + 0.8],
          col: '#2a2b27' },
        // 屏幕边框：凸出前脸的装配件，侧/俯视可见 12px 台阶（五视图与官方渲染一致）
        { s: [bzW / 2, bzH / 2, g.bezelDepth / 2],
          o: [0, sy0 + g.screenH / 2, g.headD / 2 + g.bezelProtrude - g.bezelDepth / 2],
          col: '#33342f' }
      ]
    };
    // 手臂：单段刚体（肩关节摆动），末端挂手部薄块，不做肘弯
    function arm(side, sV, fV) {
      return {
        pos: [side * g.shoulderX, g.shoulderY, 0], rot: [fV * R, 0, (side < 0 ? sV : -sV) * R],
        boxes: [
          { s: [g.armW, g.armLen / 2, g.armW + 15], o: [0, g.armLen / 2, 0], col: '#2c2d2a' },
          // 肩关节填充：摆动时盖住根部缝隙
          { s: [g.armW, 30, g.armW + 15], o: [0, 0, 0], col: '#2c2d2a' }
        ],
        children: [{
          pos: [0, g.armLen - 2, 0],
          boxes: [{ s: [g.handW / 2, g.handH, g.handD / 2], o: [0, 2, 0], col: '#33342f' }]
        }]
      };
    }
    // 腿：单段刚体（髋关节前后摆 + 侧摆），脚掌挂在腿末端一起转，不做膝弯
    function leg(side, fV, sV) {
      return {
        pos: [side * g.hipX, g.hipY, 0], rot: [fV * R, 0, (side < 0 ? sV : -sV) * R],
        boxes: [
          { s: [g.legW, g.legLen / 2, g.legD], o: [0, g.legLen / 2, 0], col: '#2f302d' },
          // 髋关节填充：上端伸入躯干内保持隐藏
          { s: [g.legW - 1, 40, g.legD], o: [0, 0, 0], col: '#2f302d' }
        ],
        children: [{
          pos: [0, g.legLen, 0],
          boxes: [{ s: [g.footW, g.footH, g.footD / 2], o: [0, 8, 10], col: '#383934' }]
        }]
      };
    }
    torso.children = [
      head,
      arm(-1, rig.lArmSide, rig.lArmFront),
      arm(1, rig.rArmSide, rig.rArmFront),
      leg(-1, rig.lLegFront, rig.lLegSide),
      leg(1, rig.rLegFront, rig.rLegSide),
      { pos: [0, 0, 0], rot: [0, 0, 0], boxes: [{ s: [g.torsoW / 2, g.torsoH / 2, g.torsoD / 2], o: [0, g.torsoOy, 0], col: '#2d2e2b' }] }
    ];
    return { root: torso, head: head, handL: torso.children[1].children[0] };
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
        var nV = V3.rotX(nW, CAM.pitch);
        var vDir = V3.norm([ctr[0], ctr[1], ctr[2] - CAM.D]);
        if (V3.dot(nV, vDir) > 0.001) return;
        var pts = fd[0].map(function (i) { return projectV(c[i]); });
        var lum = LUM_A + LUM_D * Math.max(0, V3.dot(nW, LIGHT));
        faces.push({ pts: pts, col: shadeHex(box.col, lum), z: ctr[2] });
      });
    });
  }

  function renderProcedural(ctx, s, deviceScale, rigArg) {
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

    var sk = buildSkeleton(rig);
    (function traverse(node, pm) {
      var rot = node.rot || [0, 0, 0];
      node._m = mMul(pm, mMul(mT(node.pos), mMul(mRX(rot[0]), mMul(mRY(rot[1]), mRZ(rot[2])))));
      (node.children || []).forEach(function (c) { traverse(c, node._m); });
    })(sk.root, mIdent0());

    // 收集所有面（画家算法）
    var faces = [];
    (function collect(node) {
      (node.boxes || []).forEach(function (box) {
        var s3 = box.s, o = box.o, c = [];
        for (var i = 0; i < 8; i++) {
          c.push(applyM(node._m, [o[0] + (i & 1 ? s3[0] : -s3[0]), o[1] + (i & 2 ? s3[1] : -s3[1]), o[2] + (i & 4 ? s3[2] : -s3[2])]));
        }
        FACE_DEFS.forEach(function (fd) {
          var nW = rotOnly(node._m, fd[1]);
          var ctr = [(c[fd[0][0]][0] + c[fd[0][1]][0] + c[fd[0][2]][0] + c[fd[0][3]][0]) / 4,
                     (c[fd[0][0]][1] + c[fd[0][1]][1] + c[fd[0][2]][1] + c[fd[0][3]][1]) / 4,
                     (c[fd[0][0]][2] + c[fd[0][1]][2] + c[fd[0][2]][2] + c[fd[0][3]][2]) / 4];
          var nV = V3.rotX(nW, CAM.pitch);
          var vDir = V3.norm([ctr[0], ctr[1], ctr[2] - CAM.D]); // 相机在 +z
          if (V3.dot(nV, vDir) > 0.001) return; // 背面剔除
          var pts = fd[0].map(function (i) { return projectV(c[i]); });
          var lum = LUM_A + LUM_D * Math.max(0, V3.dot(nW, LIGHT));
          faces.push({ pts: pts, col: shadeHex(box.col, lum), z: ctr[2], edge: box.edge });
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
    var nScr = V3.rotX(rotOnly(hm, [0, 0, 1]), CAM.pitch);
    var scrCtr = [(sq[0][0] + sq[1][0] + sq[2][0] + sq[3][0]) / 4, (sq[0][1] + sq[1][1] + sq[2][1] + sq[3][1]) / 4, (sq[0][2] + sq[1][2] + sq[2][2] + sq[3][2]) / 4];
    var scrVisible = V3.dot(nScr, V3.norm([scrCtr[0], scrCtr[1], scrCtr[2] - CAM.D])) < 0.001;
    if (scrVisible) {
      // 屏幕排序锚定：取屏幕与主头盒前面中心世界 z 的较大者，并越过凸出的边框前沿。
      // 头部俯仰时前脸中心 z 会反超屏幕中心 z，不锚定则前脸盖住整块屏幕。
      var frontCtrZ = applyM(hm, [0, 0, g.headD / 2])[2];
      faces.push({ screen: true, pts: sq.map(projectV), z: Math.max(scrCtr[2], frontCtrZ) + g.bezelProtrude + 4 });
    }

    // 场景道具（桌子/笔记本/马等，世界坐标系，不随角色转动）
    collectProps(faces, S.pose);

    faces.sort(function (a, b) { return a.z - b.z; }); // 远（z 小）先画
    faces.forEach(function (f) {
      if (f.screen) {
        applyFace(ctx, f.pts, { face: S.face, cover: true, coverColor: '#161b18', glowScale: NOGLOW ? 0 : deviceScale, persp: true });
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
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(handP[0] - 50 - i * 17, handP[1] - 12 - i * 7, 14 + i * 5, Math.PI * .75, Math.PI * 1.45);
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

  /* ---------------- 贴纸（全局氛围特效） ---------------- */
  var STICKERS = [
    { id: 'sweat', label: '汗滴' },
    { id: 'anger', label: '怒气' },
    { id: 'zzz', label: 'Zzz' },
    { id: 'sparkle', label: '星光' },
    { id: 'hearts', label: '爱心' },
    { id: 'notes', label: '音符' },
    { id: 'bulb', label: '灯泡' },
    { id: 'qmark', label: '问号' }
  ];

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

  /* ---------------- 状态 ---------------- */
  var S = {
    pose: 'pstand', face: 'normal', bg: 'none', rig: null,
    text: { content: '', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 },
    stickers: {}
  };
  STICKERS.forEach(function (s) { S.stickers[s.id] = false; });

  /* ---------------- 资源加载 ---------------- */
  var faceCache = {};     // 表情位图缓存

  function getFaceCanvas(faceId) {
    if (faceCache[faceId]) return faceCache[faceId];
    var def = FACES.find(function (f) { return f.id === faceId; }) || FACES[0];
    var cv = document.createElement('canvas');
    cv.width = FW; cv.height = FH;
    var f = cv.getContext('2d');
    def.draw(makePen(f));
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
        mapTex(ctx, face.cv, quad, face.def.glow, 26 * glowScale, false);
        mapTex(ctx, face.cv, quad, face.def.glow, 26 * glowScale, true);
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
      ctx.shadowColor = face.def.glow;
      ctx.shadowBlur = 26 * glowScale;
      ctx.drawImage(face.cv, 0, 0);
      ctx.shadowBlur = 10 * glowScale;
      ctx.drawImage(face.cv, 0, 0);
      ctx.shadowBlur = 0;
    }
    ctx.drawImage(face.cv, 0, 0);
    ctx.restore();
  }

  /* ---------------- 背景渲染 ---------------- */
  function renderBg(ctx, id, s) {
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

  /* ---------------- 贴纸 ---------------- */
  function renderStickers(ctx, s) {
    var k = s / BASE;
    ctx.save(); ctx.scale(k, k);
    var placed = {
      sweat: [830, 210], anger: [820, 190], zzz: [830, 170], sparkle: [180, 200],
      hearts: [190, 210], notes: [830, 200], bulb: [830, 190], qmark: [840, 200]
    };
    STICKERS.forEach(function (st) {
      if (!S.stickers[st.id]) return;
      var col = { sweat: C.blue, anger: C.red, zzz: C.cyan, sparkle: C.gold, hearts: C.pink, notes: C.cyan, bulb: C.gold, qmark: C.gold }[st.id];
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 24 * k;
      var p = makePen(ctx);
      p.px = function (x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(x, y, w || 1, h || 1); };
      var cx = placed[st.id][0], cy = placed[st.id][1], sc = 1;
      if (st.id === 'sweat') p.drop(cx, cy, 4 * sc);
      else if (st.id === 'anger') p.anger(cx, cy, 4 * sc);
      else if (st.id === 'zzz') p.zzz(cx, cy, 4 * sc);
      else if (st.id === 'qmark') p.qmark(cx, cy, 4 * sc);
      else if (st.id === 'hearts') { p.heart(cx - 60, cy + 40, 3 * sc); p.heart(cx + 40, cy - 20, 2.2 * sc); p.heart(cx + 90, cy + 60, 1.8 * sc); }
      else if (st.id === 'sparkle') {
        [[0, 0, 5], [90, -60, 3.4], [-70, -90, 2.8]].forEach(function (q) {
          var x = cx + q[0], y = cy + q[1], r = q[2] * sc * 3;
          ctx.fillStyle = col;
          ctx.fillRect(x - r, y - r * .18, r * 2, r * .36);
          ctx.fillRect(x - r * .18, y - r, r * .36, r * 2);
        });
      } else if (st.id === 'notes') {
        drawPat(p, ['####..#', '####..#', '####..#', '...#..#', '.###.##'], cx, cy, 3 * sc);
      } else if (st.id === 'bulb') {
        drawPat(p, ['.###.', '#...#', '#...#', '.###.', '..#..', '.###.'], cx, cy, 3.4 * sc);
      }
      ctx.restore();
    });
    ctx.restore();
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
  function render(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    renderBg(ctx, S.bg, s);
    // 全部姿势均走手绘 3D 管线，官方 PNG 仅作底部参考，不进入生成
    if (PROC_POSES[S.pose]) renderProcedural(ctx, s);
    renderStickers(ctx, s);
    renderText(ctx, s);
  }

  var stage = document.getElementById('stage');
  var stageCtx = stage.getContext('2d');
  function repaint() {
    document.getElementById('bgChecker').classList.toggle('show', S.bg === 'none');
    render(stageCtx, BASE);
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
    c.shadowColor = def.glow; c.shadowBlur = 10;
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
    var col = { sweat: C.blue, anger: C.red, zzz: C.cyan, sparkle: C.gold, hearts: C.pink, notes: C.cyan, bulb: C.gold, qmark: C.gold }[def.id];
    c.save(); c.shadowColor = col; c.shadowBlur = 12;
    var p = makePen(c);
    p.px = function (x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); };
    if (def.id === 'sweat') p.drop(60, 60, 7);
    else if (def.id === 'anger') p.anger(60, 60, 7);
    else if (def.id === 'zzz') p.zzz(60, 60, 7);
    else if (def.id === 'qmark') p.qmark(60, 60, 7);
    else if (def.id === 'hearts') p.heart(60, 60, 5);
    else if (def.id === 'sparkle') {
      c.fillStyle = col;
      c.fillRect(30, 55, 60, 12); c.fillRect(54, 31, 12, 60);
    } else if (def.id === 'notes') drawPat(p, ['####..#', '####..#', '####..#', '...#..#', '.###.##'], 60, 60, 5);
    else if (def.id === 'bulb') drawPat(p, ['.###.', '#...#', '#...#', '.###.', '..#..', '.###.'], 60, 60, 6);
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

  function buildOptions() {
    // 全部姿势均为手绘 3D 模型（官方 PNG 仅作底部参考，不用于生成）
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
    // 贴纸
    var sg = document.getElementById('stickerGrid');
    STICKERS.forEach(function (def) {
      var b = optTile(buildStickerThumb(def), def.label, false);
      b.dataset.v = def.id;
      b.onclick = function () {
        S.stickers[def.id] = !S.stickers[def.id];
        b.classList.toggle('active', S.stickers[def.id]);
        repaint();
      };
      sg.appendChild(b);
    });
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
    // 参考图
    var gal = document.getElementById('gallery');
    ASSETS.gallery.forEach(function (g) {
      var fig = document.createElement('figure');
      fig.className = 'g'; fig.style.margin = '0';
      var im = new Image(); im.src = g.data; im.alt = g.label; im.loading = 'lazy';
      var cap = document.createElement('figcaption'); cap.textContent = g.label;
      fig.appendChild(im); fig.appendChild(cap);
      gal.appendChild(fig);
    });
  }

  /* ---------------- 表情格子（内置 + 自定义 + 自己画） ---------------- */
  function buildFaceGrid() {
    var fg = document.getElementById('faceGrid');
    fg.innerHTML = '';
    FACES.forEach(function (def) {
      var b = optTile(buildFaceThumb(def), def.label, S.face === def.id);
      b.dataset.v = def.id;
      b.onclick = function () { setFace(def.id); };
      if (def.custom) {
        b.classList.add('opt-custom');
        var pen = document.createElement('span');
        pen.className = 'opt-edit';
        pen.textContent = '✎';
        pen.title = '编辑 / 删除这个自定义表情';
        pen.onclick = function (e) { e.stopPropagation(); openFaceEditor(def); };
        b.appendChild(pen);
      }
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

  /* ---------------- 像素表情画板 ---------------- */
  var FE_COLORS = [
    ['#9ff7e4', '青'], ['#f2ffff', '白'], ['#ff5a4e', '红'], ['#ff9bd3', '粉'],
    ['#ffd75e', '黄'], ['#6fcbff', '蓝'], ['#8ef58e', '绿'], ['#ffa14a', '橙']
  ];
  var FE_CELL = 14, FE_UNDO_MAX = 40;
  var FE = { cells: [], color: FE_COLORS[0][0], tool: 'pen', size: 1, mirror: false, undo: [], editing: null, drawing: false, last: null };
  var feEl = {};

  function feBlank() { var a = new Array(FW * FH); for (var i = 0; i < a.length; i++) a[i] = ''; return a; }

  function feBind() {
    feEl.modal = document.getElementById('faceEditor');
    feEl.canvas = document.getElementById('feCanvas');
    feEl.preview = document.getElementById('fePreview');
    feEl.name = document.getElementById('feName');
    feEl.glow = document.getElementById('feGlow');
    feEl.mirror = document.getElementById('feMirror');
    feEl.del = document.getElementById('feDelete');
    feEl.title = document.getElementById('feTitle');
    feEl.palette = document.getElementById('feColors');
    feEl.sizeWrap = document.getElementById('feSize');

    FE_COLORS.forEach(function (pair) {
      var sw = document.createElement('button');
      sw.type = 'button'; sw.className = 'fe-sw'; sw.dataset.c = pair[0];
      sw.style.setProperty('--c', pair[0]); sw.title = pair[1];
      sw.onclick = function () {
        FE.color = pair[0];
        if (FE.tool === 'eraser') FE.tool = 'pen';
        feSyncTools();
      };
      feEl.palette.appendChild(sw);
      var op = document.createElement('option');
      op.value = pair[0]; op.textContent = pair[1];
      feEl.glow.appendChild(op);
    });
    [].forEach.call(document.querySelectorAll('#feTools .fe-tool'), function (b) {
      b.onclick = function () { FE.tool = b.dataset.tool; feSyncTools(); };
    });
    [].forEach.call(feEl.sizeWrap.querySelectorAll('.fe-size'), function (b) {
      b.onclick = function () { FE.size = +b.dataset.s; feSyncTools(); };
    });
    feEl.mirror.onchange = function () { FE.mirror = feEl.mirror.checked; };
    feEl.glow.onchange = function () { fePreview(); };

    feEl.canvas.addEventListener('pointerdown', function (e) {
      var p = feCellAt(e);
      if (!p) return;
      e.preventDefault();
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
  }

  function openFaceEditor(def) {
    FE.editing = def || null;
    FE.cells = def ? def.cells.slice() : feBlank();
    FE.undo = [];
    FE.tool = 'pen';
    FE.size = 1;
    FE.mirror = false;
    FE.color = FE_COLORS[0][0];
    FE.drawing = false; FE.last = null;
    if (!feEl.modal) feBind();
    feEl.name.value = def ? def.label : '';
    feEl.glow.value = def ? def.glow : FE_COLORS[0][0];
    feEl.mirror.checked = false;
    feEl.del.classList.toggle('hidden', !def);
    feEl.title.textContent = def ? '编辑表情' : '画一个新表情';
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

  function feCellAt(e) {
    var r = feEl.canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * FW);
    var y = Math.floor((e.clientY - r.top) / r.height * FH);
    if (x < 0 || x >= FW || y < 0 || y >= FH) return null;
    return [x, y];
  }
  function feStamp(x, y) {
    var col = FE.tool === 'eraser' ? '' : FE.color;
    var n = FE.size, off = Math.floor((n - 1) / 2);
    for (var dy = 0; dy < n; dy++) for (var dx = 0; dx < n; dx++) {
      var px = x - off + dx, py = y - off + dy;
      if (px < 0 || px >= FW || py < 0 || py >= FH) continue;
      FE.cells[py * FW + px] = col;
      if (FE.mirror) FE.cells[py * FW + (FW - 1 - px)] = col;
    }
  }
  function feLine(x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    for (;;) {
      feStamp(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  function feFlood(x, y, col) {
    var target = FE.cells[y * FW + x];
    if (target === col) return;
    var stack = [[x, y]];
    while (stack.length) {
      var p = stack.pop(), cx = p[0], cy = p[1];
      if (cx < 0 || cx >= FW || cy < 0 || cy >= FH) continue;
      if (FE.cells[cy * FW + cx] !== target) continue;
      FE.cells[cy * FW + cx] = col;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function fePushUndo() {
    FE.undo.push(FE.cells.slice());
    if (FE.undo.length > FE_UNDO_MAX) FE.undo.shift();
  }
  function feLoadTemplate(id) {
    var src = getFaceCanvas(id).cv;
    var tmp = document.createElement('canvas');
    tmp.width = FW; tmp.height = FH;
    var tc = tmp.getContext('2d');
    tc.drawImage(src, 0, 0);
    var data = tc.getImageData(0, 0, FW, FH).data;
    var cells = feBlank();
    for (var i = 0; i < FW * FH; i++) {
      if (data[i * 4 + 3] > 8) {
        cells[i] = '#' + [0, 1, 2].map(function (k) {
          return ('0' + data[i * 4 + k].toString(16)).slice(-2);
        }).join('');
      }
    }
    FE.cells = cells;
  }

  function fePaintUpdate() {
    feRenderGrid();
    fePreview();
  }
  function feRenderGrid() {
    var cv = feEl.canvas, c = cv.getContext('2d'), S = FE_CELL;
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#0a1114'; c.fillRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < FH; y++) for (var x = 0; x < FW; x++) {
      var col = FE.cells[y * FW + x];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * S, y * S, S, S);
    }
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(87,230,196,.10)';
    for (var i = 0; i <= FW; i++) {
      c.beginPath(); c.moveTo(i * S + .5, 0); c.lineTo(i * S + .5, FH * S); c.stroke();
    }
    for (var j = 0; j <= FH; j++) {
      c.beginPath(); c.moveTo(0, j * S + .5); c.lineTo(FW * S, j * S + .5); c.stroke();
    }
    c.strokeStyle = 'rgba(87,230,196,.22)';
    c.beginPath(); c.moveTo(FW * S / 2 + .5, 0); c.lineTo(FW * S / 2 + .5, FH * S); c.stroke();
  }
  function fePreview() {
    var cv = feEl.preview, c = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#10171b';
    roundRect(c, 6, 8, w - 12, h - 16, 10); c.fill();
    var tmp = document.createElement('canvas');
    tmp.width = FW; tmp.height = FH;
    drawCells(makePen(tmp.getContext('2d')), FE.cells);
    var dw = w - 40, dh = dw * FH / FW;
    var dx = (w - dw) / 2, dy = (h - dh) / 2;
    c.imageSmoothingEnabled = false;
    c.save();
    c.shadowColor = feEl.glow.value || FE_COLORS[0][0];
    c.shadowBlur = 16;
    c.drawImage(tmp, dx, dy, dw, dh);
    c.restore();
    c.drawImage(tmp, dx, dy, dw, dh);
  }
  function feGlowInput() { return feEl.glow.value || FE_COLORS[0][0]; }

  function feSave() {
    var label = (feEl.name.value || '').trim().slice(0, 8) || '我的表情';
    var glow = feGlowInput();
    var ink = false;
    for (var i = 0; i < FE.cells.length; i++) if (FE.cells[i]) { ink = true; break; }
    if (!ink) { toast('画板是空的，先画两个眼睛吧'); return; }
    var rec = null;
    if (FE.editing) {
      rec = CUSTOM_FACES.find(function (r) { return r.id === FE.editing.id; });
      if (!rec) { toast('这个表情已经不在了'); closeFaceEditor(); return; }
      rec.label = label; rec.glow = glow; rec.cells = FE.cells.slice();
      delete faceCache[rec.id];
    } else {
      if (CUSTOM_FACES.length >= CUSTOM_MAX) { toast('自定义表情最多 ' + CUSTOM_MAX + ' 个，先删掉一些'); return; }
      rec = {
        id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100),
        label: label, glow: glow, cells: FE.cells.slice()
      };
      CUSTOM_FACES.push(rec);
    }
    var ok = persistCustomFaces();
    rebuildFaces();
    buildFaceGrid();
    setFace(rec.id);
    closeFaceEditor();
    toast(ok ? '已保存「' + label + '」' : '已保存「' + label + '」（本地存储不可用，刷新会丢失）');
  }
  function feDelete() {
    if (!FE.editing) return;
    var rec = CUSTOM_FACES.find(function (r) { return r.id === FE.editing.id; });
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
    S.stickers = {};
    STICKERS.forEach(function (s) { S.stickers[s.id] = false; });
    Object.keys(p.stickers || {}).forEach(function (k) { S.stickers[k] = true; });
    document.getElementById('textInput').value = S.text.content;
    document.getElementById('textSize').value = S.text.size;
    setTextPos(S.text.pos); setTextStyle(S.text.style);
    setActive(document.getElementById('textColor'), S.text.color);
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    [].forEach.call(document.getElementById('stickerGrid').children, function (c) {
      c.classList.toggle('active', !!S.stickers[c.dataset.v]);
    });
    repaint();
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
  // 画布拖拽 → 转动身体（仅手绘模型）
  (function drag() {
    var dragging = false, lx = 0, ly = 0;
    function isProc() { return !!PROC_POSES[S.pose]; }
    stage.addEventListener('pointerdown', function (e) {
      if (!isProc()) return;
      dragging = true; lx = e.clientX; ly = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (!S.rig) S.rig = rigClone(REST_RIG);
      S.rig.bodyYaw = Math.max(-50, Math.min(50, S.rig.bodyYaw + (e.clientX - lx) * 0.35));
      S.rig.bodyPitch = Math.max(-25, Math.min(25, S.rig.bodyPitch + (e.clientY - ly) * 0.25));
      lx = e.clientX; ly = e.clientY;
      syncRigUI();
      repaint();
    });
    stage.addEventListener('pointerup', function () { dragging = false; });
    stage.addEventListener('pointercancel', function () { dragging = false; });
  })();

  /* ---------------- 交互绑定 ---------------- */
  [].forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () {
      [].forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      [].forEach.call(document.querySelectorAll('.tab-body'), function (b) { b.classList.add('hidden'); });
      document.getElementById('tab-' + t.dataset.tab).classList.remove('hidden');
    };
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
    S.text = { content: '', pos: 'bottom', style: 'meme', color: '#ffffff', size: 1 };
    STICKERS.forEach(function (s) { S.stickers[s.id] = false; });
    document.getElementById('textInput').value = '';
    document.getElementById('textSize').value = 1;
    setTextPos('bottom'); setTextStyle('meme');
    setActive(document.getElementById('textColor'), '#ffffff');
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    [].forEach.call(document.getElementById('stickerGrid').children, function (c) { c.classList.remove('active'); });
    repaint();
  };
  document.getElementById('btnRandom').onclick = function () {
    var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var poses = Object.keys(PROC_POSES);
    S.pose = pick(poses);
    S.face = pick(FACES).id;
    if (Math.random() < .6) S.bg = pick(BGS).id;
    S.stickers = {};
    STICKERS.forEach(function (x) { S.stickers[x.id] = Math.random() < .18; });
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
    [].forEach.call(document.getElementById('stickerGrid').children, function (c) {
      c.classList.toggle('active', !!S.stickers[c.dataset.v]);
    });
    repaint();
  };

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
    var keep = JSON.stringify(S);
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

  function restoreState(st) {
    S.pose = st.pose; S.face = st.face; S.bg = st.bg;
    S.text = JSON.parse(JSON.stringify(st.text));
    S.stickers = JSON.parse(JSON.stringify(st.stickers));
    document.getElementById('textInput').value = S.text.content;
    document.getElementById('textSize').value = S.text.size;
    setTextPos(S.text.pos); setTextStyle(S.text.style);
    setActive(document.getElementById('textColor'), S.text.color);
    setPose(S.pose); setFace(S.face); setBg(S.bg);
    S.rig = st.rig ? rigClone(st.rig) : rigClone(REST_RIG); // setPose 会载入预设姿势，这里恢复用户自定义骨骼
    syncRigUI();
    [].forEach.call(document.getElementById('stickerGrid').children, function (c) {
      c.classList.toggle('active', !!S.stickers[c.dataset.v]);
    });
    repaint();
  }

  /* ---------------- 头像 logo ---------------- */
  (function logo() {
    var cv = document.getElementById('logoCanvas');
    var c = cv.getContext('2d');
    c.fillStyle = '#141719'; c.fillRect(0, 0, 52, 52);
    c.fillStyle = '#232a2e'; roundRect(c, 8, 12, 36, 28, 4); c.fill();
    c.fillStyle = '#0e1418'; c.fillRect(13, 17, 26, 16);
    c.save();
    c.shadowColor = C.cyan; c.shadowBlur = 6;
    c.fillStyle = C.cyan;
    [[19, 25], [33, 25]].forEach(function (p) {
      c.beginPath();
      c.moveTo(p[0], p[1] - 4); c.lineTo(p[0] + 3.4, p[1]); c.lineTo(p[0], p[1] + 4); c.lineTo(p[0] - 3.4, p[1]);
      c.closePath(); c.fill();
    });
    c.restore();
  })();

  /* ---------------- 启动 ---------------- */
  // 调试/高级用法句柄
  window.__traeEmoji = { S: S, repaint: repaint, FACES: FACES, setFace: setFace, setPose: setPose, setBg: setBg, dbg3d: { buildSkeleton: buildSkeleton, projectV: projectV, GEO3D: GEO3D, applyM: applyM, mIdent0: mIdent0, mMul: mMul, mT: mT, mRX: mRX, mRY: mRY, mRZ: mRZ, V3: V3, CAM: CAM, FACE_DEFS: FACE_DEFS, rotOnly: rotOnly, shadeHex: shadeHex, LIGHT: LIGHT } };
  function init() {
    feBind();
    buildRigUI();
    syncRigUI();
    buildOptions();
    repaint();
  }
  init();
})();
