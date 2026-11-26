// Senja Amphibi — deterministic screenshot staging for ?shot=<name>&seed=<n>.
// Each stage freezes one readable moment: takeoff, a ring, the rescue and
// the mission-complete screen with the panel clear of the aircraft.

import { buildWorld } from './world.js';

export const SHOT_NAMES = ['takeoff', 'rings', 'rescue', 'complete'];

export function applyShot(game, name, seed) {
  if (seed) {
    game.world = buildWorld(seed);
    game.missions.world = game.world;
  }
  const p = game.plane;
  const m = game.missions;
  if (name === 'takeoff') {
    game.startMission('rings');
    // 600 m out from ring 1, climbing out at ring height: the ring sits
    // big and clean below the objective line instead of behind the HUD.
    const dx = 150, dz = 600;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    p.x = 150 - ux * 600; p.z = 600 - uz * 600;
    p.heading = Math.atan2(ux, uz);
    p.alt = 95; p.speed = 150; p.throttle = 0.8;
    p.vspeed = 2; p.landed = false;
    game.state = 'staging';
    return;
  }
  if (name === 'rings') {
    game.startMission('rings');
    m.ringIndex = 1;
    m.score = 100;
    // 320 m out from ring 2, on the line in from ring 1, at ring altitude.
    const dx = -250 - 150, dz = 1150 - 600;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    p.x = -250 - ux * 320; p.z = 1150 - uz * 320;
    p.heading = Math.atan2(ux, uz);
    p.alt = 95; p.speed = 210; p.throttle = 0.66;
    p.vspeed = 0; p.landed = false;
    game.state = 'staging';
    return;
  }
  if (name === 'rescue') {
    game.startMission('rescue');
    // 260 m out from the raft, inbound from the main dock, low and slow.
    const dx = 700 - (-260), dz = 1750 - 650;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    p.x = 700 - ux * 260; p.z = 1750 - uz * 260;
    p.heading = Math.atan2(ux, uz);
    p.alt = 24; p.speed = 95; p.throttle = 0.3;
    p.vspeed = -2; p.landed = false;
    game.state = 'staging';
    return;
  }
  if (name === 'complete') {
    game.startMission('hop');
    m.dockIndex = 3;
    m.score = 500;
    m.complete = true;
    m.timeLeft = 64;
    p.x = 200; p.z = 3300;
    p.heading = Math.atan2(150, 350);
    p.alt = 45; p.speed = 120; p.throttle = 0.4;
    p.vspeed = 0; p.landed = false;
    game.state = 'complete';
    return;
  }
  game.state = 'title';
}
