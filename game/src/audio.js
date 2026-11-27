// Senja Amphibi — all sound is synthesised WebAudio. No audio files.
// Nothing here may throw: every method is wrapped in try/catch.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.muted = false;
    this.lastBeep = 0;
  }

  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        // Engine hum: sawtooth 55 Hz + sine sub 28 Hz through a lowpass.
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineSub = this.ctx.createOscillator();
        this.engineSub.type = 'sine';
        this.engineSub.frequency.value = 28;
        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.7;
        this.engineOsc.connect(this.engineFilter);
        this.engineSub.connect(subGain);
        subGain.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineSub.start();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) { /* audio must never break the game */ }
  }

  setMuted(m) {
    this.muted = m;
    try {
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
      }
    } catch (e) { /* ignore */ }
  }

  setEngine(throttle, speed, lowFuel) {
    try {
      if (!this.ctx || !this.engineGain) return;
      const t = this.ctx.currentTime;
      // Gain follows throttle and speed; the hum stays quiet on the
      // title screen (throttle 0, speed 0) so the page loads silent.
      const target = 0.02 + throttle * 0.05 + Math.min(speed, 320) / 320 * 0.03;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + throttle * 45 + speed * 0.08, t, 0.1);
      this.engineSub.frequency.setTargetAtTime(28 + throttle * 14, t, 0.1);
      if (lowFuel && t - this.lastBeep > 1.2) {
        this.lastBeep = t;
        this.beep(880, 0.09, 0.12);
      }
    } catch (e) { /* ignore */ }
  }

  tone(freq, dur, type, vol, slideTo) {
    try {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  beep(freq, dur, vol) {
    this.tone(freq || 660, dur || 0.12, 'sine', vol || 0.18);
  }

  click() {
    this.tone(1200, 0.05, 'square', 0.08);
  }

  chime() {
    this.tone(880, 0.18, 'sine', 0.2);
    try {
      setTimeout(() => this.tone(1318, 0.25, 'sine', 0.18), 90);
    } catch (e) { /* ignore */ }
  }

  swoosh() {
    try {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  thud() {
    this.tone(90, 0.25, 'sine', 0.35, 45);
  }

  splash() {
    this.swoosh();
    this.tone(300, 0.2, 'sine', 0.15, 120);
  }

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      try {
        setTimeout(() => this.tone(f, 0.3, 'triangle', 0.22), i * 130);
      } catch (e) { /* ignore */ }
    });
  }
}
