// Senja Amphibi — game loop, state machine and the window.__game handle
// the play-test driver uses. States: title, flying, paused, staging
// (frozen for screenshots), complete, gameover.

import { buildWorld, START_POS } from './world.js';
import { Seaplane } from './plane.js';
import { MissionSet, MISSION_DEFS } from './missions.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { drawScene } from './render.js';
import { drawFlightHUD, drawTitle, drawComplete, drawGameOver, drawPaused } from './hud.js';
import { applyShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = buildWorld(7);
    this.plane = new Seaplane();
    this.missions = new MissionSet(this.world);
    this.input = new Input(canvas);
    this.audio = new SoundBank();
    this.missionDefs = MISSION_DEFS;
    this.state = 'title';
    this.timeScale = 1;
    this.time = 0;
    this.lastTs = 0;
    this.uiCards = [];
    this.horizon = 218;
    this.sunX = 640;
    // Losing the tab mid-sortie pauses instead of flying on blind.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'flying') this.state = 'paused';
    });
  }

  setTimeScale(n) {
    this.timeScale = n;
  }

  startMission(id) {
    this.plane.reset(START_POS.x, START_POS.z, START_POS.heading);
    this.missions.start(id);
    this.state = 'flying';
    this.audio.ensure();
  }

  togglePause() {
    if (this.state === 'flying') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'flying';
  }

  restart() {
    if (this.missions.current) this.startMission(this.missions.current);
  }

  handleKeys() {
    const k = this.input.keys;
    if (k.has('KeyP')) {
      k.delete('KeyP');
      this.togglePause();
      this.audio.click();
    }
    if (k.has('KeyR')) {
      k.delete('KeyR');
      if (this.state !== 'title') this.restart();
    }
    if (k.has('KeyM')) {
      k.delete('KeyM');
      this.audio.muted = !this.audio.muted;
    }
    if (this.state === 'title' || this.state === 'complete' || this.state === 'gameover') {
      for (const def of this.missionDefs) {
        if (k.has(`Digit${def.key}`)) {
          k.delete(`Digit${def.key}`);
          this.startMission(def.id);
          return;
        }
      }
      if (k.has('Enter')) {
        k.delete('Enter');
        this.startMission('rings');
      }
    }
  }

  handleClicks() {
    if (this.state !== 'title') return;
    for (const click of this.input.takeClicks()) {
      for (const card of this.uiCards) {
        if (click.x >= card.x && click.x <= card.x + card.w
          && click.y >= card.y && click.y <= card.y + card.h) {
          this.audio.ensure();
          this.audio.click();
          this.startMission(card.id);
          return;
        }
      }
    }
    this.input.takeClicks();
  }

  update(dt) {
    this.handleKeys();
    this.handleClicks();
    if (this.state !== 'flying') return;
    if (this.input.takeSpace()) this.missions.dropCrate(this.plane, this.audio);
    const ev = this.plane.update(dt, this.input, this.world);
    if (ev) this.missions.onPlaneEvent(ev, this.plane, this.audio);
    this.missions.update(dt, this.plane, this.audio);
    if (this.missions.complete) this.state = 'complete';
    else if (this.missions.failed) this.state = 'gameover';
    if (this.missions.complete && this.state === 'complete') this.audio.fanfare();
    this.audio.setEngine(this.plane.throttle, !this.plane.landed, this.plane.speed, this.plane.fuel);
    // Clouds drift with the wind, always.
    for (const cl of this.world.clouds) {
      cl.x += cl.drift * dt;
      if (cl.x > 3000) cl.x = -3000;
    }
  }

  render() {
    const ctx = this.ctx;
    drawScene(ctx, this, this.time);
    if (this.state === 'title') {
      drawTitle(ctx, this);
    } else if (this.state === 'complete') {
      drawFlightHUD(ctx, this);
      drawComplete(ctx, this);
    } else if (this.state === 'gameover') {
      drawFlightHUD(ctx, this);
      drawGameOver(ctx, this);
    } else if (this.state === 'paused') {
      drawFlightHUD(ctx, this);
      drawPaused(ctx, this);
    } else {
      drawFlightHUD(ctx, this);
    }
  }

  loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000)) * this.timeScale;
    this.lastTs = ts;
    this.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  boot() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = Number(params.get('seed') || 7);
    if (shot) {
      applyShot(this, shot, seed);
    } else {
      // A slow demo orbit behind the title screen so it feels alive.
      this.plane.reset(START_POS.x, START_POS.z, 0.3);
      this.plane.alt = 60; this.plane.speed = 160;
      this.plane.throttle = 0.5; this.plane.landed = false;
      this.missions.start('rings');
    }
    requestAnimationFrame((t) => {
      this.lastTs = t;
      this.loop(t);
    });
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = {
  game,
  plane: game.plane,
  missions: game.missions,
  // Live reference: staging can rebuild the world, and the driver must see it.
  get world() { return game.world; },
  setTimeScale: (n) => game.setTimeScale(n),
  audio: game.audio,
};
game.boot();
