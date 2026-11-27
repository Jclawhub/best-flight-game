// world.js — the archipelago: seeded island layout, heightmap terrain, animated
// water, gradient sky, clouds, palms, huts, docks, rescue raft and target rings.
// Everything is built from the gl.js mesh helpers; nothing is loaded from disk.

import {
  newMesh, addBox, addCylinder, addCone, addSphere, addTorus, addGrid,
  mergeMeshes, uploadMesh,
} from './gl.js';

// Deterministic RNG so ?seed=1 always builds the same world.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SUN_DIR = (() => {
  const v = [-0.42, 0.30, 0.72];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

export const FOG_COLOR = [0.96, 0.68, 0.47];
export const WORLD_HALF = 3400; // terrain spans -3400..3400 m

// Island layout: main island near the origin, hop/mail islands around it,
// plus scenery islands so the horizon never looks empty.
export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const islands = [
    { x: 0, z: 0, r: 330, h: 48, name: 'Main' },
    { x: -1450, z: 900, r: 300, h: 40, name: 'Palm' },
    { x: 150, z: 2050, r: 320, h: 42, name: 'Lagoon' },
    { x: 1850, z: 950, r: 290, h: 36, name: 'Coral' },
    { x: -1650, z: -1250, r: 310, h: 44, name: 'Fisher' },
    { x: 550, z: -1950, r: 280, h: 34, name: 'Turtle' },
    { x: 1950, z: -1300, r: 300, h: 38, name: 'Spice' },
    { x: -2600, z: -400, r: 260, h: 30, name: 'Far West' },
    { x: 2600, z: 2200, r: 300, h: 40, name: 'Far East' },
    { x: 800, z: 2600, r: 240, h: 28, name: 'North' },
  ];

  // Docks sit in open water just off an island's shore. `pier` is the
  // heading from the dock toward its island, so the walkway points ashore.
  const mainDock = { x: 0, z: 430, label: 'Main Dock', pier: Math.PI };
  const hopDocks = [
    { x: -1180, z: 640, label: 'Dock 1 · Palm', pier: -0.81 },
    { x: 350, z: 1750, label: 'Dock 2 · Lagoon', pier: -0.59 },
    { x: 1580, z: 1180, label: 'Dock 3 · Coral', pier: 2.28 },
  ];
  const mailDocks = [
    { x: -1350, z: -1000, label: 'Village · Fisher', pier: -2.26 },
    { x: 750, z: -1650, label: 'Village · Turtle', pier: -2.55 },
    { x: 1650, z: -1050, label: 'Village · Spice', pier: 2.27 },
  ];
  const raft = { x: -2200, z: 600, label: 'Raft' };

  // Rings form a loop around the start, altitudes 60–120 m.
  const rings = [
    { x: 700, y: 80, z: 300 },
    { x: -450, y: 100, z: 950 },
    { x: -1100, y: 70, z: 350 },
    { x: -750, y: 110, z: -650 },
    { x: 250, y: 90, z: -950 },
    { x: 950, y: 120, z: -250 },
  ];

  // Smooth island bump: 1 at the centre, 0 at the shore, with a little
  // seeded wobble so no two islands share a silhouette.
  function islandBump(ix, iz, r, h, wob) {
    const dx = ix, dz = iz;
    const d = Math.hypot(dx, dz) / r;
    if (d >= 1) return 0;
    const s = Math.max(0, 1 - d * d);
    const wobble = 1 + 0.18 * Math.sin(d * 9 + wob) * Math.cos(Math.atan2(dz, dx) * 3 + wob);
    return h * Math.pow(s, 1.4) * wobble;
  }

  const wobbles = islands.map(() => rng() * Math.PI * 2);

  function terrainHeight(x, z) {
    let h = -3; // seabed
    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      h += islandBump(x - isl.x, z - isl.z, isl.r, isl.h, wobbles[i]);
    }
    // Gentle swell noise on land only.
    if (h > 0) {
      h += 1.6 * Math.sin(x * 0.013 + 2.1) * Math.cos(z * 0.011 - 1.3);
      h += 0.8 * Math.sin(x * 0.031 - z * 0.027);
    }
    return h;
  }

  function terrainColor(x, z, h) {
    const n = 0.92 + 0.08 * Math.sin(x * 0.11 + z * 0.13);
    if (h < 0.6) return [0.78 * n, 0.70 * n, 0.48 * n]; // sand
    if (h < 14) return [0.24 * n, 0.46 * n, 0.20 * n]; // low grass
    if (h < 30) return [0.30 * n, 0.52 * n, 0.24 * n]; // high grass
    return [0.42 * n, 0.36 * n, 0.30 * n]; // rock
  }

  // Palm / hut placement per island, from the seeded RNG.
  const palms = [];
  const huts = [];
  for (const isl of islands) {
    const nPalm = isl.r > 280 ? 7 : 5;
    for (let i = 0; i < nPalm; i++) {
      const a = rng() * Math.PI * 2;
      const rr = isl.r * (0.25 + rng() * 0.55);
      const px = isl.x + Math.cos(a) * rr;
      const pz = isl.z + Math.sin(a) * rr;
      const h = terrainHeight(px, pz);
      if (h > 2 && h < isl.h * 0.7) {
        palms.push({ x: px, z: pz, y: h, lean: (rng() - 0.5) * 0.25, s: 0.8 + rng() * 0.5 });
      }
    }
    const nHut = isl.name === 'Main' ? 4 : 2;
    for (let i = 0; i < nHut; i++) {
      const a = rng() * Math.PI * 2;
      const rr = isl.r * (0.55 + rng() * 0.25);
      const px = isl.x + Math.cos(a) * rr;
      const pz = isl.z + Math.sin(a) * rr;
      const h = terrainHeight(px, pz);
      if (h > 1.5 && h < 12) huts.push({ x: px, z: pz, y: h, rot: rng() * Math.PI * 2 });
    }
  }

  // Clouds drift slowly; each is a few flattened spheres.
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    clouds.push({
      x: (rng() - 0.5) * 6000,
      y: 260 + rng() * 220,
      z: (rng() - 0.5) * 6000,
      s: 60 + rng() * 90,
      drift: 1.5 + rng() * 2,
    });
  }

  const world = {
    islands, mainDock, hopDocks, mailDocks, raft, rings,
    palms, huts, clouds, terrainHeight, terrainColor,
    seed,
  };
  return world;
}

// ---------------- static geometry ----------------
function buildDockMesh(b, dock, rng) {
  // Wooden pier: a walkway out from the dock toward the island shore plus
  // posts, a floating marker ring lying flat at the landing spot and a
  // tall orange pennant pole.
  const wood = [0.45, 0.30, 0.16];
  const woodDark = [0.36, 0.23, 0.12];
  // Pier runs from the dock point 26 m toward the dock's island.
  const toward = dock.pier || 0;
  const px = Math.sin(toward), pz = Math.cos(toward);
  const cx = dock.x + px * 14, cz = dock.z + pz * 14;
  const w = 4, len = 30;
  const rot = (lx, lz) => [cx + lx * Math.cos(toward) + lz * Math.sin(toward),
    cz - lx * Math.sin(toward) + lz * Math.cos(toward)];
  // Walkway as a yawed box.
  addYawBox(b, cx, 1.2, cz, w, 1.0, len, toward, wood);
  for (let i = -1; i <= 1; i++) {
    const [ox, oz] = rot(i * 12, 0);
    addCylinder(b, ox, 0.6, oz, 0.35, 0.35, 2.4, 6, woodDark);
  }
  // Floating marker ring at the landing spot, lying flat on the water.
  // The torus is built in the XY plane (hole along Z); rotate it 90° about
  // X so the hole points up, then place it at the dock.
  const flat = newMesh();
  addTorus(flat, 0, 0, 0, 10, 0.9, 20, 6, [1.0, 0.55, 0.1]);
  for (let i = 0; i < flat.pos.length; i += 3) {
    const y = flat.pos[i + 1], z = flat.pos[i + 2];
    flat.pos[i] += dock.x;
    flat.pos[i + 1] = 0.4 + z;
    flat.pos[i + 2] = dock.z - y;
    const ny = flat.norm[i + 1], nz = flat.norm[i + 2];
    flat.norm[i + 1] = nz;
    flat.norm[i + 2] = -ny;
  }
  const off = b.pos.length / 3;
  b.pos.push(...flat.pos);
  b.norm.push(...flat.norm);
  b.col.push(...flat.col);
  for (const i of flat.idx) b.idx.push(i + off);
  // Pennant pole + flag.
  addCylinder(b, dock.x + 12, 4, dock.z, 0.18, 0.22, 8, 6, [0.7, 0.7, 0.72]);
  addBox(b, dock.x + 12, 7.2, dock.z, 0.2, 1.6, 3.2, [1.0, 0.45, 0.1]);
  void rng;
}

// A box rotated by yaw around Y, centred at (cx, cy, cz).
function addYawBox(b, cx, cy, cz, w, h, d, yaw, col) {
  const m = newMesh();
  addBox(m, 0, 0, 0, w, h, d, col);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < m.pos.length; i += 3) {
    const lx = m.pos[i], ly = m.pos[i + 1], lz = m.pos[i + 2];
    m.pos[i] = cx + lx * c + lz * s;
    m.pos[i + 1] = cy + ly;
    m.pos[i + 2] = cz - lx * s + lz * c;
    const nx = m.norm[i], nz = m.norm[i + 2];
    m.norm[i] = nx * c + nz * s;
    m.norm[i + 2] = -nx * s + nz * c;
  }
  const off = b.pos.length / 3;
  b.pos.push(...m.pos);
  b.norm.push(...m.norm);
  b.col.push(...m.col);
  for (const i of m.idx) b.idx.push(i + off);
}

export function buildStaticMesh(world) {
  const rng = mulberry32(world.seed + 77);
  const parts = [];

  // Terrain heightmap.
  const terrain = newMesh();
  addGrid(terrain, -WORLD_HALF, WORLD_HALF, -WORLD_HALF, WORLD_HALF, 96,
    world.terrainHeight, world.terrainColor);
  parts.push(terrain);

  // Palms: leaning trunk + flattened canopy sphere.
  for (const p of world.palms) {
    const m = newMesh();
    const trunkH = 7 * p.s;
    addCylinder(m, 0, trunkH / 2, 0, 0.28 * p.s, 0.45 * p.s, trunkH, 6, [0.42, 0.28, 0.14]);
    addSphere(m, 0, trunkH + 1.2 * p.s, 0, 3.4 * p.s, 6, 8, [0.16, 0.42, 0.14], 0.55);
    addSphere(m, 2.2 * p.s, trunkH + 0.4 * p.s, 0.8 * p.s, 2.2 * p.s, 5, 7, [0.2, 0.5, 0.16], 0.5);
    addSphere(m, -2.0 * p.s, trunkH + 0.5 * p.s, -0.9 * p.s, 2.0 * p.s, 5, 7, [0.18, 0.46, 0.15], 0.5);
    // Lean the whole palm slightly and move it into place.
    const c = Math.cos(p.lean), s = Math.sin(p.lean);
    for (let i = 0; i < m.pos.length; i += 3) {
      const lx = m.pos[i], ly = m.pos[i + 1], lz = m.pos[i + 2];
      m.pos[i] = p.x + lx * c + ly * s * 0.4;
      m.pos[i + 1] = p.y + ly * c - lx * s * 0.4;
      m.pos[i + 2] = p.z + lz;
    }
    parts.push(m);
  }

  // Huts: stilt box + pyramid roof.
  for (const h of world.huts) {
    const m = newMesh();
    addBox(m, 0, 2.2, 0, 5, 3.4, 4.4, [0.62, 0.45, 0.26]);
    addCone(m, 0, 5.6, 0, 4.2, 3.2, 4, [0.75, 0.35, 0.16]);
    addBox(m, 0, 0.4, 0, 4.4, 0.8, 3.8, [0.4, 0.27, 0.14]);
    const c = Math.cos(h.rot), s = Math.sin(h.rot);
    for (let i = 0; i < m.pos.length; i += 3) {
      const lx = m.pos[i], ly = m.pos[i + 1], lz = m.pos[i + 2];
      m.pos[i] = h.x + lx * c + lz * s;
      m.pos[i + 1] = h.y + ly;
      m.pos[i + 2] = h.z - lx * s + lz * c;
    }
    parts.push(m);
  }

  // Docks.
  const dockMesh = newMesh();
  buildDockMesh(dockMesh, world.mainDock, rng);
  for (const d of world.hopDocks) buildDockMesh(dockMesh, d, rng);
  for (const d of world.mailDocks) buildDockMesh(dockMesh, d, rng);
  parts.push(dockMesh);

  // Rescue raft: plank platform, barrel, tall mast, big red SOS flag.
  // Deliberately oversized so it reads from 100+ m away in the air.
  const raft = newMesh();
  addBox(raft, world.raft.x, 0.5, world.raft.z, 9, 0.8, 6, [0.55, 0.38, 0.2]);
  addBox(raft, world.raft.x, 1.0, world.raft.z, 7.5, 0.5, 4.8, [0.65, 0.48, 0.26]);
  addCylinder(raft, world.raft.x + 2.8, 1.0, world.raft.z + 1.5, 0.8, 0.8, 1.6, 8, [0.8, 0.25, 0.15]);
  addCylinder(raft, world.raft.x, 6.5, world.raft.z, 0.2, 0.26, 12, 6, [0.7, 0.7, 0.72]);
  addBox(raft, world.raft.x, 11, world.raft.z, 0.24, 2.4, 5.2, [0.95, 0.12, 0.12]);
  parts.push(raft);

  return mergeMeshes(parts);
}

export function buildWaterMesh() {
  const b = newMesh();
  addGrid(b, -4200, 4200, -4200, 4200, 48,
    () => 0,
    () => [0.07, 0.32, 0.42]);
  return b;
}

export function buildSkyMesh() {
  const b = newMesh();
  addSphere(b, 0, 0, 0, 1, 12, 16, [1, 1, 1]);
  return b;
}

export function buildCloudMesh(world) {
  const parts = [];
  for (const c of world.clouds) {
    const m = newMesh();
    addSphere(m, 0, 0, 0, c.s * 0.5, 6, 8, [1.0, 0.92, 0.85], 0.42);
    addSphere(m, c.s * 0.42, -c.s * 0.04, c.s * 0.1, c.s * 0.34, 6, 8, [1.0, 0.93, 0.86], 0.42);
    addSphere(m, -c.s * 0.4, -c.s * 0.05, -c.s * 0.08, c.s * 0.32, 6, 8, [0.98, 0.9, 0.84], 0.42);
    for (let i = 0; i < m.pos.length; i += 3) {
      m.pos[i] += c.x;
      m.pos[i + 1] += c.y;
      m.pos[i + 2] += c.z;
    }
    parts.push(m);
  }
  return mergeMeshes(parts);
}

export function buildRingMesh() {
  const b = newMesh();
  // Torus lies in XY; rotate it to stand vertical facing the ring's
  // approach: the render code applies a yaw model matrix, so the mesh
  // itself is built in the XY plane (hole along Z).
  addTorus(b, 0, 0, 0, 16, 1.3, 28, 8, [1.0, 0.55, 0.1]);
  return b;
}

// Sailor figure (drawn separately so his arm can wave). Built at origin,
// standing on the raft; main.js positions him with a model matrix.
export function buildSailorMesh() {
  const b = newMesh();
  // Orange life-vest body.
  addCylinder(b, 0, 0.9, 0, 0.42, 0.5, 1.1, 8, [0.95, 0.45, 0.1]);
  // Head.
  addSphere(b, 0, 1.75, 0, 0.34, 6, 8, [0.85, 0.62, 0.45]);
  // Cap.
  addSphere(b, 0, 1.95, 0, 0.36, 4, 8, [0.95, 0.85, 0.2], 0.5);
  // Legs.
  addCylinder(b, -0.2, 0.25, 0, 0.14, 0.16, 0.6, 6, [0.2, 0.25, 0.4]);
  addCylinder(b, 0.2, 0.25, 0, 0.14, 0.16, 0.6, 6, [0.2, 0.25, 0.4]);
  // Left arm resting.
  addCylinder(b, -0.55, 0.95, 0, 0.11, 0.11, 0.9, 6, [0.85, 0.62, 0.45]);
  return b;
}

// Waving right arm, drawn separately with a rotating model matrix.
export function buildArmMesh() {
  const b = newMesh();
  addCylinder(b, 0, 0.45, 0, 0.11, 0.11, 0.95, 6, [0.85, 0.62, 0.45]);
  return b;
}

// Volcano on Palm island — the landmark the cockpit cover was missing.
// Rock cone with a snow cap and a wisp of smoke, rising above the
// island's own hill so it reads as a peak from a kilometre away.
export function buildVolcanoMesh(world) {
  const b = newMesh();
  const palm = world.islands.find((i) => i.name === 'Palm');
  const vx = palm.x, vz = palm.z;
  // Rock cone: base buried in the island hill, apex ~155 m up.
  addCone(b, vx, 85, vz, 110, 140, 10, [0.38, 0.32, 0.28]);
  // Snow cap: a smaller cone hugging the peak, slightly proud of the rock.
  addCone(b, vx, 140, vz, 27, 30, 8, [0.95, 0.95, 0.97]);
  // Smoke wisp drifting off the crater.
  addSphere(b, vx + 12, 168, vz - 8, 10, 5, 7, [0.85, 0.82, 0.78]);
  addSphere(b, vx + 22, 178, vz - 16, 7, 5, 7, [0.88, 0.85, 0.81]);
  return b;
}

// Small fishing boat with an outrigger, anchored in the ring-2 approach
// lane off Palm island — the "someone lives here" detail in the cover.
export function buildBoatMesh() {
  const b = newMesh();
  const bx = -800, bz = 900;
  const wood = [0.45, 0.30, 0.16];
  const woodDark = [0.36, 0.23, 0.12];
  // Hull: long axis north–south so the cockpit camera, east of the boat,
  // sees the broad side. Bow rises slightly at the north end.
  addBox(b, bx, 0.7, bz, 3.2, 1.2, 11, wood);
  addBox(b, bx, 1.1, bz - 5.2, 2.6, 0.9, 2.2, woodDark);
  addBox(b, bx, 1.35, bz, 3.4, 0.25, 9, [0.75, 0.6, 0.4]);
  // Outrigger float to the west, on two cross-arms.
  addBox(b, bx - 4.5, 0.35, bz, 0.5, 0.5, 9, woodDark);
  addBox(b, bx - 2.4, 0.9, bz - 2.5, 4.6, 0.25, 0.3, woodDark);
  addBox(b, bx - 2.4, 0.9, bz + 2.5, 4.6, 0.25, 0.3, woodDark);
  // Mast + white sail, broad face toward the camera (east).
  addCylinder(b, bx, 6, bz, 0.12, 0.16, 9, 6, woodDark);
  addBox(b, bx, 6.5, bz, 0.25, 7, 5, [0.95, 0.93, 0.88]);
  // A slight yaw so the boat does not sit perfectly axis-aligned.
  const a = 0.25, c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < b.pos.length; i += 3) {
    const lx = b.pos[i] - bx, lz = b.pos[i + 2] - bz;
    b.pos[i] = bx + lx * c + lz * s;
    b.pos[i + 2] = bz - lx * s + lz * c;
    const nx = b.norm[i], nz = b.norm[i + 2];
    b.norm[i] = nx * c + nz * s;
    b.norm[i + 2] = -nx * s + nz * c;
  }
  return b;
}

// Upload all world meshes; returns { static, water, sky, clouds, ring, sailor, arm, volcano, boat }.
export function uploadWorld(gl, world) {
  return {
    static: uploadMesh(gl, buildStaticMesh(world)),
    water: uploadMesh(gl, buildWaterMesh()),
    sky: uploadMesh(gl, buildSkyMesh()),
    clouds: uploadMesh(gl, buildCloudMesh(world)),
    ring: uploadMesh(gl, buildRingMesh()),
    sailor: uploadMesh(gl, buildSailorMesh()),
    arm: uploadMesh(gl, buildArmMesh()),
    volcano: uploadMesh(gl, buildVolcanoMesh(world)),
    boat: uploadMesh(gl, buildBoatMesh()),
  };
}
