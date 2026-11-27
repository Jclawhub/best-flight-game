// Senja Amphibi — missions: Ring Run, Island Hop, Mail Drop, Rescue Run.
// Scoring, timer, crates and particles live here; physics lives in plane.js.

import { RING_COURSE, HOP_DOCKS, MAIL_VILLAGES, RESCUE_RAFT, MAIN_DOCK } from './world.js';

export const MISSION_DEFS = {
  rings: {
    id: 'rings', key: 1, name: 'Ring Run',
    goal: 'Fly through all 6 glowing rings in order',
    reward: '6 rings x 100 pts',
  },
  hop: {
    id: 'hop', key: 2, name: 'Island Hop',
    goal: 'Water-land at 3 lagoon docks, gentle and slow',
    reward: '3 docks x 150 pts',
  },
  mail: {
    id: 'mail', key: 3, name: 'Mail Drop',
    goal: 'Drop a crate on each village dock (Space)',
    reward: '3 villages x 120 pts',
  },
  rescue: {
    id: 'rescue', key: 4, name: 'Rescue Run',
    goal: 'Land by the raft, pick up the sailor, deliver them home',
    reward: 'Pickup 100 + delivery 200 pts',
  },
};

const MISSION_TIME = 180;

export class MissionSet {
  constructor() {
    this.current = null;
    this.score = 0;
    this.timeLeft = MISSION_TIME;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this.ringIndex = 0;
    this.dockIndex = 0;
    this.dropIndex = 0;
    this.rescueStage = 'pickup';
    this.dropsLeft = 9;
    this.crates = [];
    this.particles = [];
    this.toast = '';
    this.toastLeft = 0;
  }

  start(id) {
    this.current = id;
    this.score = 0;
    this.timeLeft = MISSION_TIME;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this.ringIndex = 0;
    this.dockIndex = 0;
    this.dropIndex = 0;
    this.rescueStage = 'pickup';
    this.dropsLeft = 9;
    this.crates = [];
    this.particles = [];
    this.toast = '';
    this.toastLeft = 0;
  }

  get def() {
    return this.current ? MISSION_DEFS[this.current] : null;
  }

  // {x, y, z, label, kind} for the current target, or null.
  getObjective() {
    if (!this.current || this.complete || this.failed) return null;
    if (this.current === 'rings') {
      if (this.ringIndex >= RING_COURSE.length) return null;
      const r = RING_COURSE[this.ringIndex];
      return { x: r.x, y: r.y, z: r.z, label: `Ring ${this.ringIndex + 1} of 6`, kind: 'ring' };
    }
    if (this.current === 'hop') {
      if (this.dockIndex >= HOP_DOCKS.length) return null;
      const d = HOP_DOCKS[this.dockIndex];
      return { x: d.x, y: 0, z: d.z, label: `Dock ${this.dockIndex + 1} of 3`, kind: 'dock' };
    }
    if (this.current === 'mail') {
      if (this.dropIndex >= MAIL_VILLAGES.length) return null;
      const v = MAIL_VILLAGES[this.dropIndex];
      return { x: v.x, y: 0, z: v.z, label: `Village ${this.dropIndex + 1} of 3`, kind: 'village' };
    }
    if (this.current === 'rescue') {
      if (this.rescueStage === 'pickup') {
        return { x: RESCUE_RAFT.x, y: 0, z: RESCUE_RAFT.z, label: 'Raft — land to pick up the sailor', kind: 'raft' };
      }
      if (this.rescueStage === 'deliver') {
        return { x: MAIN_DOCK.x, y: 0, z: MAIN_DOCK.z, label: 'Main Dock — deliver the sailor', kind: 'dock' };
      }
      return null;
    }
    return null;
  }

  finish() {
    this.complete = true;
    this.score += 50;
    this.toast = 'Mission complete! +50 bonus';
    this.toastLeft = 3;
  }

  fail(reason) {
    if (this.complete || this.failed) return;
    this.failed = true;
    this.failReason = reason;
  }

  // Called every frame while flying; plane is the Seaplane.
  onPlaneEvent(event, plane) {
    if (!event || this.complete || this.failed) return;
    if (event === 'crashed-sea') return this.fail('Crashed into the sea');
    if (event === 'crashed-island') return this.fail('Crashed into an island');
    if (event === 'fuel-out') return this.fail('Out of fuel');
    if (event !== 'landed-clean' && event !== 'landed-rough') return;

    const clean = event === 'landed-clean';
    if (this.current === 'hop') {
      const d = HOP_DOCKS[this.dockIndex];
      if (!d) return;
      const dist = Math.hypot(plane.x - d.x, plane.z - d.z);
      if (dist <= 55) {
        if (clean) {
          this.score += 150;
          this.toast = `Clean landing! +150`;
        } else {
          this.score = Math.max(0, this.score - 10);
          this.toast = 'Rough landing! −10 pts';
        }
        this.toastLeft = 2.6;
        this.spray(plane.x, plane.z, 26);
        this.dockIndex += 1;
        if (this.dockIndex >= HOP_DOCKS.length) this.finish();
      }
      return;
    }
    if (this.current === 'rescue') {
      if (this.rescueStage === 'pickup') {
        const dist = Math.hypot(plane.x - RESCUE_RAFT.x, plane.z - RESCUE_RAFT.z);
        if (dist <= 55) {
          this.score += 100;
          this.rescueStage = 'deliver';
          this.toast = 'Sailor aboard! +100 — deliver them to the Main Dock';
          this.toastLeft = 3;
          this.spray(plane.x, plane.z, 26);
        }
        return;
      }
      if (this.rescueStage === 'deliver') {
        const dist = Math.hypot(plane.x - MAIN_DOCK.x, plane.z - MAIN_DOCK.z);
        if (dist <= 55) {
          this.score += 200;
          this.rescueStage = 'done';
          this.toast = 'Sailor home safe! +200';
          this.toastLeft = 3;
          this.spray(plane.x, plane.z, 26);
          this.finish();
        }
      }
    }
  }

  // Ring fly-through check, run every frame while flying. The ring counts
  // only when the plane is genuinely through it in 3D, not just near it
  // on the map — hence the 3D distance against the ring centre.
  checkRings(plane) {
    if (this.current !== 'rings' || this.complete || this.failed) return;
    if (this.ringIndex >= RING_COURSE.length) return;
    const r = RING_COURSE[this.ringIndex];
    const d = Math.hypot(plane.x - r.x, plane.z - r.z, plane.alt - r.y);
    if (d <= 34) {
      this.score += 100;
      this.ringIndex += 1;
      this.burst(r.x, r.y, r.z, '#ffd34d', 26);
      this.toast = this.ringIndex >= RING_COURSE.length
        ? 'Final ring! +100'
        : `Ring ${this.ringIndex} of 6! +100`;
      this.toastLeft = 2.2;
      if (this.ringIndex >= RING_COURSE.length) this.finish();
    }
  }

  dropCrate(plane) {
    if (this.current !== 'mail' || this.complete || this.failed) return false;
    if (this.dropsLeft <= 0) {
      this.toast = 'Out of crates!';
      this.toastLeft = 1.6;
      return false;
    }
    this.dropsLeft -= 1;
    const ms = plane.speed / 3.6;
    this.crates.push({
      x: plane.x,
      z: plane.z,
      y: Math.max(2, plane.alt),
      vx: Math.sin(plane.heading) * ms * 0.25,
      vz: Math.cos(plane.heading) * ms * 0.25,
      vy: -30,
    });
    return true;
  }

  burst(x, y, z, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 26;
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp,
        vy: (Math.random() - 0.3) * 22,
        vz: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.7,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  spray(x, z, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 6 + Math.random() * 18;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: 1,
        z: z + (Math.random() - 0.5) * 14,
        vx: Math.cos(a) * sp,
        vy: 8 + Math.random() * 14,
        vz: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.7,
        color: '#eaf6ff',
        size: 2 + Math.random() * 4,
      });
    }
  }

  update(dt) {
    if (this.current && !this.complete && !this.failed) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.fail('Time up');
      }
    }
    if (this.toastLeft > 0) {
      this.toastLeft -= dt;
      if (this.toastLeft <= 0) this.toast = '';
    }
    // Particles: gravity pulls vy down 12 m/s²; dead when old or under water.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.life >= p.maxLife || p.y < 0) this.particles.splice(i, 1);
    }
    // Crates fall at vy −30 m/s with slight forward drift.
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.y += c.vy * dt;
      if (c.y <= 0) {
        this.crates.splice(i, 1);
        const v = MAIL_VILLAGES[this.dropIndex];
        if (v && Math.hypot(c.x - v.x, c.z - v.z) <= 70) {
          this.score += 120;
          this.dropIndex += 1;
          this.toast = `Crate delivered! +120 (${this.dropsLeft} left)`;
          this.toastLeft = 2.4;
          this.burst(c.x, 2, c.z, '#ffd34d', 18);
          if (this.dropIndex >= MAIL_VILLAGES.length) this.finish();
        } else {
          this.spray(c.x, c.z, 14);
          this.toast = `Crate missed the dock (${this.dropsLeft} left)`;
          this.toastLeft = 2.2;
        }
      }
    }
  }
}
