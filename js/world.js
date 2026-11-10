// Builds a complete course: spline track, terrain, water, sky, scenery and race objects.
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, rng, fbm } from './util.js';
import { makeGate } from './models.js';

export const THEMES = [
  { id: 'coral', name: 'CORAL COVE', diff: 'EASY', stars: 1, seed: 7, R: 330, sx: 1.3, harm: [[2, 0.1], [3, 0.12], [5, 0.045]], W: 19,
    pace: 0.76, rival: 0.955, wake: '#ffffff', hazard: 0.22, terrain: 'island', hill: 30,
    sky: { zen: '#0b4fd0', hor: '#a9e2ff', sun: [0.45, 0.62, -0.64], sunCol: '#fff4cf', cloud: '#ffffff', cloudA: 0.95, cov: 0.56, stars: 0 },
    fogD: 0.0012, water: { deep: '#0a6aa6', shallow: '#2fe0d0', foam: '#ffffff' },
    light: { sun: 2.7, hemiSky: '#cfe9ff', hemiGround: '#6f8f5a', hemi: 1.25 }, bloom: [0.22, 0.92], exposure: 1.0,
    card: ['#1560c8', '#58b8f5', '#d9f6ff', '#42b04c', '#f4e3a8', '#18b4d6', '#fffbd6'] },
  { id: 'canyon', name: 'CANYON FURY', diff: 'MEDIUM', stars: 2, seed: 23, R: 340, sx: 1.2, harm: [[2, 0.12], [3, 0.1], [4, 0.09], [7, 0.035]], W: 17,
    pace: 0.82, rival: 0.985, wake: '#fff1e0', hazard: 0.34, terrain: 'canyon', hill: 48,
    sky: { zen: '#33206e', hor: '#ffb469', sun: [-0.62, 0.2, -0.76], sunCol: '#ffd9a0', cloud: '#ffb0a0', cloudA: 0.7, cov: 0.56, stars: 0 },
    fogD: 0.0015, water: { deep: '#0d5c6e', shallow: '#3cc9b0', foam: '#fff0dd' },
    light: { sun: 2.5, hemiSky: '#ffc9a0', hemiGround: '#8a5a44', hemi: 1.3 }, bloom: [0.3, 0.88], exposure: 1.0,
    card: ['#3b1e6e', '#e8563f', '#ffd27a', '#b9542c', '#e2a765', '#1f8f9c', '#fff1b0'] },
  { id: 'neon', name: 'NEON HARBOR', diff: 'HARD', stars: 3, seed: 91, R: 350, sx: 1.15, harm: [[2, 0.1], [3, 0.13], [5, 0.08], [8, 0.035]], W: 16,
    pace: 0.88, rival: 1.01, wake: '#7f9cff', hazard: 0.46, terrain: 'city', hill: 0,
    sky: { zen: '#04021a', hor: '#5a1e7a', sun: [0.5, 0.42, -0.75], sunCol: '#cfd8ff', cloud: '#8a4ab8', cloudA: 0.35, cov: 0.58, stars: 1 },
    fogD: 0.0016, water: { deep: '#07133f', shallow: '#1a3fa0', foam: '#7ef9ff' },
    light: { sun: 1.1, hemiSky: '#a58aff', hemiGround: '#4a2a70', hemi: 1.7 }, bloom: [0.5, 0.8], exposure: 1.15,
    card: ['#05021a', '#1a0b4a', '#5a1e7a', '#15182b', '#ff3fb4', '#0c2a6b', '#f1f4ff'] },
];

// ---------------------------------------------------------------- track
function buildTrack(th) {
  const r = rng(th.seed), M = 40, ctrl = [], ph = th.harm.map(() => r() * TAU);
  for (let i = 0; i < M; i++) {
    const a = i / M * TAU;
    let k = 1;
    th.harm.forEach(([f, amp], j) => { k += amp * Math.sin(f * a + ph[j]); });
    ctrl.push(new THREE.Vector3(Math.cos(a) * th.R * k * th.sx, 0, Math.sin(a) * th.R * k));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 2), pts = curve.getSpacedPoints(N), step = L / N;
  const px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N), curv = new Float32Array(N);
  for (let i = 0; i < N; i++) { px[i] = pts[i].x; pz[i] = pts[i].z; }
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N, dx = px[b] - px[a], dz = pz[b] - pz[a], l = Math.hypot(dx, dz);
    tx[i] = dx / l; tz[i] = dz / l;
  }
  for (let i = 0; i < N; i++) {
    const a = (i + N - 4) % N, b = (i + 4) % N;
    // positive = bending toward the right-hand side
    curv[i] = ((tx[b] - tx[a]) * -tz[i] + (tz[b] - tz[a]) * tx[i]) / (8 * step);
  }
  const T = { N, L, step, W: th.W, px, pz, tx, tz, curv };
  T.at = (s, d = 0, out = {}) => {
    const f = (((s % L) + L) % L) / step, i = Math.floor(f) % N, j = (i + 1) % N, k = f - Math.floor(f);
    const x = lerp(px[i], px[j], k), z = lerp(pz[i], pz[j], k);
    let ax = lerp(tx[i], tx[j], k), az = lerp(tz[i], tz[j], k); const l = Math.hypot(ax, az); ax /= l; az /= l;
    out.x = x - az * d; out.z = z + ax * d; out.tx = ax; out.tz = az; out.yaw = Math.atan2(ax, az); out.curv = lerp(curv[i], curv[j], k);
    return out;
  };
  T.locate = (x, z, hint, out = {}) => {
    let best = hint, bd = 1e18;
    const span = hint < 0 ? N : 14, h = hint < 0 ? 0 : hint;
    for (let k = hint < 0 ? 0 : -span; k <= span; k++) {
      const i = (h + k + N * 2) % N, dx = x - px[i], dz = z - pz[i], d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    const dx = x - px[best], dz = z - pz[best];
    out.i = best; out.s = best * step + dx * tx[best] + dz * tz[best]; out.d = dx * -tz[best] + dz * tx[best];
    return out;
  };
  return T;
}

// ---------------------------------------------------------------- shaders
const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
`;
const WATER_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform float uT, uFogD; uniform vec3 uDeep, uShallow, uSkyH, uSkyZ, uSun, uSunCol, uFog, uFoam; uniform sampler2D uH; uniform vec4 uBox;
varying vec3 vW;
${NOISE}
float waves(vec2 p){
  return vn(p*.16 + vec2(uT*.5, uT*.33))*.55 + vn(p*.42 - vec2(uT*.7, uT*.45))*.3 + vn(p*1.1 + vec2(uT*1.1, -uT*.8))*.15;
}
void main(){
  vec2 p = vW.xz; vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
  float e = .6, h0 = waves(p);
  vec3 n = normalize(vec3((h0 - waves(p + vec2(e,0.)))*2.2, e*(.55 + dist*.012), (h0 - waves(p + vec2(0.,e)))*2.2));
  vec2 uv = (p - uBox.xy) * uBox.zw;
  float th = (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) ? texture2D(uH, uv).r * 8. - 4. : -4.;
  float fres = .03 + .97 * pow(1. - max(dot(n, V), 0.), 5.);
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 sky = mix(uSkyH, uSkyZ, pow(clamp(R.y, 0., 1.), .55));
  float sd = max(dot(R, uSun), 0.);
  vec3 base = mix(uDeep, uShallow, smoothstep(-3.6, -.3, th) * .9 + .08 * h0);
  vec3 col = mix(base, sky, fres * .9) + uSunCol * (pow(sd, 420.) * 3. + pow(sd, 40.) * .22);
  float crest = smoothstep(.8, .95, h0) * smoothstep(700., 60., dist) * .16;
  float fn = vn(p*.9 + vec2(uT*.6, -uT*.4));
  float foam = smoothstep(-1.15, -.25, th + (fn - .5) * 1.1 + sin(uT*1.6 + th*5.) * .12);
  col = mix(col, uFoam, clamp(foam * .9 + crest, 0., 1.));
  float ff = 1. - exp(-uFogD*uFogD*dist*dist);
  col = mix(col, uFog, ff);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SKY_VS = `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const SKY_FS = `
uniform vec3 uH, uZ, uSun, uSunCol, uCloud; uniform float uT, uCloudA, uCov, uStars; varying vec3 vD;
${NOISE}
float fbm(vec2 p){ float v = 0., a = .5; for(int i = 0; i < 4; i++){ v += vn(p)*a; p = p*2.03 + 7.1; a *= .5; } return v; }
void main(){
  vec3 d = normalize(vD); float y = max(d.y, 0.);
  vec3 col = mix(uH, uZ, pow(y, .5));
  if (uStars > .5) { vec3 q = floor(d * 190.); float s = hash(q.xy + q.z * 17.3); col += vec3(step(.9965, s)) * smoothstep(.05, .3, d.y) * (.5 + .5*hash(q.zy)); }
  float s = max(dot(d, uSun), 0.);
  col += uSunCol * (smoothstep(.9992, .9996, s) * 4. + pow(s, 12.) * .28 + pow(s, 120.) * .5);
  vec2 q = d.xz / (y + .12) * 1.1 + uT * .006;
  float c = smoothstep(uCov, uCov + .28, fbm(q)) * smoothstep(.0, .16, d.y) * uCloudA;
  col = mix(col, uCloud * (.75 + .35 * fbm(q * 2. + 3.)), c);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- world
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _sc = new THREE.Vector3();
const mat4 = (x, y, z, yaw = 0, s = 1, pitch = 0) => {
  _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ')); if (typeof s === 'number') _sc.set(s, s, s); else _sc.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _sc);
};

export function buildWorld(th, kit, renderer) {
  const group = new THREE.Group(), r = rng(th.seed * 31 + 5);
  const T = buildTrack(th), W = T.W, { N, px, pz, tx, tz } = T;
  const sunDir = new THREE.Vector3(...th.sky.sun).normalize();
  const col = (c) => new THREE.Color(c);

  // ---- distance field + heightfield
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]); }
  const margin = 170, cell = 3.6;
  minX -= margin; minZ -= margin; maxX += margin; maxZ += margin;
  const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  const H = new Float32Array(nx * nz);
  const seed = th.seed;
  const heightFn = (x, z, dist, border) => {
    const e = dist - W;
    let h;
    if (th.terrain === 'city') {
      h = lerp(-4 + 3.2 * smooth(-10, 1, e), 2.4, smooth(0.8, 2.6, e));
    } else {
      const big = fbm(x / 300 + 9, z / 300 + 4, seed, 3);
      const m = th.terrain === 'island' ? smooth(0.4, 0.52, big) : 1;
      const n = fbm(x / 90, z / 90, seed + 3, 4);
      const h1 = -4 + 3.6 * smooth(-10, 3, e) * m;
      let land;
      if (th.terrain === 'island') land = smooth(1, 16, e) * 2.3 + smooth(12, 90, e) * th.hill * (0.15 + 1.5 * n * n);
      else {
        land = smooth(1, 6, e) * 1.6 + smooth(4, 30, e) * th.hill * (0.45 + 0.9 * n);
        const q = Math.round(land / 9) * 9; land = lerp(land, q, 0.72 * smooth(6, 14, land));
      }
      h = h1 + land * m;
    }
    return lerp(-4, h, smooth(0, 70, border));
  };
  for (let j = 0; j < nz; j++) {
    const z = minZ + j * cell;
    for (let i = 0; i < nx; i++) {
      const x = minX + i * cell;
      let bd = 1e18;
      for (let k = 0; k < N; k += 2) { const dx = x - px[k], dz = z - pz[k], d2 = dx * dx + dz * dz; if (d2 < bd) bd = d2; }
      const border = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
      H[j * nx + i] = heightFn(x, z, Math.sqrt(bd), border);
    }
  }
  const heightAt = (x, z) => {
    const fx = (x - minX) / cell, fz = (z - minZ) / cell;
    if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return -4;
    const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, o = j * nx + i;
    return lerp(lerp(H[o], H[o + 1], a), lerp(H[o + nx], H[o + nx + 1], a), b);
  };

  // ---- terrain mesh
  {
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), c = new THREE.Color(), c2 = new THREE.Color();
    const strata = ['#c9683a', '#b0502a', '#d98a4e', '#9c4322', '#c25f33'];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const o = j * nx + i, x = minX + i * cell, z = minZ + j * cell, h = H[o], n = fbm(x / 22, z / 22, seed + 9, 2);
      pos[o * 3] = x; pos[o * 3 + 1] = h; pos[o * 3 + 2] = z;
      if (th.terrain === 'island') {
        if (h < 1.6) c.set('#f3e2a8').lerp(c2.set('#d6bf82'), n);
        else if (h < 16) c.set('#4dba56').lerp(c2.set('#2f8f42'), clamp(n * 1.3 + (h - 2) / 40, 0, 1));
        else if (h < 30) c.set('#2f8040').lerp(c2.set('#6f7f5a'), smooth(16, 30, h));
        else c.set('#8b8f98').lerp(c2.set('#b9bec8'), n);
      } else if (th.terrain === 'canyon') {
        if (h < 1.4) c.set('#e8bd80').lerp(c2.set('#d6a565'), n);
        else c.set(strata[Math.floor(h / 4.5 + n * 1.2) % strata.length]).lerp(c2.set('#e39a5a'), n * 0.25);
      } else c.set('#1b1f36').lerp(c2.set('#2a2f4c'), n);
      colr[o * 3] = c.r; colr[o * 3 + 1] = c.g; colr[o * 3 + 2] = c.b;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let k = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c3 = a + nx, d = c3 + 1;
      if (H[a] < -3.5 && H[b] < -3.5 && H[c3] < -3.5 && H[d] < -3.5) continue;   // permanently under water
      idx[k++] = a; idx[k++] = c3; idx[k++] = b; idx[k++] = b; idx[k++] = c3; idx[k++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, k), 1)); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  }

  // ---- sky + fog + lights
  const fogCol = col(th.sky.hor);
  const skyU = { uH: { value: col(th.sky.hor) }, uZ: { value: col(th.sky.zen) }, uSun: { value: sunDir }, uSunCol: { value: col(th.sky.sunCol) },
    uCloud: { value: col(th.sky.cloud) }, uT: { value: 0 }, uCloudA: { value: th.sky.cloudA }, uCov: { value: th.sky.cov }, uStars: { value: th.sky.stars } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
  const hemi = new THREE.HemisphereLight(col(th.light.hemiSky), col(th.light.hemiGround), th.light.hemi); group.add(hemi);
  const sun = new THREE.DirectionalLight(col(th.sky.sunCol), th.light.sun); sun.position.copy(sunDir).multiplyScalar(100); group.add(sun);
  const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, skyMat.clone()));
  const env = pm.fromScene(envScene, 0, 1, 4000).texture; pm.dispose();

  // ---- water
  const hb = new Uint8Array(nx * nz);
  for (let i = 0; i < nx * nz; i++) hb[i] = clamp((H[i] + 4) / 8, 0, 1) * 255;
  const hTex = new THREE.DataTexture(hb, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
  hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
  const waterU = { uT: { value: 0 }, uFogD: { value: th.fogD }, uDeep: { value: col(th.water.deep) }, uShallow: { value: col(th.water.shallow) },
    uSkyH: { value: col(th.sky.hor) }, uSkyZ: { value: col(th.sky.zen) }, uSun: { value: sunDir }, uSunCol: { value: col(th.sky.sunCol) }, uFog: { value: fogCol }, uFoam: { value: col(th.water.foam) },
    uH: { value: hTex }, uBox: { value: new THREE.Vector4(minX, minZ, 1 / ((nx - 1) * cell), 1 / ((nz - 1) * cell)) } };
  const wg = new THREE.PlaneGeometry(14000, 14000); wg.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS })); water.frustumCulled = false; group.add(water);

  // ---- instanced scenery
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const litMat2 = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const bins = new Map();
  const put = (name, m, variant) => {
    const list = kit.props[name], v = variant === undefined ? (r() * list.length) | 0 : variant, key = name + ':' + v;
    if (!bins.has(key)) bins.set(key, { def: list[v], mats: [] });
    bins.get(key).mats.push(m);
  };
  const flush = (dynamic) => {
    const out = {};
    for (const [key, b] of bins) {
      const meshes = [];
      for (const [geo, mat] of [[b.def.lit, b.def.double ? litMat2 : litMat], [b.def.glow, glowMat]]) {
        if (!geo) continue;
        const im = new THREE.InstancedMesh(geo, mat, b.mats.length);
        b.mats.forEach((m, i) => im.setMatrixAt(i, m));
        if (dynamic) im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.frustumCulled = false; group.add(im); meshes.push(im);
      }
      out[key] = meshes;
    }
    bins.clear();
    return out;
  };
  const P = {};
  // buoys mark the edge of the channel
  for (let s = 0; s < T.L - 6; s += 13) {
    T.at(s, -W, P); if (heightAt(P.x, P.z) < 0.4) put('buoyG', mat4(P.x, 0, P.z, r() * TAU));
    T.at(s, W, P); if (heightAt(P.x, P.z) < 0.4) put('buoyR', mat4(P.x, 0, P.z, r() * TAU));
  }
  const startS = 70;
  // shoreline scenery
  if (th.terrain !== 'city') {
    for (let i = 0; i < N; i += 2) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      if (r() > 0.62) continue;
      const e = 5 + Math.pow(r(), 1.6) * 95;
      T.at(i * T.step, side * (W + e), P);
      const h = heightAt(P.x, P.z);
      if (h < 0.7) continue;
      const slope = Math.abs(heightAt(P.x + 3, P.z) - h) + Math.abs(heightAt(P.x, P.z + 3) - h);
      const v = r(), yaw = r() * TAU;
      if (th.terrain === 'island') {
        if (slope > 4) { if (v < 0.4) put('rock', mat4(P.x, h - 0.3, P.z, yaw, 1.5 + r() * 3)); continue; }
        if (h < 1.7) { if (v < 0.22) put('umbrella', mat4(P.x, h, P.z, yaw, 1.1)); else if (v < 0.62) put('palm', mat4(P.x, h - 0.2, P.z, yaw, 0.9 + r() * 0.5)); else if (v < 0.72) put('rock', mat4(P.x, h - 0.2, P.z, yaw, 0.8 + r() * 1.4)); }
        else if (h < 12) { if (v < 0.55) put('palm', mat4(P.x, h - 0.3, P.z, yaw, 1 + r() * 0.7)); else if (v < 0.85) put('bush', mat4(P.x, h - 0.2, P.z, yaw, 1 + r() * 1.3)); else if (v < 0.9 && slope < 1.2 && e < 40) put('hut', mat4(P.x, h - 0.9, P.z, yaw)); else put('rock', mat4(P.x, h - 0.3, P.z, yaw, 1 + r() * 2)); }
        else if (v < 0.6) put('bush', mat4(P.x, h - 0.4, P.z, yaw, 2 + r() * 2.5)); else if (v < 0.8) put('rock', mat4(P.x, h - 0.4, P.z, yaw, 2 + r() * 4));
      } else {
        if (slope > 7) continue;
        if (v < 0.3) put('cactus', mat4(P.x, h - 0.2, P.z, yaw, 0.9 + r() * 0.7));
        else if (v < 0.52) put('boulder', mat4(P.x, h - 0.4, P.z, yaw, 1 + r() * 3.2));
        else if (v < 0.62 && e > 12) put('spire', mat4(P.x, h - 1, P.z, yaw, 0.8 + r() * 1.3));
        else if (v < 0.74) put('deadTree', mat4(P.x, h - 0.1, P.z, yaw, 1 + r() * 0.8));
      }
    }
    // rock stacks standing in the open water beside the course
    if (th.terrain === 'canyon') for (let s = 40; s < T.L; s += 55 + r() * 80) { const side = r() < 0.5 ? -1 : 1; T.at(s, side * (W + 5 + r() * 4), P); if (heightAt(P.x, P.z) < 0.5) put('spire', mat4(P.x, -1.5, P.z, r() * TAU, 0.55 + r() * 0.4)); }
  } else {
    for (let s = 0; s < T.L; s += 24) for (const side of [-1, 1]) { T.at(s + 6, side * (W + 5), P); if (heightAt(P.x, P.z) > 2) put('lamp', mat4(P.x, 2.4, P.z, P.yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2))); }
  }
  // landmarks beside the start line
  for (const side of [-1, 1]) for (let e = 9; e < 60; e += 4) {
    T.at(startS + 26 * side, side * (W + e), P); const h = heightAt(P.x, P.z);
    if (h > 0.9 && h < 9) { put('grandstand', mat4(P.x, h - 0.4, P.z, P.yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2))); break; }
  }
  if (th.terrain === 'island') for (let s = T.L * 0.2; s < T.L; s += T.L * 0.3) for (let e = 8; e < 70; e += 5) {
    T.at(s, W + e, P); const h = heightAt(P.x, P.z); if (h > 1.5 && h < 10) { put('lighthouse', mat4(P.x, h - 0.5, P.z, 0, 1.3)); break; }
  }
  // ramps (static)
  const items = [], ramps = [];
  const lanes = [-0.62, -0.31, 0, 0.31, 0.62].map((v) => v * (W - 3));
  const gatesS = [startS, startS + T.L / 3, startS + 2 * T.L / 3];
  const nearGate = (s) => gatesS.some((g) => Math.abs(s - g) < 60) || s < 170 || s > T.L - 40;
  const pick = (a) => a[(r() * a.length) | 0];
  const dyn = [];
  const addItem = (kind, s, d, extra = {}) => { T.at(s, d, P); const it = { kind, s, d, x: P.x, z: P.z, yaw: P.yaw, t: 0, ph: r() * TAU, y: 0, ...extra }; items.push(it); dyn.push(it); return it; };
  for (let s = 190; s < T.L - 70; s += 62 + r() * 46) {
    if (nearGate(s)) continue;
    const v = r(), cv = Math.abs(T.at(s, 0, P).curv);
    if (v < 0.36) {
      const d0 = pick(lanes), drift = (r() - 0.5) * 2.4;
      for (let i = 0; i < 4; i++) addItem('boost', s + i * 9, clamp(d0 + drift * i, -W + 4, W - 4), { y: 1.5 });
    } else if (v < 0.36 + th.hazard) {
      const kind = pick(['log', 'mine', 'barrel', 'mine', 'barrel']), cnt = kind === 'log' ? 1 : 1 + ((r() * 2.4) | 0), used = [];
      for (let i = 0; i < cnt; i++) { let d = pick(lanes); while (used.includes(d)) d = pick(lanes); used.push(d); addItem(kind, s + i * 13, d, { rad: kind === 'log' ? 4.4 : 1.5 }); }
    } else if (v < 0.36 + th.hazard + 0.22 && cv < 0.0035) {
      const d = pick([-0.4, 0, 0.4]) * (W - 4);
      T.at(s, d, P);
      const rp = { kind: 'ramp', s, d, x: P.x, z: P.z, yaw: P.yaw }; items.push(rp); ramps.push(rp);
      put('ramp', mat4(P.x, 0, P.z, P.yaw), 0);
      addItem('boost', s + 34, d, { y: 6.2 }); addItem('boost', s + 44, d, { y: 6.0 });
    }
  }
  flush(false);
  // dynamic race objects
  dyn.forEach((it) => { const name = it.kind === 'boost' ? 'canister' : it.kind; put(name, mat4(it.x, it.y, it.z, it.yaw), 0); it.key = name + ':0'; });
  const count = {}; dyn.forEach((it) => { it.idx = count[it.key] = (count[it.key] || 0); count[it.key]++; });
  const dynMesh = flush(true);

  // chevron boards on the outside of the sharp bends
  {
    const mats = { L: [], R: [] };
    for (let i = 0; i < N; i += 7) {
      const c = T.curv[i]; if (Math.abs(c) < 0.0062) continue;
      const right = c > 0, side = right ? -1 : 1;
      T.at(i * T.step, side * (W + 2.6), P);
      const h = Math.max(0, heightAt(P.x, P.z));
      (right ? mats.R : mats.L).push(mat4(P.x, h + 2.9, P.z, P.yaw + Math.PI));
    }
    const post = paintBox(new THREE.BoxGeometry(0.2, 3.2, 0.2));
    for (const k of ['L', 'R']) {
      if (!mats[k].length) continue;
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: k === 'L' ? kit.tex.chevL : kit.tex.chevR, side: THREE.DoubleSide, toneMapped: th.terrain !== 'city' }), mats[k].length);
      const pm2 = new THREE.InstancedMesh(post, litMat, mats[k].length * 2);
      mats[k].forEach((m, i) => {
        im.setMatrixAt(i, m);
        for (const o of [-2.2, 2.2]) pm2.setMatrixAt(i * 2 + (o > 0 ? 1 : 0), m.clone().multiply(_m4.makeTranslation(o, -2.4, -0.1)));
      });
      pm2.instanceColor = null; im.frustumCulled = pm2.frustumCulled = false; group.add(im, pm2);
    }
  }

  // city blocks
  if (th.terrain === 'city') {
    const variants = [[15, 15, 48], [19, 13, 76], [13, 13, 112], [23, 17, 36], [16, 16, 150]];
    const geos = variants.map(([w, d, h]) => {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.005); else uv.setXY(i, uv.getX(i) * (f < 2 ? d : w) / 20, uv.getY(i) * h / 40);
      }
      g.translate(0, h / 2, 0);
      return g;
    });
    const lists = variants.map(() => []), trims = [], neon = ['#ff3fb4', '#3ff3ff', '#ffe14a', '#b65cff', '#5aff9a'];
    const taken = [];
    const tryTower = (x, z, v) => {
      if (heightAt(x, z) < 2.3) return;
      const [w, d, h] = variants[v];
      for (const o of [[w / 2 + 2, 0], [-w / 2 - 2, 0], [0, d / 2 + 2], [0, -d / 2 - 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2]]) if (heightAt(x + o[0], z + o[1]) < 2.3) return;
      for (const t of taken) if (Math.abs(t[0] - x) < 20 && Math.abs(t[1] - z) < 20) return;
      taken.push([x, z]);
      lists[v].push(mat4(x, 2.3, z, 0));
      trims.push({ m: mat4(x, 2.3 + h + 0.4, z, 0, [w + 0.8, 0.8, d + 0.8]), c: pick(neon) });
      if (r() < 0.5) trims.push({ m: mat4(x, 2.3 + h * (0.3 + r() * 0.4), z, 0, [w + 0.5, 0.5, d + 0.5]), c: pick(neon) });
    };
    for (let s = 0; s < T.L; s += 17) for (const side of [-1, 1]) for (const e of [16 + r() * 8, 44 + r() * 22, 84 + r() * 40]) {
      if (r() < 0.2) continue;
      T.at(s, side * (W + e), P);
      tryTower(P.x, P.z, e > 40 ? pick([1, 2, 4, 2]) : pick([0, 3, 1, 0]));
    }
    geos.forEach((g, v) => {
      if (!lists[v].length) return;
      const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: kit.tex.windows[v % 3] }), lists[v].length);
      lists[v].forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; group.add(im);
    });
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), trims.length), tc = new THREE.Color();
    trims.forEach((t, i) => { tm.setMatrixAt(i, t.m); tm.setColorAt(i, tc.set(t.c)); }); tm.frustumCulled = false; group.add(tm);
    // billboards facing the water
    let bi = 0;
    for (let s = 120; s < T.L; s += 210) {
      const side = bi % 2 ? -1 : 1; T.at(s, side * (W + 7), P);
      if (heightAt(P.x, P.z) < 2.3) continue;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: kit.tex.ads[bi % 3], side: THREE.DoubleSide, toneMapped: false }));
      b.position.set(P.x, 12, P.z); b.rotation.y = P.yaw + Math.PI + side * 0.5; group.add(b);
      for (const o of [-5, 5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), litMat); post.geometry = paintBox(post.geometry); post.position.set(P.x + Math.cos(b.rotation.y) * o, 6, P.z - Math.sin(b.rotation.y) * o); group.add(post); }
      bi++;
    }
  }

  // gates
  gatesS.forEach((s, i) => {
    T.at(s, 0, P);
    const g = makeGate(i ? kit.tex.gateCP : kit.tex.gateStart, W + 3.5, th.terrain === 'city');
    g.position.set(P.x, 0, P.z); g.rotation.y = P.yaw + Math.PI; group.add(g);
  });

  // minimap outline, normalised to a unit box
  const mapScale = 1 / Math.max(maxX - minX - margin * 2, maxZ - minZ - margin * 2);
  const mapPt = (x, z) => [((x - (minX + maxX) / 2) * mapScale), ((z - (minZ + maxZ) / 2) * mapScale)];
  const outline = []; for (let i = 0; i < N; i += 6) outline.push(mapPt(px[i], pz[i]));

  const tmpM = new THREE.Matrix4();
  const world = { theme: th, group, track: T, heightAt, items, ramps, gatesS, startS, env, fogCol, sunDir, outline, mapPt,
    update(t, cam, clock) {
      skyU.uT.value = t; waterU.uT.value = t;
      sky.position.copy(cam.position); water.position.set(cam.position.x, 0, cam.position.z);
      for (const it of dyn) {
        let y = it.y, yaw = it.yaw, sc = 1, pitch = 0;
        if (it.kind === 'boost') { if (it.t > clock) sc = 0.0001; yaw = t * 2.4 + it.ph; y += Math.sin(t * 3 + it.ph) * 0.25; sc *= 1.25; }
        else { y = Math.sin(t * 1.7 + it.ph) * 0.14; if (it.kind === 'log') yaw = it.yaw + Math.PI / 2 * 0 + Math.sin(t * 0.5 + it.ph) * 0.06; else pitch = Math.sin(t * 1.3 + it.ph) * 0.08; }
        tmpM.copy(mat4(it.x, y, it.z, yaw, sc, pitch));
        for (const m of dynMesh[it.key]) m.setMatrixAt(it.idx, tmpM);
      }
      for (const k in dynMesh) for (const m of dynMesh[k]) m.instanceMatrix.needsUpdate = true;
    },
    reset() { for (const it of dyn) it.t = 0; },
  };
  return world;
}
function paintBox(g) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = 0.12; a[i * 3 + 1] = 0.13; a[i * 3 + 2] = 0.2; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
