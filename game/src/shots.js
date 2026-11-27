// Senja Amphibi — staged moments for screenshots (?shot=<name>&seed=<n>).
// Each stage rebuilds the world with the seed, starts the right mission,
// positions the plane, and freezes state='staging' (or 'complete').

import { buildWorld, RING_COURSE, HOP_DOCKS, RESCUE_RAFT, MAIN_DOCK } from './world.js';

export const SHOT_NAMES = ['takeoff', 'rings', 'rescue', 'cockpit', 'landing', 'complete'];

function placeOnLine(from, to, distBack) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  return {
    x: to.x - ux * distBack,
    z: to.z - uz * distBack,
    heading: Math.atan2(dx, dz),
  };
}

function setPlane(game, pos) {
  const p = game.plane;
  p.x = pos.x;
  p.z = pos.z;
  p.heading = pos.heading;
  p.alt = pos.alt ?? 0;
  p.speed = pos.speed ?? 0;
  p.vspeed = pos.vspeed ?? 0;
  p.throttle = pos.throttle ?? 0;
  p.fuel = pos.fuel ?? 100;
  p.damage = pos.damage ?? 0;
  p.landed = pos.landed ?? false;
  p.bank = 0;
  p.prop = 0.6;
}

export function applyShot(game, name, seed) {
  game.world = buildWorld(seed);
  game.view = 'chase';
  const m = game.missions;

  if (name === 'takeoff') {
    m.start('rings');
    const pos = placeOnLine({ x: 0, z: 0 }, RING_COURSE[0], 600);
    setPlane(game, { ...pos, alt: 95, speed: 150, throttle: 0.8 });
    game.state = 'staging';
    return;
  }

  if (name === 'rings') {
    m.start('rings');
    m.ringIndex = 1;
    m.score = 100;
    const pos = placeOnLine(RING_COURSE[0], RING_COURSE[1], 320);
    setPlane(game, { ...pos, alt: 95, speed: 210, throttle: 0.66 });
    game.state = 'staging';
    return;
  }

  if (name === 'rescue') {
    m.start('rescue');
    const pos = placeOnLine(MAIN_DOCK, RESCUE_RAFT, 260);
    setPlane(game, { ...pos, alt: 24, speed: 95, throttle: 0.3 });
    game.state = 'staging';
    return;
  }

  if (name === 'cockpit') {
    m.start('rings');
    m.ringIndex = 1;
    m.score = 100;
    // A touch closer than the rings stage (320 m) so the ring fills
    // more of the windscreen, and a touch higher (102 m) so it sits
    // against open sea and sky rather than the volcano behind it.
    const pos = placeOnLine(RING_COURSE[0], RING_COURSE[1], 320);
    setPlane(game, { ...pos, alt: 102, speed: 200, throttle: 0.66 });
    game.view = 'cockpit';
    game.state = 'staging';
    return;
  }

  if (name === 'landing') {
    m.start('hop');
    m.dockIndex = 1;
    m.score = 150;
    const dock = HOP_DOCKS[0];
    // Nose points at the next dock, so the sortie reads as mid-mission.
    const heading = Math.atan2(HOP_DOCKS[1].x - dock.x, HOP_DOCKS[1].z - dock.z);
    setPlane(game, {
      x: dock.x, z: dock.z, heading,
      alt: 0, speed: 55, throttle: 0.2, landed: true,
    });
    // Spray burst around the floats. The camera sits at the plane, so
    // spray spawned exactly at the plane would project behind the near
    // plane (fwd < 10) and be invisible — centre it ~16 m ahead of the
    // nose, where it reads as spray bursting around the floats.
    const sx = game.plane.x + Math.sin(heading) * 16;
    const sz = game.plane.z + Math.cos(heading) * 16;
    m.spray(sx, sz, 26);
    m.toast = 'Clean landing! +150';
    m.toastLeft = 2.6;
    game.state = 'staging';
    return;
  }

  if (name === 'complete') {
    m.start('hop');
    m.dockIndex = 3;
    m.score = 500;
    m.complete = true;
    m.timeLeft = 64;
    const heading = Math.atan2(HOP_DOCKS[2].x - 200, HOP_DOCKS[2].z - 3300);
    setPlane(game, {
      x: 200, z: 3300, heading,
      alt: 45, speed: 120, throttle: 0.4,
    });
    game.state = 'complete';
    return;
  }

  // Unknown shot name: fall back to the title screen.
  game.state = 'title';
}
