// Senja Amphibi — game orchestration: state machine, loop, __game API.
// States: title, flying, paused, staging, complete, gameover.

import { buildWorld, START_POS } from './world.js';
import { Seaplane } from './plane.js';
import { MissionSet, MISSION_DEFS } from './missions.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { drawScene } from './render.js';
import {
  drawFlightHUD, drawTitle, drawComplete, drawGameOver, drawPaused, VIEW_PILL,
} from './hud.js';
import { applyShot } from './shots.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.world = buildWorld(7);
    this.plane = new Seaplane();
    this.missions = new MissionSet();
    this.missionDefs = MISSION_DEFS;
    this.input = new Input(this.canvas);
    this.input.setPillRect(VIEW_PILL);
    this.audio = new SoundBank();
    this.state = 'title';
    this.view = 'chase';
    this.timeScale = 1;
    this.time = 0;
    this.lastTs = 0;
    this.uiCards = [];
    this.demoAngle = 0;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'flying') this.state = 'paused';
    });
  }

  startMission(id) {
    this.plane.reset(START_POS.x, START_POS.z, 0);
    this.missions.start(id);
    this.state = 'flying';
    this.audio.ensure();
  }

  toggleView() {
    this.view = this.view === 'chase' ? 'cockpit' : 'chase';
    this.audio.click();
  }

  togglePause() {
    if (this.state === 'flying') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'flying';
  }

  restart() {
    if (this.missions.current) this.startMission(this.missions.current);
    else this.startMission('rings');
  }

  handleKeys() {
    const input = this.input;
    if (input.takePressed('KeyC')) {
      if (this.state === 'flying' || this.state === 'staging' || this.state === 'title'
        || this.state === 'paused' || this.state === 'complete' || this.state === 'gameover') {
        this.toggleView();
      }
    }
    if (input.takePressed('KeyP')) this.togglePause();
    if (input.takePressed('KeyR')) {
      if (this.state !== 'title' && this.state !== 'staging') this.restart();
    }
    if (input.takePressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
    }
    const digitMap = { Digit1: 'rings', Digit2: 'hop', Digit3: 'mail', Digit4: 'rescue' };
    for (const [code, id] of Object.entries(digitMap)) {
      if (input.takePressed(code)) {
        if (this.state === 'title' || this.state === 'complete'
          || this.state === 'gameover' || this.state === 'paused') {
          this.startMission(id);
        }
      }
    }
    if (input.takePressed('Enter')) {
      if (this.state === 'title') this.startMission('rings');
    }
  }

  handleClicks() {
    for (const c of this.input.takeClicks()) {
      // View pill first: it toggles the view and swallows the click.
      if (c.x >= VIEW_PILL.x && c.x <= VIEW_PILL.x + VIEW_PILL.w
        && c.y >= VIEW_PILL.y && c.y <= VIEW_PILL.y + VIEW_PILL.h) {
        this.toggleView();
        continue;
      }
      if (this.state === 'title') {
        for (const card of this.uiCards) {
          if (c.x >= card.x && c.x <= card.x + card.w
            && c.y >= card.y && c.y <= card.y + card.h) {
            this.startMission(card.id);
            break;
          }
        }
      }
    }
  }

  update(dt) {
    this.handleKeys();
    this.handleClicks();
    // Clouds always drift, even behind the title screen.
    for (const c of this.world.clouds) {
      c.x += c.drift * dt;
      if (c.x > 3000) c.x = -3000;
    }
    if (this.state === 'title') {
      // Slow demo orbit behind the title screen: the plane circles (0, 900)
      // and its heading follows the tangent of the circle, not the radius.
      this.demoAngle += dt * 0.07;
      this.plane.heading = Math.atan2(Math.cos(this.demoAngle), -Math.sin(this.demoAngle));
      this.plane.alt = 60;
      this.plane.speed = 160;
      this.plane.throttle = 0.5;
      this.plane.x = Math.sin(this.demoAngle) * 260;
      this.plane.z = 900 + Math.cos(this.demoAngle) * 260;
      this.plane.bank = 0.18;
      this.plane.prop += dt * 20;
      this.audio.setEngine(0, 0, false);
      return;
    }
    if (this.state === 'paused' || this.state === 'staging'
      || this.state === 'complete' || this.state === 'gameover') {
      this.audio.setEngine(0, 0, false);
      return;
    }
    // Flying.
    if (this.input.takeSpace()) {
      const dropped = this.missions.dropCrate(this.plane);
      if (dropped) this.audio.swoosh();
    }
    const event = this.plane.update(dt, this.input, this.world);
    if (event === 'takeoff') this.audio.swoosh();
    if (event === 'landed-clean') this.audio.splash();
    if (event === 'landed-rough') { this.audio.thud(); this.audio.splash(); }
    if (event === 'crashed-sea' || event === 'crashed-island') this.audio.thud();
    this.missions.onPlaneEvent(event, this.plane);
    const ringsBefore = this.missions.ringIndex;
    this.missions.checkRings(this.plane);
    if (this.missions.ringIndex > ringsBefore) {
      this.audio.chime();
      this.audio.swoosh();
    }
    this.missions.update(dt);
    if (this.missions.complete && this.state === 'flying') {
      this.state = 'complete';
      this.audio.fanfare();
    } else if (this.missions.failed && this.state === 'flying') {
      this.state = 'gameover';
    }
    this.audio.setEngine(this.plane.throttle, this.plane.speed, this.plane.fuel < 20);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1280, 720);
    drawScene(ctx, this, this.time);
    if (this.state === 'title') {
      drawTitle(ctx, this);
    } else {
      drawFlightHUD(ctx, this, this.time);
      if (this.state === 'complete') drawComplete(ctx, this);
      else if (this.state === 'gameover') drawGameOver(ctx, this);
      else if (this.state === 'paused') drawPaused(ctx);
    }
  }

  loop(ts) {
    const raw = this.lastTs ? (ts - this.lastTs) / 1000 : 0.016;
    this.lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, raw)) * this.timeScale;
    this.time += dt;
    this.update(dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  boot() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = Number(params.get('seed') || 7);
    if (shot) {
      applyShot(this, shot, seed);
    } else {
      // Demo orbit behind the title screen: plane at the start, alt 60,
      // speed 160, rings mission started.
      this.plane.reset(START_POS.x, START_POS.z, 0);
      this.plane.alt = 60;
      this.plane.speed = 160;
      this.plane.throttle = 0.5;
      this.missions.start('rings');
      this.state = 'title';
    }
    window.__game = {
      game: this,
      plane: this.plane,
      missions: this.missions,
      get world() { return game.world; },
      setTimeScale(n) { game.timeScale = n; },
      audio: this.audio,
    };
    requestAnimationFrame((t) => this.loop(t));
  }
}

const game = new Game();
game.boot();
