// Senja Amphibi — chase-view renderer: golden-hour sky, sun glare on the
// water, drifting clouds, the archipelago, rings, docks, the raft, crates,
// particles and the seaplane itself, big in the centre of the frame.

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function project(game, x, z, y) {
  const p = game.plane;
  const dx = x - p.x, dz = z - p.z;
  const s = Math.sin(p.heading), c = Math.cos(p.heading);
  const fwd = dx * s + dz * c;
  const lat = dx * c - dz * s;
  if (fwd < 10) return null;
  const k = 640 / fwd;
  return { x: 640 + lat * k, y: game.horizon + (p.alt + 6 - y) * k * 0.9, s: k, fwd };
}

function drawSunAndSky(ctx, game, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#2b1b4d');
  sky.addColorStop(0.32, '#7a3b6e');
  sky.addColorStop(0.55, '#e8703f');
  sky.addColorStop(0.72, '#ffb347');
  sky.addColorStop(1, '#ffcf7d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, game.horizon + 2);
  // Low sun, placed by its world bearing so it swings as the plane turns.
  const rel = wrapAngle(game.world.sunBearing - game.plane.heading);
  const sunX = 640 + Math.tan(Math.max(-1.2, Math.min(1.2, rel))) * 520;
  const sunY = game.horizon - 58;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255,236,170,0.95)');
  glow.addColorStop(0.25, 'rgba(255,190,90,0.55)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  game.sunX = sunX;
}

function drawSea(ctx, game, time) {
  const sea = ctx.createLinearGradient(0, game.horizon, 0, 720);
  sea.addColorStop(0, '#ff9d4d');
  sea.addColorStop(0.18, '#c96a4e');
  sea.addColorStop(0.45, '#2e6f7e');
  sea.addColorStop(1, '#0d3d52');
  ctx.fillStyle = sea;
  ctx.fillRect(0, game.horizon, 1280, 720 - game.horizon);
  // Sun glare: a shimmering band under the sun.
  const gx = game.sunX || 640;
  for (let i = 0; i < 26; i++) {
    const y = game.horizon + 12 + i * 19;
    const w = 60 + i * 7 + Math.sin(time * 1.7 + i * 1.3) * 14;
    const a = Math.max(0, 0.5 - i * 0.016);
    ctx.fillStyle = `rgba(255,214,130,${a.toFixed(3)})`;
    ctx.fillRect(gx - w / 2, y, w, 3);
  }
  // Water shimmer streaks drifting with the swell.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 173 + time * 12) % 1400) - 60;
    const sy = game.horizon + 30 + ((i * 97) % 380);
    ctx.fillRect(sx, sy, 46 + (i % 5) * 12, 2);
  }
}

function drawClouds(ctx, game) {
  for (const cl of game.world.clouds) {
    const pr = project(game, cl.x, cl.z, cl.y);
    if (!pr || pr.fwd > 4200) continue;
    const r = cl.r * pr.s;
    if (r < 4) continue;
    ctx.fillStyle = 'rgba(255,226,200,0.85)';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, r, r * 0.32 * cl.puff, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,220,0.9)';
    ctx.beginPath();
    ctx.ellipse(pr.x - r * 0.3, pr.y - r * 0.08, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIsland(ctx, game, isl) {
  const pr = project(game, isl.x, isl.z, 0);
  if (!pr || pr.fwd > 4200) return;
  const rx = isl.r * pr.s;
  const ry = Math.max(3, rx * 0.30);
  if (rx < 3) return;
  const lift = isl.h * pr.s * 0.55;
  // Sand rim, then green body rising toward the peak.
  ctx.fillStyle = '#e8c98a';
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isl.kind === 'sand' ? '#f2dca6' : '#3f8f4f';
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y - lift * 0.25, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isl.kind === 'volcano') {
    ctx.fillStyle = '#5b4a68';
    ctx.beginPath();
    ctx.moveTo(pr.x - rx * 0.7, pr.y);
    ctx.lineTo(pr.x, pr.y - lift * 2.1);
    ctx.lineTo(pr.x + rx * 0.7, pr.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.8)';
    ctx.beginPath();
    ctx.ellipse(pr.x + Math.sin(0.7) * 8, pr.y - lift * 2.1 - 12, rx * 0.16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#2f7a3e';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y - lift * 0.55, rx * 0.45, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Palms, only when close enough to read.
  if (pr.fwd < 1600) {
    for (const palm of isl.palms) {
      const px = isl.x + Math.cos(palm.a) * isl.r * palm.d;
      const pz = isl.z + Math.sin(palm.a) * isl.r * palm.d;
      const pp = project(game, px, pz, isl.h * 0.4);
      if (!pp) continue;
      ctx.strokeStyle = '#1d5c2a';
      ctx.lineWidth = Math.max(1, 2.5 * pp.s);
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(pp.x + 3 * pp.s, pp.y - 9 * pp.s);
      ctx.stroke();
      ctx.fillStyle = '#2f8f3e';
      ctx.beginPath();
      ctx.arc(pp.x + 3 * pp.s, pp.y - 10 * pp.s, Math.max(2, 5 * pp.s), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBeacon(ctx, game, o) {
  const pr = project(game, o.x, o.z, 0);
  if (!pr) return;
  const grad = ctx.createLinearGradient(0, game.horizon - 260, 0, pr.y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.4)');
  ctx.fillStyle = grad;
  const w = Math.max(6, 26 * pr.s);
  ctx.fillRect(pr.x - w / 2, game.horizon - 260, w, pr.y - (game.horizon - 260));
}

function drawRing(ctx, game, ring, index, active) {
  const pr = project(game, ring.x, ring.z, ring.y);
  if (!pr) return;
  const r = 30 * pr.s;
  if (r < 2) return;
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.shadowColor = active ? '#ffd166' : '#7ec8ff';
  ctx.shadowBlur = active ? 26 : 8;
  ctx.strokeStyle = active ? '#ffd166' : 'rgba(126,200,255,0.55)';
  ctx.lineWidth = Math.max(2, 5 * pr.s);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (active) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(12, Math.round(r * 0.5))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), 0, 1);
  }
  ctx.restore();
}

function drawDock(ctx, game, dock, kind) {
  const pr = project(game, dock.x, dock.z, 0);
  if (!pr || pr.fwd > 3000) return;
  const s = pr.s;
  // Shallow turquoise lagoon water around a landing dock.
  ctx.fillStyle = 'rgba(64,224,208,0.22)';
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, 95 * s, 26 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const w = 70 * s, h = 16 * s;
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = '#a9743c';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-w / 2 + (i * w) / 5 + 1, -h, 2, h);
  }
  // Posts and a flag so the dock reads at a glance.
  ctx.fillStyle = '#5e3a17';
  ctx.fillRect(-w / 2 + 2, -h - 14 * s, 3, 14 * s);
  ctx.fillRect(w / 2 - 5, -h - 14 * s, 3, 14 * s);
  ctx.strokeStyle = '#5e3a17';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, -h - 34 * s);
  ctx.stroke();
  ctx.fillStyle = kind === 'village' ? '#ff5a4e' : '#ffd166';
  ctx.beginPath();
  ctx.moveTo(0, -h - 34 * s);
  ctx.lineTo(16 * s, -h - 28 * s);
  ctx.lineTo(0, -h - 22 * s);
  ctx.closePath();
  ctx.fill();
  if (kind === 'village') {
    // A stilt hut on the dock.
    ctx.fillStyle = '#b5763a';
    ctx.fillRect(-w * 0.28, -h - 30 * s, w * 0.56, 18 * s);
    ctx.fillStyle = '#7a4a22';
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h - 30 * s);
    ctx.lineTo(0, -h - 48 * s);
    ctx.lineTo(w * 0.34, -h - 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-4 * s, -h - 20 * s, 8 * s, 10 * s);
  }
  ctx.restore();
}

function drawRaft(ctx, game, raft) {
  const pr = project(game, raft.x, raft.z, 0);
  if (!pr || pr.fwd > 3000) return;
  const s = pr.s;
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.fillStyle = '#c98f4e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.moveTo(-20 * s, -3 * s); ctx.lineTo(20 * s, -3 * s);
  ctx.moveTo(-20 * s, 3 * s); ctx.lineTo(20 * s, 3 * s);
  ctx.stroke();
  // The sailor, waving.
  ctx.fillStyle = '#ff7b54';
  ctx.beginPath();
  ctx.arc(0, -14 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff7b54';
  ctx.lineWidth = Math.max(1.5, 3 * s);
  ctx.beginPath();
  ctx.moveTo(0, -9 * s);
  ctx.lineTo(0, 0);
  ctx.moveTo(0, -6 * s);
  ctx.lineTo(9 * s, -14 * s);
  ctx.stroke();
  // Orange life ring and a tall SOS flag.
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = Math.max(2, 4 * s);
  ctx.beginPath();
  ctx.arc(18 * s, 2, 7 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 0);
  ctx.lineTo(-14 * s, -34 * s);
  ctx.stroke();
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.moveTo(-14 * s, -34 * s);
  ctx.lineTo(2 * s, -29 * s);
  ctx.lineTo(-14 * s, -24 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrate(ctx, game, c) {
  const pr = project(game, c.x, c.z, c.y);
  if (!pr) return;
  const s = Math.max(0.4, pr.s);
  // Parachute canopy above the falling crate.
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath();
  ctx.arc(pr.x, pr.y - 16 * s, 12 * s, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pr.x - 11 * s, pr.y - 16 * s); ctx.lineTo(pr.x, pr.y - 4 * s);
  ctx.moveTo(pr.x + 11 * s, pr.y - 16 * s); ctx.lineTo(pr.x, pr.y - 4 * s);
  ctx.stroke();
  ctx.fillStyle = '#b5763a';
  ctx.fillRect(pr.x - 6 * s, pr.y - 4 * s, 12 * s, 10 * s);
  ctx.strokeStyle = '#5e3a17';
  ctx.strokeRect(pr.x - 6 * s, pr.y - 4 * s, 12 * s, 10 * s);
}

function drawParticles(ctx, game) {
  for (const p of game.missions.particles) {
    const pr = project(game, p.x, p.z, p.y);
    if (!pr) continue;
    const a = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, a);
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, Math.max(1, p.size * pr.s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlane(ctx, game, time) {
  const p = game.plane;
  const bob = Math.sin(time * 2.2) * 2;
  // Water shadow under the plane when it is low.
  if (p.alt < 120) {
    const shA = Math.max(0, 0.35 - p.alt * 0.0025);
    ctx.fillStyle = `rgba(10,30,45,${shA.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(640, 448 + 92 + p.alt * 0.55, 120 - p.alt * 0.4, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(640, 448 + bob);
  ctx.rotate(p.bank * 0.45);
  ctx.scale(1.15, 1.15);
  // Propeller disc at the nose (far end, up-screen in chase view).
  ctx.fillStyle = 'rgba(220,230,240,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -78, 10 + Math.sin(p.prop) * 4, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath();
  ctx.arc(0, -76, 5, 0, Math.PI * 2);
  ctx.fill();
  // Main wing, seen from behind.
  ctx.fillStyle = '#f4ead2';
  ctx.beginPath();
  ctx.roundRect(-138, -6, 276, 22, 9);
  ctx.fill();
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(-138, 8, 276, 5);
  // Fuselage: wide at the tail (near), tapering to the nose.
  const body = ctx.createLinearGradient(0, 62, 0, -72);
  body.addColorStop(0, '#fbf3dc');
  body.addColorStop(0.6, '#f4e6c2');
  body.addColorStop(1, '#e8d3a0');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-24, 62);
  ctx.quadraticCurveTo(-30, 0, -15, -70);
  ctx.quadraticCurveTo(0, -80, 15, -70);
  ctx.quadraticCurveTo(30, 0, 24, 62);
  ctx.quadraticCurveTo(0, 70, -24, 62);
  ctx.fill();
  // Teal cheatline and lit windows.
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(-22, 18, 44, 7);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(-9, -52, 5, 0, Math.PI * 2);
  ctx.arc(9, -52, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#123';
  ctx.beginPath();
  ctx.arc(-9, -52, 2.5, 0, Math.PI * 2);
  ctx.arc(9, -52, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Tail fin and stabiliser.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.moveTo(-14, 58);
  ctx.lineTo(0, 92);
  ctx.lineTo(14, 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4ead2';
  ctx.beginPath();
  ctx.roundRect(-58, 46, 116, 12, 6);
  ctx.fill();
  // Twin floats with spray rails.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#d9c48f';
    ctx.beginPath();
    ctx.roundRect(side * 34 - 9, 18, 18, 58, 8);
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(side * 34 - 9, 66, 18, 4);
  }
  // Registration.
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-SJA', 0, 44);
  ctx.restore();
}

export function drawScene(ctx, game, time) {
  const p = game.plane;
  game.horizon = Math.max(150, Math.min(280, 218 - p.vspeed * 2.5));
  drawSunAndSky(ctx, game, time);
  drawSea(ctx, game, time);
  drawClouds(ctx, game);
  const far = [...game.world.islands].sort((a, b) => {
    const da = Math.hypot(a.x - p.x, a.z - p.z);
    const db = Math.hypot(b.x - p.x, b.z - p.z);
    return db - da;
  });
  for (const isl of far) drawIsland(ctx, game, isl);
  // The next objective gets a light beacon so it reads from far away.
  const o = game.missions.getObjective();
  if (o) drawBeacon(ctx, game, o);
  for (const d of game.world.hopDocks) drawDock(ctx, game, d, 'dock');
  drawDock(ctx, game, game.world.mainDock, 'dock');
  for (const v of game.world.mailVillages) drawDock(ctx, game, v, 'village');
  drawRaft(ctx, game, game.world.raft);
  if (game.missions.current === 'rings') {
    game.world.rings.forEach((r, i) => {
      drawRing(ctx, game, r, i, i === game.missions.ringIndex);
    });
  }
  for (const c of game.missions.crates) drawCrate(ctx, game, c);
  drawParticles(ctx, game);
  drawPlane(ctx, game, time);
}
