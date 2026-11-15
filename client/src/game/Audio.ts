// Sons synthétisés en direct avec WebAudio : aucun fichier audio, tout est original.
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sea: GainNode | null = null;
  private wind: GainNode | null = null;
  private rain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.7;
  muted = false;

  /** Doit être appelé après une interaction de l'utilisateur (règle des navigateurs). */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
    } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; }
    this.sea = this.loop(380, 0.5);
    this.wind = this.loop(1200, 0.0, 'bandpass');
    this.rain = this.loop(3000, 0.0, 'highpass');
  }

  private loop(freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    return g;
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v;
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : v;
  }

  ambience(t: number, speed: number, wind: number, storm: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sea?.gain.setTargetAtTime(0.22 + 0.12 * Math.sin(t * 0.5) + speed * 0.012 + storm * 0.25, now, 0.3);
    this.wind?.gain.setTargetAtTime(0.03 + wind * 0.05 + storm * 0.22, now, 0.5);
    this.rain?.gain.setTargetAtTime(storm * 0.18, now, 0.8);
  }

  private burst(dur: number, freq: number, gain: number, delay = 0, q = 0.7, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx || !this.noise) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.25), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  private thump(freq: number, dur: number, gain: number, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 0.35, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur);
  }

  /** Coup de canon, atténué avec la distance. */
  cannon(distance: number) {
    const v = Math.max(0.03, 1 - distance / 1600);
    const delay = distance / 340;
    this.burst(1.6, 900, 0.9 * v, delay, 0.5);
    this.thump(70, 0.5, 0.8 * v, delay);
  }
  explosion(distance: number, big: boolean) {
    const v = Math.max(0.04, 1 - distance / 2200) * (big ? 1.4 : 0.8);
    const delay = distance / 340;
    this.burst(big ? 3 : 1.5, 600, v, delay, 0.4);
    this.thump(45, big ? 1.4 : 0.7, v, delay);
  }
  impact(distance: number) {
    const v = Math.max(0.03, 1 - distance / 900);
    this.burst(0.35, 2500, 0.5 * v, distance / 340, 1.2, 'bandpass');
    this.thump(140, 0.15, 0.4 * v, distance / 340);
  }
  splash(distance: number) {
    const v = Math.max(0, 1 - distance / 700);
    if (v > 0) this.burst(0.7, 1800, 0.35 * v, distance / 340, 0.8, 'bandpass');
  }
  thunder(delay: number) {
    this.burst(4, 300, 1.2, delay, 0.3);
    this.thump(35, 2.5, 0.8, delay);
  }
  bell() {
    if (!this.ctx) return;
    const c = this.ctx;
    for (const [f, g] of [[660, 0.25], [1320, 0.1], [1980, 0.05]] as const) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const gg = c.createGain();
      gg.gain.setValueAtTime(g, c.currentTime);
      gg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 2.5);
      o.connect(gg).connect(this.master!);
      o.start();
      o.stop(c.currentTime + 2.5);
    }
  }
  click() {
    if (!this.ctx) return;
    this.burst(0.05, 3000, 0.15, 0, 2, 'bandpass');
  }
  coins() {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1800 + i * 350;
      const g = c.createGain();
      const t0 = c.currentTime + i * 0.06;
      g.gain.setValueAtTime(0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 0.3);
    }
  }
}
