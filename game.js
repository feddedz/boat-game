/* TURBO TIDE - arcade speedboat racer. No dependencies, no assets: everything is drawn and synthesised at runtime. */
(() => {
'use strict';

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);
const TAU = Math.PI * 2;
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mk(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
}
const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
};
const ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];

// ---------------------------------------------------------------- constants
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 1280, H = 720, U = H * 0.75;

const SEG = 200;               // segment length
const ROAD = 2200;             // channel half width
const CAM_H = 800;             // camera height above the water
const DRAW = 260;              // segments drawn
const RUMBLE = 3;
const BASE_FOV = 100;
const BASE_DEPTH = 1 / Math.tan((BASE_FOV / 2) * Math.PI / 180);
const PLAYER_Z = BASE_DEPTH * CAM_H * 0.75 / 0.36;   // boat sits ~86% down the screen
const MAX_SPEED = SEG * 60;
const BOOST_MULT = 1.32;
const ACCEL = MAX_SPEED / 4;
const BRAKE = -MAX_SPEED / 1.4;
const DECEL = -MAX_SPEED / 6;
const OFF_DECEL = -MAX_SPEED / 1.1;
const OFF_LIMIT = MAX_SPEED / 3.2;
const BOAT_W = 520;
const TOTAL_LAPS = 3;
const GATE_SEG = 36;
const GRAVITY = 6000;
const FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';

// ---------------------------------------------------------------- themes
const THEMES = [
  { id: 'coral', name: 'CORAL COVE', diff: 'EASY', stars: 1, seed: 7, segs: 2400, curve: 3.2, hill: 30, pace: 0.8, rival: 0.97, hazard: 0.22,
    sky: ['#1560c8', '#58b8f5', '#d9f6ff'], sun: { x: 0.72, y: 0.3, r: 44, c: '#fffbd6', glow: '255,244,180' },
    fog: '#c9eef7', fogD: 3.5, water: ['#18b4d6', '#11a3c6'], glint: 'rgba(255,255,255,.5)', foam: '#eaffff',
    bank: ['#f4e3a8', '#e7d08b'], ground: ['#42b04c', '#399f43'], decor: ['palm', 'palm', 'palm', 'bush', 'rock', 'hut'] },
  { id: 'canyon', name: 'CANYON FURY', diff: 'MEDIUM', stars: 2, seed: 23, segs: 2700, curve: 4.6, hill: 50, pace: 0.86, rival: 1.0, hazard: 0.34,
    sky: ['#3b1e6e', '#e8563f', '#ffd27a'], sun: { x: 0.3, y: 0.42, r: 60, c: '#fff1b0', glow: '255,190,90' },
    fog: '#f6b877', fogD: 4, water: ['#1f8f9c', '#19808d'], glint: 'rgba(255,225,170,.5)', foam: '#fff3d9',
    bank: ['#e2a765', '#d39552'], ground: ['#b9542c', '#a94a26'], decor: ['cactus', 'spire', 'spire', 'boulder', 'cactus', 'mesa'] },
  { id: 'neon', name: 'NEON HARBOR', diff: 'HARD', stars: 3, seed: 91, segs: 3000, curve: 5.6, hill: 40, pace: 0.92, rival: 1.02, hazard: 0.46,
    sky: ['#05021a', '#1a0b4a', '#5a1e7a'], sun: { x: 0.2, y: 0.22, r: 30, c: '#f1f4ff', glow: '170,190,255' },
    fog: '#3a1c66', fogD: 4.5, water: ['#0c2a6b', '#0a2460'], glint: 'rgba(255,90,220,.55)', foam: '#7ef9ff',
    bank: ['#2b2f4a', '#ff3fb4'], ground: ['#15182b', '#101326'], decor: ['tower', 'tower', 'tower', 'sign', 'lamp', 'tower'] },
];

const BOATS = [
  { name: 'RED SHARK',   body: '#e3212b', dark: '#8f0f18', deck: '#f7f7f7', stripe: '#ffd23c' },
  { name: 'BLUE MARLIN', body: '#1c6cf0', dark: '#0d3a94', deck: '#f2f7ff', stripe: '#ff6a2b' },
  { name: 'GOLD RUSH',   body: '#ffc21c', dark: '#a56d00', deck: '#2a2a33', stripe: '#e3212b' },
  { name: 'VENOM',       body: '#3ddc4b', dark: '#127a22', deck: '#16161d', stripe: '#c63cff' },
];
const RIVAL_COLS = [
  { body: '#ff7a1a', dark: '#9c3f00', deck: '#fff', stripe: '#222' },
  { body: '#b03cff', dark: '#5a1291', deck: '#fff', stripe: '#ffe14a' },
  { body: '#19d3c5', dark: '#0b7a72', deck: '#fff', stripe: '#ff3f7f' },
  { body: '#f4f4f4', dark: '#8a8f99', deck: '#d22', stripe: '#1c6cf0' },
  { body: '#ff4fa0', dark: '#9a1f58', deck: '#fff', stripe: '#19d3c5' },
  { body: '#2b2f3a', dark: '#0d0f14', deck: '#ffc21c', stripe: '#ffc21c' },
  { body: '#7ac943', dark: '#3d7a17', deck: '#fff', stripe: '#1b1b1b' },
];

// ---------------------------------------------------------------- sprite painting
const S = {};
function leaf(c, x, y, a, l, col) {
  const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l + l * 0.35;
  const mx = x + Math.cos(a) * l * 0.55, my = y + Math.sin(a) * l * 0.55;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y);
  c.quadraticCurveTo(mx, my - l * 0.32, ex, ey);
  c.quadraticCurveTo(mx, my + l * 0.08, x, y);
  c.fill();
}
function buildSprites() {
  S.palm = { w: 900, img: mk(240, 320, (c) => {
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 18; c.lineCap = 'round';
    c.beginPath(); c.moveTo(105, 318); c.quadraticCurveTo(92, 200, 126, 104); c.stroke();
    c.strokeStyle = '#5f3b18'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const t = i / 9, y = 310 - t * 200, x = 104 + Math.sin(t * 1.5) * 16 - 9 + t * t * 14; c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 16, y - 4); c.stroke(); }
    const fr = [[-2.9, 105], [-2.3, 110], [-1.75, 92], [-1.2, 108], [-0.6, 112], [-0.05, 96], [3.4, 92]];
    fr.forEach(([a, l], i) => leaf(c, 126, 100, a, l, i % 2 ? '#1f8a36' : '#2aa644'));
    fr.forEach(([a, l]) => leaf(c, 126, 100, a + 0.22, l * 0.7, '#48c75d'));
    c.fillStyle = '#5a3414'; [[120, 108], [134, 110], [127, 118]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); });
  }) };
  S.bush = { w: 620, img: mk(200, 110, (c) => {
    [[50, 70, 42, '#237d33'], [100, 55, 52, '#2c9a40'], [150, 72, 40, '#237d33'], [78, 80, 34, '#3bb552'], [125, 82, 34, '#3bb552']].forEach(([x, y, r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    c.fillStyle = '#ff5fa2'; [[60, 60], [112, 40], [140, 70], [90, 78]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); });
    c.clearRect(0, 104, 200, 6);
  }) };
  const rockPainter = (base, lite, dark) => (c) => {
    c.fillStyle = base; c.beginPath(); c.moveTo(6, 120); c.lineTo(22, 58); c.lineTo(64, 14); c.lineTo(120, 8); c.lineTo(160, 46); c.lineTo(176, 120); c.fill();
    c.fillStyle = lite; c.beginPath(); c.moveTo(64, 14); c.lineTo(120, 8); c.lineTo(104, 56); c.lineTo(52, 62); c.fill();
    c.fillStyle = dark; c.beginPath(); c.moveTo(104, 56); c.lineTo(160, 46); c.lineTo(176, 120); c.lineTo(112, 120); c.fill();
  };
  S.rock = { w: 640, img: mk(182, 120, rockPainter('#8b8f98', '#b9bec8', '#636773')) };
  S.boulder = { w: 700, img: mk(182, 120, rockPainter('#b5562d', '#de8048', '#7d3318')) };
  S.hut = { w: 900, img: mk(220, 200, (c) => {
    c.fillStyle = '#7a4a22'; [[40, 110], [170, 110]].forEach(([x, y]) => c.fillRect(x, y, 10, 90));
    c.fillStyle = '#c8935a'; c.fillRect(46, 104, 128, 66);
    c.fillStyle = '#3a2412'; c.fillRect(94, 122, 32, 48);
    c.fillStyle = '#d9b34a'; c.beginPath(); c.moveTo(10, 110); c.lineTo(110, 14); c.lineTo(210, 110); c.fill();
    c.strokeStyle = '#a8842c'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(110, 16); c.lineTo(22 + i * 22, 110); c.stroke(); }
  }) };
  S.cactus = { w: 520, img: mk(150, 250, (c) => {
    c.fillStyle = '#2f8f4a';
    const rr = (x, y, w, h) => { c.beginPath(); c.roundRect(x, y, w, h, w / 2); c.fill(); };
    rr(56, 10, 38, 240); rr(10, 80, 28, 80); rr(10, 132, 62, 28); rr(112, 50, 28, 90); rr(80, 112, 60, 28);
    c.fillStyle = '#51b96a'; rr(62, 18, 9, 220); rr(15, 86, 6, 60); rr(117, 58, 6, 68);
  }) };
  S.spire = { w: 950, img: mk(220, 420, (c, w, h) => {
    c.fillStyle = '#b0502a'; c.beginPath(); c.moveTo(20, h); c.lineTo(46, 150); c.lineTo(60, 40); c.lineTo(100, 8); c.lineTo(150, 30); c.lineTo(170, 160); c.lineTo(204, h); c.fill();
    c.fillStyle = '#d97a44'; c.beginPath(); c.moveTo(60, 40); c.lineTo(100, 8); c.lineTo(112, 150); c.lineTo(96, h); c.lineTo(20, h); c.lineTo(46, 150); c.fill();
    c.fillStyle = 'rgba(90,30,12,.35)'; for (let y = 60; y < h; y += 46) c.fillRect(20, y, 190, 9);
    c.globalCompositeOperation = 'destination-in';
    c.beginPath(); c.moveTo(20, h); c.lineTo(46, 150); c.lineTo(60, 40); c.lineTo(100, 8); c.lineTo(150, 30); c.lineTo(170, 160); c.lineTo(204, h); c.fill();
  }) };
  S.mesa = { w: 1900, img: mk(360, 260, (c, w, h) => {
    const p = () => { c.beginPath(); c.moveTo(0, h); c.lineTo(34, 70); c.lineTo(60, 26); c.lineTo(300, 22); c.lineTo(326, 80); c.lineTo(w, h); };
    c.fillStyle = '#a84a26'; p(); c.fill();
    c.fillStyle = '#d0703d'; c.beginPath(); c.moveTo(34, 70); c.lineTo(60, 26); c.lineTo(300, 22); c.lineTo(250, 74); c.fill();
    c.fillStyle = 'rgba(80,25,10,.3)'; for (let y = 90; y < h; y += 40) c.fillRect(0, y, w, 10);
    c.globalCompositeOperation = 'destination-in'; p(); c.fill();
  }) };
  const r = rng(1234);
  const tower = (hue) => mk(200, 520, (c, w, h) => {
    c.fillStyle = '#0c0f22'; c.fillRect(14, 30, w - 28, h - 30);
    c.fillStyle = '#161a36'; c.fillRect(14, 30, 30, h - 30);
    for (let y = 48; y < h - 14; y += 22) for (let x = 26; x < w - 30; x += 20) {
      const v = r();
      if (v < 0.5) { c.fillStyle = v < 0.1 ? '#fff6c4' : `hsla(${hue + v * 80},100%,65%,${0.5 + v})`; c.fillRect(x, y, 11, 13); }
    }
    c.strokeStyle = `hsl(${hue},100%,60%)`; c.lineWidth = 5; c.shadowColor = c.strokeStyle; c.shadowBlur = 16;
    c.strokeRect(16, 32, w - 32, h - 20);
    c.beginPath(); c.moveTo(w / 2, 30); c.lineTo(w / 2, 2); c.stroke();
  });
  S.tower = { w: 1300, img: tower(310) };
  S.tower2 = { w: 1100, img: tower(185) };
  S.tower3 = { w: 1500, img: tower(50) };
  S.sign = { w: 1000, img: mk(260, 260, (c) => {
    c.fillStyle = '#23263c'; c.fillRect(60, 110, 12, 150); c.fillRect(188, 110, 12, 150);
    c.fillStyle = '#0b0d1c'; c.fillRect(6, 10, 248, 110);
    c.shadowBlur = 18; c.shadowColor = '#ff3fb4'; c.strokeStyle = '#ff3fb4'; c.lineWidth = 6; c.strokeRect(10, 14, 240, 102);
    c.shadowColor = '#3ff3ff'; c.fillStyle = '#3ff3ff'; c.font = 'italic 900 50px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('TURBO', 130, 46); c.shadowColor = '#ffe14a'; c.fillStyle = '#ffe14a'; c.font = 'italic 900 34px ' + FONT; c.fillText('TIDE COLA', 130, 92);
  }) };
  S.lamp = { w: 360, img: mk(90, 300, (c) => {
    c.fillStyle = '#2b2f4a'; c.fillRect(40, 30, 10, 270);
    c.shadowBlur = 30; c.shadowColor = '#ffe9a0'; c.fillStyle = '#fff4c8'; c.beginPath(); c.arc(45, 28, 18, 0, TAU); c.fill(); c.fill();
  }) };
  const buoy = (col) => mk(60, 110, (c) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(30, 6); c.lineTo(52, 92); c.lineTo(8, 92); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(19, 50); c.lineTo(41, 50); c.lineTo(45, 66); c.lineTo(15, 66); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(30, 94, 28, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffffa8'; c.shadowBlur = 10; c.shadowColor = '#ffff80'; c.beginPath(); c.arc(30, 8, 6, 0, TAU); c.fill();
  });
  S.buoyR = { w: 150, img: buoy('#e8262e') };
  S.buoyG = { w: 150, img: buoy('#1fbf4c') };
  const chev = (dir) => mk(220, 190, (c) => {
    c.fillStyle = '#3b3f4d'; c.fillRect(30, 100, 12, 90); c.fillRect(178, 100, 12, 90);
    c.fillStyle = '#ffd21c'; c.fillRect(4, 4, 212, 108); c.strokeStyle = '#111'; c.lineWidth = 6; c.strokeRect(4, 4, 212, 108);
    c.fillStyle = '#111';
    for (let i = 0; i < 3; i++) {
      const x = 110 + (i - 1) * 58 * dir;
      c.beginPath(); c.moveTo(x - 22 * dir, 16); c.lineTo(x + 4 * dir, 16); c.lineTo(x + 28 * dir, 58); c.lineTo(x + 4 * dir, 100); c.lineTo(x - 22 * dir, 100); c.lineTo(x + 2 * dir, 58); c.fill();
    }
  });
  S.chevL = { w: 760, img: chev(-1) };
  S.chevR = { w: 760, img: chev(1) };
  const gate = (text, colA, colB, checker) => mk(1040, 400, (c, w, h) => {
    [0, 960].forEach((x) => {
      const g = c.createLinearGradient(x, 0, x + 80, 0); g.addColorStop(0, '#5d6677'); g.addColorStop(0.5, '#e6ecf5'); g.addColorStop(1, '#4a5263');
      c.fillStyle = g; c.fillRect(x + 10, 20, 60, h - 20);
      for (let y = 150; y < h; y += 60) { c.fillStyle = colA; c.fillRect(x + 10, y, 60, 26); }
      c.fillStyle = '#ffec7a'; c.beginPath(); c.arc(x + 40, 16, 15, 0, TAU); c.fill();
    });
    c.fillStyle = '#12151f'; c.fillRect(0, 24, w, 112);
    c.fillStyle = colA; c.fillRect(8, 32, w - 16, 96);
    if (checker) for (let i = 0; i < 52; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(8 + i * (w - 16) / 52, 32 + j * 14 + (j ? 68 : 0), (w - 16) / 52 + 1, 14); }
    c.font = 'italic 900 ' + (checker ? 62 : 78) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = '#12151f'; c.lineJoin = 'round'; c.strokeText(text, w / 2, 82); c.fillStyle = colB; c.fillText(text, w / 2, 82);
  });
  S.gateStart = { w: ROAD * 2.6, img: gate('START  /  FINISH', '#d81f2a', '#fff', true) };
  S.gateCP = { w: ROAD * 2.6, img: gate('CHECKPOINT', '#ffc21c', '#fff', false) };
  S.ramp = { w: 900, img: mk(300, 130, (c) => {
    c.fillStyle = '#20242e'; c.beginPath(); c.moveTo(0, 130); c.lineTo(36, 14); c.lineTo(264, 14); c.lineTo(300, 130); c.fill();
    c.save(); c.beginPath(); c.moveTo(10, 124); c.lineTo(42, 22); c.lineTo(258, 22); c.lineTo(290, 124); c.clip();
    c.fillStyle = '#ffcf1c'; c.fillRect(0, 0, 300, 130);
    c.fillStyle = '#16181f';
    for (let i = 0; i < 3; i++) { const y = 112 - i * 34; c.beginPath(); c.moveTo(60, y); c.lineTo(150, y - 30); c.lineTo(240, y); c.lineTo(240, y + 14); c.lineTo(150, y - 16); c.lineTo(60, y + 14); c.fill(); }
    c.restore();
    c.fillStyle = '#e8262e'; c.fillRect(30, 8, 240, 10);
  }) };
  S.boost = { w: 330, img: mk(140, 170, (c) => {
    c.shadowBlur = 22; c.shadowColor = '#3ff3ff';
    const g = c.createLinearGradient(30, 0, 110, 0); g.addColorStop(0, '#0a66d8'); g.addColorStop(0.45, '#7fe9ff'); g.addColorStop(1, '#0a4fb0');
    c.fillStyle = g; c.beginPath(); c.roundRect(34, 34, 72, 116, 22); c.fill();
    c.shadowBlur = 0; c.fillStyle = '#d7dde8'; c.fillRect(56, 14, 28, 24); c.fillStyle = '#8791a3'; c.fillRect(48, 8, 44, 10);
    c.fillStyle = '#ffe14a'; c.strokeStyle = '#7a4a00'; c.lineWidth = 4; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(78, 52); c.lineTo(52, 98); c.lineTo(68, 98); c.lineTo(60, 136); c.lineTo(90, 86); c.lineTo(73, 86); c.closePath(); c.stroke(); c.fill();
  }) };
  S.log = { w: 950, hit: 0.26, img: mk(300, 80, (c) => {
    const g = c.createLinearGradient(0, 10, 0, 76); g.addColorStop(0, '#b47a40'); g.addColorStop(1, '#5d3613');
    c.fillStyle = g; c.beginPath(); c.roundRect(4, 14, 292, 58, 28); c.fill();
    c.strokeStyle = '#4a2a0e'; c.lineWidth = 3; [[60, 30, 120], [150, 46, 90], [40, 56, 70], [200, 28, 60]].forEach(([x, y, l]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); });
    c.fillStyle = '#e3bd84'; c.beginPath(); c.ellipse(276, 43, 16, 27, 0, 0, TAU); c.fill();
    c.strokeStyle = '#9a6a33'; c.beginPath(); c.ellipse(276, 43, 8, 14, 0, 0, TAU); c.stroke();
    c.clearRect(0, 66, 300, 14);
  }) };
  S.mine = { w: 430, hit: 0.17, img: mk(140, 130, (c) => {
    c.strokeStyle = '#2a2d36'; c.lineWidth = 9; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; c.beginPath(); c.moveTo(70 + Math.cos(a) * 30, 68 + Math.sin(a) * 30); c.lineTo(70 + Math.cos(a) * 58, 68 + Math.sin(a) * 58); c.stroke(); }
    const g = c.createRadialGradient(56, 52, 4, 70, 68, 46); g.addColorStop(0, '#7b8496'); g.addColorStop(1, '#1d2029');
    c.fillStyle = g; c.beginPath(); c.arc(70, 68, 44, 0, TAU); c.fill();
    c.fillStyle = '#ff2a2a'; c.shadowBlur = 14; c.shadowColor = '#ff2a2a'; c.beginPath(); c.arc(70, 68, 11, 0, TAU); c.fill();
    c.shadowBlur = 0; c.clearRect(0, 112, 140, 18);
  }) };
  S.barrel = { w: 380, hit: 0.16, img: mk(110, 130, (c) => {
    const g = c.createLinearGradient(8, 0, 102, 0); g.addColorStop(0, '#a3131b'); g.addColorStop(0.4, '#ff5a52'); g.addColorStop(1, '#8a0d14');
    c.fillStyle = g; c.beginPath(); c.roundRect(10, 8, 90, 118, 14); c.fill();
    c.fillStyle = '#ffe14a'; c.fillRect(10, 34, 90, 12); c.fillRect(10, 84, 90, 12);
    c.clearRect(0, 112, 110, 18);
  }) };
}

// ---------------------------------------------------------------- backgrounds
const BGW = 2048, BGH = 360;
function ridge(c, base, amp, col, seed, harm, quant) {
  const r = rng(seed), ph = [], am = [];
  for (let k = 0; k < harm; k++) { ph.push(r() * TAU); am.push((0.4 + r() * 0.6) / (k + 1)); }
  const tot = am.reduce((a, b) => a + b, 0);
  c.fillStyle = col; c.beginPath(); c.moveTo(0, BGH);
  for (let x = 0; x <= BGW; x += 4) {
    let v = 0;
    for (let k = 0; k < harm; k++) v += Math.sin(TAU * (k + 1) * x / BGW + ph[k]) * am[k];
    v = (v / tot) * 0.5 + 0.5;
    if (quant) v = Math.round(v * quant) / quant;
    c.lineTo(x, base - v * amp);
  }
  c.lineTo(BGW, BGH); c.fill();
}
function clouds(c, col, n, seed, ymax) {
  const r = rng(seed); c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const x = 120 + r() * (BGW - 240), y = 30 + r() * ymax, s = 0.6 + r();
    for (let j = 0; j < 6; j++) { c.beginPath(); c.ellipse(x + (j - 2.5) * 26 * s, y + Math.sin(j * 2.1) * 7 * s, 34 * s, 15 * s, 0, 0, TAU); c.fill(); }
  }
}
function skyline(c, seed, base, hmin, hmax, body, lit) {
  const r = rng(seed); let x = 0;
  while (x < BGW) {
    const w = Math.min(30 + r() * 60, BGW - x), h = hmin + r() * r() * (hmax - hmin);
    c.fillStyle = body; c.fillRect(x, base - h, w + 1, h + BGH);
    for (let yy = base - h + 8; yy < base - 6; yy += 11) for (let xx = x + 5; xx < x + w - 6; xx += 9) {
      if (r() < 0.36) { c.fillStyle = lit[(r() * lit.length) | 0]; c.fillRect(xx, yy, 4, 5); }
    }
    if (r() < 0.3) { c.fillStyle = '#ff3355'; c.fillRect(x + w / 2 - 1, base - h - 14, 2, 14); c.fillRect(x + w / 2 - 2, base - h - 17, 4, 4); }
    x += w;
  }
}
function buildBackground(th) {
  const L = [];
  if (th.id === 'coral') {
    L.push({ sp: 0.0006, img: mk(BGW, BGH, (c) => clouds(c, 'rgba(255,255,255,.9)', 12, 5, 190)) });
    L.push({ sp: 0.0012, img: mk(BGW, BGH, (c) => ridge(c, BGH, 120, '#7fb8d8', 3, 5)) });
    L.push({ sp: 0.002, img: mk(BGW, BGH, (c) => { ridge(c, BGH + 6, 74, '#2f9a55', 9, 7); ridge(c, BGH + 10, 40, '#2a8a47', 14, 9); }) });
  } else if (th.id === 'canyon') {
    L.push({ sp: 0.0006, img: mk(BGW, BGH, (c) => clouds(c, 'rgba(255,170,150,.55)', 9, 8, 150)) });
    L.push({ sp: 0.0012, img: mk(BGW, BGH, (c) => ridge(c, BGH, 190, '#8a3a52', 21, 6, 5)) });
    L.push({ sp: 0.002, img: mk(BGW, BGH, (c) => { ridge(c, BGH + 4, 110, '#a9482c', 33, 8, 7); ridge(c, BGH + 8, 46, '#8f3a22', 4, 9); }) });
  } else {
    L.push({ sp: 0.0003, img: mk(BGW, BGH, (c) => { const r = rng(2); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; const s = r() < 0.1 ? 2.4 : 1.3; c.fillRect(r() * BGW, r() * 280, s, s); } }) });
    L.push({ sp: 0.0012, img: mk(BGW, BGH, (c) => skyline(c, 6, BGH, 60, 250, '#140a3a', ['#ff5fd0', '#6fe9ff', '#ffe98a'])) });
    L.push({ sp: 0.002, img: mk(BGW, BGH, (c) => skyline(c, 17, BGH, 30, 150, '#090520', ['#ffd76a', '#ff5fd0', '#6fe9ff', '#fff'])) });
  }
  return L;
}

// ---------------------------------------------------------------- track
function buildTrack(th) {
  const segs = [];
  const r = rng(th.seed);
  const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
  const add = (curve, y) => {
    const n = segs.length;
    segs.push({ index: n, curve, alt: Math.floor(n / RUMBLE) % 2, sprites: [], boats: [], glints: [], clip: 0,
      p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} } });
  };
  const road = (enter, hold, leave, curve, hill) => {
    const y0 = lastY(), y1 = y0 + hill * SEG, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total));
  };
  const pick = (a) => a[(r() * a.length) | 0];
  const hillDir = () => (lastY() > 0 ? (r() < 0.75 ? -1 : 1) : (r() < 0.75 ? 1 : -1));
  road(30, 60, 30, 0, 0);
  while (segs.length < th.segs) {
    const v = r(), len = pick([30, 50, 70]), cm = th.curve * pick([0.45, 0.7, 1]), sg = r() < 0.5 ? -1 : 1;
    if (v < 0.16) road(len, len, len, 0, 0);
    else if (v < 0.5) road(len, len, len, sg * cm, r() < 0.4 ? hillDir() * th.hill * r() : 0);
    else if (v < 0.66) { road(30, 40, 30, sg * cm, 0); road(30, 40, 30, -sg * cm, hillDir() * th.hill * 0.4 * r()); }
    else if (v < 0.84) road(len, len, len, sg * cm * 0.3, hillDir() * th.hill * (0.5 + r() * 0.5));
    else { for (let i = 0; i < 4; i++) road(12, 8, 12, 0, (i % 2 ? -1 : 1) * th.hill * 0.14); }
  }
  road(60, 60, 60, 0, -lastY() / SEG);
  while (segs.length % 3) add(0, 0);
  road(10, 10, 10, 0, 0);
  while (segs.length % 3) add(0, 0);
  const N = segs.length;

  // water glints
  for (const s of segs) {
    const k = r() < 0.5 ? 1 : r() < 0.5 ? 2 : 0;
    for (let i = 0; i < k; i++) s.glints.push({ x: -0.95 + r() * 1.8, w: 0.04 + r() * 0.14 });
  }
  // gates
  const gates = [GATE_SEG, GATE_SEG + N / 3, GATE_SEG + 2 * N / 3];
  gates.forEach((g, i) => segs[g].sprites.push({ s: i ? S.gateCP : S.gateStart, x: 0, kind: 'gate' }));
  const nearGate = (n) => gates.some((g) => Math.abs(n - g) < 18) || n < 70 || n > N - 20;

  // scenery
  const towers = ['tower', 'tower2', 'tower3'];
  for (let n = 2; n < N; n += 3) {
    const s = segs[n];
    if (n % 9 === 2) { s.sprites.push({ s: S.buoyR, x: -1.05, bob: 1 }); s.sprites.push({ s: S.buoyG, x: 1.05, bob: 1 }); }
    if (Math.abs(s.curve) > th.curve * 0.55 && n % 6 === 2) {
      const right = s.curve > 0;
      s.sprites.push({ s: right ? S.chevR : S.chevL, x: right ? -1.42 : 1.42 });
    }
    for (const side of [-1, 1]) {
      if (r() < 0.55) {
        let k = pick(th.decor); if (k === 'tower') k = pick(towers);
        const sp = S[k], half = sp.w / ROAD / 2;
        s.sprites.push({ s: sp, x: side * (1.75 + half + r() * 2.6) });
      }
      if (r() < 0.25) { let k = pick(th.decor); if (k === 'tower') k = pick(towers); s.sprites.push({ s: S[k], x: side * (5 + r() * 5) }); }
    }
  }
  // gameplay objects
  const lanes = [-0.68, -0.34, 0, 0.34, 0.68];
  for (let n = 80; n < N - 30; n += 34 + ((r() * 26) | 0)) {
    if (nearGate(n)) continue;
    const v = r();
    if (v < 0.36) {
      const x = pick(lanes), drift = (r() - 0.5) * 0.14;
      for (let i = 0; i < 4; i++) segs[n + i * 5].sprites.push({ s: S.boost, x: clamp(x + drift * i, -0.8, 0.8), kind: 'boost', bob: 1, lift: 110, t: 0 });
    } else if (v < 0.36 + th.hazard) {
      const kind = pick(['log', 'mine', 'barrel', 'mine', 'barrel']);
      const cnt = kind === 'log' ? 1 : 1 + ((r() * 2.4) | 0);
      const used = [];
      for (let i = 0; i < cnt; i++) {
        let x = pick(lanes); while (used.includes(x)) x = pick(lanes); used.push(x);
        segs[n + i * 7].sprites.push({ s: S[kind], x, kind: 'hazard', bob: 1 });
      }
    } else if (v < 0.36 + th.hazard + 0.2 && Math.abs(segs[n].curve) < 1 && Math.abs(segs[n + 14].curve) < 1.5) {
      const x = pick([-0.5, 0, 0.5]);
      segs[n].sprites.push({ s: S.ramp, x, kind: 'ramp' });
      segs[n + 9].sprites.push({ s: S.boost, x, kind: 'boost', lift: 520, bob: 1, t: 0 });
    }
  }
  return { segs, N, len: N * SEG, gates };
}

// ---------------------------------------------------------------- audio
const Snd = {
  ac: null, muted: false,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ac.destination);
    this.musicBus = ac.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(this.master);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // engine
    this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ac.createOscillator(); this.o2.type = 'square';
    this.eFilter = ac.createBiquadFilter(); this.eFilter.type = 'lowpass'; this.eFilter.frequency.value = 400;
    this.eGain = ac.createGain(); this.eGain.gain.value = 0;
    this.o1.connect(this.eFilter); this.o2.connect(this.eFilter); this.eFilter.connect(this.eGain); this.eGain.connect(this.master);
    this.o1.start(); this.o2.start();
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
    this.wFilter = ac.createBiquadFilter(); this.wFilter.type = 'bandpass'; this.wFilter.frequency.value = 900; this.wFilter.Q.value = 0.6;
    this.wGain = ac.createGain(); this.wGain.gain.value = 0;
    ns.connect(this.wFilter); this.wFilter.connect(this.wGain); this.wGain.connect(this.master); ns.start();
    this.step = 0; this.nextT = ac.currentTime + 0.1;
    setInterval(() => this.schedule(), 40);
  },
  engine(on, sp, boosting, airborne) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const f = 48 + sp * 96 + (airborne ? 40 : 0) + (boosting ? 18 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.06);
    this.o2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.06);
    this.eFilter.frequency.setTargetAtTime(350 + sp * 1300, t, 0.08);
    this.eGain.gain.setTargetAtTime(on ? 0.05 + sp * 0.05 : 0, t, 0.1);
    this.wFilter.frequency.setTargetAtTime(boosting ? 2200 : 700 + sp * 500, t, 0.1);
    this.wGain.gain.setTargetAtTime(on && !airborne ? sp * 0.07 + (boosting ? 0.07 : 0) : 0, t, 0.1);
  },
  tone(freq, dur, type = 'square', vol = 0.15, when = 0, slide = 0, bus) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(bus || this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, freq = 1200, when = 0, type = 'lowpass', bus) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime + when, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  pickup() { this.tone(880, 0.08, 'square', 0.12); this.tone(1320, 0.14, 'square', 0.12, 0.07); },
  crash() { this.noise(0.5, 0.5, 700); this.tone(120, 0.35, 'sawtooth', 0.25, 0, 0.3); },
  bump() { this.noise(0.18, 0.3, 500); this.tone(90, 0.15, 'square', 0.2, 0, 0.6); },
  splash() { this.noise(0.45, 0.35, 2400, 0, 'bandpass'); },
  jump() { this.tone(260, 0.35, 'sawtooth', 0.12, 0, 3); },
  boostFx() { this.noise(0.7, 0.25, 3000, 0, 'highpass'); this.tone(180, 0.5, 'sawtooth', 0.12, 0, 4); },
  beep(hi) { this.tone(hi ? 1040 : 520, hi ? 0.6 : 0.18, 'square', 0.16); },
  checkpoint() { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.14, 'square', 0.13, i * 0.08)); },
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i === 6 ? 0.6 : 0.16, 'square', 0.14, i * 0.14)); },
  over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, i * 0.3)); },
  schedule() {
    if (!this.ac || this.ac.state !== 'running') return;
    const ac = this.ac, spb = 60 / 142 / 4;
    if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + 0.05;
    while (this.nextT < ac.currentTime + 0.15) {
      this.musicStep(this.step++, this.nextT - ac.currentTime);
      this.nextT += spb;
    }
  },
  musicStep(i, when) {
    if (!music.on) return;
    const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const MEL = [69, 0, 72, 0, 76, 0, 74, 72, 0, 69, 0, 0, 67, 0, 69, 0, 65, 0, 69, 0, 72, 0, 77, 76, 0, 72, 0, 0, 74, 0, 72, 0,
                 64, 0, 67, 0, 72, 0, 76, 0, 79, 0, 76, 72, 0, 0, 67, 0, 71, 0, 74, 0, 79, 0, 0, 74, 0, 71, 0, 74, 0, 79, 81, 83];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const s = i % 16, bar = (i >> 4) % 4, ch = CH[bar], b = this.musicBus, hot = music.hot;
    if (s % 2 === 0) this.tone(hz(ch[0] - 24 + (s % 4 === 2 ? 12 : 0)), 0.13, 'sawtooth', 0.16, when, 0, b);
    this.tone(hz(ch[[0, 1, 2, 1][s % 4]] + (s % 8 >= 4 ? 12 : 0)), 0.07, 'square', 0.035, when, 0, b);
    const m = MEL[i % 64];
    if (m && (i >> 6) % 2 === 1) this.tone(hz(m), 0.2, 'square', 0.06, when, 0, b);
    if (s % 4 === 0) this.tone(150, 0.12, 'sine', 0.35, when, 0.3, b);
    if (hot && s % 8 === 4) this.noise(0.12, 0.16, 1800, when, 'highpass', b);
    if (hot && s % 2 === 1) this.noise(0.03, 0.06, 7000, when, 'highpass', b);
  },
  toggleMute() { this.muted = !this.muted; if (this.ac) this.master.gain.value = this.muted ? 0 : 0.8; },
};
const music = { on: true, hot: false };

// ---------------------------------------------------------------- game state
let state = 'attract';
let theme = THEMES[0], themeIdx = 0, boatIdx = 0, track = null, bg = null;
const cache = {};
let absPos = 0, playerX = 0, speed = 0, steer = 0, air = 0, vAir = 0, boost = 0, boosting = false;
let camDepth = BASE_DEPTH, boostFx = 0, shake = 0, clock = 0, stateT = 0;
let timeLeft = 0, raceTime = 0, cpIndex = 0, rank = 8, cd = 0, bonus = 0, newBest = false, spin = 0;
let rivals = [], particles = [], msg = null, bgOff = [0, 0, 0], touched = [];
let paused = false, finishRank = 0;
const keys = { left: false, right: false, up: false, down: false, boost: false };
let touchMode = false;
let best = {};
try { best = JSON.parse(localStorage.getItem('turbotide.best') || '{}') || {}; } catch (e) { best = {}; }

function loadTheme(i) {
  themeIdx = i; theme = THEMES[i];
  if (!cache[theme.id]) cache[theme.id] = { track: buildTrack(theme), bg: buildBackground(theme) };
  track = cache[theme.id].track; bg = cache[theme.id].bg;
}
function setState(s) {
  state = s; stateT = 0;
  document.body.classList.toggle('racing', s === 'race' || s === 'countdown');
  music.hot = s === 'race' || s === 'countdown' || s === 'finish';
}
function say(text, col = '#ffe14a', dur = 1.6) { msg = { text, col, t: 0, dur }; }

function startRace() {
  loadTheme(themeIdx);
  for (const s of track.segs) for (const sp of s.sprites) if (sp.kind === 'boost') sp.t = 0;
  absPos = 0; playerX = 0; speed = 0; steer = 0; air = 0; vAir = 0; boost = 0.34; boosting = false; spin = 0;
  cpIndex = 0; raceTime = 0; particles = []; msg = null; newBest = false; shake = 0;
  bonus = (track.len / 3) / (MAX_SPEED * theme.pace);
  timeLeft = bonus + 6;
  rivals = RIVAL_COLS.map((col, i) => ({
    col, z: PLAYER_Z + (i + 1) * SEG * 3.4, x: i % 2 ? 0.45 : -0.45, tx: i % 2 ? 0.45 : -0.45, speed: 0, vx: 0,
    base: MAX_SPEED * (0.93 + 0.012 * i) * theme.rival, acc: ACCEL * (1.3 + 0.08 * i), wander: 1 + i * 0.37, phase: i * 1.7,
  }));
  rank = 8; cd = 3.6;
  setState('countdown');
}

// ---------------------------------------------------------------- update
const segAt = (z) => track.segs[Math.floor(z / SEG) % track.N];
const cpZ = (k) => GATE_SEG * SEG + (k + 1) * track.len / 3;

function burst(x, y, n, spd, col, size) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * Math.random(), v = spd * (0.3 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.4 + Math.random() * 0.5, size: size * (0.5 + Math.random()), col });
  }
}

function update(dt) {
  clock += dt; stateT += dt;
  if (msg) { msg.t += dt; if (msg.t > msg.dur) msg = null; }
  shake = Math.max(0, shake - dt * 2.2);

  if (state === 'attract' || state === 'select') {
    absPos += dt * MAX_SPEED * 0.5; speed = MAX_SPEED * 0.5;
    const s = segAt(absPos + PLAYER_Z);
    steer = lerp(steer, clamp(s.curve / 4, -1, 1), dt * 3); playerX = lerp(playerX, 0, dt);
    scrollBg(s, dt); updateParticles(dt);
    return;
  }
  if (state === 'countdown') {
    const before = Math.ceil(cd); cd -= dt; const after = Math.ceil(cd);
    if (after !== before && after >= 1 && after <= 3) Snd.beep(false);
    if (cd <= 0) { setState('race'); say('GO!', '#6dff6d', 1.1); Snd.beep(true); }
    updateParticles(dt);
    return;
  }

  const racing = state === 'race';
  const L = track.len;
  const pz0 = absPos + PLAYER_Z;
  const pseg = segAt(pz0);
  const sp = speed / MAX_SPEED;
  const airborne = air > 0;

  // steering
  let input = 0;
  if (racing) input = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  else if (state === 'finish') input = clamp(-playerX * 2 + pseg.curve / 5, -1, 1);
  if (spin > 0) { spin -= dt; input = 0; }
  steer = lerp(steer, input, 1 - Math.exp(-dt * (input === 0 ? 5 : 7)));
  const grip = airborne ? 0.25 : 1;
  playerX += steer * dt * 2.6 * Math.min(1, 0.25 + sp) * grip * (sp > 0.02 ? 1 : 0);
  if (!airborne) playerX -= dt * 0.34 * sp * sp * pseg.curve;

  // throttle
  const gas = racing && (keys.up || touchMode) && !keys.down;
  const wantBoost = racing && keys.boost && boost > 0 && !keys.down;
  if (wantBoost && !boosting) { Snd.boostFx(); say('TURBO!', '#3ff3ff', 0.8); }
  boosting = wantBoost;
  const top = boosting ? MAX_SPEED * BOOST_MULT : MAX_SPEED;
  if (boosting) { boost = Math.max(0, boost - dt * 0.27); speed += ACCEL * 2.6 * dt; }
  else if (state === 'finish') speed = lerp(speed, MAX_SPEED * 0.45, dt * 1.2);
  else if (!airborne) {
    if (racing && keys.down) speed += BRAKE * dt;
    else if (gas) speed += ACCEL * (1.25 - 0.5 * clamp(sp, 0, 1)) * dt;
    else speed += DECEL * dt;
  }
  if (speed > top) speed = Math.max(top, speed - ACCEL * 1.2 * dt);
  if (Math.abs(playerX) > 1 && !airborne) {
    if (speed > OFF_LIMIT) speed += OFF_DECEL * dt;
    if (sp > 0.3) shake = Math.max(shake, 0.25);
  }
  playerX = clamp(playerX, -1.45, 1.45);
  speed = clamp(speed, 0, MAX_SPEED * BOOST_MULT);
  boostFx = lerp(boostFx, boosting ? 1 : 0, dt * 5);

  // jump physics
  if (airborne || vAir > 0) {
    air += vAir * dt; vAir -= GRAVITY * dt;
    if (air <= 0) {
      air = 0; vAir = 0; Snd.splash(); shake = Math.max(shake, 0.35);
      const p = playerScreen();
      burst(p.x, p.y, 40, 520, '255,255,255', 9);
    }
  }

  absPos += speed * dt;
  const pz1 = absPos + PLAYER_Z;

  // static objects crossed this step
  for (let i = Math.floor(pz0 / SEG) + 1; i <= Math.floor(pz1 / SEG); i++) {
    const s = track.segs[i % track.N];
    for (const o of s.sprites) {
      if (!o.kind || o.kind === 'gate') continue;
      const dx = Math.abs(playerX - o.x);
      if (o.kind === 'boost') {
        if (o.t <= clock && dx < 0.21 && Math.abs(air - (o.lift > 300 ? o.lift : 0)) < 420) {
          o.t = clock + 25; boost = Math.min(1, boost + 0.2); Snd.pickup();
          const p = playerScreen(); burst(p.x, p.y - 40, 12, 300, '120,240,255', 6);
        }
      } else if (o.kind === 'hazard') {
        if (air < 90 && dx < o.s.hit + 0.1 && racing) {
          speed *= 0.3; shake = 1; spin = 0.45; Snd.crash(); say('CRASH!', '#ff4a3d', 0.9);
          const p = playerScreen(); burst(p.x, p.y, 36, 600, '255,255,255', 10); burst(p.x, p.y, 14, 500, '255,170,60', 8);
        }
      } else if (o.kind === 'ramp') {
        if (air <= 0 && dx < 0.26 && sp > 0.45) {
          vAir = 2500 * clamp(sp, 0.6, 1.25); air = 1; Snd.jump();
          say('BIG AIR!', '#ff9d2e', 1); boost = Math.min(1, boost + 0.06);
        }
      }
    }
  }

  // rivals
  let ahead = 0;
  for (const rv of rivals) {
    const gap = rv.z - pz1;
    const band = gap > 0 ? 1 - clamp((gap - 15000) / 80000, 0, 1) * 0.08 : 1 + clamp(-gap / 30000, 0, 1) * 0.08;
    const target = rv.base * band;
    rv.speed = rv.speed < target ? Math.min(target, rv.speed + rv.acc * dt) : Math.max(target, rv.speed - ACCEL * dt);
    rv.z += rv.speed * dt;
    rv.tx = Math.sin(clock * 0.31 * rv.wander + rv.phase) * 0.7;
    // dodge the boat directly ahead
    for (const o of rivals) {
      if (o === rv) continue;
      const d = o.z - rv.z;
      if (d > 0 && d < SEG * 5 && Math.abs(o.x - rv.x) < 0.3) rv.tx = rv.x + (rv.x >= o.x ? 0.5 : -0.5);
    }
    const nx = lerp(rv.x, clamp(rv.tx, -0.82, 0.82), dt * 1.1);
    rv.vx = (nx - rv.x) / dt; rv.x = nx;
    // contact with the player
    if (air < 120 && Math.abs(rv.x - playerX) < 0.25 && racing) {
      if (gap > 0 && gap < 420 && speed > rv.speed) {
        speed = rv.speed * 0.88; rv.speed += 400; shake = Math.max(shake, 0.5); Snd.bump();
        playerX += (playerX >= rv.x ? 1 : -1) * 0.07;
      } else if (gap <= 0 && gap > -380 && rv.speed > speed) {
        rv.speed = speed * 0.9; rv.x += (rv.x >= playerX ? 1 : -1) * 0.08;
      }
    }
    if (rv.z > pz1) ahead++;
  }
  if (racing) rank = ahead + 1;

  // checkpoints and timer
  if (racing) {
    raceTime += dt; timeLeft -= dt;
    if (pz1 >= cpZ(cpIndex)) {
      cpIndex++;
      if (cpIndex === TOTAL_LAPS * 3) finish();
      else {
        timeLeft += bonus;
        Snd.checkpoint();
        if (cpIndex % 3 === 0) say(cpIndex === (TOTAL_LAPS - 1) * 3 ? 'FINAL LAP!' : 'LAP ' + (cpIndex / 3 + 1), '#ff5fd0', 2);
        else say('CHECKPOINT!  +' + bonus.toFixed(0) + ' SEC', '#ffe14a', 1.8);
      }
    } else if (timeLeft <= 0) {
      timeLeft = 0; setState('gameover'); Snd.over(); boosting = false;
    } else if (timeLeft < 10 && Math.ceil(timeLeft) !== Math.ceil(timeLeft + dt)) Snd.tone(980, 0.07, 'square', 0.1);
  }
  if (state === 'gameover' && stateT > 14) { loadTheme(themeIdx); setState('attract'); }

  // spray
  if (!airborne && sp > 0.08) {
    const p = playerScreen(), n = sp * 3 + boostFx * 3;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      particles.push({ x: p.x + side * p.w * 0.36, y: p.y - 4, vx: side * (60 + Math.random() * 260) * sp + steer * -120, vy: -(80 + Math.random() * 330) * sp,
        life: 0, max: 0.35 + Math.random() * 0.35, size: 4 + Math.random() * 7, col: '255,255,255' });
    }
    if (Math.abs(playerX) > 1) burst(p.x, p.y, 2, 300, theme.id === 'neon' ? '90,95,130' : '214,190,120', 7);
  }
  if (boostFx > 0.3) {
    const p = playerScreen();
    for (let i = 0; i < 2; i++) particles.push({ x: p.x + (Math.random() - 0.5) * p.w * 0.3, y: p.y - p.w * 0.1, vx: (Math.random() - 0.5) * 80, vy: 160 + Math.random() * 200, life: 0, max: 0.25, size: 9, col: Math.random() < 0.5 ? '255,200,60' : '90,220,255', g: 0 });
  }
  scrollBg(pseg, dt);
  updateParticles(dt);
}
function scrollBg(seg, dt) {
  const k = seg.curve * (speed / MAX_SPEED) * dt * 60;
  bg.forEach((l, i) => { bgOff[i] = (bgOff[i] + l.sp * k * 0.5 + 1) % 1; });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g === 0 ? 0 : 900) * dt;
    if (p.life > p.max) particles.splice(i, 1);
  }
  if (particles.length > 500) particles.splice(0, particles.length - 500);
}
function finish() {
  finishRank = rank;
  const b = best[theme.id];
  newBest = !b || raceTime < b.time;
  if (newBest) best[theme.id] = { time: raceTime, pos: finishRank };
  else if (finishRank < b.pos) b.pos = finishRank;
  try { localStorage.setItem('turbotide.best', JSON.stringify(best)); } catch (e) { /* storage unavailable */ }
  setState('finish'); boosting = false; Snd.fanfare();
}

// ---------------------------------------------------------------- render
function playerScreen() {
  const sc = camDepth / PLAYER_Z;
  return { x: W / 2 + steer * 26, y: H / 2 + sc * (CAM_H - air * 0.65) * U, w: BOAT_W * sc * U, sc, water: H / 2 + sc * (CAM_H + air * 0.35) * U };
}
function project(p, camX, camY, camZ) {
  const cz = p.world.z - camZ, sc = camDepth / cz;
  p.camera.z = cz; p.screen.scale = sc;
  p.screen.x = Math.round(W / 2 - sc * camX * U);
  p.screen.y = Math.round(H / 2 - sc * (p.world.y - camY) * U);
  p.screen.w = sc * ROAD * U;
}
function quad(x1, y1, w1, x2, y2, w2, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1); ctx.fill();
}
function strip(x1, y1, w1, x2, y2, w2, a, b, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 + w1 * a, y1); ctx.lineTo(x2 + w2 * a, y2); ctx.lineTo(x2 + w2 * b, y2); ctx.lineTo(x1 + w1 * b, y1); ctx.fill();
}
function drawSprite(spr, sc, x, y, clipY, lift) {
  const dw = spr.w * sc * U, img = spr.img, dh = dw * img.height / img.width;
  if (dw < 1.5) return;
  const dx = x - dw / 2, dy = y - dh - (lift || 0) * sc * U;
  if (dx > W + 60 || dx + dw < -60) return;
  const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
  if (clipH < dh) ctx.drawImage(img, 0, 0, img.width, img.height - img.height * clipH / dh, dx, dy, dw, dh - clipH);
}
function drawBoat(x, y, s, roll, col, flame, pitch) {
  const c = ctx;
  c.save(); c.translate(x, y); c.rotate(roll); c.scale(s, s * (1 + (pitch || 0)));
  // foam under the hull
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(0, 0.0, 0.56, 0.07, 0, 0, TAU); c.fill();
  // foredeck
  c.fillStyle = col.deck; c.beginPath(); c.moveTo(-0.44, -0.26); c.lineTo(-0.3, -0.58); c.quadraticCurveTo(0, -0.74, 0.3, -0.58); c.lineTo(0.44, -0.26); c.fill();
  c.fillStyle = col.body; c.beginPath(); c.moveTo(-0.07, -0.26); c.lineTo(-0.045, -0.68); c.lineTo(0.045, -0.68); c.lineTo(0.07, -0.26); c.fill();
  // windshield
  c.fillStyle = 'rgba(18,34,64,.9)'; c.beginPath(); c.moveTo(-0.3, -0.4); c.lineTo(-0.21, -0.55); c.quadraticCurveTo(0, -0.63, 0.21, -0.55); c.lineTo(0.3, -0.4); c.quadraticCurveTo(0, -0.47, -0.3, -0.4); c.fill();
  c.fillStyle = 'rgba(160,220,255,.5)'; c.beginPath(); c.moveTo(-0.22, -0.46); c.lineTo(-0.17, -0.54); c.lineTo(-0.05, -0.575); c.lineTo(-0.08, -0.47); c.fill();
  // driver
  c.fillStyle = '#16181f'; c.fillRect(-0.07, -0.42, 0.14, 0.14);
  c.fillStyle = col.stripe; c.beginPath(); c.arc(0, -0.45, 0.065, 0, TAU); c.fill();
  // transom
  c.fillStyle = col.body; c.beginPath(); c.moveTo(-0.48, -0.28); c.lineTo(0.48, -0.28); c.lineTo(0.41, -0.07); c.lineTo(0, 0.03); c.lineTo(-0.41, -0.07); c.fill();
  c.fillStyle = col.dark; c.beginPath(); c.moveTo(-0.435, -0.14); c.lineTo(0.435, -0.14); c.lineTo(0.41, -0.07); c.lineTo(0, 0.03); c.lineTo(-0.41, -0.07); c.fill();
  c.fillStyle = col.stripe; c.beginPath(); c.moveTo(-0.47, -0.245); c.lineTo(0.47, -0.245); c.lineTo(0.455, -0.195); c.lineTo(-0.455, -0.195); c.fill();
  // engines
  for (const ex of [-0.15, 0.15]) {
    if (flame > 0.05) {
      c.fillStyle = `rgba(90,220,255,${0.5 * flame})`; c.beginPath(); c.arc(ex, -0.09, 0.11 + Math.random() * 0.03, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,236,150,${flame})`; c.beginPath(); c.arc(ex, -0.09, 0.06, 0, TAU); c.fill();
    }
    c.fillStyle = '#1b1e27'; c.beginPath(); c.roundRect(ex - 0.075, -0.33, 0.15, 0.3, 0.04); c.fill();
    c.fillStyle = '#596173'; c.fillRect(ex - 0.05, -0.31, 0.1, 0.035);
  }
  // wing
  c.fillStyle = '#1b1e27'; c.fillRect(-0.36, -0.44, 0.035, 0.17); c.fillRect(0.325, -0.44, 0.035, 0.17);
  c.fillStyle = col.body; c.fillRect(-0.5, -0.475, 1, 0.055);
  c.fillStyle = col.stripe; c.fillRect(-0.5, -0.475, 0.07, 0.055); c.fillRect(0.43, -0.475, 0.07, 0.055);
  c.restore();
}

function render() {
  const th = theme, segs = track.segs, N = track.N, L = track.len;
  const position = absPos % L;
  const fovAdd = boostFx * 9;
  camDepth = 1 / Math.tan(((BASE_FOV + fovAdd) / 2) * Math.PI / 180);
  const base = segs[Math.floor(position / SEG) % N], basePct = (position % SEG) / SEG;
  const pz = position + PLAYER_Z, pseg = segs[Math.floor(pz / SEG) % N], ppct = (pz % SEG) / SEG;
  const playerY = lerp(pseg.p1.world.y, pseg.p2.world.y, ppct);
  const camY = playerY + CAM_H + air * 0.35;

  ctx.save();
  // world tilt + shake
  const sh = shake * 9;
  ctx.translate(W / 2 + (Math.random() - 0.5) * sh, H / 2 + (Math.random() - 0.5) * sh);
  ctx.rotate(-steer * 0.035 * Math.min(1, speed / MAX_SPEED * 1.5));
  ctx.scale(1.07, 1.07); ctx.translate(-W / 2, -H / 2);

  // sky
  const g = ctx.createLinearGradient(0, -40, 0, H / 2 + 10);
  g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H / 2 + 70);
  ctx.fillStyle = th.fog; ctx.fillRect(-60, H / 2, W + 120, H / 2 + 60);
  const sx = W * th.sun.x - (bgOff[0] - 0.5) * 60, sy = H * th.sun.y;
  const sg = ctx.createRadialGradient(sx, sy, th.sun.r * 0.6, sx, sy, th.sun.r * 5);
  sg.addColorStop(0, `rgba(${th.sun.glow},.75)`); sg.addColorStop(1, `rgba(${th.sun.glow},0)`);
  ctx.fillStyle = sg; ctx.fillRect(sx - 320, sy - 320, 640, 640);
  ctx.fillStyle = th.sun.c; ctx.beginPath(); ctx.arc(sx, sy, th.sun.r, 0, TAU); ctx.fill();
  bg.forEach((l, i) => {
    let x = -bgOff[i] * BGW - 60;
    for (; x < W + 60; x += BGW) ctx.drawImage(l.img, x, H / 2 - BGH + 2);
  });

  // boats per segment
  for (const s of touched) s.boats.length = 0;
  touched.length = 0;
  if (state !== 'attract' && state !== 'select') for (const rv of rivals) {
    const s = segs[Math.floor(rv.z / SEG) % N];
    s.boats.push(rv); touched.push(s);
  }

  // water channel
  let maxy = H + 60, x = 0, dx = -(base.curve * basePct);
  const camX = playerX * ROAD;
  for (let n = 0; n < DRAW; n++) {
    const s = segs[(base.index + n) % N];
    const camZ = position - (s.index < base.index ? L : 0);
    project(s.p1, camX - x, camY, camZ);
    project(s.p2, camX - x - dx, camY, camZ);
    x += dx; dx += s.curve;
    s.clip = maxy; s.vis = false;
    const a = s.p1.screen, b = s.p2.screen;
    if (s.p1.camera.z <= camDepth) continue;
    s.vis = true;
    if (b.y >= a.y || b.y >= maxy) continue;
    const alt = s.alt;
    ctx.fillStyle = th.ground[alt]; ctx.fillRect(-60, b.y, W + 120, a.y - b.y);
    quad(a.x, a.y, a.w * 1.2, b.x, b.y, b.w * 1.2, th.bank[alt]);
    quad(a.x, a.y, a.w, b.x, b.y, b.w, th.water[alt]);
    strip(a.x, a.y, a.w, b.x, b.y, b.w, -1, -0.955, th.foam); strip(a.x, a.y, a.w, b.x, b.y, b.w, 0.955, 1, th.foam);
    if (n < 110) for (const gl of s.glints) strip(a.x, a.y, a.w, b.x, b.y, b.w, gl.x, gl.x + gl.w, th.glint);
    const d = n / DRAW, fog = 1 - 1 / Math.exp(d * d * th.fogD);
    if (fog > 0.02) { ctx.globalAlpha = fog; ctx.fillStyle = th.fog; ctx.fillRect(-60, b.y, W + 120, a.y - b.y); ctx.globalAlpha = 1; }
    maxy = b.y;
  }

  // sprites, far to near
  const P = playerScreen();
  for (let n = DRAW - 1; n >= 0; n--) {
    const s = segs[(base.index + n) % N];
    if (s.vis) {
      const a = s.p1.screen, sc = a.scale;
      const fade = n > DRAW - 40 ? (DRAW - n) / 40 : 1;
      ctx.globalAlpha = fade;
      for (const o of s.sprites) {
        if (o.kind === 'boost' && o.t > clock) continue;
        const bobY = o.bob ? Math.sin(clock * 3 + s.index) * 30 * sc * U : 0;
        drawSprite(o.s, sc, a.x + sc * o.x * ROAD * U, a.y + bobY, s.clip, o.lift ? o.lift + Math.sin(clock * 4 + s.index) * 40 : 0);
      }
      for (const rv of s.boats) {
        const pct = (rv.z % SEG) / SEG, b = s.p2.screen;
        const rsc = camDepth / (lerp(s.p1.camera.z, s.p2.camera.z, pct));
        if (rsc <= 0) continue;
        const ry = lerp(a.y, b.y, pct), rx = lerp(a.x, b.x, pct) + rsc * rv.x * ROAD * U;
        if (ry > s.clip + 4) continue;
        const bw = BOAT_W * rsc * U;
        if (bw < 2) continue;
        const wk = Math.min(1, rv.speed / MAX_SPEED);
        ctx.fillStyle = `rgba(255,255,255,${0.3 * wk})`; ctx.beginPath();
        ctx.moveTo(rx - bw * 0.3, ry); ctx.lineTo(rx + bw * 0.3, ry); ctx.lineTo(rx + bw * 0.6, ry + bw * 0.45 * wk); ctx.lineTo(rx - bw * 0.6, ry + bw * 0.45 * wk); ctx.fill();
        drawBoat(rx, ry + Math.sin(clock * 9 + rv.phase) * bw * 0.012, bw, clamp(rv.vx * 0.35, -0.3, 0.3) + s.curve * 0.012, rv.col, 0);
      }
      ctx.globalAlpha = 1;
    }
    if (s === pseg && state !== 'select') drawPlayer(P);
  }
  // particles
  for (const p of particles) {
    const k = 1 - p.life / p.max;
    ctx.fillStyle = `rgba(${p.col},${k * 0.85})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + (1 - k) * 0.9), 0, TAU); ctx.fill();
  }
  ctx.restore();

  // boost speed lines
  if (boostFx > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * boostFx})`; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * TAU, r1 = H * (0.42 + Math.random() * 0.25), r2 = r1 + 60 + Math.random() * 200;
      ctx.moveTo(W / 2 + Math.cos(a) * r1 * 1.5, H * 0.45 + Math.sin(a) * r1); ctx.lineTo(W / 2 + Math.cos(a) * r2 * 1.5, H * 0.45 + Math.sin(a) * r2);
    }
    ctx.stroke();
  }
}
function drawPlayer(P) {
  const sp = speed / MAX_SPEED, col = BOATS[boatIdx];
  if (air > 0) {
    ctx.fillStyle = 'rgba(0,20,40,.35)'; ctx.beginPath(); ctx.ellipse(P.x, P.water, P.w * 0.5, P.w * 0.1, 0, 0, TAU); ctx.fill();
  } else if (sp > 0.05) {
    const wg = ctx.createLinearGradient(0, P.y, 0, H + 40);
    wg.addColorStop(0, `rgba(255,255,255,${0.75 * Math.min(1, sp)})`); wg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wg; ctx.beginPath();
    ctx.moveTo(P.x - P.w * 0.36, P.y - 6); ctx.lineTo(P.x + P.w * 0.36, P.y - 6);
    ctx.lineTo(P.x + P.w * 1.25 - steer * 90, H + 60); ctx.lineTo(P.x - P.w * 1.25 - steer * 90, H + 60); ctx.fill();
    ctx.fillStyle = theme.water[1]; ctx.globalAlpha = 0.55; ctx.beginPath();
    ctx.moveTo(P.x, P.y + 4); ctx.lineTo(P.x + P.w * 0.62 - steer * 90, H + 60); ctx.lineTo(P.x - P.w * 0.62 - steer * 90, H + 60); ctx.fill(); ctx.globalAlpha = 1;
  }
  const bobAmt = air > 0 ? 0 : Math.sin(clock * 14) * P.w * 0.012 * (0.3 + sp);
  const roll = steer * 0.28 + (spin > 0 ? Math.sin(spin * 28) * 0.5 : 0) + (air > 0 ? Math.sin(clock * 5) * 0.05 : 0);
  const pitch = air > 0 ? clamp(vAir / 9000, -0.12, 0.2) : sp * 0.04;
  drawBoat(P.x, P.y + bobAmt, P.w, roll, col, boostFx, pitch);
}

// ---------------------------------------------------------------- HUD + screens
function txt(s, x, y, size, fill, align = 'center', stroke = '#101422', sw) {
  ctx.font = 'italic 900 ' + size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = sw || Math.max(4, size * 0.16);
  if (stroke) { ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function gradText(s, x, y, size, c1, c2, align) {
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0.15, c1); g.addColorStop(0.85, c2);
  txt(s, x, y, size, g, align);
}
function panel(x, y, w, h, a = 0.55) {
  ctx.fillStyle = `rgba(6,14,34,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
}
const blink = (hz = 2) => Math.floor(clock * hz * 2) % 2 === 0;

function drawHUD() {
  const lap = Math.min(TOTAL_LAPS, Math.floor(cpIndex / 3) + 1);
  // position
  panel(18, 16, 200, 96);
  txt('POS', 34, 40, 22, '#9fd8ff', 'left');
  gradText(ORD[rank - 1], 34, 78, 54, '#fff', rank === 1 ? '#ffd23c' : '#8fd0ff', 'left');
  txt('/8', 204, 88, 24, '#fff', 'right');
  // lap
  panel(W - 218, 16, 200, 96);
  txt('LAP', W - 34, 40, 22, '#9fd8ff', 'right');
  gradText(lap + '/' + TOTAL_LAPS, W - 34, 78, 54, '#fff', '#8fd0ff', 'right');
  txt(fmtTime(raceTime), W - 204, 40, 20, '#fff', 'left');
  // timer
  const low = timeLeft < 10 && state === 'race';
  txt('TIME', W / 2, 30, 24, '#ffe14a');
  const tcol = low ? (blink(4) ? '#ff3b30' : '#fff') : '#fff';
  gradText(String(Math.ceil(timeLeft)).padStart(2, '0'), W / 2, 80, low ? 84 : 72, tcol, low ? tcol : '#ffd23c');
  // race progress
  const bw = Math.min(420, W * 0.34), bx = W / 2 - bw / 2, by = 128, total = TOTAL_LAPS * track.len;
  const prog = (z) => clamp((z - GATE_SEG * SEG) / total, 0, 1);
  ctx.fillStyle = 'rgba(6,14,34,.6)'; ctx.fillRect(bx - 4, by - 5, bw + 8, 10);
  ctx.fillStyle = '#fff'; for (let i = 0; i <= TOTAL_LAPS; i++) ctx.fillRect(bx + bw * i / TOTAL_LAPS - 1, by - 7, 2, 14);
  for (const rv of rivals) { ctx.fillStyle = rv.col.body; ctx.beginPath(); ctx.arc(bx + bw * prog(rv.z), by, 4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = BOATS[boatIdx].body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx + bw * prog(absPos + PLAYER_Z), by, 7, 0, TAU); ctx.fill(); ctx.stroke();

  // on touch screens the bottom corners hold the buttons, so these panels move up
  const sT = touchMode ? 122 : H - 112, bT = touchMode ? 122 : H - 86;
  // speed
  const mph = Math.round(speed / MAX_SPEED * 118);
  panel(W - 232, sT, 214, 94);
  gradText(String(mph), W - 96, sT + 48, 68, '#fff', boosting ? '#3ff3ff' : '#ffd23c', 'right');
  txt('MPH', W - 34, sT + 62, 24, '#9fd8ff', 'right');
  // boost
  panel(18, bT, 300, 68);
  txt('TURBO', 34, bT + 22, 20, boost > 0.02 ? '#3ff3ff' : '#6d7a94', 'left');
  ctx.fillStyle = '#0b1830'; ctx.fillRect(34, bT + 38, 268, 18);
  const bgd = ctx.createLinearGradient(34, 0, 302, 0); bgd.addColorStop(0, '#0a7cff'); bgd.addColorStop(1, '#6dfff0');
  ctx.fillStyle = boosting && blink(8) ? '#fff' : bgd; ctx.fillRect(34, bT + 38, 268 * boost, 18);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(34, bT + 38, 268, 18);
  for (let i = 1; i < 5; i++) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(34 + 268 * i / 5 - 1, bT + 38, 2, 18); }
  if (boost >= 0.2 && !boosting && !touchMode && blink(1.5)) txt('SPACE', 300, bT + 22, 16, '#fff', 'right');

  if (msg) {
    const k = Math.min(1, msg.t * 7), fade = Math.min(1, (msg.dur - msg.t) * 4);
    ctx.globalAlpha = fade; txt(msg.text, W / 2, H * 0.3, Math.min(70, W * 0.058) * (1.5 - 0.5 * k), msg.col); ctx.globalAlpha = 1;
  }
  if (Math.abs(playerX) > 1 && state === 'race' && blink(3)) txt('GET BACK IN THE CHANNEL!', W / 2, H * 0.42, 30, '#ff4a3d');
}

function drawLogo(y, size) {
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.045);
  const wob = Math.sin(clock * 2) * 4;
  txt('TURBO', -size * 0.34 + 6, -size * 0.36 + 6 + wob, size, 'rgba(0,0,0,.35)', 'center', null);
  txt('TIDE', size * 0.5 + 6, size * 0.46 + 6 - wob, size * 1.15, 'rgba(0,0,0,.35)', 'center', null);
  gradText('TURBO', -size * 0.34, -size * 0.36 + wob, size, '#fff36b', '#ff6a00');
  gradText('TIDE', size * 0.5, size * 0.46 - wob, size * 1.15, '#aef6ff', '#0a6cff');
  ctx.restore();
}
function drawAttract() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(4,10,30,.55)'); g.addColorStop(0.6, 'rgba(4,10,30,.1)'); g.addColorStop(1, 'rgba(4,10,30,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawLogo(H * 0.27, Math.min(140, W * 0.115));
  txt('ARCADE SPEEDBOAT RACING', W / 2, H * 0.53, 30, '#fff');
  if (blink(1.2)) txt(touchMode ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, H * 0.66, 46, '#ffe14a');
  txt('FREE PLAY', 30, H - 34, 26, '#6dff6d', 'left');
  txt('CREDITS  99', W - 30, H - 34, 22, '#fff', 'right');
  txt(touchMode ? 'STEER: BUTTONS   TURBO: BOOST' : 'STEER: ARROWS / WASD    TURBO: SPACE    M: MUTE    P: PAUSE', W / 2, H - 34, 18, '#9fd8ff');
}
function cardRects() {
  const cw = Math.min(310, (W - 120) / 3), ch = 300, gap = Math.min(40, (W - cw * 3) / 4);
  const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  return THEMES.map((_, i) => ({ x: x0 + i * (cw + gap), y: 150, w: cw, h: ch }));
}
function drawSelect() {
  ctx.fillStyle = 'rgba(4,10,30,.62)'; ctx.fillRect(0, 0, W, H);
  gradText('SELECT YOUR COURSE', W / 2, 78, 58, '#fff36b', '#ff6a00');
  cardRects().forEach((r, i) => {
    const th = THEMES[i], sel = i === themeIdx;
    ctx.save();
    if (sel) { ctx.translate(r.x + r.w / 2, r.y + r.h / 2); const k = 1.05 + Math.sin(clock * 6) * 0.012; ctx.scale(k, k); ctx.translate(-r.x - r.w / 2, -r.y - r.h / 2); }
    ctx.globalAlpha = sel ? 1 : 0.6;
    ctx.fillStyle = '#0a1226'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + 10, r.y + 10, r.w - 20, 150, 10); ctx.clip();
    const g = ctx.createLinearGradient(0, r.y + 10, 0, r.y + 100); g.addColorStop(0, th.sky[0]); g.addColorStop(0.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, 110);
    ctx.fillStyle = th.sun.c; ctx.beginPath(); ctx.arc(r.x + r.w * th.sun.x, r.y + 50, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = th.ground[0]; ctx.fillRect(r.x, r.y + 96, r.w, 70);
    const cx = r.x + r.w / 2;
    ctx.fillStyle = th.bank[0]; ctx.beginPath(); ctx.moveTo(cx - 12, r.y + 96); ctx.lineTo(cx + 12, r.y + 96); ctx.lineTo(cx + r.w * 0.46, r.y + 162); ctx.lineTo(cx - r.w * 0.46, r.y + 162); ctx.fill();
    ctx.fillStyle = th.water[0]; ctx.beginPath(); ctx.moveTo(cx - 8, r.y + 96); ctx.lineTo(cx + 8, r.y + 96); ctx.lineTo(cx + r.w * 0.38, r.y + 162); ctx.lineTo(cx - r.w * 0.38, r.y + 162); ctx.fill();
    ctx.restore();
    txt(th.name, cx, r.y + 190, Math.min(34, r.w * 0.12), '#fff');
    txt(th.diff, cx, r.y + 226, 22, ['#6dff6d', '#ffe14a', '#ff4a3d'][i]);
    txt('★'.repeat(th.stars) + '☆'.repeat(3 - th.stars), cx, r.y + 226 + 26, 22, '#ffd23c', 'center', null);
    const b = best[th.id];
    txt(b ? 'BEST ' + fmtTime(b.time) + '  ' + ORD[b.pos - 1] : 'BEST  -:--.--', cx, r.y + 280, 18, '#9fd8ff', 'center', null);
    ctx.lineWidth = sel ? 6 : 2; ctx.strokeStyle = sel ? '#ffe14a' : '#44506e'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke();
    ctx.restore();
  });
  const by = 540;
  txt('BOAT', W / 2, by - 62, 22, '#9fd8ff');
  drawBoat(W / 2, by + 44, 130, Math.sin(clock * 2) * 0.08, BOATS[boatIdx], 0);
  txt('◀', W / 2 - 130, by + 10, 34, '#ffe14a'); txt('▶', W / 2 + 130, by + 10, 34, '#ffe14a');
  txt(BOATS[boatIdx].name, W / 2, by + 78, 26, '#fff');
  if (blink(1.2)) txt(touchMode ? 'TAP COURSE AGAIN TO RACE' : '◀ ▶ COURSE    ▲ ▼ BOAT    ENTER TO RACE', W / 2, H - 34, 24, '#ffe14a');
}
function drawCountdown() {
  const n = Math.ceil(cd);
  if (n <= 3 && n >= 1) {
    const f = cd - Math.floor(cd);
    ctx.globalAlpha = Math.min(1, f * 3); gradText(String(n), W / 2, H * 0.36, 170 + (1 - f) * 60, '#fff', '#ffd23c'); ctx.globalAlpha = 1;
  } else txt('GET READY', W / 2, H * 0.36, 70, '#fff');
  txt(theme.name, W / 2, H * 0.62, 40, '#fff');
}
function drawFinish() {
  ctx.fillStyle = `rgba(4,10,30,${Math.min(0.6, stateT * 0.4)})`; ctx.fillRect(0, 0, W, H);
  gradText(finishRank === 1 ? 'YOU WIN!' : 'FINISH!', W / 2, H * 0.2, Math.min(120, W * 0.1), '#fff36b', '#ff6a00');
  if (stateT > 1) {
    panel(W / 2 - 260, H * 0.34, 520, 250, 0.75);
    txt('POSITION', W / 2 - 220, H * 0.34 + 54, 30, '#9fd8ff', 'left'); gradText(ORD[finishRank - 1], W / 2 + 220, H * 0.34 + 54, 54, '#fff', '#ffd23c', 'right');
    txt('TIME', W / 2 - 220, H * 0.34 + 122, 30, '#9fd8ff', 'left'); txt(fmtTime(raceTime), W / 2 + 220, H * 0.34 + 122, 44, '#fff', 'right');
    txt('BEST', W / 2 - 220, H * 0.34 + 186, 30, '#9fd8ff', 'left'); txt(fmtTime(best[theme.id].time), W / 2 + 220, H * 0.34 + 186, 44, '#fff', 'right');
    if (newBest && blink(3)) txt('NEW RECORD!', W / 2, H * 0.34 + 228, 28, '#6dff6d');
  }
  if (stateT > 2 && blink(1.2)) txt(touchMode ? 'TAP TO CONTINUE' : 'PRESS ENTER', W / 2, H - 60, 40, '#ffe14a');
}
function drawGameOver() {
  ctx.fillStyle = `rgba(30,4,10,${Math.min(0.6, stateT * 0.5)})`; ctx.fillRect(0, 0, W, H);
  if (stateT < 2) { txt('TIME UP!', W / 2, H * 0.4, Math.min(130, W * 0.11), '#ff4a3d'); return; }
  gradText('GAME OVER', W / 2, H * 0.3, Math.min(130, W * 0.11), '#fff', '#ff4a3d');
  txt('CONTINUE?', W / 2, H * 0.5, 44, '#fff');
  gradText(String(Math.max(0, Math.ceil(13 - stateT))), W / 2, H * 0.64, 100, '#fff36b', '#ff6a00');
  if (blink(1.2)) txt(touchMode ? 'TAP TO RETRY' : 'PRESS ENTER TO RETRY', W / 2, H - 60, 36, '#ffe14a');
}

function frame() {
  render();
  if (state === 'attract') drawAttract();
  else if (state === 'select') drawSelect();
  else {
    drawHUD();
    if (state === 'countdown') drawCountdown();
    else if (state === 'finish') drawFinish();
    else if (state === 'gameover') drawGameOver();
  }
  if (paused) {
    ctx.fillStyle = 'rgba(4,10,30,.7)'; ctx.fillRect(0, 0, W, H);
    txt('PAUSED', W / 2, H / 2 - 20, 90, '#fff'); txt(touchMode ? 'TAP TO RESUME' : 'PRESS P TO RESUME', W / 2, H / 2 + 60, 30, '#ffe14a');
  }
  if (Snd.muted) txt('MUTED', W / 2, 152, 18, '#ff8a80');
}

// ---------------------------------------------------------------- input
function confirm() {
  Snd.init();
  if (paused) { paused = false; return; }
  if (state === 'attract') { setState('select'); Snd.pickup(); }
  else if (state === 'select') { Snd.checkpoint(); startRace(); }
  else if (state === 'finish' && stateT > 2) { setState('select'); }
  else if (state === 'gameover' && stateT > 2) startRace();
}
function nav(dx, dy) {
  if (state !== 'select') return;
  if (dx) { loadTheme((themeIdx + dx + THEMES.length) % THEMES.length); absPos = 0; }
  if (dy) boatIdx = (boatIdx + dy + BOATS.length) % BOATS.length;
  Snd.tone(660, 0.06, 'square', 0.1);
}
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost' };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k || e.code === 'Enter') e.preventDefault();
  if (e.repeat) return;
  Snd.init(); touchMode = false; document.body.classList.remove('touch');
  if (k) keys[k] = true;
  if (e.code === 'Enter' || (e.code === 'Space' && state !== 'race' && state !== 'countdown')) confirm();
  else if (k === 'left') nav(-1, 0); else if (k === 'right') nav(1, 0);
  else if (k === 'up') nav(0, -1); else if (k === 'down') nav(0, 1);
  if (e.code === 'KeyM') Snd.toggleMute();
  if ((e.code === 'KeyP' || e.code === 'Escape') && (state === 'race' || state === 'countdown')) paused = !paused;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'race') paused = true; });
addEventListener('touchstart', () => { touchMode = true; document.body.classList.add('touch'); }, { passive: true });
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (state === 'select' && !paused) {
    Snd.init();
    const cards = cardRects(), i = cards.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i >= 0) { if (i === themeIdx) confirm(); else nav(i - themeIdx, 0); }
    else if (y > 480 && y < 660) nav(0, x < W / 2 ? -1 : 1);
    return;
  }
  confirm();
});
document.querySelectorAll('.tb').forEach((b) => {
  const k = b.dataset.k;
  const set = (v) => (e) => { e.preventDefault(); keys[k] = v; b.classList.toggle('on', v); if (v) Snd.init(); };
  b.addEventListener('pointerdown', set(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, set(false)));
});
addEventListener('contextmenu', (e) => e.preventDefault());

function resize() {
  const ww = innerWidth, wh = innerHeight;
  H = 720; W = Math.round(H * clamp(ww / wh, 1.25, 2.4)); U = H * 0.75;
  canvas.width = W; canvas.height = H;
  const s = Math.min(ww / W, wh / H);
  canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- main loop
buildSprites();
loadTheme(0);
resize();
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function loop(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) { if (!paused) update(STEP); acc -= STEP; }
  const on = !paused && (state === 'race' || state === 'countdown' || state === 'finish' || state === 'gameover');
  Snd.engine(on, state === 'countdown' ? 0.15 + Math.random() * 0.02 : speed / MAX_SPEED, boosting, air > 0);
  frame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// small hook for automated checks
window.__tt = { get s() { return { state, speed, absPos, playerX, rank, timeLeft, cpIndex, boost, air, len: track.len, raceTime }; }, keys };
})();
