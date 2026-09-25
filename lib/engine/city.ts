import * as THREE from 'three';
import { isMobile } from './config';

/* =========================================================
   The city: every building, street and car is a point of light.

   Laid out on a street grid around a round plaza. The mascot
   stands on a plinth in the middle of it, so the buildings stay
   low and he reads as its monument. Buildings are drawn as their
   edges (bright), their windows (dim, some flickering) and a
   crown of light on the roof; the streets as dotted lane lines;
   the traffic as short streams of points running along them in
   the shader.

   World units match the rest of the scene: his bust is about 4.5
   tall and his eyes sit near y = 0, so the ground is well below.
   ========================================================= */
export const GROUND = -8;
export const PLINTH_TOP = -2.35; // the bottom of his bust
const EXTENT = isMobile ? 30 : 42; // half the city's width
const PITCH = 5.2; // street grid spacing
const PLAZA = 10; // radius kept clear around him

// kinds, read by the shader
const EDGE = 0, WINDOW = 1, ROOF = 2, LANE = 3, CAR = 4, PLINTH = 5;

const vertex = /* glsl */ `
uniform float uTime, uPixelRatio, uSize;
attribute float aKind, aSeed;
attribute vec3 aDir;     // cars: which way the street runs, and how long it is (length of aDir)
varying float vKind, vSeed, vFade;
void main() {
  vec3 p = position;
  if (aKind > 3.5 && aKind < 4.5) {
    // a car: runs along its street and wraps round
    float len = length(aDir);
    float t = fract(aSeed * 7.13 + uTime * (0.02 + fract(aSeed * 3.7) * 0.03) * 20.0 / max(len, 1.0));
    p += aDir * (t - 0.5);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aKind < 0.5 ? 1.0 : aKind < 1.5 ? 0.8 : aKind < 2.5 ? 1.2 : aKind < 3.5 ? 0.7 : aKind < 4.5 ? 1.6 : 1.1;
  gl_PointSize = max(1.2, uSize * s * uPixelRatio / -mv.z);
  vKind = aKind;
  vSeed = aSeed;
  // far things thin out into the haze
  vFade = 1.0 - smoothstep(45.0, 115.0, -mv.z);
}`;

const fragment = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uEdge, uWindow, uRoof, uLane, uCarA, uCarB;
varying float vKind, vSeed, vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.05, d);
  vec3 col; float alpha;
  if (vKind < 0.5) { col = uEdge; alpha = 0.75; }
  else if (vKind < 1.5) {
    // windows: most steady, a few flicker, some dark
    float on = step(0.28, fract(vSeed * 91.7));
    float flick = step(0.93, fract(vSeed * 13.1)) * step(0.5, fract(uTime * (0.6 + fract(vSeed * 5.3)) + vSeed * 10.0));
    col = mix(uWindow, vec3(1.0, 0.82, 0.55), step(0.8, fract(vSeed * 41.3)) * 0.6);
    alpha = 0.3 * on * (1.0 - flick);
  }
  else if (vKind < 2.5) { col = uRoof; alpha = 0.5 + 0.35 * sin(uTime * 1.3 + vSeed * 40.0); }
  else if (vKind < 3.5) { col = uLane; alpha = 0.22; }
  else if (vKind < 4.5) { col = mix(uCarA, uCarB, step(0.5, fract(vSeed * 17.0))); alpha = 0.9; }
  else { col = uEdge; alpha = 0.4; }
  gl_FragColor = vec4(col, a * alpha * uOpacity * vFade);
}`;

export type Billboard = { center: THREE.Vector3; normal: THREE.Vector3; height: number };

export function createCity(pixelRatio: number, billboard: Billboard) {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pos: number[] = [];
  const kind: number[] = [];
  const sd: number[] = [];
  const dir: number[] = [];
  const add = (x: number, y: number, z: number, k: number, dx = 0, dy = 0, dz = 0) => {
    pos.push(x, y, z);
    kind.push(k);
    sd.push(rnd());
    dir.push(dx, dy, dz);
  };
  const line = (a: THREE.Vector3, b: THREE.Vector3, step: number, k: number) => {
    const n = Math.max(2, Math.ceil(a.distanceTo(b) / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, k);
    }
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // a building: its twelve edges, windows on the four faces, a lit crown
  const building = (cx: number, cz: number, w: number, d: number, h: number) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y0 = GROUND, y1 = GROUND + h;
    const c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of edges) line(c[a], c[b], 0.06, EDGE);
    // windows: floors every 0.32, bays every 0.3
    for (let y = y0 + 0.35; y < y1 - 0.2; y += 0.45) {
      for (let x = x0 + 0.25; x < x1 - 0.15; x += 0.42) {
        add(x, y, z1 + 0.01, WINDOW);
        add(x, y, z0 - 0.01, WINDOW);
      }
      for (let z = z0 + 0.25; z < z1 - 0.15; z += 0.42) {
        add(x1 + 0.01, y, z, WINDOW);
        add(x0 - 0.01, y, z, WINDOW);
      }
    }
    // the crown: a ring of light round the roof
    for (let i = 0; i < 26; i++) add(x0 + rnd() * w, y1 + 0.02, z0 + rnd() * d, ROOF);
  };

  // the blocks
  for (let gx = -EXTENT; gx <= EXTENT; gx += PITCH) {
    for (let gz = -EXTENT; gz <= EXTENT; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      const r = Math.hypot(cx, cz);
      if (r < PLAZA + 1.5 || r > EXTENT) continue;
      // the billboard's own block is left for its tower
      if (Math.hypot(cx - billboard.center.x, cz - billboard.center.z) < 3.2) continue;
      // one to four buildings on a block, taller towards the middle
      const n = 1 + Math.floor(rnd() * 2);
      const lot = (PITCH - 1.8) / n;
      for (let i = 0; i < n; i++) {
        const w = lot * (0.7 + rnd() * 0.25);
        const d = (PITCH - 1.8) * (0.55 + rnd() * 0.4);
        const near = 1 - Math.min(1, (r - PLAZA) / (EXTENT - PLAZA));
        const h = 0.8 + rnd() * 2.2 + near * near * rnd() * 3.2;
        building(gx + 0.9 + lot * (i + 0.5), cz + (rnd() - 0.5) * 0.4, w, d, h);
      }
    }
  }

  // the streets: dashed centre lines both ways, and traffic on them
  for (let g = -EXTENT; g <= EXTENT; g += PITCH) {
    for (let t = -EXTENT; t <= EXTENT; t += 0.5) {
      if (Math.hypot(g, t) < PLAZA) continue;
      if (Math.floor(t / 0.5) % 2) continue;
      add(g, GROUND + 0.01, t, LANE);
      add(t, GROUND + 0.01, g, LANE);
    }
    const cars = isMobile ? 6 : 12;
    for (let i = 0; i < cars; i++) {
      const lane = (rnd() < 0.5 ? -1 : 1) * 0.28;
      const way = rnd() < 0.5 ? -1 : 1;
      const len = EXTENT * 2;
      // head and tail lights: a short stream of points
      for (let k = 0; k < 5; k++) {
        const s = rnd();
        add(g + lane, GROUND + 0.08, 0, CAR, 0, 0, len * way);
        sd[sd.length - 1] = s * 0.02 + i * 0.0831 + g * 0.013;
        add(0, GROUND + 0.08, g + lane, CAR, len * way, 0, 0);
        sd[sd.length - 1] = s * 0.02 + i * 0.0791 + g * 0.017;
      }
    }
  }

  // the plaza ring and his plinth
  for (let i = 0; i < 900; i++) {
    const a = rnd() * Math.PI * 2;
    add(Math.cos(a) * PLAZA, GROUND + 0.02, Math.sin(a) * PLAZA, EDGE);
    add(Math.cos(a) * (PLAZA - 2.5), GROUND + 0.02, Math.sin(a) * (PLAZA - 2.5), LANE);
  }
  const plinthR = 2.3;
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * Math.PI * 2;
    const y = GROUND + rnd() * (PLINTH_TOP - GROUND);
    const taper = 1 - ((y - GROUND) / (PLINTH_TOP - GROUND)) * 0.35;
    const ring = rnd() < 0.3;
    add(Math.cos(a) * plinthR * taper, ring ? Math.round(y * 2) / 2 : y, Math.sin(a) * plinthR * taper, ring ? ROOF : PLINTH);
  }

  // the billboard's tower: a slim building whose top carries the board
  const b = billboard;
  const boardBottom = b.center.y - b.height / 2;
  building(b.center.x - b.normal.x * 1.2, b.center.z - b.normal.z * 1.2, 2.2, 2.2, boardBottom - GROUND - 0.3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uSize: { value: 5.5 },
    uEdge: { value: new THREE.Color('#8f6bff') },
    uWindow: { value: new THREE.Color('#58c4ff') },
    uRoof: { value: new THREE.Color('#ff4fd8') },
    uLane: { value: new THREE.Color('#6f4dff') },
    uCarA: { value: new THREE.Color('#fff1d6') },
    uCarB: { value: new THREE.Color('#ff3d5a') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, uniforms, count: kind.length };
}
