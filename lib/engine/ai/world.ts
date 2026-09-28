import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Mascot } from '../mascot';

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   The chip is his heart. Out of the hand-over comes an AI
   accelerator, floating on its own in the dark: a silicon die
   with its interference sheen ringed by HBM stacks on the
   interposer, the package on its steel stiffener, solder balls
   underneath — and on the die, the Dizrupt mark, beating.

   Then the scroll builds him round it. Signals leave the chip
   along a branching tree of nerves that runs through his whole
   figure, head to toe; each particle of him lights where its
   nerve arrives, and the chip settles into his chest as the
   heart. Built, the heart keeps beating and every beat sends
   a pulse out along the nerves.

   World frame: the chip (the heart) is the origin; he stands
   round it at his own scale (the landing's mascot units).
   ========================================================= */
const CHIP = 0.3; // the package is ~7 across in its own units; this makes it the size of his heart

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** The die, seen through its passivation: tensor-core arrays, caches, the I/O ring. */
function dieTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const rand = rng(3);
  g.fillStyle = '#10121a';
  g.fillRect(0, 0, S, S);
  // I/O ring
  g.fillStyle = '#20243a';
  for (let i = 0; i < 96; i++) {
    const f = (i / 96) * S;
    g.fillRect(f, 6, 6, 18);
    g.fillRect(f, S - 24, 6, 18);
    g.fillRect(6, f, 18, 6);
    g.fillRect(S - 24, f, 18, 6);
  }
  // the compute tiles: 8 x 8 blocks, each a fine array of cells
  const M = 60, T = (S - 2 * M) / 8;
  for (let by = 0; by < 8; by++)
    for (let bx = 0; bx < 8; bx++) {
      const x = M + bx * T, y = M + by * T;
      const cache = (bx + by) % 5 === 0;
      g.fillStyle = cache ? '#1b2035' : '#161a2a';
      g.fillRect(x + 4, y + 4, T - 8, T - 8);
      g.fillStyle = cache ? '#2a3150' : '#232a44';
      const n = cache ? 18 : 10;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) if (rand() < 0.92) g.fillRect(x + 8 + (i * (T - 16)) / n, y + 8 + (j * (T - 16)) / n, (T - 16) / n - 2, (T - 16) / n - 2);
    }
  // routing channels between tiles
  g.strokeStyle = '#2f3656';
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(M + i * T, M);
    g.lineTo(M + i * T, S - M);
    g.moveTo(M, M + i * T);
    g.lineTo(S - M, M + i * T);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Marking on the package substrate and the cap tops. */
function markTexture(lines: [string, number][], w = 512, h = 128, bg = '#16191a', fg = '#e8e6df') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  let y = 0;
  for (const [s, px] of lines) {
    g.font = `600 ${px}px "JetBrains Mono", Menlo, monospace`;
    y += px * 1.15;
    g.fillText(s, 14, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type AiWorld = ReturnType<typeof createAiWorld>;

// lub-dub: two beats close together, then a rest (the landing's heart, the same shape)
const BEAT_GLSL = /* glsl */ `float beatAt(float ph) { return exp(-pow((ph - 0.05) / 0.06, 2.0)) + 0.65 * exp(-pow((ph - 0.3) / 0.07, 2.0)); }`;
const beatAt = (ph: number) => Math.exp(-Math.pow((ph - 0.05) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));

export function createAiWorld(renderer: THREE.WebGLRenderer, pixelRatio: number, mascot: Mascot | null) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040509');
  scene.fog = new THREE.FogExp2('#040509', 0.018);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 300);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const uTime = { value: 0 };
  const uFront = { value: 0 }; // how far along the nerves the build has come (path length)
  const uBuilt = { value: 0 };
  const uViewH = { value: innerHeight * pixelRatio };

  /* ================= the chip ================= */
  const chipRoot = new THREE.Group(); // floats, turns, then settles facing out of his chest
  scene.add(chipRoot);
  const chip = new THREE.Group(); // the package, in its own units, lying on its back
  chip.scale.setScalar(CHIP);
  chip.rotation.x = Math.PI / 2; // its top faces +z: out of his chest, towards us
  chipRoot.add(chip);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = chip) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // the stiffener frame and its screws
  const steel = new THREE.MeshPhysicalMaterial({ color: '#9ea3ab', metalness: 1, roughness: 0.42 });
  const FR = 3.35, FW = 0.42, FH = 0.16;
  add(new RoundedBoxGeometry(FR * 2 + FW, FH, FW, 2, 0.03), steel, 0, FH / 2, -FR);
  add(new RoundedBoxGeometry(FR * 2 + FW, FH, FW, 2, 0.03), steel, 0, FH / 2, FR);
  add(new RoundedBoxGeometry(FR * 2 - FW, FH, FW, 2, 0.03), steel, -FR, FH / 2, 0).rotation.y = Math.PI / 2;
  add(new RoundedBoxGeometry(FR * 2 - FW, FH, FW, 2, 0.03), steel, FR, FH / 2, 0).rotation.y = Math.PI / 2;
  const screw = new THREE.MeshPhysicalMaterial({ color: '#8d9198', metalness: 1, roughness: 0.45 });
  for (const [x, z] of [[-FR, -FR], [FR, -FR], [-FR, FR], [FR, FR]]) {
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24), screw, x, FH + 0.04, z);
    add(new THREE.BoxGeometry(0.2, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: '#111' }), x, FH + 0.085, z);
  }
  // the substrate: the frame's floor, the whole package's base, with the solder balls under it
  const subPlain = new THREE.MeshPhysicalMaterial({ color: '#1a201c', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  add(new RoundedBoxGeometry(7.2, 0.14, 7.2, 3, 0.04), subPlain, 0, 0.0, 0);
  add(new RoundedBoxGeometry(5.6, 0.1, 5.6, 3, 0.03), subPlain, 0, 0.1, 0);
  const subMat = new THREE.MeshPhysicalMaterial({
    map: markTexture([['DIZRUPT', 40], ['DZ-A1 · HEART · 2026', 26], ['MADE FOR WHAT’S NEXT', 20]], 512, 160, '#1a201c'),
    roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4,
  });
  const mark = add(new THREE.PlaneGeometry(1.6, 0.5), subMat, -1.75, 0.1505, 2.4);
  mark.rotation.x = -Math.PI / 2;
  {
    const ball = new THREE.MeshPhysicalMaterial({ color: '#c8cace', metalness: 1, roughness: 0.5 });
    const n = 26, pitch = 0.26;
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), ball, n * n);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) balls.setMatrixAt(k++, m4.makeTranslation((i - (n - 1) / 2) * pitch, -0.09, (j - (n - 1) / 2) * pitch));
    chip.add(balls);
  }
  // land-side caps round the interposer
  {
    const body = new THREE.MeshStandardMaterial({ color: '#b39a72', roughness: 0.6 });
    const ends = new THREE.MeshStandardMaterial({ color: '#d7d9dc', roughness: 0.45, metalness: 1 });
    const spots: [number, number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const f = -2.3 + (i / 25) * 4.6;
      spots.push([f, -2.55, 0], [f, 2.55, 0], [-2.55, f, 1], [2.55, f, 1]);
    }
    const bi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), body, spots.length);
    const ei = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.055, 0.055), ends, spots.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
    spots.forEach(([a, b, rot], i) => {
      q.setFromEuler(e.set(0, rot ? Math.PI / 2 : 0, 0));
      p.set(a, 0.175, b);
      bi.setMatrixAt(i, m4.compose(p, q, sc));
      const dx = rot ? 0 : 0.05, dz = rot ? 0.05 : 0;
      ei.setMatrixAt(i * 2, m4.compose(p.clone().add(new THREE.Vector3(dx, 0, dz)), q, sc));
      ei.setMatrixAt(i * 2 + 1, m4.compose(p.clone().add(new THREE.Vector3(-dx, 0, -dz)), q, sc));
    });
    chip.add(bi, ei);
  }
  // the interposer, the dies on it in their underfill
  add(new RoundedBoxGeometry(4.4, 0.06, 4.4, 2, 0.015), new THREE.MeshPhysicalMaterial({ color: '#3a3d46', metalness: 0.6, roughness: 0.35, clearcoat: 0.6 }), 0, 0.18, 0);
  const underfill = new THREE.MeshPhysicalMaterial({ color: '#2a2418', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const dieMat = new THREE.MeshPhysicalMaterial({
    map: dieTexture(), color: '#8c8ca0', metalness: 0.85, roughness: 0.22,
    iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 620],
    clearcoat: 1, clearcoatRoughness: 0.14, emissive: '#5a3cff', emissiveIntensity: 0,
  });
  add(new RoundedBoxGeometry(2.3, 0.05, 2.3, 2, 0.01), underfill, 0, 0.215, 0);
  add(new RoundedBoxGeometry(2.2, 0.1, 2.2, 2, 0.008), dieMat, 0, 0.26, 0);
  const hbmMat = new THREE.MeshPhysicalMaterial({
    color: '#23252c', metalness: 0.8, roughness: 0.18, iridescence: 0.6, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 500], clearcoat: 1, clearcoatRoughness: 0.16,
  });
  for (const sx of [-1, 1])
    for (const z of [-1.3, 0, 1.3]) {
      add(new RoundedBoxGeometry(0.72, 0.05, 1.12, 2, 0.01), underfill, sx * 1.72, 0.215, z);
      add(new RoundedBoxGeometry(0.66, 0.14, 1.06, 2, 0.008), hbmMat, sx * 1.72, 0.285, z);
    }
  // the mark on the die: his heart, lit from inside the silicon and beating
  const heartTex = new THREE.TextureLoader().load('/heart.png');
  heartTex.colorSpace = THREE.SRGBColorSpace;
  const heartMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color(0.95, 0.8, 1.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const heart = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), heartMat);
  heart.position.y = 0.312;
  heart.rotation.x = -Math.PI / 2;
  chip.add(heart);
  const heartGlowMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const heartGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), heartGlowMat);
  heartGlow.position.y = 0.318;
  heartGlow.rotation.x = -Math.PI / 2;
  chip.add(heartGlow);

  // the wires: traces routed out from round the mark, across the die and the package to the frame,
  // lit, with pulses running outward from the heart on every beat
  const wireTex = (() => {
    const S = 1024, SPAN = 6.6; // the texture covers the package inside the frame
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    const px = (u: number) => (u / SPAN + 0.5) * S;
    const rand = rng(33);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineCap = g.lineJoin = 'round';
    for (let side = 0; side < 4; side++) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const f = ((i + 0.5) / n - 0.5) * 1.5; // along the side, within the mark's reach
        const r0 = 0.72 + rand() * 0.08; // starts at the mark's edge
        const jog = (rand() - 0.5) * 0.9;
        const mid = 1.15 + rand() * 0.5;
        const r1 = 2.6 + rand() * 0.55; // ends short of the frame
        // local frame: out along +a, across along b
        const pts: [number, number][] = [[r0, f], [mid, f], [mid + Math.abs(jog), f + jog], [r1, f + jog]];
        const toXY = ([a, b]: [number, number]) => {
          const [x, y] = side === 0 ? [b, -a] : side === 1 ? [b, a] : side === 2 ? [-a, b] : [a, b];
          return [px(x), px(y)] as const;
        };
        g.lineWidth = i % 4 === 0 ? 4.5 : 2.6;
        g.beginPath();
        pts.forEach((pt, k) => {
          const [x, y] = toXY(pt);
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        });
        g.stroke();
        // a pad at each end
        for (const pt of [pts[0], pts[3]]) {
          const [x, y] = toXY(pt);
          g.beginPath();
          g.arc(x, y, 5, 0, 7);
          g.fill();
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  })();
  const wireMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uTime, tWire: { value: wireTex } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D tWire; varying vec2 vUv;
      ${BEAT_GLSL}
      void main(){
        float m = texture2D(tWire, vUv).r;
        if (m < 0.01) discard;
        vec2 q = vUv - 0.5;
        float d = length(q);
        float lane = floor((atan(q.y, q.x) + 3.14159) * 10.0);
        float h = fract(sin(lane * 12.9898) * 43758.5453);
        // a pulse leaves the heart on each beat and runs out to the frame
        float beat = beatAt(fract(uTime - d * 1.6));
        float run = pow(fract(d * 3.0 - uTime * (0.35 + h * 0.3) - h), 6.0);
        vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.7, 0.35, 1.0), step(0.55, h));
        gl_FragColor = vec4(c * m * (0.35 + beat * 1.4 + run * 1.2), m);
      }`,
  });
  const wires = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), wireMat);
  wires.position.y = 0.3125; // on the die with the mark; the HBM stacks stand over it
  wires.rotation.x = -Math.PI / 2;
  chip.add(wires);

  /* ================= him: the nerves and the particles ================= */
  let figure: THREE.Group | null = null;
  let maxL = 1;
  let center = new THREE.Vector3(0, -2.5, 0);
  let height = 9;
  if (mascot) {
    const full = mascot.full.array as Float32Array;
    // where his heart is in his own frame: the landing puts it here (engine.ts)
    const neutral = mascot.neutral.array as Float32Array;
    const hy = mascot.pivot.y - 1.85, hx = 1.0;
    let hz = 0;
    for (let i = 0; i < neutral.length; i += 3) if (Math.abs(neutral[i + 1] - hy) < 0.2 && Math.abs(neutral[i] - hx) < 0.2) hz = Math.max(hz, neutral[i + 2]);
    const H = new THREE.Vector3(hx, hy, hz - 0.15); // just inside his chest
    figure = new THREE.Group();
    figure.position.copy(H).negate();
    scene.add(figure);
    const count = full.length / 3;
    const box = new THREE.Box3().setFromBufferAttribute(mascot.full);
    box.getCenter(center).sub(H);
    height = box.max.y - box.min.y;

    // the nerves: a tree grown out from the heart through a sample of his points, each joining
    // the nearest one already reached, so the branches follow his body out to the fingertips
    const N = 2200;
    const nodes = new Float32Array((N + 1) * 3);
    nodes.set([H.x, H.y, H.z], 0);
    const rand = rng(21);
    for (let k = 1; k <= N; k++) {
      const i = Math.floor(rand() * count);
      nodes[k * 3] = full[i * 3];
      nodes[k * 3 + 1] = full[i * 3 + 1];
      nodes[k * 3 + 2] = full[i * 3 + 2];
    }
    const d0 = (k: number) => Math.hypot(nodes[k * 3] - H.x, nodes[k * 3 + 1] - H.y, nodes[k * 3 + 2] - H.z);
    const order = Array.from({ length: N }, (_, k) => k + 1).sort((a, b) => d0(a) - d0(b));
    const L = new Float32Array(N + 1);
    const parent = new Int32Array(N + 1).fill(-1);
    const reached = [0];
    for (const k of order) {
      let best = 0, bd = Infinity;
      const x = nodes[k * 3], y = nodes[k * 3 + 1], z = nodes[k * 3 + 2];
      for (const j of reached) {
        const dx = nodes[j * 3] - x, dy = nodes[j * 3 + 1] - y, dz = nodes[j * 3 + 2] - z;
        // a slight pull towards joining nearer the heart, so trunks form rather than a web
        const d = Math.hypot(dx, dy, dz) + L[j] * 0.04;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      parent[k] = best;
      L[k] = L[best] + Math.hypot(nodes[best * 3] - x, nodes[best * 3 + 1] - y, nodes[best * 3 + 2] - z);
      reached.push(k);
    }
    maxL = Math.max(...L);
    const lp: number[] = [], ll: number[] = [];
    for (let k = 1; k <= N; k++) {
      const j = parent[k];
      lp.push(nodes[j * 3], nodes[j * 3 + 1], nodes[j * 3 + 2], nodes[k * 3], nodes[k * 3 + 1], nodes[k * 3 + 2]);
      ll.push(L[j], L[k]);
    }
    const nerveGeo = new THREE.BufferGeometry();
    nerveGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    nerveGeo.setAttribute('aL', new THREE.Float32BufferAttribute(ll, 1));
    const nerves = new THREE.LineSegments(nerveGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uFront, uBuilt },
      vertexShader: /* glsl */ `attribute float aL; varying float vL; void main(){ vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uFront, uBuilt; varying float vL;
        ${BEAT_GLSL}
        void main(){
          if (vL > uFront) discard;
          // the build's leading edge burns bright; behind it the nerve settles to a faint glow
          float lead = exp(-(uFront - vL) * 3.0) * (1.0 - uBuilt);
          // every heartbeat sends a pulse out along the nerves
          float beat = beatAt(fract(uTime - vL / 5.0)) * uBuilt;
          vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.72, 0.4, 1.0), smoothstep(0.0, 6.0, vL));
          // every trunk starts at the heart: fade them there, or they pile up into one white blot
          float root = smoothstep(0.15, 1.6, vL);
          float a = (0.07 + lead * 0.9 + beat * 0.45) * root;
          gl_FragColor = vec4(c * (1.0 + lead * 1.2 + beat * 1.0), a);
        }`,
    }));
    figure.add(nerves);

    // each particle of him lights when its nerve gets there: the reach of its nearest node
    const cell = 0.45;
    const grid = new Map<string, number[]>();
    const keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let k = 0; k <= N; k++) {
      const kk = keyOf(nodes[k * 3], nodes[k * 3 + 1], nodes[k * 3 + 2]);
      (grid.get(kk) ?? grid.set(kk, []).get(kk)!).push(k);
    }
    const reach = new Float32Array(count);
    const seed = new Float32Array(count);
    const ratio = maxL / Math.max(...order.map(d0));
    for (let i = 0; i < count; i++) {
      const x = full[i * 3], y = full[i * 3 + 1], z = full[i * 3 + 2];
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = -1, bd = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const list = grid.get(`${cx + a},${cy + b},${cz + c}`);
        if (!list) continue;
        for (const k of list) {
          const d = Math.hypot(nodes[k * 3] - x, nodes[k * 3 + 1] - y, nodes[k * 3 + 2] - z);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
      }
      reach[i] = best >= 0 ? L[best] + bd : Math.hypot(x - H.x, y - H.y, z - H.z) * ratio;
      seed[i] = rand();
    }
    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.BufferAttribute(full, 3));
    bodyGeo.setAttribute('aReach', new THREE.BufferAttribute(reach, 1));
    bodyGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const body = new THREE.Points(bodyGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uFront, uBuilt, uViewH, uHeart: { value: H } },
      vertexShader: /* glsl */ `
        attribute float aReach, aSeed; uniform float uTime, uFront, uBuilt, uViewH; uniform vec3 uHeart;
        varying float vOn; varying float vFlash; varying float vSeed; varying float vBeat;
        ${BEAT_GLSL}
        void main(){
          float since = uFront - aReach;
          vOn = step(0.0, since);
          vFlash = exp(-max(since, 0.0) * 5.0) * vOn * (1.0 - uBuilt);
          vSeed = aSeed;
          vBeat = beatAt(fract(uTime - aReach / 5.0)) * uBuilt;
          // they pop into place: a little outward of where they land, settling as they arrive
          vec3 p = position + normalize(position - uHeart + 1e-4) * 0.25 * vFlash;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vOn * (0.028 + vFlash * 0.02) * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vOn; varying float vFlash; varying float vSeed; varying float vBeat;
        void main(){
          if (vOn < 0.5) discard;
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          // his own violets (the landing's), a cyan flash where the signal has just arrived
          vec3 base = mix(vec3(0.79, 0.72, 1.0), vec3(0.44, 0.3, 1.0), vSeed);
          vec3 c = mix(base, vec3(0.5, 0.95, 1.0), vFlash * 0.8) * (0.9 + vFlash * 0.5 + vBeat * 0.5);
          gl_FragColor = vec4(c, a * (0.75 + vFlash * 0.25));
        }`,
    }));
    figure.add(body);

    // a dark mirror floor under his feet, catching him and the heart
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshPhysicalMaterial({ color: '#07080d', roughness: 0.28, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = box.min.y - 0.02;
    floor.receiveShadow = true;
    figure.add(floor);
  }

  // dust in the light
  const dust = (() => {
    const n = 700, p: number[] = [];
    const r2 = rng(5);
    for (let i = 0; i < n; i++) p.push((r2() - 0.5) * 18, center.y + (r2() - 0.5) * height * 1.2, (r2() - 0.5) * 12);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#9aa6c8', size: 0.02, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  })();
  scene.add(dust);

  /* ================= light ================= */
  const key = new THREE.DirectionalLight('#fff4e8', 1.4);
  key.position.set(2.5, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rimC = new THREE.PointLight('#35d8ff', 3, 12, 1.6);
  rimC.position.set(-3, 1.5, -3.5); // behind: a rim, never a glint straight back at the camera
  const rimV = new THREE.PointLight('#a310e7', 4, 12, 1.6);
  rimV.position.set(3, -1, -3);
  scene.add(rimC, rimV);

  /* ================= its own buffers and bloom ================= */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // no single glint may outshine the heart: a pinpoint specular off a metal edge is thousands of
  // times brighter than anything else, and the bloom would smear it into a halo across the screen
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c.rgb * min(1.0, 3.0 / max(m, 1e-4)), c.a); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.12, 1.6);
  composer.addPass(bloom);

  /* ================= the camera: the chip close, pulling back as he's built round it ================= */
  const C = center;
  const far = height * 1.95;
  const keys = {
    pos: [
      new THREE.Vector3(0.7, 0.45, 5.2),
      new THREE.Vector3(1.6, 0.9, 8.0),
      new THREE.Vector3(C.x + 3.5, C.y + 2.2, far * 0.62),
      new THREE.Vector3(C.x + 0.5, C.y + 0.6, far),
      new THREE.Vector3(C.x - 4.5, C.y - 0.2, far * 0.95),
    ],
    look: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.3, -0.3, 0), new THREE.Vector3(C.x, C.y + 1.5, 0), new THREE.Vector3(C.x, C.y, 0), new THREE.Vector3(C.x, C.y + 0.4, 0)],
  };
  const posC = new THREE.CatmullRomCurve3(keys.pos, false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(keys.look, false, 'centripetal');
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
  let first = true;

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 52 : 32; // a phone needs the wider lens
    camera.updateProjectionMatrix();
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    uViewH.value = innerHeight * pixelRatio;
  };
  resize();

  const smooth = (a: number, b: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  let build = 0;

  return {
    scene,
    camera,
    resize,
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      const q = Math.min(1, Math.max(0, p));
      posC.getPointAt(q, tgtPos);
      lookC.getPointAt(q, tgtLook);
      const reach = tgtPos.length() * 0.06; // the cursor leans the view more the further out we are
      tgtPos.x += Math.sin(time * 0.15) * reach * 0.5 + px * (0.2 + reach);
      tgtPos.y += py * (0.1 + reach * 0.5);
      const k = first ? 1 : 1 - Math.exp(-3.2 * dt);
      first = false;
      pos.lerp(tgtPos, k);
      look.lerp(tgtLook, k);
      camera.position.copy(pos);
      camera.lookAt(look);

      // the build follows the scroll, eased so the signals travel rather than jump
      const want = smooth(0.1, 0.72, q);
      build += (want - build) * (1 - Math.exp(-2.5 * dt));
      uFront.value = build * maxL * 1.04;
      uBuilt.value = smooth(0.92, 1.0, build);

      // the chip floats, turning to show itself, until he's round it; then it's his heart, still
      const free = 1 - smooth(0.0, 0.35, build);
      // in his chest it's a compact heart, not the showpiece it was floating on its own
      chipRoot.scale.setScalar(1 - 0.58 * smooth(0.08, 0.5, build));
      chipRoot.position.set(0, Math.sin(time * 0.9) * 0.06 * free, 0);
      chipRoot.rotation.set(Math.sin(time * 0.5) * 0.35 * free - 0.25 * free, Math.sin(time * 0.37) * 0.5 * free + 0.35 * free, Math.sin(time * 0.29) * 0.08 * free);
      // it beats: the mark, its glow, and the light it throws
      const bt = beatAt(time % 1);
      heartMat.color.setRGB(0.95, 0.8, 1.15).multiplyScalar(1.0 + bt * 0.9);
      heartGlowMat.opacity = 0.15 + bt * 0.35;
      heartGlow.scale.setScalar(1 + bt * 0.12);
      dieMat.emissiveIntensity = 0.02 + bt * 0.06;
      dust.rotation.y = time * 0.01;

      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
  };
}
