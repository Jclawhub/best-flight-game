// WebAudio bleeps for Senja Amphibi — no audio files, everything is
// synthesised. The engine hum follows the throttle, and the game fires short
// cues for rings, landings, alarms and clicks. AudioContext only starts on
// the first user gesture, so loading the page never makes a sound.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.muted = false;
    this.alarmTimer = 0;
  }

  // Start (or resume) the context. Safe to call on every gesture.
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 52;
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'sine';
        this.engineOsc2.frequency.value = 104;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.5;
        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(g2);
        g2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
        this.engineOsc2.start();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (_err) {
      this.ctx = null;
    }
  }

  // Continuous engine hum: pitch and loudness follow the throttle.
  setEngine(throttle, flying) {
    if (!this.ctx || this.muted) return;
    const target = flying ? 0.015 + throttle * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    const freq = 46 + throttle * 68;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(freq * 2, this.ctx.currentTime, 0.1);
  }

  // Short two-note chime when a ring is flown.
  chime() {
    this._tone(880, 0.16, 'sine', 0.12);
    window.setTimeout(() => this._tone(1318, 0.22, 'sine', 0.12), 70);
  }

  // Low thud for a touchdown.
  thud() {
    this._tone(72, 0.25, 'sine', 0.22);
    this._tone(48, 0.3, 'triangle', 0.14);
  }

  // Two-beep low-fuel alarm. Call it at most once a second from the game.
  alarm() {
    this._tone(920, 0.09, 'square', 0.05);
    window.setTimeout(() => this._tone(920, 0.09, 'square', 0.05), 140);
  }

  // Tiny UI click.
  click() {
    this._tone(660, 0.05, 'sine', 0.06);
  }

  // Bright fanfare for mission complete.
  fanfare() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      window.setTimeout(() => this._tone(freq, 0.3, 'sine', 0.1), i * 110);
    });
  }

  // Mute or unmute everything (engine hum included).
  setMuted(muted) {
    this.muted = muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(muted ? 0 : 0.02, this.ctx.currentTime, 0.05);
    }
  }

  // Splash for a water touchdown: a short burst of filtered noise.
  splash() {
    if (!this.ctx || this.muted) return;
    try {
      const duration = 0.35;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.16;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
    } catch (_err) {
      // Audio is decoration; never let it break the game.
    }
  }

  _tone(freq, duration, type, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.02);
    } catch (_err) {
      // Audio is decoration; never let it break the game.
    }
  }
}
