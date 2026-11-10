// TURBO TIDE - 3D arcade speedboat racer. Game loop, boat physics, rivals, camera and effects.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, clamp, lerp, smooth, damp, lerpAngle } from './util.js';
import { Snd, music } from './audio.js';
import { makeKit, makeBoat } from './models.js';
import { THEMES, buildWorld } from './world.js';
import { initHud, hudSize, drawOverlay, cardRects } from './hud.js';

const BOATS = [
  { name: 'RED SHARK',   body: '#d9141f', deck: '#f4f4f4', stripe: '#ffd23c' },
  { name: 'BLUE MARLIN', body: '#1257e0', deck: '#eef4ff', stripe: '#ff6a2b' },
  { name: 'GOLD RUSH',   body: '#ffb400', deck: '#23232b', stripe: '#e3212b' },
  { name: 'VENOM',       body: '#2fd13f', deck: '#15151c', stripe: '#c63cff' },
];
const RIVAL_COLS = [
  { body: '#ff7a1a', deck: '#ffffff', stripe: '#222222' }, { body: '#b03cff', deck: '#ffffff', stripe: '#ffe14a' },
  { body: '#19d3c5', deck: '#ffffff', stripe: '#ff3f7f' }, { body: '#f4f4f4', deck: '#dd2222', stripe: '#1c6cf0' },
  { body: '#ff4fa0', deck: '#ffffff', stripe: '#19d3c5' }, { body: '#2b2f3a', deck: '#ffc21c', stripe: '#ffc21c' },
  { body: '#7ac943', deck: '#ffffff', stripe: '#1b1b1b' },
];
const MAX = 62, BOOST_MULT = 1.3, LAPS = 3, GRAV = 30;

// ---------------------------------------------------------------- renderer
const glCanvas = document.getElementById('gl'), hudCanvas = document.getElementById('hud');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.getElementById('err').style.display = 'flex'; throw e; }
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.4, 5200);
let composer, bloom, quality = 2, pixelRatio = Math.min(devicePixelRatio || 1, 1.75);
initHud(hudCanvas);
let HW = 1280, HH = 720;
function resize() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(w * pixelRatio, h * pixelRatio, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.3, 0.5, 0.9);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  if (world) applyLook();
  if (aspect >= 1.25) { HH = 720; HW = Math.round(720 * Math.min(aspect, 2.4)); } else { HW = 900; HH = Math.round(900 / aspect); }
  hudCanvas.width = HW; hudCanvas.height = HH; hudSize(HW, HH);
}

// ---------------------------------------------------------------- state
const kit = makeKit();
const worlds = {};
let world = null, T = null, theme = THEMES[0];
const G = { state: 'boot', stateT: 0, clock: 0, themeIdx: 0, laps: LAPS, rank: 8, cpIndex: 0, raceTime: 0, timeLeft: 0, speed: 0, boost: 0, boosting: false, boostFx: 0,
  msg: null, touch: false, best: {}, rivals: [], total: 0, px: 0, pz: 0, wrongWay: false, paused: false, muted: false, cd: 0, finishRank: 1, newBest: false, loading: false,
  theme, boatCol: BOATS[0], world: null, progress: (s) => (s - world.startS) / (LAPS * T.L) };
try { G.best = JSON.parse(localStorage.getItem('turbotide.best3d') || '{}') || {}; } catch (e) { G.best = {}; }
let boatIdx = 0, bonus = 0, shake = 0, spin = 0, wrongT = 0, bumpT = 0, stuckT = 0;
const keys = { left: false, right: false, up: false, down: false, boost: false };
const P = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, vx: 0, vz: 0, steer: 0, hint: -1, s: 0, d: 0, laps: 0, air: false, onRamp: false, mesh: null, wake: null };
let camYaw = 0;
const loc = {}, tp = {};

// ---------------------------------------------------------------- effects
class Wake {
  constructor(width) {
    this.w = width; this.pts = []; this.n = 44;
    this.pos = new Float32Array(this.n * 6); this.col = new Float32Array(this.n * 8);
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, Wake.mat || (Wake.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 })));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
  }
  clear() { this.pts.length = 0; this.mesh.geometry.setDrawRange(0, 0); }
  update(dt, x, z, yaw, strength) {
    const p = this.pts, last = p[0];
    for (const q of p) q.age += dt;
    while (p.length && p[p.length - 1].age > 1.9) p.pop();
    const sx = x - Math.sin(yaw) * 3.4, sz = z - Math.cos(yaw) * 3.4;
    if (strength > 0.03 && (!last || (last.x - sx) ** 2 + (last.z - sz) ** 2 > 2.2)) { p.unshift({ x: sx, z: sz, rx: -Math.cos(yaw), rz: Math.sin(yaw), age: 0, a: strength }); if (p.length > this.n - 1) p.pop(); }
    let k = 0;
    const put = (q, age, px2, pz2) => {
      const w = this.w * (0.45 + age * 1.5), a = q.a * Math.max(0, 1 - age / 1.9) ** 1.5 * 0.42;
      for (const m of [1, -1]) { this.pos[k * 3] = px2 + q.rx * w * m; this.pos[k * 3 + 1] = 0.05; this.pos[k * 3 + 2] = pz2 + q.rz * w * m; this.col[k * 4] = this.col[k * 4 + 1] = this.col[k * 4 + 2] = 1; this.col[k * 4 + 3] = a; k++; }
    };
    if (p.length) { put({ rx: -Math.cos(yaw), rz: Math.sin(yaw), a: strength }, 0, sx, sz); for (const q of p) put(q, q.age, q.x, q.z); }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, (k / 2 - 1) * 6));
  }
}
const PN = 900, pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pSize = new Float32Array(PN), pAlpha = new Float32Array(PN), pCol = new Float32Array(PN * 3);
let pNext = 0, spray;
function initSpray() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 600 }, uTint: { value: new THREE.Color('#ffffff') } },
    vertexShader: `attribute float aSize, aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float uScale;
      void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; uniform vec3 uTint; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .15, d) * vA; if (a < .01) discard; gl_FragColor = vec4(vC * uTint, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  spray = new THREE.Points(g, m); spray.frustumCulled = false; spray.renderOrder = 3; scene.add(spray);
}
function emit(x, y, z, vx, vy, vz, life, size, r = 1, g = 1, b = 1) {
  const i = pNext; pNext = (pNext + 1) % PN;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pLife[i] = 0; pMax[i] = life; pSize[i] = size; pCol[i * 3] = r; pCol[i * 3 + 1] = g; pCol[i * 3 + 2] = b;
}
function burst(x, y, z, n, spd, size, r, g, b) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7); emit(x, y, z, Math.cos(a) * v, spd * (0.5 + Math.random()), Math.sin(a) * v, 0.5 + Math.random() * 0.6, size * (0.5 + Math.random()), r, g, b); }
}
function updateSpray(dt) {
  for (let i = 0; i < PN; i++) {
    if (pMax[i] <= 0) { pAlpha[i] = 0; continue; }
    pLife[i] += dt;
    if (pLife[i] >= pMax[i] || pPos[i * 3 + 1] < -0.3) { pMax[i] = 0; pAlpha[i] = 0; continue; }
    pVel[i * 3 + 1] -= 16 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pAlpha[i] = (1 - pLife[i] / pMax[i]) * 0.8;
  }
  const a = spray.geometry.attributes; a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aCol.needsUpdate = true;
  spray.material.uniforms.uScale.value = innerHeight * pixelRatio * 0.9;
}
function sprayFrom(x, y, z, yaw, vf, amount) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
  for (let i = 0; i < amount; i++) {
    const m = Math.random() < 0.5 ? 1 : -1, back = -1.5 - Math.random() * 2, out = 3 + Math.random() * 7, k = vf / MAX;
    emit(x + fx * back + rx * m * 1.1, y + 0.15, z + fz * back + rz * m * 1.1, fx * vf * 0.6 + rx * m * out * k, (2 + Math.random() * 5) * k, fz * vf * 0.6 + rz * m * out * k, 0.3 + Math.random() * 0.4, 0.22 + Math.random() * 0.4);
  }
}

// ---------------------------------------------------------------- setup
function applyLook() {
  const th = world.theme;
  scene.fog = new THREE.FogExp2(world.fogCol, th.fogD); scene.environment = world.env; scene.environmentIntensity = th.id === 'neon' ? 0.9 : 0.75;
  renderer.toneMappingExposure = th.exposure;
  if (Wake.mat) { Wake.mat.color.set(th.wake); }
  if (spray) spray.material.uniforms.uTint.value.set(th.wake);
  if (bloom) { bloom.strength = th.bloom[0]; bloom.threshold = th.bloom[1]; bloom.radius = 0.6; }
}
function loadTheme(i) {
  G.themeIdx = i; theme = G.theme = THEMES[i];
  if (world) scene.remove(world.group);
  if (!worlds[theme.id]) worlds[theme.id] = buildWorld(theme, kit, renderer);
  world = G.world = worlds[theme.id]; T = world.track;
  scene.add(world.group); applyLook();
  placeOnGrid();
}
function setBoat(i) {
  boatIdx = i; G.boatCol = BOATS[i];
  if (P.mesh) scene.remove(P.mesh);
  P.mesh = makeBoat(BOATS[i], 1); scene.add(P.mesh);
}
function placeOnGrid() {
  T.at(4, 0, tp);
  Object.assign(P, { x: tp.x, z: tp.z, y: 0, vy: 0, yaw: tp.yaw, vx: 0, vz: 0, steer: 0, hint: -1, s: 4, d: 0, laps: 0, air: false, onRamp: false });
  G.total = 4; G.speed = 0; camYaw = P.yaw;
  if (P.wake) P.wake.clear();
  G.rivals.forEach((rv, i) => {
    Object.assign(rv, { s: 4 + (i + 1) * 8.2, d: i % 2 ? 5.5 : -5.5, td: i % 2 ? 5.5 : -5.5, speed: 0, lat: 0,
      base: MAX * (0.93 + 0.012 * i) * theme.rival, acc: 17 + i * 1.1, wander: 1 + i * 0.37, ph: i * 1.7 });
    rv.wake.clear(); placeRival(rv, 0);
  });
}
function placeRival(rv, dt) {
  T.at(rv.s, rv.d, tp); rv.x = tp.x; rv.z = tp.z;
  const k = rv.speed / MAX, yaw = tp.yaw - rv.lat * 0.03;
  rv.mesh.position.set(tp.x, 0.05 + k * 0.16 + Math.sin(G.clock * 7 + rv.ph) * 0.05 * k, tp.z); rv.mesh.rotation.y = yaw;
  const hull = rv.mesh.userData.hull; hull.rotation.x = -(0.02 + k * 0.05); hull.rotation.z = clamp(-tp.curv * rv.speed * 1.6 + rv.lat * 0.03, -0.4, 0.4);
  const show = G.state !== 'attract' && G.state !== 'select';
  rv.mesh.visible = show;
  if (show) rv.wake.update(dt, tp.x, tp.z, yaw, k); else rv.wake.clear();
}
function setState(s) {
  G.state = s; G.stateT = 0;
  document.body.classList.toggle('racing', s === 'race' || s === 'countdown');
  music.hot = s === 'race' || s === 'countdown' || s === 'finish';
}
const say = (text, col = '#ffe14a', dur = 1.6) => { G.msg = { text, col, t: 0, dur }; };
function startRace() {
  world.reset(); placeOnGrid();
  G.boost = 0.34; G.boosting = false; G.cpIndex = 0; G.raceTime = 0; G.msg = null; G.newBest = false; G.rank = 8; G.wrongWay = false;
  shake = 0; spin = 0; wrongT = 0; stuckT = 0;
  bonus = (T.L / 3) / (MAX * theme.pace);
  G.timeLeft = bonus + 8; G.cd = 3.6;
  setState('countdown');
}
const cpAt = (k) => world.startS + (k + 1) * T.L / 3;
const wrap = (ds) => { const L = T.L; return ((ds + L / 2) % L + L) % L - L / 2; };

// ---------------------------------------------------------------- update
function rail(dt, v) {
  // demo / finish mode: the boat follows the centre line on its own
  G.total += v * dt; P.d = lerp(P.d, 0, damp(dt, 1.2));
  T.at(G.total, P.d, tp);
  P.steer = lerp(P.steer, clamp(tp.curv * 60, -1, 1), damp(dt, 3));
  P.x = tp.x; P.z = tp.z; P.yaw = tp.yaw; P.vx = tp.tx * v; P.vz = tp.tz * v; G.speed = v; P.y = Math.max(0, P.y - dt * 8); P.air = false;
  P.s = ((G.total % T.L) + T.L) % T.L; P.hint = Math.floor(P.s / T.step) % T.N;
}
function update(dt) {
  G.clock += dt; G.stateT += dt;
  if (G.msg) { G.msg.t += dt; if (G.msg.t > G.msg.dur) G.msg = null; }
  shake = Math.max(0, shake - dt * 2.4);
  const st = G.state;
  if (st === 'attract') rail(dt, 34);
  else if (st === 'select') { G.speed = 0; }
  else if (st === 'countdown') {
    const b = Math.ceil(G.cd); G.cd -= dt; const a = Math.ceil(G.cd);
    if (a !== b && a >= 1 && a <= 3) Snd.beep(false);
    if (G.cd <= 0) { setState('race'); say('GO!', '#6dff6d', 1.1); Snd.beep(true); }
  } else if (st === 'finish') rail(dt, lerp(G.speed, 30, damp(dt, 1.2)));
  else drive(dt, st === 'race');

  if (st === 'race' || st === 'finish' || st === 'gameover') updateRivals(dt, st === 'race');
  else G.rivals.forEach((rv) => placeRival(rv, dt));

  if (st === 'race') {
    G.raceTime += dt; G.timeLeft -= dt;
    if (G.total >= cpAt(G.cpIndex)) {
      G.cpIndex++;
      if (G.cpIndex === LAPS * 3) finish();
      else {
        G.timeLeft += bonus; Snd.checkpoint();
        if (G.cpIndex % 3 === 0) say(G.cpIndex === (LAPS - 1) * 3 ? 'FINAL LAP!' : 'LAP ' + (G.cpIndex / 3 + 1), '#ff5fd0', 2);
        else say('CHECKPOINT!  +' + bonus.toFixed(0) + ' SEC', '#ffe14a', 1.8);
      }
    } else if (G.timeLeft <= 0) { G.timeLeft = 0; setState('gameover'); Snd.over(); G.boosting = false; }
    else if (G.timeLeft < 10 && Math.ceil(G.timeLeft) !== Math.ceil(G.timeLeft + dt)) Snd.tone(980, 0.07, 'square', 0.1);
  }
  if (st === 'gameover' && G.stateT > 14) { setState('attract'); placeOnGrid(); }
  G.boostFx = lerp(G.boostFx, G.boosting ? 1 : 0, damp(dt, 5));
  poseBoat(dt);
  updateSpray(dt);
  updateCamera(dt);
}
function resetBoat() {
  T.at(P.s, clamp(P.d, -T.W + 4, T.W - 4), tp);
  P.x = tp.x; P.z = tp.z; P.yaw = tp.yaw; P.vx = tp.tx * 14; P.vz = tp.tz * 14; P.y = 0; P.vy = 0; P.air = false; spin = 0; wrongT = 0; stuckT = 0;
  const p = P; burst(p.x, 0.3, p.z, 30, 7, 1.2, 1, 1, 1); Snd.splash();
}
function drive(dt, racing) {
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = -fz, rz = fx;
  let vf = P.vx * fx + P.vz * fz, vl = P.vx * rx + P.vz * rz;
  const sp = vf / MAX;
  // steering
  let input = racing ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  if (spin > 0) { spin -= dt; input = 0; P.yaw += Math.sin(spin * 22) * dt * 2.5; }
  P.steer = lerp(P.steer, input, damp(dt, input === 0 ? 6 : 8));
  const turn = 1.32 * smooth(0, 16, Math.abs(vf)) * (1 - 0.22 * clamp(sp - 0.6, 0, 0.7)) * (P.air ? 0.25 : 1) * Math.sign(vf || 1);
  P.yaw -= P.steer * turn * dt;
  // thrust
  const gas = racing && (keys.up || G.touch) && !keys.down;
  const wantBoost = racing && keys.boost && G.boost > 0 && !keys.down;
  if (wantBoost && !G.boosting) { Snd.boostFx(); say('TURBO!', '#3ff3ff', 0.8); }
  G.boosting = wantBoost;
  const top = G.boosting ? MAX * BOOST_MULT : MAX;
  if (!P.air) {
    if (G.boosting) { G.boost = Math.max(0, G.boost - dt * 0.27); if (vf < top) vf = Math.min(top, vf + 40 * dt); }
    else if (racing && keys.down) vf = vf > 2 ? vf - 46 * dt : Math.max(-14, vf - 14 * dt);
    else if (gas) { if (vf < top) vf = Math.min(top, vf + 23 * (1.15 - 0.6 * clamp(sp, 0, 1)) * dt); }
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (6 + Math.abs(vf) * 0.22) * dt);
    if (vf > top) vf = Math.max(top, vf - 20 * dt);
    vf -= Math.abs(P.steer) * Math.max(0, vf) * 0.1 * dt;         // scrubbing speed in hard turns
    vl *= Math.exp(-dt * 3.4);
  } else if (G.boosting) G.boost = Math.max(0, G.boost - dt * 0.27);
  P.vx = fx * vf + rx * vl; P.vz = fz * vf + rz * vl;
  P.x += P.vx * dt; P.z += P.vz * dt;

  // where are we on the course
  const prevS = P.s;
  T.locate(P.x, P.z, P.hint, loc); P.hint = loc.i;
  let s = ((loc.s % T.L) + T.L) % T.L;
  if (prevS > T.L * 0.75 && s < T.L * 0.25) P.laps++; else if (prevS < T.L * 0.25 && s > T.L * 0.75) P.laps--;
  P.s = s; P.d = loc.d; G.total = P.laps * T.L + s;
  const i = loc.i, ttx = T.tx[i], ttz = T.tz[i], trx = -ttz, trz = ttx;
  // channel walls
  const lim = T.W - 1.4;
  if (Math.abs(P.d) > lim) {
    const sg = Math.sign(P.d), over = Math.abs(P.d) - lim;
    P.x -= trx * sg * over; P.z -= trz * sg * over; P.d = sg * lim;
    const vn = (P.vx * trx + P.vz * trz) * sg;
    if (vn > 0) {
      P.vx -= trx * sg * vn * 1.35; P.vz -= trz * sg * vn * 1.35;
      const loss = clamp(vn / 45, 0, 0.45); P.vx *= 1 - loss; P.vz *= 1 - loss;
      if (vn > 5 && bumpT <= 0) { Snd.bump(); bumpT = 0.35; shake = Math.max(shake, clamp(vn / 22, 0.2, 1)); burst(P.x, 0.4, P.z, 14, 5, 1, 1, 1, 1); }
    }
    P.vx *= 1 - 0.5 * dt; P.vz *= 1 - 0.5 * dt;
    const dir = P.vx * ttx + P.vz * ttz >= 0 ? 0 : Math.PI;
    P.yaw = lerpAngle(P.yaw, Math.atan2(ttx, ttz) + dir, damp(dt, 2.6));
  }
  bumpT -= dt;
  vf = P.vx * fx + P.vz * fz;
  G.speed = Math.abs(vf);

  // ramps and air
  let on = false;
  if (!P.air) for (const rp of world.ramps) {
    const ds = wrap(P.s - rp.s);
    if (ds > -5 && ds < 5 && Math.abs(P.d - rp.d) < 3.5 && vf > 14) { on = true; P.y = Math.max(P.y, 2.7 * (ds + 5) / 10); P.vy = vf * 0.27; break; }
  }
  if (P.onRamp && !on && !P.air) { P.air = true; Snd.jump(); say('BIG AIR!', '#ff9d2e', 1); G.boost = Math.min(1, G.boost + 0.06); }
  P.onRamp = on;
  if (P.air) {
    P.y += P.vy * dt; P.vy -= GRAV * dt;
    if (P.y <= 0) { P.y = 0; P.vy = 0; P.air = false; Snd.splash(); shake = Math.max(shake, 0.45); burst(P.x, 0.3, P.z, 60, 9, 1.5, 1, 1, 1); }
  } else if (!on) P.y = Math.max(0, P.y - dt * 12);

  // pickups and hazards
  for (const it of world.items) {
    if (it.kind === 'ramp') continue;
    const ds = wrap(P.s - it.s);
    if (ds > 8 || ds < -8) continue;
    const dx = P.x - it.x, dz = P.z - it.z, d2 = dx * dx + dz * dz;
    if (it.kind === 'boost') {
      if (it.t <= G.clock && d2 < 12 && Math.abs(P.y + 1 - it.y) < 3.6) { it.t = G.clock + 22; G.boost = Math.min(1, G.boost + 0.2); Snd.pickup(); burst(it.x, it.y, it.z, 16, 6, 0.9, 0.4, 0.9, 1); }
    } else if (racing && P.y < 1.2 && (it.hitT || 0) < G.clock) {
      const hit = it.kind === 'log' ? Math.abs(ds) < 1.9 && Math.abs(P.d - it.d) < 5.3 : d2 < (it.rad + 1.25) ** 2;
      if (hit) {
        it.hitT = G.clock + 1.6; P.vx *= 0.3; P.vz *= 0.3; shake = 1; spin = 0.5; Snd.crash(); say('CRASH!', '#ff4a3d', 0.9);
        burst(P.x, 0.5, P.z, 50, 10, 1.6, 1, 1, 1); burst(P.x, 0.8, P.z, 20, 8, 1.2, 1, 0.65, 0.2);
      }
    }
  }
  // wrong way / stuck helpers
  const along = fx * ttx + fz * ttz;
  wrongT = along < -0.35 && G.speed > 6 ? wrongT + dt : 0; G.wrongWay = wrongT > 0.6;
  stuckT = racing && gas && G.speed < 4 ? stuckT + dt : 0;
  if (stuckT > 2.2) resetBoat();
  // spray and turbo flames
  if (!P.air && G.speed > 5) sprayFrom(P.x, P.y, P.z, P.yaw, vf, (G.speed / MAX) * 3 + G.boostFx * 3);
}
function updateRivals(dt, racing) {
  let ahead = 0;
  for (const rv of G.rivals) {
    const gap = rv.s - G.total;
    const band = gap > 0 ? 1 - clamp((gap - 80) / 420, 0, 1) * 0.08 : 1 + clamp(-gap / 160, 0, 1) * 0.08;
    const target = rv.base * band;
    rv.speed = rv.speed < target ? Math.min(target, rv.speed + rv.acc * dt) : Math.max(target, rv.speed - 20 * dt);
    rv.s += rv.speed * dt;
    rv.td = Math.sin(G.clock * 0.31 * rv.wander + rv.ph) * (T.W - 5.5);
    const rs = ((rv.s % T.L) + T.L) % T.L;
    for (const it of world.items) {
      if (it.kind === 'boost') continue;
      const ds = wrap(it.s - rs), wide = it.kind === 'log' ? 7.5 : it.kind === 'ramp' ? 6.5 : 4.5;
      if (ds > -6 && ds < 85 && Math.abs(it.d - rv.d) < wide) { let side = rv.d >= it.d ? 1 : -1; if (Math.abs(it.d + side * wide) > T.W - 3) side = -side; rv.td = it.d + side * (wide + 1.5); }
    }
    for (const o of G.rivals) { if (o === rv) continue; const d = o.s - rv.s; if (d > 0 && d < 20 && Math.abs(o.d - rv.d) < 3.6) rv.td = rv.d + (rv.d >= o.d ? 5 : -5); }
    const nd = rv.d + clamp(clamp(rv.td, -T.W + 3.5, T.W - 3.5) - rv.d, -9 * dt, 9 * dt);
    rv.lat = lerp(rv.lat, (nd - rv.d) / dt, damp(dt, 6)); rv.d = nd;
    placeRival(rv, dt);
    // contact with the player
    const dx = P.x - rv.x, dz = P.z - rv.z;
    if (racing && P.y < 1.5 && dx * dx + dz * dz < 11.5) {
      const side = P.d >= rv.d ? 1 : -1, i = P.hint, trx = -T.tz[i], trz = T.tx[i];
      P.vx += trx * side * 9; P.vz += trz * side * 9; rv.d -= side * 0.5;
      if (gap > 0 && G.speed > rv.speed) { const k = (rv.speed * 0.9) / Math.max(1, G.speed); P.vx *= k; P.vz *= k; rv.speed += 3; }
      else if (gap <= 0 && rv.speed > G.speed) rv.speed = G.speed * 0.92;
      if (bumpT <= 0) { Snd.bump(); bumpT = 0.3; shake = Math.max(shake, 0.5); burst((P.x + rv.x) / 2, 0.6, (P.z + rv.z) / 2, 16, 6, 1, 1, 1, 1); }
    }
    if (rv.s > G.total) ahead++;
    if (rv.speed > 8 && Math.random() < 0.5) sprayFrom(rv.x, 0, rv.z, rv.mesh.rotation.y, rv.speed, 1);
  }
  if (racing) G.rank = ahead + 1;
}
function finish() {
  G.finishRank = G.rank;
  const b = G.best[theme.id];
  G.newBest = !b || G.raceTime < b.time;
  if (G.newBest) G.best[theme.id] = { time: G.raceTime, pos: G.finishRank }; else if (G.finishRank < b.pos) b.pos = G.finishRank;
  try { localStorage.setItem('turbotide.best3d', JSON.stringify(G.best)); } catch (e) { /* storage unavailable */ }
  setState('finish'); G.boosting = false; Snd.fanfare();
}
function poseBoat(dt) {
  const k = clamp(G.speed / MAX, 0, 1.3), m = P.mesh, hull = m.userData.hull, t = G.clock;
  const idle = G.state === 'select' || G.state === 'countdown';
  m.position.set(P.x, P.y + 0.05 + k * 0.18 + Math.sin(t * (idle ? 1.6 : 9)) * (idle ? 0.06 : 0.05 * k), P.z);
  m.rotation.y = P.yaw;
  const pitch = P.air ? clamp(P.vy / 46, -0.3, 0.4) : P.onRamp ? 0.27 : 0.02 + k * 0.055 + Math.sin(t * 11) * 0.008 * k;
  hull.rotation.x = lerp(hull.rotation.x, -pitch, damp(dt, 10));
  hull.rotation.z = lerp(hull.rotation.z, P.steer * 0.34 * smooth(0, 20, G.speed) + (idle ? Math.sin(t * 1.3) * 0.03 : 0), damp(dt, 8));
  for (const f of m.userData.flames) { f.visible = G.boostFx > 0.08; f.scale.set(1, G.boostFx * (0.8 + Math.random() * 0.5), 1); }
  P.wake.update(dt, P.x, P.z, P.yaw, P.air ? 0 : k);
  G.px = P.x; G.pz = P.z;
}
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(), lookNow = new THREE.Vector3();
function updateCamera(dt) {
  const st = G.state, k = G.speed / MAX;
  let dist = 9.6 + G.boostFx * 2.2 + k * 1.6, height = 3.7, lookAhead = 7, snap = 9, lookY = 1.5;
  if (st === 'attract') { camYaw = P.yaw + 2.5 + Math.sin(G.clock * 0.23) * 0.75; dist = 14; height = 2.6 + Math.sin(G.clock * 0.31) * 1.2; lookAhead = 0; }
  else if (st === 'select') { camYaw = P.yaw + 2.6 + G.clock * 0.45; dist = 10.5; height = 3.4; lookAhead = 0; snap = 5; lookY = 2.6; }
  else if (st === 'countdown') { camYaw = P.yaw + smooth(0.5, 3.6, G.cd) * 2.6; dist = 9.6 + smooth(0.5, 3.6, G.cd) * 4; lookAhead = 7 * (1 - smooth(0.5, 3.6, G.cd)); }
  else if (st === 'finish') { camYaw = P.yaw + smooth(0, 3, G.stateT) * 2.7 + Math.sin(G.clock * 0.3) * 0.3; dist = 13; height = 3.2; lookAhead = 0; }
  else camYaw = lerpAngle(camYaw, P.yaw, damp(dt, 3.4));
  camTarget.set(P.x - Math.sin(camYaw) * dist, P.y * 0.55 + height, P.z - Math.cos(camYaw) * dist);
  camTarget.y = Math.max(camTarget.y, world.heightAt(camTarget.x, camTarget.z) + 1.6);
  if (camera.position.distanceToSquared(camTarget) > 3600) camera.position.copy(camTarget);
  camera.position.lerp(camTarget, damp(dt, snap));
  camLook.set(P.x + Math.sin(P.yaw) * lookAhead, lookY + P.y * 0.75, P.z + Math.cos(P.yaw) * lookAhead);
  lookNow.lerp(camLook, damp(dt, 14));
  if (lookNow.distanceToSquared(camLook) > 900) lookNow.copy(camLook);
  camera.lookAt(lookNow);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; }
  camera.rotation.z += -P.steer * 0.035 * smooth(0, 30, G.speed);
  const fov = 62 + k * 5 + G.boostFx * 11;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, damp(dt, 6)); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- input
function confirm() {
  Snd.init();
  if (G.state === 'boot') return;
  if (G.paused) { G.paused = false; return; }
  if (G.state === 'attract') { setState('select'); placeOnGrid(); Snd.pickup(); }
  else if (G.state === 'select') { Snd.checkpoint(); startRace(); }
  else if (G.state === 'finish' && G.stateT > 2) { setState('select'); placeOnGrid(); }
  else if (G.state === 'gameover' && G.stateT > 2) startRace();
}
function nav(dx, dy) {
  if (G.state !== 'select' || G.loading) return;
  Snd.tone(660, 0.06, 'square', 0.1);
  if (dy) setBoat((boatIdx + dy + BOATS.length) % BOATS.length);
  if (dx) {
    const next = (G.themeIdx + dx + THEMES.length) % THEMES.length;
    if (worlds[THEMES[next].id]) loadTheme(next);
    else { G.loading = true; G.themeIdx = next; setTimeout(() => { loadTheme(next); G.loading = false; }, 60); }   // let the "loading" text paint first
  }
}
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost' };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k || e.code === 'Enter') e.preventDefault();
  if (e.repeat) return;
  Snd.init(); G.touch = false; document.body.classList.remove('touch');
  if (k) keys[k] = true;
  const inRace = G.state === 'race' || G.state === 'countdown';
  if (e.code === 'Enter' || (e.code === 'Space' && !inRace)) { if (!G.loading) confirm(); }
  else if (k === 'left') nav(-1, 0); else if (k === 'right') nav(1, 0); else if (k === 'up') nav(0, -1); else if (k === 'down') nav(0, 1);
  if (e.code === 'KeyM') { Snd.toggleMute(); G.muted = Snd.muted; }
  if (e.code === 'KeyR' && G.state === 'race' && !G.paused) resetBoat();
  if ((e.code === 'KeyP' || e.code === 'Escape') && inRace) G.paused = !G.paused;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.state === 'race') G.paused = true; });
addEventListener('touchstart', () => { G.touch = true; document.body.classList.add('touch'); }, { passive: true });
glCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const x = e.clientX / innerWidth * HW, y = e.clientY / innerHeight * HH;
  if (G.state === 'select' && !G.paused) {
    Snd.init(); if (G.loading) return;
    const i = cardRects().findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i >= 0) { if (i === G.themeIdx) confirm(); else nav(i - G.themeIdx, 0); }
    else if (y > HH - 180 && y < HH - 70) nav(0, x < HW / 2 ? -1 : 1);
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
addEventListener('resize', resize);

// ---------------------------------------------------------------- main loop
resize();
drawOverlay(G);
let last = 0, acc = 0, slow = 0, frameMs = 16, qLock = false;
const STEP = 1 / 60;
function loop(now) {
  requestAnimationFrame(loop);
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  acc += real;
  let n = 0;
  while (acc >= STEP && n++ < 5) { if (!G.paused) update(STEP); acc -= STEP; }
  if (acc > STEP) acc = 0;
  // drop quality if the device cannot keep up
  frameMs = lerp(frameMs, real * 1000, 0.05);
  slow = frameMs > 26 ? slow + real : 0;
  if (slow > 2.5 && quality > 0 && !qLock) { quality--; slow = 0; frameMs = 16; if (quality === 0) { pixelRatio = Math.min(pixelRatio, 1); resize(); } }
  const on = !G.paused && (G.state === 'race' || G.state === 'countdown' || G.state === 'finish' || G.state === 'gameover');
  Snd.engine(on, G.state === 'countdown' ? 0.15 + Math.random() * 0.02 : G.speed / MAX, G.boosting, P.air);
  world.update(G.clock, camera, G.clock);
  if (quality >= 2) composer.render(); else renderer.render(scene, camera);
  drawOverlay(G);
}
setTimeout(() => {
  initSpray();
  RIVAL_COLS.forEach((col, i) => { const mesh = makeBoat(col, i + 2); scene.add(mesh); G.rivals.push({ col, mesh, wake: new Wake(1.5), s: 0, d: 0, x: 0, z: 0, speed: 0, lat: 0 }); });
  P.wake = new Wake(1.7);
  setBoat(0); loadTheme(0);
  setState('attract');
  last = performance.now();
  requestAnimationFrame(loop);
}, 30);

// small hook for automated checks
window.__tt = { G, P, keys, get track() { return T; }, get quality() { return quality; }, lockQuality(q) { quality = q; qLock = true; } };
