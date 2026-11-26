// Senja Amphibi — the four missions: Ring Run, Island Hop, Mail Drop and
// the new Rescue Run. One 180-second sortie each, scored, with a live
// objective, falling crates, spray and ring-burst particles.

import { RING_COURSE } from './world.js';

export const MISSION_DEFS = [
  {
    id: 'rings', key: '1', name: 'Ring Run',
    goal: 'Fly through all 6 glowing rings in order',
    reward: '6 rings x 100 pts',
  },
  {
    id: 'hop', key: '2', name: 'Island Hop',
    goal: 'Water-land at 3 lagoon docks, gentle and slow',
    reward: '3 docks x 150 pts',
  },
  {
    id: 'mail', key: '3', name: 'Mail Drop',
    goal: 'Drop a crate on each village dock (Space)',
    reward: '3 villages x 120 pts',
  },
  {
    id: 'rescue', key: '4', name: 'Rescue Run',
    goal: 'Land by the raft, pick up the sailor, deliver them home',
    reward: 'Pickup 100 + delivery 200 pts',
  },
];

export function missionDef(id) {
  return MISSION_DEFS.find((m) => m.id === id) || MISSION_DEFS[0];
}

function dist2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export class MissionSet {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset() {
    this.current = null;
    this.score = 0;
    this.timeLeft = 180;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this.ringIndex = 0;
    this.dockIndex = 0;
    this.dropIndex = 0;
    this.rescueStage = 'pickup'; // 'pickup' -> 'deliver' -> 'done'
    this.dropsLeft = 9;
    this.crates = [];
    this.particles = [];
    this.toast = '';
    this.toastLeft = 0;
    this.landedAt = null;
  }

  start(id) {
    this.reset();
    this.current = id;
  }

  getObjective() {
    if (!this.current || this.complete || this.failed) return null;
    if (this.current === 'rings') {
      if (this.ringIndex >= RING_COURSE.length) return null;
      const r = RING_COURSE[this.ringIndex];
      return { x: r.x, y: r.y, z: r.z, label: `Ring ${this.ringIndex + 1} of 6`, kind: 'ring' };
    }
    if (this.current === 'hop') {
      if (this.dockIndex >= this.world.hopDocks.length) return null;
      const d = this.world.hopDocks[this.dockIndex];
      return { x: d.x, y: 0, z: d.z, label: `Lagoon Dock ${this.dockIndex + 1} of 3 — land on the water`, kind: 'dock' };
    }
    if (this.current === 'mail') {
      if (this.dropIndex >= this.world.mailVillages.length) return null;
      const v = this.world.mailVillages[this.dropIndex];
      return { x: v.x, y: 0, z: v.z, label: `Village ${this.dropIndex + 1} of 3 — drop a crate (Space)`, kind: 'village' };
    }
    if (this.current === 'rescue') {
      if (this.rescueStage === 'pickup') {
        const r = this.world.raft;
        return { x: r.x, y: 0, z: r.z, label: 'Raft — land to pick up the sailor', kind: 'raft' };
      }
      if (this.rescueStage === 'deliver') {
        const d = this.world.mainDock;
        return { x: d.x, y: 0, z: d.z, label: 'Main Dock — deliver the sailor', kind: 'dock' };
      }
    }
    return null;
  }

  showToast(text, seconds = 2.6) {
    this.toast = text;
    this.toastLeft = seconds;
  }

  burst(x, y, z, color, count = 22) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 38;
      this.particles.push({
        x, y, z, vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * 30,
        vz: Math.sin(a) * sp, life: 0, maxLife: 0.7 + Math.random() * 0.6,
        color, size: 2 + Math.random() * 4,
      });
    }
  }

  spray(x, z, count = 18) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * 30;
      this.particles.push({
        x, y: 1, z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 14,
        vz: Math.sin(a) * sp, life: 0, maxLife: 0.5 + Math.random() * 0.5,
        color: '#eaf6ff', size: 2 + Math.random() * 3,
      });
    }
  }

  dropCrate(plane, audio) {
    if (this.current !== 'mail' || this.complete || this.failed) return;
    if (this.dropsLeft <= 0) { this.showToast('Out of crates!'); return; }
    this.dropsLeft -= 1;
    const v = plane.speed / 3.6;
    this.crates.push({
      x: plane.x, z: plane.z, y: plane.alt,
      vx: Math.sin(plane.heading) * v * 0.2,
      vz: Math.cos(plane.heading) * v * 0.2,
      vy: -30,
    });
    if (audio) audio.click();
  }

  finish() {
    this.score += 50;
    this.complete = true;
    this.showToast('Mission complete! +50 bonus', 4);
  }

  fail(reason) {
    if (this.complete || this.failed) return;
    this.failed = true;
    this.failReason = reason;
  }

  // Called by the game loop when the plane reports an event.
  onPlaneEvent(ev, plane, audio) {
    if (!this.current || this.complete || this.failed) return;
    if (ev === 'takeoff') {
      this.spray(plane.x, plane.z, 14);
      if (audio) audio.splash();
      return;
    }
    if (ev === 'crashed-sea') { this.fail('Crashed into the sea'); return; }
    if (ev === 'crashed-island') { this.fail('Hit an island'); return; }
    if (ev === 'fuel-out') { this.fail('Out of fuel'); return; }
    if (ev === 'landed-clean' || ev === 'landed-rough') {
      this.spray(plane.x, plane.z, ev === 'landed-clean' ? 20 : 12);
      if (audio) { if (ev === 'landed-clean') audio.thud(); else audio.splash(); }
      const o = this.getObjective();
      if (!o || (o.kind !== 'dock' && o.kind !== 'raft')) return;
      if (dist2D(plane.x, plane.z, o.x, o.z) > 55) {
        this.showToast('Landed — but not at the objective. Take off and try again!');
        return;
      }
      if (this.current === 'hop') {
        if (ev === 'landed-clean') {
          this.score += 150;
          this.showToast(`Clean landing! +150  (Dock ${this.dockIndex + 1} of 3)`);
        } else {
          this.score = Math.max(0, this.score - 10);
          this.showToast('Rough landing! +30 damage, -10 pts');
        }
        if (audio) audio.chime();
        this.dockIndex += 1;
        if (this.dockIndex >= this.world.hopDocks.length) this.finish();
      } else if (this.current === 'rescue') {
        if (this.rescueStage === 'pickup') {
          this.score += 100;
          this.rescueStage = 'deliver';
          this.showToast('Sailor aboard! +100 — now fly them to the Main Dock');
          if (audio) audio.chime();
          this.burst(plane.x, 2, plane.z, '#ffd166', 16);
        } else {
          this.score += 200;
          this.rescueStage = 'done';
          this.showToast('Sailor delivered safe! +200');
          if (audio) audio.fanfare();
          this.finish();
        }
      }
    }
  }

  update(dt, plane, audio) {
    if (!this.current || this.complete || this.failed) return;
    this.timeLeft -= dt;
    if (this.toastLeft > 0) this.toastLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fail('Time up — the sortie ended');
      return;
    }
    // Ring fly-throughs.
    if (this.current === 'rings' && this.ringIndex < RING_COURSE.length) {
      const r = RING_COURSE[this.ringIndex];
      const d = Math.sqrt(
        (plane.x - r.x) ** 2 + (plane.z - r.z) ** 2 + (plane.alt - r.y) ** 2,
      );
      if (d < 34) {
        this.score += 100;
        this.ringIndex += 1;
        this.burst(r.x, r.y, r.z, '#ffd166', 26);
        this.showToast(`Ring ${this.ringIndex} of 6! +100`);
        if (audio) { audio.chime(); audio.swoosh(); }
        if (this.ringIndex >= RING_COURSE.length) this.finish();
      }
    }
    // Falling crates.
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.y += c.vy * dt;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.vx *= Math.max(0, 1 - 1.5 * dt);
      c.vz *= Math.max(0, 1 - 1.5 * dt);
      if (c.y <= 0) {
        const v = this.world.mailVillages[this.dropIndex];
        if (v && dist2D(c.x, c.z, v.x, v.z) < 70) {
          this.score += 120;
          this.dropIndex += 1;
          this.burst(v.x, 2, v.z, '#ffd166', 20);
          this.showToast(`Crate delivered! +120  (Village ${this.dropIndex} of 3)`);
          if (audio) audio.chime();
          if (this.dropIndex >= this.world.mailVillages.length) this.finish();
        } else {
          this.spray(c.x, c.z, 8);
          this.showToast('Crate missed the dock — line up and drop again');
        }
        this.crates.splice(i, 1);
      }
    }
    // Particles age out.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 12 * dt;
      if (p.life >= p.maxLife || p.y < 0) this.particles.splice(i, 1);
    }
  }
}
