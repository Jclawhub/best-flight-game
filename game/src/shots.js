// shots.js — deterministic staging for ?shot=<cockpit|rescue|landing|complete>
// plus &seed=. When a shot is staged the title screen is skipped, the plane
// is placed exactly where the shot needs it, and the scene is frozen (the
// plane does not fly on) while water, clouds and the prop keep animating,
// so a screenshot taken a second or two after load still frames the shot.

import { startMission } from './missions.js';

export function parseParams(search) {
  const params = new URLSearchParams(search);
  const seedRaw = params.get('seed');
  const seed = seedRaw ? (parseInt(seedRaw, 10) >>> 0) || 1 : (Math.random() * 0xffffffff) >>> 0;
  return {
    seed,
    shot: params.get('shot'),
    hasShot: params.has('shot'),
  };
}

// Apply staging after the game is constructed. Returns true when a shot was
// staged (caller should set game.frozen = true and skip the title screen).
export function applyShot(game, plane, missions, world) {
  const shot = game.params.shot;
  if (!shot) return false;
  const rings = world.rings;

  if (shot === 'cockpit') {
    // Cockpit view, rings mission live, plane ~120 m before ring 2 at ring
    // altitude, ring 2 clearly ahead through the windshield — close enough
    // that the ring reads large in the frame (at 300 m it rendered only
    // ~60 px wide; at 150 m ~110 px; at 120 m ~145 px, matching the
    // round-3 cover's ring). Ring 1 is staged as already flown (score
    // 100) so the live objective IS ring 2.
    // The approach runs on a −72° heading, NOT the ring 1→2 leg: on the
    // old −60.6° leg only Palm island showed, at the frame edge, with
    // empty sea below. At −72° the forward cone holds Palm island with
    // its volcano, the Palm dock, and a fishing boat in the mid-ground,
    // while the sun still sits in frame upper-left — a living
    // archipelago instead of empty sea.
    startMission(missions, 'rings', plane);
    missions.ringIndex = 1;
    missions.score = 100;
    game.viewMode = 'cockpit';
    const r2 = rings[1];
    const hdg = -72 * Math.PI / 180;
    plane.x = r2.x - Math.sin(hdg) * 120;
    plane.z = r2.z - Math.cos(hdg) * 120;
    plane.heading = hdg;
    // Fly 12 m below the ring: it sits in the upper-middle of the frame
    // and the foreground sea + sun glint fill the lower half. (Do NOT
    // pitch the camera down here: a nose-down pitch exposes the plane's
    // own red fuselage, which floods the lower frame — tried, reverted.)
    plane.alt = r2.y - 12;
    plane.vspeed = 0;
    plane.speed = 180;
    plane.throttle = 0.56;
    plane.landed = false;
    game.state = 'flying';
    return true;
  }

  if (shot === 'rescue') {
    // Chase view, plane ~70 m out from the raft, low and slow. The plane
    // is aimed ~23° off the raft (not straight at it) so the raft and
    // the waving sailor with his red SOS flag sit beside the plane in
    // the frame instead of hiding directly behind it.
    startMission(missions, 'rescue', plane);
    game.viewMode = 'chase';
    const rx = world.raft.x, rz = world.raft.z;
    plane.x = rx + 62;
    plane.z = rz + 32;
    plane.heading = Math.atan2(rx - plane.x, rz - plane.z) + 0.4;
    plane.alt = 15;
    plane.vspeed = -1;
    plane.speed = 85;
    plane.throttle = 0.27;
    plane.landed = false;
    game.state = 'flying';
    return true;
  }

  if (shot === 'landing') {
    // Plane just landed at hop dock 1: spray bursting, toast visible.
    startMission(missions, 'hop', plane);
    missions.score = 150;
    missions.dockIndex = 1;
    missions.lastCountedLanding = plane.landings;
    const d = world.hopDocks[0];
    plane.x = d.x;
    plane.z = d.z;
    plane.heading = d.pier; // nose toward the island, pier ahead of the plane
    plane.alt = 0;
    plane.vspeed = 0;
    plane.speed = 45;
    plane.throttle = 0.2;
    plane.landed = true;
    plane.spray = 5; // keep the spray burst alive for the shot
    game.viewMode = 'chase';
    game.state = 'flying';
    missions.toast = 'Clean landing! +150';
    missions.toastTimer = 30; // held for the screenshot
    return true;
  }

  if (shot === 'complete') {
    // Mission-complete panel over the scene, rings staged as finished.
    startMission(missions, 'rings', plane);
    missions.score = 600;
    missions.ringIndex = rings.length;
    missions.complete = true;
    const r = rings[rings.length - 1];
    plane.x = r.x + 120;
    plane.z = r.z + 120;
    plane.heading = Math.atan2(r.x - plane.x, r.z - plane.z);
    plane.alt = r.y;
    plane.speed = 120;
    plane.throttle = 0.38;
    plane.landed = false;
    game.viewMode = 'chase';
    game.state = 'complete';
    return true;
  }

  return false;
}
