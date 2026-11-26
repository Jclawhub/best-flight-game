// Senja Amphibi — seaplane flight model: throttle, turn, climb, stall,
// water landings and takeoffs, fuel burn and damage. Arcade-tuned so a
// steady hand lands clean and a rushed one pays for it.

export class Seaplane {
  constructor() {
    this.reset(0, 0, 0);
  }

  reset(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;      // km/h
    this.alt = 0;        // metres above the sea
    this.vspeed = 0;     // m/s, + is climbing
    this.throttle = 0;   // 0..1
    this.fuel = 100;     // percent
    this.damage = 0;     // percent; 100 is a wreck
    this.landed = true;  // starts floating on the water
    this.bank = 0;       // visual roll, radians
    this.prop = 0;       // propeller spin angle
  }

  // One physics step. Returns an event string for the mission layer, or null.
  // Events: 'takeoff' | 'landed-clean' | 'landed-rough' |
  //         'crashed-sea' | 'crashed-island' | 'fuel-out'
  update(dt, input, world) {
    const up = input.isDown('KeyW') || input.isDown('ArrowUp');
    const down = input.isDown('KeyS') || input.isDown('ArrowDown');
    if (up) this.throttle = Math.min(1, this.throttle + 0.6 * dt);
    if (down) this.throttle = Math.max(0, this.throttle - 0.6 * dt);
    const turn = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const stalled = !this.landed && this.speed < 55;
    const turnRate = this.landed ? 0.3
      : stalled ? 0.15 : 0.52 * (0.55 + 0.45 * Math.min(this.speed, 240) / 240);
    this.heading += turn * turnRate * dt;
    this.bank += (turn * 0.45 - this.bank) * Math.min(1, 3 * dt);
    this.prop += dt * (20 + this.throttle * 180);

    // Fuel drains with throttle: a full-throttle sortie is a real decision.
    this.fuel = Math.max(0, this.fuel - dt * (0.05 + this.throttle * 0.11));
    if (this.fuel <= 0) return 'fuel-out';

    if (this.landed) {
      const target = this.throttle * 170;
      this.speed += Math.max(-60 * dt, Math.min(45 * dt, target - this.speed));
      const v = this.speed / 3.6;
      this.x += Math.sin(this.heading) * v * dt;
      this.z += Math.cos(this.heading) * v * dt;
      if (this.throttle > 0.5 && this.speed > 78) {
        this.landed = false; this.alt = 1; this.vspeed = 3;
        return 'takeoff';
      }
      return null;
    }

    // Airborne: speed chases the throttle, climb is the mouse.
    const target = this.throttle * 320;
    this.speed += Math.max(-40 * dt, Math.min(28 * dt, target - this.speed));
    // Turning scrubs a little speed: turn discipline pays, yanking does not.
    if (turn !== 0) this.speed = Math.max(0, this.speed - 3 * dt);
    let vsTarget = input.mouseHeld ? 7 : (this.speed < 55 ? -9 : -3.0);
    // Idle sink is 3 m/s: a steady 0.15 glide slope at landing speed, so a
    // short final approach can actually reach the water instead of sailing
    // over the dock forever. Level flight means climbing in short bursts.
    if (input.mouseHeld && this.speed < 70) vsTarget = 4;
    this.vspeed += (vsTarget - this.vspeed) * Math.min(1, 2.2 * dt);
    this.alt += this.vspeed * dt;
    const v = this.speed / 3.6;
    this.x += Math.sin(this.heading) * v * dt;
    this.z += Math.cos(this.heading) * v * dt;
    this.x = Math.max(-3000, Math.min(3000, this.x));
    this.z = Math.max(-800, Math.min(4200, this.z));

    // Flying into an island's flank is a crash at any height below its peak.
    for (const isl of world.islands) {
      const d = Math.hypot(this.x - isl.x, this.z - isl.z);
      if (d < isl.r * 0.85 && this.alt < isl.h) return 'crashed-island';
    }

    if (this.alt <= 0) {
      this.alt = 0;
      if (this.speed <= 85 && this.vspeed >= -5.5) {
        this.landed = true; this.vspeed = 0;
        return 'landed-clean';
      }
      if (this.speed <= 115 && this.vspeed >= -8.5) {
        this.landed = true; this.vspeed = 0;
        this.damage = Math.min(100, this.damage + 30);
        return 'landed-rough';
      }
      return 'crashed-sea';
    }
    return null;
  }
}
