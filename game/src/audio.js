// audio.js — WebAudio sounds for Senja Amphibi, written from scratch:
// engine hum pitched with throttle, ring chime, splash, mail-drop thump and
// a success jingle. Everything is guarded so a headless browser (or a
// browser without audio) never throws: no AudioContext, no sound, no crash.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    muted: false,
    started: false,
  };
  return audio;
}

// Call from a user gesture (or any time — failures are swallowed).
export function initAudio(audio) {
  if (audio.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine: two detuned saws through a lowpass, gain tied to throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 52;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 55;
    audio.engineFilter = audio.ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineFilter);
    audio.engineOsc2.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();
    audio.started = true;
  } catch {
    audio.ctx = null;
  }
}

export function setEngine(audio, throttle, speed, flying) {
  if (!audio.ctx || !audio.started || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const target = flying ? 0.028 + throttle * 0.05 : 0;
    audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
    const freq = 46 + throttle * 42 + speed * 0.06;
    audio.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    audio.engineOsc2.frequency.setTargetAtTime(freq * 1.02, t, 0.1);
    audio.engineFilter.frequency.setTargetAtTime(240 + throttle * 700, t, 0.1);
  } catch {
    // Audio is cosmetic; never let it break the game loop.
  }
}

function tone(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol || 0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch {
    // ignore
  }
}

export function playChime(audio) {
  tone(audio, 880, 0.18, 'sine', 0.2);
  tone(audio, 1318, 0.3, 'sine', 0.18, 0.09);
}

export function playSplash(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const dur = 0.5;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  } catch {
    // ignore
  }
}

export function playThump(audio) {
  tone(audio, 140, 0.2, 'triangle', 0.25);
  tone(audio, 70, 0.25, 'sine', 0.2, 0.02);
}

export function playClick(audio) {
  tone(audio, 660, 0.07, 'triangle', 0.12);
  tone(audio, 990, 0.09, 'triangle', 0.1, 0.04);
}

export function playJingle(audio) {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => tone(audio, n, 0.35, 'sine', 0.2, i * 0.13));
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) {
    try {
      audio.master.gain.value = muted ? 0 : 0.5;
    } catch {
      // ignore
    }
  }
}
