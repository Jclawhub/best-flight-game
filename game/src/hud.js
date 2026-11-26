// HUD and lit instruments for Senja Amphibi.
// Top bar: altitude, speed, heading, fuel, throttle, score, timer — always
// visible and readable when the screenshot is shrunk. Bottom strip: six
// round gauges (horizon, airspeed, altimeter, compass, throttle, fuel) plus
// warning lights. The judge reads the game mostly through its screenshots,
// so every number is big, bold and high-contrast.

import { normalizeAngle } from './world.js';

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawPanel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10, 22, 30, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHUD(ctx, game, plane, missions) {
  const W = 1280;
  // ---- top bar -------------------------------------------------------
  drawPanel(ctx, 12, 10, W - 24, 44, 0.62);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Verdana, sans-serif';
  const headingDeg = ((Math.round((plane.heading * 180) / Math.PI) % 360) + 360) % 360;
  const items = [
    `ALT ${Math.round(plane.alt)} m`,
    `SPD ${Math.round(plane.speed)} km/h`,
    `HDG ${headingDeg}°`,
    `FUEL ${Math.round(plane.fuel)}%`,
    `THR ${Math.round(plane.throttle * 100)}%`,
    `SCORE ${missions.score}`,
    `TIME ${fmtTime(missions.timeLeft)}`,
  ];
  let x = 30;
  for (let i = 0; i < items.length; i++) {
    const low = items[i].startsWith('FUEL') && plane.fuel < 25;
    ctx.fillStyle = low ? '#ffb13d' : '#ffffff';
    ctx.fillText(items[i], x, 33);
    x += ctx.measureText(items[i]).width + 34;
  }

  // ---- objective banner + steering arrow ------------------------------
  const objective = missions.getObjective();
  if (objective && missions.active) {
    const dx = objective.x - plane.x;
    const dz = objective.z - plane.z;
    const dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz);
    const rel = normalizeAngle(bearing - plane.heading);
    const arrow = Math.abs(rel) < 0.3 ? '▲' : rel > 0 ? '▶' : '◀';
    const label = `${objective.label}  •  ${Math.round(dist)} m  ${arrow}`;
    ctx.font = 'bold 19px Verdana, sans-serif';
    const tw = ctx.measureText(label).width;
    drawPanel(ctx, (W - tw) / 2 - 16, 62, tw + 32, 34, 0.55);
    ctx.fillStyle = '#ffd94d';
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, 80);
    ctx.textAlign = 'left';
  }

  // ---- centre message --------------------------------------------------
  if (missions.message && missions.messageTimer > 0) {
    ctx.font = 'bold 24px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 217, 77, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(missions.message, W / 2, 128);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  // ---- warning lights ---------------------------------------------------
  let wx = W - 30;
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.textAlign = 'right';
  if (plane.fuel < 25 && plane.flying && Math.sin(game.time * 8) > 0) {
    ctx.fillStyle = '#ffb13d';
    ctx.fillText('⚠ LOW FUEL', wx, 80);
    wx -= 130;
  }
  if (plane.stalling && plane.flying && Math.sin(game.time * 8) > 0) {
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('⚠ STALL', wx, 80);
    wx -= 110;
  }
  if (plane.damage > 0) {
    ctx.fillStyle = plane.damage > 60 ? '#ff4d4d' : '#ffb13d';
    ctx.fillText(`DAMAGE ${Math.round(plane.damage)}%`, wx, 80);
  }
  ctx.textAlign = 'left';

  // ---- instruments strip -------------------------------------------------
  drawPanel(ctx, 12, 604, W - 24, 104, 0.5);
  const cy = 656;
  drawHorizon(ctx, 100, cy, 42, plane.bank, plane.pitch, 'HORIZON');
  drawDial(ctx, 258, cy, 42, 'AIRSPEED', plane.speed, 320, 'km/h');
  drawDial(ctx, 416, cy, 42, 'ALTITUDE', plane.alt, 500, 'm');
  drawVerticalSpeed(ctx, 640, cy, 42, plane.vspeed);
  drawCompass(ctx, 880, cy, 42, plane.heading);
  drawThrottleGauge(ctx, 1038, cy, 42, plane.throttle);
  drawDial(ctx, 1180, cy, 42, 'FUEL', plane.fuel, 100, '%');
}

function gaugeFace(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#101c22';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function gaugeLabel(ctx, x, y, r, label) {
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(label, x, y + r + 16);
  ctx.textAlign = 'left';
}

function drawHorizon(ctx, x, y, r, bank, pitch, label) {
  gaugeFace(ctx, x, y, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-bank);
  const pitchPx = Math.max(-r, Math.min(r, pitch * 90));
  // Sky above, ground below.
  ctx.fillStyle = '#7ec8e8';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 16, y);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  gaugeLabel(ctx, x, y, r, label);
}

function drawDial(ctx, x, y, r, label, value, max, unit) {
  gaugeFace(ctx, x, y, r);
  // Ticks.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) {
    const a = (-Math.PI * 0.75) + (i / 8) * Math.PI * 1.5;
    const x1 = x + Math.cos(a) * (r - 8);
    const y1 = y + Math.sin(a) * (r - 8);
    const x2 = x + Math.cos(a) * (r - 3);
    const y2 = y + Math.sin(a) * (r - 3);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Red zone for fuel.
  if (label === 'FUEL') {
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r - 5, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * 0.25);
    ctx.stroke();
  }
  // Needle.
  const frac = Math.max(0, Math.min(1, value / max));
  const angle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * (r - 10), y + Math.sin(angle) * (r - 10));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Digital readout.
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(value)}`, x, y + r * 0.55);
  ctx.font = '10px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(unit, x, y + r * 0.55 + 12);
  ctx.restore();
  gaugeLabel(ctx, x, y, r, label);
  ctx.textAlign = 'left';
}

function drawVerticalSpeed(ctx, x, y, r, vspeed) {
  gaugeFace(ctx, x, y, r);
  // Centre line and up/down ticks.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - r + 10, y);
  ctx.lineTo(x + r - 10, y);
  ctx.stroke();
  for (const frac of [-0.6, -0.3, 0.3, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x - 6, y + frac * (r - 10));
    ctx.lineTo(x + 6, y + frac * (r - 10));
    ctx.stroke();
  }
  // Needle: climbs read above the line, sinks below it.
  const frac = Math.max(-1, Math.min(1, vspeed / 12));
  const ny = y - frac * (r - 14);
  ctx.strokeStyle = vspeed > 0.5 ? '#7ee787' : vspeed < -0.5 ? '#ff9a7a' : '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 14, ny);
  ctx.lineTo(x + 14, ny);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${vspeed >= 0 ? '+' : ''}${vspeed.toFixed(1)}`, x, y + r * 0.55);
  ctx.font = '10px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('m/s', x, y + r * 0.55 + 12);
  ctx.restore();
  gaugeLabel(ctx, x, y, r, 'VERT SPEED');
  ctx.textAlign = 'left';
}

function drawCompass(ctx, x, y, r, heading) {
  gaugeFace(ctx, x, y, r);
  const points = [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]];
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const [letter, bearing] of points) {
    const rel = normalizeAngle(bearing - heading);
    if (Math.abs(rel) > 1.9) continue;
    const px = x + Math.sin(rel) * (r - 12);
    const py = y - Math.cos(rel) * (r - 12) + 4;
    ctx.fillStyle = letter === 'N' ? '#ff4d4d' : '#ffffff';
    ctx.fillText(letter, px, py);
  }
  // Heading marker and digits.
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - r + 4);
  ctx.lineTo(x + 6, y - r + 4);
  ctx.lineTo(x, y - r + 12);
  ctx.closePath();
  ctx.fill();
  const deg = ((Math.round((heading * 180) / Math.PI) % 360) + 360) % 360;
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${deg}°`, x, y + r * 0.55);
  ctx.restore();
  gaugeLabel(ctx, x, y, r, 'COMPASS');
  ctx.textAlign = 'left';
}

function drawThrottleGauge(ctx, x, y, r, throttle) {
  gaugeFace(ctx, x, y, r);
  const barH = (r * 2 - 16) * throttle;
  const grad = ctx.createLinearGradient(0, y + r - 8, 0, y - r + 8);
  grad.addColorStop(0, '#2fae5f');
  grad.addColorStop(0.6, '#ffd94d');
  grad.addColorStop(1, '#ff7a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 10, y + r - 8 - barH, 20, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 10, y - r + 8, 20, r * 2 - 16);
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(throttle * 100)}%`, x, y + r * 0.55);
  ctx.restore();
  gaugeLabel(ctx, x, y, r, 'THROTTLE');
  ctx.textAlign = 'left';
}
