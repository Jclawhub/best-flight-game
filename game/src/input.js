// input.js — keyboard, mouse and touch input for Senja Amphibi.
// W/S or Up/Down throttle, A/D or Left/Right turn, mouse hold to climb,
// Space drops a crate, P pause, R restart, C view, M mute, 1-4 missions,
// Enter starts. Touch: on-screen CLIMB / turn buttons.

export function createInput(doc, canvas) {
  const input = {
    keys: new Set(),
    mouseHeld: false,
    touchClimb: false,
    touchTurn: 0, // -1 left, +1 right
    // Edge-triggered actions, consumed once per frame by main.js.
    dropQueued: false,
    pauseQueued: false,
    restartQueued: false,
    viewQueued: false,
    muteQueued: false,
    missionQueued: null, // 'rings' | 'hop' | 'mail' | 'rescue'
    startQueued: false,
  };

  const KEY_TO_MISSION = {
    Digit1: 'rings',
    Digit2: 'hop',
    Digit3: 'mail',
    Digit4: 'rescue',
  };

  doc.addEventListener('keydown', (e) => {
    if (e.repeat) {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      return;
    }
    input.keys.add(e.code);
    if (e.code === 'Space') {
      input.dropQueued = true;
      e.preventDefault();
    }
    if (e.code === 'KeyP') input.pauseQueued = true;
    if (e.code === 'KeyR') input.restartQueued = true;
    if (e.code === 'KeyC') input.viewQueued = true;
    if (e.code === 'KeyM') input.muteQueued = true;
    if (e.code === 'Enter') input.startQueued = true;
    if (KEY_TO_MISSION[e.code]) input.missionQueued = KEY_TO_MISSION[e.code];
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });

  doc.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });

  // If the window loses focus mid-flight (alt-tab, devtools), drop every
  // held key so the plane never flies on with a stuck throttle or turn.
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseHeld = false;
    input.touchClimb = false;
    input.touchTurn = 0;
  });

  // Mouse hold on the canvas = climb. Also counts as the audio gesture.
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseHeld = true;
  });
  doc.addEventListener('mouseup', () => {
    input.mouseHeld = false;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseHeld = false;
  });

  // Touch buttons (wired by id in index.html).
  const bindHold = (id, on, off) => {
    const el = doc.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); off(); }, { passive: false });
    el.addEventListener('touchcancel', () => off());
    el.addEventListener('mousedown', (e) => { e.preventDefault(); on(); });
    el.addEventListener('mouseup', () => off());
  };
  bindHold('btn-climb',
    () => { input.touchClimb = true; },
    () => { input.touchClimb = false; });
  bindHold('btn-left',
    () => { input.touchTurn = -1; },
    () => { if (input.touchTurn === -1) input.touchTurn = 0; });
  bindHold('btn-right',
    () => { input.touchTurn = 1; },
    () => { if (input.touchTurn === 1) input.touchTurn = 0; });

  return input;
}

// Read the continuous flight controls for this frame.
export function readFlight(input) {
  const keys = input.keys;
  const throttleUp = keys.has('KeyW') || keys.has('ArrowUp');
  const throttleDown = keys.has('KeyS') || keys.has('ArrowDown');
  let turn = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) turn -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) turn += 1;
  turn += input.touchTurn;
  turn = Math.max(-1, Math.min(1, turn));
  const climb = input.mouseHeld || input.touchClimb;
  return { throttleUp, throttleDown, turn, climb };
}

// Consume the edge-triggered actions queued since the last frame.
export function consumeActions(input) {
  const out = {
    drop: input.dropQueued,
    pause: input.pauseQueued,
    restart: input.restartQueued,
    view: input.viewQueued,
    mute: input.muteQueued,
    mission: input.missionQueued,
    start: input.startQueued,
  };
  input.dropQueued = false;
  input.pauseQueued = false;
  input.restartQueued = false;
  input.viewQueued = false;
  input.muteQueued = false;
  input.missionQueued = null;
  input.startQueued = false;
  return out;
}
