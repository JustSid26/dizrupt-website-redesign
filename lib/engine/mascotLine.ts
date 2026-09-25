import * as THREE from 'three';
import { COUNT, isMobile } from './config';

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
export type Station = { name: string; shape: Float32Array; colors: [string, string] };

const VIOLET = new THREE.Color('#a855ff');

/** A train made of points: a streamlined engine and three carriages, facing +z, wheels at y = 0. */
export function trainShape(): Float32Array {
  const arr = new Float32Array(COUNT * 3);
  const W = 1.25, H = 1.35, CAR = 3.1, GAP = 0.28, N = 4;
  const total = N * CAR + (N - 1) * GAP;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < COUNT; i++) {
    const c = Math.floor(rnd() * N); // which car
    const z0 = total / 2 - c * (CAR + GAP) - CAR; // its back
    let x, y, z;
    const k = rnd();
    if (k < 0.08) {
      // wheels: two rings a side under each car
      const wz = z0 + (rnd() < 0.5 ? 0.55 : CAR - 0.55);
      const a = rnd() * Math.PI * 2;
      x = (rnd() < 0.5 ? -1 : 1) * W * 0.46;
      y = 0.22 + Math.sin(a) * 0.2;
      z = wz + Math.cos(a) * 0.2;
    } else {
      // the body: a box with a rounded roof, the engine's nose tapering to a point
      const u = rnd(), v = rnd();
      z = z0 + u * CAR;
      const nose = c === 0 ? Math.max(0, (z - (z0 + CAR * 0.55)) / (CAR * 0.45)) : 0;
      const w = W * (1 - nose * 0.55), h = H * (1 - nose * 0.45);
      const side = rnd();
      if (side < 0.62) {
        // the sides, with a band of window frames that catches more points
        x = (rnd() < 0.5 ? -1 : 1) * w / 2;
        y = 0.35 + (rnd() < 0.35 ? 0.62 + (rnd() - 0.5) * 0.3 : v * (h - 0.35));
      } else if (side < 0.9) {
        // the curved roof
        const a = (rnd() - 0.5) * Math.PI;
        x = Math.sin(a) * w / 2;
        y = h - 0.28 + Math.cos(a) * 0.28;
      } else {
        // the ends
        x = (rnd() - 0.5) * w;
        y = 0.35 + v * (h - 0.35);
        z = rnd() < 0.5 ? z0 : z0 + CAR;
      }
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
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

export function createMascotLine(pixelRatio: number, GROUND: number, plinthTop: number, extent: number, stations: Station[]) {
  const group = new THREE.Group();
  const TRACK_Y = GROUND + 10.5;
  const R = Math.min(36, extent * 0.76);

  /* ---- the route: out of the plaza, up the avenue, round the city ---- */
  const pts: THREE.Vector3[] = [
    new THREE.Vector3(0, plinthTop + 0.6, -1.5),
    new THREE.Vector3(0, plinthTop + 0.8, 4),
    new THREE.Vector3(0, GROUND + 5, 14),
    new THREE.Vector3(0, TRACK_Y, 24),
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
  const stops = [0, ...stationAngles.map((t) => nearestU(new THREE.Vector3(Math.cos(t) * R, TRACK_Y, Math.sin(t) * R)))];

  /* ---- the track: a deck with violet light strips, on pillars, built by particles ---- */
  const trackUniforms = { uReveal: { value: 0 }, uDim: { value: 1 }, uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } };
  const deckGeo = new THREE.TubeGeometry(curve, 600, 0.55, 4, false);
  const deck = new THREE.Mesh(deckGeo, new THREE.ShaderMaterial({
    uniforms: trackUniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal, uDim; varying vec2 vUv;
      void main() {
        if (vUv.x > uReveal - 0.015) discard; // laid just behind its particles
        vec3 col = vec3(0.006, 0.005, 0.01); // a dark deck (linear light); its edges are the lights
        gl_FragColor = vec4(col * uDim, 1.0);
      }`,
  }));
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
    for (const s of [-0.62, 0.62]) {
      sp.push(P.x + side.x * s, P.y + 0.08, P.z + side.z * s);
      su.push(u); sk.push(0); sr.push(Math.random());
    }
  }
  // building particles: a cloud that rises into the deck just ahead of where it is laid
  const builders = isMobile ? 6000 : 14000;
  for (let i = 0; i < builders; i++) {
    const u = Math.random();
    curve.getPointAt(u, P);
    curve.getTangentAt(u, tan);
    side.crossVectors(tan, up).normalize();
    const s = (Math.random() - 0.5) * 1.2;
    sp.push(P.x + side.x * s, P.y + (Math.random() - 0.5) * 0.3, P.z + side.z * s);
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
      uniform float uReveal, uTime, uPixelRatio;
      attribute float aU, aKind, aRand;
      varying float vA, vKind;
      void main() {
        vec3 p = position;
        float ahead = aU - uReveal; // > 0: not yet built
        vA = 1.0;
        if (aKind > 0.5 && aKind < 1.5) {
          // builders: rise from below and swirl in as the build front reaches them
          float t = clamp(1.0 - ahead / 0.06, 0.0, 1.0);
          float e = t * t * (3.0 - 2.0 * t);
          float a = aRand * 40.0 + (1.0 - e) * 6.0;
          p += vec3(cos(a) * 2.5, -3.0 - aRand * 4.0, sin(a) * 2.5) * (1.0 - e);
          vA = step(0.001, t) * (1.0 - smoothstep(0.0, 0.08, -ahead) * 0.55);
          p += vec3(sin(uTime * 0.9 + aRand * 50.0), sin(uTime * 1.2 + aRand * 31.0) * 0.5, cos(uTime * 0.8 + aRand * 17.0)) * 0.05 * e;
        } else {
          // pulses of light running along the line, his way round
          vA = step(ahead, 0.0) * (0.6 + 1.2 * pow(0.5 + 0.5 * sin(aU * 90.0 - uTime * 2.5), 6.0));
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = aKind < 0.5 ? 1.1 : aKind < 1.5 ? 3.2 : 0.8;
        gl_PointSize = max(1.5, s * 6.0 * uPixelRatio / -mv.z);
        vKind = aKind;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim; varying float vA, vKind;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        vec3 col = vKind < 0.5 ? vec3(0.5, 0.28, 0.75) : vKind < 1.5 ? vec3(0.8, 0.65, 1.0) : vec3(0.2, 0.13, 0.32);
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(col * uDim * 1.2, (core * core * 0.6 + exp(-d * d * 40.0) * 0.8) * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lights.frustumCulled = false;
  group.add(lights);

  /* ---- the stations: platform, sign, and the solution turning over it ---- */
  const holos: { points: THREE.Points; mat: THREE.ShaderMaterial; base: THREE.Vector3 }[] = [];
  stations.forEach((st, k) => {
    const u = stops[k + 1];
    curve.getPointAt(u, P);
    curve.getTangentAt(u, tan);
    side.crossVectors(tan, up).normalize();
    // the outside of the loop, away from the city's middle
    const out = side.dot(new THREE.Vector3(P.x, 0, P.z)) > 0 ? side.clone() : side.clone().negate();
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.25, 7),
      new THREE.MeshBasicMaterial({ color: '#07060c' }),
    );
    platform.position.copy(P).addScaledVector(out, 1.8).add(new THREE.Vector3(0, -0.2, 0));
    platform.lookAt(platform.position.clone().add(tan));
    group.add(platform);
    // the sign, facing out towards the camera's side of the track
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 1),
      new THREE.MeshBasicMaterial({ map: signTexture(k + 1, st.name, st.colors), toneMapped: false, transparent: true }),
    );
    sign.position.copy(P).addScaledVector(out, 2.6).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(tan, -2);
    sign.lookAt(sign.position.clone().add(out));
    group.add(sign);
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
    return { pos: pos.clone().add(new THREE.Vector3(0, 0.1, 0)), dir: dir.clone(), quat: quat.clone(), u };
  }

  function update(time: number, reveal: number, dim: number, s: number) {
    trackUniforms.uReveal.value = reveal;
    trackUniforms.uDim.value = dim;
    trackUniforms.uTime.value = time;
    group.visible = reveal > 0.001;
    holos.forEach((h, k) => {
      // lit while the train stands at its station
      const near = 1 - Math.min(1, Math.abs(s - (k + 1)) / 0.6);
      h.mat.uniforms.uOn.value += (near * near * (3 - 2 * near) - h.mat.uniforms.uOn.value) * 0.08;
      h.points.rotation.y = time * 0.35 + k;
      h.points.position.y = h.base.y + Math.sin(time * 0.8 + k) * 0.25;
      h.points.visible = reveal > stops[k + 1];
    });
  }

  return { group, curve, stops, poseAt, update, color: VIOLET };
}
