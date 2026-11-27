// Senja Amphibi — world: seeded archipelago, mission geography, sun.
// Vanilla JS, no network, no build step.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_BOUNDS = { minX: -3000, maxX: 3000, minZ: -800, maxZ: 4200 };
export const START_POS = { x: 0, z: 0 };

// Ring course: x, z, height in metres. Heading 0 means +z (north).
export const RING_COURSE = [
  { x: 150, z: 600, y: 110 },
  { x: -250, z: 1150, y: 95 },
  { x: 300, z: 1700, y: 120 },
  { x: -350, z: 2250, y: 100 },
  { x: 200, z: 2800, y: 115 },
  { x: 0, z: 3350, y: 105 },
];

export const HOP_DOCKS = [
  { x: 520, z: 1250 },
  { x: -720, z: 2450 },
  { x: 350, z: 3650 },
];

export const MAIL_VILLAGES = [
  { x: -850, z: 1050 },
  { x: 950, z: 2250 },
  { x: -420, z: 3350 },
];

export const RESCUE_RAFT = { x: 700, z: 1750 };
export const MAIN_DOCK = { x: -260, z: 650 };

export const SUN_BEARING = -0.55;

const FIXED_ISLANDS = [
  { x: -1900, z: 2900, r: 430, h: 175, type: 'volcano' },
  { x: 1750, z: 900, r: 260, h: 34, type: 'atoll' },
  { x: -1650, z: 600, r: 300, h: 58, type: 'green' },
  { x: 1500, z: 3200, r: 330, h: 64, type: 'green' },
];

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Keep-out circles around every patch of mission water, so no island can
// ever sit on a ring line, a dock, a village, the raft or the start.
function clearOfMissions(x, z, r) {
  const spots = [
    { x: START_POS.x, z: START_POS.z, pad: 260 },
    { x: MAIN_DOCK.x, z: MAIN_DOCK.z, pad: 170 },
    { x: RESCUE_RAFT.x, z: RESCUE_RAFT.z, pad: 170 },
  ];
  for (const ring of RING_COURSE) spots.push({ x: ring.x, z: ring.z, pad: 200 });
  for (const d of HOP_DOCKS) spots.push({ x: d.x, z: d.z, pad: 170 });
  for (const v of MAIL_VILLAGES) spots.push({ x: v.x, z: v.z, pad: 170 });
  for (const s of spots) {
    const need = r + s.pad;
    if (dist2(x, z, s.x, s.z) < need * need) return false;
  }
  return true;
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const islands = FIXED_ISLANDS.map((i) => ({ ...i }));
  let guard = 0;
  while (islands.length < 18 && guard < 3000) {
    guard += 1;
    const x = -2800 + rng() * 5600;
    const z = -600 + rng() * 4600;
    const r = 130 + rng() * 190;
    const h = 26 + rng() * 42;
    if (!clearOfMissions(x, z, r)) continue;
    let clash = false;
    for (const o of islands) {
      const need = r + o.r + 90;
      if (dist2(x, z, o.x, o.z) < need * need) { clash = true; break; }
    }
    if (clash) continue;
    // Small islands read as sand, big ones as green; the atoll and the
    // volcano are the only fixed shapes.
    islands.push({ x, z, r, h, type: rng() < 0.3 ? 'sand' : 'green' });
  }
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: -2800 + rng() * 5600,
      z: -600 + rng() * 4600,
      y: 300 + rng() * 220,
      r: 90 + rng() * 160,
      drift: 2 + rng() * 4,
    });
  }
  return {
    seed,
    bounds: WORLD_BOUNDS,
    islands,
    clouds,
    rings: RING_COURSE.map((r) => ({ ...r })),
    hopDocks: HOP_DOCKS.map((d) => ({ ...d })),
    mailVillages: MAIL_VILLAGES.map((v) => ({ ...v })),
    raft: { ...RESCUE_RAFT },
    mainDock: { ...MAIN_DOCK },
    startPos: { ...START_POS },
    sunBearing: SUN_BEARING,
  };
}
