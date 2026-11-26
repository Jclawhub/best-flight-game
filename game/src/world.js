// The archipelago of Senja Amphibi — terrain, sky, sea, rings and docks.
// Everything is generated from one seed, so the same seed always builds the
// same islands. The camera is a chase camera behind the plane; project()
// turns a world point into a screen point with a simple perspective divide.

import { SeededRandom } from './rng.js';

export const WORLD_SEED = 20261126;
const FOCAL = 620;

export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class World {
  constructor(seed = WORLD_SEED) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.islands = [];
    this.clouds = [];
    this.buoys = [];
    this.rings = [];
    this.docks = [];
    this.volcano = { x: -2400, z: -2100, r: 620, h: 340 };
    this.sunHeading = 4.62; // low sun in the west, golden hour
    this._generateIslands();
    this._generateClouds();
    this._generateBirds();
    this._generateBuoys();
    this._generateRings();
    this._generateDocks();
  }

  _generateIslands() {
    // A ring of islands around the home lagoon, plus a few far ones.
    // The direct corridors between consecutive lagoon docks are kept
    // clear: no island sits on the lagoon 1 -> 2 or 2 -> 3 line, so a
    // pilot flying the obvious route never meets a wall at low altitude.
    const spots = [
      [900, 900, 260, 70], [1500, 300, 200, 55], [700, 2300, 300, 85],
      [-800, 900, 240, 60], [-1500, 500, 280, 75], [-1100, -900, 220, 50],
      [300, -1400, 260, 65], [1800, -900, 230, 58], [2600, 1400, 320, 95],
      [-2300, 1900, 300, 80], [600, 2900, 280, 72], [-1800, -1900, 250, 60],
    ];
    for (const [x, z, r, h] of spots) {
      const palms = [];
      const palmCount = 3 + Math.floor(this.rng.float() * 5);
      for (let i = 0; i < palmCount; i++) {
        palms.push({ dx: this.rng.range(-0.7, 0.7), dz: this.rng.range(-0.5, 0.5) });
      }
      this.islands.push({ x, z, r, h, palms });
    }
  }

  _generateClouds() {
    for (let i = 0; i < 16; i++) {
      this.clouds.push({
        x: this.rng.range(-3500, 3500),
        z: this.rng.range(-3500, 3500),
        y: this.rng.range(260, 420),
        r: this.rng.range(120, 260),
        drift: this.rng.range(1.5, 4),
      });
    }
  }

  // A small flock of seabirds crossing the sky, for life in the frame.
  _generateBirds() {
    this.birds = [];
    for (let i = 0; i < 7; i++) {
      this.birds.push({
        x: this.rng.range(-2000, 2000),
        z: this.rng.range(200, 2500),
        y: this.rng.range(120, 220),
        speed: this.rng.range(14, 22),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  // Orange buoys mark the water runway out of the home lagoon.
  _generateBuoys() {
    for (let i = 0; i < 10; i++) {
      const d = 120 + i * 70;
      this.buoys.push({ x: -26, z: d });
      this.buoys.push({ x: 26, z: d });
    }
  }

  // Six glowing rings on a loop over the islands, at flying altitudes.
  _generateRings() {
    const spots = [
      [0, 150, 700], [620, 170, 1350], [1300, 130, 900],
      [900, 190, 2100], [-500, 150, 1900], [-1200, 180, 900],
    ];
    spots.forEach(([x, y, z], i) => {
      this.rings.push({ x, y, z, r: 30, index: i, passed: false });
    });
  }

  // Three lagoon docks (Island Hop) and three village docks (Mail Drop).
  _generateDocks() {
    const lagoons = [
      { x: 1050, z: 1750, kind: 'lagoon', label: 'LAGOON 1' },
      { x: -1350, z: 1250, kind: 'lagoon', label: 'LAGOON 2' },
      { x: 250, z: 2750, kind: 'lagoon', label: 'LAGOON 3' },
    ];
    const villages = [
      { x: 1500, z: 300, kind: 'village', label: 'VILLAGE 1' },
      { x: -1500, z: 500, kind: 'village', label: 'VILLAGE 2' },
      { x: 1800, z: -900, kind: 'village', label: 'VILLAGE 3' },
    ];
    for (const d of [...lagoons, ...villages]) {
      this.docks.push({ ...d, w: 74, d: 28, done: false });
    }
  }

  // Project a world point into screen space. Returns null behind the camera.
  project(cam, x, y, z) {
    const dx = x - cam.x;
    const dz = z - cam.z;
    const sinH = Math.sin(cam.heading);
    const cosH = Math.cos(cam.heading);
    const fwd = dx * sinH + dz * cosH;
    const right = dx * cosH - dz * sinH;
    if (fwd < 2) return null;
    const s = FOCAL / fwd;
    return {
      sx: 640 + right * s,
      sy: cam.horizonY - (y - cam.y) * s,
      s,
      fwd,
    };
  }

  // ---- sky, sun, sea -------------------------------------------------

  drawSky(ctx, cam, time) {
    const g = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 40);
    g.addColorStop(0, '#2b1a4e');
    g.addColorStop(0.45, '#7a3b5e');
    g.addColorStop(0.8, '#e0703f');
    g.addColorStop(1, '#f7a85c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, cam.horizonY + 40);
    // Low sun, west.
    const ang = normalizeAngle(this.sunHeading - cam.heading);
    if (Math.abs(ang) < 1.25) {
      const sx = 640 + Math.tan(ang) * FOCAL;
      const sy = 165;
      const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 150);
      glow.addColorStop(0, 'rgba(255, 214, 130, 0.95)');
      glow.addColorStop(0.35, 'rgba(255, 166, 77, 0.55)');
      glow.addColorStop(1, 'rgba(255, 166, 77, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 160, sy - 160, 320, 320);
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3cf';
      ctx.beginPath();
      ctx.arc(sx, sy, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSea(ctx, cam, time) {
    const g = ctx.createLinearGradient(0, cam.horizonY, 0, 720);
    g.addColorStop(0, '#4f9a94');
    g.addColorStop(0.35, '#2a7a80');
    g.addColorStop(1, '#0d3f4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, cam.horizonY, 1280, 720 - cam.horizonY);
    // Sun glitter: a shimmering band under the sun's bearing.
    const ang = normalizeAngle(this.sunHeading - cam.heading);
    if (Math.abs(ang) < 1.1) {
      const sx = 640 + Math.tan(ang) * FOCAL;
      const rng = new SeededRandom(7);
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const y = cam.horizonY + 12 + rng.float() * (700 - cam.horizonY);
        const w = 30 + rng.float() * 130;
        const a = 0.05 + rng.float() * 0.16;
        ctx.fillStyle = `rgba(255, 214, 140, ${a})`;
        ctx.fillRect(sx - w / 2, y, w, 2);
      }
      ctx.restore();
    }
    // Gentle swell lines drifting with time.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const y = cam.horizonY + 30 + i * 42 + Math.sin(time * 0.6 + i * 1.7) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(320, y - 6, 640, y + 6, 1280, y - 2);
      ctx.stroke();
    }
  }

  // ---- terrain and objectives ----------------------------------------

  _drawIsland(ctx, cam, island, time) {
    const p = this.project(cam, island.x, 0, island.z);
    if (!p || p.s < 0.02) return;
    const rx = island.r * p.s;
    const ry = island.r * p.s * 0.34;
    if (rx < 2) return;
    // Sand beach.
    ctx.fillStyle = '#e8cf9a';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Green top.
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - island.h * p.s * 0.28, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hill shading.
    ctx.fillStyle = '#2e5c2b';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - island.h * p.s * 0.55, rx * 0.45, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Palm dots.
    ctx.fillStyle = '#1d4a1e';
    for (const palm of island.palms) {
      const pp = this.project(cam, island.x + palm.dx * island.r, island.h * 0.55, island.z + palm.dz * island.r);
      if (!pp) continue;
      ctx.beginPath();
      ctx.arc(pp.sx, pp.sy, Math.max(1.5, 3.5 * p.s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawVolcano(ctx, cam, time) {
    const p = this.project(cam, this.volcano.x, 0, this.volcano.z);
    if (!p || p.s < 0.015) return;
    const baseW = this.volcano.r * p.s;
    const peakH = this.volcano.h * p.s;
    const baseY = p.sy;
    const peakX = p.sx;
    const peakY = baseY - peakH;
    // Cone silhouette, hazy purple against the sunset.
    ctx.fillStyle = '#5a3a55';
    ctx.beginPath();
    ctx.moveTo(peakX - baseW, baseY);
    ctx.lineTo(peakX - baseW * 0.18, peakY);
    ctx.lineTo(peakX + baseW * 0.18, peakY);
    ctx.lineTo(peakX + baseW, baseY);
    ctx.closePath();
    ctx.fill();
    // Snow-less crater glow.
    ctx.fillStyle = '#ff7a4d';
    ctx.beginPath();
    ctx.ellipse(peakX, peakY + 2, baseW * 0.16, Math.max(2, peakH * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
    // Slow smoke drifting off the crater.
    for (let i = 0; i < 3; i++) {
      const t = ((time * 0.08 + i / 3) % 1);
      const sx = peakX + t * 40 * p.s * 8 + 10;
      const sy = peakY - t * 60;
      ctx.fillStyle = `rgba(220, 210, 210, ${0.35 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 + t * 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawBirds(ctx, cam, time) {
    if (!this.birds) return;
    ctx.strokeStyle = 'rgba(40, 30, 40, 0.85)';
    ctx.lineWidth = 2;
    for (const bird of this.birds) {
      const bx = bird.x + time * bird.speed;
      const p = this.project(cam, bx, bird.y + Math.sin(time * 2 + bird.phase) * 6, bird.z);
      if (!p || p.s < 0.03) continue;
      const w = Math.max(3, 9 * p.s * 2);
      const flap = Math.sin(time * 6 + bird.phase) * w * 0.35;
      ctx.beginPath();
      ctx.moveTo(p.sx - w, p.sy - flap);
      ctx.quadraticCurveTo(p.sx - w * 0.4, p.sy + 2, p.sx, p.sy);
      ctx.quadraticCurveTo(p.sx + w * 0.4, p.sy + 2, p.sx + w, p.sy - flap);
      ctx.stroke();
    }
  }

  _drawClouds(ctx, cam, time) {
    const sorted = [...this.clouds].sort((a, b) => {
      const pa = this.project(cam, a.x, a.y, a.z);
      const pb = this.project(cam, b.x, b.y, b.z);
      return (pb?.fwd ?? 0) - (pa?.fwd ?? 0);
    });    for (const cloud of sorted) {
      const cx = cloud.x + time * cloud.drift;
      const p = this.project(cam, cx, cloud.y, cloud.z);
      if (!p || p.s < 0.02) continue;
      const r = cloud.r * p.s;
      if (r < 4) continue;
      ctx.fillStyle = 'rgba(255, 226, 200, 0.75)';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 244, 224, 0.8)';
      ctx.beginPath();
      ctx.ellipse(p.sx - r * 0.4, p.sy - r * 0.08, r * 0.55, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDock(ctx, cam, dock, time, highlight) {
    const hw = dock.w / 2;
    const hd = dock.d / 2;
    const corners = [
      this.project(cam, dock.x - hw, 0, dock.z - hd),
      this.project(cam, dock.x + hw, 0, dock.z - hd),
      this.project(cam, dock.x + hw, 0, dock.z + hd),
      this.project(cam, dock.x - hw, 0, dock.z + hd),
    ];
    if (corners.some((c) => !c)) return;
    const centre = this.project(cam, dock.x, 0, dock.z);
    if (!centre) return;
    // Wooden platform.
    ctx.fillStyle = dock.done ? '#5a7d5a' : '#8a6a42';
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = highlight ? '#ffd94d' : '#5d4426';
    ctx.lineWidth = Math.max(1.5, 2.5 * centre.s);
    ctx.stroke();
    // Marker ring above the dock.
    const ringR = Math.max(4, Math.min(60, 26 * centre.s));
    ctx.strokeStyle = dock.done ? 'rgba(120, 220, 130, 0.9)' : 'rgba(255, 217, 77, 0.9)';
    ctx.lineWidth = Math.max(2, Math.min(8, 3 * centre.s));
    ctx.beginPath();
    ctx.arc(centre.sx, centre.sy - 8 * centre.s, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // Village docks fly a red flag; lagoon docks a blue one.
    const flagTop = this.project(cam, dock.x, 16, dock.z);
    if (flagTop) {
      const fk = Math.min(centre.s, 1.4); // flag size, clamped so it never explodes up close
      ctx.strokeStyle = '#3a2a18';
      ctx.lineWidth = Math.max(1, 2 * centre.s);
      ctx.beginPath();
      ctx.moveTo(centre.sx, centre.sy);
      ctx.lineTo(flagTop.sx, flagTop.sy);
      ctx.stroke();
      ctx.fillStyle = dock.kind === 'village' ? '#e23b3b' : '#2f7fd0';
      ctx.beginPath();
      ctx.moveTo(flagTop.sx, flagTop.sy);
      ctx.lineTo(flagTop.sx + 16 * fk, flagTop.sy + 5 * fk);
      ctx.lineTo(flagTop.sx, flagTop.sy + 10 * fk);
      ctx.closePath();
      ctx.fill();
    }
    // Label, readable when small.
    if (centre.s > 0.06) {
      ctx.font = `bold ${Math.max(11, Math.min(26, Math.round(13 * centre.s * 2)))}px Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(dock.label, centre.sx, centre.sy - ringR - 10);
    }
  }

  _drawRing(ctx, cam, ring, time, isNext) {
    const p = this.project(cam, ring.x, ring.y, ring.z);
    if (!p || p.s < 0.02) return;
    const radius = ring.r * p.s;
    if (radius < 3) return;
    const pulse = isNext ? 1 + Math.sin(time * 5) * 0.12 : 1;
    const r = radius * pulse;
    ctx.save();
    ctx.shadowBlur = isNext ? 26 : 12;
    ctx.shadowColor = isNext ? '#ffd94d' : '#37d6e0';
    ctx.strokeStyle = ring.passed ? 'rgba(120, 220, 130, 0.75)' : isNext ? '#ffd94d' : '#37d6e0';
    ctx.lineWidth = Math.max(2.5, Math.min(14, 5 * p.s));
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, Math.min(4, 1.6 * p.s));
    ctx.setLineDash([8 * p.s, 8 * p.s]);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (isNext) {
      ctx.font = `bold ${Math.max(12, Math.min(26, Math.round(14 * p.s * 2)))}px Verdana, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(`RING ${ring.index + 1}`, p.sx, p.sy - r - 12);
    }
  }

  _drawBuoy(ctx, cam, buoy) {
    const p = this.project(cam, buoy.x, 0, buoy.z);
    if (!p || p.s < 0.03) return;
    const r = Math.max(2, Math.min(10, 4 * p.s));
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Full world render for one frame. opts: { nextRing, nextDock, showRings, showDocks }.
  draw(ctx, cam, time, opts = {}) {
    this.drawSky(ctx, cam, time);
    this._drawClouds(ctx, cam, time);
    this._drawBirds(ctx, cam, time);
    this.drawSea(ctx, cam, time);
    const sortedIslands = [...this.islands].sort((a, b) => {
      const pa = this.project(cam, a.x, 0, a.z);
      const pb = this.project(cam, b.x, 0, b.z);
      return (pb?.fwd ?? 0) - (pa?.fwd ?? 0);
    });
    for (const island of sortedIslands) this._drawIsland(ctx, cam, island, time);
    this._drawVolcano(ctx, cam, time);
    const sortedBuoys = [...this.buoys].sort((a, b) => {
      const pa = this.project(cam, a.x, 0, a.z);
      const pb = this.project(cam, b.x, 0, b.z);
      return (pb?.fwd ?? 0) - (pa?.fwd ?? 0);
    });
    for (const buoy of sortedBuoys) this._drawBuoy(ctx, cam, buoy);
    if (opts.showDocks !== false) {
      const sortedDocks = [...this.docks].sort((a, b) => {
        const pa = this.project(cam, a.x, 0, a.z);
        const pb = this.project(cam, b.x, 0, b.z);
        return (pb?.fwd ?? 0) - (pa?.fwd ?? 0);
      });
      for (const dock of sortedDocks) {
        this._drawDock(ctx, cam, dock, time, opts.nextDock === dock);
      }
    }
    if (opts.showRings !== false) {
      const sortedRings = [...this.rings].sort((a, b) => {
        const pa = this.project(cam, a.x, a.y, a.z);
        const pb = this.project(cam, b.x, b.y, b.z);
        return (pb?.fwd ?? 0) - (pa?.fwd ?? 0);
      });
      for (const ring of sortedRings) {
        this._drawRing(ctx, cam, ring, time, opts.nextRing === ring);
      }
    }
  }
}
