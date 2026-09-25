import * as THREE from 'three';
import { COUNT, isMobile } from './config';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/* =========================================================
   The mascot's own line.

   For the solutions he turns himself into a train and rides a
   track of his own: it leaves the plaza at his feet, climbs the
   avenue and loops round the city above the rooftops, with a
   station for each of the six solutions — a platform, a sign,
   and the solution's model turning over it as a hologram.

   The track builds itself out of particles, like the city, as
   the section begins. Everything on it is his colour.
   ========================================================= */
export type Station = { name: string; shape: Float32Array; colors: [string, string]; images: string[] };

const VIOLET = new THREE.Color('#a855ff');

/** A bullet train made of points, facing +z with its wheels at y = 0: a long duck-billed nose,
    three more cars with rounded roofs, a band of windows, skirts and bogies, a pantograph, and
    DIZRUPT along both sides of the middle cars, set densely so it reads brighter than the body. */
export function trainShape(model?: THREE.Object3D | null): Float32Array {
  if (model) {
    // the real train's surface, sampled evenly: the particles land exactly where its paint is
    const meshes: THREE.Mesh[] = [];
    model.updateMatrixWorld(true);
    model.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const areas = meshes.map((m) => {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const pos = g.attributes.position, idx = g.index;
      const t = new THREE.Triangle();
      let a = 0;
      const n = idx ? idx.count / 3 : pos.count / 3;
      for (let k = 0; k < n; k++) {
        const [i0, i1, i2] = idx ? [idx.getX(k * 3), idx.getX(k * 3 + 1), idx.getX(k * 3 + 2)] : [k * 3, k * 3 + 1, k * 3 + 2];
        t.a.fromBufferAttribute(pos, i0); t.b.fromBufferAttribute(pos, i1); t.c.fromBufferAttribute(pos, i2);
        a += t.getArea();
      }
      return { a, s: new MeshSurfaceSampler(new THREE.Mesh(g)).build() };
    });
    const total = areas.reduce((x, y) => x + y.a, 0);
    const arr = new Float32Array(COUNT * 3);
    const v = new THREE.Vector3();
    let i = 0;
    areas.forEach((m, k) => {
      const n = k === areas.length - 1 ? COUNT - i : Math.round((m.a / total) * COUNT);
      for (let j = 0; j < n && i < COUNT; j++, i++) {
        m.s.sample(v);
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
    });
    return arr;
  }
  const arr = new Float32Array(COUNT * 3);
  const W = 1.3, H = 1.5, CAR = 3.2, GAP = 0.18, N = 4, NOSE = 2.1;
  const total = N * CAR + (N - 1) * GAP;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const carBack = (c: number) => total / 2 - c * (CAR + GAP) - CAR; // car 0 is the lead, at +z
  // the body's cross-section at distance z along a car: a rounded box, squeezed down the nose
  const section = (c: number, z: number) => {
    let w = W, h = H, drop = 0;
    const front = carBack(c) + CAR;
    if (c === 0 && z > front - NOSE) {
      const t = (z - (front - NOSE)) / NOSE; // 0 where the nose starts, 1 at its tip
      const e = t * t * (3 - 2 * t);
      w = W * (1 - 0.62 * e);
      h = H * (1 - 0.78 * Math.pow(t, 1.4));
      drop = 0.12 * e;
    }
    return { w, h, drop };
  };
  // DIZRUPT, from a canvas, as the points of its letters
  const cv = document.createElement('canvas');
  cv.width = 700; cv.height = 110;
  const cx = cv.getContext('2d')!;
  cx.fillStyle = '#fff';
  cx.font = '800 100px system-ui, sans-serif';
  cx.textBaseline = 'middle';
  cx.fillText('DIZRUPT', 8, 58);
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const letter: [number, number][] = [];
  for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) if (px[(y * cv.width + x) * 4 + 3] > 120) letter.push([x / cv.width, 1 - y / cv.height]);
  const LZ0 = carBack(2) + 0.4, LZ1 = carBack(1) + CAR - 0.4; // across the two middle cars
  for (let i = 0; i < COUNT; i++) {
    const k = rnd();
    let x: number, y: number, z: number;
    if (k < 0.12 && letter.length) {
      const [u, v] = letter[Math.floor(rnd() * letter.length)];
      // one side only: the train is made of light, so lettering on the far side would show through backwards
      const side = -1;
      z = side < 0 ? LZ0 + u * (LZ1 - LZ0) : LZ1 - u * (LZ1 - LZ0); // reads the right way from both sides
      y = 0.42 + v * 0.42;
      x = side * (W / 2 + 0.02);
    } else if (k < 0.2) {
      // the window band, a dense dark-bright strip down each side
      const c = Math.floor(rnd() * N);
      z = carBack(c) + 0.3 + rnd() * (CAR - (c === 0 ? NOSE + 0.2 : 0.6));
      const sc = section(c, z);
      y = 0.98 + rnd() * 0.24 - sc.drop;
      x = (rnd() < 0.5 ? 1 : -1) * (sc.w / 2 + 0.01);
    } else if (k < 0.25) {
      // bogies and wheels under each car
      const c = Math.floor(rnd() * N);
      const bz = carBack(c) + (rnd() < 0.5 ? 0.6 : CAR - 0.6);
      const a = rnd() * Math.PI * 2;
      x = (rnd() < 0.5 ? 1 : -1) * W * 0.36;
      y = 0.2 + Math.sin(a) * 0.17;
      z = bz + (rnd() < 0.5 ? -0.22 : 0.22) + Math.cos(a) * 0.17;
    } else if (k < 0.27) {
      // the pantograph on the second car
      const t = rnd();
      z = carBack(1) + CAR * 0.5 + (t - 0.5) * 0.9;
      y = H + 0.05 + Math.abs(t - 0.5) * 0.7;
      x = (rnd() - 0.5) * 0.5;
    } else if (k < 0.29) {
      // the gangways between cars
      const c = Math.floor(rnd() * (N - 1)) + 1;
      z = carBack(c) + CAR + rnd() * GAP;
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * W * 0.42;
      y = 0.4 + (Math.sin(a) * 0.5 + 0.5) * (H - 0.5);
    } else {
      // the shell: a rounded box, sampled round its section
      const c = Math.floor(rnd() * N);
      z = carBack(c) + rnd() * CAR;
      const sc = section(c, z);
      const a = rnd() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // superellipse: flat sides, rounded shoulders
      const r = 1 / Math.pow(Math.pow(Math.abs(ca), 4) + Math.pow(Math.abs(sa), 4), 0.25);
      x = ca * r * sc.w / 2;
      y = 0.3 + (sa * r * 0.5 + 0.5) * (sc.h - 0.3) - sc.drop * (sa < 0 ? 0 : 1);
      // a skirt line low down, and the roof line, picked out
      if (rnd() < 0.12) y = rnd() < 0.5 ? 0.34 : sc.h - 0.02 - sc.drop;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

/* The start station, in real materials: a concrete viaduct on columns, a platform with its yellow
   safety line, a white canopy on steel columns with strip lights under it, a glass screen behind,
   and the station's name board. Built up out of particles in each material's own colour, and shown
   solid below the line those have reached. Local frame: +z along the track, +x to the platform. */
/* The station's billboard: DIZRUPT on black, the mirrored Z losing the signal in irregular bursts —
   the channels thrown apart, the letter jumping, a band of it dropped. Redrawn while it is seen. */
function glitchBoard() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // glTF's UVs run top-down
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1; // the face is seen from its back in UV terms: read it the right way round
  let next = 0, until = 0, frame = 0;
  let tear: null | { jx: number; rx: number; bx: number; band: number[] | null } = null;
  const font = '800 190px "Inter Tight", system-ui, sans-serif';
  function draw(time: number) {
    if (frame++ % 2) return;
    g.fillStyle = '#05050a';
    g.fillRect(0, 0, 1024, 512);
    // a faint snow and scanlines, as on the landing
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * 1024, Math.random() * 512, 3, 3);
    }
    if (time > next) { until = time + 0.2 + Math.random() * 0.3; next = until + 0.6 + Math.random() * 0.9; }
    if (time < until && frame % 4 < 2) {
      const sp = 20 + Math.random() * 60;
      tear = { jx: (Math.random() - 0.5) * 40, rx: (Math.random() - 0.5) * sp * 2, bx: (Math.random() - 0.5) * sp * 2.4,
        band: Math.random() < 0.4 ? [Math.random() * 0.5, 0.12 + Math.random() * 0.25] : null };
    } else if (time >= until) tear = null;
    g.font = font;
    g.textBaseline = 'middle';
    const letters = ['D', 'I', 'Z', 'R', 'U', 'P', 'T'];
    const widths = letters.map((l) => g.measureText(l).width);
    let x = 512 - widths.reduce((a, b) => a + b, 0) / 2;
    letters.forEach((l, i) => {
      const w = widths[i];
      if (l !== 'Z') {
        g.fillStyle = '#ffffff';
        g.fillText(l, x, 256);
      } else {
        g.save();
        g.translate(x + w / 2 + (tear?.jx ?? 0), 256);
        g.scale(-1, 1);
        if (tear) {
          g.globalCompositeOperation = 'screen';
          g.fillStyle = '#ff2d4f'; g.fillText(l, -w / 2 + tear.rx, 0);
          g.fillStyle = '#2f6bff'; g.fillText(l, -w / 2 + tear.bx, 0);
          g.globalCompositeOperation = 'source-over';
        }
        g.fillStyle = '#a310e7';
        if (tear?.band) {
          const [t0, h] = tear.band;
          g.save();
          g.beginPath();
          g.rect(-w, -110, w * 2, 220 * t0);
          g.rect(-w, -110 + 220 * (t0 + h), w * 2, 220);
          g.clip();
          g.fillText(l, -w / 2, 0);
          g.restore();
        } else g.fillText(l, -w / 2, 0);
        g.restore();
      }
      x += w;
    });
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = (time * 30) % 4; y < 512; y += 4) g.fillRect(0, y, 1024, 1.5);
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

/* The start station, modelled in Blender (public/models/station.glb) in its real materials: a
   concrete viaduct with ballasted track, a platform with its yellow tactile edge, a barrel canopy
   on steel columns with strip lights, a glass wall, benches, bins, signs and a billboard. It builds
   itself: particles sampled from each surface, in that surface's colour, spiral in from below and
   land, and the model is shown solid under the line they have reached. */
function buildStation(model: THREE.Object3D, pixelRatio: number) {
  const group = new THREE.Group();
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e4);
  const board = glitchBoard();
  const meshes: THREE.Mesh[] = [];
  // the billboard stands over the front half of the roof, above where the train's nose waits
  model.traverse((o) => { if (o.name.startsWith('station_screen') || o.name.startsWith('station_billboard')) o.position.z += 4.5; });
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (o.name.startsWith('station_screen')) {
      m.material = new THREE.MeshBasicMaterial({ map: board.tex, toneMapped: false, clippingPlanes: [clip], side: THREE.DoubleSide });
    } else {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.clippingPlanes = [clip];
      mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.6);
      m.material = mat;
    }
    meshes.push(m);
  });
  group.add(model);

  const pos: number[] = [], col: number[] = [], rnd: number[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (const m of meshes) {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g.computeBoundingBox();
    const sz = g.boundingBox!.getSize(v);
    const area = 2 * (sz.x * sz.y + sz.y * sz.z + sz.x * sz.z);
    const cnt = Math.min(5000, Math.round(area * (isMobile ? 16 : 34)));
    const mat = m.material as THREE.MeshStandardMaterial;
    c.copy(mat.color ?? new THREE.Color(1, 1, 1));
    if (mat.emissive && mat.emissive.getHex()) c.add(mat.emissive);
    if (m.name.startsWith('station_screen')) c.set('#a310e7');
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
    for (let i = 0; i < cnt; i++) {
      sampler.sample(v, n);
      pos.push(v.x + n.x * 0.02, v.y + n.y * 0.02, v.z + n.z * 0.02);
      col.push(c.r, c.g, c.b);
      rnd.push(Math.random());
    }
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  pg.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
  const pu = { uFront: { value: -1e4 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } };
  const particles = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: pu,
    vertexShader: /* glsl */ `
      uniform float uFront, uTime, uPixelRatio;
      attribute vec3 aCol; attribute float aRand;
      varying vec3 vCol; varying float vA;
      void main() {
        float t = clamp(1.0 - (position.y - uFront) / 1.6, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float a = aRand * 40.0 + uTime * 1.2;
        vec3 p = position + vec3(cos(a) * 1.8, 1.2 + aRand * 1.5, sin(a) * 1.8) * (1.0 - e);
        vA = step(0.001, t) * (1.0 - smoothstep(0.25, 0.9, uFront - position.y));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, (2.2 + 3.0 * (1.0 - e)) * 6.0 * uPixelRatio / -mv.z);
        vCol = mix(vec3(1.0), aCol, e);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        gl_FragColor = vec4(vCol * 1.4, smoothstep(0.5, 0.0, d) * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  particles.frustumCulled = false;
  group.add(particles);

  const bb = new THREE.Box3().setFromObject(model);
  const LOW = bb.min.y, TOP = bb.max.y + 0.3;
  function build(t: number, time: number) {
    group.visible = t > 0.001;
    const local = LOW + (TOP - LOW) * t;
    clip.constant = t >= 0.999 ? 1e4 : local + group.position.y;
    pu.uFront.value = local;
    pu.uTime.value = time;
    particles.visible = t < 0.999;
    if (group.visible) board.draw(time);
  }
  return { group, build };
}

/* Build a finished object up out of particles, bottom to top, the way the city is built: points
   sampled over every surface, in each surface's own colour, spiral in from below and land; the solid
   object shows only under the line they have reached. t: 0 nothing → 1 standing. */
function particleBuilder(obj: THREE.Object3D, parent: THREE.Object3D, pixelRatio: number, density = 30) {
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e4);
  obj.updateMatrixWorld(true);
  const pos: number[] = [], col: number[] = [], rnd: number[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshBasicMaterial[];
    mats.forEach((mat) => { mat.clippingPlanes = [clip]; mat.needsUpdate = true; });
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    g.computeBoundingBox();
    const sz = g.boundingBox!.getSize(v);
    const area = 2 * (sz.x * sz.y + sz.y * sz.z + sz.x * sz.z);
    const cnt = Math.min(6000, Math.round(area * (isMobile ? density * 0.5 : density)));
    c.copy(mats[0].color ?? new THREE.Color(1, 1, 1));
    if ((mats[0] as unknown as THREE.MeshStandardMaterial).emissive?.getHex()) c.add((mats[0] as unknown as THREE.MeshStandardMaterial).emissive);
    if (mats[0].map) c.setRGB(0.85, 0.8, 1.0); // a picture: pale light
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
    for (let i = 0; i < cnt; i++) {
      sampler.sample(v, n);
      pos.push(v.x + n.x * 0.02, v.y + n.y * 0.02, v.z + n.z * 0.02);
      col.push(Math.max(0.25, c.r), Math.max(0.25, c.g), Math.max(0.25, c.b));
      rnd.push(Math.random());
    }
  });
  const box = new THREE.Box3().setFromObject(obj);
  const LOW = box.min.y, TOP = box.max.y + 0.4;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  pg.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
  const pu = { uFront: { value: -1e4 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } };
  const particles = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: pu,
    vertexShader: /* glsl */ `
      uniform float uFront, uTime, uPixelRatio;
      attribute vec3 aCol; attribute float aRand;
      varying vec3 vCol; varying float vA;
      void main() {
        float t = clamp(1.0 - (position.y - uFront) / 2.2, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float a = aRand * 40.0 + uTime * 1.3;
        vec3 p = position + vec3(cos(a) * 2.4, -1.5 - aRand * 3.0, sin(a) * 2.4) * (1.0 - e);
        vA = step(0.001, t) * (1.0 - smoothstep(0.3, 1.2, uFront - position.y));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.0, (2.6 + 3.5 * (1.0 - e)) * 7.0 * uPixelRatio / -mv.z);
        vCol = mix(vec3(1.0), aCol, e);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vCol * 1.5, (core * core * 0.7 + exp(-d * d * 40.0) * 0.8) * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  particles.frustumCulled = false;
  parent.add(particles);
  return (t: number, time: number) => {
    obj.visible = t > 0.001;
    const front = LOW + (TOP - LOW) * t;
    clip.constant = t >= 0.999 ? 1e4 : front;
    pu.uFront.value = front;
    pu.uTime.value = time;
    particles.visible = t > 0.001 && t < 0.999;
  };
}

/** A box with rounded edges round its long sides (a laptop's slab). */
class RoundedSlab extends THREE.ExtrudeGeometry {
  constructor(w: number, h: number, d: number, r: number) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2, rr = Math.min(r, w / 2, h / 2);
    shape.moveTo(x + rr, y);
    shape.lineTo(x + w - rr, y); shape.quadraticCurveTo(x + w, y, x + w, y + rr);
    shape.lineTo(x + w, y + h - rr); shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    shape.lineTo(x + rr, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - rr);
    shape.lineTo(x, y + rr); shape.quadraticCurveTo(x, y, x + rr, y);
    super(shape, { depth: d, bevelEnabled: false, curveSegments: 6 });
    this.translate(0, 0, -d / 2);
  }
}

function signTexture(n: number, name: string, colors: [string, string]) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#07060e';
  ctx.fillRect(0, 0, 1024, 256);
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 238, 1024, 18);
  ctx.font = '500 44px ui-monospace, Menlo, monospace';
  ctx.fillStyle = colors[1];
  ctx.fillText(`CH ${String(n).padStart(2, '0')}`, 40, 72);
  ctx.font = '800 92px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  let size = 92;
  while (ctx.measureText(name.toUpperCase()).width > 950 && size > 40) ctx.font = `800 ${(size -= 4)}px system-ui, sans-serif`;
  ctx.fillText(name.toUpperCase(), 40, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMascotLine(pixelRatio: number, GROUND: number, plinthTop: number, extent: number, stations: Station[], stationModel: THREE.Object3D) {
  const group = new THREE.Group();
  const TRACK_Y = GROUND + 10.5;
  const R = Math.min(36, extent * 0.76);

  /* ---- the route: out of the plaza, up the avenue, round the city ---- */
  /* The start station hangs in the sky over the plaza, on the left of the close view, the track
     running towards you through it; from there the line swings out and down onto the loop. */
  // the start station stands in the plaza, where he did, its track running up the avenue
  const S = new THREE.Vector3(0, plinthTop + 0.35, -1);
  const SDIR = new THREE.Vector3(0, 0, 1);
  const pts: THREE.Vector3[] = [
    S.clone().addScaledVector(SDIR, -11),
    S.clone(),
    S.clone().addScaledVector(SDIR, 9),
    new THREE.Vector3(0, GROUND + 5, 17),
    new THREE.Vector3(0, TRACK_Y, 26),
  ];
  // the loop, clockwise seen from above, starting where the avenue meets it
  const loopStart = Math.PI / 2;
  for (let a = 0; a <= Math.PI * 2 * 0.94; a += Math.PI / 12) {
    const t = loopStart - a;
    pts.push(new THREE.Vector3(Math.cos(t) * R, TRACK_Y, Math.sin(t) * R));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const LEN = curve.getLength();

  // the stations, spaced round the loop, and where on the curve each one is
  const stationAngles = stations.map((_, k) => loopStart - Math.PI / 3 - (k * Math.PI * 2 * 0.8) / stations.length);
  const tmp = new THREE.Vector3();
  const nearestU = (p: THREE.Vector3) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= 2000; i++) {
      const u = i / 2000;
      const d = curve.getPointAt(u, tmp).distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  };
  const stops = [nearestU(S), ...stationAngles.map((t) => nearestU(new THREE.Vector3(Math.cos(t) * R, TRACK_Y, Math.sin(t) * R)))];

  /* ---- the track: a deck with violet light strips, on pillars, built by particles ---- */
  const trackUniforms = { uLead: { value: 0.01 }, uFrom: { value: 0 }, uReveal: { value: 0 }, uDim: { value: 1 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } };
  const deckGeo = new THREE.TubeGeometry(curve, 600, 0.55, 4, false);
  const deck = new THREE.Mesh(deckGeo, new THREE.ShaderMaterial({
    uniforms: trackUniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal, uDim, uFrom; varying vec2 vUv;
      void main() {
        if (vUv.x > uReveal - 0.015 || vUv.x < uFrom) discard; // laid just behind its particles, and not through the station
        float edge = 1.0 - smoothstep(0.0, 0.05, abs(fract(vUv.y * 4.0) - 0.5) - 0.42);
        vec3 col = vec3(0.012, 0.01, 0.02) + vec3(0.5, 0.25, 0.85) * edge * 0.55; // a dark deck, lit along its edges
        gl_FragColor = vec4(col * uDim, 1.0);
      }`,
  }));
  deck.visible = false; // the line is made of light: its particles are the track
  group.add(deck);

  // light strips along both edges, the particles that build it, and the pillars under it
  const sp: number[] = [], su: number[] = [], sk: number[] = [], sr: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const P = new THREE.Vector3();
  const strips = isMobile ? 1500 : 3000;
  for (let i = 0; i < strips; i++) {
    const u = i / strips;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, tan);
    side.crossVectors(tan, up).normalize();
    for (const s of [-1.12, 1.12]) {
      sp.push(P.x + side.x * s, P.y + 0.02, P.z + side.z * s);
      su.push(u); sk.push(0); sr.push(Math.random());
    }
  }
  // building particles: a cloud that rises into the deck just ahead of where it is laid
  const builders = isMobile ? 16000 : 42000;
  for (let i = 0; i < builders; i++) {
    const u = Math.random();
    curve.getPointAt(u, P);
    curve.getTangentAt(u, tan);
    side.crossVectors(tan, up).normalize();
    // a deck of light: wider than the train, and with depth under it, so it shows round the train's sides
    const s = (Math.random() - 0.5) * 2.2;
    const y = -0.08 - Math.random() * Math.random() * 0.55;
    sp.push(P.x + side.x * s, P.y + y, P.z + side.z * s);
    su.push(u); sk.push(1); sr.push(Math.random());
  }
  // pillars every few metres, once it is up off the ground
  const pillarStep = 3.2 / LEN;
  for (let u = 0.02; u < 1; u += pillarStep) {
    curve.getPointAt(u, P);
    if (P.y - GROUND < 3) continue;
    for (let y = GROUND; y < P.y - 0.3; y += 0.12) {
      for (const s of [-0.2, 0.2]) {
        sp.push(P.x + s * 0.5, y, P.z + s * 0.5);
        su.push(u); sk.push(2); sr.push(Math.random());
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  lineGeo.setAttribute('aU', new THREE.Float32BufferAttribute(su, 1));
  lineGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(sk, 1));
  lineGeo.setAttribute('aRand', new THREE.Float32BufferAttribute(sr, 1));
  const lights = new THREE.Points(lineGeo, new THREE.ShaderMaterial({
    uniforms: trackUniforms,
    vertexShader: /* glsl */ `
      uniform float uReveal, uTime, uPixelRatio, uFrom, uLead;
      attribute float aU, aKind, aRand;
      varying float vA, vKind;
      void main() {
        vec3 p = position;
        float ahead = aU - uReveal; // > 0: not yet built
        if (aU < uFrom) ahead = 1.0; // the station has its own track
        vA = 1.0;
        if (aKind > 0.5 && aKind < 1.5) {
          // builders: rise from below and swirl in as the build front reaches them
          float t = clamp(1.0 - ahead / uLead, 0.0, 1.0); // they gather in the last couple of metres ahead of the train
          float e = t * t * (3.0 - 2.0 * t);
          float a = aRand * 40.0 + (1.0 - e) * 6.0;
          p += vec3(cos(a) * 2.5, -3.0 - aRand * 4.0, sin(a) * 2.5) * (1.0 - e);
          vA = step(0.001, t) * (1.0 - smoothstep(0.0, 0.08, -ahead) * 0.3);
          p += vec3(sin(uTime * 0.9 + aRand * 50.0), sin(uTime * 1.2 + aRand * 31.0) * 0.5, cos(uTime * 0.8 + aRand * 17.0)) * 0.05 * e;
        } else {
          // pulses of light running along the line, his way round
          vA = step(ahead, 0.0) * (0.6 + 1.2 * pow(0.5 + 0.5 * sin(aU * 90.0 - uTime * 2.5), 6.0));
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = aKind < 0.5 ? 1.8 : aKind < 1.5 ? 2.2 : 1.2;
        gl_PointSize = max(2.0, s * 16.0 * uPixelRatio / -mv.z);
        vKind = aKind;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim; varying float vA, vKind;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        vec3 col = vKind < 0.5 ? vec3(0.85, 0.55, 1.0) : vKind < 1.5 ? vec3(0.62, 0.36, 1.0) : vec3(0.45, 0.28, 0.75);
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(col * uDim * 1.6, (core * core * 0.7 + exp(-d * d * 40.0) * 0.9) * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lights.frustumCulled = false;
  group.add(lights);

  /* ---- the stations: platform, sign, and the solution turning over it ---- */
  const holos: { points: THREE.Points; mat: THREE.ShaderMaterial; base: THREE.Vector3 }[] = [];
  const stationBuildings: THREE.Group[] = [];
  const stopBuilds: ((t: number, time: number) => void)[] = [];
  const signs: THREE.Mesh[] = [];
  const banners: { mat: THREE.MeshBasicMaterial; texs: THREE.Texture[]; i: number; next: number }[] = [];
  const liveBoards: ReturnType<typeof glitchBoard>[] = [];
  const screens: THREE.Mesh[] = [];
  stations.forEach((st, k) => {
    const u = stops[k + 1];
    curve.getPointAt(u, P);
    curve.getTangentAt(u, tan);
    side.crossVectors(tan, up).normalize();
    // the outside of the loop, away from the city's middle
    const out = side.dot(new THREE.Vector3(P.x, 0, P.z)) > 0 ? side.clone() : side.clone().negate();
    /* Each station is its own building, in its solution's colours: an arched hall, a sawtooth
       shed, a glass box, a cable-stayed roof on a mast, a dome, a slab on fins. Local frame:
       +z along the track, +x out to the platform side. It rises into place as the line reaches it. */
    const sg = new THREE.Group();
    sg.position.copy(P);
    sg.lookAt(P.clone().add(tan));
    // lookAt aims +z along the track; make +x the platform side
    // the platform on the inside of the loop: the camera rides outside, so it sees the train, then the station and its banner behind
    if (new THREE.Vector3(1, 0, 0).applyQuaternion(sg.quaternion).dot(out) > 0) sg.rotateY(Math.PI);
    /* A billboard beside the line, the way they stand over Times Square: a steel frame on lattice
       columns down to the street, a catwalk, spotlights leaning out over the screen. The screen
       shows the solution's photograph with its channel and name, then the work that proves it. */
    if (k !== 6) {
    const BW = 8, BH = 3.3, BX = 3.4, BY = BH / 2 + 0.6; // local: +x away from the track, +z along it
    const steel = new THREE.MeshStandardMaterial({ color: '#2b2f37', roughness: 0.4, metalness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: st.colors[0], roughness: 0.4, metalness: 0.3, emissive: st.colors[0], emissiveIntensity: 0.6 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      sg.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(0.25, BH + 0.35, BW + 0.35), steel, BX + 0.12, BY, 0);      // the back and frame
    add(new THREE.BoxGeometry(0.06, 0.08, BW + 0.3), accent, BX - 0.02, BY + BH / 2 + 0.16, 0); // lit edges
    add(new THREE.BoxGeometry(0.06, 0.08, BW + 0.3), accent, BX - 0.02, BY - BH / 2 - 0.16, 0);
    const drop = P.y - GROUND; // down to the street
    for (const z of [-BW * 0.32, BW * 0.32]) {
      // a lattice column: four legs and cross bracing
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        add(new THREE.BoxGeometry(0.07, drop + BY, 0.07), steel, BX + 0.6 + dx, (BY - drop) / 2, z + dz);
      }
      for (let y = -drop; y < BY - 0.5; y += 0.9) {
        const brace = add(new THREE.BoxGeometry(0.03, 0.03, 0.72), steel, BX + 0.6, y + 0.45, z);
        brace.rotation.x = 0.9;
      }
    }
    add(new THREE.BoxGeometry(0.7, 0.05, BW + 0.2), steel, BX - 0.35, 0.55, 0); // the catwalk
    add(new THREE.BoxGeometry(0.03, 0.4, BW + 0.2), steel, BX - 0.7, 0.77, 0);  // its rail
    for (let i = 0; i < 4; i++) {
      // spotlight arms from the top, leaning out over the screen
      const z = -BW * 0.375 + i * BW * 0.25;
      add(new THREE.BoxGeometry(0.9, 0.04, 0.04), steel, BX - 0.45, BY + BH / 2 + 0.25, z);
      const lamp = add(new THREE.CylinderGeometry(0.09, 0.14, 0.22, 10), new THREE.MeshBasicMaterial({ color: '#fff4dc' }), BX - 0.9, BY + BH / 2 + 0.18, z);
      lamp.rotation.z = -0.6;
    }
    // the screen: the photograph, its channel and its name, composed on a canvas
    const compose = (img: HTMLImageElement | null) => {
      const c = document.createElement('canvas');
      c.width = 1600; c.height = Math.round(1600 * BH / BW);
      const g = c.getContext('2d')!;
      g.fillStyle = '#07060e'; g.fillRect(0, 0, c.width, c.height);
      if (img) {
        const sc = Math.max(c.width / img.width, c.height / img.height);
        g.drawImage(img, (c.width - img.width * sc) / 2, (c.height - img.height * sc) / 2, img.width * sc, img.height * sc);
      }
      // the name is in the copy beside it; the board carries only the picture and its channel
      g.fillStyle = 'rgba(5,5,10,0.78)'; g.fillRect(50, 50, 230, 74);
      g.fillStyle = st.colors[1]; g.font = '500 44px ui-monospace, Menlo, monospace';
      g.fillText(`CH ${String(k + 1).padStart(2, '0')}`, 72, 104);
      g.fillStyle = st.colors[0]; g.fillRect(50, c.height - 30, c.width - 100, 8);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const first = compose(null);
    const screenMat = new THREE.MeshBasicMaterial({ map: first, toneMapped: false, color: new THREE.Color(0.42, 0.42, 0.42) });
    const screen = add(new THREE.PlaneGeometry(BW, BH), screenMat, BX - 0.01, BY, 0);
    screens.push(screen);
    screen.rotation.y = -Math.PI / 2; // facing the track
    // and the same picture on its back, so it reads from the city side too
    const back = add(new THREE.PlaneGeometry(BW, BH), screenMat, BX + 0.26, BY, 0);
    back.rotation.y = Math.PI / 2;
    const texs: THREE.Texture[] = [first];
    const [photo, ...work] = st.images;
    if (photo) {
      const im = new Image();
      im.onload = () => { texs[0] = compose(im); if (screenMat.map === first) screenMat.map = texs[0]; };
      im.src = photo;
    }
    const loader = new THREE.TextureLoader();
    for (const url of work) {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      texs.push(t);
    }
    banners.push({ mat: screenMat, texs, i: 0, next: 5 + k });
    } else {
      /* Tech & Automation: a silver MacBook Pro, giant, standing open beside the line on a steel
         deck, its screen a macOS desktop with the projects folder on it. Clicking it opens the Mac. */
      const steel = new THREE.MeshStandardMaterial({ color: '#2b2f37', roughness: 0.4, metalness: 0.8 });
      // lit from within a little, so it glows against the night rather than going black
      const alu = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.28, metalness: 0.6, emissive: '#aab0c4', emissiveIntensity: 0.32 });
      const aluDark = new THREE.MeshStandardMaterial({ color: '#8e929a', roughness: 0.35, metalness: 0.6, emissive: '#7c8196', emissiveIntensity: 0.25 });
      const black = new THREE.MeshStandardMaterial({ color: '#0b0b0e', roughness: 0.5, metalness: 0.2 });
      const W = 7.2, D = 5.0, T = 0.26, CX = 4.2, Y0 = 0.35; // base: across the track (x), along it (z)
      const addM = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = sg) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
      };
      // the deck it stands on, down to the street on lattice legs
      addM(new THREE.BoxGeometry(D + 1.2, 0.18, W + 1.2), steel, CX, Y0 - 0.1, 0);
      const drop = P.y - GROUND;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addM(new THREE.BoxGeometry(0.12, drop + Y0, 0.12), steel, CX + dx * D * 0.42, (Y0 - drop) / 2, dz * W * 0.42);
      // the base: aluminium slab, black keyboard well, trackpad, speaker grilles
      const base = new THREE.Group();
      base.position.set(CX, Y0 + T / 2, 0);
      sg.add(base);
      addM(new RoundedSlab(D, T, W, 0.25), alu, 0, 0, 0, base);
      addM(new THREE.BoxGeometry(D * 0.36, 0.02, W * 0.78), black, 0.35, T / 2 + 0.005, 0, base);
      // the keyboard, backlit: black keys in rows, each legend glowing white and a soft spill round the caps
      {
        const kc = document.createElement('canvas');
        kc.width = 1560; kc.height = 520;
        const kx = kc.getContext('2d')!;
        kx.fillStyle = '#050507'; kx.fillRect(0, 0, kc.width, kc.height);
        const rows = [
          ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏻'],
          ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'],
          ['⇥', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
          ['⇪', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", '↩'],
          ['⇧', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', '⇧'],
          ['fn', '⌃', '⌥', '⌘', ' ', '⌘', '⌥', '◀', '▲▼', '▶'],
        ];
        const gap = 10, rowH = (kc.height - gap * 7) / 6;
        rows.forEach((row, r) => {
          // widths: the space bar and the edge keys run wider, like the real board
          const wts = row.map((k) => (k === ' ' ? 5.2 : ['⌫', '⇥', '⇪', '↩', '⇧'].includes(k) ? 1.7 : 1));
          const total = wts.reduce((a, b) => a + b, 0);
          const unit = (kc.width - gap * (row.length + 1)) / total;
          let x = gap;
          const y = gap + r * (rowH + gap);
          const h = r === 0 ? rowH * 0.7 : rowH;
          row.forEach((k, i) => {
            const w = wts[i] * unit;
            kx.shadowColor = 'rgba(235,240,255,0.55)'; kx.shadowBlur = 14; // the backlight spilling round each cap
            kx.fillStyle = '#101014';
            kx.beginPath(); kx.roundRect(x, y, w, h, 8); kx.fill();
            kx.shadowBlur = 10; kx.shadowColor = 'rgba(255,255,255,0.9)';
            kx.fillStyle = '#f4f6ff';
            kx.font = `500 ${k.length > 2 ? 22 : 34}px system-ui, sans-serif`;
            kx.textAlign = 'center'; kx.textBaseline = 'middle';
            kx.fillText(k, x + w / 2, y + h / 2);
            x += w + gap;
          });
        });
        const ktex = new THREE.CanvasTexture(kc);
        ktex.colorSpace = THREE.SRGBColorSpace;
        const keys = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.76, D * 0.34), new THREE.MeshBasicMaterial({ map: ktex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.4) }));
        // lie flat in the well, rows running along the hinge, the top row nearest it
        keys.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        keys.position.set(0.35, T / 2 + 0.017, 0);
        base.add(keys);
      }
      addM(new THREE.BoxGeometry(D * 0.3, 0.015, W * 0.38), aluDark, -D * 0.3, T / 2 + 0.004, 0, base);
      for (const z of [-W * 0.44, W * 0.44]) addM(new THREE.BoxGeometry(D * 0.36, 0.015, 0.22), aluDark, 0.35, T / 2 + 0.004, z, base);
      // the lid, hinged at the back edge, opened a little past upright, leaning away from the track
      const hinge = new THREE.Group();
      hinge.position.set(CX + D / 2, Y0 + T, 0);
      hinge.rotation.z = -0.28;
      sg.add(hinge);
      const LH = D * 0.94;
      addM(new RoundedSlab(0.16, LH, W, 0.25), alu, 0.08, LH / 2, 0, hinge);
      addM(new THREE.BoxGeometry(0.02, LH - 0.1, W - 0.1), black, -0.005, LH / 2, 0, hinge); // the bezel
      // the screen: a macOS desktop, the projects folder on it
      const c = document.createElement('canvas');
      c.width = 1600; c.height = Math.round(1600 * (LH - 0.34) / (W - 0.3));
      const g = c.getContext('2d')!;
      const bg = g.createRadialGradient(c.width * 0.2, c.height * 0.1, 0, c.width * 0.2, c.height * 0.1, c.width);
      bg.addColorStop(0, '#4b1b8f'); bg.addColorStop(0.45, '#1a0b36'); bg.addColorStop(1, '#07060e');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.font = '600 260px "Inter Tight", system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DIZRUPT', c.width / 2, c.height / 2);
      g.fillStyle = 'rgba(20,20,26,0.8)'; g.fillRect(0, 0, c.width, 44);
      g.fillStyle = '#fff'; g.font = '600 26px system-ui, sans-serif'; g.textAlign = 'left';
      g.fillText('  Finder   File   Edit   View', 20, 24);
      // the folder, and a label under it
      const fx = c.width / 2 - 120, fy = c.height / 2 - 110;
      g.fillStyle = '#74c0fc'; g.fillRect(fx, fy - 26, 100, 40);
      const fg = g.createLinearGradient(0, fy, 0, fy + 180); fg.addColorStop(0, '#74c0fc'); fg.addColorStop(1, '#339af0');
      g.fillStyle = fg; g.fillRect(fx, fy, 240, 180);
      g.fillStyle = '#fff'; g.font = '600 40px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('projects', c.width / 2, fy + 240);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '500 28px system-ui, sans-serif';
      g.fillText('click to open', c.width / 2, fy + 290);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.95, 0.95, 0.95) });
      const screen = addM(new THREE.PlaneGeometry(W - 0.3, LH - 0.34), screenMat, -0.02, LH / 2 + 0.05, 0, hinge);
      screen.rotation.y = -Math.PI / 2; // facing the track
      // a glowing rim round the lid and along the base's front lip
      const rim = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.72, 1.0), toneMapped: false });
      addM(new THREE.BoxGeometry(0.03, 0.05, W + 0.02), rim, 0.02, LH + 0.02, 0, hinge);
      for (const z of [-W / 2, W / 2]) addM(new THREE.BoxGeometry(0.03, LH, 0.05), rim, 0.02, LH / 2, z, hinge);
      addM(new THREE.BoxGeometry(0.05, 0.04, W + 0.02), rim, -D / 2 - 0.01, T / 2, 0, base);
      // the notch
      addM(new THREE.BoxGeometry(0.02, 0.16, 0.7), black, -0.03, LH - 0.13, 0, hinge);
      screens.push(screen);
    }
    // (built by particles once it is in place, below)
    group.add(sg);
    stationBuildings.push(sg);
    group.updateMatrixWorld(true);
    stopBuilds.push(particleBuilder(sg, group, pixelRatio));
    // the sign, facing out towards the camera's side of the track
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 1),
      new THREE.MeshBasicMaterial({ map: signTexture(k + 1, st.name, st.colors), toneMapped: false, transparent: true }),
    );
    sign.position.copy(P).addScaledVector(out, 2.6).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(tan, -2);
    sign.lookAt(sign.position.clone().add(out));
    group.add(sign);
    signs.push(sign);
    // the hologram: the solution's model, sampled down, turning above the platform ahead of the train
    const every = isMobile ? 10 : 6;
    const n = Math.floor(COUNT / every);
    const hp = new Float32Array(n * 3);
    const hr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      hp[i * 3] = st.shape[i * every * 3];
      hp[i * 3 + 1] = st.shape[i * every * 3 + 1];
      hp[i * 3 + 2] = st.shape[i * every * 3 + 2];
      hr[i] = Math.random();
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('aRand', new THREE.BufferAttribute(hr, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Color(st.colors[0]) }, uB: { value: new THREE.Color(st.colors[1]) },
        uOn: { value: 0 }, uPixelRatio: { value: pixelRatio }, uDim: trackUniforms.uDim, uTime: trackUniforms.uTime,
      },
      vertexShader: /* glsl */ `
        uniform float uOn, uPixelRatio, uTime; attribute float aRand; varying float vR;
        void main() {
          // it gathers out of the air as the train comes in, and loosens again as it leaves
          vec3 p = position * (0.4 + 0.6 * uOn) + vec3(sin(aRand * 40.0 + uTime), cos(aRand * 30.0 + uTime), sin(aRand * 20.0)) * (1.0 - uOn) * 1.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.5, (2.0 + aRand * 2.0) * 7.0 * uPixelRatio / -mv.z);
          vR = aRand;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uA, uB; uniform float uOn, uDim; varying float vR;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(mix(uA, uB, vR) * uDim, smoothstep(0.5, 0.0, d) * (0.25 + 0.75 * uOn) * 0.8);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(hg, mat);
    points.frustumCulled = false;
    const base = P.clone().addScaledVector(out, 2.6).addScaledVector(tan, 3.5).add(new THREE.Vector3(0, 3.6, 0));
    points.position.copy(base);
    points.scale.setScalar(0.8);
    group.add(points);
    holos.push({ points, mat, base });
  });

  const station = buildStation(stationModel, pixelRatio);
  station.group.position.copy(S);
  trackUniforms.uLead.value = 2.5 / LEN;
  trackUniforms.uFrom.value = nearestU(S.clone().addScaledVector(SDIR, 10.5));
  station.group.rotation.y = Math.atan2(SDIR.x, SDIR.z);
  group.add(station.group);

  /* ---- where the train is: s runs 0 (the plaza) → 1..6 (the stations) ---- */
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  function poseAt(s: number) {
    const i = Math.max(0, Math.min(stops.length - 2, Math.floor(s)));
    const f = Math.min(1, Math.max(0, s - i));
    const u = stops[i] + (stops[i + 1] - stops[i]) * f;
    curve.getPointAt(u, pos);
    curve.getTangentAt(u, dir);
    // the train rides on the deck; its own points have their wheels at y = 0
    quat.setFromUnitVectors(zAxis, dir);
    return { pos: pos.clone().add(new THREE.Vector3(0, 0.03, 0)), dir: dir.clone(), quat: quat.clone(), u };
  }

  /* Every stop loses the signal now and then, as the rest of the house does: the whole structure
     jumps a hair, and its screen splits into red and cyan copies that slip apart. */
  const faults = stationBuildings.map((sg, k) => {
    const scr = screens[k];
    const ghosts = [new THREE.Color(1, 0.1, 0.3), new THREE.Color(0.1, 0.9, 1)].map((gc) => {
      const gm = new THREE.Mesh(scr.geometry, new THREE.MeshBasicMaterial({ toneMapped: false, color: gc.multiplyScalar(0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      gm.visible = false;
      scr.add(gm);
      return gm;
    });
    return { sg, scr, ghosts, base: sg.position.clone(), next: 2 + Math.random() * 4, until: 0 };
  });
  const reduced = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function update(time: number, reveal: number, dim: number, s: number, stationBuild = 1) {
    for (const f of faults) {
      if (time > f.next) { f.until = time + 0.22 + Math.random() * 0.3; f.next = f.until + 1.2 + Math.random() * 2.5; }
      const tearing = !reduced && time < f.until && f.sg.visible;
      f.sg.position.copy(f.base);
      if (tearing) { f.sg.translateZ((Math.random() - 0.5) * 1.4); f.sg.translateY((Math.random() - 0.5) * 0.5); }
      f.scr.scale.set(tearing && Math.random() < 0.4 ? 1 + Math.random() * 0.25 : 1, tearing && Math.random() < 0.3 ? 0.8 + Math.random() * 0.15 : 1, 1);
      const map = (f.scr.material as THREE.MeshBasicMaterial).map;
      f.ghosts.forEach((gm, gi) => {
        gm.visible = tearing;
        (gm.material as THREE.MeshBasicMaterial).map = map;
        gm.position.set((gi ? 1 : -1) * (0.6 + Math.random() * 1.2), (Math.random() - 0.5) * 0.6, gi ? 0.012 : 0.008);
      });
    }
    if (reveal > 0.001) liveBoards.forEach((b) => b.draw(time));
    for (const b of banners) {
      if (time > b.next && b.texs.length > 1) {
        b.i = (b.i + 1) % b.texs.length;
        b.mat.map = b.texs[b.i];
        b.next = time + (b.i === 0 ? 6 : 3.5); // the photograph holds longer than the work
      }
    }
    station.build(stationBuild, time);
    trackUniforms.uReveal.value = reveal;
    trackUniforms.uDim.value = dim;
    trackUniforms.uTime.value = time;
    group.visible = reveal > 0.001 || stationBuild > 0.001;
    holos.forEach((h, k) => {
      // lit while the train stands at its station
      const near = 1 - Math.min(1, Math.abs(s - (k + 1)) / 0.6);
      h.mat.uniforms.uOn.value += (near * near * (3 - 2 * near) - h.mat.uniforms.uOn.value) * 0.08;
      h.points.rotation.y = time * 0.35 + k;
      h.points.position.y = h.base.y + Math.sin(time * 0.8 + k) * 0.25;
      h.points.visible = false; // no floating models: the billboard carries the solution
      // the station rises out of the ground as the line reaches it
      // it rises as the track reaches the near end of its platform, done by the time the track reaches its middle
      // it builds as the track closes in on it: begun forty metres out, standing a little before the train arrives
      const up = Math.min(1, Math.max(0, (reveal - (stops[k + 1] - 40 / LEN)) / (34 / LEN)));
      stopBuilds[k](up * up * (3 - 2 * up), time);
      signs[k].visible = false;
    });
  }

  return { group, curve, stops, poseAt, update, color: VIOLET, stationAt: S, length: LEN, screens };
}
