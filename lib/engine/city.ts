import * as THREE from 'three';
import { isMobile } from './config';

/* =========================================================
   The city: every house, tower, street and car a point of light.

   Laid out on a street grid round a plaza where the mascot stands,
   head to toe, on a low plinth. The buildings get taller towards
   him: houses with pitched roofs and a tree or two on the edge of
   town, mid-rise blocks with water tanks further in, and near the
   plaza skyscrapers that step back as they rise and end in a spire
   with a blinking light.

   It builds itself. Each building has a start time that spreads
   outward from the billboard; when its turn comes, a line of light
   climbs from the ground and the floors light up behind it, with
   the roof riding on top until it reaches its height. uBuild runs
   the whole thing, 0 → 1, off the scroll.
   ========================================================= */
export type Billboard = { center: THREE.Vector3; normal: THREE.Vector3; height: number };

// kinds, read by the shader
const EDGE = 0, WINDOW = 1, ROOF = 2, LANE = 3, CAR = 4, PLINTH = 5, BEACON = 6, TREE = 7;

const vertex = /* glsl */ `
uniform float uTime, uPixelRatio, uSize, uBuild;
attribute float aKind, aSeed;
attribute vec3 aDir;      // cars: which way the street runs, and how long it is
attribute vec3 aBuilding; // x: its ground, y: its height, z: when it starts (0..1)
varying float vKind, vSeed, vFade, vShow, vFront;
void main() {
  vec3 p = position;
  // how far up this building has got: a line of light climbs, the floors light behind it
  float g = clamp((uBuild - aBuilding.z * 0.72) / 0.28, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 2.2);
  float front = aBuilding.x + g * aBuilding.y + 0.001;
  float rel = p.y - aBuilding.x;
  vShow = step(p.y, front) * step(0.0005, g);
  // the roof and the spire ride the front up until it tops out
  if (aKind > 1.5 && aKind < 2.5 || aKind > 5.5 && aKind < 6.5) {
    p.y = min(p.y, front);
    vShow = step(0.0005, g);
  }
  vFront = (1.0 - smoothstep(0.0, 0.35, abs(front - p.y))) * (1.0 - step(0.999, g));
  if (aKind > 3.5 && aKind < 4.5) {
    // a car: runs along its street and wraps round
    float len = length(aDir);
    float t = fract(aSeed * 7.13 + uTime * (0.4 + fract(aSeed * 3.7) * 0.6) / max(len, 1.0));
    p += aDir * (t - 0.5);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aKind < 0.5 ? 1.0 : aKind < 1.5 ? 0.85 : aKind < 2.5 ? 1.2 : aKind < 3.5 ? 0.7 : aKind < 4.5 ? 1.7 : aKind < 5.5 ? 1.1 : aKind < 6.5 ? 2.6 : 1.3;
  gl_PointSize = max(1.2, uSize * s * (1.0 + vFront * 1.5) * uPixelRatio / -mv.z);
  vKind = aKind;
  vSeed = aSeed;
  vFade = 1.0 - smoothstep(55.0, 140.0, -mv.z);
}`;

const fragment = /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uEdge, uWindow, uRoof, uLane, uCarA, uCarB, uTree, uBeacon;
varying float vKind, vSeed, vFade, vShow, vFront;
void main() {
  if (vShow < 0.5) discard;
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.05, d);
  vec3 col; float alpha;
  if (vKind < 0.5) { col = uEdge; alpha = 0.75; }
  else if (vKind < 1.5) {
    float on = step(0.3, fract(vSeed * 91.7));
    float flick = step(0.94, fract(vSeed * 13.1)) * step(0.5, fract(uTime * (0.6 + fract(vSeed * 5.3)) + vSeed * 10.0));
    col = mix(uWindow, vec3(1.0, 0.8, 0.52), step(0.78, fract(vSeed * 41.3)) * 0.7);
    alpha = 0.34 * on * (1.0 - flick);
  }
  else if (vKind < 2.5) { col = uRoof; alpha = 0.55 + 0.3 * sin(uTime * 1.3 + vSeed * 40.0); }
  else if (vKind < 3.5) { col = uLane; alpha = 0.22; }
  else if (vKind < 4.5) { col = mix(uCarA, uCarB, step(0.5, fract(vSeed * 17.0))); alpha = 0.9; }
  else if (vKind < 5.5) { col = uEdge; alpha = 0.45; }
  else if (vKind < 6.5) { col = uBeacon; alpha = 0.25 + 0.75 * step(0.6, fract(uTime * 0.8 + vSeed)); }
  else { col = uTree; alpha = 0.45; }
  // the build line: whatever it is passing burns white for a moment
  col = mix(col, vec3(1.0, 0.95, 1.0), vFront * 0.8);
  alpha = min(1.0, alpha + vFront * 0.6);
  gl_FragColor = vec4(col, a * alpha * uOpacity * vFade);
}`;

export function createCity(pixelRatio: number, billboard: Billboard, GROUND: number, plinthTop: number) {
  const EXTENT = isMobile ? 32 : 46;
  const PITCH = 5.2;
  const PLAZA = 11;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pos: number[] = [];
  const kind: number[] = [];
  const sd: number[] = [];
  const dir: number[] = [];
  const bld: number[] = [];
  // the building everything added now belongs to: its ground, its height, its start time
  const cur = { base: GROUND, h: 1, t: 0 };
  const add = (x: number, y: number, z: number, k: number, dx = 0, dy = 0, dz = 0) => {
    pos.push(x, y, z);
    kind.push(k);
    sd.push(rnd());
    dir.push(dx, dy, dz);
    bld.push(cur.base, cur.h, cur.t);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const line = (a: THREE.Vector3, b: THREE.Vector3, step: number, k: number) => {
    const n = Math.max(2, Math.ceil(a.distanceTo(b) / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, k);
    }
  };
  // when a building starts: spreading out from the billboard, the way the camera pulls back
  const startAt = (x: number, z: number) =>
    Math.min(1, Math.hypot(x - billboard.center.x, z - billboard.center.z) / (EXTENT * 1.7)) * 0.85 + rnd() * 0.15;

  // a box: twelve edges, windows on its faces (floor height fh), a roof glow if it is the top
  const box = (cx: number, cz: number, w: number, d: number, y0: number, y1: number, fh = 0.45, roof = true) => {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const c = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) line(c[a], c[b], 0.06, EDGE);
    const bay = 0.42;
    for (let y = y0 + fh * 0.7; y < y1 - fh * 0.3; y += fh) {
      for (let x = x0 + bay * 0.6; x < x1 - bay * 0.3; x += bay) {
        add(x, y, z1 + 0.01, WINDOW);
        add(x, y, z0 - 0.01, WINDOW);
      }
      for (let z = z0 + bay * 0.6; z < z1 - bay * 0.3; z += bay) {
        add(x1 + 0.01, y, z, WINDOW);
        add(x0 - 0.01, y, z, WINDOW);
      }
    }
    if (roof) for (let i = 0; i < 18 + w * d * 4; i++) add(x0 + rnd() * w, y1 + 0.02, z0 + rnd() * d, ROOF);
  };

  // a house: a low box under a pitched roof, ridge running the long way
  const house = (cx: number, cz: number, w: number, d: number, h: number) => {
    const roofH = Math.min(w, d) * 0.45;
    cur.h = h + roofH;
    box(cx, cz, w, d, GROUND, GROUND + h, 0.38, false);
    const alongX = w >= d;
    const y1 = GROUND + h, yr = y1 + roofH;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const ridgeA = alongX ? V(x0, yr, cz) : V(cx, yr, z0);
    const ridgeB = alongX ? V(x1, yr, cz) : V(cx, yr, z1);
    line(ridgeA, ridgeB, 0.05, ROOF);
    // the four slopes down to the eaves
    const eaves = alongX
      ? [[V(x0, y1, z0), ridgeA], [V(x0, y1, z1), ridgeA], [V(x1, y1, z0), ridgeB], [V(x1, y1, z1), ridgeB]]
      : [[V(x0, y1, z0), ridgeA], [V(x1, y1, z0), ridgeA], [V(x0, y1, z1), ridgeB], [V(x1, y1, z1), ridgeB]];
    for (const [a, b] of eaves) line(a, b, 0.05, EDGE);
  };

  // a tree: a trunk and a ball of leaves
  const tree = (x: number, z: number) => {
    const h = 0.5 + rnd() * 0.3;
    cur.h = h + 0.4;
    line(V(x, GROUND, z), V(x, GROUND + h, z), 0.06, EDGE);
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.28 * Math.cbrt(rnd()));
      add(x + v.x, GROUND + h + 0.15 + v.y, z + v.z, TREE);
    }
  };

  // a skyscraper: stacked, stepping back as it rises, a spire and a beacon on top
  const tower = (cx: number, cz: number, w: number, d: number, h: number) => {
    const tiers = 1 + Math.floor(rnd() * 3);
    const share = [[1], [0.65, 0.35], [0.55, 0.28, 0.17]][tiers - 1];
    let y = GROUND;
    let tw = w, td = d;
    const spire = 0.8 + rnd() * 1.6;
    cur.h = h + spire;
    share.forEach((f, t) => {
      const top = y + h * f;
      box(cx, cz, tw, td, y, top, 0.4, t === tiers - 1);
      y = top;
      tw *= 0.72;
      td *= 0.72;
    });
    line(V(cx, y, cz), V(cx, y + spire, cz), 0.04, BEACON);
    add(cx, y + spire, cz, BEACON);
  };

  // the blocks, zoned by how far they are from him
  for (let gx = -EXTENT; gx < EXTENT; gx += PITCH) {
    for (let gz = -EXTENT; gz < EXTENT; gz += PITCH) {
      const cx = gx + PITCH / 2, cz = gz + PITCH / 2;
      const r = Math.hypot(cx, cz);
      if (r < PLAZA + 1.5 || r > EXTENT) continue;
      if (Math.hypot(cx - billboard.center.x, cz - billboard.center.z) < 3.4) continue;
      const lotW = PITCH - 1.8;
      cur.base = GROUND;
      cur.t = startAt(cx, cz);
      const zone = (r - PLAZA) / (EXTENT - PLAZA); // 0 by the plaza, 1 at the edge of town
      if (zone < 0.32) {
        // downtown: one or two towers
        const n = rnd() < 0.6 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const w = (lotW / n) * (0.75 + rnd() * 0.2);
          tower(gx + 0.9 + (lotW / n) * (i + 0.5), cz, w, lotW * (0.6 + rnd() * 0.3), 5 + rnd() * 7 * (1 - zone));
        }
      } else if (zone < 0.62) {
        // mid-rise: blocks of flats, some with a water tank on the roof
        const n = 1 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const w = (lotW / n) * (0.72 + rnd() * 0.22);
          const h = 1.6 + rnd() * 2.8;
          const x = gx + 0.9 + (lotW / n) * (i + 0.5);
          cur.h = h + 0.5;
          box(x, cz, w, lotW * (0.55 + rnd() * 0.4), GROUND, GROUND + h);
          if (rnd() < 0.4) {
            cur.h = h + 0.5;
            box(x + w * 0.2, cz, 0.35, 0.35, GROUND + h, GROUND + h + 0.4, 1, true);
          }
        }
      } else {
        // the edge of town: houses in a row, with trees
        const n = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const w = (lotW / n) * (0.6 + rnd() * 0.2);
          house(gx + 0.9 + (lotW / n) * (i + 0.5), cz + (rnd() - 0.5) * 0.8, w, 0.9 + rnd() * 0.5, 0.55 + rnd() * 0.35);
        }
        for (let i = 0; i < 2; i++) if (rnd() < 0.7) tree(gx + 0.9 + rnd() * lotW, cz + (rnd() < 0.5 ? -1 : 1) * (lotW / 2));
      }
    }
  }

  // the streets: dashed centre lines both ways, and traffic, laid as the build reaches them
  cur.h = 0.2;
  for (let g = -EXTENT; g <= EXTENT; g += PITCH) {
    for (let t = -EXTENT; t <= EXTENT; t += 0.5) {
      if (Math.hypot(g, t) < PLAZA || Math.floor(t / 0.5) % 2) continue;
      cur.t = startAt(g, t);
      add(g, GROUND + 0.01, t, LANE);
      cur.t = startAt(t, g);
      add(t, GROUND + 0.01, g, LANE);
    }
    const cars = isMobile ? 5 : 10;
    for (let i = 0; i < cars; i++) {
      const lane = (rnd() < 0.5 ? -1 : 1) * 0.28;
      const way = rnd() < 0.5 ? -1 : 1;
      const len = EXTENT * 2;
      cur.t = 0.9;
      for (let k = 0; k < 4; k++) {
        const s = rnd() * 0.015 + i * 0.0831 + g * 0.013;
        add(g + lane, GROUND + 0.08, 0, CAR, 0, 0, len * way);
        sd[sd.length - 1] = s;
        add(0, GROUND + 0.08, g + lane, CAR, len * way, 0, 0);
        sd[sd.length - 1] = s + 0.37;
      }
    }
  }

  // the plaza: two rings, and the plinth he stands on
  cur.t = startAt(0, 0);
  for (let i = 0; i < 1100; i++) {
    const a = rnd() * Math.PI * 2;
    add(Math.cos(a) * PLAZA, GROUND + 0.02, Math.sin(a) * PLAZA, EDGE);
    add(Math.cos(a) * (PLAZA - 3), GROUND + 0.02, Math.sin(a) * (PLAZA - 3), LANE);
  }
  cur.h = plinthTop - GROUND;
  for (let i = 0; i < 2400; i++) {
    const a = rnd() * Math.PI * 2;
    const y = GROUND + rnd() * (plinthTop - GROUND);
    const ring = rnd() < 0.35;
    const rad = 3.4 * (1 - ((y - GROUND) / (plinthTop - GROUND)) * 0.15);
    add(Math.cos(a) * rad, ring ? plinthTop - Math.round((plinthTop - y) * 3) / 3 : y, Math.sin(a) * rad, ring ? ROOF : PLINTH);
  }

  // the billboard's tower: first up, since it is where the city starts
  const b = billboard;
  const boardBottom = b.center.y - b.height / 2;
  cur.t = 0;
  cur.h = boardBottom - 0.3 - GROUND;
  box(b.center.x - b.normal.x * 1.2, b.center.z - b.normal.z * 1.2, 2.2, 2.2, GROUND, boardBottom - 0.3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  geo.setAttribute('aBuilding', new THREE.Float32BufferAttribute(bld, 3));
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uBuild: { value: 1 },
    uPixelRatio: { value: pixelRatio },
    uSize: { value: 5.5 },
    uEdge: { value: new THREE.Color('#8f6bff') },
    uWindow: { value: new THREE.Color('#58c4ff') },
    uRoof: { value: new THREE.Color('#ff4fd8') },
    uLane: { value: new THREE.Color('#6f4dff') },
    uCarA: { value: new THREE.Color('#fff1d6') },
    uCarB: { value: new THREE.Color('#ff3d5a') },
    uTree: { value: new THREE.Color('#3fe08a') },
    uBeacon: { value: new THREE.Color('#ff2d4f') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, uniforms, count: kind.length };
}
