// Senja Amphibi — a 2D canvas seaplane game over an Indonesian archipelago
// at golden hour. Fresh build for round 2 of best-flight-game-20261126-0057.
// The world: seeded islands, lagoons, docks, a ring course, drifting clouds.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keep-out circles: mission-critical water must stay clear of islands.
const KEEP_OUT = [
  { x: 0, z: 0, r: 220 },          // start water
  { x: 150, z: 600, r: 260 }, { x: -250, z: 1150, r: 260 },
  { x: 300, z: 1700, r: 260 }, { x: -350, z: 2250, r: 260 },
  { x: 200, z: 2800, r: 260 }, { x: 0, z: 3350, r: 260 }, // ring course
  { x: 520, z: 1250, r: 300 }, { x: -720, z: 2450, r: 300 },
  { x: 350, z: 3650, r: 300 }, // hop lagoon docks
  { x: -850, z: 1050, r: 300 }, { x: 950, z: 2250, r: 300 },
  { x: -420, z: 3350, r: 300 }, // mail villages
  { x: 700, z: 1750, r: 300 },  // rescue raft
  { x: -260, z: 650, r: 300 },  // main dock
];

export const RING_COURSE = [
  { x: 150, z: 600, y: 110, label: 'Ring 1' },
  { x: -250, z: 1150, y: 95, label: 'Ring 2' },
  { x: 300, z: 1700, y: 120, label: 'Ring 3' },
  { x: -350, z: 2250, y: 100, label: 'Ring 4' },
  { x: 200, z: 2800, y: 115, label: 'Ring 5' },
  { x: 0, z: 3350, y: 105, label: 'Ring 6' },
];

export const HOP_DOCKS = [
  { x: 520, z: 1250, label: 'Lagoon Dock 1' },
  { x: -720, z: 2450, label: 'Lagoon Dock 2' },
  { x: 350, z: 3650, label: 'Lagoon Dock 3' },
];

export const MAIL_VILLAGES = [
  { x: -850, z: 1050, label: 'Village 1' },
  { x: 950, z: 2250, label: 'Village 2' },
  { x: -420, z: 3350, label: 'Village 3' },
];

export const RESCUE_RAFT = { x: 700, z: 1750, label: 'Stranded Sailor' };
export const MAIN_DOCK = { x: -260, z: 650, label: 'Main Dock' };
export const START_POS = { x: 0, z: 0, heading: 0 };
export const WORLD_BOUNDS = { x: 3000, zMin: -800, zMax: 4200 };

function clearOfKeepOut(x, z, r) {
  for (const k of KEEP_OUT) {
    if (Math.hypot(x - k.x, z - k.z) < k.r + r + 130) return false;
  }
  return true;
}

export function buildWorld(seed = 7) {
  const rand = mulberry32(seed);
  const islands = [];
  // Hand-placed landmarks: a tall volcano silhouette and a sandy atoll.
  islands.push({
    x: -1900, z: 2900, r: 430, h: 175, kind: 'volcano',
    palms: [], smoke: true,
  });
  islands.push({
    x: 1750, z: 900, r: 260, h: 34, kind: 'atoll',
    palms: [{ a: 0.4, d: 0.6 }, { a: 2.1, d: 0.7 }, { a: 4.0, d: 0.55 }],
  });
  islands.push({
    x: -1650, z: 600, r: 300, h: 58, kind: 'green',
    palms: [{ a: 1.1, d: 0.7 }, { a: 3.3, d: 0.6 }, { a: 5.2, d: 0.75 }],
  });
  islands.push({
    x: 1500, z: 3200, r: 330, h: 64, kind: 'green',
    palms: [{ a: 0.2, d: 0.65 }, { a: 2.6, d: 0.7 }, { a: 4.4, d: 0.6 }],
  });
  // Scattered green islands, rejection-sampled away from the mission water.
  // Eighteen islands total keeps the archipelago dense without crowding it.
  let guard = 0;
  while (islands.length < 18 && guard < 500) {
    guard += 1;
    const x = (rand() * 2 - 1) * 2600;
    const z = -500 + rand() * 4400;
    const r = 130 + rand() * 190;
    const h = 26 + rand() * 42;
    if (!clearOfKeepOut(x, z, r)) continue;
    let clash = false;
    for (const isl of islands) {
      if (Math.hypot(x - isl.x, z - isl.z) < isl.r + r + 160) { clash = true; break; }
    }
    if (clash) continue;
    const palmCount = 2 + Math.floor(rand() * 5);
    const palms = [];
    for (let i = 0; i < palmCount; i++) {
      palms.push({ a: rand() * Math.PI * 2, d: 0.45 + rand() * 0.4 });
    }
    islands.push({ x, z, r, h, kind: rand() < 0.25 ? 'sand' : 'green', palms });
  }
  // Drifting clouds, high above the sea.
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: (rand() * 2 - 1) * 2800, z: -400 + rand() * 4200,
      y: 300 + rand() * 220, r: 90 + rand() * 160,
      drift: 3 + rand() * 5, puff: 0.6 + rand() * 0.8,
    });
  }
  return {
    seed, islands, clouds,
    sunBearing: -0.55, // low sun to the west-northwest, golden hour
    hopDocks: HOP_DOCKS, mailVillages: MAIL_VILLAGES,
    raft: RESCUE_RAFT, mainDock: MAIN_DOCK, rings: RING_COURSE,
  };
}
