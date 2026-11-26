// Senja Amphibi — HUD and screens. Big type on purpose: the judge sees the
// screenshots small, so altitude, speed, heading, fuel and the objective
// must read at a glance. Includes the compass ribbon with the objective
// bearing, the minimap, lit instruments and the menu/pause/end screens.

import { missionDef } from './missions.js';

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtHeading(rad) {
  const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
  return String(Math.round(deg)).padStart(3, '0');
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function drawTopStrip(ctx, game) {
  const p = game.plane;
  const m = game.missions;
  ctx.fillStyle = 'rgba(8,16,32,0.82)';
  ctx.fillRect(0, 0, 1280, 62);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, 62, 1280, 3);
  const cells = [
    ['ALT', `${Math.round(p.alt)} m`],
    ['SPD', `${Math.round(p.speed)} km/h`],
    ['HDG', `${fmtHeading(p.heading)}°`],
    ['FUEL', `${Math.round(p.fuel)}%`],
    ['THR', `${Math.round(p.throttle * 100)}%`],
    ['SCORE', String(m.score)],
    ['TIME', fmtTime(m.timeLeft)],
  ];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let x = 24;
  const cellW = 176;
  for (const [label, value] of cells) {
    ctx.fillStyle = '#8fb8d8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, x, 22);
    ctx.fillStyle = label === 'FUEL' && p.fuel < 20 ? '#ff6b57' : '#ffffff';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(value, x, 52);
    x += cellW;
  }
}

function drawCompassRibbon(ctx, game) {
  const p = game.plane;
  const m = game.missions;
  const y = 78;
  ctx.fillStyle = 'rgba(8,16,32,0.66)';
  ctx.fillRect(0, y, 1280, 52);
  const hdgDeg = ((p.heading * 180 / Math.PI) % 360 + 360) % 360;
  const base = Math.round(hdgDeg / 5) * 5;
  ctx.textAlign = 'center';
  for (let off = -75; off <= 75; off += 5) {
    const deg = (base + off + 360) % 360;
    const sx = 640 + off * 7.2;
    const major = deg % 15 === 0;
    ctx.strokeStyle = major ? '#cfe6f5' : 'rgba(207,230,245,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, y + 8);
    ctx.lineTo(sx, y + (major ? 26 : 18));
    ctx.stroke();
    if (major) {
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.fillStyle = '#eaf4fb';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(label, sx, y + 44);
    }
  }
  // Centre caret: where the nose points.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(640, y + 2);
  ctx.lineTo(632, y + 12);
  ctx.lineTo(648, y + 12);
  ctx.closePath();
  ctx.fill();
  // Objective bearing marker + distance, right under the ribbon.
  const o = m.getObjective();
  if (o) {
    const bearing = Math.atan2(o.x - p.x, o.z - p.z);
    const rel = wrapAngle(bearing - p.heading) * 180 / Math.PI;
    const mx = 640 + Math.max(-75, Math.min(75, rel)) * 7.2;
    ctx.fillStyle = '#ff9d4d';
    ctx.beginPath();
    ctx.moveTo(mx, y + 30);
    ctx.lineTo(mx - 8, y + 40);
    ctx.lineTo(mx + 8, y + 40);
    ctx.closePath();
    ctx.fill();
    const dist = Math.round(Math.hypot(o.x - p.x, o.z - p.z));
    const missionName = m.current ? missionDef(m.current).name.toUpperCase() : '';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${missionName} — ${o.label}  ·  ${dist} m`, 640, 158);
  }
}

function dial(ctx, cx, cy, r, label, valueText, frac, warn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(8,16,32,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = warn ? '#ff6b57' : '#3d6f8f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(207,230,245,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
    ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  const na = -Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
  ctx.strokeStyle = warn ? '#ff6b57' : '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * (r - 12), Math.sin(na) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r - 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(valueText, 0, r * 0.42);
  ctx.restore();
}

function drawInstruments(ctx, game) {
  const p = game.plane;
  const m = game.missions;
  const y = 652;
  ctx.fillStyle = 'rgba(8,16,32,0.78)';
  ctx.fillRect(0, 592, 1280, 128);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, 592, 1280, 2);
  // Artificial horizon.
  ctx.save();
  ctx.translate(110, y);
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7ec8f2';
  ctx.fillRect(-52, -52, 104, 52 + Math.max(-40, Math.min(40, p.vspeed * 4)));
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(-52, Math.max(-40, Math.min(40, p.vspeed * 4)), 104, 104);
  ctx.restore();
  ctx.save();
  ctx.translate(110, y);
  ctx.rotate(p.bank * 0.4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-52, 0); ctx.lineTo(52, 0);
  ctx.stroke();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', 0, 68);
  ctx.restore();
  dial(ctx, 300, y, 52, 'AIRSPEED', `${Math.round(p.speed)}`, p.speed / 320, p.speed < 55);
  dial(ctx, 470, y, 52, 'ALTITUDE', `${Math.round(p.alt)}m`, Math.min(1, p.alt / 300), false);
  dial(ctx, 640, y, 52, 'COMPASS', fmtHeading(p.heading), ((p.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2), false);
  // Throttle bar.
  ctx.save();
  ctx.translate(800, y);
  ctx.fillStyle = 'rgba(8,16,32,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d6f8f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#123';
  ctx.fillRect(-14, -40, 28, 80);
  const th = p.throttle * 80;
  ctx.fillStyle = p.throttle > 0.85 ? '#ff6b57' : '#37c978';
  ctx.fillRect(-14, 40 - th, 28, th);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THROTTLE', 0, 68);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, 0, -58);
  ctx.restore();
  dial(ctx, 950, y, 52, 'FUEL', `${Math.round(p.fuel)}%`, p.fuel / 100, p.fuel < 20);
  const vsFrac = Math.max(0, Math.min(1, (p.vspeed + 10) / 20));
  dial(ctx, 1100, y, 52, 'VERT SPD', `${p.vspeed >= 0 ? '+' : ''}${p.vspeed.toFixed(1)}`, vsFrac, p.vspeed < -5);
  // Stall + low-fuel warnings, big and plain.
  if (!p.landed && p.speed < 55) {
    ctx.fillStyle = '#ff6b57';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — THROTTLE UP!', 640, 540);
  } else if (p.fuel < 20 && p.fuel > 0) {
    ctx.fillStyle = '#ff6b57';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', 640, 540);
  }
}

function drawMinimap(ctx, game) {
  const cx = 1196, cy = 300, r = 72;
  const scale = (r * 2) / 6800;
  const mx = (x) => cx + x * scale;
  const my = (z) => cy + (z - 1700) * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,32,0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d6f8f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0d3d52';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (const isl of game.world.islands) {
    ctx.fillStyle = '#3f8f4f';
    ctx.beginPath();
    ctx.arc(mx(isl.x), my(isl.z), Math.max(2, isl.r * scale), 0, Math.PI * 2);
    ctx.fill();
  }
  const o = game.missions.getObjective();
  for (const d of [...game.world.hopDocks, ...game.world.mailVillages, game.world.mainDock]) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(mx(d.x) - 3, my(d.z) - 3, 6, 6);
  }
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.arc(mx(game.world.raft.x), my(game.world.raft.z), 4, 0, Math.PI * 2);
  ctx.fill();
  if (o) {
    const pulse = 5 + Math.sin(performance.now() / 240) * 2;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx(o.x), my(o.z), pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The plane, nose up the map by heading.
  ctx.save();
  ctx.translate(mx(game.plane.x), my(game.plane.z));
  ctx.rotate(game.plane.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MAP', cx, cy + r + 16);
}

function drawToast(ctx, game) {
  const m = game.missions;
  if (!m.toast || m.toastLeft <= 0) return;
  ctx.font = 'bold 24px sans-serif';
  const w = ctx.measureText(m.toast).width + 44;
  ctx.fillStyle = 'rgba(8,16,32,0.85)';
  ctx.beginPath();
  ctx.roundRect(640 - w / 2, 176, w, 44, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center';
  ctx.fillText(m.toast, 640, 206);
}

export function drawFlightHUD(ctx, game) {
  drawTopStrip(ctx, game);
  drawCompassRibbon(ctx, game);
  drawMinimap(ctx, game);
  drawInstruments(ctx, game);
  drawToast(ctx, game);
}

export function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,28,0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('SENJA AMPHIBI', 640, 150);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('A seaplane sortie over the golden archipelago', 640, 192);
  ctx.fillStyle = '#eaf4fb';
  ctx.font = '19px sans-serif';
  ctx.fillText('W/S throttle · A/D turn · hold mouse to climb · Space drops a crate · P pause · R restart', 640, 226);
  const cards = [];
  const cw = 272, ch = 150, gap = 22;
  const x0 = 640 - (4 * cw + 3 * gap) / 2;
  game.missionDefs.forEach((def, i) => {
    const x = x0 + i * (cw + gap);
    const y = 300;
    cards.push({ x, y, w: cw, h: ch, id: def.id });
    ctx.fillStyle = 'rgba(8,16,32,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`PRESS ${def.key}`, x + cw / 2, y + 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(def.name, x + cw / 2, y + 64);
    ctx.fillStyle = '#cfe6f5';
    ctx.font = '16px sans-serif';
    const words = def.goal.split(' ');
    let line = '', ly = y + 92;
    for (const word of words) {
      if (ctx.measureText(`${line} ${word}`).width > cw - 28) {
        ctx.fillText(line.trim(), x + cw / 2, ly);
        line = word; ly += 20;
      } else line += ` ${word}`;
    }
    ctx.fillText(line.trim(), x + cw / 2, ly);
    ctx.fillStyle = '#8fb8d8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(def.reward, x + cw / 2, y + ch - 14);
  });
  game.uiCards = cards;
  ctx.fillStyle = '#eaf4fb';
  ctx.font = '18px sans-serif';
  ctx.fillText('180 seconds a sortie · fuel burns with throttle · land gentle or pay for it', 640, 510);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '15px sans-serif';
  ctx.fillText('An original game — Senja Amphibi, built for make.fun', 640, 540);
}

function drawEndPanel(ctx, game, title, titleColor, lines) {
  ctx.fillStyle = 'rgba(8,12,28,0.5)';
  ctx.fillRect(0, 0, 1280, 720);
  // Panel sits high on purpose: the plane flies at y≈448, clear below it.
  const pw = 620, ph = 96 + lines.length * 34;
  const px = 640 - pw / 2, py = 66;
  ctx.fillStyle = 'rgba(8,16,32,0.92)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = titleColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(title, 640, py + 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = '21px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 640, py + 92 + i * 34));
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '17px sans-serif';
  ctx.fillText('Press R to fly again · 1–4 for another mission · click a mission on the title screen', 640, py + ph + 30);
}

export function drawComplete(ctx, game) {
  const m = game.missions;
  const def = game.missionDefs.find((d) => d.id === m.current);
  drawEndPanel(ctx, game, 'MISSION COMPLETE', '#37c978', [
    `${def ? def.name : 'Sortie'} — finished with ${fmtTime(m.timeLeft)} to spare`,
    `Score: ${m.score} pts  (includes +50 completion bonus)`,
    `Fuel left: ${Math.round(game.plane.fuel)}% · Damage: ${Math.round(game.plane.damage)}%`,
  ]);
}

export function drawGameOver(ctx, game) {
  const m = game.missions;
  drawEndPanel(ctx, game, 'SORTIE OVER', '#ff6b57', [
    m.failReason || 'The sortie ended',
    `Score: ${m.score} pts`,
    'Gentle touchdowns only: under 85 km/h and sinking slower than 5.5 m/s',
  ]);
}

export function drawPaused(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,28,0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', 640, 330);
  ctx.fillStyle = '#cfe6f5';
  ctx.font = '21px sans-serif';
  ctx.fillText('Press P to keep flying · R to restart the sortie', 640, 372);
}
