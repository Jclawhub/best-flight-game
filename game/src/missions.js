// missions.js — the four sorties: Ring Run, Island Hop, Mail Drop, Rescue Run.
// Each runs on a 180 s timer; score, objectives and failure reasons live here
// so the HUD and the CDP autopilot both read the same truth.

export const SORTIE_SECONDS = 180;
export const RING_PASS_DIST = 18;   // 3D metres to a ring centre
export const DOCK_LAND_DIST = 25;   // 2D metres to a dock centre
export const CRATE_HIT_DIST = 25;   // 2D metres to a mail dock centre

export function createMissions(world) {
  return {
    world,
    id: null,            // 'rings' | 'hop' | 'mail' | 'rescue'
    score: 0,
    timeLeft: SORTIE_SECONDS,
    complete: false,
    failed: false,
    failReason: '',
    ringIndex: 0,
    dockIndex: 0,
    dropIndex: 0,
    rescued: false,      // rescue: sailor aboard
    crates: [],          // falling mail crates {x,y,z,vx,vy,vz}
    lastCountedLanding: 0,
    toast: '',           // transient banner text for the HUD
    toastTimer: 0,
  };
}

export function missionName(id) {
  return {
    rings: 'Ring Run',
    hop: 'Island Hop',
    mail: 'Mail Drop',
    rescue: 'Rescue Run',
  }[id] || id;
}

export function startMission(m, id, plane) {
  m.id = id;
  m.score = 0;
  m.timeLeft = SORTIE_SECONDS;
  m.complete = false;
  m.failed = false;
  m.failReason = '';
  m.ringIndex = 0;
  m.dockIndex = 0;
  m.dropIndex = 0;
  m.rescued = false;
  m.crates = [];
  m.lastCountedLanding = plane.landings;
  m.toast = '';
  m.toastTimer = 0;
}

function setToast(m, text, seconds = 3) {
  m.toast = text;
  m.toastTimer = seconds;
}

// Current objective for the autopilot and the compass ribbon.
// Returns { x, y, z, label } or null when the mission is over.
export function getObjective(m) {
  const w = m.world;
  if (m.complete || m.failed || !m.id) return null;
  if (m.id === 'rings') {
    const r = w.rings[m.ringIndex];
    if (!r) return null;
    return { x: r.x, y: r.y, z: r.z, label: `Ring ${m.ringIndex + 1}/6` };
  }
  if (m.id === 'hop') {
    const d = w.hopDocks[m.dockIndex];
    if (!d) return null;
    return { x: d.x, y: 0, z: d.z, label: `${d.label} — land on the water` };
  }
  if (m.id === 'mail') {
    const d = w.mailDocks[m.dropIndex];
    if (!d) return null;
    return { x: d.x, y: 0, z: d.z, label: `${d.label} — drop the crate` };
  }
  // rescue
  if (!m.rescued) {
    return { x: w.raft.x, y: 0, z: w.raft.z, label: 'Raft — land and pick up the sailor' };
  }
  return { x: w.mainDock.x, y: 0, z: w.mainDock.z, label: 'Main Dock — deliver the sailor' };
}

// Drop a mail crate from the plane; returns the crate.
export function dropCrate(m, plane) {
  const speedMs = plane.speed / 3.6;
  const crate = {
    x: plane.x, y: Math.max(2, plane.alt), z: plane.z,
    vx: Math.sin(plane.heading) * speedMs,
    vy: 0,
    vz: Math.cos(plane.heading) * speedMs,
  };
  m.crates.push(crate);
  return crate;
}

function fail(m, reason) {
  if (m.complete || m.failed) return;
  m.failed = true;
  m.failReason = reason;
}

function finish(m) {
  m.complete = true;
  setToast(m, `Mission complete! Score ${m.score}`, 6);
}

// A water landing happened (plane.landings advanced). Returns 'counted'
// when it scores, 'hard' when the touchdown itself was too rough to count
// (taxiing cannot fix a hard touchdown), or 'far' when the touchdown was
// clean but outside the dock — the plane may still taxi into range.
function onLanding(m, plane) {
  if (!m.id || m.complete || m.failed) return 'far';
  const obj = getObjective(m);
  if (!obj) return 'far';
  const dist = Math.hypot(plane.x - obj.x, plane.z - obj.z);
  if (dist > DOCK_LAND_DIST) return 'far';
  const clean = plane.lastLandSpeed <= 85 && plane.lastLandSink >= -6.0;
  if (!clean) {
    setToast(m, 'Hard landing — no points', 2.5);
    return 'hard';
  }
  if (m.id === 'hop') {
    m.score += 150;
    setToast(m, `Clean landing! +150`, 3);
    m.dockIndex += 1;
    if (m.dockIndex >= m.world.hopDocks.length) finish(m);
    return 'counted';
  } else if (m.id === 'rescue' && !m.rescued) {
    m.rescued = true;
    m.score += 100;
    setToast(m, 'Sailor aboard! +100 — deliver him to Main Dock', 3.5);
    return 'counted';
  } else if (m.id === 'rescue' && m.rescued) {
    m.score += 200;
    setToast(m, 'Sailor delivered! +200', 3);
    finish(m);
    return 'counted';
  }
  return 'far';
}

export function updateMissions(m, plane, dt, events) {
  if (!m.id || m.complete || m.failed) return;
  m.timeLeft -= dt;
  if (m.toastTimer > 0) m.toastTimer -= dt;
  if (m.timeLeft <= 0) {
    m.timeLeft = 0;
    fail(m, 'Time up');
    return;
  }
  if (plane.fuel <= 0) {
    fail(m, 'Out of fuel');
    return;
  }
  if (plane.damage >= 100) {
    fail(m, 'Crashed');
    return;
  }

  // New touchdown, or a touchdown that is still sitting on the water?
  // A landing counts when the plane is on the water within 25 m of the
  // objective at ANY point during that touchdown — a seaplane that touches
  // down 30 m short and taxis into the dock has still landed at the dock.
  // A counted or hard touchdown spends the chance; a clean one out of
  // range keeps taxiing. The guard resets when the plane takes off again.
  if (!plane.landed) {
    m.lastCountedLanding = plane.landings;
  } else if (plane.landings !== m.lastCountedLanding) {
    const result = onLanding(m, plane);
    if (result === 'counted' || result === 'hard') {
      m.lastCountedLanding = plane.landings;
    }
    if (m.complete || m.failed) return;
  }

  // Ring Run: pass within 18 m of the ring centre in 3D.
  if (m.id === 'rings') {
    const r = m.world.rings[m.ringIndex];
    if (r) {
      const d = Math.hypot(plane.x - r.x, plane.alt - r.y, plane.z - r.z);
      if (d < RING_PASS_DIST) {
        m.score += 100;
        m.ringIndex += 1;
        setToast(m, `Ring ${m.ringIndex}/6! +100`, 2);
        if (events?.onRing) events.onRing(m.ringIndex);
        if (m.ringIndex >= m.world.rings.length) finish(m);
      }
    }
  }

  // Mail crates: heavy drag, fast fall; a hit counts within 25 m of the
  // current village dock. The drag is strong (k=3) so the crate lands
  // close to where it was dropped, not hundreds of metres downrange.
  for (let i = m.crates.length - 1; i >= 0; i--) {
    const c = m.crates[i];
    c.vy -= 9.8 * dt;
    const drag = Math.exp(-3.0 * dt);
    c.vx *= drag;
    c.vz *= drag;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt;
    if (c.y <= 0) {
      c.y = 0;
      const d = m.world.mailDocks[m.dropIndex];
      if (d && Math.hypot(c.x - d.x, c.z - d.z) < CRATE_HIT_DIST) {
        m.score += 120;
        m.dropIndex += 1;
        setToast(m, `Mail delivered! +120`, 3);
        if (events?.onDrop) events.onDrop(m.dropIndex);
        if (m.dropIndex >= m.world.mailDocks.length) finish(m);
      } else if (events?.onSplash) {
        events.onSplash();
      }
      m.crates.splice(i, 1);
    }
  }
}
