// 2D overlay: HUD, menus and arcade text, drawn on a canvas above the 3D view.
import { TAU, clamp, fmtTime } from './util.js';
import { THEMES } from './world.js';

const FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';
export const ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
let ctx, W = 1280, H = 720, G;

export function initHud(canvas) { ctx = canvas.getContext('2d'); }
export function hudSize(w, h) { W = w; H = h; }

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
function panel(x, y, w, h, a = 0.5) {
  ctx.fillStyle = `rgba(6,14,34,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
}
const blink = (hz = 2) => Math.floor(G.clock * hz * 2) % 2 === 0;

function drawHUD() {
  const lap = Math.min(G.laps, Math.floor(G.cpIndex / 3) + 1), racing = G.state === 'race';
  panel(18, 16, 200, 96);
  txt('POS', 34, 40, 22, '#9fd8ff', 'left');
  gradText(ORD[G.rank - 1], 34, 78, 54, '#fff', G.rank === 1 ? '#ffd23c' : '#8fd0ff', 'left');
  txt('/8', 204, 88, 24, '#fff', 'right');
  panel(W - 218, 16, 200, 96);
  txt('LAP', W - 34, 40, 22, '#9fd8ff', 'right');
  gradText(lap + '/' + G.laps, W - 34, 78, 54, '#fff', '#8fd0ff', 'right');
  txt(fmtTime(G.raceTime), W - 204, 40, 20, '#fff', 'left');
  const low = G.timeLeft < 10 && racing;
  txt('TIME', W / 2, 30, 24, '#ffe14a');
  const tcol = low ? (blink(4) ? '#ff3b30' : '#fff') : '#fff';
  gradText(String(Math.ceil(G.timeLeft)).padStart(2, '0'), W / 2, 80, low ? 84 : 72, tcol, low ? tcol : '#ffd23c');
  // race progress strip
  const bw = Math.min(420, W * 0.34), bx = W / 2 - bw / 2, by = 128;
  ctx.fillStyle = 'rgba(6,14,34,.6)'; ctx.fillRect(bx - 4, by - 5, bw + 8, 10);
  ctx.fillStyle = '#fff'; for (let i = 0; i <= G.laps; i++) ctx.fillRect(bx + bw * i / G.laps - 1, by - 7, 2, 14);
  for (const rv of G.rivals) { ctx.fillStyle = rv.col.body; ctx.beginPath(); ctx.arc(bx + bw * clamp(G.progress(rv.s), 0, 1), by, 4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = G.boatCol.body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx + bw * clamp(G.progress(G.total), 0, 1), by, 7, 0, TAU); ctx.fill(); ctx.stroke();

  // on touch screens the bottom corners hold the buttons, so these panels move up
  const sT = G.touch ? 122 : H - 112, bT = G.touch ? 122 : H - 86;
  panel(W - 232, sT, 214, 94);
  gradText(String(Math.round(G.speed * 2.237)), W - 96, sT + 48, 68, '#fff', G.boosting ? '#3ff3ff' : '#ffd23c', 'right');
  txt('MPH', W - 34, sT + 62, 24, '#9fd8ff', 'right');
  panel(18, bT, 300, 68);
  txt('TURBO', 34, bT + 22, 20, G.boost > 0.02 ? '#3ff3ff' : '#6d7a94', 'left');
  ctx.fillStyle = '#0b1830'; ctx.fillRect(34, bT + 38, 268, 18);
  const bgd = ctx.createLinearGradient(34, 0, 302, 0); bgd.addColorStop(0, '#0a7cff'); bgd.addColorStop(1, '#6dfff0');
  ctx.fillStyle = G.boosting && blink(8) ? '#fff' : bgd; ctx.fillRect(34, bT + 38, 268 * G.boost, 18);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(34, bT + 38, 268, 18);
  for (let i = 1; i < 5; i++) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(34 + 268 * i / 5 - 1, bT + 38, 2, 18); }
  if (G.boost >= 0.2 && !G.boosting && !G.touch && blink(1.5)) txt('SPACE', 300, bT + 22, 16, '#fff', 'right');

  // minimap
  if (!G.touch) {
    const ms = 170, mx = 18 + ms / 2 + 8, my = H - 100 - ms / 2 - 14, w = G.world;
    panel(18, my - ms / 2 - 8, ms + 16, ms + 16, 0.4);
    ctx.lineJoin = 'round'; ctx.beginPath();
    w.outline.forEach(([x, z], i) => { const X = mx + x * ms * 0.92, Y = my + z * ms * 0.92; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.closePath(); ctx.strokeStyle = 'rgba(6,14,34,.9)'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = '#9fe6ff'; ctx.lineWidth = 4; ctx.stroke();
    const dot = (x, z, c, rad) => { const [a, b] = w.mapPt(x, z); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx + a * ms * 0.92, my + b * ms * 0.92, rad, 0, TAU); ctx.fill(); };
    for (const rv of G.rivals) dot(rv.x, rv.z, rv.col.body, 3.5);
    dot(G.px, G.pz, '#fff', 7); dot(G.px, G.pz, G.boatCol.body, 5);
  }

  if (G.msg) {
    const m = G.msg, k = Math.min(1, m.t * 7), fade = Math.min(1, (m.dur - m.t) * 4);
    ctx.globalAlpha = Math.max(0, fade); txt(m.text, W / 2, H * 0.3, Math.min(70, W * 0.058) * (1.5 - 0.5 * k), m.col); ctx.globalAlpha = 1;
  }
  if (G.wrongWay && racing && blink(3)) txt('WRONG WAY!', W / 2, H * 0.42, 50, '#ff4a3d');
  if (G.boostFx > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * G.boostFx})`; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * TAU, r1 = H * (0.42 + Math.random() * 0.25), r2 = r1 + 60 + Math.random() * 200, k = W / H * 0.85;
      ctx.moveTo(W / 2 + Math.cos(a) * r1 * k, H * 0.5 + Math.sin(a) * r1); ctx.lineTo(W / 2 + Math.cos(a) * r2 * k, H * 0.5 + Math.sin(a) * r2);
    }
    ctx.stroke();
  }
}

function drawLogo(y, size) {
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-0.045);
  const wob = Math.sin(G.clock * 2) * 4;
  txt('TURBO', -size * 0.34 + 6, -size * 0.36 + 6 + wob, size, 'rgba(0,0,0,.35)', 'center', null);
  txt('TIDE', size * 0.5 + 6, size * 0.46 + 6 - wob, size * 1.15, 'rgba(0,0,0,.35)', 'center', null);
  gradText('TURBO', -size * 0.34, -size * 0.36 + wob, size, '#fff36b', '#ff6a00');
  gradText('TIDE', size * 0.5, size * 0.46 - wob, size * 1.15, '#aef6ff', '#0a6cff');
  ctx.restore();
}
function drawAttract() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(4,10,30,.45)'); g.addColorStop(0.5, 'rgba(4,10,30,0)'); g.addColorStop(1, 'rgba(4,10,30,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawLogo(H * 0.25, Math.min(136, W * 0.115));
  txt('ARCADE SPEEDBOAT RACING', W / 2, H * 0.25 + Math.min(136, W * 0.115) * 1.55, Math.min(30, W * 0.03), '#fff');
  if (blink(1.2)) txt(G.touch ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, H * 0.8, Math.min(46, W * 0.045), '#ffe14a');
  txt('FREE PLAY', 30, H - 34, 26, '#6dff6d', 'left');
  txt('CREDITS  99', W - 30, H - 34, 22, '#fff', 'right');
  if (!G.touch && W > 1000) txt('STEER: ARROWS / WASD    TURBO: SPACE    R: RESET    M: MUTE    P: PAUSE', W / 2, H - 34, 17, '#9fd8ff');
}
export function cardRects() {
  const cw = Math.min(280, (W - 80) / 3), ch = 236, gap = Math.min(36, (W - cw * 3) / 4);
  const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  return THEMES.map((_, i) => ({ x: x0 + i * (cw + gap), y: 112, w: cw, h: ch }));
}
function drawSelect() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(4,10,30,.75)'); g.addColorStop(0.5, 'rgba(4,10,30,.25)'); g.addColorStop(0.62, 'rgba(4,10,30,0)'); g.addColorStop(1, 'rgba(4,10,30,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  gradText('SELECT YOUR COURSE', W / 2, 58, Math.min(54, W * 0.055), '#fff36b', '#ff6a00');
  cardRects().forEach((r, i) => {
    const th = THEMES[i], sel = i === G.themeIdx, c = th.card;
    ctx.save();
    if (sel) { ctx.translate(r.x + r.w / 2, r.y + r.h / 2); const k = 1.05 + Math.sin(G.clock * 6) * 0.012; ctx.scale(k, k); ctx.translate(-r.x - r.w / 2, -r.y - r.h / 2); }
    ctx.globalAlpha = sel ? 1 : 0.66;
    ctx.fillStyle = '#0a1226'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + 10, r.y + 10, r.w - 20, 110, 10); ctx.clip();
    const sg = ctx.createLinearGradient(0, r.y + 10, 0, r.y + 80); sg.addColorStop(0, c[0]); sg.addColorStop(0.6, c[1]); sg.addColorStop(1, c[2]);
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, 80);
    ctx.fillStyle = c[6]; ctx.beginPath(); ctx.arc(r.x + r.w * 0.72, r.y + 40, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = c[3]; ctx.fillRect(r.x, r.y + 74, r.w, 50);
    ctx.beginPath(); ctx.moveTo(r.x, r.y + 74);
    for (let x = 0; x <= r.w; x += 8) ctx.lineTo(r.x + x, r.y + 74 - (Math.sin(x * 0.045 + i * 2) * 0.5 + 0.5) * (i === 2 ? 0 : 22) - (i === 2 ? ((x * 7 + i) % 37) : 0));
    ctx.lineTo(r.x + r.w, r.y + 74); ctx.fill();
    const cx = r.x + r.w / 2;
    ctx.fillStyle = c[4]; ctx.beginPath(); ctx.moveTo(cx - 12, r.y + 74); ctx.lineTo(cx + 12, r.y + 74); ctx.lineTo(cx + r.w * 0.46, r.y + 122); ctx.lineTo(cx - r.w * 0.46, r.y + 122); ctx.fill();
    ctx.fillStyle = c[5]; ctx.beginPath(); ctx.moveTo(cx - 8, r.y + 74); ctx.lineTo(cx + 8, r.y + 74); ctx.lineTo(cx + r.w * 0.38, r.y + 122); ctx.lineTo(cx - r.w * 0.38, r.y + 122); ctx.fill();
    ctx.restore();
    txt(th.name, cx, r.y + 146, Math.min(30, r.w * 0.115), '#fff');
    txt(th.diff + '  ' + '★'.repeat(th.stars) + '☆'.repeat(3 - th.stars), cx, r.y + 180, 20, ['#6dff6d', '#ffe14a', '#ff4a3d'][i], 'center', '#101422', 4);
    const b = G.best[th.id];
    txt(b ? 'BEST ' + fmtTime(b.time) + '  ' + ORD[b.pos - 1] : 'BEST  -:--.--', cx, r.y + 212, 17, '#9fd8ff', 'center', null);
    ctx.lineWidth = sel ? 6 : 2; ctx.strokeStyle = sel ? '#ffe14a' : '#44506e'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.stroke();
    ctx.restore();
  });
  const by = H - 118;
  txt('◀', W / 2 - 190, by, 34, '#ffe14a'); txt('▶', W / 2 + 190, by, 34, '#ffe14a');
  txt(G.boatCol.name, W / 2, by, 34, '#fff');
  txt('YOUR BOAT', W / 2, by - 36, 18, '#9fd8ff');
  if (G.loading) txt('LOADING COURSE...', W / 2, H - 40, 26, '#fff');
  else if (blink(1.2)) txt(G.touch ? 'TAP COURSE AGAIN TO RACE' : '◀ ▶ COURSE    ▲ ▼ BOAT    ENTER TO RACE', W / 2, H - 40, Math.min(24, W * 0.026), '#ffe14a');
}
function drawCountdown() {
  const n = Math.ceil(G.cd);
  if (n <= 3 && n >= 1) {
    const f = G.cd - Math.floor(G.cd);
    ctx.globalAlpha = Math.min(1, f * 3); gradText(String(n), W / 2, H * 0.36, 170 + (1 - f) * 60, '#fff', '#ffd23c'); ctx.globalAlpha = 1;
  } else txt('GET READY', W / 2, H * 0.36, 70, '#fff');
  txt(G.theme.name, W / 2, H * 0.6, 40, '#fff');
}
function drawFinish() {
  ctx.fillStyle = `rgba(4,10,30,${Math.min(0.5, G.stateT * 0.4)})`; ctx.fillRect(0, 0, W, H);
  gradText(G.finishRank === 1 ? 'YOU WIN!' : 'FINISH!', W / 2, H * 0.2, Math.min(120, W * 0.1), '#fff36b', '#ff6a00');
  if (G.stateT > 1) {
    const y = H * 0.34;
    panel(W / 2 - 260, y, 520, 250, 0.75);
    txt('POSITION', W / 2 - 220, y + 54, 30, '#9fd8ff', 'left'); gradText(ORD[G.finishRank - 1], W / 2 + 220, y + 54, 54, '#fff', '#ffd23c', 'right');
    txt('TIME', W / 2 - 220, y + 122, 30, '#9fd8ff', 'left'); txt(fmtTime(G.raceTime), W / 2 + 220, y + 122, 44, '#fff', 'right');
    txt('BEST', W / 2 - 220, y + 186, 30, '#9fd8ff', 'left'); txt(fmtTime(G.best[G.theme.id].time), W / 2 + 220, y + 186, 44, '#fff', 'right');
    if (G.newBest && blink(3)) txt('NEW RECORD!', W / 2, y + 228, 28, '#6dff6d');
  }
  if (G.stateT > 2 && blink(1.2)) txt(G.touch ? 'TAP TO CONTINUE' : 'PRESS ENTER', W / 2, H - 60, 40, '#ffe14a');
}
function drawGameOver() {
  ctx.fillStyle = `rgba(30,4,10,${Math.min(0.6, G.stateT * 0.5)})`; ctx.fillRect(0, 0, W, H);
  if (G.stateT < 2) { txt('TIME UP!', W / 2, H * 0.4, Math.min(130, W * 0.11), '#ff4a3d'); return; }
  gradText('GAME OVER', W / 2, H * 0.3, Math.min(130, W * 0.11), '#fff', '#ff4a3d');
  txt('CONTINUE?', W / 2, H * 0.5, 44, '#fff');
  gradText(String(Math.max(0, Math.ceil(13 - G.stateT))), W / 2, H * 0.64, 100, '#fff36b', '#ff6a00');
  if (blink(1.2)) txt(G.touch ? 'TAP TO RETRY' : 'PRESS ENTER TO RETRY', W / 2, H - 60, 36, '#ffe14a');
}

export function drawOverlay(state) {
  G = state;
  ctx.clearRect(0, 0, W, H);
  if (G.state === 'boot') { ctx.fillStyle = '#041a33'; ctx.fillRect(0, 0, W, H); drawLogo(H * 0.4, Math.min(136, W * 0.115)); txt('LOADING...', W / 2, H * 0.8, 30, '#fff'); return; }
  if (G.state === 'attract') drawAttract();
  else if (G.state === 'select') drawSelect();
  else {
    drawHUD();
    if (G.state === 'countdown') drawCountdown();
    else if (G.state === 'finish') drawFinish();
    else if (G.state === 'gameover') drawGameOver();
  }
  if (G.paused) {
    ctx.fillStyle = 'rgba(4,10,30,.7)'; ctx.fillRect(0, 0, W, H);
    txt('PAUSED', W / 2, H / 2 - 20, 90, '#fff'); txt(G.touch ? 'TAP TO RESUME' : 'PRESS P TO RESUME', W / 2, H / 2 + 60, 30, '#ffe14a');
  }
  if (G.muted) txt('MUTED', W / 2, 152, 18, '#ff8a80');
}
