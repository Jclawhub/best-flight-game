// Senja Amphibi — seaplane physics. Heading 0 = +z (north).
// Speed in km/h, altitude in metres, vspeed in m/s.

export class Seaplane {
  constructor() {
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.alt = 0;
    this.vspeed = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.damage = 0;
    this.landed = true;
    this.bank = 0;
    this.prop = 0;
  }

  reset(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.alt = 0;
    this.vspeed = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.damage = 0;
    this.landed = true;
    this.bank = 0;
    this.prop = 0;
  }

  // Returns an event string ('takeoff', 'landed-clean', 'landed-rough',
  // 'crashed-sea', 'crashed-island', 'fuel-out') or null.
  update(dt, input, world) {
    const keys = input.keys;
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const turn = (right ? 1 : 0) - (left ? 1 : 0);

    // Throttle moves 0.6/s.
    if (up) this.throttle = Math.min(1, this.throttle + 0.6 * dt);
    if (down) this.throttle = Math.max(0, this.throttle - 0.6 * dt);

    const stalled = !this.landed && this.speed < 55;
    let rate;
    if (this.landed) rate = 0.3;
    else if (stalled) rate = 0.15;
    else rate = 0.52 * (0.55 + 0.45 * (Math.min(this.speed, 240) / 240));
    this.heading += turn * rate * dt;

    // Bank eases toward the turn.
    const bankTarget = this.landed ? 0 : turn * 0.5;
    this.bank += (bankTarget - this.bank) * Math.min(1, 3 * dt);
    this.prop += dt * (4 + this.throttle * 30);

    // Speed chases its throttle target (up 28/s, down 40/s).
    const targetSpeed = this.landed ? this.throttle * 170 : this.throttle * 320;
    const accel = targetSpeed > this.speed ? 28 : 40;
    const diff = targetSpeed - this.speed;
    const step = Math.max(-accel * dt, Math.min(accel * dt, diff));
    this.speed += step;
    // Turning scrubs a little speed.
    if (turn !== 0) this.speed = Math.max(0, this.speed - 3 * dt);

    if (this.landed) {
      // Water taxi, then lift off. A touch of throttle is needed first so
      // the plane cannot leap off the water from a standstill.
      if (this.throttle > 0.5 && this.speed > 78) {
        this.landed = false;
        this.alt = 1;
        this.vspeed = 3;
        this.move(dt);
        this.clamp();
        return 'takeoff';
      }
    } else {
      // Climb is hold-to-climb; otherwise a gentle sink, harder in a stall.
      const climb = input.mouseHeld ? (this.speed < 70 ? 4 : 7) : 0;
      const sink = stalled ? -9 : -3;
      const targetVs = climb + sink;
      const dv = targetVs - this.vspeed;
      this.vspeed += Math.max(-2.2 * dt, Math.min(2.2 * dt, dv));
      this.alt += this.vspeed * dt;
    }

    this.move(dt);
    this.clamp();

    // Fuel burn; empty tanks end the sortie.
    this.fuel -= (0.05 + this.throttle * 0.11) * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      return 'fuel-out';
    }

    if (!this.landed) {
      // Island strike: inside 85% of the island radius and below its top.
      for (const isl of world.islands) {
        const d = Math.hypot(this.x - isl.x, this.z - isl.z);
        if (d < isl.r * 0.85 && this.alt < isl.h) return 'crashed-island';
      }
      // Touchdown.
      if (this.alt <= 0) {
        this.alt = 0;
        if (this.speed <= 85 && this.vspeed >= -5.5) {
          this.landed = true;
          this.vspeed = 0;
          return 'landed-clean';
        }
        if (this.speed <= 115 && this.vspeed >= -8.5) {
          this.landed = true;
          this.vspeed = 0;
          this.damage = Math.min(100, this.damage + 30);
          return 'landed-rough';
        }
        return 'crashed-sea';
      }
    }
    return null;
  }

  move(dt) {
    const ms = this.speed / 3.6;
    this.x += Math.sin(this.heading) * ms * dt;
    this.z += Math.cos(this.heading) * ms * dt;
  }

  clamp() {
    this.x = Math.max(-3000, Math.min(3000, this.x));
    this.z = Math.max(-800, Math.min(4200, this.z));
  }
}
