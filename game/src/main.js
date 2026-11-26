// Senja Amphibi — main loop, state machine and rendering.
// States: title → flying ⇄ paused → complete | gameover. The chase camera
// sits behind the seaplane; the world, the plane and the HUD are drawn every
// frame. window.__game exposes the live state for play-testing.

import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { World } from './world.js';
import { Plane } from './plane.js';
import { MissionManager, MISSIONS, MISSION_TIME } from './missions.js';
import { drawHUD } from './hud.js';
import { applyShot } from './shots.js';

const WIDTH = 1280;
const HEIGHT = 720;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.world = new World();
    this.plane = new Plane();
    this.missions = new MissionManager(this.world);
    this.state = 'title';
    this.selectedMission = 0;
    this.time = 0;
    this.last = 0;
    this.timeScale = 1;
    this.frozen = false;
    this.particles = [];
    this.alarmCooldown = 0;
    this.titleHeading = 0;
  }

  start() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const mission = params.get('mission');
    if (shot) {
      applyShot(this, shot, Number(params.get('seed') || 1));
    } else if (mission) {
      this.startMission(mission);
    }
    window.__game = {
      game: this,
      plane: this.plane,
      missions: this.missions,
      world: this.world,
      input: this.input,
      setTimeScale: (v) => { this.timeScale = v; },
    };
    const loop = (t) => {
      const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016) * this.timeScale;
      this.last = t;
      if (!this.frozen) {
        this.time += dt;
        this.update(dt);
      }
      this.render();
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  startMission(missionId) {
    const id = MISSIONS.some((m) => m.id === missionId) ? missionId : MISSIONS[0].id;
    this.missions.start(id);
    this.plane.reset(0, 60, 0);
    this.state = 'flying';
    this.audio.ensure();
    this.audio.click();
  }

  toTitle() {
    this.missions.reset();
    this.plane.reset(0, 60, 0);
    this.state = 'title';
    this.audio.setEngine(0, false);
  }

  update(dt) {
    const input = this.input;
    if (input.wasPressed('KeyM')) {
      if (this.state !== 'title') this.toTitle();
      return;
    }
    if (this.state === 'title') {
      if (input.wasPressed('Digit1') || input.wasPressed('Numpad1')) this.startMission('rings');
      else if (input.wasPressed('Digit2') || input.wasPressed('Numpad2')) this.startMission('hop');
      else if (input.wasPressed('Digit3') || input.wasPressed('Numpad3')) this.startMission('mail');
      else if (input.wasPressed('Enter')) this.startMission(MISSIONS[this.selectedMission].id);
      else if (input.wasPressed('ArrowDown')) this.selectedMission = (this.selectedMission + 1) % MISSIONS.length;
      else if (input.wasPressed('ArrowUp')) this.selectedMission = (this.selectedMission - 1 + MISSIONS.length) % MISSIONS.length;
      else if (input.wasClicked()) {
        // Click a mission row on the title screen.
        const my = input.mouse.y;
        const mx = input.mouse.x;
        for (let i = 0; i < MISSIONS.length; i++) {
          const y0 = 330 + i * 62;
          if (mx > 340 && mx < 940 && my > y0 && my < y0 + 52) {
            this.startMission(MISSIONS[i].id);
            break;
          }
        }
      }
      this.titleHeading += dt * 0.045;
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) this.state = 'flying';
      else if (input.wasPressed('KeyR')) this.startMission(this.missions.mission.id);
      return;
    }
    if (this.state === 'complete' || this.state === 'gameover') {
      if (input.wasPressed('KeyR')) this.startMission(this.missions.mission.id);
      return;
    }
    // Flying.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.state = 'paused';
      this.audio.setEngine(0, false);
      return;
    }
    if (input.wasPressed('KeyR')) {
      this.startMission(this.missions.mission.id);
      return;
    }
    if (input.mouse.down || input.wasPressed('Space')) this.audio.ensure();
    if (input.wasPressed('Space')) this.missions.onDropPressed(this.plane);
    const prevRingIndex = this.missions.ringIndex;
    this.plane.update(dt, input, this.world, (type, detail) => this._onPlaneEvent(type, detail));
    this.missions.update(dt, this.plane);
    if (this.missions.ringIndex > prevRingIndex) {
      const passed = this.world.rings[prevRingIndex];
      if (passed) this._ringBurst(passed);
      this.audio.chime();
    }
    this._updateParticles(dt);
    this.audio.setEngine(this.plane.throttle, this.plane.flying);
    if (this.plane.fuel < 25 && this.plane.flying) {
      this.alarmCooldown -= dt;
      if (this.alarmCooldown <= 0) {
        this.audio.alarm();
        this.alarmCooldown = 1.1;
      }
    }
    if (this.missions.complete) {
      this.state = 'complete';
      this.audio.fanfare();
      this.audio.setEngine(0, false);
    } else if (this.missions.failed) {
      this.state = 'gameover';
      this.audio.setEngine(0, false);
    }
  }

  _onPlaneEvent(type, detail) {
    if (type === 'landed') {
      this.audio.thud();
      this.audio.splash();
      this._splash();
      this.missions.onPlaneEvent('landed', detail, this.plane);
    } else if (type === 'rough') {
      this.audio.thud();
      this.audio.splash();
      this._splash();
      this.missions.onPlaneEvent('rough', detail, this.plane);
    } else if (type === 'crash') {
      this.audio.thud();
      this.missions.onPlaneEvent('crash', detail, this.plane);
    } else if (type === 'takeoff') {
      this.missions.message = 'Airborne!';
      this.missions.messageTimer = 1.5;
    }
  }

  _splash() {
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: this.plane.x + (Math.random() - 0.5) * 30,
        z: this.plane.z + (Math.random() - 0.5) * 30,
        y: 1 + Math.random() * 6,
        vy: 4 + Math.random() * 8,
        life: 0.7 + Math.random() * 0.5,
        color: '255,255,255',
      });
    }
  }

  _ringBurst(ring) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: ring.x + Math.cos(a) * 30,
        z: ring.z + Math.sin(a) * 30,
        y: ring.y + (Math.random() - 0.5) * 30,
        vy: 2 + Math.random() * 5,
        life: 0.9,
        color: '255,217,77',
      });
    }
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y > 0);
  }

  // ---- rendering ------------------------------------------------------

  _camera() {
    if (this.state === 'title') {
      return {
        x: -Math.sin(this.titleHeading) * 16,
        z: 60 - Math.cos(this.titleHeading) * 16,
        y: 6,
        heading: this.titleHeading,
        pitch: 0,
        horizonY: 330,
      };
    }
    const h = this.plane.heading;
    return {
      x: this.plane.x - Math.sin(h) * 16,
      z: this.plane.z - Math.cos(h) * 16,
      y: this.plane.alt + 5,
      heading: h,
      pitch: this.plane.pitch,
      horizonY: Math.max(190, Math.min(430, 335 - this.plane.pitch * 140 - this.plane.alt * 0.02)),
    };
  }

  render() {
    const ctx = this.ctx;
    const cam = this._camera();
    const showAll = this.state === 'title';
    this.world.draw(ctx, cam, this.time, {
      nextRing: this.missions.nextRing,
      nextDock: this.missions.nextDock,
      showRings: showAll || this.missions.mission?.id === 'rings',
      showDocks: showAll || this.missions.mission?.id !== 'rings',
    });
    this._drawCrates(ctx, cam);
    this._drawParticles(ctx, cam);
    if (this.state !== 'title') this.plane.draw(ctx, this.time);
    if (this.state === 'flying' || this.state === 'paused') {
      drawHUD(ctx, this, this.plane, this.missions);
    }
    if (this.state === 'title') this._drawTitle(ctx);
    else if (this.state === 'paused') this._drawPaused(ctx);
    else if (this.state === 'complete') this._drawComplete(ctx);
    else if (this.state === 'gameover') this._drawGameOver(ctx);
  }

  _drawCrates(ctx, cam) {
    for (const crate of this.missions.crates) {
      const p = this.world.project(cam, crate.x, crate.y + 2, crate.z);
      if (!p || p.s < 0.03) continue;
      const s = Math.max(0.4, Math.min(2.5, p.s * 2));
      if (crate.state === 'falling') {
        // Parachute canopy above the falling crate.
        ctx.fillStyle = '#ff5a3c';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy - 16 * s, 14 * s, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#7a2a18';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.sx - 13 * s, p.sy - 16 * s);
        ctx.lineTo(p.sx - 5 * s, p.sy);
        ctx.moveTo(p.sx + 13 * s, p.sy - 16 * s);
        ctx.lineTo(p.sx + 5 * s, p.sy);
        ctx.stroke();
      }
      ctx.fillStyle = '#a4713a';
      ctx.fillRect(p.sx - 6 * s, p.sy - 6 * s, 12 * s, 12 * s);
      ctx.strokeStyle = '#5d3a16';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.sx - 6 * s, p.sy - 6 * s, 12 * s, 12 * s);
    }
  }

  _drawParticles(ctx, cam) {
    for (const p of this.particles) {
      const sp = this.world.project(cam, p.x, p.y, p.z);
      if (!sp) continue;
      ctx.fillStyle = `rgba(${p.color}, ${Math.max(0, p.life)})`;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, Math.max(1.5, 3 * sp.s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(8, 18, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 170, 80, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _drawTitle(ctx) {
    ctx.fillStyle = 'rgba(10, 10, 26, 0.25)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 64px Verdana, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.fillText('SENJA AMPHIBI', WIDTH / 2, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Verdana, sans-serif';
    ctx.fillText('Island-hopper seaplane  •  golden hour over the archipelago', WIDTH / 2, 190);
    ctx.font = 'bold 20px Verdana, sans-serif';
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('CHOOSE A MISSION  —  press 1, 2 or 3, or click', WIDTH / 2, 250);
    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const y0 = 330 + i * 62;
      const selected = i === this.selectedMission;
      this._panel(ctx, 340, y0, 600, 52);
      if (selected) {
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(340, y0, 600, 52, 14);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Verdana, sans-serif';
      ctx.fillText(`${i + 1}. ${m.name}`, 362, y0 + 24);
      ctx.font = '14px Verdana, sans-serif';
      ctx.fillStyle = '#cfe8e4';
      ctx.fillText(m.desc, 362, y0 + 43);
    }
    ctx.textAlign = 'center';
    ctx.font = '15px Verdana, sans-serif';
    ctx.fillStyle = '#f4c98a';
    ctx.fillText('W/S throttle  •  A/D turn  •  hold mouse to climb  •  Space drop crate  •  P pause  •  R restart', WIDTH / 2, 560);
    ctx.fillText('Land soft on the water. Mind the fuel. Mind the islands.', WIDTH / 2, 586);
    ctx.textAlign = 'left';
  }

  _drawPaused(ctx) {
    this._panel(ctx, 440, 280, 400, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Verdana, sans-serif';
    ctx.fillText('PAUSED', WIDTH / 2, 330);
    ctx.font = '17px Verdana, sans-serif';
    ctx.fillStyle = '#cfe8e4';
    ctx.fillText('P to resume  •  R to restart  •  M for menu', WIDTH / 2, 372);
    ctx.textAlign = 'left';
  }

  _drawComplete(ctx) {
    this._panel(ctx, 380, 210, 520, 250);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 40px Verdana, sans-serif';
    ctx.fillText('MISSION COMPLETE', WIDTH / 2, 268);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Verdana, sans-serif';
    ctx.fillText(`SCORE  ${this.missions.score}`, WIDTH / 2, 322);
    ctx.font = '18px Verdana, sans-serif';
    ctx.fillStyle = '#cfe8e4';
    ctx.fillText(`${this.missions.mission.name}  •  time left ${Math.round(this.missions.timeLeft)}s`, WIDTH / 2, 356);
    ctx.fillText('R — fly it again  •  M — choose another mission', WIDTH / 2, 396);
    ctx.font = '15px Verdana, sans-serif';
    ctx.fillStyle = '#9fc8bd';
    ctx.fillText(this.missions.summary(), WIDTH / 2, 428);
    ctx.textAlign = 'left';
  }

  _drawGameOver(ctx) {
    this._panel(ctx, 380, 210, 520, 250);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a5e';
    ctx.font = 'bold 40px Verdana, sans-serif';
    ctx.fillText('GAME OVER', WIDTH / 2, 268);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px Verdana, sans-serif';
    ctx.fillText(this.missions.failReason || 'The sortie ended.', WIDTH / 2, 312);
    ctx.font = 'bold 26px Verdana, sans-serif';
    ctx.fillText(`SCORE  ${this.missions.score}`, WIDTH / 2, 356);
    ctx.font = '18px Verdana, sans-serif';
    ctx.fillStyle = '#cfe8e4';
    ctx.fillText('R — retry the mission  •  M — back to menu', WIDTH / 2, 396);
    ctx.textAlign = 'left';
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
