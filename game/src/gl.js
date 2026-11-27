// gl.js — raw WebGL1 setup, shaders, mesh builders and the render pipeline.
// No libraries, no network: everything here is hand-written for Senja Amphibi.
// Units: metres, radians, km/h. Column-major mat4 helpers included.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl', {
    antialias: true, alpha: false, depth: true, stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.95, 0.62, 0.38, 1);
  return gl;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function createProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(prog));
  }
  const out = { prog, attrib: {}, uniform: {} };
  const na = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const a = gl.getActiveAttrib(prog, i);
    out.attrib[a.name] = gl.getAttribLocation(prog, a.name);
  }
  const nu = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) {
    const u = gl.getActiveUniform(prog, i);
    out.uniform[u.name] = gl.getUniformLocation(prog, u.name);
  }
  return out;
}

// ---------------- main lit program ----------------
const MAIN_VS = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec3 aCol;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uWater;
uniform float uTime;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vCol;
varying vec3 vNorm;
varying vec3 vWorld;
varying float vFog;
void main() {
  vec3 p = aPos;
  vec3 n = aNorm;
  if (uWater > 0.5) {
    float t = uTime;
    float w = sin(p.x * 0.021 + t * 1.1) * 0.35
            + sin(p.z * 0.017 + t * 0.8) * 0.30
            + sin((p.x + p.z) * 0.011 + t * 0.6) * 0.25;
    p.y += w;
    n = normalize(vec3(
      -0.021 * 0.35 * cos(p.x * 0.021 + t * 1.1) - 0.011 * 0.25 * cos((p.x + p.z) * 0.011 + t * 0.6),
      1.0,
      -0.017 * 0.30 * cos(p.z * 0.017 + t * 0.8) - 0.011 * 0.25 * cos((p.x + p.z) * 0.011 + t * 0.6)));
  }
  vec4 wp = uModel * vec4(p, 1.0);
  vWorld = wp.xyz;
  vNorm = mat3(uModel) * n;
  vCol = aCol;
  vec4 vp = uView * wp;
  vFog = clamp((-vp.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_Position = uProj * vp;
}`;

const MAIN_FS = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNorm;
varying vec3 vWorld;
varying float vFog;
uniform vec3 uLightDir;
uniform vec3 uFogColor;
uniform vec3 uEmissive;
uniform float uSpec;
uniform vec3 uCamPos;
uniform float uAlpha;
void main() {
  vec3 n = normalize(vNorm);
  vec3 L = normalize(uLightDir);
  float diff = max(dot(n, L), 0.0);
  vec3 base = vCol * (0.40 + 0.78 * diff);
  vec3 viewDir = normalize(uCamPos - vWorld);
  if (uSpec > 0.5) {
    vec3 h = normalize(L + viewDir);
    float s = pow(max(dot(n, h), 0.0), 90.0);
    base += vec3(1.0, 0.85, 0.6) * s * 0.9;
    // Gentle sunset reflection at grazing angles — strong enough to read
    // as sun glint, weak enough that the sea stays teal.
    float fr = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    base = mix(base, vec3(1.0, 0.72, 0.5), fr * 0.18);
  }
  vec3 col = base + uEmissive;
  col = mix(col, uFogColor, vFog);
  gl_FragColor = vec4(col, uAlpha);
}`;

// ---------------- sky dome program ----------------
const SKY_VS = `
attribute vec3 aPos;
uniform mat4 uProj;
uniform mat4 uViewRot;
varying vec3 vDir;
void main() {
  vDir = aPos;
  vec4 p = uProj * uViewRot * vec4(aPos * 9000.0, 1.0);
  gl_Position = p;
}`;

const SKY_FS = `
precision mediump float;
varying vec3 vDir;
uniform vec3 uSunDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  vec3 horizon = vec3(1.0, 0.62, 0.34);
  vec3 mid = vec3(0.55, 0.42, 0.55);
  vec3 zenith = vec3(0.16, 0.28, 0.55);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
  col = mix(col, zenith, smoothstep(0.2, 0.7, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.8, 0.45) * pow(s, 350.0) * 1.6;
  col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.45;
  if (d.y < 0.0) col = mix(col, vec3(0.35, 0.45, 0.5), clamp(-d.y * 4.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------- spray point program ----------------
const PTS_VS = `
attribute vec3 aPos;
attribute vec3 aCol;
attribute float aSize;
uniform mat4 uProj;
uniform mat4 uView;
varying vec3 vCol;
void main() {
  vCol = aCol;
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_PointSize = aSize * 320.0 / max(1.0, -vp.z);
  gl_Position = uProj * vp;
}`;

const PTS_FS = `
precision mediump float;
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float a = (0.5 - d) * 1.6;
  gl_FragColor = vec4(vCol, a);
}`;

export function createPrograms(gl) {
  return {
    main: createProgram(gl, MAIN_VS, MAIN_FS),
    sky: createProgram(gl, SKY_VS, SKY_FS),
    pts: createProgram(gl, PTS_VS, PTS_FS),
  };
}

// ---------------- mesh builders ----------------
// A mesh builder accumulates positions / normals / colours / indices.
export function newMesh() {
  return { pos: [], norm: [], col: [], idx: [] };
}

function vert(b, x, y, z, nx, ny, nz, r, g, bl) {
  b.pos.push(x, y, z);
  b.norm.push(nx, ny, nz);
  b.col.push(r, g, bl);
  return b.pos.length / 3 - 1;
}

function quad(b, a, c, d, e) {
  b.idx.push(a, c, d, a, d, e);
}

function tri(b, a, c, d) {
  b.idx.push(a, c, d);
}

// Axis-aligned box centred at (cx, cy, cz), size (w, h, d), one colour.
export function addBox(b, cx, cy, cz, w, h, d, col) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const [r, g, bl] = col;
  const faces = [
    // +x
    [[x1, y0, z0, 1, 0, 0], [x1, y1, z0, 1, 0, 0], [x1, y1, z1, 1, 0, 0], [x1, y0, z1, 1, 0, 0]],
    // -x
    [[x0, y0, z1, -1, 0, 0], [x0, y1, z1, -1, 0, 0], [x0, y1, z0, -1, 0, 0], [x0, y0, z0, -1, 0, 0]],
    // +y
    [[x0, y1, z0, 0, 1, 0], [x0, y1, z1, 0, 1, 0], [x1, y1, z1, 0, 1, 0], [x1, y1, z0, 0, 1, 0]],
    // -y
    [[x0, y0, z1, 0, -1, 0], [x0, y0, z0, 0, -1, 0], [x1, y0, z0, 0, -1, 0], [x1, y0, z1, 0, -1, 0]],
    // +z
    [[x0, y0, z1, 0, 0, 1], [x1, y0, z1, 0, 0, 1], [x1, y1, z1, 0, 0, 1], [x0, y1, z1, 0, 0, 1]],
    // -z
    [[x1, y0, z0, 0, 0, -1], [x0, y0, z0, 0, 0, -1], [x0, y1, z0, 0, 0, -1], [x1, y1, z0, 0, 0, -1]],
  ];
  for (const f of faces) {
    const ids = f.map(([x, y, z, nx, ny, nz]) => vert(b, x, y, z, nx, ny, nz, r, g, bl));
    quad(b, ids[0], ids[1], ids[2], ids[3]);
  }
}

// Cylinder along Y, centred at (cx, cy, cz). rTop/rBot radii, h height.
export function addCylinder(b, cx, cy, cz, rTop, rBot, h, seg, col, capTop = true, capBot = true) {
  const [r, g, bl] = col;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const topRing = [], botRing = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    topRing.push(vert(b, cx + rTop * ca, y1, cz + rTop * sa, ca, 0, sa, r, g, bl));
    botRing.push(vert(b, cx + rBot * ca, y0, cz + rBot * sa, ca, 0, sa, r, g, bl));
  }
  for (let i = 0; i < seg; i++) {
    quad(b, botRing[i], botRing[i + 1], topRing[i + 1], topRing[i]);
  }
  if (capTop) {
    const c = vert(b, cx, y1, cz, 0, 1, 0, r, g, bl);
    for (let i = 0; i < seg; i++) tri(b, c, topRing[i + 1], topRing[i]);
  }
  if (capBot) {
    const c = vert(b, cx, y0, cz, 0, -1, 0, r, g, bl);
    for (let i = 0; i < seg; i++) tri(b, c, botRing[i], botRing[i + 1]);
  }
}

// Cone along Y (apex up), base radius r, height h, centred at (cx, cy, cz).
export function addCone(b, cx, cy, cz, r, h, seg, col) {
  const [rr, g, bl] = col;
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const apex = vert(b, cx, y1, cz, 0, 1, 0, rr, g, bl);
  const ring = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    ring.push(vert(b, cx + r * ca, y0, cz + r * sa, ca, 0.4, sa, rr, g, bl));
  }
  for (let i = 0; i < seg; i++) tri(b, apex, ring[i], ring[i + 1]);
  const c = vert(b, cx, y0, cz, 0, -1, 0, rr, g, bl);
  for (let i = 0; i < seg; i++) tri(b, c, ring[i + 1], ring[i]);
}

// Low-poly UV sphere centred at (cx, cy, cz), radius r.
export function addSphere(b, cx, cy, cz, r, segLat, segLon, col, squashY = 1) {
  const [rr, g, bl] = col;
  const grid = [];
  for (let j = 0; j <= segLat; j++) {
    const phi = (j / segLat) * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    const row = [];
    for (let i = 0; i <= segLon; i++) {
      const th = (i / segLon) * Math.PI * 2;
      const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
      row.push(vert(b, cx + r * nx, cy + r * ny * squashY, cz + r * nz, nx, ny, nz, rr, g, bl));
    }
    grid.push(row);
  }
  for (let j = 0; j < segLat; j++) {
    for (let i = 0; i < segLon; i++) {
      quad(b, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
    }
  }
}

// Torus in the XY plane (hole along Z), major radius R, tube r.
export function addTorus(b, cx, cy, cz, R, r, seg, segT, col) {
  const [rr, g, bl] = col;
  const grid = [];
  for (let j = 0; j <= segT; j++) {
    const v = (j / segT) * Math.PI * 2;
    const cv = Math.cos(v), sv = Math.sin(v);
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      const cu = Math.cos(u), su = Math.sin(u);
      const x = (R + r * cv) * cu;
      const y = (R + r * cv) * su;
      const z = r * sv;
      row.push(vert(b, cx + x, cy + y, cz + z, cv * cu, cv * su, sv, rr, g, bl));
    }
    grid.push(row);
  }
  for (let j = 0; j < segT; j++) {
    for (let i = 0; i < seg; i++) {
      quad(b, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
    }
  }
}

// Flat disc fan in the XY plane (for the prop disc), centred at origin.
export function addDisc(b, r, seg, col) {
  const [rr, g, bl] = col;
  const c = vert(b, 0, 0, 0, 0, 0, 1, rr, g, bl);
  let prev = null;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const id = vert(b, r * Math.cos(a), r * Math.sin(a), 0, 0, 0, 1, rr, g, bl);
    if (prev !== null) tri(b, c, prev, id);
    prev = id;
  }
}

// Grid mesh over [x0..x1] x [z0..z1]; height(x,z) and colour(x,z,h) callbacks.
export function addGrid(b, x0, x1, z0, z1, seg, heightFn, colorFn) {
  const grid = [];
  for (let j = 0; j <= seg; j++) {
    const z = z0 + ((z1 - z0) * j) / seg;
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const x = x0 + ((x1 - x0) * i) / seg;
      const h = heightFn(x, z);
      // Finite-difference normal.
      const e = 4;
      const hx = heightFn(x + e, z) - heightFn(x - e, z);
      const hz = heightFn(x, z + e) - heightFn(x, z - e);
      const inv = 1 / Math.hypot(hx, 2 * e, hz);
      const nx = -hx * inv, ny = 2 * e * inv, nz = -hz * inv;
      const c = colorFn(x, z, h);
      row.push(vert(b, x, h, z, nx, ny, nz, c[0], c[1], c[2]));
    }
    grid.push(row);
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      // Wound counter-clockwise seen from above so the top face is the
      // front face (the first version faced down and was culled).
      quad(b, grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]);
    }
  }
}

export function mergeMeshes(list) {
  const out = newMesh();
  for (const m of list) {
    const off = out.pos.length / 3;
    out.pos.push(...m.pos);
    out.norm.push(...m.norm);
    out.col.push(...m.col);
    for (const i of m.idx) out.idx.push(i + off);
  }
  return out;
}

export function uploadMesh(gl, m) {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const n = m.pos.length / 3;
  const inter = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    inter[i * 9 + 0] = m.pos[i * 3 + 0];
    inter[i * 9 + 1] = m.pos[i * 3 + 1];
    inter[i * 9 + 2] = m.pos[i * 3 + 2];
    inter[i * 9 + 3] = m.norm[i * 3 + 0];
    inter[i * 9 + 4] = m.norm[i * 3 + 1];
    inter[i * 9 + 5] = m.norm[i * 3 + 2];
    inter[i * 9 + 6] = m.col[i * 3 + 0];
    inter[i * 9 + 7] = m.col[i * 3 + 1];
    inter[i * 9 + 8] = m.col[i * 3 + 2];
  }
  gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx), gl.STATIC_DRAW);
  return { vbo, ibo, count: m.idx.length, verts: n };
}

export function bindMesh(gl, prog, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  const stride = 36;
  // Only bind the attributes this program actually uses: a program that
  // lacks aNorm/aCol (the sky dome) would otherwise steal attribute 0's
  // pointer and collapse the mesh.
  if (prog.attrib.aPos !== undefined) {
    gl.enableVertexAttribArray(prog.attrib.aPos);
    gl.vertexAttribPointer(prog.attrib.aPos, 3, gl.FLOAT, false, stride, 0);
  }
  if (prog.attrib.aNorm !== undefined) {
    gl.enableVertexAttribArray(prog.attrib.aNorm);
    gl.vertexAttribPointer(prog.attrib.aNorm, 3, gl.FLOAT, false, stride, 12);
  }
  if (prog.attrib.aCol !== undefined) {
    gl.enableVertexAttribArray(prog.attrib.aCol);
    gl.vertexAttribPointer(prog.attrib.aCol, 3, gl.FLOAT, false, stride, 24);
  }
}

// ---------------- mat4 (column-major) ----------------
export function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4LookAt(eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz);
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function mat4Translate(x, y, z) {
  const out = mat4Identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function mat4RotateX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const out = mat4Identity();
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function mat4RotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const out = mat4Identity();
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function mat4RotateZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const out = mat4Identity();
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

// Model matrix for the plane: translate, yaw (heading), pitch, bank (roll).
export function mat4Plane(x, y, z, heading, pitch, bank) {
  let m = mat4Multiply(mat4RotateY(heading), mat4RotateX(pitch));
  m = mat4Multiply(m, mat4RotateZ(bank));
  m = mat4Multiply(mat4Translate(x, y, z), m);
  return m;
}

// Rotation-only view matrix (for the sky dome): strip the translation.
export function mat4ViewRot(view) {
  const out = mat4Identity();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[j * 4 + i] = view[j * 4 + i];
  return out;
}

// Transform a point (x,y,z,1) by a mat4, return [x,y,z,w].
export function mat4TransformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}
