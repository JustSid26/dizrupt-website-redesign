import * as THREE from 'three';
import { isMobile } from './config';

/* =========================================================
   The city at night, around the mascot.

   Solid buildings with lit windows, drawn in one instanced pass:
   houses with pitched roofs on the edge of town, blocks of flats,
   office towers, and near the plaza glass skyscrapers — the
   tallest as tall as he is — with LED edges and a beacon on top.
   Asphalt streets with lane markings and pavements, a grand
   avenue up to his plaza, parks, trees, streetlights, traffic,
   and aeroplanes crossing overhead.

   It builds itself: every building has a start time spreading
   out from the billboard, and rises out of the ground with a line
   of light at its top; the streets and everything on them are
   laid down as the build passes. uBuild runs it, 0 → 1.

   Only the mascot is purple. Everything here takes other colours.
   ========================================================= */
export type Billboard = { center: THREE.Vector3; normal: THREE.Vector3; height: number };

const FOG = new THREE.Color('#0f1726'); // the horizon's own colour, so the far city melts into it

/* ---------- buildings ---------- */
const buildingVertex = /* glsl */ `
uniform float uBuild;
attribute vec3 aSize;    // width, height, depth
attribute vec3 aTint;
attribute float aStyle;  // 0 house, 1 flats, 2 office, 3 glass tower
attribute float aStart;
attribute float aSeed;
varying vec3 vLocal, vNormal, vTint, vSize, vWorld;
varying float vStyle, vSeed, vGrow;
void main() {
  float g = clamp((uBuild - aStart * 0.6) / 0.4, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 local = position * aSize;
  vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  vLocal = local; // floors stay where they are in the world, so rising uncovers them one by one
  vNormal = normal;
  vTint = aTint; vSize = aSize; vStyle = aStyle; vSeed = aSeed; vGrow = g; vWorld = world.xyz;
}`;

const buildingFragment = /* glsl */ `
uniform float uTime, uDim;
uniform vec3 uFog, uCam;
varying vec3 vLocal, vNormal, vTint, vSize, vWorld;
varying float vStyle, vSeed, vGrow;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 91.3) * 43758.5453); }
void main() {
  if (vGrow < 0.001) discard;
  vec3 n = normalize(vNormal);
  float h = vSize.y;
  float y = vLocal.y;
  // built only as far as the particles have landed; the roof goes on last
  // the particles land first; the solid building fades in a little way below them
  float front = clamp((vGrow - 0.22) / 0.78, 0.0, 1.0) * h;
  float fresh = smoothstep(front - 0.8, front, y); // the newest floors are still only particles
  if (y > front + 0.001 || (n.y > 0.5 && vGrow < 0.999)) discard;
  vec3 col;
  if (n.y > 0.5) {
    // the roof: dark, with a lit rim
    vec2 q = abs(vLocal.xz) / (vSize.xz * 0.5);
    float rim = smoothstep(0.86, 1.0, max(q.x, q.y));
    col = vTint * (0.02 + rim * 0.3);
  } else {
    bool alongX = abs(n.z) > 0.5;
    float width = alongX ? vSize.x : vSize.z;
    float u = (alongX ? vLocal.x : vLocal.z) + width * 0.5;
    float fh = vStyle < 0.5 ? 0.34 : vStyle < 1.5 ? 0.4 : vStyle < 2.5 ? 0.42 : 0.5;
    float bay = vStyle < 2.5 ? 0.3 : 0.46;
    vec2 cell = vec2(u / bay, y / fh);
    vec2 id = floor(cell) + (alongX ? vec2(0.0, 0.0) : vec2(57.0, 0.0)) + (n.x + n.z > 0.0 ? vec2(0.0, 311.0) : vec2(0.0));
    vec2 f = fract(cell);
    float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.78);
    // keep windows off the corners and the ground floor
    win *= step(0.12, u) * step(u, width - 0.12) * step(fh * 0.9, y) * step(y, h - fh * 0.4);
    float floorOn = step(0.18, hash(vec2(id.y, 7.0)));
    float on = step(vStyle < 0.5 ? 0.55 : 0.4, hash(id)) * floorOn;
    float warm = vStyle < 1.5 ? 0.85 : vStyle < 2.5 ? 0.35 : 0.1;
    vec3 lamp = mix(vec3(0.7, 0.88, 1.0), vec3(1.0, 0.76, 0.42), step(1.0 - warm, hash(id + 3.1)));
    lamp *= 0.38 + 0.3 * hash(id + 9.7);
    // a very few flicker
    lamp *= 1.0 - step(0.985, hash(id + 1.3)) * step(0.5, fract(uTime * 0.7 + hash(id + 2.0)));
    vec3 facade = vTint * (0.018 + 0.03 * (y / max(vSize.y, 1.0)));
    col = facade + lamp * win * on * (vStyle > 2.5 ? 0.9 : 1.1);
    if (vStyle > 2.5) {
      // glass: mullions and floor lines catch the light, and the panes carry the tint
      float mull = (1.0 - step(0.06, f.x)) + (1.0 - step(0.05, f.y)) * 0.6;
      col += vTint * (0.025 + mull * 0.12);
    }
    // lit corners: the edges of every building glow, the towers' brightest
    float edge = min(u, width - u);
    col += vTint * exp(-edge * (vStyle > 1.5 ? 14.0 : 20.0)) * (vStyle > 1.5 ? 0.42 : 0.18);
    // a crown of light round the top, and shopfronts at the bottom
    col += vTint * exp(-(h - y) * 7.0) * (vStyle > 1.5 ? 0.38 : 0.12);
    col += vec3(1.0, 0.72, 0.4) * step(y, 0.3) * step(0.08, y) * step(0.5, hash(vec2(floor(u / 0.6), 3.0))) * (vStyle > 0.5 ? 0.3 : 0.0);
  }
  // the line of light at the top while it is still going up
  col *= 1.0 - fresh * (1.0 - step(0.999, vGrow)) * 0.85;
  // the light is all in the particles; the mesh is only the dark mass they are on
  col = vTint * 0.015 + vec3(0.006, 0.007, 0.012);
  float d = distance(vWorld, uCam);
  col = mix(col, uFog, smoothstep(40.0, 130.0, d) * 0.6);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

/* ---------- the ground: streets, pavements, parks, the plaza ---------- */
const groundVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const groundFragment = /* glsl */ `
uniform float uPitch, uPlaza, uExtent, uBuild, uDim, uTime;
uniform vec3 uFog, uCam, uBoard;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = vWorld.xz;
  float r = length(p);
  // how far the build has got, spreading out from the billboard
  float reach = distance(p, uBoard.xz) / (uExtent * 1.7);
  if (reach * 0.85 > uBuild * 1.05) discard;
  vec3 col = vec3(0.022, 0.022, 0.03);
  // the street grid: asphalt, a dashed centre line, pavements either side
  vec2 g = abs(fract(p / uPitch + 0.5) - 0.5) * uPitch;
  float avenue = step(0.0, p.y) * step(abs(p.x), 2.4);
  float road = max(step(min(g.x, g.y), 0.9), avenue);
  float pave = step(min(g.x, g.y), 1.2) * (1.0 - road);
  col = mix(col, vec3(0.05, 0.05, 0.06), pave);
  col = mix(col, vec3(0.012, 0.012, 0.016), road);
  vec2 dash = fract(p / 0.9);
  float centre = (1.0 - step(0.04, g.x)) * step(0.5, dash.y) + (1.0 - step(0.04, g.y)) * step(0.5, dash.x);
  col += vec3(1.0, 0.72, 0.28) * centre * 0.7 * (1.0 - avenue);
  // the avenue: two carriageways with a lit median
  col += vec3(0.35, 0.9, 1.0) * avenue * (1.0 - step(0.07, abs(p.x))) * 0.8;
  col += vec3(0.9, 0.9, 1.0) * avenue * (1.0 - step(0.03, abs(abs(p.x) - 1.2))) * step(0.5, dash.y) * 0.5;
  // parks: some blocks are grass
  vec2 lot = floor(p / uPitch + 0.5);
  float park = step(0.9, hash(lot)) * (1.0 - road) * (1.0 - pave) * step(uPlaza + 3.0, r);
  col = mix(col, vec3(0.02, 0.07, 0.035), park);
  // the plaza: pale paving in rings, a glowing ring at its edge
  float plaza = 1.0 - step(uPlaza, r);
  col = mix(col, vec3(0.06, 0.065, 0.075) + 0.02 * step(0.5, fract(r * 0.8)), plaza);
  col += vec3(0.4, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.12, abs(r - uPlaza))) * 0.9;
  col += vec3(1.0, 0.85, 0.6) * (1.0 - smoothstep(0.0, 0.05, abs(r - uPlaza * 0.55))) * 0.5;
  // the edge of town fades into the dark
  col *= 1.0 - smoothstep(uExtent - 2.0, uExtent + 12.0, max(abs(p.x), abs(p.y)));
  col = mix(col, uFog, smoothstep(40.0, 130.0, distance(vWorld, uCam)));
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

/* ---------- everything small and bright: lights, trees, cars, beacons ---------- */
const LIGHT = 0, TREE = 1, HEAD = 2, TAIL = 3, BEACON = 4, PLINTH = 5, LED = 6;
const sparkVertex = /* glsl */ `
uniform float uTime, uPixelRatio, uBuild;
uniform vec3 uBoard;
uniform float uExtent;
attribute float aKind, aSeed, aStart;
attribute vec3 aDir;
varying float vKind, vSeed, vShow, vFade;
void main() {
  vec3 p = position;
  vShow = step(aStart * 0.72 + 0.2, uBuild + 0.001);
  if (aKind > 1.5 && aKind < 3.5) {
    float len = length(aDir);
    float t = fract(aSeed * 7.13 + uTime * (0.5 + fract(aSeed * 3.7) * 0.7) / max(len, 1.0));
    p += aDir * (t - 0.5);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aKind < 0.5 ? 2.2 : aKind < 1.5 ? 1.6 : aKind < 3.5 ? 1.6 : aKind < 4.5 ? 3.0 : aKind < 5.5 ? 1.1 : 1.4;
  gl_PointSize = max(1.5, 5.5 * s * uPixelRatio / -mv.z);
  vKind = aKind; vSeed = aSeed;
  vFade = 1.0 - smoothstep(50.0, 130.0, -mv.z);
}`;
const sparkFragment = /* glsl */ `
uniform float uTime, uDim;
varying float vKind, vSeed, vShow, vFade;
void main() {
  if (vShow < 0.5) discard;
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  vec3 col; float alpha = 0.9;
  if (vKind < 0.5) { col = vec3(1.0, 0.7, 0.35); a = a * a; }                      // streetlight
  else if (vKind < 1.5) { col = mix(vec3(0.12, 0.55, 0.25), vec3(0.35, 0.85, 0.35), fract(vSeed * 13.0)); alpha = 0.55; }
  else if (vKind < 2.5) { col = vec3(1.0, 0.97, 0.88); }                            // headlights
  else if (vKind < 3.5) { col = vec3(1.0, 0.12, 0.1); }                             // tail lights
  else if (vKind < 4.5) { col = vec3(1.0, 0.15, 0.2); alpha = 0.2 + 0.8 * step(0.55, fract(uTime * 0.7 + vSeed)); }
  else if (vKind < 5.5) { col = vec3(0.4, 0.95, 1.0); alpha = 0.5; }                // the plinth's rings
  else { col = mix(vec3(0.2, 0.9, 1.0), vec3(1.0, 0.35, 0.7), step(0.5, fract(vSeed * 5.0))); alpha = 0.8; }
  gl_FragColor = vec4(col * uDim, a * alpha * vFade);
}`;

/* ---------- aeroplanes ---------- */
function makePlane() {
  const pts: number[] = [];
  const col: number[] = [];
  const add = (x: number, y: number, z: number, c: [number, number, number]) => {
    pts.push(x, y, z);
    col.push(...c);
  };
  const body: [number, number, number] = [0.55, 0.58, 0.65];
  for (let i = 0; i <= 30; i++) add(0, 0, -0.9 + i * 0.06, body); // fuselage
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * 1.1;
    add(x, 0, 0.1 - x * 0.25, body);
    add(-x, 0, 0.1 - x * 0.25, body);
  }
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * 0.4;
    add(x, 0, -0.8, body);
    add(-x, 0, -0.8, body);
  }
  for (let i = 0; i < 6; i++) add(0, i * 0.05, -0.85, body);
  const lights = { red: pts.length / 3, green: pts.length / 3 + 1, strobe: pts.length / 3 + 2 };
  add(-1.1, 0, -0.17, [1, 0.1, 0.1]);
  add(1.1, 0, -0.17, [0.1, 1, 0.3]);
  add(0, 0.3, -0.85, [1, 1, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return { points: p, lights };
}

export function createCity(pixelRatio: number, billboard: Billboard, GROUND: number, plinthTop: number, mascotTop: number) {
  const EXTENT = isMobile ? 34 : 48;
  const PITCH = 5.6;
  const PLAZA = 11;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const group = new THREE.Group();
  const boardXZ = new THREE.Vector2(billboard.center.x, billboard.center.z);
  const startAt = (x: number, z: number) =>
    Math.min(1, Math.hypot(x - boardXZ.x, z - boardXZ.y) / (EXTENT * 1.7)) * 0.85 + rnd() * 0.12;
  const TALL = mascotTop - GROUND; // the tallest towers stand as tall as he does

  /* ---- plan the buildings ---- */
  type B = { x: number; z: number; w: number; d: number; h: number; style: number; tint: THREE.Color; start: number };
  const blds: B[] = [];
  const glass = ['#2ad4ff', '#58c4ff', '#3fe0c0', '#7fd8ff', '#ff5ba8'];
  const office = ['#9fc4ff', '#dfe8ff', '#6fb0ff', '#ffd27a'];
  const flats = ['#ffb070', '#ff9a5a', '#ffd08a', '#8fd0ff'];
  const pick = (a: string[]) => new THREE.Color(a[Math.floor(rnd() * a.length)]);
  for (let gx = -EXTENT; gx < EXTENT; gx += PITCH) {
    for (let gz = -EXTENT; gz < EXTENT; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      const r = Math.hypot(cx, cz);
      if (r < PLAZA + 2 || r > EXTENT) continue;
      if (cz > 0 && Math.abs(cx) < PITCH * 0.6) continue; // the avenue up to his plaza stays open
      const nearBoard = Math.hypot(cx - boardXZ.x, cz - boardXZ.y);
      if (nearBoard < 3.6) continue;
      const lot = PITCH - 2.6; // the buildable part between the pavements
      const zone = (r - PLAZA) / (EXTENT - PLAZA);
      const start = startAt(cx, cz);
      // keep the billboard in view: nothing near it stands above it
      const cap = nearBoard < 12 ? billboard.center.y - billboard.height / 2 - GROUND - 0.5 : Infinity;
      const put = (x: number, z: number, w: number, d: number, h: number, style: number, tint: THREE.Color) =>
        blds.push({ x, z, w, d, h: Math.min(h, cap), style, tint, start });
      const inView = cz > 0 && Math.abs(cx) < 16 + cz * 0.25; // the wedge the camera looks at him through
      if (inView && zone < 0.45) {
        const n = 1 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const w = (lot / n) * 0.85;
          put(gx + 1.3 + (lot / n) * (i + 0.5), cz, w, lot * (0.55 + rnd() * 0.35), 1.8 + rnd() * 3, 1, rnd() < 0.4 ? pick(office) : pick(flats));
        }
      } else if (zone < 0.22 && rnd() < 0.6) {
        // the landmark ring: glass skyscrapers, the tallest as tall as he is
        const h = TALL * (0.55 + rnd() * 0.45);
        put(cx, cz, lot * (0.7 + rnd() * 0.25), lot * (0.7 + rnd() * 0.25), h, 3, pick(glass));
      } else if (zone < 0.45) {
        const n = rnd() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const w = (lot / n) * 0.9;
          const glassy = rnd() < 0.35;
          put(gx + 1.3 + (lot / n) * (i + 0.5), cz, w, lot * (0.6 + rnd() * 0.35), 6 + rnd() * 10 * (1 - zone), glassy ? 3 : 2, glassy ? pick(glass) : pick(office));
        }
      } else if (zone < 0.72) {
        const n = 1 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const w = (lot / n) * 0.88;
          put(gx + 1.3 + (lot / n) * (i + 0.5), cz + (rnd() - 0.5) * 0.4, w, lot * (0.5 + rnd() * 0.4), 2 + rnd() * 3.5, rnd() < 0.3 ? 2 : 1, rnd() < 0.3 ? pick(office) : pick(flats));
        }
      } else {
        const n = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const w = (lot / n) * 0.7;
          put(gx + 1.3 + (lot / n) * (i + 0.5), cz + (rnd() - 0.5) * 0.8, w, 1 + rnd() * 0.5, 0.7 + rnd() * 0.3, 0, pick(flats));
        }
      }
    }
  }
  // the billboard's tower
  const bb = billboard;
  blds.push({
    x: bb.center.x - bb.normal.x * 1.2, z: bb.center.z - bb.normal.z * 1.2, w: 2.4, d: 2.4,
    h: bb.center.y - bb.height / 2 - 0.3 - GROUND, style: 2, tint: new THREE.Color('#dfe8ff'), start: 0,
  });

  /* ---- build them: one instanced box pass ---- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const N = blds.length;
  const size = new Float32Array(N * 3), tint = new Float32Array(N * 3), style = new Float32Array(N), start = new Float32Array(N), bseed = new Float32Array(N);
  const buildingUniforms = {
    uBuild: { value: 1 }, uTime: { value: 0 }, uDim: { value: 1 },
    uFog: { value: FOG }, uCam: { value: new THREE.Vector3() },
  };
  const bMat = new THREE.ShaderMaterial({ uniforms: buildingUniforms, vertexShader: buildingVertex, fragmentShader: buildingFragment });
  const bMesh = new THREE.InstancedMesh(boxGeo, bMat, N);
  const m = new THREE.Matrix4();
  blds.forEach((b, i) => {
    m.makeTranslation(b.x, GROUND, b.z);
    bMesh.setMatrixAt(i, m);
    size.set([b.w, b.h, b.d], i * 3);
    tint.set([b.tint.r, b.tint.g, b.tint.b], i * 3);
    style[i] = b.style;
    start[i] = b.start;
    bseed[i] = rnd();
  });
  boxGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
  boxGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  boxGeo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 1));
  boxGeo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 1));
  boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(bseed, 1));
  bMesh.frustumCulled = false;
  group.add(bMesh);

  // the houses' pitched roofs: a prism on each, rising with it
  const houses = blds.filter((b) => b.style === 0);
  const prism = new THREE.BufferGeometry();
  // a unit gable, ridge along x, sitting on y = 0
  const v = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0.5, 0, -0.5, 0.5, 0, // back slope
    -0.5, 0, 0.5, -0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0, 0.5, // front slope
    -0.5, 0, -0.5, -0.5, 0.5, 0, -0.5, 0, 0.5, // gable ends
    0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0.5, 0,
  ];
  prism.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  prism.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13]);
  prism.computeVertexNormals();
  const roofMat = new THREE.ShaderMaterial({
    uniforms: buildingUniforms,
    vertexShader: /* glsl */ `
      uniform float uBuild;
      attribute vec3 aSize; attribute vec3 aTint; attribute float aStart;
      varying vec3 vTint, vWorld; varying float vGrow, vY;
      void main() {
        float g = clamp((uBuild - aStart * 0.6) / 0.4, 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        vec3 local = position * vec3(aSize.x, min(aSize.x, aSize.z), aSize.z) * step(0.999, g);
        local.y += aSize.y;
        vec4 w = modelMatrix * instanceMatrix * vec4(local, 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
        vTint = aTint; vGrow = g; vWorld = w.xyz; vY = position.y;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog, uCam; uniform float uDim;
      varying vec3 vTint, vWorld; varying float vGrow, vY;
      void main() {
        if (vGrow < 0.999) discard;
        vec3 col = vec3(0.045, 0.02, 0.016) + vTint * 0.35 * smoothstep(0.44, 0.5, vY); // tiles, lit ridge
        col = mix(col, uFog, smoothstep(40.0, 130.0, distance(vWorld, uCam)));
        gl_FragColor = vec4(col * uDim, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const roofs = new THREE.InstancedMesh(prism, roofMat, Math.max(1, houses.length));
  const rs = new Float32Array(houses.length * 3), rt = new Float32Array(houses.length * 3), rst = new Float32Array(houses.length);
  houses.forEach((b, i) => {
    // the ridge runs the long way
    m.makeRotationY(b.w >= b.d ? 0 : Math.PI / 2).setPosition(b.x, GROUND, b.z);
    roofs.setMatrixAt(i, m);
    const along = b.w >= b.d;
    rs.set([along ? b.w : b.d, b.h, along ? b.d : b.w], i * 3);
    rt.set([1.0, 0.5, 0.3], i * 3);
    rst[i] = b.start;
  });
  prism.setAttribute('aSize', new THREE.InstancedBufferAttribute(rs, 3));
  prism.setAttribute('aTint', new THREE.InstancedBufferAttribute(rt, 3));
  prism.setAttribute('aStart', new THREE.InstancedBufferAttribute(rst, 1));
  roofs.count = houses.length;
  roofs.frustumCulled = false;
  group.add(roofs);

  /* ---- the railway's plan: an elevated ring on pillars round downtown ---- */
  const RAIL_R = Math.min(30, EXTENT * 0.62);
  const RAIL_Y = GROUND + 6.4;
  const RAIL_H = RAIL_Y - GROUND;
  const pillarCount = 48;
  // no randomness here: the track's shader works out the same start times from its position
  const railStart = (x: number, z: number) => Math.min(1, Math.hypot(x - boardXZ.x, z - boardXZ.y) / (EXTENT * 1.7)) * 0.85;

  /* ---- construction: each building is assembled out of particles, floor by floor ----
     Points sampled over its faces stream in from a loose cloud around it and land on its surface in
     order of height, bottom first, the way the mascot is lit from the top down; the solid facade is
     only drawn below the line where they have landed. Once it is up they burn out. */
  const cp: number[] = [], cf: number[] = [], cr: number[] = [], cc: number[] = [];
  const dense = isMobile ? 0.5 : 1;
  const push = (x: number, y: number, z: number, b: B, col: THREE.Color, k = 1) => {
    cp.push(x, y, z);
    cf.push((y - GROUND) / b.h, b.start, b.h);
    cr.push(rnd(), rnd(), rnd(), rnd());
    cc.push(col.r * k, col.g * k, col.b * k);
  };
  const warmLamp = new THREE.Color(1.0, 0.76, 0.42), coolLamp = new THREE.Color(0.72, 0.88, 1.0);
  const lampCol = new THREE.Color();
  /* The buildings are made of their particles and stay that way: every lit window is a little
     cluster of warm or cool light, the wall between them a sparse dust in the building's own colour,
     and each corner and the roof's edge a fine line of points. The mesh behind is only a dark body. */
  for (const b of blds) {
    const fh = b.style === 0 ? 0.34 : b.style === 1 ? 0.4 : b.style === 2 ? 0.42 : 0.5;
    const bay = b.style < 3 ? 0.3 : 0.46;
    const litP = b.style === 0 ? 0.45 : 0.55;
    const warm = b.style <= 1 ? 0.8 : b.style === 2 ? 0.35 : 0.12;
    const faces = [
      { n: [0, 0, 1], w: b.w, a: 'x' }, { n: [0, 0, -1], w: b.w, a: 'x' },
      { n: [1, 0, 0], w: b.d, a: 'z' }, { n: [-1, 0, 0], w: b.d, a: 'z' },
    ];
    for (const f of faces) {
      const at = (u: number) => ({
        x: (f.a === 'x' ? b.x + u : b.x + f.n[0] * b.w * 0.5) + f.n[0] * 0.02,
        z: (f.a === 'x' ? b.z + f.n[2] * b.d * 0.5 : b.z + u) + f.n[2] * 0.02,
      });
      const bays = Math.max(1, Math.floor((f.w - 0.2) / bay));
      const floors = Math.max(1, Math.floor((b.h - fh * 0.6) / fh));
      for (let fl = 0; fl < floors; fl++) {
        const floorOn = rnd() > 0.15;
        for (let bi = 0; bi < bays; bi++) {
          const cu = -f.w / 2 + 0.1 + (bi + 0.5) * ((f.w - 0.2) / bays);
          const cy = GROUND + fh * 0.8 + fl * fh;
          if (floorOn && rnd() < litP) {
            lampCol.copy(rnd() < warm ? warmLamp : coolLamp).multiplyScalar(0.6 + rnd() * 0.5);
            const n = Math.max(1, Math.round((b.style === 3 ? 4 : 3) * dense));
            for (let k = 0; k < n; k++) {
              const p = at(cu + (rnd() - 0.5) * bay * 0.45);
              push(p.x, cy + (rnd() - 0.5) * fh * 0.4, p.z, b, lampCol);
            }
          } else if (rnd() < 0.7 * dense) {
            const p = at(cu + (rnd() - 0.5) * bay);
            push(p.x, cy + (rnd() - 0.5) * fh, p.z, b, b.tint, 0.3);
          }
        }
      }
    }
    // the corners and the roof's edge, as lines of points in its colour
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of cs) {
      for (let y = 0; y < b.h; y += 0.07 / dense) push(b.x + sx * b.w * 0.5, GROUND + y, b.z + sz * b.d * 0.5, b, b.tint, 0.9);
    }
    const per = 2 * (b.w + b.d);
    for (let t = 0; t < per; t += 0.06 / dense) {
      const [x, z] = t < b.w ? [-b.w / 2 + t, -b.d / 2]
        : t < b.w + b.d ? [b.w / 2, -b.d / 2 + (t - b.w)]
        : t < 2 * b.w + b.d ? [b.w / 2 - (t - b.w - b.d), b.d / 2]
        : [-b.w / 2, b.d / 2 - (t - 2 * b.w - b.d)];
      push(b.x + x, GROUND + b.h, b.z + z, b, b.tint, 1.1);
    }
  }
  // the railway goes up the same way: pillars rise out of the particles, then the deck is laid on top
  const railTint = new THREE.Color('#2f7d96'); // dimmer than the buildings: the rail is structure, not light
  for (let i = 0; i < pillarCount; i++) {
    const a = (i / pillarCount) * Math.PI * 2;
    const px = Math.cos(a) * RAIL_R, pz = Math.sin(a) * RAIL_R;
    const st = railStart(px, pz);
    for (let k = 0; k < (isMobile ? 70 : 150); k++) {
      const ang = rnd() * Math.PI * 2;
      const y = rnd() * RAIL_H;
      cp.push(px + Math.cos(ang) * 0.19, GROUND + y, pz + Math.sin(ang) * 0.19);
      cf.push(y / RAIL_H, st, RAIL_H);
      cr.push(rnd(), rnd(), rnd(), rnd());
      cc.push(railTint.r, railTint.g, railTint.b);
    }
  }
  for (let k = 0; k < (isMobile ? 2500 : 6000); k++) {
    const a = rnd() * Math.PI * 2;
    const rr = RAIL_R + (rnd() - 0.5) * 0.9;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    cp.push(x, RAIL_Y + (rnd() - 0.5) * 0.12, z);
    // the deck lands after the pillars under it have topped out
    cf.push(0.97 + rnd() * 0.03, railStart(x, z), RAIL_H);
    cr.push(rnd(), rnd(), rnd(), rnd());
    cc.push(railTint.r, railTint.g, railTint.b);
  }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cGeo.setAttribute('aFrac', new THREE.Float32BufferAttribute(cf, 3));
  cGeo.setAttribute('aRand', new THREE.Float32BufferAttribute(cr, 4));
  cGeo.setAttribute('aTint', new THREE.Float32BufferAttribute(cc, 3));
  const constructUniforms = { uBuild: { value: 1 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uDim: { value: 1 } };
  const construct = new THREE.Points(cGeo, new THREE.ShaderMaterial({
    uniforms: constructUniforms,
    vertexShader: /* glsl */ `
      uniform float uBuild, uTime, uPixelRatio;
      attribute vec3 aFrac;   // x: how high up it sits (0..1), y: its building's start, z: that building's height
      attribute vec4 aRand;
      attribute vec3 aTint;
      varying vec3 vTint; varying float vA, vShine;
      void main() {
        float g = clamp((uBuild - aFrac.y * 0.6) / 0.4, 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        // its turn comes when the build reaches its height: it rises from the ground beside the building
        // and spirals in to its place
        float t = clamp((g - aFrac.x * 0.8) / 0.22, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float ang = aRand.x * 6.2832 + (1.0 - e) * 5.0;
        float rad = (1.2 + aRand.y * 2.2) * (1.0 - e);
        vec3 start = vec3(cos(ang) * rad, -aFrac.x * aFrac.z * (1.0 - e) + (aRand.z - 0.5) * 0.6 * (1.0 - e), sin(ang) * rad);
        vec3 p = position + start;
        /* Alive once it lands, the way the mascot is: each point drifts on its own small orbit, and
           slow bands of brighter light climb up through the building like the rays in his aurora. */
        float ph = aRand.w * 6.2832;
        p += vec3(sin(uTime * (0.7 + aRand.x) + ph), sin(uTime * (0.9 + aRand.y) + ph * 1.7) * 0.6, cos(uTime * (0.8 + aRand.z) + ph)) * 0.045 * e;
        float ray = 0.5 + 0.5 * sin(position.y * 1.6 - uTime * 1.4 + (position.x + position.z) * 0.35);
        vShine = 0.75 + 1.1 * pow(ray, 3.0) + 0.5 * step(0.985, fract(aRand.w * 37.0 + uTime * 0.13));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.8, (2.4 + 4.2 * (1.0 - e)) * 7.0 * uPixelRatio / -mv.z);
        // on its way and just landed it is bright; once the facade has come up behind it, it settles to a sparkle
        vA = step(0.001, t);
        // white while it flies, its own colour once it lands
        vTint = mix(vec3(0.95, 0.95, 1.0), aTint, e);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim;
      varying vec3 vTint; varying float vA, vShine;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        // a soft glow round a bright core, so each point reads as a light, not a dot
        float core = smoothstep(0.5, 0.0, d);
        float glow = core * core * 0.6 + exp(-d * d * 40.0) * 0.8;
        gl_FragColor = vec4(vTint * uDim * vShine * 1.15, glow * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  construct.frustumCulled = false;
  group.add(construct);

  /* ---- the night sky: a clear, bright one, deep blue at the top, glowing at the horizon ---- */
  const skyUniforms = { uTime: { value: 0 }, uDim: { value: 1 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(360, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uDim;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 zenith = vec3(0.012, 0.02, 0.055);
          vec3 mid = vec3(0.025, 0.045, 0.1);
          vec3 horizon = vec3(0.06, 0.09, 0.15);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
          col = mix(col, zenith, smoothstep(0.25, 0.9, h));
          // a band of the galaxy across the sky
          float band = exp(-pow((vDir.y - 0.35 + vDir.x * 0.4) * 5.0, 2.0));
          col += vec3(0.025, 0.035, 0.05) * band;
          col = mix(col, vec3(0.04, 0.05, 0.08), smoothstep(0.02, -0.2, h)); // below the horizon
          gl_FragColor = vec4(col * uDim, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false,
    }),
  );
  sky.renderOrder = -2000;
  sky.frustumCulled = false;
  const starPos: number[] = [], starSeed: number[] = [];
  for (let i = 0; i < (isMobile ? 1800 : 4000); i++) {
    const v3 = new THREE.Vector3().randomDirection();
    if (v3.y < -0.05) v3.y = -v3.y;
    // more of them along the galaxy's band
    if (rnd() < 0.35) v3.y = 0.35 - v3.x * 0.4 + (rnd() - 0.5) * 0.25;
    v3.normalize().multiplyScalar(340);
    starPos.push(v3.x, v3.y, v3.z);
    starSeed.push(rnd());
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(starSeed, 1));
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    uniforms: { ...skyUniforms, uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPixelRatio; attribute float aSeed; varying float vB; varying float vS;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float big = step(0.93, aSeed);
        gl_PointSize = (1.2 + big * 2.2 + aSeed * 1.2) * uPixelRatio;
        vB = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 2.5) + aSeed * 60.0));
        vS = aSeed;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim; varying float vB; varying float vS;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 col = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), step(0.7, fract(vS * 13.0)));
        gl_FragColor = vec4(col * uDim, smoothstep(0.5, 0.0, d) * vB);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.renderOrder = -1999;
  stars.frustumCulled = false;
  group.add(sky, stars);

  /* ---- the ground ---- */
  const groundUniforms = {
    uPitch: { value: PITCH }, uPlaza: { value: PLAZA }, uExtent: { value: EXTENT }, uBuild: { value: 1 },
    uDim: { value: 1 }, uTime: { value: 0 }, uFog: { value: FOG }, uCam: buildingUniforms.uCam,
    uBoard: { value: billboard.center.clone() },
  };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT * 2 + 40, EXTENT * 2 + 40).rotateX(-Math.PI / 2).translate(0, GROUND, 0),
    new THREE.ShaderMaterial({ uniforms: groundUniforms, vertexShader: groundVertex, fragmentShader: groundFragment }),
  );
  ground.frustumCulled = false;
  group.add(ground);

  /* ---- the small bright things ---- */
  const sp: number[] = [], sk: number[] = [], ss: number[] = [], sst: number[] = [], sd: number[] = [];
  const add = (x: number, y: number, z: number, k: number, st: number, dx = 0, dy = 0, dz = 0) => {
    sp.push(x, y, z); sk.push(k); ss.push(rnd()); sst.push(st); sd.push(dx, dy, dz);
  };
  // streetlights along the pavements, trees between them
  for (let g = -EXTENT; g <= EXTENT; g += PITCH) {
    for (let t = -EXTENT; t <= EXTENT; t += 1.4) {
      for (const [x, z] of [[g + 1.05, t], [t, g + 1.05], [g - 1.05, t], [t, g - 1.05]]) {
        const r = Math.hypot(x, z);
        if (r < PLAZA + 0.5 || r > EXTENT) continue;
        const st = startAt(x, z);
        if (rnd() < 0.5) add(x, GROUND + 0.45, z, LIGHT, st);
        else if (rnd() < 0.55) {
          // a tree: a ball of leaves on a short trunk
          const hgt = 0.35 + rnd() * 0.25;
          for (let k = 0; k < 22; k++) {
            const v3 = new THREE.Vector3().randomDirection().multiplyScalar(0.3 * Math.cbrt(rnd()));
            add(x + v3.x, GROUND + hgt + 0.2 + v3.y * 0.9, z + v3.z, TREE, st);
          }
        }
      }
    }
  }
  // parks get their own trees
  for (let gx = -EXTENT; gx < EXTENT; gx += PITCH) {
    for (let gz = -EXTENT; gz < EXTENT; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      const r = Math.hypot(cx, cz);
      const lotHash = (() => { const s = Math.sin(Math.floor(cx / PITCH + 0.5) * 12.9898 + Math.floor(cz / PITCH + 0.5) * 78.233) * 43758.5453; return s - Math.floor(s); })();
      if (lotHash < 0.9 || r < PLAZA + 3 || r > EXTENT) continue;
      for (let t = 0; t < 7; t++) {
        const x = cx + (rnd() - 0.5) * (PITCH - 2.8), z = cz + (rnd() - 0.5) * (PITCH - 2.8);
        for (let k = 0; k < 26; k++) {
          const v3 = new THREE.Vector3().randomDirection().multiplyScalar(0.36 * Math.cbrt(rnd()));
          add(x + v3.x, GROUND + 0.6 + v3.y, z + v3.z, TREE, startAt(cx, cz));
        }
      }
    }
  }
  // the towers' beacons and LED spines
  for (const b of blds) {
    if (b.style < 2) continue;
    if (b.style === 3 || b.h > 9) {
      const spire = 0.6 + rnd() * 1.4;
      for (let y = 0; y < spire; y += 0.08) add(b.x, GROUND + b.h + y, b.z, LED, b.start);
      add(b.x, GROUND + b.h + spire, b.z, BEACON, b.start);
    }
  }
  // his plinth: rings of light
  for (let i = 0; i < 1600; i++) {
    const a = rnd() * Math.PI * 2;
    const y = GROUND + Math.round(rnd() * 4) / 4 * (plinthTop - GROUND);
    add(Math.cos(a) * 3.2, y, Math.sin(a) * 3.2, PLINTH, 0.3);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sparkGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(sk, 1));
  sparkGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
  sparkGeo.setAttribute('aStart', new THREE.Float32BufferAttribute(sst, 1));
  sparkGeo.setAttribute('aDir', new THREE.Float32BufferAttribute(sd, 3));
  const sparkUniforms = {
    uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uBuild: { value: 1 }, uDim: { value: 1 },
    uBoard: { value: billboard.center.clone() }, uExtent: { value: EXTENT },
  };
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    uniforms: sparkUniforms, vertexShader: sparkVertex, fragmentShader: sparkFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparks.frustumCulled = false;
  group.add(sparks);

  // the plinth itself
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.4, plinthTop - GROUND, 48, 1).translate(0, (GROUND + plinthTop) / 2, 0),
    new THREE.MeshBasicMaterial({ color: '#0a0a12' }),
  );
  group.add(plinth);

  /* ---- traffic: cars with bodies, headlights and tail lights, driving the streets ---- */
  type Lane = [number, number, number, number, number]; // x0, z0, dirX, dirZ, length (centred on x0,z0)
  const lanes: Lane[] = [];
  for (let g = -EXTENT; g <= EXTENT; g += PITCH) {
    for (const way of [-1, 1]) {
      lanes.push([g + way * 0.42, 0, 0, way, EXTENT * 2]);
      lanes.push([0, g - way * 0.42, way, 0, EXTENT * 2]);
    }
  }
  for (const way of [-1, 1]) lanes.push([way * 0.75, PLAZA + (EXTENT - PLAZA) / 2, 0, -way, EXTENT - PLAZA]);
  const perLane = isMobile ? 3 : 6;
  const carCount = lanes.length * perLane;
  const carGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cLane = new Float32Array(carCount * 4), cLen = new Float32Array(carCount), cSpeed = new Float32Array(carCount), cPhase = new Float32Array(carCount), cCol = new Float32Array(carCount * 3);
  const paints = ['#e8e8ee', '#1b1d26', '#c0342b', '#2c5dbd', '#f2c230', '#7a7f8c', '#1f6f5c', '#ececec'];
  let ci = 0;
  for (const l of lanes) {
    for (let k = 0; k < perLane; k++, ci++) {
      cLane.set([l[0], l[1], l[2], l[3]], ci * 4);
      cLen[ci] = l[4];
      cSpeed[ci] = 1.6 + rnd() * 1.6;
      cPhase[ci] = (k + rnd() * 0.6) / perLane;
      const c = new THREE.Color(paints[Math.floor(rnd() * paints.length)]);
      cCol.set([c.r, c.g, c.b], ci * 3);
    }
  }
  carGeo.setAttribute('aLane', new THREE.InstancedBufferAttribute(cLane, 4));
  carGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(cLen, 1));
  carGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(cSpeed, 1));
  carGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(cPhase, 1));
  carGeo.setAttribute('aPaint', new THREE.InstancedBufferAttribute(cCol, 3));
  const carUniforms = { uTime: buildingUniforms.uTime, uBuild: buildingUniforms.uBuild, uDim: buildingUniforms.uDim, uFog: buildingUniforms.uFog, uCam: buildingUniforms.uCam, uGround: { value: GROUND }, uPlaza: { value: PLAZA } };
  const cars = new THREE.InstancedMesh(carGeo, new THREE.ShaderMaterial({
    uniforms: carUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime, uGround, uBuild, uPlaza;
      attribute vec4 aLane; attribute float aLen, aSpeed, aPhase; attribute vec3 aPaint;
      varying vec3 vLocal, vPaint, vWorld, vN; varying float vHide;
      void main() {
        float t = fract(aPhase + uTime * aSpeed / aLen);
        vec2 dir = aLane.zw;
        vec2 c = aLane.xy + dir * (t - 0.5) * aLen;
        // a body with a cabin: the top half is narrower, which the fragment shades as glass
        vec3 lp = position;
        float cabin = step(0.5, lp.y);
        lp.x *= mix(1.0, 0.8, cabin);
        lp.z = lp.z * mix(1.0, 0.55, cabin) - cabin * 0.04;
        vec3 local = lp * vec3(0.32, 0.24, 0.64);
        // turn to face its way
        vec2 side = vec2(dir.y, -dir.x);
        vec3 w = vec3(c.x + side.x * local.x + dir.x * local.z, uGround + 0.02 + local.y, c.y + side.y * local.x + dir.y * local.z);
        // they drive round the plaza, not through it, and only once the streets are laid
        vHide = step(length(c), uPlaza + 0.6) + step(uBuild, 0.9);
        vLocal = lp; vPaint = aPaint; vWorld = w; vN = normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog, uCam; uniform float uDim;
      varying vec3 vLocal, vPaint, vWorld, vN; varying float vHide;
      void main() {
        if (vHide > 0.5) discard;
        vec3 col = vPaint * (0.25 + 0.2 * max(vN.y, 0.0));
        if (vLocal.y > 0.5) col = mix(col, vec3(0.08, 0.12, 0.18), 0.7); // glass
        // headlights at the front, tail lights at the back
        if (vN.z > 0.5 && vLocal.y < 0.5) col = vec3(1.4, 1.35, 1.2) * step(0.2, abs(vLocal.x)) + col * 0.3;
        if (vN.z < -0.5 && vLocal.y < 0.5) col = vec3(1.2, 0.08, 0.06) * step(0.2, abs(vLocal.x)) + col * 0.3;
        col = mix(col, uFog, smoothstep(40.0, 130.0, distance(vWorld, uCam)));
        gl_FragColor = vec4(col * uDim, 1.0);
      }`,
  }), carCount);
  cars.frustumCulled = false;
  group.add(cars);
  /* ---- the railway: an elevated line on pillars ringing downtown, and two trains on it ---- */
  const railPts: number[] = [], railK: number[] = [], railS: number[] = [], railSt: number[] = [], railD: number[] = [];
  for (let a = 0; a < Math.PI * 2; a += 0.004) {
    for (const off of [-0.32, 0.32]) {
      railPts.push(Math.cos(a) * (RAIL_R + off), RAIL_Y, Math.sin(a) * (RAIL_R + off));
      railK.push(LED); railS.push(rnd()); railSt.push(Math.min(1, railStart(Math.cos(a) * RAIL_R, Math.sin(a) * RAIL_R) + 0.35)); railD.push(0, 0, 0);
    }
  }
  // the rails are lit strips, drawn with the same lights as the streets
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPts, 3));
  railGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(railK, 1));
  railGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(railS, 1));
  railGeo.setAttribute('aStart', new THREE.Float32BufferAttribute(railSt, 1));
  railGeo.setAttribute('aDir', new THREE.Float32BufferAttribute(railD, 3));
  const rails = new THREE.Points(railGeo, sparks.material);
  rails.frustumCulled = false;
  group.add(rails);
  const railUniforms = { uBuild: buildingUniforms.uBuild, uBoard: { value: billboard.center.clone() }, uExtent: { value: EXTENT }, uGround: { value: GROUND }, uH: { value: RAIL_H }, uDim: buildingUniforms.uDim };
  const railGrow = /* glsl */ `
    uniform float uBuild, uExtent, uGround, uH, uDim;
    uniform vec3 uBoard;
    float growAt(vec3 w) {
      float st = min(1.0, distance(w.xz, uBoard.xz) / (uExtent * 1.7)) * 0.85;
      float g = clamp((uBuild - st * 0.6) / 0.4, 0.0, 1.0);
      return g * g * (3.0 - 2.0 * g);
    }`;
  const deck = new THREE.Mesh(
    new THREE.TorusGeometry(RAIL_R, 0.45, 4, 220).rotateX(Math.PI / 2).scale(1, 0.25, 1).translate(0, RAIL_Y - 0.12, 0),
    new THREE.ShaderMaterial({
      uniforms: railUniforms,
      vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: railGrow + `
        varying vec3 vW;
        void main() {
          // laid only once its particles have landed on top of the pillars
          if (growAt(vW) < 0.985) discard;
          gl_FragColor = vec4(vec3(0.07, 0.08, 0.12) * uDim, 1.0);
        }`,
    }),
  );
  group.add(deck);
  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, RAIL_Y - GROUND, 8).translate(0, (RAIL_Y + GROUND) / 2, 0);
  const pillars = new THREE.InstancedMesh(pillarGeo, new THREE.ShaderMaterial({
    uniforms: railUniforms,
    vertexShader: `varying vec3 vW; varying vec3 vBase; void main() { vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: railGrow + `
      varying vec3 vW; varying vec3 vBase;
      void main() {
        // solid only below where its particles have landed, as the buildings are
        float front = clamp((growAt(vBase) - 0.22) / 0.78, 0.0, 1.0) * uH;
        if (vW.y - uGround > front) discard;
        gl_FragColor = vec4(vec3(0.1, 0.12, 0.17) * uDim, 1.0);
      }`,
  }), pillarCount);
  for (let i = 0; i < pillarCount; i++) {
    const a = (i / pillarCount) * Math.PI * 2;
    pillars.setMatrixAt(i, m.makeTranslation(Math.cos(a) * RAIL_R, 0, Math.sin(a) * RAIL_R));
  }
  group.add(pillars);
  const CARS_PER_TRAIN = 7;
  const trains = [{ a: 0.3, speed: 0.05 }, { a: 3.4, speed: -0.042 }];
  const carriageGeo = new THREE.BoxGeometry(0.62, 0.5, 1.55).translate(0, 0.25, 0);
  const carriages = new THREE.InstancedMesh(carriageGeo, new THREE.ShaderMaterial({
    uniforms: { uDim: buildingUniforms.uDim, uFog: buildingUniforms.uFog, uCam: buildingUniforms.uCam },
    vertexShader: /* glsl */ `
      varying vec3 vL, vN, vW;
      void main() {
        vL = position; vN = normal;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog, uCam; uniform float uDim;
      varying vec3 vL, vN, vW;
      void main() {
        vec3 col = vec3(0.55, 0.6, 0.68) * (0.35 + 0.25 * max(vN.y, 0.0));
        // a band of lit windows down each side, and a stripe under it
        if (abs(vN.x) > 0.5) {
          float win = step(0.2, vL.y) * step(vL.y, 0.38) * step(0.25, fract(vL.z * 3.2)) * step(abs(vL.z), 0.7);
          col = mix(col, vec3(1.0, 0.92, 0.7), win);
          col += vec3(0.1, 0.8, 1.0) * step(0.1, vL.y) * step(vL.y, 0.14);
        }
        if (abs(vN.z) > 0.5) col += vec3(1.2, 1.15, 1.0) * step(0.1, vL.y) * step(vL.y, 0.22) * step(0.12, abs(vL.x));
        col = mix(col, uFog, smoothstep(40.0, 130.0, distance(vW, uCam)));
        gl_FragColor = vec4(col * uDim, 1.0);
      }`,
  }), CARS_PER_TRAIN * trains.length);
  carriages.frustumCulled = false;
  group.add(carriages);
  const placeTrains = (time: number) => {
    let k = 0;
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const t of trains) {
      for (let c = 0; c < CARS_PER_TRAIN; c++) {
        const a = t.a + time * t.speed - Math.sign(t.speed) * c * (1.62 / RAIL_R);
        q.setFromAxisAngle(up, -a + (t.speed > 0 ? 0 : Math.PI));
        m.compose(new THREE.Vector3(Math.cos(a) * RAIL_R, RAIL_Y, Math.sin(a) * RAIL_R), q, new THREE.Vector3(1, 1, 1));
        carriages.setMatrixAt(k++, m);
      }
    }
    carriages.instanceMatrix.needsUpdate = true;
  };

  /* ---- aeroplanes, crossing overhead ---- */
  const planes = Array.from({ length: isMobile ? 3 : 5 }, (_, i) => {
    const p = makePlane();
    group.add(p.points);
    return { ...p, r: 30 + i * 9 + rnd() * 6, y: GROUND + TALL + 6 + i * 3.5, speed: 0.04 + rnd() * 0.03, phase: rnd() * Math.PI * 2, way: i % 2 ? 1 : -1 };
  });

  function update(time: number, build: number, dim: number, cam: THREE.Vector3) {
    // the sky is always round the camera, however far it goes
    sky.position.copy(cam);
    stars.position.copy(cam);
    skyUniforms.uTime.value = time;
    skyUniforms.uDim.value = 0.55 + 0.45 * dim;
    constructUniforms.uBuild.value = build;
    constructUniforms.uTime.value = time;
    constructUniforms.uDim.value = dim;
    buildingUniforms.uBuild.value = build;
    buildingUniforms.uTime.value = time;
    buildingUniforms.uDim.value = dim;
    buildingUniforms.uCam.value.copy(cam);
    groundUniforms.uBuild.value = build;
    groundUniforms.uDim.value = dim;
    sparkUniforms.uBuild.value = build;
    sparkUniforms.uTime.value = time;
    sparkUniforms.uDim.value = dim;
    plinth.visible = build > 0.3;
    // the railway goes up with the city; the trains run once it is there
    carriages.visible = build > 0.8;
    if (carriages.visible) placeTrains(time);
    for (const p of planes) {
      const a = p.phase + time * p.speed * p.way;
      p.points.position.set(Math.cos(a) * p.r, p.y, Math.sin(a) * p.r);
      // nose along the direction of travel, banked into the turn
      p.points.rotation.set(0, Math.atan2(-Math.sin(a) * p.way, Math.cos(a) * p.way), -p.way * 0.2);
      // blinking: the strobe flashes, the wing lights stay on
      const c = p.points.geometry.attributes.color as THREE.BufferAttribute;
      const on = Math.sin(time * 6 + p.phase * 3) > 0.85 ? 1 : 0.1;
      c.setXYZ(p.lights.strobe, on, on, on);
      c.needsUpdate = true;
      (p.points.material as THREE.PointsMaterial).opacity = dim * (build > 0.5 ? 1 : 0);
    }
  }

  return { group, update };
}
