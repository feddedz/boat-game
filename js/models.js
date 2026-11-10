// Hand-built low-poly models and painted textures. Everything here is generated in code.
import * as THREE from 'three';
import { TAU, rng, lerp } from './util.js';

const FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';
const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// ---- geometry helpers: every part becomes a non-indexed, vertex-coloured geometry
export function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
export function place(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _p.set(p[0], p[1], p[2]); _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  geo.applyMatrix4(_m.compose(_p, _q, _s));
  return geo;
}
export function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const box = (w, h, d, c, p, r) => place(paint(new THREE.BoxGeometry(w, h, d), c), p, r);
const cyl = (rt, rb, h, seg, c, p, r) => place(paint(new THREE.CylinderGeometry(rt, rb, h, seg), c), p, r);
const sph = (rad, c, p, s, det = 1) => place(paint(new THREE.IcosahedronGeometry(rad, det), c), p, [0, 0, 0], s || 1);
const cone = (rad, h, seg, c, p, r) => place(paint(new THREE.ConeGeometry(rad, h, seg), c), p, r);
function lump(rad, det, seed, c, jitter = 0.28) {
  const g = new THREE.IcosahedronGeometry(rad, det), a = g.attributes.position, r = rng(seed), cache = new Map();
  for (let i = 0; i < a.count; i++) {
    const k = a.getX(i).toFixed(3) + a.getY(i).toFixed(3) + a.getZ(i).toFixed(3);
    if (!cache.has(k)) cache.set(k, 1 + (r() - 0.5) * 2 * jitter);
    const f = cache.get(k);
    a.setXYZ(i, a.getX(i) * f, a.getY(i) * f, a.getZ(i) * f);
  }
  g.computeVertexNormals();
  return paint(g, c);
}

// ---- painted textures
export function canvasTex(w, h, fn, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function bannerTex(text, colA, colB, checker) {
  return canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#12151f'; c.fillRect(0, 0, w, h);
    c.fillStyle = colA; c.fillRect(6, 6, w - 12, h - 12);
    if (checker) for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(6 + i * (w - 12) / 64, j ? h - 26 : 6, (w - 12) / 64 + 1, 20); }
    c.font = 'italic 900 ' + (checker ? 70 : 92) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 12; c.lineJoin = 'round'; c.strokeStyle = '#12151f'; c.strokeText(text, w / 2, h / 2 + 4);
    c.fillStyle = colB; c.fillText(text, w / 2, h / 2 + 4);
  });
}
function chevronTex(dir) {
  return canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#ffd21c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 10; c.strokeRect(0, 0, w, h);
    c.fillStyle = '#111';
    for (let i = 0; i < 3; i++) {
      const x = w / 2 + (i - 1) * 70 * dir;
      c.beginPath(); c.moveTo(x - 26 * dir, 16); c.lineTo(x + 6 * dir, 16); c.lineTo(x + 34 * dir, 64); c.lineTo(x + 6 * dir, 112); c.lineTo(x - 26 * dir, 112); c.lineTo(x + 2 * dir, 64); c.fill();
    }
  });
}
function numberTex(num, fg, bg) {
  return canvasTex(128, 128, (c) => {
    c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
    c.lineWidth = 6; c.strokeStyle = fg; c.stroke();
    c.fillStyle = fg; c.font = 'italic 900 84px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), 60, 70);
  });
}
function windowsTex(seed, hue) {
  return canvasTex(256, 512, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = '#05060f'; c.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 16) for (let x = 6; x < w - 8; x += 16) {
      const v = r();
      if (v < 0.42) { c.fillStyle = v < 0.07 ? '#fff6c4' : `hsl(${hue + v * 140},100%,${55 + v * 40}%)`; c.fillRect(x, y, 9, 10); }
    }
  }, { repeat: true });
}
function billboardTex(i) {
  const ads = [['TURBO', 'TIDE COLA', '#ff3fb4', '#3ff3ff'], ['HYPER', 'OUTBOARDS', '#ffe14a', '#ff6a2b'], ['WAVE', 'RIDER FM', '#3ff3ff', '#b6ff5a']];
  const [a, b, c1, c2] = ads[i % ads.length];
  return canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#090b1c'; c.fillRect(0, 0, w, h);
    c.shadowBlur = 24; c.shadowColor = c1; c.strokeStyle = c1; c.lineWidth = 12; c.strokeRect(14, 14, w - 28, h - 28);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = c2; c.fillStyle = c2; c.font = 'italic 900 118px ' + FONT; c.fillText(a, w / 2, 96);
    c.shadowColor = c1; c.fillStyle = c1; c.font = 'italic 900 64px ' + FONT; c.fillText(b, w / 2, 190);
  });
}

// ---- the speedboat
const catmull = (a, t) => {
  const n = a.length - 1, x = t * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(n, i + 2)];
  return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
};
const HULL = {
  z:  [-3.5, -1.6, 0.6, 2.2, 3.3, 4.1],
  bc: [1.02, 1.08, 1.0, 0.72, 0.38, 0.02],   // chine half beam
  yc: [-0.04, -0.04, 0.0, 0.14, 0.36, 0.64], // chine height
  yk: [-0.42, -0.46, -0.44, -0.3, -0.02, 0.58], // keel
  bs: [1.2, 1.26, 1.17, 0.86, 0.46, 0.03],   // sheer half beam
  ys: [0.56, 0.59, 0.63, 0.69, 0.73, 0.74],  // sheer height
  yd: [0.64, 0.68, 0.76, 0.83, 0.83, 0.77],  // deck crown
};
function strip(st, fa, fb) {
  const pos = [], idx = [];
  st.forEach((s, i) => {
    pos.push(...fa(s), ...fb(s));
    if (i < st.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
let boatGeo = null;
function boatGeometry() {
  if (boatGeo) return boatGeo;
  const st = [];
  for (let i = 0; i <= 22; i++) { const t = i / 22, s = {}; for (const k in HULL) s[k] = catmull(HULL[k], t); st.push(s); }
  const mid = (s) => [lerp(s.bc, s.bs, 0.55), lerp(s.yc, s.ys, 0.55)];
  const G = { bottom: [], side: [], stripe: [], deck: [] };
  for (const m of [1, -1]) {
    G.bottom.push(strip(st, (s) => [0, s.yk, s.z], (s) => [m * s.bc, s.yc, s.z]));
    G.side.push(strip(st, (s) => [m * s.bc, s.yc, s.z], (s) => [m * mid(s)[0], mid(s)[1], s.z]));
    G.stripe.push(strip(st, (s) => [m * mid(s)[0], mid(s)[1], s.z], (s) => [m * s.bs, s.ys, s.z]));
    G.deck.push(strip(st, (s) => [m * s.bs, s.ys, s.z], (s) => [0, s.yd, s.z]));
  }
  // transom
  const s0 = st[0], tp = [[0, s0.yk], [s0.bc, s0.yc], [s0.bs, s0.ys], [0, s0.yd], [-s0.bs, s0.ys], [-s0.bc, s0.yc]];
  const tg = new THREE.BufferGeometry(), tv = [];
  for (let i = 1; i < tp.length - 1; i++) tv.push(tp[0][0], tp[0][1], s0.z, tp[i][0], tp[i][1], s0.z, tp[i + 1][0], tp[i + 1][1], s0.z);
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3)); tg.computeVertexNormals();
  const join = (list) => {
    const parts = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; return n; });
    let n = 0; parts.forEach((g) => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    parts.forEach((g) => { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
  };
  const B = (w, h, d, p, r) => place(new THREE.BoxGeometry(w, h, d), p, r);
  const C = (rt, rb, h, seg, p, r) => place(new THREE.CylinderGeometry(rt, rb, h, seg), p, r);
  const dark = [], chrome = [], body2 = [], accent = [];
  // cockpit tub, dash and seats
  dark.push(B(1.62, 0.1, 2.5, [0, 0.74, -0.55]));
  dark.push(B(1.5, 0.3, 0.16, [0, 0.9, 0.62], [-0.5, 0, 0]));
  for (const x of [-0.42, 0.42]) { accent.push(B(0.56, 0.16, 0.6, [x, 0.84, -0.75])); accent.push(B(0.56, 0.62, 0.14, [x, 1.1, -1.08], [-0.16, 0, 0])); }
  // engine cover with scoops
  body2.push(B(1.7, 0.34, 1.5, [0, 0.88, -2.55]));
  body2.push(B(1.2, 0.22, 1.2, [0, 1.12, -2.6]));
  for (const x of [-0.42, 0.42]) { dark.push(B(0.34, 0.2, 0.5, [x, 1.3, -2.5])); chrome.push(B(0.3, 0.14, 0.06, [x, 1.31, -2.24])); }
  // side exhausts
  for (const m of [1, -1]) for (let i = 0; i < 4; i++) chrome.push(C(0.07, 0.09, 0.5, 8, [m * 1.02, 0.86, -2.05 - i * 0.3], [0.3, 0, m * -1.15]));
  // twin outboards
  for (const x of [-0.5, 0.5]) {
    dark.push(B(0.42, 0.62, 0.62, [x, 0.72, -3.82])); accent.push(B(0.44, 0.1, 0.64, [x, 0.92, -3.82]));
    dark.push(B(0.16, 0.9, 0.3, [x, 0.0, -3.86])); chrome.push(C(0.2, 0.05, 0.34, 8, [x, -0.42, -4.0], [Math.PI / 2, 0, 0]));
  }
  // rear wing
  for (const x of [-0.8, 0.8]) dark.push(B(0.08, 0.72, 0.34, [x, 1.36, -3.0], [0.2, 0, 0]));
  body2.push(B(2.5, 0.08, 0.6, [0, 1.74, -3.08], [-0.1, 0, 0]));
  for (const x of [-1.25, 1.25]) accent.push(B(0.06, 0.34, 0.72, [x, 1.74, -3.08]));
  // bow rail and cleats
  const rail = new THREE.TorusGeometry(0.62, 0.035, 6, 14, Math.PI);
  chrome.push(place(rail, [0, 0.84, 2.35], [-Math.PI / 2 + 0.06, 0, 0], [1, 1.8, 1]));
  for (const m of [1, -1]) chrome.push(B(0.06, 0.06, 0.26, [m * 0.92, 0.72, 1.4]));
  // driver
  const driver = [B(0.44, 0.52, 0.3, [0.42, 1.2, -0.9])];
  const helmet = place(new THREE.SphereGeometry(0.22, 12, 10), [0.42, 1.62, -0.86]);
  // windshield
  const glass = place(new THREE.CylinderGeometry(0.98, 1.12, 0.62, 14, 1, true, -1.15, 2.3), [0, 1.02, -0.2], [-0.5, 0, 0]);
  const frame = place(new THREE.TorusGeometry(0.985, 0.03, 5, 16, 2.3), [0, 1.3, -0.05], [Math.PI / 2 - 0.5, 0, Math.PI / 2 - 1.15]);
  chrome.push(frame);
  boatGeo = {
    bottom: join(G.bottom), side: join([...G.side, tg]), stripe: join(G.stripe), deck: join(G.deck),
    dark: join(dark), chrome: join(chrome), body2: join(body2), accent: join(accent), driver: join(driver), helmet, glass,
  };
  return boatGeo;
}
const sharedMat = {};
function shared() {
  if (!sharedMat.dark) {
    sharedMat.dark = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.55, metalness: 0.3 });
    sharedMat.chrome = new THREE.MeshStandardMaterial({ color: 0xdfe6f0, roughness: 0.12, metalness: 1 });
    sharedMat.glass = new THREE.MeshStandardMaterial({ color: 0x0c2a4a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.62, side: THREE.DoubleSide });
    sharedMat.bottom = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide });
    sharedMat.suit = new THREE.MeshStandardMaterial({ color: 0x22252e, roughness: 0.8 });
    sharedMat.flame = new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    sharedMat.flame2 = new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }
  return sharedMat;
}
export function makeBoat(col, number) {
  const g = boatGeometry(), sm = shared();
  const paintMat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0.35, side: THREE.DoubleSide, ...extra });
  const body = paintMat(col.body), stripe = paintMat(col.stripe), deck = paintMat(col.deck), accent = paintMat(col.stripe, { roughness: 0.5 });
  const helmet = paintMat(col.stripe, { roughness: 0.15 });
  const root = new THREE.Group(), hull = new THREE.Group();
  root.add(hull);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); hull.add(m); return m; };
  add(g.bottom, sm.bottom); add(g.side, body); add(g.stripe, stripe); add(g.deck, body);
  add(g.dark, sm.dark); add(g.chrome, sm.chrome); add(g.body2, deck); add(g.accent, accent);
  add(g.driver, sm.suit); add(g.helmet, helmet); add(g.glass, sm.glass);
  // race number roundels on the engine cover and bow
  const numMat = new THREE.MeshStandardMaterial({ map: numberTex(number, '#111', '#e9e9e9'), roughness: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const n1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), numMat); n1.rotation.x = -Math.PI / 2; n1.position.set(0, 1.235, -2.6); hull.add(n1);
  const n2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), numMat); n2.rotation.x = -Math.PI / 2 + 0.03; n2.position.set(0, 0.845, 2.0); hull.add(n2);
  // turbo flames
  const flames = [];
  for (const x of [-0.5, 0.5]) for (const [mat, sc] of [[sm.flame, 1], [sm.flame2, 0.6]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3 * sc, 3.2 * sc, 8), mat);
    f.rotation.x = -Math.PI / 2; f.position.set(x, 0.55, -4.2 - 1.6 * sc); f.visible = false; hull.add(f); flames.push(f);
  }
  root.userData = { hull, flames };
  return root;
}

// ---- scenery
function leafGeo(len, wid, a, droop, col) {
  const pos = [], N = 6;
  const pt = (t, side) => {
    const r = len * t, y = Math.sin(t * 1.9) * len * 0.28 - t * t * len * droop;
    const w = wid * Math.sin(Math.PI * (0.08 + 0.92 * t)) * side;
    return [Math.cos(a) * r - Math.sin(a) * w, y - Math.abs(side) * wid * 0.25, Math.sin(a) * r + Math.cos(a) * w];
  };
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    for (const s of [1, -1]) {
      const a0 = pt(t0, 0), b0 = pt(t0, s), a1 = pt(t1, 0), b1 = pt(t1, s);
      pos.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return paint(g, col);
}
function palm(seed) {
  const r = rng(seed), parts = [], H = 7.5 + r() * 3, lean = 0.6 + r() * 1.4, dir = r() * TAU;
  let px = 0, pz = 0;
  for (let i = 0; i < 7; i++) {
    const t = i / 7, x = Math.cos(dir) * lean * t * t, z = Math.sin(dir) * lean * t * t;
    parts.push(cyl(0.3 - t * 0.12, 0.36 - t * 0.12, H / 7 + 0.1, 6, i % 2 ? '#7a4f26' : '#8c5c2d', [x, (i + 0.5) * H / 7, z], [Math.sin(dir) * 0.1 * t, 0, -Math.cos(dir) * 0.1 * t]));
    px = x; pz = z;
  }
  for (let i = 0; i < 9; i++) {
    const g = leafGeo(4.2 + r() * 1.4, 0.75, i / 9 * TAU + r() * 0.4, 0.55 + r() * 0.3, i % 2 ? '#2f9c3f' : '#3db851');
    parts.push(place(g, [px, H, pz]));
  }
  for (let i = 0; i < 3; i++) parts.push(sph(0.24, '#5a3414', [px + Math.cos(i * 2.1) * 0.3, H - 0.25, pz + Math.sin(i * 2.1) * 0.3]));
  return merge(parts);
}
function rock(seed, c1, c2) {
  const g = lump(1, 1, seed, c1), a = g.attributes.position, col = g.attributes.color;
  _c.set(c2);
  for (let i = 0; i < a.count; i++) if (a.getY(i) > 0.35) col.setXYZ(i, _c.r, _c.g, _c.b);
  return place(g, [0, 0.25, 0], [0, 0, 0], [1.3, 0.85, 1]);
}
function bush(seed) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < 5; i++) parts.push(place(lump(0.8 + r() * 0.5, 1, seed + i, i % 2 ? '#2c9a40' : '#237d33', 0.2), [(r() - 0.5) * 1.8, 0.5 + r() * 0.4, (r() - 0.5) * 1.8]));
  for (let i = 0; i < 4; i++) parts.push(sph(0.14, '#ff5fa2', [(r() - 0.5) * 2, 1.1 + r() * 0.4, (r() - 0.5) * 2], 1, 0));
  return merge(parts);
}
function hut() {
  const parts = [cyl(2.1, 2.1, 2.4, 10, '#c8935a', [0, 2.4, 0]), cone(3.3, 2.6, 10, '#d9b34a', [0, 4.9, 0]), cone(2.2, 1.2, 10, '#c29a36', [0, 6.0, 0]), box(0.9, 1.7, 0.12, '#3a2412', [0, 2.1, 2.08])];
  for (let i = 0; i < 6; i++) parts.push(cyl(0.13, 0.13, 1.4, 5, '#7a4a22', [Math.cos(i * TAU / 6) * 1.9, 0.6, Math.sin(i * TAU / 6) * 1.9]));
  parts.push(cyl(2.5, 2.5, 0.16, 10, '#9a6a3a', [0, 1.25, 0]));
  return merge(parts);
}
function umbrella(c) {
  const parts = [cyl(0.05, 0.05, 2.6, 5, '#eeeeee', [0, 1.3, 0])];
  const top = new THREE.ConeGeometry(1.7, 0.7, 8).toNonIndexed(), n = top.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { _c.set(Math.floor(i / 6) % 2 ? c : '#ffffff'); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  top.setAttribute('color', new THREE.BufferAttribute(col, 3)); top.deleteAttribute('uv');
  parts.push(place(top, [0, 2.7, 0]));
  parts.push(box(0.7, 0.08, 1.9, c, [1.3, 0.3, 0.2], [0, 0.3, 0]));
  return merge(parts);
}
function cactus(seed) {
  const r = rng(seed), g = '#2f8f4a', H = 3.5 + r() * 2.5, parts = [];
  const cap = (rad, h, p, rot) => place(paint(new THREE.CapsuleGeometry(rad, h, 3, 7), g), p, rot);
  parts.push(cap(0.42, H, [0, H / 2 + 0.3, 0]));
  for (const m of [1, -1]) if (r() < 0.85) {
    const y = H * (0.35 + r() * 0.3), l = 0.7 + r() * 0.5, up = 1 + r() * 1.3;
    parts.push(cap(0.28, l, [m * (0.4 + l / 2), y, 0], [0, 0, Math.PI / 2])); parts.push(cap(0.28, up, [m * (0.5 + l), y + up / 2 + 0.1, 0]));
  }
  return merge(parts);
}
function spire(seed) {
  const r = rng(seed), parts = [], cols = ['#b0502a', '#c9683a', '#9c4322', '#d97a44'];
  let y = 0, rad = 3.2 + r() * 1.6;
  for (let i = 0; i < 7; i++) {
    const h = 2.4 + r() * 2.6, nr = rad * (0.74 + r() * 0.2);
    parts.push(cyl(nr, rad, h, 7, cols[i % 4], [(r() - 0.5) * 0.7, y + h / 2, (r() - 0.5) * 0.7], [0, r() * 3, 0]));
    y += h; rad = nr * (i % 2 ? 1.12 : 0.96);
  }
  return merge(parts);
}
function deadTree(seed) {
  const r = rng(seed), c = '#5c4630', parts = [cyl(0.16, 0.3, 3.4, 5, c, [0, 1.7, 0])];
  for (let i = 0; i < 4; i++) { const a = r() * TAU, l = 1 + r() * 1.3; parts.push(cyl(0.05, 0.11, l, 4, c, [Math.cos(a) * l * 0.35, 2.2 + i * 0.4, Math.sin(a) * l * 0.35], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9])); }
  return merge(parts);
}
function lamp() {
  return {
    lit: merge([cyl(0.12, 0.2, 7, 6, '#2b2f4a', [0, 3.5, 0]), box(0.16, 0.16, 2, '#2b2f4a', [0, 7, 0.9]), cyl(0.5, 0.5, 0.3, 6, '#1b1e30', [0, 0.15, 0])]),
    glow: merge([box(0.5, 0.14, 0.9, '#fff0b4', [0, 6.88, 1.6])]),
  };
}
function buoy(c) {
  return {
    lit: merge([cyl(0.7, 0.8, 0.5, 10, c, [0, 0.15, 0]), cone(0.55, 1.6, 8, c, [0, 1.2, 0]), cyl(0.36, 0.48, 0.3, 8, '#ffffff', [0, 1.0, 0]), cyl(0.05, 0.05, 0.5, 4, '#222222', [0, 2.2, 0])]),
    glow: merge([sph(0.16, c === '#e8262e' ? '#ff6a5a' : '#7dff8a', [0, 2.5, 0], 1, 0)]),
  };
}
function ramp() {
  const s = new THREE.Shape(); s.moveTo(-5, 0); s.lineTo(5, 0); s.lineTo(5, 2.7); s.lineTo(-5, 0.02);
  const body = new THREE.ExtrudeGeometry(s, { depth: 7.2, bevelEnabled: false });
  body.rotateY(-Math.PI / 2); body.translate(3.6, -0.02, 0);     // length runs along +z, high end at +z
  const parts = [paint(body, '#2a2e3a')];
  const slope = Math.atan2(2.7, 10), len = Math.hypot(10, 2.7);
  parts.push(box(7.2, 0.05, len, '#ffb400', [0, 1.34, 0], [-slope, 0, 0]));
  for (const m of [1, -1]) parts.push(box(0.25, 0.3, len, '#e8262e', [m * 3.55, 1.5, 0], [-slope, 0, 0]));
  for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; parts.push(box(4.4, 0.06, 0.55, '#16181f', [0, 2.7 * t + 0.06, -5 + 10 * t], [-slope, 0, 0])); }
  for (const [x, z] of [[-3.2, -3.5], [3.2, -3.5], [-3.2, 4.2], [3.2, 4.2]]) parts.push(cyl(0.6, 0.6, 0.7, 8, '#ff7a1a', [x, -0.1, z]));
  return merge(parts);
}
function canister() {
  return {
    lit: merge([cyl(0.2, 0.2, 0.3, 8, '#d7dde8', [0, 0.95, 0]), cyl(0.3, 0.3, 0.1, 8, '#8791a3', [0, 1.12, 0])]),
    glow: merge([place(paint(new THREE.CapsuleGeometry(0.5, 0.8, 4, 10), '#35c8ff'), [0, 0, 0]), place(paint(new THREE.TorusGeometry(0.9, 0.07, 6, 20), '#ffe14a'), [0, 0, 0], [Math.PI / 2, 0, 0]),
      box(0.5, 0.7, 1.04, '#ffe14a', [0, 0, 0], [0, 0, 0.5])]),
  };
}
function mine() {
  const parts = [sph(0.95, '#2b2f3a', [0, 0.25, 0], 1, 2)];
  for (let i = 0; i < 10; i++) {
    const a = i * 2.39996, y = 1 - (i + 0.5) / 10 * 1.5, rr = Math.sqrt(Math.max(0, 1 - y * y));
    const d = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), g = paint(new THREE.CylinderGeometry(0.06, 0.12, 0.5, 5), '#4a5060');
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); g.translate(d.x * 1.1, d.y * 1.1 + 0.25, d.z * 1.1);
    parts.push(g);
  }
  return { lit: merge(parts), glow: merge([sph(0.22, '#ff3020', [0, 1.2, 0], 1, 0), cyl(0.99, 0.99, 0.08, 14, '#ff3020', [0, 0.25, 0])]) };
}
function barrel() {
  return merge([cyl(0.62, 0.62, 1.6, 12, '#d8222c', [0, 0.25, 0]), cyl(0.65, 0.65, 0.14, 12, '#ffe14a', [0, 0.65, 0]), cyl(0.65, 0.65, 0.14, 12, '#ffe14a', [0, -0.15, 0]), cyl(0.5, 0.5, 0.06, 12, '#7d0f16', [0, 1.06, 0])]);
}
function log() {
  const parts = [cyl(0.55, 0.6, 8.4, 9, '#7b4f24', [0, 0.1, 0], [0, 0, Math.PI / 2])];
  for (const m of [1, -1]) parts.push(cyl(0.46, 0.46, 0.06, 9, '#e3bd84', [m * 4.22, 0.1, 0], [0, 0, Math.PI / 2]));
  parts.push(cyl(0.16, 0.2, 1.1, 5, '#6a4320', [1.4, 0.75, 0.1], [0.3, 0, 0.3])); parts.push(cyl(0.14, 0.18, 0.9, 5, '#6a4320', [-2, 0.6, -0.2], [-0.5, 0, -0.2]));
  return merge(parts);
}
function grandstand() {
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push(box(22, 0.6, 1.6, i % 2 ? '#d9dde6' : '#bfc5d1', [0, 0.6 + i * 0.9, i * 1.5]));
  parts.push(box(22, 0.3, 9, '#e3212b', [0, 8.2, 3.2], [0.12, 0, 0]));
  for (const x of [-10.5, -3.5, 3.5, 10.5]) parts.push(cyl(0.18, 0.18, 8, 5, '#44495a', [x, 4, 7]));
  const r = rng(5), cols = ['#ff5a52', '#ffd23c', '#3db851', '#3fa9ff', '#ffffff', '#ff7ad1'];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 26; j++) if (r() < 0.8) parts.push(box(0.5, 0.75, 0.4, cols[(r() * 6) | 0], [-10.4 + j * 0.83, 1.25 + i * 0.9, i * 1.5 + 0.2]));
  return merge(parts);
}
function lighthouse() {
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push(cyl(2.2 - i * 0.22, 2.42 - i * 0.22, 3.2, 10, i % 2 ? '#e3212b' : '#f7f7f7', [0, 1.6 + i * 3.2, 0]));
  parts.push(cyl(2.3, 2.3, 0.3, 10, '#30343f', [0, 19.3, 0]), cyl(1.3, 1.3, 1.8, 8, '#30343f', [0, 20.3, 0]), cone(1.9, 1.6, 10, '#e3212b', [0, 22.0, 0]));
  return { lit: merge(parts), glow: merge([cyl(1.1, 1.1, 1.3, 8, '#fff3b0', [0, 20.3, 0])]) };
}

export function makeKit() {
  const K = { props: {}, tex: {} };
  const P = K.props;
  P.palm = [palm(1), palm(2), palm(3)].map((g) => ({ lit: g, double: true }));
  P.rock = [rock(4, '#7f838c', '#a9aeb8'), rock(9, '#74787f', '#9da2ac')].map((g) => ({ lit: g }));
  P.boulder = [rock(4, '#a84a26', '#d0703d'), rock(7, '#9c4322', '#c9683a')].map((g) => ({ lit: g }));
  P.bush = [bush(3), bush(8)].map((g) => ({ lit: g }));
  P.hut = [{ lit: hut() }];
  P.umbrella = [umbrella('#e3212b'), umbrella('#1c6cf0'), umbrella('#ffb400')].map((g) => ({ lit: g }));
  P.cactus = [cactus(1), cactus(5), cactus(11)].map((g) => ({ lit: g }));
  P.spire = [spire(2), spire(6), spire(13)].map((g) => ({ lit: g }));
  P.deadTree = [deadTree(1), deadTree(4)].map((g) => ({ lit: g }));
  P.lamp = [lamp()];
  P.buoyR = [buoy('#e8262e')]; P.buoyG = [buoy('#1fbf4c')];
  P.ramp = [{ lit: ramp() }];
  P.canister = [canister()];
  P.mine = [mine()]; P.barrel = [{ lit: barrel() }]; P.log = [{ lit: log() }];
  P.grandstand = [{ lit: grandstand() }];
  P.lighthouse = [lighthouse()];
  K.tex.gateStart = bannerTex('START  /  FINISH', '#d81f2a', '#ffffff', true);
  K.tex.gateCP = bannerTex('CHECKPOINT', '#ffc21c', '#ffffff', false);
  K.tex.chevL = chevronTex(-1); K.tex.chevR = chevronTex(1);
  K.tex.windows = [windowsTex(3, 300), windowsTex(8, 170), windowsTex(15, 20)];
  K.tex.ads = [billboardTex(0), billboardTex(1), billboardTex(2)];
  return K;
}

// A checkpoint arch spanning the channel. halfSpan is the distance from the centre to each pylon.
export function makeGate(tex, halfSpan, night) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd6e2, roughness: 0.35, metalness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd81f2a, roughness: 0.5 });
  const H = 13;
  for (const m of [1, -1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, H + 4, 10), steel); col.position.set(m * halfSpan, (H + 4) / 2 - 4, 0); g.add(col);
    for (let i = 0; i < 4; i++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.0, 1.1, 10), red); band.position.set(m * halfSpan, 1 + i * 2.6, 0); g.add(band); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 1.2, 12), red); base.position.set(m * halfSpan, 0.2, 0); g.add(base);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffec7a, toneMapped: false })); bulb.position.set(m * halfSpan, H + 0.6, 0); g.add(bulb);
  }
  for (const y of [H - 3.4, H]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2, 0.4, 0.5), steel); beam.position.y = y; g.add(beam); }
  for (let x = -halfSpan + 1.5; x < halfSpan; x += 3) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.6, 0.16), steel); d.position.set(x, H - 1.7, 0); d.rotation.z = (Math.round(x / 3) % 2 ? 1 : -1) * 0.72; g.add(d);
  }
  const bw = halfSpan * 2 - 3, bm = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: !night });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw / 8), bm); banner.position.set(0, H - 1.7, 0.3); g.add(banner);
  const back = banner.clone(); back.position.z = -0.3; back.rotation.y = Math.PI; g.add(back);
  return g;
}
