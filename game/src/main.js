// main.js — boot, game loop, state machine, camera, rendering and the
// window.__game debug interface the CDP autopilot drives.
// Senja Amphibi: a 3D seaplane over an Indonesian archipelago at golden hour.

import {
  createGL, createPrograms, bindMesh, uploadMesh, newMesh, addBox,
  mat4Identity, mat4Perspective, mat4LookAt, mat4Multiply, mat4Translate,
  mat4RotateX, mat4RotateY, mat4RotateZ, mat4Plane, mat4ViewRot,
  mat4TransformPoint,
} from './gl.js';
import { buildWorld, uploadWorld, SUN_DIR, FOG_COLOR } from './world.js';
import { createPlane, resetPlane, updatePlane, uploadPlane } from './plane.js';
import {
  createMissions, startMission, updateMissions, getObjective, dropCrate,
  missionName,
} from './missions.js';
import { createHud, updateHud, showScreen, showComplete, showGameOver } from './hud.js';
import { createAudio, initAudio, setEngine, playChime, playSplash, playThump, playJingle, playClick, setMuted } from './audio.js';
import { createInput, readFlight, consumeActions } from './input.js';
import { parseParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const gl = createGL(canvas);
if (!gl) {
  document.getElementById('webgl-error').style.display = 'flex';
  throw new Error('WebGL unavailable');
}
const programs = createPrograms(gl);
const hud = createHud(document);
const audio = createAudio();
const input = createInput(document, canvas);

// ---- world & state ----
const params = parseParams(window.location.search);
const world = buildWorld(params.seed);
const meshes = uploadWorld(gl, world);
const planeMeshes = uploadPlane(gl);
const crateMesh = uploadMesh(gl, (() => {
  const b = newMesh();
  addBox(b, 0, 0, 0, 1.6, 1.1, 1.6, [0.62, 0.45, 0.26]);
  addBox(b, 0, 0.62, 0, 1.7, 0.16, 1.7, [0.85, 0.2, 0.12]);
  return b;
})());

const plane = createPlane(0, 470, 0);
const missions = createMissions(world);
missions.getObjective = () => getObjective(missions);

const game = {
  state: 'title', // 'title' | 'flying' | 'paused' | 'complete' | 'gameover'
  viewMode: 'chase', // 'chase' | 'cockpit'
  params,
  timeScale: 1,
  frozen: false, // staged shots: plane holds still, world still animates
  time: 0,
  camera: { eye: [0, 40, -40], target: [0, 0, 0] },
};

// Ring yaw: each ring faces the leg that leads into it.
const ringYaws = world.rings.map((r, i) => {
  const prev = i === 0 ? { x: 0, z: 470 } : world.rings[i - 1];
  return Math.atan2(r.x - prev.x, r.z - prev.z);
});

// ---- spray particles ----
const MAX_PARTICLES = 400;
const particles = [];
function spawnSpray(x, y, z, n, spread) {
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    particles.push({
      x: x + Math.cos(a) * r, y: y + Math.random() * 0.5, z: z + Math.sin(a) * r,
      vx: Math.cos(a) * (1 + Math.random() * 3),
      vy: 2 + Math.random() * 4,
      vz: Math.sin(a) * (1 + Math.random() * 3),
      life: 0.7 + Math.random() * 0.6,
      size: 1.5 + Math.random() * 2.5,
    });
  }
}
const particleBuffer = gl.createBuffer();
const particleData = new Float32Array(MAX_PARTICLES * 7);

// ---- mission / state control ----
function placePlaneAtStart() {
  const obj = getObjective(missions);
  let heading = 0;
  if (obj) heading = Math.atan2(obj.x - 0, obj.z - 470);
  resetPlane(plane, 0, 470, heading);
}

function beginMission(id) {
  startMission(missions, id, plane);
  placePlaneAtStart();
  game.state = 'flying';
  showScreen(hud, null);
  snapCamera();
  initAudio(audio);
  playJingle(audio);
}

game.startMission = (id) => {
  beginMission(id);
};

function endMissionToComplete() {
  game.state = 'complete';
  playJingle(audio);
  showComplete(hud, `${missionName(missions.id)} complete!`, missions.score, missions.timeLeft);
}

function endMissionToGameOver(reason) {
  game.state = 'gameover';
  playThump(audio);
  showGameOver(hud, reason, missions.score);
}

// Mission-screen buttons.
document.querySelectorAll('[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => {
    initAudio(audio);
    playClick(audio);
    beginMission(btn.dataset.mission);
  });
});
document.getElementById('btn-resume').addEventListener('click', () => {
  game.state = 'flying';
  showScreen(hud, null);
});
document.getElementById('btn-retry').addEventListener('click', () => {
  if (missions.id) beginMission(missions.id);
});
document.getElementById('btn-menu').addEventListener('click', () => {
  game.state = 'title';
  showScreen(hud, 'title');
});
document.getElementById('btn-again').addEventListener('click', () => {
  if (missions.id) beginMission(missions.id);
});
document.getElementById('btn-menu2').addEventListener('click', () => {
  game.state = 'title';
  showScreen(hud, 'title');
});
document.getElementById('view-pill').addEventListener('click', () => {
  game.viewMode = game.viewMode === 'chase' ? 'cockpit' : 'chase';
});
document.addEventListener('pointerdown', () => initAudio(audio), { once: true });
document.addEventListener('keydown', () => initAudio(audio), { once: true });

// ---- staging ----
const staged = applyShot(game, plane, missions, world);
if (staged) {
  game.frozen = true;
  showScreen(hud, null);
  snapCamera();
  if (game.state === 'complete') {
    showComplete(hud, 'Ring Run complete!', missions.score, missions.timeLeft);
  }
} else {
  showScreen(hud, 'title');
  snapCamera(); // title backdrop: camera sits behind the plane on the water
}

// ---- debug interface (CDP autopilot) ----
window.__game = {
  game,
  plane,
  missions,
  world,
  setTimeScale(n) {
    game.timeScale = Math.max(0.25, Math.min(4, n));
  },
};

// Snap the camera to its desired position at once (no lerp). Used after a
// mission starts and after a shot is staged: under slow software rendering
// the lerp would still be mid-flight when the screenshot is taken.
function snapCamera() {
  updateCamera(10);
  if (game.viewMode === 'cockpit') return; // cockpit sets eye/target directly
  const fwd = [Math.sin(plane.heading), 0, Math.cos(plane.heading)];
  const dist = plane.landed ? 24 : 30;
  const height = plane.landed ? 8 : 10;
  game.camera.eye = [
    plane.x - fwd[0] * dist,
    plane.alt + height,
    plane.z - fwd[2] * dist,
  ];
  game.camera.target = [
    plane.x + fwd[0] * 26,
    plane.alt + 2,
    plane.z + fwd[2] * 26,
  ];
}

// ---- camera ----
function updateCamera(dt) {
  const fwd = [Math.sin(plane.heading), 0, Math.cos(plane.heading)];
  let eye, target;
  if (game.viewMode === 'cockpit') {
    eye = [
      plane.x + fwd[0] * 2.2,
      plane.alt + 1.35,
      plane.z + fwd[2] * 2.2,
    ];
    const p = plane.pitch;
    const look = [
      Math.sin(plane.heading) * Math.cos(p),
      Math.sin(p) + 0.02,
      Math.cos(plane.heading) * Math.cos(p),
    ];
    target = [eye[0] + look[0] * 60, eye[1] + look[1] * 60, eye[2] + look[2] * 60];
    game.camera.eye = eye;
    game.camera.target = target;
  } else {
    const dist = plane.landed ? 24 : 30;
    const height = plane.landed ? 8 : 10;
    eye = [
      plane.x - fwd[0] * dist,
      plane.alt + height,
      plane.z - fwd[2] * dist,
    ];
    target = [
      plane.x + fwd[0] * 26,
      plane.alt + 2,
      plane.z + fwd[2] * 26,
    ];
    const k = 1 - Math.exp(-dt * 4);
    const ce = game.camera.eye, ct = game.camera.target;
    for (let i = 0; i < 3; i++) {
      ce[i] += (eye[i] - ce[i]) * k;
      ct[i] += (target[i] - ct[i]) * k;
    }
  }
}

// ---- render ----
const FOG_NEAR = 900;
const FOG_FAR = 6500;

function drawWithMain(mesh, model, opts = {}) {
  const prog = programs.main;
  gl.useProgram(prog.prog);
  bindMesh(gl, prog, mesh);
  gl.uniformMatrix4fv(prog.uniform.uProj, false, game.proj);
  gl.uniformMatrix4fv(prog.uniform.uView, false, game.view);
  gl.uniformMatrix4fv(prog.uniform.uModel, false, model);
  gl.uniform3fv(prog.uniform.uLightDir, SUN_DIR);
  gl.uniform3fv(prog.uniform.uFogColor, FOG_COLOR);
  gl.uniform1f(prog.uniform.uFogNear, FOG_NEAR);
  gl.uniform1f(prog.uniform.uFogFar, FOG_FAR);
  gl.uniform1f(prog.uniform.uWater, opts.water ? 1 : 0);
  gl.uniform1f(prog.uniform.uTime, game.time);
  gl.uniform1f(prog.uniform.uSpec, opts.spec ? 1 : 0);
  gl.uniform3fv(prog.uniform.uCamPos, game.camera.eye);
  gl.uniform3fv(prog.uniform.uEmissive, opts.emissive || [0, 0, 0]);
  gl.uniform1f(prog.uniform.uAlpha, opts.alpha !== undefined ? opts.alpha : 1);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

function render() {
  // Resize to the window (devicePixelRatio capped for software rendering).
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / canvas.height;
  game.proj = mat4Perspective((game.viewMode === 'cockpit' ? 72 : 65) * Math.PI / 180, aspect, 0.5, 12000);
  game.view = mat4LookAt(game.camera.eye, game.camera.target, [0, 1, 0]);

  // Sky dome first, no depth test. The camera sits INSIDE the dome, so
  // backface culling must be off here or the whole sky is culled.
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.depthMask(false);
  {
    const prog = programs.sky;
    gl.useProgram(prog.prog);
    bindMesh(gl, prog, meshes.sky);
    gl.uniformMatrix4fv(prog.uniform.uProj, false, game.proj);
    gl.uniformMatrix4fv(prog.uniform.uViewRot, false, mat4ViewRot(game.view));
    gl.uniform3fv(prog.uniform.uSunDir, SUN_DIR);
    gl.drawElements(gl.TRIANGLES, meshes.sky.count, gl.UNSIGNED_SHORT, 0);
  }
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);

  // Water with sun glint.
  drawWithMain(meshes.water, mat4Identity(), { water: true, spec: true });
  // Static world: terrain, palms, huts, docks, raft.
  drawWithMain(meshes.static, mat4Identity(), {});
  // Cockpit-only landmarks: the volcano on Palm island and a fishing
  // boat in the approach lane. They are drawn only in cockpit view so
  // the staged chase-view screenshots keep their exact pixels — the
  // clouds already use the same cockpit-conditional treatment.
  if (game.viewMode === 'cockpit' && game.state !== 'title') {
    drawWithMain(meshes.volcano, mat4Identity(), {});
    drawWithMain(meshes.boat, mat4Identity(), {});
  }
  // Clouds drift with time.
  {
    const drift = mat4Translate(game.time * 1.5, 0, 0);
    // In cockpit view the clouds read as flat grey ellipses, so light
    // them warmer and brighter there; chase-view shots keep the
    // original grade (their bytes must not change).
    const cloudGlow = game.viewMode === 'cockpit' ? [0.5, 0.42, 0.32] : [0.28, 0.24, 0.2];
    drawWithMain(meshes.clouds, drift, { emissive: cloudGlow });
  }
  // Rings: passed = green, current = bright pulsing orange, future = dim.
  for (let i = 0; i < world.rings.length; i++) {
    const r = world.rings[i];
    let emissive;
    if (missions.id === 'rings' && i < missions.ringIndex) {
      emissive = [0.05, 0.35, 0.08];
    } else if (missions.id === 'rings' && i === missions.ringIndex) {
      const pulse = 0.25 + 0.15 * Math.sin(game.time * 4);
      emissive = [0.45 + pulse, 0.2, 0.0];
    } else {
      emissive = [0.12, 0.06, 0.0];
    }
    const model = mat4Multiply(
      mat4Translate(r.x, r.y, r.z),
      mat4RotateY(ringYaws[i]),
    );
    drawWithMain(meshes.ring, model, { emissive });
  }

  // Plane (hidden on the title screen so the archipelago is the backdrop).
  if (game.state !== 'title') {
    const model = mat4Plane(plane.x, plane.alt, plane.z, plane.heading, plane.pitch, plane.bank);
    drawWithMain(planeMeshes.body, model, {});
    // Spinning prop + translucent disc at the nose — but never in cockpit
    // view, where the blades sit 2 m from the camera and read as a black
    // bar across the windshield.
    if (game.viewMode !== 'cockpit') {
      const nose = mat4Multiply(
        model,
        mat4Multiply(mat4Translate(0, 0.35, 4.35), mat4RotateZ(plane.propAngle)),
      );
      drawWithMain(planeMeshes.prop, nose, {});
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      const disc = mat4Multiply(model, mat4Translate(0, 0.35, 4.32));
      drawWithMain(planeMeshes.disc, disc, { emissive: [0.1, 0.1, 0.1], alpha: 0.28 });
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    // Cockpit airframe: the nose in camera space, so the cockpit shot
    // shows the aircraft itself. Only in cockpit view; chase view keeps
    // the real plane exactly as before. Placed far enough ahead and low
    // enough that only the nose tip reads above the dashboard.
    if (game.viewMode === 'cockpit') {
      const fwd = [Math.sin(plane.heading), 0, Math.cos(plane.heading)];
      const airModel = mat4Plane(
        game.camera.eye[0] + fwd[0] * 3.2,
        game.camera.eye[1] - 1.35,
        game.camera.eye[2] + fwd[2] * 3.2,
        plane.heading, plane.pitch, 0,
      );
      drawWithMain(planeMeshes.airframe, airModel, {});
    }
  }

  // Mail crates in flight.
  for (const c of missions.crates) {
    drawWithMain(crateMesh, mat4Translate(c.x, c.y + 0.6, c.z), {});
  }

  // Sailor on the raft while the rescue is waiting for him.
  if (missions.id === 'rescue' && !missions.rescued && game.state !== 'title') {
    const m = mat4Translate(world.raft.x - 1, 1.4, world.raft.z - 0.5);
    drawWithMain(meshes.sailor, m, {});
    // Waving arm: rotates about the shoulder.
    const wave = Math.sin(game.time * 3.2) * 0.55 - 0.35;
    const shoulder = mat4Multiply(
      mat4Translate(world.raft.x - 1 + 0.55, 1.4 + 1.35, world.raft.z - 0.5),
      mat4RotateZ(2.4 + wave),
    );
    drawWithMain(meshes.arm, shoulder, {});
  }

  // Spray particles.
  if (particles.length) {
    const prog = programs.pts;
    gl.useProgram(prog.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    let n = 0;
    for (const p of particles) {
      particleData[n * 7 + 0] = p.x;
      particleData[n * 7 + 1] = p.y;
      particleData[n * 7 + 2] = p.z;
      particleData[n * 7 + 3] = 0.92;
      particleData[n * 7 + 4] = 0.95;
      particleData[n * 7 + 5] = 0.97;
      particleData[n * 7 + 6] = p.size * (0.4 + p.life);
      n++;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleData.subarray(0, n * 7), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.attrib.aPos);
    gl.vertexAttribPointer(prog.attrib.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(prog.attrib.aCol);
    gl.vertexAttribPointer(prog.attrib.aCol, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(prog.attrib.aSize);
    gl.vertexAttribPointer(prog.attrib.aSize, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(prog.uniform.uProj, false, game.proj);
    gl.uniformMatrix4fv(prog.uniform.uView, false, game.view);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

// Sun glare overlay: project the sun direction to screen space.
function updateGlare() {
  const glare = hud.glare;
  if (game.viewMode !== 'cockpit' || game.state === 'title') {
    glare.style.opacity = '0';
    return;
  }
  const vp = mat4Multiply(game.proj, game.view);
  const sunWorld = [
    game.camera.eye[0] + SUN_DIR[0] * 500,
    game.camera.eye[1] + SUN_DIR[1] * 500,
    game.camera.eye[2] + SUN_DIR[2] * 500,
  ];
  const p = mat4TransformPoint(vp, sunWorld[0], sunWorld[1], sunWorld[2]);
  if (p[3] <= 0) {
    glare.style.opacity = '0';
    return;
  }
  const nx = p[0] / p[3], ny = p[1] / p[3];
  if (Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) {
    glare.style.opacity = '0';
    return;
  }
  const sx = (nx * 0.5 + 0.5) * window.innerWidth;
  const sy = (0.5 - ny * 0.5) * window.innerHeight;
  glare.style.left = `${sx - 160}px`;
  glare.style.top = `${sy - 160}px`;
  glare.style.opacity = '0.55';
}

// ---- main loop ----
let lastNow = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  // Clamped at 0.1 s: under slow software rendering a frame can take
  // 0.2 s, and a 0.05 clamp would run the game at half speed. The flight
  // model is stable at 0.1 s steps (the plane moves ~5 m a frame at most).
  let dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  game.time += dt;
  const sdt = dt * game.timeScale;

  const actions = consumeActions(input);

  if (actions.mute) setMuted(audio, !audio.muted);
  if (actions.view) {
    game.viewMode = game.viewMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (game.state === 'title') {
    if (actions.mission) beginMission(actions.mission);
    else if (actions.start) beginMission('rings');
  } else if (game.state === 'flying') {
    if (actions.pause) {
      game.state = 'paused';
      showScreen(hud, 'pause');
    } else if (actions.restart && missions.id) {
      beginMission(missions.id);
    } else {
      if (!game.frozen) {
        const flight = readFlight(input);
        updatePlane(plane, flight, sdt, world, {
          onSplash: () => {
            playSplash(audio);
            spawnSpray(plane.x, 0.4, plane.z, 36, 4);
          },
          onCrash: () => { /* missions.update reports the failure */ },
        });
        updateMissions(missions, plane, sdt, {
          onRing: () => playChime(audio),
          onDrop: () => playThump(audio),
          onSplash: () => playSplash(audio),
        });
        if (actions.drop && missions.id === 'mail' && !missions.complete && !missions.failed) {
          dropCrate(missions, plane);
          playThump(audio);
        }
        if (missions.complete) endMissionToComplete();
        else if (missions.failed) endMissionToGameOver(missions.failReason);
        // Continuous spray while sitting on the water after a landing.
        if (plane.landed && plane.spray > 0 && plane.speed > 20) {
          spawnSpray(plane.x, 0.4, plane.z, 3, 3);
        }
        setEngine(audio, plane.throttle, plane.speed, true);
      }
    }
  } else if (game.state === 'paused') {
    if (actions.pause) {
      game.state = 'flying';
      showScreen(hud, null);
    } else if (actions.restart && missions.id) {
      beginMission(missions.id);
    }
    setEngine(audio, 0, 0, false);
  } else if (game.state === 'complete' || game.state === 'gameover') {
    if (actions.restart && missions.id) beginMission(missions.id);
    else if (actions.start) {
      game.state = 'title';
      showScreen(hud, 'title');
    }
    setEngine(audio, 0, 0, false);
  }

  // Staged shots keep spraying for the camera.
  if (game.frozen && plane.spray > 0) {
    spawnSpray(plane.x, 0.4, plane.z, 4, 4);
  }

  // Particles always animate.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy -= 6 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.life -= dt * 1.1;
    if (p.life <= 0 || p.y < 0) particles.splice(i, 1);
  }

  updateCamera(dt);
  render();
  updateHud(hud, game, plane, missions, world, game.viewMode);
  updateGlare();
  document.getElementById('view-pill').textContent =
    game.viewMode === 'chase' ? 'VIEW · CHASE' : 'VIEW · COCKPIT';
}

requestAnimationFrame(frame);
