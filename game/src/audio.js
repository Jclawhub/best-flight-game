// Senja Amphibi — WebAudio sounds, all synthesised, no audio files.
// Engine hum follows the throttle, plus chimes, thuds, spray and fanfare.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.alarmAt = 0;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 28;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      osc.connect(filter); sub.connect(filter);
      filter.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); sub.start();
      this.engineOsc = osc; this.engineSub = sub; this.engineGain = gain;
    } catch (err) {
      this.ctx = null;
    }
  }

  setEngine(throttle, airborne, speed, fuel) {
    if (!this.ctx || !this.engineGain || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const target = airborne ? 0.035 + throttle * 0.05 : 0.02 + throttle * 0.03;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(52 + throttle * 46 + speed * 0.08, t, 0.1);
      this.engineSub.frequency.setTargetAtTime(26 + throttle * 22, t, 0.1);
      if (fuel < 20 && fuel > 0 && t - this.alarmAt > 1.0) {
        this.alarmAt = t;
        this.beep(880, 0.09, 0.06);
      }
    } catch (err) { /* audio is never fatal */ }
  }

  beep(freq, dur, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (err) { /* ignore */ }
  }

  chime() { this.beep(1320, 0.18, 0.12); setTimeout(() => this.beep(1760, 0.22, 0.1), 90); }
  swoosh() {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(300, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.22);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.25);
    } catch (err) { /* ignore */ }
  }
  thud() { this.beep(70, 0.25, 0.2); }
  splash() { this.beep(240, 0.3, 0.08); }
  click() { this.beep(660, 0.06, 0.08); }

  fanfare() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.35, 0.12), i * 140);
    });
  }
}
