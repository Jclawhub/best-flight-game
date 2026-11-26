// The seaplane — flight model and drawing for Senja Amphibi.
// Speeds are km/h, altitudes metres, world units roughly metres. The model
// is deliberately forgiving: throttle sets a target speed, turning banks the
// plane and auto-levels when you let go, and holding the mouse climbs. Stall
// below 90 km/h, rough water at speed, and flying into an island all hurt.

import { normalizeAngle } from './world.js';

export const MAX_SPEED = 320;
export const STALL_SPEED = 55;
export const TAKEOFF_SPEED = 95;
// A touchdown counts as soft up to 85 km/h with a sink gentler than
// 5.5 m/s — a firm but survivable seaplane landing. Faster, or steeper
// than that, is rough water: it hurts, but one rough landing will not
// end a sortie on its own.
export const SAFE_LAND_SPEED = 85;
export const SAFE_LAND_SINK = 5.5;
export const ROUGH_LAND_DAMAGE = 30;

export class Plane {
  constructor() {
    this.reset(0, 0, 0);
  }

  reset(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.alt = 0;
    this.vspeed = 0;
    this.throttle = 0;
    this.bank = 0;
    this.pitch = 0;
    this.damage = 0;
    this.fuel = 100;
    this.landed = true;
    this.crashed = false;
    this.stalling = false;
    this.propAngle = 0;
  }

  get flying() {
    return !this.landed && !this.crashed;
  }

  // One physics step. events is a callback the game passes in:
  // events(type, detail) — 'landed', 'rough', 'crash', 'takeoff'.
  update(dt, input, world, events) {
    if (this.crashed) return;
    const throttleUp = input.anyDown('KeyW', 'ArrowUp');
    const throttleDown = input.anyDown('KeyS', 'ArrowDown');
    if (throttleUp) this.throttle = Math.min(1, this.throttle + dt * 0.55);
    if (throttleDown) this.throttle = Math.max(0, this.throttle - dt * 0.55);
    if (this.fuel <= 0) this.throttle = 0;

    // Speed chases the throttle target; the engine is slow to spool.
    const targetSpeed = this.throttle * MAX_SPEED;
    const rate = targetSpeed > this.speed ? 26 : 42;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), rate * dt);
    if (this.speed < 0) this.speed = 0;

    // Turning: full deflection at speed, mushy when slow; bank follows input.
    const turnInput = (input.anyDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.anyDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const turnAuthority = 0.35 + 0.65 * Math.min(1, this.speed / 160);
    const turnRate = turnInput * 0.42 * turnAuthority;
    this.heading = normalizeAngle(this.heading + turnRate * dt);
    const targetBank = turnInput * 0.55;
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 4);

    // Lift: climbing needs speed and a held mouse; slow flight sinks.
    // Cutting the throttle makes the plane sink faster, so a powered
    // glide (throttle ~0.3) is the way to come down gently.
    const climbing = input.mouse.down ? 1 : 0;
    this.stalling = this.speed < STALL_SPEED && this.alt > 2;
    let vspeedTarget;
    if (this.landed) {
      vspeedTarget = 0;
    } else if (this.stalling) {
      vspeedTarget = -6.5;
    } else {
      const climbRate = climbing * 11 * Math.min(1, Math.max(0, (this.speed - 45) / 140));
      const sinkRate = 1.0 + (1 - this.throttle) * 4;
      vspeedTarget = climbRate - sinkRate;
    }
    this.vspeed += (vspeedTarget - this.vspeed) * Math.min(1, dt * 2.2);
    this.alt += this.vspeed * dt;
    this.pitch += (this.vspeed * 0.02 - this.pitch) * Math.min(1, dt * 3);

    // Move through the world.
    const speedMs = (this.speed * 1000) / 3600;
    this.x += Math.sin(this.heading) * speedMs * dt;
    this.z += Math.cos(this.heading) * speedMs * dt;

    // Fuel burns with throttle; empty tanks mean a dead stick.
    if (this.flying || this.throttle > 0) {
      this.fuel = Math.max(0, this.fuel - (0.05 + this.throttle * 0.14) * dt);
    }

    // Takeoff: fast enough on the water and the floats let go.
    if (this.landed && this.speed >= TAKEOFF_SPEED && this.fuel > 0) {
      this.landed = false;
      this.alt = 1.5;
      this.vspeed = 2;
      events('takeoff', { speed: this.speed });
    }

    // Water contact.
    if (!this.landed && this.alt <= 0) {
      this.alt = 0;
      const soft = this.speed <= SAFE_LAND_SPEED && this.vspeed >= -SAFE_LAND_SINK;
      if (soft) {
        this.landed = true;
        this.vspeed = 0;
        events('landed', { speed: this.speed, rough: false });
      } else {
        this.damage = Math.min(100, this.damage + ROUGH_LAND_DAMAGE);
        this.vspeed = 3;
        this.alt = 2;
        this.speed *= 0.6;
        events('rough', { damage: this.damage });
        if (this.damage >= 100) this._crash(events, 'water');
      }
    }

    // Islands and the volcano are solid: below their height, you hit them.
    if (!this.landed && !this.crashed) {
      for (const island of world.islands) {
        const dx = this.x - island.x;
        const dz = this.z - island.z;
        if (dx * dx + dz * dz < (island.r * 0.8) ** 2 && this.alt < island.h) {
          this._crash(events, 'island');
          break;
        }
      }
      if (!this.crashed) {
        const dx = this.x - world.volcano.x;
        const dz = this.z - world.volcano.z;
        if (dx * dx + dz * dz < (world.volcano.r * 0.7) ** 2 && this.alt < world.volcano.h) {
          this._crash(events, 'volcano');
        }
      }
    }

    this.propAngle += dt * (4 + this.throttle * 26);
  }

  _crash(events, what) {
    this.crashed = true;
    this.damage = 100;
    this.speed = 0;
    events('crash', { what });
  }

  // Chase-view drawing: rear three-quarter view, banking with the turn,
  // pontoons below, prop disc at the nose, nav lights on the wingtips.
  draw(ctx, time) {
    if (this.crashed) return;
    const cx = 640;
    const cy = 478;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.bank * 0.45);
    // Soft shadow on the water when low.
    if (this.alt < 90) {
      ctx.save();
      ctx.translate(0, 96 - this.alt * 0.4);
      ctx.fillStyle = `rgba(0, 20, 25, ${0.28 * (1 - this.alt / 90)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Pontoons (seaplane floats).
    ctx.fillStyle = '#274b5a';
    this._roundRect(ctx, -34, 34, 20, 12, 6);
    this._roundRect(ctx, 14, 34, 20, 12, 6);
    ctx.fillStyle = '#3d6b7d';
    this._roundRect(ctx, -32, 35, 16, 4, 2);
    this._roundRect(ctx, 16, 35, 16, 4, 2);
    // Wake: white foam trailing the floats while taxiing on the water.
    if (this.landed && this.speed > 18) {
      const wakeAlpha = Math.min(0.5, 0.15 + this.speed / 400);
      ctx.fillStyle = `rgba(255, 255, 255, ${wakeAlpha})`;
      ctx.beginPath();
      ctx.ellipse(-24, 52, 14, 5 + this.speed * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(24, 52, 14, 5 + this.speed * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 58, 30, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Struts.
    ctx.strokeStyle = '#274b5a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-24, 34); ctx.lineTo(-18, 16);
    ctx.moveTo(24, 34); ctx.lineTo(18, 16);
    ctx.stroke();
    // Wings, wide and slightly swept, orange tips.
    ctx.fillStyle = '#f2ede2';
    ctx.beginPath();
    ctx.moveTo(-78, 6); ctx.lineTo(-14, -2); ctx.lineTo(-14, 12); ctx.lineTo(-78, 16);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(78, 6); ctx.lineTo(14, -2); ctx.lineTo(14, 12); ctx.lineTo(78, 16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8c2e';
    ctx.beginPath();
    ctx.moveTo(-78, 6); ctx.lineTo(-64, 4); ctx.lineTo(-64, 15); ctx.lineTo(-78, 16);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(78, 6); ctx.lineTo(64, 4); ctx.lineTo(64, 15); ctx.lineTo(78, 16);
    ctx.closePath(); ctx.fill();
    // Fuselage: tapered body, cream with a sunset-orange cheatline.
    const body = ctx.createLinearGradient(0, -34, 0, 22);
    body.addColorStop(0, '#fdf6e8');
    body.addColorStop(0.7, '#f2e3c2');
    body.addColorStop(1, '#c98a4b');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.bezierCurveTo(16, -30, 20, -8, 17, 12);
    ctx.bezierCurveTo(15, 22, 8, 24, 0, 24);
    ctx.bezierCurveTo(-8, 24, -15, 22, -17, 12);
    ctx.bezierCurveTo(-20, -8, -16, -30, 0, -36);
    ctx.fill();
    ctx.fillStyle = '#ff8c2e';
    ctx.fillRect(-17, 2, 34, 5);
    // Windows.
    ctx.fillStyle = '#1d2f3a';
    ctx.beginPath(); ctx.arc(-8, -14, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -14, 4, 0, Math.PI * 2); ctx.fill();
    // Tail fin and stabilisers.
    ctx.fillStyle = '#e2572b';
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(-9, -52); ctx.lineTo(9, -52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(-26, -30, 52, 6);
    // Propeller disc at the nose.
    ctx.save();
    ctx.translate(0, -38);
    ctx.rotate(this.propAngle);
    ctx.fillStyle = 'rgba(40, 40, 40, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#333333';
    ctx.beginPath(); ctx.arc(0, -38, 5, 0, Math.PI * 2); ctx.fill();
    // Nav lights: red port, green starboard, blinking white tail strobe.
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(-78, 11, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2eff5e';
    ctx.beginPath(); ctx.arc(78, 11, 3.5, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(time * 6) > 0.2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, -52, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}
