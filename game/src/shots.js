// Deterministic staged scenes for screenshots.
// ?shot=<name>&seed=<n> freezes the game in a composed state: the title
// screen's backdrop, a takeoff, a ring pass, a dock approach, or the mission
// complete screen. Nothing random leaks in — the same shot always renders
// the same frame, so the screenshots are reproducible.

export const SHOT_NAMES = ['start', 'rings', 'landing', 'complete', 'title'];

// A plain title-screen shot, for checking the menu backdrop renders.
function applyTitleShot(game) {
  game.state = 'title';
  game.selectedMission = 0;
  game.titleHeading = 0.7;
  game.frozen = true;
  game.time = 42.5;
  return true;
}

export function applyShot(game, name, seed = 1) {
  const { plane, missions, world } = game;
  void seed;
  game.frozen = true;
  game.time = 42.5; // fixed golden-hour moment for every shot
  if (name === 'title') return applyTitleShot(game);
  if (name === 'start') {
    missions.start('rings');
    missions.timeLeft = 180;
    plane.reset(0, 60, 0);
    plane.throttle = 0.65;
    plane.speed = 42;
    plane.landed = true;
    game.state = 'flying';
    game.time = 42.5;
    return true;
  }
  if (name === 'rings') {
    missions.start('rings');
    missions.timeLeft = 141;
    missions.score = 210;
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    missions.ringIndex = 2;
    // Head straight for ring 3 (index 2) at (1300, 130, 900): the gold
    // next ring dead ahead, islands below, sun low behind the plane.
    plane.reset(950, 1100, Math.atan2(1300 - 950, 900 - 1100));
    plane.throttle = 0.8;
    plane.speed = 214;
    plane.alt = 158;
    plane.vspeed = 1.5;
    plane.landed = false;
    plane.bank = 0.12;
    game.state = 'flying';
    return true;
  }
  if (name === 'landing') {
    missions.start('hop');
    missions.timeLeft = 96;
    missions.score = 150;
    missions.dockIndex = 1;
    world.docks.filter((d) => d.kind === 'lagoon')[0].done = true;
    // On final approach to lagoon 2: low, slow, dock clearly ahead.
    const dock = world.docks.filter((d) => d.kind === 'lagoon')[1];
    plane.reset(dock.x + 80, dock.z - 260, 0);
    plane.heading = Math.atan2(dock.x - plane.x, dock.z - plane.z);
    plane.throttle = 0.35;
    plane.speed = 68;
    plane.alt = 24;
    plane.vspeed = -2;
    plane.landed = false;
    game.state = 'flying';
    return true;
  }
  if (name === 'complete') {
    missions.start('rings');
    missions.score = 1240;
    missions.timeLeft = 47;
    missions.ringIndex = 6; // all six rings flown, so the summary reads 6/6
    missions.complete = true;
    missions.message = 'MISSION COMPLETE — time bonus +235';
    missions.messageTimer = 6;
    for (const ring of world.rings) ring.passed = true;
    plane.reset(900, 1900, 0.6);
    plane.throttle = 0.55;
    plane.speed = 180;
    plane.alt = 190;
    plane.landed = false;
    game.state = 'complete';
    return true;
  }
  return false;
}
