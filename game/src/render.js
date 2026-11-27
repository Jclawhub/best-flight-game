// Senja Amphibi — chase-view renderer + cockpit frame.
// The SAME project() perspective drives both views; cockpit mode simply
// hides the plane model and frames the world with windscreen + dashboard.

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Project a world point into screen space from the plane's viewpoint.
// Returns {x, y, k, fwd} or null when behind the camera.
export function project(game, x, z, y) {
  const p = game.plane;
  const dx = x - p.x;
  const dz = z - p.z;
  const sinH = Math.sin(p.heading);
  const cosH = Math.cos(p.heading);
  const fwd = dx * sinH + dz * cosH;
  if (fwd < 10) return null;
  const lat = dx * cosH - dz * sinH;
  const k = 640 / fwd;
  const horizon = clamp(218 - p.vspeed * 2.5, 150, 280);
  return {
    x: 640 + lat * k,
    y: horizon + (p.alt + 6 - y) * k * 0.9,
    k,
    fwd,
    horizon,
  };
}

function horizonY(game) {
  return clamp(218 - game.plane.vspeed * 2.5, 150, 280);
}

function drawSky(ctx, game) {
  const horizon = horizonY(game);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2b1b4d');
  sky.addColorStop(0.4, '#8a2f5c');
  sky.addColorStop(0.68, '#e8703f');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, horizon + 1);
  // Low sun disc with glow, positioned by sun bearing vs heading.
  const p = game.plane;
  const rel = normAngle(game.world.sunBearing - p.heading);
  if (Math.abs(rel) < 1.4) {
    const sunX = 640 + Math.tan(rel) * 640;
    const sunY = horizon - 58;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.85)');
    glow.addColorStop(0.35, 'rgba(255, 170, 90, 0.35)');
    glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSea(ctx, game, time) {
  const horizon = horizonY(game);
  const sea = ctx.createLinearGradient(0, horizon, 0, 720);
  sea.addColorStop(0, '#f08a4b');
  sea.addColorStop(0.35, '#2a7d8c');
  sea.addColorStop(1, '#0d3d52');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, 1280, 720 - horizon);
  // Sun-glare streaks on the water.
  const p = game.plane;
  const rel = normAngle(game.world.sunBearing - p.heading);
  const sunX = 640 + Math.tan(clamp(rel, -1.2, 1.2)) * 640;
  ctx.fillStyle = 'rgba(255, 200, 110, 0.20)';
  for (let i = 0; i < 22; i++) {
    const w = 40 + hash(i) * 110;
    const x = sunX + (hash(i + 50) - 0.5) * 420;
    const y = horizon + 14 + hash(i + 100) * (700 - horizon - 20);
    ctx.fillRect(x - w / 2, y, w, 2.5);
  }
  // Drifting shimmer.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let i = 0; i < 60; i++) {
    const x = (hash(i + 200) * 1280 + time * (6 + hash(i) * 10)) % 1280;
    const y = horizon + 10 + hash(i + 300) * (700 - horizon - 14);
    ctx.fillRect(x, y, 26 + hash(i + 400) * 50, 2);
  }
}

function drawClouds(ctx, game) {
  const list = [];
  for (const c of game.world.clouds) {
    const pr = project(game, c.x, c.z, c.y);
    if (pr) list.push({ pr, c });
  }
  list.sort((a, b) => b.pr.fwd - a.pr.fwd);
  for (const { pr, c } of list) {
    const rx = c.r * pr.k;
    if (rx < 4) continue;
    ctx.fillStyle = 'rgba(255, 235, 220, 0.75)';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, rx, rx * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(pr.x - rx * 0.4, pr.y + rx * 0.06, rx * 0.55, rx * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(pr.x + rx * 0.42, pr.y + rx * 0.05, rx * 0.5, rx * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIsland(ctx, game, isl, pr) {
  const rx = isl.r * pr.k;
  if (rx < 3) return;
  const top = project(game, isl.x, isl.z, isl.h);
  const baseY = pr.y;
  const topY = top ? top.y : pr.y - rx * 0.25;
  const cy = (baseY + topY) / 2;
  const ry = Math.max(4, (baseY - topY) / 2 + rx * 0.12);
  // Sand rim.
  ctx.fillStyle = '#e8d5a0';
  ctx.beginPath();
  ctx.ellipse(pr.x, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isl.type === 'atoll') {
    // Sandy atoll: pale lagoon ring inside the rim.
    ctx.fillStyle = '#bfe8d8';
    ctx.beginPath();
    ctx.ellipse(pr.x, cy, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d5a0';
    ctx.beginPath();
    ctx.ellipse(pr.x, cy, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Green body.
  ctx.fillStyle = isl.type === 'volcano' ? '#3f7d4e' : '#4d9a58';
  ctx.beginPath();
  ctx.ellipse(pr.x, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(pr.x - rx * 0.2, cy - ry * 0.25, rx * 0.4, ry * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isl.type === 'volcano') {
    // Cone with a snow cap.
    const apexY = topY - rx * 0.55;
    ctx.fillStyle = '#5a4a6e';
    ctx.beginPath();
    ctx.moveTo(pr.x - rx * 0.55, cy);
    ctx.lineTo(pr.x, apexY);
    ctx.lineTo(pr.x + rx * 0.55, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f0ff';
    ctx.beginPath();
    ctx.moveTo(pr.x - rx * 0.16, apexY + rx * 0.22);
    ctx.lineTo(pr.x, apexY);
    ctx.lineTo(pr.x + rx * 0.16, apexY + rx * 0.22);
    ctx.lineTo(pr.x, apexY + rx * 0.34);
    ctx.closePath();
    ctx.fill();
  }
  // Palms when close enough to see them.
  if (pr.fwd < 700 && rx > 26) {
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = Math.max(1.5, rx * 0.02);
    for (const off of [-0.35, 0.3]) {
      const px = pr.x + off * rx;
      const py = cy - ry * 0.2;
      const hgt = rx * 0.22;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + rx * 0.03, py - hgt);
      ctx.stroke();
      ctx.strokeStyle = '#2f7d3a';
      ctx.beginPath();
      ctx.moveTo(px + rx * 0.03, py - hgt);
      ctx.quadraticCurveTo(px - rx * 0.12, py - hgt - rx * 0.06, px - rx * 0.16, py - hgt + rx * 0.02);
      ctx.moveTo(px + rx * 0.03, py - hgt);
      ctx.quadraticCurveTo(px + rx * 0.14, py - hgt - rx * 0.06, px + rx * 0.18, py - hgt + rx * 0.02);
      ctx.stroke();
      ctx.strokeStyle = '#7a5230';
    }
  }
}

function drawIslands(ctx, game) {
  const list = [];
  for (const isl of game.world.islands) {
    const pr = project(game, isl.x, isl.z, 0);
    if (pr) list.push({ isl, pr });
  }
  list.sort((a, b) => b.pr.fwd - a.pr.fwd);
  for (const { isl, pr } of list) drawIsland(ctx, game, isl, pr);
}

function drawBeacon(ctx, game) {
  const o = game.missions.getObjective();
  if (!o) return;
  const base = project(game, o.x, o.z, 0);
  const top = project(game, o.x, o.z, 150);
  if (!base || !top) return;
  const w = Math.max(8, 14 * base.k);
  const grad = ctx.createLinearGradient(0, top.y, 0, base.y);
  grad.addColorStop(0, 'rgba(255, 211, 77, 0.05)');
  grad.addColorStop(1, 'rgba(255, 211, 77, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
  // Pulsing ring on the water at the objective.
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  ctx.strokeStyle = `rgba(255, 211, 77, ${0.5 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 26 * base.k, 8 * base.k, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDock(ctx, game, x, z, village) {
  const pr = project(game, x, z, 0);
  if (!pr) return;
  const w = Math.max(14, 95 * pr.k);
  const h = Math.max(4, 12 * pr.k);
  // Wooden pier.
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(pr.x - w / 2, pr.y - h, w, h);
  ctx.fillStyle = '#a87c4a';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(pr.x - w / 2 + (i * w) / 4, pr.y - h, 1.5, h);
  }
  // Posts + flag.
  ctx.fillStyle = '#6e4a26';
  ctx.fillRect(pr.x - w / 2 + 2, pr.y - h - 10 * pr.k, 3, 10 * pr.k + h);
  ctx.fillRect(pr.x + w / 2 - 5, pr.y - h - 10 * pr.k, 3, 10 * pr.k + h);
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pr.x + w * 0.32, pr.y - h);
  ctx.lineTo(pr.x + w * 0.32, pr.y - h - 26 * pr.k);
  ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(pr.x + w * 0.32, pr.y - h - 26 * pr.k);
  ctx.lineTo(pr.x + w * 0.32 + 16 * pr.k, pr.y - h - 20 * pr.k);
  ctx.lineTo(pr.x + w * 0.32, pr.y - h - 14 * pr.k);
  ctx.closePath();
  ctx.fill();
  if (village) {
    // Stilt hut on the village dock.
    const hw = Math.max(12, 46 * pr.k);
    const hh = Math.max(8, 26 * pr.k);
    const hx = pr.x - w * 0.18;
    const hy = pr.y - h - hh;
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(hx - hw / 2, hy, hw, hh);
    ctx.fillStyle = '#c65a2e';
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.62, hy);
    ctx.lineTo(hx, hy - hh * 0.75);
    ctx.lineTo(hx + hw * 0.62, hy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(hx - hw * 0.12, hy + hh * 0.45, hw * 0.24, hh * 0.55);
  }
}

function drawRaft(ctx, game) {
  const r = game.world.raft;
  const pr = project(game, r.x, r.z, 0);
  if (!pr) return;
  // Drawn deliberately large with the sailor and flag raised high: in
  // chase view the raft sits just ahead of the plane's nose, so it must
  // clear the fuselage to read at small size.
  const rx = Math.max(10, 38 * pr.k);
  const ry = Math.max(4, 11 * pr.k);
  // Logs.
  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6e4a26';
  ctx.lineWidth = 1.5;
  for (const off of [-0.4, 0, 0.4]) {
    ctx.beginPath();
    ctx.moveTo(pr.x - rx, pr.y + off * ry);
    ctx.lineTo(pr.x + rx, pr.y + off * ry);
    ctx.stroke();
  }
  // Waving sailor in orange, raised clear of the raft.
  const bob = Math.sin(performance.now() / 240) * 2 * pr.k;
  ctx.fillStyle = '#ff6b2e';
  ctx.beginPath();
  ctx.arc(pr.x - rx * 0.25, pr.y - ry * 3.2 + bob, Math.max(4, 9 * pr.k), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(pr.x - rx * 0.38, pr.y - ry * 2.8 + bob, rx * 0.26, ry * 2.4);
  ctx.strokeStyle = '#ff6b2e';
  ctx.lineWidth = Math.max(1.5, 3 * pr.k);
  ctx.beginPath();
  ctx.moveTo(pr.x - rx * 0.14, pr.y - ry * 2.2 + bob);
  ctx.lineTo(pr.x + rx * 0.3, pr.y - ry * 4.4 + bob);
  ctx.stroke();
  // Life ring.
  ctx.strokeStyle = '#ff6b2e';
  ctx.lineWidth = Math.max(2, 5 * pr.k);
  ctx.beginPath();
  ctx.arc(pr.x + rx * 0.55, pr.y - ry * 0.6, Math.max(5, 13 * pr.k), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, 2 * pr.k);
  ctx.beginPath();
  ctx.arc(pr.x + rx * 0.55, pr.y - ry * 0.6, Math.max(5, 13 * pr.k), 0.4, 1.4);
  ctx.stroke();
  // Red SOS flag on a tall pole.
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pr.x + rx * 0.7, pr.y);
  ctx.lineTo(pr.x + rx * 0.7, pr.y - 44 * pr.k);
  ctx.stroke();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(pr.x + rx * 0.7, pr.y - 44 * pr.k);
  ctx.lineTo(pr.x + rx * 0.7 + 22 * pr.k, pr.y - 37 * pr.k);
  ctx.lineTo(pr.x + rx * 0.7, pr.y - 30 * pr.k);
  ctx.closePath();
  ctx.fill();
}

function drawRings(ctx, game) {
  const rings = game.world.rings;
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const pr = project(game, r.x, r.z, r.y);
    if (!pr) continue;
    const rad = 30 * pr.k;
    if (rad < 2) continue;
    const active = game.missions.current === 'rings' && i === game.missions.ringIndex
      && !game.missions.complete && !game.missions.failed;
    const passed = game.missions.current === 'rings' && i < game.missions.ringIndex;
    ctx.save();
    ctx.shadowColor = active ? '#ffd34d' : '#7fb7ff';
    ctx.shadowBlur = active ? 18 : 6;
    ctx.strokeStyle = active ? '#ffd34d' : (passed ? 'rgba(127,183,255,0.35)' : 'rgba(127,183,255,0.85)');
    ctx.lineWidth = active ? 5 : 3;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (active) {
      ctx.fillStyle = '#fff3c4';
      ctx.font = `bold ${Math.max(12, Math.round(rad * 0.55))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), pr.x, pr.y);
    }
  }
}

function drawCrates(ctx, game) {
  for (const c of game.missions.crates) {
    const pr = project(game, c.x, c.z, c.y);
    if (!pr) continue;
    const s = Math.max(4, 16 * pr.k);
    // Orange parachute.
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y - s * 1.6, s * 1.1, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pr.x - s, pr.y - s * 1.6);
    ctx.lineTo(pr.x - s * 0.4, pr.y - s * 0.4);
    ctx.moveTo(pr.x + s, pr.y - s * 1.6);
    ctx.lineTo(pr.x + s * 0.4, pr.y - s * 0.4);
    ctx.stroke();
    // Wooden box.
    ctx.fillStyle = '#a87c4a';
    ctx.fillRect(pr.x - s * 0.45, pr.y - s * 0.45, s * 0.9, s * 0.9);
    ctx.strokeStyle = '#6e4a26';
    ctx.strokeRect(pr.x - s * 0.45, pr.y - s * 0.45, s * 0.9, s * 0.9);
  }
}

function drawParticles(ctx, game) {
  for (const p of game.missions.particles) {
    const pr = project(game, p.x, p.z, p.y);
    if (!pr) continue;
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    const size = clamp(p.size * (320 / Math.max(40, pr.fwd)), 1, 9);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlane(ctx, game, time) {
  const p = game.plane;
  const bob = Math.sin(time * 2.2) * 3;
  const cx = 640;
  const cy = 448 + bob;
  ctx.save();
  // Water shadow when low.
  if (p.alt < 40) {
    ctx.globalAlpha = (1 - p.alt / 40) * 0.28;
    ctx.fillStyle = '#06222e';
    ctx.beginPath();
    ctx.ellipse(cx, 566, 130, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.translate(cx, cy);
  ctx.rotate(p.bank * 0.35);
  // Tail fin.
  ctx.fillStyle = '#1f7a6d';
  ctx.beginPath();
  ctx.moveTo(-16, 78);
  ctx.lineTo(0, 118);
  ctx.lineTo(16, 78);
  ctx.closePath();
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.roundRect(-52, 62, 104, 14, 7);
  ctx.fill();
  // Twin floats.
  ctx.fillStyle = '#e8d9b0';
  ctx.beginPath();
  ctx.roundRect(-58, 92, 26, 16, 8);
  ctx.roundRect(32, 92, 26, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#1f7a6d';
  ctx.fillRect(-58, 104, 26, 3);
  ctx.fillRect(32, 104, 26, 3);
  // Main wing.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.roundRect(-152, -6, 304, 26, 12);
  ctx.fill();
  ctx.fillStyle = '#1f7a6d';
  ctx.fillRect(-152, 14, 304, 5);
  // Fuselage.
  ctx.fillStyle = '#f3e6c8';
  ctx.beginPath();
  ctx.roundRect(-32, -148, 64, 236, 30);
  ctx.fill();
  // Teal cheatline.
  ctx.fillStyle = '#1f7a6d';
  ctx.fillRect(-32, -30, 64, 8);
  // Lit windows.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(-14, -118, 5, 0, Math.PI * 2);
  ctx.arc(14, -118, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#12303f';
  ctx.fillRect(-22, -96, 44, 10);
  // Registration.
  ctx.fillStyle = '#12303f';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PK-SJA', 0, 34);
  // Propeller disc + blades at the nose: thin and faint, hugging the
  // nose tip so it reads as motion blur rather than a grey bar or a
  // detached oval floating above the fuselage.
  ctx.fillStyle = 'rgba(220, 230, 255, 0.12)';
  ctx.beginPath();
  ctx.ellipse(0, -150, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 40, 60, 0.35)';
  ctx.lineWidth = 2.5;
  const a = p.prop;
  ctx.beginPath();
  ctx.moveTo(Math.cos(a) * -34, -150 + Math.sin(a) * -8);
  ctx.lineTo(Math.cos(a) * 34, -150 + Math.sin(a) * 8);
  ctx.stroke();
  ctx.restore();
}

function drawCockpitFrame(ctx, time) {
  // Top brow.
  ctx.fillStyle = '#0c0a18';
  ctx.fillRect(0, 0, 1280, 58);
  ctx.fillStyle = '#c9a24d';
  ctx.fillRect(0, 58, 1280, 2);
  // Angled windscreen pillars, ~36 px wide.
  ctx.fillStyle = '#0c0a18';
  ctx.beginPath();
  ctx.moveTo(0, 58);
  ctx.lineTo(38, 58);
  ctx.lineTo(74, 592);
  ctx.lineTo(0, 592);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1280, 58);
  ctx.lineTo(1242, 58);
  ctx.lineTo(1206, 592);
  ctx.lineTo(1280, 592);
  ctx.closePath();
  ctx.fill();
  // Thin gold inner edge on each pillar.
  ctx.strokeStyle = 'rgba(201, 162, 77, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, 58);
  ctx.lineTo(74, 592);
  ctx.moveTo(1242, 58);
  ctx.lineTo(1206, 592);
  ctx.stroke();
  // Windscreen vignette: the glass darkens toward the pillars so the
  // view ahead reads as looking out of a real windscreen, not a flat frame.
  const vigL = ctx.createLinearGradient(74, 0, 210, 0);
  vigL.addColorStop(0, 'rgba(8, 6, 24, 0.22)');
  vigL.addColorStop(1, 'rgba(8, 6, 24, 0)');
  ctx.fillStyle = vigL;
  ctx.fillRect(74, 58, 136, 534);
  const vigR = ctx.createLinearGradient(1206, 0, 1070, 0);
  vigR.addColorStop(0, 'rgba(8, 6, 24, 0.22)');
  vigR.addColorStop(1, 'rgba(8, 6, 24, 0)');
  ctx.fillStyle = vigR;
  ctx.fillRect(1070, 58, 136, 534);
  // Faint sun glare on the glass, centred on the sun's screen position.
  const p = { x: 640, y: 160 };
  const glare = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 260);
  glare.addColorStop(0, 'rgba(255, 230, 170, 0.10)');
  glare.addColorStop(1, 'rgba(255, 230, 170, 0)');
  ctx.fillStyle = glare;
  ctx.fillRect(p.x - 260, p.y - 260, 520, 520);
  // Faint diagonal windscreen reflection, top-left to bottom-right.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(300, 60);
  ctx.lineTo(180, 592);
  ctx.stroke();
  // Soft, larger propeller disc with a spinner cone at its centre.
  const a = time * 9;
  ctx.fillStyle = 'rgba(220, 230, 255, 0.06)';
  ctx.beginPath();
  ctx.ellipse(640, 92, 170, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 230, 255, 0.10)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(640 + Math.cos(a) * -160, 92 + Math.sin(a) * -22);
  ctx.lineTo(640 + Math.cos(a) * 160, 92 + Math.sin(a) * 22);
  ctx.stroke();
  ctx.fillStyle = 'rgba(20, 24, 40, 0.5)';
  ctx.beginPath();
  ctx.arc(640, 92, 9, 0, Math.PI * 2);
  ctx.fill();
  // Small centre reference dot so the pilot can judge where the nose points.
  ctx.fillStyle = 'rgba(255, 211, 77, 0.55)';
  ctx.beginPath();
  ctx.arc(640, 330, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawScene(ctx, game, time) {
  drawSky(ctx, game);
  drawSea(ctx, game, time);
  drawClouds(ctx, game);
  drawIslands(ctx, game);
  drawBeacon(ctx, game);
  for (const d of game.world.hopDocks) drawDock(ctx, game, d.x, d.z, false);
  for (const v of game.world.mailVillages) drawDock(ctx, game, v.x, v.z, true);
  drawDock(ctx, game, game.world.mainDock.x, game.world.mainDock.z, false);
  drawRaft(ctx, game);
  drawRings(ctx, game);
  drawCrates(ctx, game);
  drawParticles(ctx, game);
  if (game.view === 'cockpit') {
    drawCockpitFrame(ctx, time);
  } else {
    drawPlane(ctx, game, time);
  }
}
