// plane.js — the Senja Amphibi seaplane: a low-poly mesh built from primitives
// plus the arcade flight model the autopilot (and the player) flies with.
//
// Units: x/z metres, heading radians (0 = +Z, bearing = atan2(dx, dz)),
// speed km/h, alt metres, vspeed m/s, throttle 0..1, fuel/damage 0..100.

import { newMesh, addBox, addCylinder, addCone, addSphere, addDisc, uploadMesh } from './gl.js';

export const MAX_SPEED = 320;      // km/h at full throttle
export const LIFTOFF_SPEED = 75;   // km/h — leave the water above this
export const SAFE_LAND_SPEED = 85; // km/h — touchdown above this hurts
export const SAFE_SINK = -6.0;     // m/s — sink faster than this hurts.
  // The final approach flies at ~75 km/h on a 0.23–0.25 throttle, whose
  // sink is −5.2 to −5.6; the limit has to sit below that band (a stall
  // sink is −8, an idle sink −7.45, both still hard) or a firm-but-fair
  // touchdown is judged hard and the landing scores nothing.
export const STALL_SPEED = 55;     // km/h — below this the sink grows

// Build the seaplane mesh at origin, nose toward +Z, floats at y ≈ -0.9.
// Colours: cream fuselage, teal wings, red tips, yellow floats.
export function buildPlaneMesh() {
  const b = newMesh();
  const cream = [0.93, 0.88, 0.78];
  const teal = [0.10, 0.45, 0.50];
  const red = [0.85, 0.20, 0.12];
  const yellow = [0.95, 0.75, 0.15];
  const dark = [0.16, 0.18, 0.20];
  const glass = [0.35, 0.62, 0.72];

  // Fuselage: tapered cylinder along Z (rotate a Y-cylinder by 90° about X).
  const fus = newMesh();
  addCylinder(fus, 0, 0, 0, 0.75, 1.05, 5.4, 10, cream);
  rotateXMesh(fus, Math.PI / 2);
  translateMesh(fus, 0, 0.35, 0.2);
  mergeInto(b, fus);
  // Nose cone.
  const nose = newMesh();
  addCone(nose, 0, 0, 0, 0.72, 1.4, 10, red);
  rotateXMesh(nose, Math.PI / 2);
  translateMesh(nose, 0, 0.35, 3.6);
  mergeInto(b, nose);
  // Tail cone.
  const tail = newMesh();
  addCone(tail, 0, 0, 0, 0.95, 2.2, 10, cream);
  rotateXMesh(tail, -Math.PI / 2);
  translateMesh(tail, 0, 0.45, -3.6);
  mergeInto(b, tail);
  // Windscreen + cabin windows.
  addBox(b, 0, 1.05, 1.6, 1.5, 0.7, 1.4, glass);
  // Main wing (high wing, slight span taper faked with three boxes).
  addBox(b, 0, 1.25, 0.4, 7.6, 0.22, 1.7, teal);
  addBox(b, -4.3, 1.25, 0.4, 1.4, 0.2, 1.5, red);
  addBox(b, 4.3, 1.25, 0.4, 1.4, 0.2, 1.5, red);
  // Wing struts.
  addBox(b, -1.6, 0.55, 0.4, 0.14, 1.1, 0.14, dark);
  addBox(b, 1.6, 0.55, 0.4, 0.14, 1.1, 0.14, dark);
  // Horizontal stabiliser + fin.
  addBox(b, 0, 0.75, -4.3, 3.0, 0.16, 1.0, teal);
  addBox(b, 0, 1.35, -4.4, 0.16, 1.5, 1.1, red);
  // Floats: two long pontoons with stepped bows, on struts.
  for (const sx of [-1.7, 1.7]) {
    const fl = newMesh();
    addCylinder(fl, 0, 0, 0, 0.42, 0.42, 4.6, 8, yellow);
    rotateXMesh(fl, Math.PI / 2);
    translateMesh(fl, sx, -0.85, 0.3);
    mergeInto(b, fl);
    const bow = newMesh();
    addCone(bow, 0, 0, 0, 0.4, 1.0, 8, yellow);
    rotateXMesh(bow, Math.PI / 2);
    translateMesh(bow, sx, -0.85, 3.0);
    mergeInto(b, bow);
    addBox(b, sx, -0.35, 0.6, 0.14, 0.7, 0.14, dark);
    addBox(b, sx, -0.35, -0.9, 0.14, 0.7, 0.14, dark);
  }
  // Prop hub at the nose.
  addSphere(b, 0, 0.35, 4.35, 0.28, 6, 8, dark);
  return b;
}

// Prop blades (two thin boxes) — drawn with a spin model matrix.
export function buildPropMesh() {
  const b = newMesh();
  const dark = [0.14, 0.15, 0.17];
  addBox(b, 0, 1.05, 0, 0.16, 1.9, 0.08, dark);
  addBox(b, 0, -1.05, 0, 0.16, 1.9, 0.08, dark);
  return b;
}

// Translucent prop disc (drawn with blending, depth write off).
export function buildPropDiscMesh() {
  const b = newMesh();
  addDisc(b, 2.0, 24, [0.85, 0.88, 0.9]);
  return b;
}

// Cockpit airframe: the nose the pilot sees over the dashboard — drawn in
// camera space in cockpit view so the cover shows the AIRCRAFT itself,
// not just its instruments. Nose only: the wings sit behind the camera
// on this high-wing seaplane, and wing stubs drawn in camera space read
// as flat slabs, not wings (tried, reverted). Built in the same local
// frame as the plane mesh (nose toward +Z); main.js places it just ahead
// of the camera, emerging from behind the dashboard. The real plane body
// stays drawn too — the two noses are collinear, so the overlay simply
// makes the nose read bigger and clearer.
export function buildCockpitAirframeMesh() {
  const b = newMesh();
  const red = [0.85, 0.20, 0.12];
  const dark = [0.16, 0.18, 0.20];
  // Nose cone, red, apex forward; long enough to run from its tip down
  // behind the dashboard, so it reads as one nose with the real one.
  const nose = newMesh();
  addCone(nose, 0, 0, 0, 0.4, 1.8, 8, red);
  rotateXMesh(nose, Math.PI / 2);
  translateMesh(nose, 0, 0.05, 0.9);
  mergeInto(b, nose);
  // Prop spinner at the nose tip (blades stay hidden in cockpit view).
  addSphere(b, 0, 0.05, 1.83, 0.16, 6, 8, dark);
  return b;
}

export function uploadPlane(gl) {
  return {
    body: uploadMesh(gl, buildPlaneMesh()),
    prop: uploadMesh(gl, buildPropMesh()),
    disc: uploadMesh(gl, buildPropDiscMesh()),
    airframe: uploadMesh(gl, buildCockpitAirframeMesh()),
  };
}

function rotateXMesh(m, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < m.pos.length; i += 3) {
    const y = m.pos[i + 1], z = m.pos[i + 2];
    m.pos[i + 1] = y * c - z * s;
    m.pos[i + 2] = y * s + z * c;
    const ny = m.norm[i + 1], nz = m.norm[i + 2];
    m.norm[i + 1] = ny * c - nz * s;
    m.norm[i + 2] = ny * s + nz * c;
  }
}

function translateMesh(m, dx, dy, dz) {
  for (let i = 0; i < m.pos.length; i += 3) {
    m.pos[i] += dx;
    m.pos[i + 1] += dy;
    m.pos[i + 2] += dz;
  }
}

function mergeInto(dst, src) {
  const off = dst.pos.length / 3;
  dst.pos.push(...src.pos);
  dst.norm.push(...src.norm);
  dst.col.push(...src.col);
  for (const i of src.idx) dst.idx.push(i + off);
}

// ---------------- flight model ----------------
export function createPlane(x, z, heading) {
  return {
    x, z, heading,
    speed: 0,          // km/h
    alt: 0,            // m above water
    vspeed: 0,         // m/s
    throttle: 0,       // 0..1
    fuel: 100,
    damage: 0,
    landed: true,
    bank: 0,           // visual roll, radians
    pitch: 0,          // visual pitch, radians
    propAngle: 0,
    landings: 0,       // counts every touchdown
    lastLandSpeed: 0,
    lastLandSink: 0,
    spray: 0,          // spray burst timer (s)
  };
}

export function resetPlane(p, x, z, heading) {
  p.x = x; p.z = z; p.heading = heading;
  p.speed = 0; p.alt = 0; p.vspeed = 0; p.throttle = 0;
  p.fuel = 100; p.damage = 0; p.landed = true;
  p.bank = 0; p.pitch = 0; p.propAngle = 0;
  p.landings = 0; p.lastLandSpeed = 0; p.lastLandSink = 0; p.spray = 0;
}

// input: { throttleUp, throttleDown, turn (-1..1), climb (bool) }
// world: { terrainHeight } — needed for terrain collision.
// events: optional { onSplash(), onCrash(reason) } callbacks.
export function updatePlane(p, input, dt, world, events) {
  // Throttle moves at 0.25/s so the autopilot's proportional control is stable.
  if (input.throttleUp) p.throttle = Math.min(1, p.throttle + 0.25 * dt);
  if (input.throttleDown) p.throttle = Math.max(0, p.throttle - 0.25 * dt);

  // Speed chases throttle * MAX_SPEED; water drag is heavier than air drag.
  // On the water at low throttle the hull drags hard, so the plane actually
  // slows to a taxi instead of sliding along at 70 km/h forever.
  // Deceleration is deliberately quick (tau 0.9): a throttle cut must bite
  // within the short final, or the plane touches down too fast to score.
  let targetSpeed = p.throttle * MAX_SPEED;
  let tau = p.landed ? 3.2 : 2.2;
  if (targetSpeed < p.speed) tau = Math.min(tau, 0.9);
  if (p.landed && p.throttle < 0.4) {
    // Hull drag caps the taxi at 60 km/h: fast enough to taxi into a
    // dock from a short landing, slow enough to stay controllable.
    targetSpeed = Math.min(targetSpeed, 60);
    tau = 1.2;
  }
  p.speed += (targetSpeed - p.speed) * (1 - Math.exp(-dt / tau));

  // Turn: 0.6 rad/s at speed, weaker when slow — but not too weak, or a
  // seaplane taxiing at 30 km/h can never turn around at a dock.
  const turnRate = 0.6 * Math.min(1, Math.max(0.5, p.speed / 140));
  p.heading += input.turn * turnRate * dt;
  const targetBank = -input.turn * 0.5 * Math.min(1, p.speed / 120);
  p.bank += (targetBank - p.bank) * (1 - Math.exp(-dt / 0.35));

  // Forward motion.
  const speedMs = p.speed / 3.6;
  p.x += Math.sin(p.heading) * speedMs * dt;
  p.z += Math.cos(p.heading) * speedMs * dt;

  // Vertical.
  if (p.landed) {
    p.alt = 0;
    p.vspeed = 0;
    // Liftoff needs BOTH speed and throttle: a plane that touches down
    // fast (83 km/h) and cuts the throttle must stay on the water and
    // decelerate into a taxi, not bounce straight back into the air.
    // Without the throttle test the touchdown lasts a single frame and
    // the plane can never land, score, or taxi.
    if (p.speed > LIFTOFF_SPEED && p.throttle > 0.6) {
      p.landed = false;
      p.alt = 0.5;
      p.vspeed = 4; // positive climb-out so the plane leaves the water
    }
  } else {
    let targetVs;
    if (input.climb && p.speed > 70) {
      targetVs = 10 * Math.min(1, Math.max(0.5, p.speed / 120));
    } else if (p.speed < STALL_SPEED) {
      targetVs = -8; // stall: sink grows
    } else {
      // Idle sink grows as the throttle comes back, so the pilot can
      // actually steer the descent: full throttle flies level, throttle
      // idle sinks ~7 m/s. A low-throttle dive is also slow, so the
      // descent slope steepens — that is what tracks a glide slope.
      targetVs = -(2.5 + (0.55 - p.throttle) * 9);
      targetVs = Math.max(-7.5, Math.min(0, targetVs));
    }
    p.vspeed += (targetVs - p.vspeed) * (1 - Math.exp(-dt / 0.8));
    p.alt += p.vspeed * dt;

    // Touching down: water (alt 0) or terrain (alt at/below the ground).
    const ground = world.terrainHeight(p.x, p.z);
    if (p.alt <= Math.max(0, ground)) {
      if (ground > 0.5) {
        // A glancing island strike hurts and bounces the plane off; only
        // a hard or repeated strike wrecks it outright.
        p.damage += 20 + p.speed * 0.2;
        p.alt = ground + 1;
        p.vspeed = 3;
        p.speed *= 0.6;
        if (p.damage >= 100) {
          p.damage = 100;
          if (events?.onCrash) events.onCrash('Hit an island');
        }
      } else {
        p.lastLandSpeed = p.speed;
        p.lastLandSink = p.vspeed;
        p.alt = 0;
        p.vspeed = 0;
        const hard = p.lastLandSpeed > SAFE_LAND_SPEED || p.lastLandSink < SAFE_SINK;
        if (hard) {
          // A fast or steep touchdown hurts, but one imperfect landing
          // should not end the sortie: the penalty ramps gently.
          const over = Math.max(0, p.lastLandSpeed - SAFE_LAND_SPEED);
          const sinkOver = Math.max(0, -p.lastLandSink + SAFE_SINK);
          p.damage += 12 + over * 0.5 + sinkOver * 5;
          if (p.damage >= 100) {
            p.damage = 100;
            if (events?.onCrash) events.onCrash('Hard impact on the water');
          }
        }
        p.landed = true;
        p.landings += 1;
        p.spray = 1.2;
        if (events?.onSplash) events.onSplash();
      }
    }
  }

  // Fuel: base burn plus throttle burn; empty tank ends the sortie.
  p.fuel -= (0.05 + p.throttle * 0.22) * dt;
  if (p.fuel < 0) p.fuel = 0;

  // Visual pitch from the vertical speed.
  const targetPitch = Math.atan2(p.vspeed, Math.max(8, speedMs));
  p.pitch += (targetPitch - p.pitch) * (1 - Math.exp(-dt / 0.4));

  // Prop spin: faster with throttle and speed.
  p.propAngle += dt * (4 + p.throttle * 28 + p.speed * 0.06);
  if (p.spray > 0) p.spray -= dt;
}
