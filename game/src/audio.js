// Synthesised sound: no audio files, everything is WebAudio oscillators.
// Engine hum, sirens, gunshots, pickups and a small bassline music loop.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = false;
    // A minor-key bassline that loops under the game (original, 8 steps).
    this.bassline = [55, 0, 55, 65.4, 49, 0, 58.3, 65.4];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.25, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  shot() { this.noise(0.12, 0.4, 2400); this.tone(160, 0.1, 'square', 0.18, 60); }
  punch() { this.noise(0.08, 0.3, 700); }
  pickup() { this.tone(660, 0.09, 'sine', 0.22); this.tone(990, 0.14, 'sine', 0.22, null, 0.08); }
  cash() { this.tone(880, 0.08, 'triangle', 0.2); this.tone(1174, 0.08, 'triangle', 0.2, null, 0.07); this.tone(1568, 0.16, 'triangle', 0.2, null, 0.14); }
  siren() { this.tone(700, 0.5, 'sine', 0.07, 950); this.tone(950, 0.5, 'sine', 0.07, 700, 0.5); }
  crash() { this.noise(0.25, 0.4, 500); this.tone(90, 0.2, 'sawtooth', 0.2, 40); }
  engine(speed01) {
    if (!this.ctx || this.muted) return;
    // Short engine blip; called while driving, pitch follows speed.
    this.tone(60 + speed01 * 130, 0.09, 'sawtooth', 0.05);
  }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, null, i * 0.1)); }
  busted() { [392, 311, 233].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.16, null, i * 0.18)); }
  update(dt, driving) {
    if (!this.ctx || this.muted) return;
    this.musicTimer += dt;
    if (this.musicTimer > 0.24) {
      this.musicTimer = 0;
      const f = this.bassline[this.musicStep % this.bassline.length];
      if (f > 0) this.tone(f, 0.22, 'triangle', driving ? 0.06 : 0.09);
      if (this.musicStep % 4 === 2) this.tone(220, 0.1, 'sine', 0.03);
      this.musicStep++;
    }
  }
}
