// Synthesised engine, effects and music (WebAudio, no asset files).
export const Snd = {
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
export const music = { on: true, hot: false };

