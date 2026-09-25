import * as THREE from 'three';
import { isMobile } from './config';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { FACADE_GLSL, lightingUniforms, setMode } from './facade';
import { BANNERS } from '@/content/banners';

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
attribute vec2 aStack; // this block's base, and its building's whole height
varying vec3 vLocal, vNormal, vTint, vSize, vWorld;
varying float vStyle, vSeed, vGrow;
varying vec2 vStack;
void main() {
  float g = clamp((uBuild - aStart * 0.6) / 0.4, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 local = position * aSize;
  vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  vLocal = local; // floors stay where they are in the world, so rising uncovers them one by one
  vNormal = normal;
  vTint = aTint; vSize = aSize; vStyle = aStyle; vSeed = aSeed; vGrow = g; vWorld = world.xyz; vStack = aStack;
}`;

const ROOF_GLSL = /* glsl */ `
vec3 roofCol(vec3 n) {
  vec3 amb = uSkyTop * uAmbient * 2.2;
  return vec3(0.05, 0.05, 0.055) * (amb + uSunCol * max(dot(n, uSunDir), 0.0) * 0.8);
}`;

const buildingFragment = FACADE_GLSL + ROOF_GLSL + /* glsl */ `
uniform float uDim, uGround;
uniform vec3 uCam;
varying vec3 vLocal, vNormal, vTint, vSize, vWorld;
varying float vStyle, vSeed, vGrow;
varying vec2 vStack;
void main() {
  if (vGrow < 0.001) discard;
  vec3 n = normalize(vNormal);
  float y = vLocal.y;
  // the particles land first; the building stands only as far as they have got
  float front = clamp((vGrow - 0.22) / 0.78, 0.0, 1.0) * vStack.y - vStack.x;
  if (y > front + 0.001 || (n.y > 0.5 && vGrow < 0.999)) discard;
  vec3 view = normalize(uCam - vWorld);
  float mat = vStyle < 0.5 ? 0.0 : vStyle < 1.5 ? 1.0 : vStyle < 2.5 ? (vSeed < 0.5 ? 2.0 : 5.0) : 3.0;
  vec3 tint = mat < 1.5 ? vec3(0.3, 0.11, 0.07) : mat < 2.5 ? vec3(0.6, 0.55, 0.46) : mat < 3.5 ? vec3(0.1, 0.12, 0.16) : vec3(0.2, 0.2, 0.22);
  vec3 col;
  if (n.y > 0.5) col = roofCol(n);
  else {
    float u = abs(n.z) > 0.5 ? vWorld.x : vWorld.z;
    col = facade(vWorld, n, view, mat, tint, vSeed, u + 500.0, 10000.0, y + vStack.x, vStack.y, uGround);
  }
  col = mix(col, uSkyHorizon, smoothstep(45.0, 150.0, distance(vWorld, uCam)) * 0.75);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

/* The city modelled in Blender (public/models/nyc-city.glb): every vertex carries its building's
   centre (uv), its height and material with a per-building seed (uv1), and its stone or brick
   colour. glTF stores v flipped, which is undone here. */
const modelVertex = /* glsl */ `
attribute vec2 uv1;
attribute vec3 color;
varying vec3 vWorld, vN, vTint;
varying float vH, vMat, vSeed, vStart;
uniform vec3 uBoard;
uniform float uExtent;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec2 centre = vec2(uv.x, 1.0 - uv.y);
  vH = uv1.x;
  float ms = 1.0 - uv1.y;
  vMat = floor(ms + 0.001);
  vSeed = fract(ms) / 0.9;
  vTint = color;
  vStart = min(1.0, distance(centre, uBoard.xz) / (uExtent * 1.7)) * 0.85;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const modelFragment = FACADE_GLSL + ROOF_GLSL + /* glsl */ `
uniform float uDim, uGround, uBuild;
uniform vec3 uCam;
varying vec3 vWorld, vN, vTint;
varying float vH, vMat, vSeed, vStart;
void main() {
  float g = clamp((uBuild - vStart * 0.6) / 0.4, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  float y = vWorld.y - uGround;
  if (y > clamp((g - 0.22) / 0.78, 0.0, 1.0) * vH + 0.001) discard;
  vec3 n = normalize(vN);
  vec3 view = normalize(uCam - vWorld);
  vec3 col;
  if (vMat > 5.5) {
    // a crown: lit metal, in its own light at night
    vec3 amb = mix(uSkyHorizon, uSkyTop, n.y * 0.5 + 0.5) * uAmbient * 2.2;
    col = vTint * (amb + uSunCol * max(dot(n, uSunDir), 0.0)) * 0.9 + vTint * (0.12 + uNight * 0.35);
  } else if (n.y > 0.6) col = roofCol(n);
  else {
    float u = abs(n.x) > abs(n.z) ? vWorld.z : vWorld.x;
    col = facade(vWorld, n, view, vMat, vTint, vSeed, u + 500.0, 10000.0, y, vH, uGround);
  }
  col = mix(col, uSkyHorizon, smoothstep(45.0, 150.0, distance(vWorld, uCam)) * 0.75);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

/* A Times Square screen: a client's banner, or an ad of ours, bright, cut from one to the next with
   a fault; rows of LEDs visible up close. */
const screenFragment = /* glsl */ `
uniform sampler2D uA, uB;
uniform float uMix, uGlitch, uTime, uDim, uOn;
varying vec2 vUv;
void main() {
  if (uOn < 0.5) discard;
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  float band = floor(uv.y * 14.0);
  uv.x += (fract(sin(band * 91.7 + uTime * 30.0) * 43758.5) - 0.5) * 0.08 * uGlitch;
  vec3 a = texture2D(uA, uv).rgb, b = texture2D(uB, uv).rgb;
  vec3 col = mix(a, b, uMix);
  col *= 0.85 + 0.15 * step(0.3, fract(gl_FragCoord.y * 0.5));
  gl_FragColor = vec4(col * 0.55 * uDim, 1.0);
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
uniform float uPitch, uPlaza, uExtent, uBuild, uDim, uTime, uNight, uAmbient;
uniform vec3 uSkyHorizon;
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
  // zebra crossings where each street meets the next
  float cw = step(g.x, 0.9) * step(0.95, g.y) * step(g.y, 1.35) * step(0.5, fract(p.x / 0.16))
           + step(g.y, 0.9) * step(0.95, g.x) * step(g.x, 1.35) * step(0.5, fract(p.y / 0.16));
  col = mix(col, vec3(0.32, 0.32, 0.3), clamp(cw, 0.0, 1.0) * 0.85 * (1.0 - avenue));
  // at blue hour the streets are still in daylight's last of it
  col *= 1.0 + (1.0 - uNight) * 1.2;
  // the edge of town fades into the dark
  col *= 1.0 - smoothstep(uExtent - 2.0, uExtent + 12.0, max(abs(p.x), abs(p.y)));
  col = mix(col, uSkyHorizon * 0.8, smoothstep(40.0, 140.0, distance(vWorld, uCam)));
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

/* The landmarks: modelled in Blender (public/models/nyc.glb), placed round the plaza the way
   Midtown and Downtown stand round a park. Where each stands, how big, and how its crown is lit. */
export type Landmark = { name: string; geometry: THREE.BufferGeometry };
const LANDMARKS: Record<string, { x: number; z: number; rot: number; scale: number; crownFrom: number; crown: [string, string]; tint: string }> = {
  onewtc: { x: 1, z: -19, rot: 0.2, scale: 1.12, crownFrom: 0.97, crown: ['#ffffff', '#cfe8ff'], tint: '#7fd8ff' },
  empire: { x: -16, z: -11, rot: 0, scale: 1.05, crownFrom: 0.7, crown: ['#3fe0c0', '#ff5ba8'], tint: '#ffd27a' },
  chrysler: { x: 16, z: -11, rot: 0.785, scale: 1.05, crownFrom: 0.8, crown: ['#ffffff', '#ffe8b0'], tint: '#dfe8ff' },
  park432: { x: -21, z: 3, rot: 0, scale: 1.05, crownFrom: 2, crown: ['#ffffff', '#ffffff'], tint: '#dfe8ff' },
  flatiron: { x: 21, z: 4, rot: -0.6, scale: 1.1, crownFrom: 2, crown: ['#ffffff', '#ffffff'], tint: '#ffb070' },
};

export type CityModel = { city: THREE.BufferGeometry; screens: THREE.BufferGeometry[] };

export function createCity(pixelRatio: number, billboard: Billboard, GROUND: number, plinthTop: number, mascotTop: number, landmarks: Landmark[] = [], model: CityModel | null = null) {
  // the light the whole city is seen in (blue hour ↔ night), shared by every material here
  const light = { ...lightingUniforms(), uTime: { value: 0 } };
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
  /* A building is a stack of blocks — podium, shaft, setbacks, crown — each drawn and built as
     part of the whole: `base` is where the block starts above the ground, `total` the height of the
     building it belongs to (the build runs over the whole of that), `top` whether it is the roof. */
  type B = { x: number; z: number; w: number; d: number; h: number; style: number; tint: THREE.Color; start: number; base: number; total: number; top: boolean; part: string };
  const blds: B[] = [];
  const glass = ['#2ad4ff', '#58c4ff', '#3fe0c0', '#7fd8ff', '#ff5ba8'];
  const office = ['#9fc4ff', '#dfe8ff', '#6fb0ff', '#ffd27a'];
  const flats = ['#ffb070', '#ff9a5a', '#ffd08a', '#8fd0ff'];
  const pick = (a: string[]) => new THREE.Color(a[Math.floor(rnd() * a.length)]);
  for (let gx = -EXTENT; gx < EXTENT && !model; gx += PITCH) {
    for (let gz = -EXTENT; gz < EXTENT; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      const r = Math.hypot(cx, cz);
      if (r < PLAZA + 2 || r > EXTENT) continue;
      if (cz > 0 && Math.abs(cx) < PITCH * 0.6) continue; // the avenue up to his plaza stays open
      const nearBoard = Math.hypot(cx - boardXZ.x, cz - boardXZ.y);
      if (nearBoard < 3.6) continue;
      if (landmarks.some((l) => LANDMARKS[l.name] && Math.hypot(cx - LANDMARKS[l.name].x, cz - LANDMARKS[l.name].z) < 4.6)) continue;
      const lot = PITCH - 2.6; // the buildable part between the pavements
      const zone = (r - PLAZA) / (EXTENT - PLAZA);
      const start = startAt(cx, cz);
      // keep the billboard in view: nothing near it stands above it
      const cap = nearBoard < 12 ? billboard.center.y - billboard.height / 2 - GROUND - 0.5 : Infinity;
      const put = (x: number, z: number, w: number, d: number, h0: number, style: number, tint: THREE.Color) => {
        const H = Math.min(h0, cap);
        // how the building is stacked, by type
        const tiers: [number, number, number, string][] = []; // from, to (fractions of H), footprint scale, part
        if (style === 3 && H > 6) {
          const pod = Math.min(0.14, 1.6 / H);
          tiers.push([0, pod, 1.18, 'podium']);
          const s1 = 0.62 + rnd() * 0.15, s2 = 0.86 + rnd() * 0.06;
          if (rnd() < 0.7) tiers.push([pod, s1, 1, 'shaft'], [s1, s2, 0.82, 'setback'], [s2, 1, 0.6, 'crown']);
          else tiers.push([pod, s2, 1, 'shaft'], [s2, 1, 0.72, 'crown']);
        } else if (style === 2 && H > 5 && rnd() < 0.55) {
          const s1 = 0.7 + rnd() * 0.15;
          tiers.push([0, s1, 1, 'shaft'], [s1, 1, 0.78, 'setback']);
        } else tiers.push([0, 1, 1, 'shaft']);
        tiers.forEach(([f0, f1, k, part], i) => blds.push({
          x, z, w: w * k, d: d * k, h: H * (f1 - f0), style, tint, start, base: H * f0, total: H, top: i === tiers.length - 1, part,
        }));
      };
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
  const bbH = bb.center.y - bb.height / 2 - 0.3 - GROUND;
  blds.push({
    x: bb.center.x - bb.normal.x * 1.2, z: bb.center.z - bb.normal.z * 1.2, w: 2.4, d: 2.4,
    h: bbH, style: 2, tint: new THREE.Color('#dfe8ff'), start: 0, base: 0, total: bbH, top: true, part: 'shaft',
  });

  /* ---- build them: one instanced box pass ---- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const N = blds.length;
  const size = new Float32Array(N * 3), tint = new Float32Array(N * 3), style = new Float32Array(N), start = new Float32Array(N), bseed = new Float32Array(N), bbase = new Float32Array(N * 2);
  const buildingUniforms = {
    ...light,
    uBuild: { value: 1 }, uDim: { value: 1 }, uGround: { value: GROUND },
    uFog: { value: FOG }, uCam: { value: new THREE.Vector3() },
  };
  const bMat = new THREE.ShaderMaterial({ uniforms: buildingUniforms, vertexShader: buildingVertex, fragmentShader: buildingFragment });
  const bMesh = new THREE.InstancedMesh(boxGeo, bMat, N);
  const m = new THREE.Matrix4();
  blds.forEach((b, i) => {
    m.makeTranslation(b.x, GROUND + b.base, b.z);
    bMesh.setMatrixAt(i, m);
    bbase.set([b.base, b.total], i * 2);
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
  boxGeo.setAttribute('aStack', new THREE.InstancedBufferAttribute(bbase, 2));
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
  const cp: number[] = [], cf: number[] = [], cr: number[] = [], cc: number[] = [], cs: number[] = [];
  const dense = isMobile ? 0.55 : 1;
  // size: 1 for the fine structure (edges, dust, fins), larger for a lit window, which should read as a pane
  const push = (x: number, y: number, z: number, b: B, col: THREE.Color, k = 1, size = 1) => {
    cp.push(x, y, z);
    cs.push(size);
    cf.push((y - GROUND) / b.total, b.start, b.total);
    cr.push(rnd(), rnd(), rnd(), rnd());
    cc.push(col.r * k, col.g * k, col.b * k);
  };
  const warmLamp = new THREE.Color(1.0, 0.76, 0.42), coolLamp = new THREE.Color(0.72, 0.88, 1.0), lobby = new THREE.Color(1.0, 0.85, 0.6);
  const lampCol = new THREE.Color();
  const white = new THREE.Color(0.85, 0.88, 0.95);
  /* Every building is drawn in its particles, the way a real one reads at night:
       glass towers  full-height panes between vertical fins, a line of light at every floor slab
       offices       ribbon windows, a dark band of wall between one floor and the next
       flats         a regular grid of windows, balconies on alternate floors
       houses        a couple of windows and a door
     with a lit lobby along the ground, corners and roof edges drawn as fine lines, and the roof
     furnished: plant boxes on offices, a water tank on flats, a helipad or a mast on a tower. */
  for (const b of blds) {
    const fh = b.style === 0 ? 0.36 : b.style === 1 ? 0.38 : b.style === 2 ? 0.42 : 0.46;
    const bay = b.style === 3 ? 0.42 : b.style === 2 ? 0.36 : 0.34;
    const litP = b.style === 0 ? 0.5 : b.style === 1 ? 0.5 : 0.6;
    const warm = b.style <= 1 ? 0.8 : b.style === 2 ? 0.3 : 0.1;
    const y0 = GROUND + b.base, y1 = y0 + b.h;
    const faces = [
      { n: [0, 0, 1], w: b.w, a: 'x' }, { n: [0, 0, -1], w: b.w, a: 'x' },
      { n: [1, 0, 0], w: b.d, a: 'z' }, { n: [-1, 0, 0], w: b.d, a: 'z' },
    ];
    for (const f of faces) {
      const at = (u: number, out = 0.02) => ({
        x: (f.a === 'x' ? b.x + u : b.x + f.n[0] * b.w * 0.5) + f.n[0] * out,
        z: (f.a === 'x' ? b.z + f.n[2] * b.d * 0.5 : b.z + u) + f.n[2] * out,
      });
      const bays = Math.max(1, Math.round((f.w - 0.16) / bay));
      const bw = (f.w - 0.16) / bays;
      const floors = Math.max(1, Math.floor((b.h - (b.base === 0 ? fh * 0.9 : 0.1)) / fh));
      const first = y0 + (b.base === 0 ? fh * 0.9 : 0.05);
      // the lobby: a lit band along the ground floor of anything but a house
      if (b.base === 0 && b.style >= 1) {
        for (let u = -f.w / 2 + 0.1; u < f.w / 2 - 0.1; u += 0.07 / dense) {
          const p = at(u);
          push(p.x, y0 + 0.12 + rnd() * 0.18, p.z, b, lobby, rnd() < 0.8 ? 0.9 : 0.3, 1.6);
        }
      }
      for (let fl = 0; fl < floors; fl++) {
        const fy = first + fl * fh; // this floor's slab
        const floorOn = rnd() > 0.12;
        if (b.style === 3) {
          // the slab edge, a fine line of light across the glass
          for (let u = -f.w / 2 + 0.05; u < f.w / 2 - 0.05; u += 0.11 / dense) {
            const p = at(u);
            push(p.x, fy, p.z, b, b.tint, 0.3);
          }
        }
        for (let bi = 0; bi < bays; bi++) {
          const cu = -f.w / 2 + 0.08 + (bi + 0.5) * bw;
          const lit = floorOn && rnd() < litP;
          lampCol.copy(rnd() < warm ? warmLamp : coolLamp).multiplyScalar(0.55 + rnd() * 0.5);
          if (b.style === 3) {
            // a full-height pane: a grid of points when lit, a faint glint when not
            const nx = 2, ny = 2;
            for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
              if (!lit && rnd() > 0.12) continue;
              const p = at(cu + ((ix + 0.5) / nx - 0.5) * bw * 0.72);
              push(p.x, fy + 0.07 + ((iy + 0.5) / ny) * (fh - 0.14), p.z, b, lit ? lampCol : b.tint, lit ? 1 : 0.2, lit ? 2.2 : 1);
            }
          } else if (b.style === 2) {
            // ribbon windows: a continuous strip at window height, lit bay by bay
            if (!lit) continue;
            for (let k = 0; k < 3; k++) {
              const p = at(cu + ((k + 0.5) / 3 - 0.5) * bw);
              push(p.x, fy + fh * 0.45, p.z, b, lampCol, 1, 2.2);
            }
          } else {
            // punched windows: a small square of light
            if (lit) {
              for (let ix = 0; ix < 2; ix++) {
                const p = at(cu + (ix - 0.5) * bw * 0.28);
                push(p.x, fy + fh * 0.48, p.z, b, lampCol, 1, 2.4);
              }
            }
            // balconies on the flats: a rail on alternate floors, standing proud of the wall
            if (b.style === 1 && fl % 2 === 1 && bi % 2 === 0) {
              for (let t = -0.5; t <= 0.5; t += 0.25) {
                const p = at(cu + t * bw * 0.8, 0.12);
                push(p.x, fy + 0.04, p.z, b, white, 0.4);
              }
            }
          }
        }
      }
      // glass towers: the vertical fins between the panes
      if (b.style === 3) {
        for (let bi = 0; bi <= bays; bi++) {
          const p = at(-f.w / 2 + 0.08 + bi * bw, 0.04);
          for (let y = y0; y < y1; y += 0.15 / dense) push(p.x, y, p.z, b, b.tint, 0.32);
        }
      }
      // a house: a door and a window or two
      if (b.style === 0) {
        const p = at((rnd() - 0.5) * f.w * 0.5);
        for (let y = y0; y < y0 + 0.3; y += 0.05) push(p.x, y, p.z, b, warmLamp, 0.7);
      }
    }
    // the corners, and the edge of each roof
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let y = y0; y < y1; y += 0.07 / dense) push(b.x + sx * b.w * 0.5, y, b.z + sz * b.d * 0.5, b, b.tint, 0.9);
    }
    const per = 2 * (b.w + b.d);
    for (let t = 0; t < per; t += 0.06 / dense) {
      const [x, z] = t < b.w ? [-b.w / 2 + t, -b.d / 2]
        : t < b.w + b.d ? [b.w / 2, -b.d / 2 + (t - b.w)]
        : t < 2 * b.w + b.d ? [b.w / 2 - (t - b.w - b.d), b.d / 2]
        : [-b.w / 2, b.d / 2 - (t - 2 * b.w - b.d)];
      push(b.x + x, y1, b.z + z, b, b.tint, 1.1);
    }
    if (!b.top) continue;
    // what stands on the roof
    const box = (cx: number, cz: number, w: number, d: number, h: number, col: THREE.Color, k: number) => {
      for (let t = 0; t < 2 * (w + d); t += 0.05) {
        const [x, z] = t < w ? [-w / 2 + t, -d / 2] : t < w + d ? [w / 2, -d / 2 + (t - w)] : t < 2 * w + d ? [w / 2 - (t - w - d), d / 2] : [-w / 2, d / 2 - (t - 2 * w - d)];
        push(cx + x, y1 + h, cz + z, b, col, k);
        push(cx + x, y1 + h * 0.3, cz + z, b, col, k * 0.5);
      }
    };
    if (b.style === 2) {
      // plant: two or three boxes of air handling
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) box(b.x + (rnd() - 0.5) * b.w * 0.5, b.z + (rnd() - 0.5) * b.d * 0.5, 0.35, 0.28, 0.22, white, 0.45);
    } else if (b.style === 1 && rnd() < 0.7) {
      // a water tank on legs
      const tx = b.x + (rnd() - 0.5) * b.w * 0.4, tz = b.z + (rnd() - 0.5) * b.d * 0.4;
      for (let i = 0; i < 90; i++) {
        const a = rnd() * Math.PI * 2;
        push(tx + Math.cos(a) * 0.18, y1 + 0.25 + rnd() * 0.3, tz + Math.sin(a) * 0.18, b, white, 0.45);
      }
    } else if (b.style === 3 && rnd() < 0.45) {
      // a helipad: a ring and an H
      const r = Math.min(b.w, b.d) * 0.3;
      for (let i = 0; i < 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        push(b.x + Math.cos(a) * r, y1 + 0.03, b.z + Math.sin(a) * r, b, lobby, 0.9);
      }
      for (let t = -0.5; t <= 0.5; t += 0.1) {
        push(b.x - r * 0.35, y1 + 0.03, b.z + t * r * 0.9, b, white, 0.9);
        push(b.x + r * 0.35, y1 + 0.03, b.z + t * r * 0.9, b, white, 0.9);
        push(b.x + t * r * 0.7, y1 + 0.03, b.z, b, white, 0.9);
      }
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
      cs.push(1);
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
    cs.push(1);
    // the deck lands after the pillars under it have topped out
    cf.push(0.97 + rnd() * 0.03, railStart(x, z), RAIL_H);
    cr.push(rnd(), rnd(), rnd(), rnd());
    cc.push(railTint.r, railTint.g, railTint.b);
  }
  /* ---- what the Times Square screens show: the clients' banners, and ads of ours ---- */
  const adTextures: THREE.Texture[] = [];
  const loader = new THREE.TextureLoader();
  for (const url of Object.values(BANNERS)) {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    adTextures.push(t);
  }
  const ads: [string, string, string][] = [['DIZRUPT', '#a310e7', '#1a0633'], ['SOLUTIONS FOR WHAT’S NEXT', '#58c4ff', '#051a2e'], ['HAVE A PROJECT?', '#ff3d8b', '#2a0616'], ['MUMBAI · NYC · LONDON', '#ffd27a', '#221400']];
  for (const [text, fg, bg] of ads) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const x = c.getContext('2d')!;
    const gr = x.createLinearGradient(0, 0, 1024, 512);
    gr.addColorStop(0, bg); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 150;
    x.font = `800 ${size}px system-ui, sans-serif`;
    while (x.measureText(text).width > 940 && size > 40) x.font = `800 ${(size -= 6)}px system-ui, sans-serif`;
    x.fillText(text, 512, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    adTextures.push(t);
  }
  const pickAd = () => adTextures[Math.floor(Math.random() * adTextures.length)];

  /* ---- the modelled city ---- */
  const screenMats: THREE.ShaderMaterial[] = [];
  if (model) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...buildingUniforms, uBoard: { value: billboard.center.clone() }, uExtent: { value: EXTENT } },
      vertexShader: modelVertex, fragmentShader: modelFragment,
    });
    const mesh = new THREE.Mesh(model.city.clone().translate(0, GROUND, 0), mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    // the construction particles, sampled over its surface; each needs its building's height
    const uvA = mesh.geometry.attributes.uv as THREE.BufferAttribute, uv1A = mesh.geometry.attributes.uv1 as THREE.BufferAttribute;
    const heights = new Map<string, number>();
    const key = (x: number, z: number) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
    for (let i = 0; i < uvA.count; i++) heights.set(key(uvA.getX(i), 1 - uvA.getY(i)), uv1A.getX(i));
    const sampler = new MeshSurfaceSampler(mesh).build();
    const uvS = new THREE.Vector2(), sample = new THREE.Vector3(), normal = new THREE.Vector3();
    const nSamples = isMobile ? 60000 : 150000;
    const white = new THREE.Color(0.85, 0.92, 1.0);
    for (let i = 0; i < nSamples; i++) {
      sampler.sample(sample, normal, undefined, uvS);
      const cz = 1 - uvS.y;
      const H = heights.get(key(uvS.x, cz)) ?? 5;
      const st = Math.min(1, Math.hypot(uvS.x - boardXZ.x, cz - boardXZ.y) / (EXTENT * 1.7)) * 0.85;
      const rec = { start: st, total: H } as B;
      push(sample.x + normal.x * 0.03, sample.y + normal.y * 0.03, sample.z + normal.z * 0.03, rec, white, 0.8, 1.3);
    }
    // the screens: a banner or an ad each, cut to the next every few seconds
    for (const g of model.screens) {
      const geo = g.clone().translate(0, GROUND, 0);
      geo.computeBoundingBox();
      const c = geo.boundingBox!.getCenter(new THREE.Vector3());
      const sm = new THREE.ShaderMaterial({
        uniforms: { uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uGlitch: { value: 0 }, uTime: light.uTime, uDim: buildingUniforms.uDim, uOn: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: screenFragment,
        side: THREE.DoubleSide,
      });
      (sm as THREE.ShaderMaterial & { userData: Record<string, number> }).userData = {
        start: Math.min(1, Math.hypot(c.x - boardXZ.x, c.z - boardXZ.y) / (EXTENT * 1.7)) * 0.85,
        next: Math.random() * 5, cur: 0, phase: Math.random(),
      };
      screenMats.push(sm);
      const sMesh = new THREE.Mesh(geo, sm);
      sMesh.frustumCulled = false;
      group.add(sMesh);
    }
  }

  /* ---- the landmarks: their models' surfaces sampled into lit windows, crowns lit as they are ---- */
  const landmarkBodies: THREE.ShaderMaterial[] = [];
  const sample = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const l of model ? [] : landmarks) {
    const spec = LANDMARKS[l.name];
    const places = l.name === 'brownstones'
      ? Array.from({ length: isMobile ? 4 : 9 }, (_, i) => {
          const a = (i / (isMobile ? 4 : 9)) * Math.PI * 2 + 0.4;
          return { x: Math.cos(a) * (EXTENT - 5), z: Math.sin(a) * (EXTENT - 5), rot: -a + Math.PI / 2, scale: 1 };
        })
      : spec ? [spec] : [];
    for (const pl of places) {
      const geo = l.geometry.clone();
      geo.scale(pl.scale, pl.scale, pl.scale);
      geo.rotateY(pl.rot);
      geo.translate(pl.x, GROUND, pl.z);
      geo.computeBoundingBox();
      const H = geo.boundingBox!.max.y - GROUND;
      const start = startAt(pl.x, pl.z);
      const tint = new THREE.Color(spec?.tint ?? '#ffb070');
      const crownA = new THREE.Color(spec?.crown[0] ?? '#ffffff'), crownB = new THREE.Color(spec?.crown[1] ?? '#ffffff');
      const crownFrom = spec?.crownFrom ?? 2;
      const rec = { x: pl.x, z: pl.z, w: 1, d: 1, h: H, style: 3, tint, start, base: 0, total: H, top: true, part: 'landmark' } as B;
      // its dark body, revealed below the particles as it rises
      const mat = new THREE.ShaderMaterial({
        uniforms: { uBuild: buildingUniforms.uBuild, uDim: buildingUniforms.uDim, uStart: { value: start }, uGround: { value: GROUND }, uH: { value: H } },
        vertexShader: `varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          uniform float uBuild, uDim, uStart, uGround, uH; varying float vY;
          void main() {
            float g = clamp((uBuild - uStart * 0.6) / 0.4, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
            if (vY - uGround > clamp((g - 0.22) / 0.78, 0.0, 1.0) * uH + 0.001) discard;
            gl_FragColor = vec4(vec3(0.002, 0.0025, 0.004) * uDim, 1.0);
          }`,
        side: THREE.DoubleSide,
      });
      landmarkBodies.push(mat);
      group.add(new THREE.Mesh(geo, mat));
      // particles over its surface: windows by floor, the crown in its own light, the edges picked out
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build();
      let area = 0;
      const pos = geo.attributes.position, idx = geo.index;
      const tri = new THREE.Triangle();
      const nTri = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < nTri; t++) {
        const [i0, i1, i2] = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
        tri.a.fromBufferAttribute(pos, i0); tri.b.fromBufferAttribute(pos, i1); tri.c.fromBufferAttribute(pos, i2);
        area += tri.getArea();
      }
      const count = Math.round(area * (isMobile ? 55 : 120));
      const fh = 0.44;
      for (let i = 0; i < count; i++) {
        sampler.sample(sample, normal);
        const hy = (sample.y - GROUND) / H;
        const p = sample.addScaledVector(normal, 0.02);
        if (hy > crownFrom) {
          // the crown, lit as it is at night
          lampCol.copy(crownA).lerp(crownB, Math.random());
          push(p.x, p.y, p.z, rec, lampCol, 1, 1.6);
          continue;
        }
        // a window grid on whatever way the face turns: floors in height, bays across the face
        const across = Math.abs(normal.x) > Math.abs(normal.z) ? p.z : p.x;
        const floor = Math.floor((p.y - GROUND) / fh), bayI = Math.floor(across / 0.38);
        const fy = (p.y - GROUND) / fh - floor, fx = across / 0.38 - bayI;
        const inPane = fy > 0.3 && fy < 0.75 && fx > 0.2 && fx < 0.8;
        const h = Math.sin(floor * 127.1 + bayI * 311.7 + pl.x * 13.1) * 43758.5453;
        const lit = h - Math.floor(h) < 0.58 && Math.abs(normal.y) < 0.5;
        if (inPane && lit) {
          const hh = Math.sin(floor * 7.1 + bayI * 3.3) * 91.7;
          lampCol.copy(hh - Math.floor(hh) < 0.35 ? warmLamp : coolLamp).multiplyScalar(0.6 + (hh - Math.floor(hh)) * 0.5);
          push(p.x, p.y, p.z, rec, lampCol, 1, 2.0);
        } else if (Math.random() < 0.25) push(p.x, p.y, p.z, rec, tint, 0.25);
      }
    }
  }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cGeo.setAttribute('aFrac', new THREE.Float32BufferAttribute(cf, 3));
  cGeo.setAttribute('aRand', new THREE.Float32BufferAttribute(cr, 4));
  cGeo.setAttribute('aTint', new THREE.Float32BufferAttribute(cc, 3));
  cGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(cs, 1));
  const constructUniforms = { uBuild: { value: 1 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uDim: { value: 1 } };
  const construct = new THREE.Points(cGeo, new THREE.ShaderMaterial({
    uniforms: constructUniforms,
    vertexShader: /* glsl */ `
      uniform float uBuild, uTime, uPixelRatio;
      attribute vec3 aFrac;   // x: how high up it sits (0..1), y: its building's start, z: that building's height
      attribute vec4 aRand;
      attribute vec3 aTint;
      attribute float aSize;
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
        p += vec3(sin(uTime * (0.7 + aRand.x) + ph), sin(uTime * (0.9 + aRand.y) + ph * 1.7) * 0.6, cos(uTime * (0.8 + aRand.z) + ph)) * 0.014 * e;
        float ray = 0.5 + 0.5 * sin(position.y * 1.6 - uTime * 1.4 + (position.x + position.z) * 0.35);
        vShine = 0.85 + 0.6 * pow(ray, 3.0) + 0.4 * step(0.99, fract(aRand.w * 37.0 + uTime * 0.13));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.1 * aSize, (1.8 * aSize + 4.4 * (1.0 - e)) * 7.0 * uPixelRatio / -mv.z);
        // on its way and just landed it is bright; once the facade has come up behind it, it settles to a sparkle
        // once the real facade has come up behind it, it has done its work and goes
        float facadeAt = clamp((g - 0.22) / 0.78, 0.0, 1.0);
        vA = step(0.001, t) * (1.0 - smoothstep(aFrac.x + 0.02, aFrac.x + 0.16, facadeAt));
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
  const skyUniforms = { uTime: light.uTime, uDim: { value: 1 }, uNight: light.uNight, uSkyTop: light.uSkyTop, uSkyHorizon: light.uSkyHorizon };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(360, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uDim, uNight;
        uniform vec3 uSkyTop, uSkyHorizon;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.55, h));
          // a warm band where the sun has just gone, at blue hour
          col += vec3(0.12, 0.05, 0.025) * (1.0 - uNight) * exp(-h * 12.0) * max(0.0, dot(normalize(vDir.xz), normalize(vec2(0.35, -0.9))));
          // a band of the galaxy across the sky
          float band = exp(-pow((vDir.y - 0.35 + vDir.x * 0.4) * 5.0, 2.0));
          col += vec3(0.025, 0.035, 0.05) * band * uNight;
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
      uniform float uDim, uNight; varying float vB; varying float vS;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 col = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), step(0.7, fract(vS * 13.0)));
        gl_FragColor = vec4(col * uDim, smoothstep(0.5, 0.0, d) * vB * (0.15 + 0.85 * uNight));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.renderOrder = -1999;
  stars.frustumCulled = false;
  group.add(sky, stars);

  /* ---- the ground ---- */
  const groundUniforms = {
    uNight: light.uNight, uAmbient: light.uAmbient, uSkyHorizon: light.uSkyHorizon,
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
    if (b.style < 2 || !b.top) continue;
    if (b.style === 3 || b.total > 9) {
      const spire = 0.6 + rnd() * 1.4;
      const roof = GROUND + b.base + b.h;
      for (let y = 0; y < spire; y += 0.08) add(b.x, roof + y, b.z, LED, b.start);
      add(b.x, roof + spire, b.z, BEACON, b.start);
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
          gl_FragColor = vec4(vec3(0.008, 0.009, 0.014) * uDim, 1.0);
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
        gl_FragColor = vec4(vec3(0.01, 0.012, 0.018) * uDim, 1.0);
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

  function update(time: number, build: number, dim: number, cam: THREE.Vector3, night = 0) {
    setMode(light, night);
    light.uTime.value = time;
    for (const sm of screenMats) {
      const ud = (sm as THREE.ShaderMaterial & { userData: { start: number; next: number; cut: number } }).userData;
      const g = Math.min(1, Math.max(0, (build - ud.start * 0.6) / 0.4));
      sm.uniforms.uOn.value = g > 0.98 ? 1 : 0;
      if (!sm.uniforms.uA.value) { sm.uniforms.uA.value = pickAd(); sm.uniforms.uB.value = pickAd(); }
      if (time > ud.next) {
        // cut to the next: the old picture holds, the new one tears in over it
        sm.uniforms.uA.value = sm.uniforms.uMix.value > 0.5 ? sm.uniforms.uB.value : sm.uniforms.uA.value;
        sm.uniforms.uB.value = pickAd();
        sm.uniforms.uMix.value = 0;
        ud.cut = time;
        ud.next = time + 5 + Math.random() * 5;
      }
      const k = Math.min(1, (time - (ud.cut ?? -9)) / 0.35);
      sm.uniforms.uMix.value = k;
      sm.uniforms.uGlitch.value = k < 1 ? 1 - k : 0;
    }
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
