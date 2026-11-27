// hud.js — the DOM HUD: top instrument strip, objective chip, compass ribbon,
// live minimap, toast banners, screens, and the seven lit cockpit gauges.
// All drawing is 2D canvas; the WebGL canvas stays underneath.

import { mat4Multiply, mat4TransformPoint } from './gl.js';

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const hud = {
    root: $('hud'),
    stats: {
      alt: $('stat-alt'), spd: $('stat-spd'), hdg: $('stat-hdg'),
      fuel: $('stat-fuel'), thr: $('stat-thr'), score: $('stat-score'),
      time: $('stat-time'),
    },
    objective: $('objective'),
    compass: $('compass'),
    minimap: $('minimap'),
    toast: $('toast'),
    cockpit: $('cockpit'),
    glare: $('glare'),
    markers: $('markers'),
    screens: {
      title: $('screen-title'),
      pause: $('screen-pause'),
      complete: $('screen-complete'),
      gameover: $('screen-gameover'),
    },
    completeTitle: $('complete-title'),
    completeScore: $('complete-score'),
    gameoverReason: $('gameover-reason'),
    gameoverScore: $('gameover-score'),
    gauges: {},
  };
  for (const name of ['horizon', 'airspeed', 'altimeter', 'compass', 'throttle', 'fuel', 'vspeed']) {
    hud.gauges[name] = $('gauge-' + name);
  }
  return hud;
}

function fmtTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function headingDeg(h) {
  let d = (h * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return d;
}

// ---- compass ribbon ----
function drawCompass(canvas, heading, objectiveBearing) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 14, 20, 0.72)';
  ctx.fillRect(0, 0, w, h);
  const pxPerDeg = w / 120; // 120° visible window
  const centre = headingDeg(heading);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px system-ui, sans-serif';
  for (let d = -60; d <= 60; d += 5) {
    let deg = Math.round(centre + d);
    const x = w / 2 + d * pxPerDeg;
    const norm = ((deg % 360) + 360) % 360;
    const major = norm % 30 === 0;
    const cardinal = norm % 90 === 0;
    ctx.strokeStyle = major ? '#ffd27a' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = major ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, h - 4);
    ctx.lineTo(x, h - (major ? 18 : 11));
    ctx.stroke();
    if (cardinal) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[norm];
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(label, x, 11);
    } else if (major) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(String(norm), x, 11);
    }
  }
  // Objective marker: a diamond at the relative bearing.
  if (objectiveBearing !== null && objectiveBearing !== undefined) {
    let rel = headingDeg(objectiveBearing - heading);
    if (rel > 180) rel -= 360;
    if (Math.abs(rel) <= 62) {
      const x = w / 2 + rel * pxPerDeg;
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x + 8, 29);
      ctx.lineTo(x, 36);
      ctx.lineTo(x - 8, 29);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Centre lubber line.
  ctx.fillStyle = '#fff';
  ctx.fillRect(w / 2 - 1, 0, 2, 6);
}

// ---- minimap ----
function drawMinimap(canvas, world, plane, objective, mission) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const S = w / 6800; // world 6800 m across -> canvas
  const toX = (x) => w / 2 + x * S;
  const toY = (z) => h / 2 + z * S;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(6, 32, 44, 0.85)';
  ctx.fillRect(0, 0, w, h);
  // Islands.
  for (const isl of world.islands) {
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath();
    ctx.arc(toX(isl.x), toY(isl.z), Math.max(2, isl.r * S), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9b078';
    ctx.beginPath();
    ctx.arc(toX(isl.x), toY(isl.z), Math.max(2, isl.r * S * 1.06), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Docks.
  const dockDot = (d, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(toX(d.x) - 3, toY(d.z) - 3, 6, 6);
  };
  dockDot(world.mainDock, '#ffd27a');
  for (const d of world.hopDocks) dockDot(d, '#ff7a1a');
  for (const d of world.mailDocks) dockDot(d, '#7ac8ff');
  // Raft.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(toX(world.raft.x), toY(world.raft.z), 4, 0, Math.PI * 2);
  ctx.fill();
  // Rings (faint circles).
  ctx.strokeStyle = 'rgba(255, 150, 40, 0.7)';
  ctx.lineWidth = 1;
  for (const r of world.rings) {
    ctx.beginPath();
    ctx.arc(toX(r.x), toY(r.z), 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Objective pulse.
  if (objective) {
    const pulse = 6 + 2 * Math.sin(Date.now() / 250);
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(objective.x), toY(objective.z), pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Plane arrow.
  const px = toX(plane.x), py = toY(plane.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  void mission;
}

// ---- cockpit gauges (small 2D canvases) ----
function gaugeFace(ctx, w, h, label) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0c1216';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  // Lit gold rim: the dials must read as glowing instruments, not dark discs.
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd27a';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h - 7);
}

function gaugeNeedle(ctx, w, h, angle, color = '#ff5a2a') {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -w / 2 + 12);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function gaugeTicks(ctx, w, h, min, max, step, valueToAngle) {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.fillStyle = '#e8f2f6';
  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let v = min; v <= max; v += step) {
    const a = valueToAngle(v);
    const x1 = w / 2 + Math.sin(a) * (w / 2 - 10);
    const y1 = h / 2 - Math.cos(a) * (w / 2 - 10);
    const x2 = w / 2 + Math.sin(a) * (w / 2 - 15);
    const y2 = h / 2 - Math.cos(a) * (w / 2 - 15);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const tx = w / 2 + Math.sin(a) * (w / 2 - 22);
    const ty = h / 2 - Math.cos(a) * (w / 2 - 22) + 3;
    ctx.fillText(String(v), tx, ty);
  }
}

function drawHorizon(canvas, bank, pitch) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  gaugeFace(ctx, w, h, 'ATT');
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-bank);
  const py = Math.max(-20, Math.min(20, pitch * 40));
  ctx.translate(0, py);
  ctx.fillStyle = '#2f7fc4';
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-w, 0, w * 2, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(w, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd27a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 12, h / 2);
  ctx.lineTo(w / 2 + 12, h / 2);
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2 + 5);
  ctx.stroke();
}

function drawDial(canvas, label, value, min, max, step, unit) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  gaugeFace(ctx, w, h, label);
  const toAngle = (v) => -Math.PI * 0.75 + ((v - min) / (max - min)) * Math.PI * 1.5;
  gaugeTicks(ctx, w, h, min, max, step, toAngle);
  gaugeNeedle(ctx, w, h, toAngle(Math.max(min, Math.min(max, value))));
  ctx.fillStyle = '#e8eef2';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(value)}${unit}`, w / 2, h / 2 + 16);
}

function drawCompassGauge(canvas, heading) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  gaugeFace(ctx, w, h, 'HDG');
  const deg = headingDeg(heading);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-heading);
  ctx.fillStyle = '#cfe3ea';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const [d, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
    const a = (d * Math.PI) / 180;
    ctx.fillText(label, Math.sin(a) * (w / 2 - 16), -Math.cos(a) * (w / 2 - 16) + 3);
  }
  ctx.strokeStyle = '#ff5a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -w / 2 + 8);
  ctx.lineTo(0, -w / 2 + 16);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e8eef2';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(deg)}°`, w / 2, h / 2 + 5);
}

function drawThrottleGauge(canvas, throttle) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  gaugeFace(ctx, w, h, 'THR');
  const bh = h - 26;
  const y0 = h - 12;
  ctx.fillStyle = '#1d2b33';
  ctx.fillRect(w / 2 - 7, 12, 14, bh);
  const fillH = bh * throttle;
  const grad = ctx.createLinearGradient(0, y0, 0, 12);
  grad.addColorStop(0, '#ff5a2a');
  grad.addColorStop(1, '#ffd27a');
  ctx.fillStyle = grad;
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 8;
  ctx.fillRect(w / 2 - 7, y0 - fillH, 14, fillH);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8eef2';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(throttle * 100)}%`, w / 2, h / 2 + 4);
}

// ---- ring marker (cockpit view only) ----
// Screen-space overlay on the full-screen #markers canvas: the target
// ring's number inside the ring, a golden light beam from the ring down
// to the water, and a glowing ellipse where the beam meets the sea —
// the same "find the ring at a glance" cue as a charted approach.
// The 3D ring itself is a plain torus, so the numeral and beam live here.
function drawRingMarker(canvas, game, world, missions) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth, h = window.innerHeight;
  const cw = Math.floor(w * dpr), ch = Math.floor(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (missions.id !== 'rings' || missions.ringIndex >= world.rings.length) return;
  const r = world.rings[missions.ringIndex];
  const vp = mat4Multiply(game.proj, game.view);
  const project = (x, y, z) => {
    const p = mat4TransformPoint(vp, x, y, z);
    if (p[3] <= 0) return null;
    const nx = p[0] / p[3], ny = p[1] / p[3];
    if (Math.abs(nx) > 1.05 || Math.abs(ny) > 1.05) return null;
    return [(nx * 0.5 + 0.5) * w, (0.5 - ny * 0.5) * h];
  };
  const c = project(r.x, r.y, r.z);
  if (!c) return;
  // Ring screen radius from the projected rim points (ring faces the
  // approach, so top and side projections both span ~the radius).
  const top = project(r.x, r.y + 16, r.z);
  const side = project(r.x + 16, r.y, r.z);
  let rad = 12;
  if (top) rad = Math.max(rad, Math.abs(top[1] - c[1]));
  if (side) rad = Math.max(rad, Math.abs(side[0] - c[0]));
  // Beam: golden shaft from the ring down to the water below it, fading
  // out toward the sea (the dashboard covers its foot in the frame).
  // The water point can fall just below the frame edge when the ring is
  // close (its projection is then null); clamp the beam's end to just
  // above the dashboard instead of dropping the beam entirely.
  const wp = project(r.x, 0, r.z);
  const beamEnd = Math.min(wp ? wp[1] : Infinity, h - 140);
  if (beamEnd > c[1]) {
    const bw = Math.max(6, rad * 0.16);
    const grad = ctx.createLinearGradient(0, c[1], 0, beamEnd);
    grad.addColorStop(0, 'rgba(255, 190, 80, 0.85)');
    grad.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(c[0] - bw / 2, c[1], bw, beamEnd - c[1]);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 170, 60, 0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255, 190, 80, 0.35)';
    ctx.fillRect(c[0] - bw / 4, c[1], bw / 2, beamEnd - c[1]);
    ctx.restore();
    // Glowing ellipse where the beam meets the water, when it lands
    // above the dashboard.
    if (wp && wp[1] < h - 150) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 190, 80, 0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255, 170, 60, 0.9)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(wp[0], wp[1], rad * 0.9, rad * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Numeral inside the ring, warm white with a dark outline so it reads
  // over sky and sea alike.
  const num = String(missions.ringIndex + 1);
  ctx.save();
  ctx.font = `900 ${Math.round(rad * 0.95)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(120, 40, 0, 0.9)';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(120, 40, 0, 0.85)';
  ctx.strokeText(num, c[0], c[1] + 1);
  ctx.fillStyle = '#fff3cf';
  ctx.fillText(num, c[0], c[1] + 1);
  ctx.restore();
}

// ---- main HUD update (called every animation frame) ----
export function updateHud(hud, game, plane, missions, world, viewMode) {
  const st = game.state;
  const inFlight = st === 'flying' || st === 'paused';
  hud.root.style.display = inFlight ? 'block' : 'none';
  if (!inFlight) return;

  hud.stats.alt.textContent = `${Math.round(plane.alt)} m`;
  hud.stats.spd.textContent = `${Math.round(plane.speed)} km/h`;
  hud.stats.hdg.textContent = `${Math.round(headingDeg(plane.heading))}°`;
  hud.stats.fuel.textContent = `${Math.round(plane.fuel)}%`;
  hud.stats.thr.textContent = `${Math.round(plane.throttle * 100)}%`;
  hud.stats.score.textContent = String(missions.score);
  hud.stats.time.textContent = fmtTime(missions.timeLeft);
  hud.stats.fuel.parentElement.classList.toggle('warn', plane.fuel < 25);
  hud.stats.time.parentElement.classList.toggle('warn', missions.timeLeft < 30);

  const obj = getObjectiveSafe(missions);
  if (obj) {
    const dist = Math.round(Math.hypot(plane.x - obj.x, plane.z - obj.z));
    hud.objective.textContent = `${obj.label} · ${dist} m`;
    hud.objective.style.display = 'block';
  } else {
    hud.objective.style.display = 'none';
  }

  // Cockpit view gets the full-width ribbon (like the round-3 cover);
  // chase view keeps the original 480 px strip so its screenshots do
  // not change. Swapping the canvas width clears it, but drawCompass
  // redraws it in the same frame.
  const wide = viewMode === 'cockpit';
  if (wide && hud.compass.width !== 1240) {
    hud.compass.width = 1240;
    hud.compass.classList.add('wide');
  } else if (!wide && hud.compass.width !== 480) {
    hud.compass.width = 480;
    hud.compass.classList.remove('wide');
  }
  const bearing = obj ? Math.atan2(obj.x - plane.x, obj.z - plane.z) : null;
  drawCompass(hud.compass, plane.heading, bearing);
  drawMinimap(hud.minimap, world, plane, obj, missions);

  // Toast banner.
  if (missions.toastTimer > 0 && missions.toast) {
    hud.toast.textContent = missions.toast;
    hud.toast.style.opacity = '1';
  } else {
    hud.toast.style.opacity = '0';
  }

  // Cockpit overlay only in cockpit view.
  const cockpit = viewMode === 'cockpit';
  hud.cockpit.style.display = cockpit ? 'block' : 'none';
  if (cockpit) {
    drawHorizon(hud.gauges.horizon, plane.bank, plane.pitch);
    drawDial(hud.gauges.airspeed, 'SPD', plane.speed, 0, 320, 80, '');
    drawDial(hud.gauges.altimeter, 'ALT', plane.alt, 0, 300, 100, '');
    drawCompassGauge(hud.gauges.compass, plane.heading);
    drawThrottleGauge(hud.gauges.throttle, plane.throttle);
    drawDial(hud.gauges.fuel, 'FUEL', plane.fuel, 0, 100, 25, '');
    drawDial(hud.gauges.vspeed, 'V/S', plane.vspeed, -10, 10, 5, '');
    drawRingMarker(hud.markers, game, world, missions);
  }
}

// getObjective lives in missions.js; avoid a circular import by reading the
// same fields here (kept in sync with missions.getObjective).
function getObjectiveSafe(missions) {
  const w = missions.world;
  if (missions.complete || missions.failed || !missions.id) return null;
  if (missions.id === 'rings') {
    const r = w.rings[missions.ringIndex];
    return r ? { x: r.x, y: r.y, z: r.z, label: `Ring ${missions.ringIndex + 1}/6` } : null;
  }
  if (missions.id === 'hop') {
    const d = w.hopDocks[missions.dockIndex];
    return d ? { x: d.x, y: 0, z: d.z, label: `${d.label} — land on the water` } : null;
  }
  if (missions.id === 'mail') {
    const d = w.mailDocks[missions.dropIndex];
    return d ? { x: d.x, y: 0, z: d.z, label: `${d.label} — drop the crate` } : null;
  }
  if (!missions.rescued) {
    return { x: w.raft.x, y: 0, z: w.raft.z, label: 'Raft — land and pick up the sailor' };
  }
  return { x: w.mainDock.x, y: 0, z: w.mainDock.z, label: 'Main Dock — deliver the sailor' };
}

export function showScreen(hud, name) {
  for (const [key, el] of Object.entries(hud.screens)) {
    el.style.display = key === name ? 'flex' : 'none';
  }
}

export function showComplete(hud, title, score, timeLeft) {
  hud.completeTitle.textContent = title;
  hud.completeScore.textContent = `Score ${score} · ${fmtTime(timeLeft)} left on the clock`;
  showScreen(hud, 'complete');
}

export function showGameOver(hud, reason, score) {
  hud.gameoverReason.textContent = reason;
  hud.gameoverScore.textContent = `Score ${score}`;
  showScreen(hud, 'gameover');
}
