// Senja Amphibi — HUD: top strip, compass ribbon, minimap, view pill,
// instrument dials (shared by the chase strip and the cockpit dashboard),
// title / complete / game-over / paused screens. All text English.

export const VIEW_PILL = { x: 1080, y: 400, w: 180, h: 36 };

const GOLD = '#c9a24d';
const PANEL = '#0e1430';
const LABEL_BLUE = '#8fb8d8';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function normDeg(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

function fmtTime(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function headingDeg(game) {
  return ((game.plane.heading * 180 / Math.PI) % 360 + 360) % 360;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawDial(ctx, x, cy, r, label, valueText, frac, needle, lit) {
  // Dark dial face with gold ring; in cockpit mode the ring glows so the
  // panel reads as lit instruments rather than flat circles.
  ctx.save();
  if (lit) {
    ctx.shadowColor = 'rgba(255, 211, 77, 0.55)';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = '#0a1226';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? '#ffd34d' : '#3d6f8f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Tick marks around the rim.
  ctx.strokeStyle = 'rgba(160, 200, 230, 0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = (-120 + i * 24) * Math.PI / 180;
    const x1 = x + Math.sin(a) * (r - 4);
    const y1 = cy - Math.cos(a) * (r - 4);
    const x2 = x + Math.sin(a) * (r - 10);
    const y2 = cy - Math.cos(a) * (r - 10);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  if (needle) {
    // Needle stops at 62% of the radius, so it can never reach the value
    // text printed low inside the dial (round-2 nit: "100%" over the needle).
    const a = (-120 + clamp(frac, 0, 1) * 240) * Math.PI / 180;
    const len = r * 0.62;
    ctx.save();
    if (lit) {
      ctx.shadowColor = 'rgba(255, 211, 77, 0.8)';
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + Math.sin(a) * len, cy - Math.cos(a) * len);
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(x, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Value low inside the dial, drawn after the needle with a dark outline.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0a1226';
  ctx.strokeText(valueText, x, cy + 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(valueText, x, cy + 26);
  // Label below the dial, inside the strip.
  ctx.font = '12px sans-serif';
  ctx.fillStyle = LABEL_BLUE;
  ctx.fillText(label, x, cy + r + 14);
}

function drawHorizonDial(ctx, x, cy, r, game, lit) {
  const p = game.plane;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, cy);
  ctx.rotate(-p.bank);
  const off = clamp(p.vspeed * 3, -28, 28);
  ctx.fillStyle = '#7ec3e8';
  ctx.fillRect(-r, -r, r * 2, r + off);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-r, off, r * 2, r - off + 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, off);
  ctx.lineTo(r, off);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  if (lit) {
    ctx.shadowColor = 'rgba(255, 211, 77, 0.55)';
    ctx.shadowBlur = 14;
  }
  ctx.strokeStyle = lit ? '#ffd34d' : GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = LABEL_BLUE;
  ctx.fillText('HORIZON', x, cy + r + 14);
}

function drawThrottleDial(ctx, x, cy, r, game, lit) {
  const p = game.plane;
  ctx.save();
  if (lit) {
    ctx.shadowColor = 'rgba(255, 211, 77, 0.55)';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = '#0a1226';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? '#ffd34d' : '#3d6f8f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Vertical bar: green fill, red above 85%.
  const bw = 26;
  const bh = r * 1.5;
  const bx = x - bw / 2;
  const by = cy - bh / 2;
  ctx.fillStyle = '#12303f';
  ctx.fillRect(bx, by, bw, bh);
  const fillH = bh * p.throttle;
  ctx.fillStyle = p.throttle > 0.85 ? '#e63946' : '#2fbf71';
  ctx.fillRect(bx, by + bh - fillH, bw, fillH);
  ctx.strokeStyle = '#3d6f8f';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0a1226';
  ctx.strokeText(`${Math.round(p.throttle * 100)}%`, x, cy + 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, x, cy + 26);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = LABEL_BLUE;
  ctx.fillText('THROTTLE', x, cy + r + 14);
}

function drawDials(ctx, game, lit) {
  const p = game.plane;
  const cy = 642;
  const r = 50;
  drawHorizonDial(ctx, 110, cy, r, game, lit);
  drawDial(ctx, 300, cy, r, 'AIRSPEED', `${Math.round(p.speed)}`, p.speed / 320, true, lit);
  drawDial(ctx, 470, cy, r, 'ALTITUDE', `${Math.round(p.alt)}m`, p.alt / 200, true, lit);
  drawDial(ctx, 640, cy, r, 'COMPASS', String(Math.round(headingDeg(game))).padStart(3, '0'), headingDeg(game) / 360, true, lit);
  drawThrottleDial(ctx, 800, cy, r, game, lit);
  drawDial(ctx, 950, cy, r, 'FUEL', `${Math.round(p.fuel)}%`, p.fuel / 100, true, lit);
  const vs = p.vspeed;
  drawDial(ctx, 1100, cy, r, 'VERT SPD', `${vs >= 0 ? '+' : ''}${vs.toFixed(1)}`, clamp((vs + 10) / 20, 0, 1), true, lit);
}

function drawTopStrip(ctx, game) {
  const p = game.plane;
  const m = game.missions;
  ctx.fillStyle = '#0a0f28';
  ctx.fillRect(0, 0, 1280, 62);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 62, 1280, 2);
  const cells = [
    { label: 'ALT', value: `${Math.round(p.alt)} m` },
    { label: 'SPD', value: `${Math.round(p.speed)} km/h` },
    { label: 'HDG', value: `${String(Math.round(headingDeg(game))).padStart(3, '0')}°` },
    { label: 'FUEL', value: `${Math.round(p.fuel)}%`, alert: p.fuel < 20 },
    { label: 'THR', value: `${Math.round(p.throttle * 100)}%` },
    { label: 'SCORE', value: `${m.score}` },
    { label: 'TIME', value: fmtTime(m.timeLeft) },
  ];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  cells.forEach((c, i) => {
    const x = 24 + i * 176;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = LABEL_BLUE;
    ctx.fillText(c.label, x, 20);
    ctx.font = 'bold 25px sans-serif';
    ctx.fillStyle = c.alert ? '#ff5a5a' : '#ffffff';
    ctx.fillText(c.value, x, 50);
  });
}

function drawCompassRibbon(ctx, game) {
  const p = game.plane;
  const hdg = headingDeg(game);
  ctx.fillStyle = 'rgba(8, 12, 34, 0.82)';
  ctx.fillRect(0, 78, 1280, 52);
  // Centre caret = current heading.
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(640, 80);
  ctx.lineTo(632, 92);
  ctx.lineTo(648, 92);
  ctx.closePath();
  ctx.fill();
  const pxPerDeg = 640 / 60;
  const start = Math.floor((hdg - 60) / 5) * 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let d = start; d <= hdg + 60; d += 5) {
    const rel = normDeg(d - hdg);
    const x = 640 + rel * pxPerDeg;
    if (x < 0 || x > 1280) continue;
    const major = ((d % 15) + 360) % 15 === 0;
    ctx.strokeStyle = 'rgba(200, 220, 245, 0.8)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 98);
    ctx.lineTo(x, 98 + (major ? 16 : 9));
    ctx.stroke();
    if (major) {
      const deg = ((d % 360) + 360) % 360;
      const name = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#dfe9f5';
      ctx.fillText(name, x, 128);
    }
  }
  // Objective bearing marker (orange triangle) + mission line below.
  const o = game.missions.getObjective();
  const def = game.missions.def;
  if (o) {
    const bearing = (Math.atan2(o.x - p.x, o.z - p.z) * 180 / Math.PI + 360) % 360;
    const rel = normDeg(bearing - hdg);
    const mx = clamp(640 + rel * pxPerDeg, 24, 1256);
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.moveTo(mx, 82);
    ctx.lineTo(mx - 8, 96);
    ctx.lineTo(mx + 8, 96);
    ctx.closePath();
    ctx.fill();
    const dist = Math.round(Math.hypot(o.x - p.x, o.z - p.z));
    ctx.font = 'bold 20px sans-serif';
    // Dark outline keeps the line readable when the sun disc sits
    // behind it (cockpit cover) or a bright island crosses it.
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(10, 8, 30, 0.8)';
    ctx.strokeText(`${def.name} — ${o.label} · ${dist} m`, 640, 158);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(`${def.name} — ${o.label} · ${dist} m`, 640, 158);
  } else if (def) {
    ctx.font = 'bold 20px sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(10, 8, 30, 0.8)';
    ctx.strokeText(def.name, 640, 158);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(def.name, 640, 158);
  }
}

function drawMinimap(ctx, game, time) {
  const cx = 1196;
  const cy = 300;
  const r = 72;
  ctx.fillStyle = '#0a2e42';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const mx = (x) => cx + (x / 3000) * 70;
  const mz = (z) => cy + ((z - 1700) / 2500) * 70;
  for (const isl of game.world.islands) {
    ctx.fillStyle = '#4d9a58';
    ctx.beginPath();
    ctx.arc(mx(isl.x), mz(isl.z), clamp(isl.r * 0.024, 2, 10), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd34d';
  for (const d of game.world.hopDocks) ctx.fillRect(mx(d.x) - 3, mz(d.z) - 3, 6, 6);
  for (const v of game.world.mailVillages) ctx.fillRect(mx(v.x) - 2, mz(v.z) - 2, 4, 4);
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(mx(game.world.raft.x), mz(game.world.raft.z), 4, 0, Math.PI * 2);
  ctx.fill();
  const o = game.missions.getObjective();
  if (o) {
    const pulse = 8 + 2.5 * Math.sin(time * 4);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx(o.x), mz(o.z), pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // White plane arrow, rotated by heading.
  ctx.save();
  ctx.translate(mx(game.plane.x), mz(game.plane.z));
  ctx.rotate(Math.PI - game.plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = LABEL_BLUE;
  ctx.fillText('MAP', cx, cy + r + 16);
}

function drawViewPill(ctx, game) {
  const r = VIEW_PILL;
  ctx.fillStyle = 'rgba(10, 20, 40, 0.88)';
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText(game.view === 'cockpit' ? 'VIEW: COCKPIT [C]' : 'VIEW: CHASE [C]', r.x + r.w / 2, r.y + r.h / 2 + 1);
}

function drawToast(ctx, game) {
  if (!game.missions.toast || game.missions.toastLeft <= 0) return;
  ctx.font = 'bold 17px sans-serif';
  const w = ctx.measureText(game.missions.toast).width + 36;
  const x = 640 - w / 2;
  ctx.fillStyle = 'rgba(10, 20, 40, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, 178, w, 36, 18);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.missions.toast, 640, 197);
}

function drawWarnings(ctx, game) {
  const p = game.plane;
  let msg = '';
  if (!p.landed && p.speed < 55) msg = 'STALL — THROTTLE UP!';
  else if (p.fuel < 20 && !p.landed) msg = 'LOW FUEL';
  if (!msg) return;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0a0f28';
  ctx.strokeText(msg, 640, 540);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillText(msg, 640, 540);
}

export function drawFlightHUD(ctx, game, time) {
  drawTopStrip(ctx, game);
  // The compass ribbon is hidden on the complete / game-over screens, so
  // the result panel (y66) never covers it — the round-2 nit.
  if (game.state === 'flying' || game.state === 'staging' || game.state === 'paused') {
    drawCompassRibbon(ctx, game);
  }
  drawMinimap(ctx, game, time);
  drawViewPill(ctx, game);
  drawToast(ctx, game);
  drawWarnings(ctx, game);
  // Bottom panel: the chase instrument strip, and the cockpit dashboard
  // in cockpit view — the same lit dials either way. In cockpit mode the
  // panel gets a padded glareshield with stitching and panel screws, so
  // it reads as a real cockpit dashboard, and the dials glow.
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 592, 1280, 128);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 592, 1280, 2);
  if (game.view === 'cockpit') {
    ctx.fillStyle = '#1a2138';
    ctx.fillRect(0, 594, 1280, 18);
    ctx.fillStyle = 'rgba(201, 162, 77, 0.8)';
    for (let x = 24; x < 1280; x += 42) {
      ctx.beginPath();
      ctx.arc(x, 603, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a24d';
    for (const [sx, sy] of [[18, 620], [1262, 620], [18, 700], [1262, 700]]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0f28';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy);
      ctx.lineTo(sx + 2, sy);
      ctx.stroke();
    }
  }
  drawDials(ctx, game, game.view === 'cockpit');
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(10, 8, 30, 0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('SENJA AMPHIBI', 640, 150);
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#dfe9f5';
  ctx.fillText('Seaplane over the Golden Archipelago', 640, 196);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#b9cbe0';
  ctx.fillText('W/S throttle  ·  A/D turn  ·  Hold mouse to climb  ·  Space drop crate  ·  C cockpit view  ·  P pause  ·  R restart  ·  M mute', 640, 240);
  // Four mission cards in a row.
  const cardW = 272;
  const cardH = 150;
  const gap = 16;
  const totalW = cardW * 4 + gap * 3;
  const x0 = (1280 - totalW) / 2;
  const y = 300;
  game.uiCards = [];
  const defs = ['rings', 'hop', 'mail', 'rescue'];
  defs.forEach((id, i) => {
    const d = game.missionDefs[id];
    const cx = x0 + i * (cardW + gap);
    game.uiCards.push({ id, x: cx, y, w: cardW, h: cardH });
    ctx.fillStyle = 'rgba(14, 20, 48, 0.95)';
    ctx.beginPath();
    ctx.roundRect(cx, y, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = LABEL_BLUE;
    ctx.textAlign = 'left';
    ctx.fillText(`PRESS ${d.key}`, cx + 16, y + 28);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(d.name, cx + 16, y + 58);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#dfe9f5';
    const lines = wrapText(ctx, d.goal, cardW - 32);
    lines.slice(0, 2).forEach((ln, li) => ctx.fillText(ln, cx + 16, y + 84 + li * 18));
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(d.reward, cx + 16, y + cardH - 16);
  });
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#b9cbe0';
  ctx.textAlign = 'center';
  ctx.fillText('180 seconds a sortie  ·  Fuel burns with throttle  ·  Land gentle: under 85 km/h, sinking slower than 5.5 m/s', 640, 500);
  ctx.fillText('Click a mission card or press 1–4  ·  Enter starts Ring Run', 640, 528);
}

function resultPanel(ctx, game, title, titleColor, lines) {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  const w = 620;
  const x = (1280 - w) / 2;
  const y = 66;
  const h = 190;
  ctx.fillStyle = 'rgba(14, 20, 48, 0.96)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = titleColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = titleColor;
  ctx.fillText(title, 640, y + 52);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#ffffff';
  lines.forEach((ln, i) => ctx.fillText(ln, 640, y + 94 + i * 32));
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText('Press R to fly again  ·  1–4 for another mission  ·  click a mission on the title screen', 640, y + h + 30);
}

export function drawComplete(ctx, game) {
  const m = game.missions;
  const p = game.plane;
  resultPanel(ctx, game, 'MISSION COMPLETE', '#2fbf71', [
    `${m.def.name} — finished with ${fmtTime(m.timeLeft)} to spare`,
    `Score: ${m.score} pts (includes +50 completion bonus)`,
    `Fuel left: ${Math.round(p.fuel)}%  ·  Damage: ${Math.round(p.damage)}%`,
  ]);
}

export function drawGameOver(ctx, game) {
  const m = game.missions;
  resultPanel(ctx, game, 'MISSION FAILED', '#e63946', [
    m.failReason || 'Sortie over',
    `Score: ${m.score} pts`,
    'Tip: land gentle — under 85 km/h, sinking slower than 5.5 m/s',
  ]);
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', 640, 330);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText('Press P to resume', 640, 380);
}
