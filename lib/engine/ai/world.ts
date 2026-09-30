import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TECH_PROJECTS } from '@/content/techProjects';
import { signals } from '@/lib/signals';

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   Out of the hand-over comes a microcontroller, floating on its
   own in the dark: a black LQFP package, gull-wing leads down
   every side, laser marking on the epoxy and the Dizrupt mark
   glowing in it, beating. Then the scroll wires it into the
   work: from its pins a neural network runs out to each project,
   layer by layer, and each project's screen is built by it —
   neurons firing in, linking up, and merging into the picture. The camera visits them in
   turn; a screen can be opened to play its film.

   World frame: the chip at the origin, its face towards +z.
   ========================================================= */

/** Where the scroll (0..1 through the section) holds: the chip, the whole board, each project. */
export const AI_STOPS = [0, 0.17, 0.36, 0.54, 0.72, 0.9];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// lub-dub: two beats close together, then a rest (the landing's heart, the same shape)
const beatAt = (ph: number) => Math.exp(-Math.pow((ph - 0.05) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));

/** The package's top: black epoxy, laser marking, the pin-1 dimple and the mould's ejector marks. */
function packageTop() {
  const S = 1024;
  const col = document.createElement('canvas');
  col.width = col.height = S;
  const g = col.getContext('2d')!;
  const rgh = document.createElement('canvas');
  rgh.width = rgh.height = S;
  const r = rgh.getContext('2d')!;
  g.fillStyle = '#141416';
  g.fillRect(0, 0, S, S);
  r.fillStyle = 'rgb(0,190,0)'; // matte epoxy
  r.fillRect(0, 0, S, S);
  // the laser marking: lighter and rougher than the epoxy round it
  g.fillStyle = '#6b6c70';
  r.fillStyle = 'rgb(0,235,0)';
  const text = (s: string, px: number, x: number, y: number) => {
    for (const ctx of [g, r]) {
      ctx.font = `600 ${px}px "JetBrains Mono", Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(s, x, y);
    }
  };
  text('DIZRUPT', 70, S / 2, S * 0.74);
  text('DZ-M1 · 32-BIT MCU', 38, S / 2, S * 0.81);
  text('2026 · MUMBAI · 4K9X', 30, S / 2, S * 0.87);
  // pin 1: a moulded dimple, glossier than the rest; the two ejector-pin marks, glossy too
  r.fillStyle = 'rgb(0,90,0)';
  g.fillStyle = '#0d0d0f';
  for (const [x, y, rad] of [[S * 0.12, S * 0.12, 26], [S * 0.2, S * 0.9, 40], [S * 0.8, S * 0.9, 40]] as const) {
    g.beginPath();
    g.arc(x, y, rad, 0, 7);
    g.fill();
    r.beginPath();
    r.arc(x, y, rad, 0, 7);
    r.fill();
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rgh);
  return { map, rough };
}

/** A project's screen: a system console — title bar, the project in big mono type, a node graph of
    the system, a pane of code, an oscilloscope trace and a hex dump, all in corner brackets. */
function screenTexture(name: string, about: string, flow: string[], k: number) {
  const W = 1280, H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rand = rng(17 + k * 31);
  const mono = (px: number, w = 500) => `${w} ${px}px "JetBrains Mono", Menlo, monospace`;
  g.fillStyle = '#02060c';
  g.fillRect(0, 0, W, H);
  // fine grid
  g.strokeStyle = 'rgba(60,240,255,0.05)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x < W; x += 24) {
    g.moveTo(x, 0);
    g.lineTo(x, H);
  }
  for (let y = 0; y < H; y += 24) {
    g.moveTo(0, y);
    g.lineTo(W, y);
  }
  g.stroke();
  // title bar
  g.fillStyle = 'rgba(60,240,255,0.08)';
  g.fillRect(0, 0, W, 44);
  g.fillStyle = 'rgba(60,240,255,0.35)';
  g.fillRect(0, 44, W, 1);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(26 + i * 20, 22, 6, 0, 7);
    g.fill();
  });
  g.font = mono(16);
  g.fillStyle = 'rgba(189,246,255,0.75)';
  g.fillText(`node_${String(k + 1).padStart(2, '0')}.sys — ${about.toLowerCase()}`, 96, 28);
  g.textAlign = 'right';
  g.fillStyle = '#3cf0ff';
  g.fillText('● LINK ACTIVE', W - 24, 28);
  g.textAlign = 'left';
  // the name
  g.fillStyle = '#eafcff';
  g.font = mono(78, 600);
  g.fillText(name.toUpperCase(), 40, 136);
  g.fillStyle = '#a58bff';
  g.font = mono(20);
  g.fillText(`[${String(k + 1).padStart(2, '0')}] ${about.toUpperCase()}  //  OPEN ↗`, 42, 172);
  // node graph: the system's four steps, wired left to right
  const gx = 40, gy = 212, gw = 560, gh = 250;
  g.strokeStyle = 'rgba(60,240,255,0.25)';
  g.strokeRect(gx, gy, gw, gh);
  g.font = mono(13);
  g.fillStyle = 'rgba(189,246,255,0.5)';
  g.fillText('SYSTEM MAP', gx + 12, gy + 22);
  const pts = flow.map((_, i) => [gx + 70 + i * ((gw - 140) / (flow.length - 1)), gy + 140 + (i % 2 ? -40 : 30)] as const);
  g.strokeStyle = 'rgba(60,240,255,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  pts.forEach(([x, y], i) => {
    g.fillStyle = '#02060c';
    g.strokeStyle = i % 2 ? '#a58bff' : '#3cf0ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 16, 0, 7);
    g.fill();
    g.stroke();
    g.fillStyle = i % 2 ? '#a58bff' : '#3cf0ff';
    g.beginPath();
    g.arc(x, y, 5, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(234,252,255,0.85)';
    g.font = mono(14);
    g.textAlign = 'center';
    g.fillText(flow[i].toUpperCase(), x, y + (i % 2 ? -28 : 40));
    g.textAlign = 'left';
  });
  // code pane
  const cx = 630, cy = 212, cw = 610;
  g.strokeStyle = 'rgba(60,240,255,0.25)';
  g.strokeRect(cx, cy, cw, gh);
  const code: [string, string][][] = [
    [['const ', '#a58bff'], ['pipeline', '#eafcff'], [' = ', '#7a8aa0'], ['connect', '#3cf0ff'], ['({', '#7a8aa0']],
    [['  in: ', '#7a8aa0'], [`"${flow[0].toLowerCase()}"`, '#ffd28a'], [',', '#7a8aa0']],
    [['  brain: ', '#7a8aa0'], [`"${flow[1].toLowerCase()}"`, '#ffd28a'], [',', '#7a8aa0']],
    [['  hands: ', '#7a8aa0'], [`["${flow[2].toLowerCase()}"]`, '#ffd28a'], [',', '#7a8aa0']],
    [['  out: ', '#7a8aa0'], [`"${flow[3].toLowerCase()}"`, '#ffd28a'], [',', '#7a8aa0']],
    [['});', '#7a8aa0']],
    [['await ', '#a58bff'], ['pipeline', '#eafcff'], ['.', '#7a8aa0'], ['run', '#3cf0ff'], ['({ every: ', '#7a8aa0'], ['"event"', '#ffd28a'], [' });', '#7a8aa0']],
  ];
  g.font = mono(17);
  code.forEach((line, i) => {
    let x = cx + 50;
    g.fillStyle = 'rgba(122,138,160,0.5)';
    g.fillText(String(i + 1).padStart(2, ' '), cx + 14, cy + 36 + i * 29);
    for (const [t, col] of line) {
      g.fillStyle = col;
      g.fillText(t, x, cy + 36 + i * 29);
      x += g.measureText(t).width;
    }
  });
  // oscilloscope
  const oy = 490, oh = 110;
  g.strokeStyle = 'rgba(60,240,255,0.25)';
  g.strokeRect(40, oy, 820, oh);
  g.strokeStyle = '#3cf0ff';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= 800; x += 4) {
    const y = oy + oh / 2 + Math.sin(x * 0.045 + k) * 22 * Math.sin(x * 0.006 + k * 2) + (rand() - 0.5) * 8;
    if (x) g.lineTo(50 + x, y);
    else g.moveTo(50 + x, y);
  }
  g.stroke();
  // hex dump
  g.strokeStyle = 'rgba(60,240,255,0.25)';
  g.strokeRect(880, oy, 360, oh);
  g.font = mono(14);
  for (let r = 0; r < 5; r++) {
    g.fillStyle = 'rgba(165,139,255,0.7)';
    g.fillText((0x4a0 + r * 16 + k * 256).toString(16).padStart(4, '0'), 894, oy + 24 + r * 19);
    g.fillStyle = 'rgba(189,246,255,0.6)';
    g.fillText(Array.from({ length: 6 }, () => ((rand() * 256) | 0).toString(16).padStart(2, '0')).join(' '), 950, oy + 24 + r * 19);
  }
  // footer: status line and the way in
  g.fillStyle = 'rgba(189,246,255,0.55)';
  g.font = mono(14);
  g.fillText(`> node_${String(k + 1).padStart(2, '0')} ready · 16/16 lanes · awaiting input_`, 42, 660);
  g.fillStyle = '#3cf0ff';
  g.fillRect(W - 250, 628, 210, 48);
  g.fillStyle = '#021016';
  g.font = mono(18, 700);
  g.fillText('OPEN PROJECT →', W - 232, 659);
  // corner brackets
  g.strokeStyle = '#3cf0ff';
  g.lineWidth = 4;
  for (const [x, y, dx, dy] of [[8, 52, 1, 1], [W - 8, 52, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]] as const) {
    g.beginPath();
    g.moveTo(x, y + dy * 28);
    g.lineTo(x, y);
    g.lineTo(x + dx * 28, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The plate under a screen: its node number and kind. */
function plateTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '500 30px "JetBrains Mono", Menlo, monospace';
  g.fillStyle = '#7cf2ff';
  g.fillText(text, 4, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A thought cloud: an irregular outline of neurons, linked round its edge, and its words inside. */
function cloudTexture(label: string, body: string, seed: number) {
  const W = 1024, H = 460;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const rand = rng(seed);
  // the outline: a loop of neurons, pushed in and out so it reads as grown, not drawn
  const n = 46, cx = W / 2, cy = H / 2, rx = W / 2 - 34, ry = H / 2 - 30;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * 0.07 + Math.sin(a * 5 + seed) * 0.03;
    // a rounded rectangle, not an ellipse: it has to hold lines of text
    const sx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35);
    const sy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.35);
    return [cx + sx * rx * k, cy + sy * ry * k] as const;
  });
  // a faint fill, the links round the edge and a few across it, then the neurons
  g.fillStyle = 'rgba(20,60,90,0.35)';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(80,220,255,0.55)';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();
  g.strokeStyle = 'rgba(165,139,255,0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < n; i += 3) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 5 + ((rand() * 4) | 0)) % n];
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35);
    g.stroke();
  }
  pts.forEach(([x, y], i) => {
    g.fillStyle = i % 4 ? 'rgba(120,235,255,0.9)' : 'rgba(200,170,255,1)';
    g.beginPath();
    g.arc(x, y, i % 4 ? 3.5 : 6, 0, 7);
    g.fill();
  });
  // the words
  g.fillStyle = '#a58bff';
  g.font = '600 26px "JetBrains Mono", Menlo, monospace';
  g.fillText(label.toUpperCase(), 92, 110);
  g.fillStyle = '#eafcff';
  g.font = '500 38px "Inter Tight", system-ui, sans-serif';
  const words = body.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > W - 190 && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((l, i) => g.fillText(i === 4 && lines.length > 5 ? `${l}…` : l, 92, 172 + i * 50));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export type AiWorld = ReturnType<typeof createAiWorld>;

export function createAiWorld(renderer: THREE.WebGLRenderer, pixelRatio: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040509');
  scene.fog = new THREE.FogExp2('#040509', 0.022);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 300);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const uTime = { value: 0 };

  /* ================= the microcontroller ================= */
  const BODY = 2.4, H = 0.28, N_PIN = 16, PITCH = BODY / (N_PIN + 1);
  const chipRoot = new THREE.Group(); // floats and turns until it's wired in, then holds still
  scene.add(chipRoot);
  const chip = new THREE.Group(); // lying on its back in its own frame: face up (+y)
  chip.rotation.x = Math.PI / 2; // … which turns its face to +z, towards us (local z becomes world −y)
  chipRoot.add(chip);

  const top = packageTop();
  const epoxy = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: top.map, roughnessMap: top.rough, roughness: 1, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6 });
  const epoxySide = new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.72, clearcoat: 0.1, clearcoatRoughness: 0.6 });
  // the body: a moulded block with the radius a real package has; its top face carries the marking
  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY, H, BODY, 3, 0.03), epoxySide);
  body.castShadow = body.receiveShadow = true;
  chip.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BODY - 0.06, BODY - 0.06), epoxy);
  face.rotation.x = -Math.PI / 2;
  face.position.y = H / 2 + 0.001;
  chip.add(face);
  // the exposed pad underneath
  const tin = new THREE.MeshPhysicalMaterial({ color: '#9da1a8', metalness: 1, roughness: 0.55 }); // matte tin: glossy legs caught the key light and bloomed white
  const pad = new THREE.Mesh(new THREE.BoxGeometry(BODY * 0.55, 0.01, BODY * 0.55), tin);
  pad.position.y = -H / 2 - 0.004;
  chip.add(pad);
  // the leads: gull-wing — out of the body, down, and a foot — tin-plated, sixteen a side
  {
    const segs = [
      { g: new THREE.BoxGeometry(0.14, 0.03, 0.07), o: [BODY / 2 + 0.07, 0.0] },
      { g: new THREE.BoxGeometry(0.03, 0.2, 0.07), o: [BODY / 2 + 0.14, -0.1] },
      { g: new THREE.BoxGeometry(0.16, 0.03, 0.07), o: [BODY / 2 + 0.21, -0.2] },
    ];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const s of segs) {
      const im = new THREE.InstancedMesh(s.g, tin, N_PIN * 4);
      let k = 0;
      for (let side = 0; side < 4; side++) {
        q.setFromAxisAngle(up, (side * Math.PI) / 2);
        for (let i = 0; i < N_PIN; i++) {
          p.set(s.o[0], s.o[1], (i - (N_PIN - 1) / 2) * PITCH).applyQuaternion(q);
          im.setMatrixAt(k++, m4.compose(p, q, sc));
        }
      }
      im.castShadow = true;
      chip.add(im);
    }
  }
  // the mark, lasered into the epoxy and lit from within, beating
  const markTex = new THREE.TextureLoader().load('/heart.png');
  markTex.colorSpace = THREE.SRGBColorSpace;
  const markMat = new THREE.MeshBasicMaterial({ map: markTex, color: new THREE.Color(0.85, 0.6, 1.2), transparent: true, depthWrite: false, toneMapped: false });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.42, BODY * 0.42), markMat);
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, H / 2 + 0.003, -BODY * 0.1);
  chip.add(mark);
  const markGlowMat = new THREE.MeshBasicMaterial({ map: markTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const markGlow = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.52, BODY * 0.52), markGlowMat);
  markGlow.rotation.x = -Math.PI / 2;
  markGlow.position.set(0, H / 2 + 0.005, -BODY * 0.1);
  chip.add(markGlow);

  /* ================= the projects: a screen each, round the chip ================= */
  const projects = TECH_PROJECTS.slice(0, 4);
  const PW = 4.2, PH = PW * 0.5625;
  const slots = [new THREE.Vector3(-7.2, 3.3, -3), new THREE.Vector3(7.2, 3.3, -3), new THREE.Vector3(-7.2, -3.3, -3), new THREE.Vector3(7.2, -3.3, -3)];
  const bezel = new THREE.MeshPhysicalMaterial({ color: '#1a1c21', metalness: 0.7, roughness: 0.35, clearcoat: 0.4 });
  const panels = projects.map((pj, k) => {
    const at = slots[k];
    const group = new THREE.Group();
    group.position.copy(at);
    group.rotation.y = -Math.sign(at.x) * 0.22; // turned a little in, towards the chip
    scene.add(group);
    const frameMat = bezel.clone();
    frameMat.transparent = true;
    frameMat.opacity = 0;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.16, PH + 0.16, 0.1, 3, 0.04), frameMat);
    frame.position.z = -0.06;
    frame.castShadow = true;
    group.add(frame);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: screenTexture(pj.name, pj.about, pj.flow, k) as THREE.Texture }, uOn: { value: 0 }, uTime, uFocus: { value: 0 },
        uSide: { value: at.x < 0 ? 1 : 0 }, // the network plugs into the edge nearest the chip: build from there
        uGlitch: { value: 0 }, uSeed: { value: 0 },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float uOn, uTime, uFocus, uSide, uGlitch, uSeed; varying vec2 vUv;
        float h2(vec2 p) { return fract(sin(dot(mod(p, 97.0), vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          /* built by a neural network: a grid of neurons fires in from the edge the network plugs
             into, a lattice of connections links them, and then they swell until they merge into
             the picture */
          vec2 grid = vec2(32.0, 18.0);
          vec2 gp = vUv * grid;
          vec2 id = floor(gp);
          vec2 f = fract(gp) - 0.5;
          float order = mix(vUv.x, 1.0 - vUv.x, uSide) * 0.65 + h2(id) * 0.35;
          float fire = smoothstep(order * 0.55, order * 0.55 + 0.06, uOn);
          float grow = smoothstep(0.58, 1.0, uOn);
          float r = mix(0.1, 0.78, grow);
          float node = 1.0 - smoothstep(r - 0.04, r, max(abs(f.x), abs(f.y)) * (1.0 - grow) + length(f) * grow * 0.9);
          node = mix(node, 1.0, smoothstep(0.92, 1.0, uOn));
          // the lattice: each neuron wired to its right and upper neighbours while it builds
          float lat = (1.0 - smoothstep(0.0, 0.035, abs(f.y))) * step(0.0, f.x) + (1.0 - smoothstep(0.0, 0.035, abs(f.x))) * step(0.0, f.y);
          lat *= fire * (1.0 - grow);
          // a signal runs along the lattice as it fires
          float spark = pow(fract(order * 3.0 - uTime * 1.5), 12.0) * (1.0 - grow);
          /* the signal drops now and then: rows tear sideways, the channels split, blocks of the
             picture jump or freeze, and the whole frame jolts */
          vec2 guv = vUv;
          float gl = uGlitch;
          if (gl > 0.0) {
            float row = floor(vUv.y * 22.0);
            float tear = step(0.62, h2(vec2(row, uSeed)));
            guv.x += tear * (h2(vec2(row, uSeed + 3.0)) - 0.5) * 0.22 * gl;
            vec2 blk = floor(vUv * vec2(12.0, 8.0));
            float jump = step(0.86, h2(blk + uSeed));
            guv += jump * (vec2(h2(blk + uSeed + 1.0), h2(blk + uSeed + 2.0)) - 0.5) * 0.12 * gl;
            guv.y += (h2(vec2(uSeed, 9.0)) - 0.5) * 0.04 * gl;
          }
          /* RGB: the three channels come apart, each band of rows splitting its own way, the red
             and blue ghosts torn further than the picture */
          float band = floor(vUv.y * 14.0);
          float bs = (h2(vec2(band, uSeed + 5.0)) - 0.5) * 2.0;
          vec2 ca = vec2(0.012 + 0.03 * abs(bs), (h2(vec2(band, uSeed + 7.0)) - 0.5) * 0.01) * gl;
          vec3 c = vec3(texture2D(map, guv + ca * sign(bs + 0.001)).r, texture2D(map, guv).g, texture2D(map, guv - ca * sign(bs + 0.001)).b);
          if (gl > 0.0) {
            // whole bands tinted to one channel, the way a failing signal drops the others
            float tint = step(0.8, h2(vec2(band, uSeed + 11.0)));
            float which = h2(vec2(band, uSeed + 13.0));
            vec3 chan = which < 0.33 ? vec3(1.0, 0.18, 0.3) : which < 0.66 ? vec3(0.2, 1.0, 0.45) : vec3(0.25, 0.4, 1.0);
            c = mix(c, c * chan * 1.6, tint * gl);
            c *= 1.0 - 0.15 * gl * step(0.5, fract(vUv.y * 180.0));                            // scanlines
          }
          c *= 0.9 + 0.1 * sin(vUv.y * 600.0);                     // scanlines
          float scan = 1.0 - smoothstep(0.0, 0.012, abs(vUv.y - (1.0 - fract(uTime * 0.25))));
          c += vec3(0.2, 0.8, 1.0) * scan * 0.25 * grow;
          c *= 0.97 + 0.03 * sin(vUv.y * 8.0 - uTime * 3.0);
          vec3 neuron = vec3(0.35, 0.9, 1.0);
          vec3 outc = c * node * fire * (0.35 + 0.65 * grow)
                    + neuron * node * fire * (1.0 - grow) * (0.7 + spark * 2.0)
                    + neuron * lat * (0.3 + spark * 1.5);
          outc *= 0.8 + uFocus * 0.35;
          gl_FragColor = vec4(outc, 1.0);
        }`,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    screen.position.z = 0.002;
    group.add(screen);
    // a lit edge round the bezel, like a hologram's frame
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.85, 1.0).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0 });
    for (const [w, h, x, y] of [[PW + 0.2, 0.018, 0, PH / 2 + 0.1], [PW + 0.2, 0.018, 0, -PH / 2 - 0.1], [0.018, PH + 0.2, PW / 2 + 0.1, 0], [0.018, PH + 0.2, -PW / 2 - 0.1, 0]] as const) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(w, h), edgeMat);
      e.position.set(x, y, 0.005);
      group.add(e);
    }
    // and its plate, under it
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(PW * 0.62, (PW * 0.62) / 16),
      new THREE.MeshBasicMaterial({ opacity: 0, map: plateTexture(`NODE ${String(k + 1).padStart(2, '0')} // ${pj.about.toUpperCase()} // ${pj.slug}`), transparent: true, toneMapped: false }),
    );
    plate.position.set(-PW * 0.19, -PH / 2 - 0.26, 0);
    group.add(plate);
    // a poster, if the project has one, replaces the mock
    if (pj.poster) new THREE.TextureLoader().load(pj.poster, (t) => ((t.colorSpace = THREE.SRGBColorSpace), (mat.uniforms.map.value = t)));
    group.visible = false; // nothing of it exists until its network reaches it

    /* its thoughts: three clouds to its left, grown from the neurons on its near edge when the
       camera comes close — what it does, what it's built with, what it changed */
    const cloudU = { uTime, uReveal: { value: 0 } };
    // on the side away from the chip: the left of a left-hand window, the right of a right-hand one
    const out = at.x < 0 ? -1 : 1;
    const clouds = [
      { label: '// What it does', body: pj.summary, x: out * (PW / 2 + 2.05), y: 1.2 },
      { label: '// Stack', body: pj.stack.slice(0, 6).join('  ·  '), x: out * (PW / 2 + 2.4), y: 0.0 },
      { label: `// Outcome · ${pj.year}`, body: pj.result, x: out * (PW / 2 + 2.05), y: -1.2 },
    ].map((cl, ci) => {
      const cw = 2.9, ch = cw * (460 / 1024);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { map: { value: cloudTexture(cl.label, cl.body, 7 + k * 5 + ci) }, uOn: { value: 0 }, uTime, uOut: { value: out } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D map; uniform float uOn, uTime, uOut; varying vec2 vUv;
          float h2(vec2 p) { return fract(sin(dot(mod(p, 97.0), vec2(127.1, 311.7))) * 43758.5453); }
          void main(){
            // built the way the windows are: neurons fire in from the side the link arrives on, then resolve
            vec2 gp = vUv * vec2(40.0, 18.0);
            vec2 id = floor(gp), f = fract(gp) - 0.5;
            float order = (uOut < 0.0 ? 1.0 - vUv.x : vUv.x) * 0.6 + h2(id) * 0.4; // from the window's side
            float fire = smoothstep(order * 0.6, order * 0.6 + 0.08, uOn);
            float grow = smoothstep(0.62, 1.0, uOn);
            vec3 c = texture2D(map, vUv).rgb;
            float node = 1.0 - smoothstep(0.16, 0.22, length(f));
            vec3 neuron = vec3(0.35, 0.9, 1.0) * node * fire * (1.0 - grow) * 0.8;
            float flick = 0.9 + 0.1 * sin(uTime * 7.0 + vUv.y * 40.0);
            gl_FragColor = vec4((c * grow * flick + neuron) * fire, 1.0);
          }`,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), mat);
      mesh.position.set(cl.x, cl.y, 0.25);
      group.add(mesh);
      return { mat, cw, ch, x: cl.x, y: cl.y };
    });
    /* between the window and its clouds, a small neural network like the chip's: neurons along the
       window's edge, a hidden layer, and two neurons on each cloud's near edge, every one wired to
       every one in the next layer; it fires out a layer at a time, then pulses run through it */
    {
      const L0 = Array.from({ length: 6 }, (_, j) => new THREE.Vector3(out * (PW / 2 + 0.02), (j / 5 - 0.5) * PH * 0.8, 0.02));
      const L1 = Array.from({ length: 5 }, (_, j) => new THREE.Vector3(out * (PW / 2 + 0.62), (j / 4 - 0.5) * 2.4, 0.14));
      const L2 = clouds.flatMap((cl) => [0.18, -0.18].map((dy) => new THREE.Vector3(cl.x - out * (cl.cw / 2 - 0.12), cl.y + dy, 0.25)));
      const layers = [L0, L1, L2];
      const geos: THREE.BufferGeometry[] = [];
      const rand = rng(300 + k);
      for (let l = 0; l < 2; l++)
        for (const pa of layers[l])
          for (const pb of layers[l + 1]) {
            const g = new THREE.TubeGeometry(new THREE.LineCurve3(pa, pb), 6, 0.0075, 4, false);
            const n = g.attributes.position.count, sd = rand();
            g.setAttribute('aLayer', new THREE.Float32BufferAttribute(new Array(n).fill(l), 1));
            g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(n).fill(sd), 1));
            geos.push(g);
          }
      const netMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: cloudU,
        vertexShader: /* glsl */ `
          attribute float aLayer; attribute float aSeed; varying float vT; varying float vLayer; varying float vSeed;
          void main(){ vT = uv.x; vLayer = aLayer; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uReveal; varying float vT; varying float vLayer; varying float vSeed;
          void main(){
            float front = uReveal * 2.2 - vLayer;
            if (vT > front || uReveal <= 0.001) discard;
            float lead = exp(-(front - vT) * 6.0) * step(front, 1.0);
            float pulse = pow(fract(vT - uTime * (0.5 + vSeed * 0.7) + vSeed * 5.0), 14.0);
            vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.72, 0.4, 1.0), step(0.62, vSeed));
            float a = 0.16 + pulse * 1.2 + lead * 1.2;
            gl_FragColor = vec4(c * a, a);
          }`,
      });
      group.add(new THREE.Mesh(mergeGeometries(geos), netMat));
      geos.forEach((g) => g.dispose());
      // the neurons: small glowing points, lit layer by layer as the signal reaches them
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(layers.flat().flatMap((v) => [v.x, v.y, v.z]), 3));
      nodeGeo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers.flatMap((ly, l) => ly.map(() => l)), 1));
      group.add(new THREE.Points(nodeGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { ...cloudU, uViewH: { value: innerHeight * pixelRatio } },
        vertexShader: /* glsl */ `
          attribute float aLayer; uniform float uReveal, uTime, uViewH; varying float vOn; varying float vFire;
          void main(){
            float front = uReveal * 2.2 - aLayer;
            vOn = step(0.001, front) * step(0.001, uReveal);
            vFire = exp(-max(front, 0.0) * 4.0) * vOn + 0.3 * (0.5 + 0.5 * sin(uTime * 3.0 + aLayer * 1.7 + position.y * 3.0));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = vOn * min(0.09 * (1.0 + vFire * 0.5) * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z, uViewH * 0.016);
          }`,
        fragmentShader: /* glsl */ `
          varying float vOn; varying float vFire;
          void main(){
            if (vOn < 0.5) discard;
            float d = length(gl_PointCoord - 0.5);
            float core = smoothstep(0.22, 0.12, d), ring = smoothstep(0.5, 0.3, d) * smoothstep(0.26, 0.34, d);
            gl_FragColor = vec4(vec3(0.45, 0.92, 1.0) * (core * (0.9 + vFire * 0.9) + ring * 0.5), max(core, ring * 0.7));
          }`,
      })));
    }

    return { group, mat, frameMat, edgeMat, clouds, cloudU, cloudOn: 0, plateMat: plate.material as THREE.MeshBasicMaterial, burst: { next: 2 + k * 1.3, until: 0, strength: 0, reseed: 0 } };
  });

  /* ================= the networks: chip → neurons → screen, one per project =================
     Layers of neurons between the chip and each screen — four at the chip's pins, then five, six,
     and four along the screen's edge — every one wired to every one in the next layer. The signal
     fires forward a layer at a time; after that, pulses keep running through the weights. */
  const nets: { edgeMat: THREE.ShaderMaterial; nodeMat: THREE.ShaderMaterial; delay: number }[] = [];
  {
    const edgeMatFor = () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime, uReveal: { value: 0 }, uDim: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aLayer; attribute float aSeed; varying float vT; varying float vLayer; varying float vSeed;
          void main(){ vT = uv.x; vLayer = aLayer; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uReveal, uDim; varying float vT; varying float vLayer; varying float vSeed;
          void main(){
            // this layer's connections draw out as the signal crosses it
            float front = uReveal * 3.0 - vLayer;
            if (vT > front || uReveal <= 0.001) discard;
            float lead = exp(-(front - vT) * 6.0) * step(front, 1.0);
            float pulse = pow(fract(vT - uTime * (0.5 + vSeed * 0.7) + vSeed * 5.0), 14.0);
            vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.72, 0.4, 1.0), step(0.62, vSeed));
            // near the chip the links bunch up: keep them faint there so the pins don't bloom white
            float near = mix(0.06, 1.0, smoothstep(0.0, 0.6, vT + vLayer)); // twenty links meet at every pin
            float a = (0.12 + pulse * 1.1 + lead * 1.1) * near;
            gl_FragColor = vec4(c * a * uDim, a * uDim);
          }`,
      });
    const nodeMatFor = () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime, uReveal: { value: 0 }, uDim: { value: 1 }, uSize: { value: 0.12 }, uViewH: { value: innerHeight * pixelRatio } },
        vertexShader: /* glsl */ `
          attribute float aLayer; uniform float uReveal, uSize, uViewH, uTime; varying float vOn; varying float vFire;
          void main(){
            float front = uReveal * 3.0 - aLayer;
            vOn = step(0.001, front) * step(0.001, uReveal) * step(0.5, aLayer); // the chip's pins are the input layer
            vFire = exp(-max(front, 0.0) * 4.0) * vOn + 0.25 * (0.5 + 0.5 * sin(uTime * 3.0 + aLayer * 1.7 + position.y));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            // capped: up close to the chip they'd otherwise swell into white blots
            gl_PointSize = vOn * min(uSize * (1.0 + vFire * 0.5) * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z, uViewH * 0.018);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uDim; varying float vOn; varying float vFire;
          void main(){
            if (vOn < 0.5) discard;
            float d = length(gl_PointCoord - 0.5);
            float core = smoothstep(0.22, 0.12, d), ring = smoothstep(0.5, 0.3, d) * smoothstep(0.26, 0.34, d);
            vec3 c = vec3(0.45, 0.92, 1.0);
            gl_FragColor = vec4(c * (core * (0.8 + vFire * 0.8) + ring * 0.45) * uDim, max(core, ring * 0.7) * uDim);
          }`,
      });
    projects.forEach((_, k) => {
      const at = slots[k];
      const sx = Math.sign(at.x), sy = Math.sign(at.y);
      const layers: THREE.Vector3[][] = [];
      // the input layer: four of the chip's pins on the side facing the screen
      layers.push(
        Array.from({ length: 4 }, (_, j) => {
          const pinIndex = sy > 0 ? 1 + j * 2 : N_PIN - 2 - j * 2;
          return new THREE.Vector3(sx * (BODY / 2 + 0.3), -(pinIndex - (N_PIN - 1) / 2) * PITCH, -0.2);
        }),
      );
      // hidden layers, stepping out towards the screen
      const hidden = (n: number, f: number, spread: number, z: number) =>
        Array.from({ length: n }, (_, j) => new THREE.Vector3(sx * (1.6 + f * (Math.abs(at.x) - 1.6 - PW / 2)), at.y * f + (j - (n - 1) / 2) * spread, z));
      layers.push(hidden(5, 0.33, 0.55, -0.9), hidden(6, 0.66, 0.5, -1.9));
      // the output layer: along the screen's near edge
      const ex = at.x - sx * (PW / 2) * Math.cos(0.22);
      layers.push(Array.from({ length: 4 }, (_, j) => new THREE.Vector3(ex, at.y + (j - 1.5) * (PH / 4.5), at.z - 0.05)));

      const geos: THREE.BufferGeometry[] = [];
      const rand = rng(90 + k);
      for (let l = 0; l < layers.length - 1; l++)
        for (const a of layers[l])
          for (const b of layers[l + 1]) {
            const g = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 8, 0.012, 5, false);
            const n = g.attributes.position.count, seed = rand();
            g.setAttribute('aLayer', new THREE.Float32BufferAttribute(new Array(n).fill(l), 1));
            g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(n).fill(seed), 1));
            geos.push(g);
          }
      const edgeMat = edgeMatFor();
      scene.add(new THREE.Mesh(mergeGeometries(geos), edgeMat));
      geos.forEach((g) => g.dispose());
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(layers.flat().flatMap((v) => [v.x, v.y, v.z]), 3));
      nodeGeo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers.flatMap((ly, l) => ly.map(() => l)), 1));
      const nodeMat = nodeMatFor();
      scene.add(new THREE.Points(nodeGeo, nodeMat));
      nets.push({ edgeMat, nodeMat, delay: k * 0.06 });
    });
  }

  // dust in the light
  const dust = (() => {
    const n = 700, p: number[] = [];
    const r2 = rng(5);
    for (let i = 0; i < n; i++) p.push((r2() - 0.5) * 24, (r2() - 0.5) * 14, (r2() - 0.5) * 12 - 2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#9aa6c8', size: 0.025, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  })();
  scene.add(dust);

  /* ================= light ================= */
  const key = new THREE.DirectionalLight('#fff4e8', 1.6);
  key.position.set(3, 4, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rimC = new THREE.PointLight('#35d8ff', 3, 14, 1.6);
  rimC.position.set(-3, 2, -3.5);
  const rimV = new THREE.PointLight('#a310e7', 3, 14, 1.6);
  rimV.position.set(3, -1.5, -3.5);
  scene.add(rimC, rimV);

  /* ================= its own buffers and bloom ================= */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // no single glint may outshine the rest: a pinpoint specular would bloom into a halo
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c.rgb * min(1.0, 3.0 / max(m, 1e-4)), c.a); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.2, 1.4);
  composer.addPass(bloom);

  /* ================= the camera: a pose per stop ================= */
  const poses = [
    { pos: new THREE.Vector3(0.9, 0.6, 5.2), look: new THREE.Vector3(0, 0, 0) },
    { pos: new THREE.Vector3(0, 0.4, 22), look: new THREE.Vector3(0, 0, -1.5) },
    // a left-hand window sits right of centre with its clouds to its left; a right-hand one the mirror of that
    ...slots.map((s) => { const o = s.x < 0 ? -1 : 1; return { pos: new THREE.Vector3(s.x * 0.8 + o * 2.2, s.y, s.z + 10.5), look: new THREE.Vector3(s.x + o * 2.5, s.y, s.z) }; }),
  ];
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
  let first = true;

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 58 : 32; // a phone needs the wider lens
    camera.updateProjectionMatrix();
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    nets?.forEach((n) => (n.nodeMat.uniforms.uViewH.value = innerHeight * pixelRatio));
  };
  resize();

  const smooth = (a: number, b: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  let wired = 0;
  const corner = new THREE.Vector3();

  return {
    scene,
    camera,
    resize,
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      const q = Math.min(1, Math.max(0, p));
      // which two stops we're between, eased so the camera holds at each
      let i = 0;
      while (i < AI_STOPS.length - 1 && q > AI_STOPS[i + 1]) i++;
      const j = Math.min(AI_STOPS.length - 1, i + 1);
      const f = j === i ? 0 : smooth(0.25, 0.75, (q - AI_STOPS[i]) / (AI_STOPS[j] - AI_STOPS[i]));
      tgtPos.lerpVectors(poses[i].pos, poses[j].pos, f);
      tgtLook.lerpVectors(poses[i].look, poses[j].look, f);
      const reach = tgtPos.length() * 0.05;
      tgtPos.x += Math.sin(time * 0.15) * reach * 0.4 + px * (0.2 + reach);
      tgtPos.y += py * (0.1 + reach * 0.5);
      const k = first ? 1 : 1 - Math.exp(-3.2 * dt);
      first = false;
      pos.lerp(tgtPos, k);
      look.lerp(tgtLook, k);
      camera.position.copy(pos);
      camera.lookAt(look);

      // wiring it in: the traces run out from the pins, then each screen powers on
      const want = smooth(0.03, 0.2, q);
      wired += (want - wired) * (1 - Math.exp(-2.2 * dt));
      nets.forEach((n) => {
        const r = Math.min(1, Math.max(0, (wired - n.delay) / 0.5));
        n.edgeMat.uniforms.uReveal.value = r;
        n.nodeMat.uniforms.uReveal.value = r;
      });
      const focus = f < 0.5 ? i - 2 : j - 2; // the screen being visited, if any
      panels.forEach((pn, k2) => {
        // each screen builds from its network once the signal reaches its edge; the last is whole by wired = 0.93
        const on = Math.min(1, Math.max(0, (wired - nets[k2].delay - 0.45) / 0.3));
        pn.mat.uniforms.uOn.value = on;
        // the window itself is made by the network: its frame and edges come up with the neurons
        pn.group.visible = on > 0.001;
        pn.edgeMat.opacity = smooth(0.0, 0.35, on);
        pn.frameMat.opacity = smooth(0.2, 0.7, on);
        pn.plateMat.opacity = smooth(0.7, 1.0, on);
        // glitch bursts: every few seconds, short and stuttering, some heavy
        const gb = pn.burst;
        if (time > gb.next) {
          gb.until = time + 0.12 + Math.random() * 0.35;
          gb.strength = Math.random() < 0.35 ? 1 : 0.4 + Math.random() * 0.3;
          gb.next = gb.until + 1.8 + Math.random() * 3.5;
        }
        const glitching = on > 0.95 && time < gb.until;
        if (glitching && time > gb.reseed) {
          pn.mat.uniforms.uSeed.value = Math.random() * 90;
          gb.reseed = time + 0.05;
        }
        pn.mat.uniforms.uGlitch.value = glitching ? gb.strength * (Math.floor(time * 20) % 3 === 1 ? 0.6 : 1) : 0;
        pn.group.position.x = slots[k2].x + (glitching ? (Math.random() - 0.5) * 0.12 * gb.strength : 0);
        // its clouds, when the camera has come in close to it: links grow out, then the clouds build
        const close = (i - 2 === k2 ? 1 - f : 0) + (j - 2 === k2 && j !== i ? f : 0);
        pn.cloudOn += ((on > 0.95 ? smooth(0.55, 0.95, close) : 0) - pn.cloudOn) * Math.min(1, dt * 2.2);
        pn.cloudU.uReveal.value = Math.min(1, pn.cloudOn * 1.7);
        // while its thoughts are up, the network feeding it steps back so the clouds read clean
        nets[k2].edgeMat.uniforms.uDim.value = nets[k2].nodeMat.uniforms.uDim.value = 1 - 0.8 * pn.cloudOn;
        pn.clouds.forEach((cl, ci) => (cl.mat.uniforms.uOn.value = Math.min(1, Math.max(0, (pn.cloudOn - 0.35 - ci * 0.08) / 0.5))));
        pn.mat.uniforms.uFocus.value += ((k2 === focus ? 1 : 0) - pn.mat.uniforms.uFocus.value) * Math.min(1, dt * 4);
      });

      // the chip floats and turns on its own, then holds still once it's wired in
      const free = 1 - smooth(0.0, 0.25, wired);
      chipRoot.position.set(0, Math.sin(time * 0.9) * 0.06 * free, 0);
      chipRoot.rotation.set(Math.sin(time * 0.5) * 0.35 * free - 0.3 * free, Math.sin(time * 0.37) * 0.5 * free + 0.4 * free, Math.sin(time * 0.29) * 0.08 * free);
      const bt = beatAt(time % 1);
      markMat.color.setRGB(0.85, 0.6, 1.2).multiplyScalar(1.3 + bt * 1.0);
      markGlowMat.opacity = 0.2 + bt * 0.4;
      dust.rotation.y = time * 0.01;

      // the screen being visited: where it is on screen, for its click target
      const out = signals.aiPanel;
      out.on = focus >= 0 && focus < panels.length && Math.abs(f - 0.5) > 0.35 && panels[focus].mat.uniforms.uOn.value > 0.95;
      out.index = focus;
      if (out.on) {
        const g = panels[focus].group;
        g.updateMatrixWorld();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.set((cx * PW) / 2, (cy * PH) / 2, 0).applyMatrix4(g.matrixWorld).project(camera);
          const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
          x0 = Math.min(x0, sx);
          x1 = Math.max(x1, sx);
          y0 = Math.min(y0, sy);
          y1 = Math.max(y1, sy);
        }
        Object.assign(out, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }

      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
  };
}
