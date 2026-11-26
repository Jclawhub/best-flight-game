// The three missions of Senja Amphibi — objectives, scoring and the clock.
// One mission runs at a time; each is 180 seconds, and finishing one pays a
// time bonus. Combos grow when clean passes follow each other quickly.

export const MISSION_TIME = 180;

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RING RUN',
    desc: 'Fly through 6 glowing rings over the islands, against the clock.',
    tip: 'Hold the mouse to climb. Rings pay +100, combos pay more.',
  },
  {
    id: 'hop',
    name: 'Island Hop',
    short: 'ISLAND HOP',
    desc: 'Land the seaplane on the water at 3 lagoon docks, then take off again.',
    tip: 'Cut the throttle and glide in slow. A clean landing pays +150.',
  },
  {
    id: 'mail',
    name: 'Mail Drop',
    short: 'MAIL DROP',
    desc: 'Drop supply crates on 3 village docks — press Space right over the marker.',
    tip: 'Fly low and slow over the red flag, then press Space.',
  },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset() {
    this.mission = null;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.timeLeft = MISSION_TIME;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this.message = '';
    this.messageTimer = 0;
    this.crates = [];
    this.ringIndex = 0;
    this.dockIndex = 0;
    this.dropIndex = 0;
    for (const ring of this.world.rings) ring.passed = false;
    for (const dock of this.world.docks) dock.done = false;
  }

  start(missionId) {
    this.reset();
    this.mission = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
    this.message = `${this.mission.short} — ${this.mission.tip}`;
    this.messageTimer = 5;
  }

  get active() {
    return this.mission !== null && !this.complete && !this.failed;
  }

  // The next thing to fly to, for the HUD arrow and the beacon.
  getObjective() {
    if (!this.mission) return null;
    if (this.mission.id === 'rings') {
      const ring = this.world.rings[this.ringIndex];
      if (!ring) return null;
      return { x: ring.x, y: ring.y, z: ring.z, label: `RING ${this.ringIndex + 1}/6`, kind: 'ring' };
    }
    if (this.mission.id === 'hop') {
      const docks = this.world.docks.filter((d) => d.kind === 'lagoon');
      const dock = docks[this.dockIndex];
      if (!dock) return null;
      return { x: dock.x, y: 0, z: dock.z, label: `LAGOON ${this.dockIndex + 1}/3`, kind: 'dock' };
    }
    const villages = this.world.docks.filter((d) => d.kind === 'village');
    const dock = villages[this.dropIndex];
    if (!dock) return null;
    return { x: dock.x, y: 0, z: dock.z, label: `VILLAGE ${this.dropIndex + 1}/3`, kind: 'dock' };
  }

  get nextRing() {
    if (this.mission?.id !== 'rings') return null;
    return this.world.rings[this.ringIndex] ?? null;
  }

  get nextDock() {
    if (!this.mission) return null;
    if (this.mission.id === 'hop') {
      return this.world.docks.filter((d) => d.kind === 'lagoon')[this.dockIndex] ?? null;
    }
    if (this.mission.id === 'mail') {
      return this.world.docks.filter((d) => d.kind === 'village')[this.dropIndex] ?? null;
    }
    return null;
  }

  addScore(base, reason) {
    if (this.comboTimer > 0) this.combo += 1;
    else this.combo = 1;
    this.comboTimer = 20;
    const points = Math.round(base * (1 + 0.1 * (this.combo - 1)));
    this.score += points;
    this.message = `${reason}  +${points}${this.combo > 1 ? `  (COMBO x${this.combo})` : ''}`;
    this.messageTimer = 2.5;
    return points;
  }

  // Plane events arrive here from the game loop.
  onPlaneEvent(type, detail, plane) {
    if (!this.active) return;
    if (type === 'landed' && this.mission.id === 'hop') {
      const dock = this.nextDock;
      if (dock) {
        const dx = plane.x - dock.x;
        const dz = plane.z - dock.z;
        if (dx * dx + dz * dz < 55 * 55) {
          dock.done = true;
          this.addScore(150, `DOCKED AT ${dock.label}`);
          this.dockIndex += 1;
          if (this.dockIndex >= 3) this._finish();
        } else {
          this.message = 'Safe landing — but not on a lagoon dock.';
          this.messageTimer = 2.5;
        }
      }
    }
    if (type === 'rough') {
      this.score = Math.max(0, this.score - 10);
      this.message = `Rough landing!  −20  (damage ${Math.round(plane.damage)}%)`;
      this.messageTimer = 2.5;
      if (plane.damage >= 100) this._fail('The seaplane broke apart on impact.');
    }
    if (type === 'crash') {
      const what = detail.what === 'island' ? 'an island' : detail.what === 'volcano' ? 'the volcano' : 'the water';
      this._fail(`Crashed into ${what}.`);
    }
  }

  // Space was pressed: only Mail Drop uses it.
  onDropPressed(plane) {
    if (!this.active || this.mission.id !== 'mail') return;
    const dock = this.nextDock;
    if (!dock) return;
    const dx = plane.x - dock.x;
    const dz = plane.z - dock.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 70 && plane.alt > 15 && plane.alt < 260) {
      this.crates.push({ x: plane.x, z: plane.z, y: plane.alt, vy: 0, dock, state: 'falling' });
      this.message = 'Crate away!';
      this.messageTimer = 1.5;
    } else if (dist < 120) {
      this.message = 'Too high or off the marker — get lower and closer.';
      this.messageTimer = 2;
    }
  }

  update(dt, plane) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (!this.active) {
      this._updateCrates(dt);
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this._fail("Time's up — the sortie window closed.");
      return;
    }
    if (this.mission.id === 'rings') {
      const ring = this.nextRing;
      if (ring) {
        const dx = plane.x - ring.x;
        const dy = plane.alt - ring.y;
        const dz = plane.z - ring.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 34 && !ring.passed) {
          ring.passed = true;
          this.addScore(100, `RING ${ring.index + 1}/6`);
          this.ringIndex += 1;
          if (this.ringIndex >= this.world.rings.length) this._finish();
        }
      }
    }
    if (plane.fuel <= 0 && !plane.landed && plane.alt > 2) {
      this.message = 'OUT OF FUEL — glide her down gently!';
      this.messageTimer = 1;
    }
    this._updateCrates(dt);
  }

  _updateCrates(dt) {
    for (const crate of this.crates) {
      if (crate.state === 'falling') {
        crate.vy = Math.min(14, crate.vy + dt * 20);
        crate.y -= crate.vy * dt;
        if (crate.y <= 0) {
          crate.y = 0;
          crate.state = 'landed';
          crate.landedTimer = 8; // the crate stays visible a while, then fades
          const dx = crate.x - crate.dock.x;
          const dz = crate.z - crate.dock.z;
          if (dx * dx + dz * dz < 40 * 40 && this.mission?.id === 'mail' && this.active) {
            crate.dock.done = true;
            this.addScore(120, `SUPPLIES TO ${crate.dock.label}`);
            this.dropIndex += 1;
            if (this.dropIndex >= 3) this._finish();
          } else if (this.active) {
            this.message = 'The crate missed the dock.';
            this.messageTimer = 2;
          }
        }
      } else if (crate.state === 'landed') {
        crate.landedTimer -= dt;
      }
    }
    this.crates = this.crates.filter((c) => c.state === 'falling' || c.landedTimer > 0);
  }

  // One-line summary for the mission-complete screen.
  summary() {
    if (!this.mission) return '';
    const done =
      this.mission.id === 'rings'
        ? `${this.ringIndex}/6 rings`
        : this.mission.id === 'hop'
          ? `${this.dockIndex}/3 docks`
          : `${this.dropIndex}/3 drops`;
    return `${this.mission.name} — ${done} — ${Math.round(this.timeLeft)}s left`;
  }

  _finish() {
    const bonus = Math.round(this.timeLeft) * 5;
    this.score += bonus;
    this.complete = true;
    this.message = `MISSION COMPLETE — time bonus +${bonus}`;
    this.messageTimer = 6;
  }

  _fail(reason) {
    this.failed = true;
    this.failReason = reason;
  }
}
