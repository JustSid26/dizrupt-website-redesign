import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   An AI accelerator on its board, built to look like the real
   thing: a bare silicon die with its interference sheen, six HBM
   stacks round it on the interposer, the package on a stiffener
   frame, the VRMs and polymer caps that feed it, and a black
   board whose traces carry pulses of data away from the die. Over
   it, a neural net drawn in light.

   Units: the package is ~5 across; the board runs out of shot.
   ========================================================= */
const BOARD = 30;
const PX = 2048; // board texture size
const toPx = (u: number) => (u / BOARD + 0.5) * PX;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** The board: colour, roughness/metal, and the trace mask the data pulses run along. */
function boardTextures() {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = PX;
    return [c, c.getContext('2d')!] as const;
  };
  const [col, g] = mk();
  const [rm, r] = mk(); // g: roughness, b: metalness
  const [tr, t] = mk(); // traces, white on black
  const rand = rng(7);
  g.fillStyle = '#0a0c0f';
  g.fillRect(0, 0, PX, PX);
  r.fillStyle = 'rgb(0,150,0)';
  r.fillRect(0, 0, PX, PX);
  t.fillStyle = '#000';
  t.fillRect(0, 0, PX, PX);
  // a faint cross-hatched ground pour under the mask
  g.strokeStyle = 'rgba(40,48,56,0.25)';
  g.lineWidth = 1;
  for (let i = -PX; i < PX; i += 9) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + PX, PX);
    g.stroke();
  }

  // traces: out from each side of the package, a jog at 45°, then on to a via
  const lane = (x0: number, y0: number, dx: number, dy: number, sx: number, sy: number, len: number, jog: number, len2: number, w: number) => {
    const pts: [number, number][] = [[x0, y0]];
    let x = x0 + dx * len, y = y0 + dy * len;
    pts.push([x, y]);
    x += (dx + sx) * jog;
    y += (dy + sy) * jog;
    pts.push([x, y]);
    x += dx * len2;
    y += dy * len2;
    pts.push([x, y]);
    const path = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    };
    g.strokeStyle = '#161b21';
    g.lineWidth = w;
    g.lineCap = g.lineJoin = 'round';
    path(g);
    t.strokeStyle = '#fff';
    t.lineWidth = w;
    t.lineCap = t.lineJoin = 'round';
    path(t);
    r.strokeStyle = 'rgb(0,95,0)';
    r.lineWidth = w;
    path(r);
    // the via at its end: a gold ring through the mask
    const [ex, ey] = pts[3];
    g.fillStyle = '#c9a44f';
    g.beginPath();
    g.arc(ex, ey, w * 1.6, 0, 7);
    g.fill();
    g.fillStyle = '#050607';
    g.beginPath();
    g.arc(ex, ey, w * 0.7, 0, 7);
    g.fill();
    r.fillStyle = 'rgb(0,70,255)';
    r.beginPath();
    r.arc(ex, ey, w * 1.6, 0, 7);
    r.fill();
    t.fillStyle = '#fff';
    t.beginPath();
    t.arc(ex, ey, w * 1.6, 0, 7);
    t.fill();
  };
  const half = toPx(3.4) - PX / 2;
  const C = PX / 2;
  for (let side = 0; side < 4; side++) {
    const n = 46;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n - 0.5;
      const along = f * half * 1.9;
      const w = 2.2 + (i % 5 === 0 ? 2 : 0);
      const len = 40 + rand() * 90;
      const jogDir = f < 0 ? -1 : 1;
      const jog = 20 + rand() * 60;
      const len2 = 120 + rand() * 520;
      if (side === 0) lane(C + along, C - half, 0, -1, jogDir, 0, len, jog, len2, w);
      if (side === 1) lane(C + along, C + half, 0, 1, jogDir, 0, len, jog, len2, w);
      if (side === 2) lane(C - half, C + along, -1, 0, 0, jogDir, len, jog, len2, w);
      if (side === 3) lane(C + half, C + along, 1, 0, 0, jogDir, len, jog, len2, w);
    }
  }
  // gold pad fields for the components (under the caps and inductors)
  const pad = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = '#c9a44f';
    g.fillRect(x - w / 2, y - h / 2, w, h);
    r.fillStyle = 'rgb(0,70,255)';
    r.fillRect(x - w / 2, y - h / 2, w, h);
  };
  // silkscreen: outlines, reference designators, the board's name
  g.fillStyle = '#d8d8d4';
  g.strokeStyle = '#d8d8d4';
  g.lineWidth = 2;
  g.font = '600 15px "JetBrains Mono", Menlo, monospace';
  for (let i = 0; i < 90; i++) {
    const x = rand() * PX, y = rand() * PX;
    if (Math.abs(x - C) < 560 && Math.abs(y - C) < 560) continue;
    g.fillText(`${['C', 'R', 'L', 'U', 'Q'][(rand() * 5) | 0]}${(rand() * 900 + 10) | 0}`, x, y);
    if (rand() < 0.4) {
      g.strokeRect(x - 4, y - 30, 38, 20);
      pad(x + 1, y - 20, 7, 12);
      pad(x + 27, y - 20, 7, 12);
    }
  }
  g.font = '700 30px "JetBrains Mono", Menlo, monospace';
  g.fillText('DIZRUPT  DZ-A1  NEURAL ACCELERATOR', C - 330, C + 560);
  g.font = '500 20px "JetBrains Mono", Menlo, monospace';
  g.fillText('REV 4.2  ·  MUMBAI  ·  ASSEMBLED FOR WHAT’S NEXT', C - 280, C + 596);
  // mounting holes, plated
  for (const [x, y] of [[C - 700, C - 700], [C + 700, C - 700], [C - 700, C + 700], [C + 700, C + 700]]) {
    g.fillStyle = '#c9a44f';
    g.beginPath();
    g.arc(x, y, 26, 0, 7);
    g.fill();
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(x, y, 16, 0, 7);
    g.fill();
    r.fillStyle = 'rgb(0,60,255)';
    r.beginPath();
    r.arc(x, y, 26, 0, 7);
    r.fill();
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const x = new THREE.CanvasTexture(c);
    if (srgb) x.colorSpace = THREE.SRGBColorSpace;
    x.anisotropy = 8;
    return x;
  };
  return { map: tex(col, true), rm: tex(rm, false), traces: tex(tr, false) };
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

export function createAiWorld(renderer: THREE.WebGLRenderer, pixelRatio: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040509');
  scene.fog = new THREE.FogExp2('#040509', 0.02);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 200);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const uTime = { value: 0 };
  const uPulse = { value: 1 };
  const uThink = { value: 0 };

  /* ---- the board ---- */
  const bt = boardTextures();
  const boardMat = new THREE.MeshPhysicalMaterial({
    map: bt.map, roughnessMap: bt.rm, metalnessMap: bt.rm, roughness: 1, metalness: 1,
    bumpMap: bt.traces, bumpScale: 0.6,
    clearcoat: 0.55, clearcoatRoughness: 0.32,
    emissive: '#ffffff', emissiveMap: bt.traces, emissiveIntensity: 1,
  });
  boardMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uPulse = uPulse;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uPulse;')
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        {
          // data leaves the die in pulses, each lane at its own pace, cyan or brand violet
          float m = texture2D(emissiveMap, vEmissiveMapUv).r;
          vec2 q = vEmissiveMapUv - 0.5;
          float d = length(q);
          float lane = floor((atan(q.y, q.x) + 3.14159) * 30.0);
          float h = fract(sin(lane * 12.9898) * 43758.5453);
          float ph = fract(d * 5.0 - uTime * (0.18 + h * 0.3) - h * 7.0);
          float pulse = smoothstep(0.0, 0.015, ph) * (1.0 - smoothstep(0.015, 0.09, ph));
          vec3 c = mix(vec3(0.25, 0.85, 1.0), vec3(0.64, 0.12, 1.0), step(0.62, h));
          totalEmissiveRadiance = c * m * (0.035 + pulse * 5.0 * uPulse) * smoothstep(0.42, 0.12, d);
        }`,
      );
  };
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD, 0.16, BOARD), boardMat);
  board.position.y = -0.08;
  board.receiveShadow = true;
  scene.add(board);

  const chip = new THREE.Group();
  scene.add(chip);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = chip) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* ---- the stiffener frame: brushed steel ---- */
  const steel = new THREE.MeshPhysicalMaterial({ color: '#9ea3ab', metalness: 1, roughness: 0.36, anisotropy: 0.8, anisotropyRotation: 0 });
  const FR = 3.35, FW = 0.42, FH = 0.16;
  add(new RoundedBoxGeometry(FR * 2 + FW, FH, FW, 2, 0.03), steel, 0, FH / 2, -FR);
  add(new RoundedBoxGeometry(FR * 2 + FW, FH, FW, 2, 0.03), steel, 0, FH / 2, FR);
  const side = add(new RoundedBoxGeometry(FR * 2 - FW, FH, FW, 2, 0.03), steel, -FR, FH / 2, 0);
  side.rotation.y = Math.PI / 2;
  const side2 = add(new RoundedBoxGeometry(FR * 2 - FW, FH, FW, 2, 0.03), steel, FR, FH / 2, 0);
  side2.rotation.y = Math.PI / 2;
  // its screws
  const screw = new THREE.MeshPhysicalMaterial({ color: '#8d9198', metalness: 1, roughness: 0.25 });
  for (const [x, z] of [[-FR, -FR], [FR, -FR], [-FR, FR], [FR, FR]]) {
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24), screw, x, FH + 0.04, z);
    add(new THREE.BoxGeometry(0.2, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: '#111' }), x, FH + 0.085, z);
  }

  /* ---- the package: organic substrate, marked; the interposer on it ---- */
  const subMat = new THREE.MeshPhysicalMaterial({
    map: markTexture([['DIZRUPT', 40], ['DZ-A1 · 4NM · 2026', 26], ['MADE FOR WHAT’S NEXT', 20]], 512, 160, '#1a201c'),
    roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4,
  });
  const subPlain = new THREE.MeshPhysicalMaterial({ color: '#1a201c', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  add(new RoundedBoxGeometry(5.6, 0.14, 5.6, 3, 0.03), subPlain, 0, 0.07, 0);
  // the marking, in the corner by the frame
  const mark = add(new THREE.PlaneGeometry(1.6, 0.5), subMat, -1.75, 0.1405, 2.4);
  mark.rotation.x = -Math.PI / 2;
  // land-side caps in rows round the interposer: tiny ceramic chips with metal ends
  {
    const body = new THREE.MeshStandardMaterial({ color: '#b39a72', roughness: 0.6 });
    const ends = new THREE.MeshStandardMaterial({ color: '#d7d9dc', roughness: 0.25, metalness: 1 });
    const bodyG = new THREE.BoxGeometry(0.1, 0.05, 0.05);
    const endG = new THREE.BoxGeometry(0.03, 0.055, 0.055);
    const spots: [number, number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const f = -2.3 + (i / 25) * 4.6;
      spots.push([f, -2.55, 0], [f, 2.55, 0], [-2.55, f, 1], [2.55, f, 1]);
    }
    const bi = new THREE.InstancedMesh(bodyG, body, spots.length);
    const ei = new THREE.InstancedMesh(endG, ends, spots.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    spots.forEach(([a, b, rot], i) => {
      e.set(0, rot ? Math.PI / 2 : 0, 0);
      q.setFromEuler(e);
      p.set(a, 0.165, b);
      bi.setMatrixAt(i, m4.compose(p, q, sc));
      const dx = rot ? 0 : 0.05, dz = rot ? 0.05 : 0;
      ei.setMatrixAt(i * 2, m4.compose(p.clone().add(new THREE.Vector3(dx, 0, dz)), q, sc));
      ei.setMatrixAt(i * 2 + 1, m4.compose(p.clone().add(new THREE.Vector3(-dx, 0, -dz)), q, sc));
    });
    bi.castShadow = ei.castShadow = true;
    chip.add(bi, ei);
  }
  const interposer = new THREE.MeshPhysicalMaterial({ color: '#3a3d46', metalness: 0.6, roughness: 0.35, clearcoat: 0.6 });
  add(new RoundedBoxGeometry(4.4, 0.06, 4.4, 2, 0.015), interposer, 0, 0.17, 0);
  // underfill: the resin that wicks out round each die
  const underfill = new THREE.MeshPhysicalMaterial({ color: '#2a2418', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });

  /* ---- the dies: silicon, mirror-dark with its interference colours ---- */
  const dieMat = new THREE.MeshPhysicalMaterial({
    map: dieTexture(), color: '#ffffff', metalness: 0.85, roughness: 0.14,
    iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 620],
    clearcoat: 1, clearcoatRoughness: 0.05,
    emissive: '#5a3cff', emissiveIntensity: 0,
  });
  add(new RoundedBoxGeometry(2.3, 0.05, 2.3, 2, 0.01), underfill, 0, 0.205, 0);
  const die = add(new RoundedBoxGeometry(2.2, 0.1, 2.2, 2, 0.008), dieMat, 0, 0.25, 0);
  const hbmMat = new THREE.MeshPhysicalMaterial({
    color: '#23252c', metalness: 0.8, roughness: 0.18, iridescence: 0.6, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 500],
    clearcoat: 1, clearcoatRoughness: 0.08,
  });
  for (const sx of [-1, 1])
    for (const z of [-1.3, 0, 1.3]) {
      add(new RoundedBoxGeometry(0.72, 0.05, 1.12, 2, 0.01), underfill, sx * 1.72, 0.205, z);
      add(new RoundedBoxGeometry(0.66, 0.14, 1.06, 2, 0.008), hbmMat, sx * 1.72, 0.275, z);
    }

  /* ---- power: VRM inductors either side, polymer caps above and below, MOSFETs ---- */
  {
    const ind = new THREE.MeshPhysicalMaterial({ color: '#2b2c30', roughness: 0.55, metalness: 0.3, clearcoat: 0.2 });
    const indTop = new THREE.MeshPhysicalMaterial({ map: markTexture([['R22', 60]], 128, 96, '#2b2c30', '#bfbfbf'), roughness: 0.55, metalness: 0.3 });
    const fet = new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.4, clearcoat: 0.4 });
    for (const sx of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const z = -3.1 + i * 0.88;
        const x = sx * 4.55;
        add(new RoundedBoxGeometry(0.62, 0.46, 0.62, 3, 0.06), ind, x, 0.23, z);
        const top = add(new THREE.PlaneGeometry(0.46, 0.34), indTop, x, 0.461, z);
        top.rotation.x = -Math.PI / 2;
        add(new RoundedBoxGeometry(0.42, 0.09, 0.36, 2, 0.02), fet, sx * 5.35, 0.045, z);
      }
    // polymer caps: aluminium cans with the vent cross stamped in the top
    const can = new THREE.MeshPhysicalMaterial({ color: '#c3c6cc', metalness: 1, roughness: 0.28, anisotropy: 0.5 });
    const capTop = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = '#c3c6cc';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#8b8f96';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(64, 20);
      g.lineTo(64, 108);
      g.moveTo(20, 64);
      g.lineTo(108, 64);
      g.stroke();
      g.fillStyle = '#6d2bd9';
      g.fillRect(0, 0, 128, 16); // the polarity band's edge
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshPhysicalMaterial({ map: t, metalness: 1, roughness: 0.3 });
    })();
    const sleeve = new THREE.MeshPhysicalMaterial({ color: '#241a3a', roughness: 0.45, clearcoat: 0.6 });
    for (const sz of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const x = -3.6 + i * 0.9;
        const z = sz * 4.4;
        add(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 40), sleeve, x, 0.25, z);
        add(new THREE.CylinderGeometry(0.262, 0.262, 0.12, 40), can, x, 0.46, z);
        add(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 40), capTop, x, 0.525, z);
      }
  }

  /* ---- the neural net over it, drawn in light ---- */
  const holo = new THREE.Group();
  holo.position.y = 3.2;
  scene.add(holo);
  const layers = [12, 20, 26, 20, 8];
  const nodes: THREE.Vector3[][] = layers.map((n, li) => {
    const y = (li - (layers.length - 1) / 2) * 0.7;
    const r = 0.9 + Math.sin((li / (layers.length - 1)) * Math.PI) * 1.8;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + li * 0.4;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
  });
  const edgeA: number[] = [], edgeB: number[] = [];
  const rand = rng(11);
  const lines: number[] = [];
  for (let li = 0; li < nodes.length - 1; li++)
    for (const a of nodes[li])
      for (const b of nodes[li + 1])
        if (rand() < 0.28) {
          lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
          edgeA.push(a.x, a.y, a.z);
          edgeB.push(b.x, b.y, b.z);
        }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const holoLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#5fd8ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  holo.add(holoLines);
  const glowPoints = (positions: number[], size: number, color: string) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: size * pixelRatio }, uColor: { value: new THREE.Color(color) }, uAmt: { value: 1 } },
      vertexShader: /* glsl */ `uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize / -mv.z; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAmt; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a*a; gl_FragColor = vec4(uColor * (1.0 + 3.0 * smoothstep(0.18, 0.0, d)), a * uAmt); }`,
    });
    return new THREE.Points(geo, mat);
  };
  const nodePts = glowPoints(nodes.flat().flatMap((v) => [v.x, v.y, v.z]), 34, '#8fe6ff');
  holo.add(nodePts);
  // signals running along the edges: one spark per edge, each on its own clock
  const nE = edgeA.length / 3;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nE * 3), 3));
  sparkGeo.setAttribute('aA', new THREE.Float32BufferAttribute(edgeA, 3));
  sparkGeo.setAttribute('aB', new THREE.Float32BufferAttribute(edgeB, 3));
  sparkGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Array.from({ length: nE }, () => rand()), 1));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uSize: { value: 26 * pixelRatio }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aA; attribute vec3 aB; attribute float aSeed;
      uniform float uTime, uSize; varying float vA; varying float vV;
      void main(){
        float t = fract(uTime * (0.35 + aSeed * 0.5) + aSeed * 9.0);
        vec3 p = mix(aA, aB, t);
        vA = sin(t * 3.14159); vV = step(0.5, fract(aSeed * 7.3));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAmt; varying float vA; varying float vV;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(vec3(0.35, 0.9, 1.0), vec3(0.75, 0.3, 1.0), vV);
        gl_FragColor = vec4(c * 3.0, a * a * vA * uAmt); }`,
  });
  holo.add(new THREE.Points(sparkGeo, sparkMat));
  // the beam from the die up into it
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime, uAmt; varying vec2 vUv;
      void main(){ float a = (1.0 - vUv.y) * 0.22 * (0.8 + 0.2 * sin(vUv.y * 40.0 - uTime * 6.0));
        a *= smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(vec3(0.45, 0.7, 1.0) * a * uAmt, a * uAmt); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 3.2, 48, 1, true), beamMat);
  beam.position.y = 1.7;
  scene.add(beam);

  // dust in the light
  const dust = (() => {
    const n = 500, p: number[] = [];
    const r2 = rng(5);
    for (let i = 0; i < n; i++) p.push((r2() - 0.5) * 16, r2() * 7, (r2() - 0.5) * 16);
    const pts = glowPoints(p, 6, '#9aa6c8');
    (pts.material as THREE.ShaderMaterial).uniforms.uAmt.value = 0.35;
    return pts;
  })();
  scene.add(dust);

  /* ---- light ---- */
  const key = new THREE.DirectionalLight('#fff4e8', 1.25);
  key.position.set(5, 11, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -8;
  key.shadow.camera.right = key.shadow.camera.top = 8;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rimC = new THREE.PointLight('#35d8ff', 22, 30, 1.6);
  rimC.position.set(-7, 3, -5);
  const rimV = new THREE.PointLight('#a310e7', 26, 30, 1.6);
  rimV.position.set(6.5, 2.5, 4.5);
  const dieGlow = new THREE.PointLight('#6ad7ff', 0.6, 5, 2);
  dieGlow.position.set(0, 0.9, 0);
  scene.add(rimC, rimV, dieGlow);

  /* ---- its own buffers and bloom (threshold high: only the light in it blooms, not the metal) ---- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 1.8);
  composer.addPass(bloom);

  /* ---- the camera's chapters: arrival, the die close up, across the board, above the net, back ---- */
  const keys = {
    pos: [new THREE.Vector3(0, 7.5, 12), new THREE.Vector3(2.6, 1.5, 3.4), new THREE.Vector3(-7.5, 1.1, 3.8), new THREE.Vector3(0.6, 10.5, 3.2), new THREE.Vector3(0, 4.2, 12.5)],
    look: [new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0.2, 0.2, 0.1), new THREE.Vector3(0, 0.5, -0.4), new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 1.7, 0)],
  };
  const posC = new THREE.CatmullRomCurve3(keys.pos, false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(keys.look, false, 'centripetal');
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
  let first = true;

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 52 : 32; // a phone needs the wider lens to keep the chip in shot
    camera.updateProjectionMatrix();
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
  };
  resize();

  const smooth = (a: number, b: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  return {
    scene,
    camera,
    resize,
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      posC.getPointAt(Math.min(1, Math.max(0, p)), tgtPos);
      lookC.getPointAt(Math.min(1, Math.max(0, p)), tgtLook);
      // a slow drift, and the cursor leans the view
      tgtPos.x += Math.sin(time * 0.15) * 0.25 + px * 0.6;
      tgtPos.y += py * 0.35;
      const k = first ? 1 : 1 - Math.exp(-3.2 * dt);
      first = false;
      pos.lerp(tgtPos, k);
      look.lerp(tgtLook, k);
      camera.position.copy(pos);
      camera.lookAt(look);
      // the net comes up once we're over the board, strongest seen from above
      const net = 0.35 + 0.65 * smooth(0.45, 0.7, p);
      (nodePts.material as THREE.ShaderMaterial).uniforms.uAmt.value = net;
      sparkMat.uniforms.uAmt.value = net;
      (holoLines.material as THREE.LineBasicMaterial).opacity = 0.05 + 0.12 * net;
      beamMat.uniforms.uAmt.value = net;
      holo.rotation.y = time * 0.08;
      // the die thinks: its cores light in waves
      const think = 0.5 + 0.5 * Math.sin(time * 1.3);
      uThink.value = think;
      dieMat.emissiveIntensity = 0.03 + think * 0.05;
      dieGlow.intensity = 0.4 + think * 0.6;
      dust.rotation.y = time * 0.01;
      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
    die,
  };
}
