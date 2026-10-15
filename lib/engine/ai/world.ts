import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TECH_PROJECTS } from '@/content/techProjects';
import { filmPage, hasFilmPage } from './filmPage';
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

// kept apart from the engine so the page's scroll can read them without loading three.js
import { AI_STOPS, AI_EXIT_FROM } from '@/lib/aiStops';
export { AI_STOPS, AI_EXIT_FROM };

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// lub-dub: two beats close together, then a rest (the landing's heart, the same shape)
const beatAt = (ph: number) => Math.exp(-Math.pow((ph - 0.05) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));

/** The package's top: matte black ceramic, the marking lasered into it, fine engraved detail (a bevel
    line, the die's outline, traces out to the leads, a data-matrix code) and the pin-1 dimple. It
    comes with a roughness map (the engraving is rougher, so it catches the light differently) and a
    bump map (the engraving is cut in). */
function packageTop() {
  const S = 1024;
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const; };
  const [col, g] = make(), [rgh, r] = make(), [bmp, b] = make();
  // the ceramic: near black, the faintest grain
  g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, S, S);
  const rand = rng(41);
  for (let i = 0; i < 9000; i++) { const v = 10 + rand() * 9; g.fillStyle = `rgb(${v},${v},${v + 1})`; g.fillRect(rand() * S, rand() * S, 1.5, 1.5); }
  r.fillStyle = 'rgb(0,215,0)'; r.fillRect(0, 0, S, S); // matte
  b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);       // flat
  // everything engraved is drawn into all three: a little lighter, rougher, and cut down
  const ink = (alpha: number) => { g.strokeStyle = g.fillStyle = `rgba(150,152,160,${alpha})`; r.strokeStyle = r.fillStyle = 'rgb(0,250,0)'; b.strokeStyle = b.fillStyle = '#5a5a5a'; };
  const both = (fn: (c: CanvasRenderingContext2D) => void) => { for (const c of [g, r, b]) fn(c); };
  // the bevel line just inside the edge, and the die's outline under the lid
  ink(0.28);
  both((c) => { c.lineWidth = 3; c.strokeRect(34, 34, S - 68, S - 68); });
  ink(0.12);
  both((c) => { c.lineWidth = 2; c.setLineDash([10, 8]); c.strokeRect(250, 170, S - 500, S - 560); c.setLineDash([]); });
  // fine traces from the die out to the edges, the way the bond wires run underneath
  ink(0.1);
  both((c) => {
    c.lineWidth = 1.6;
    for (let i = 0; i < 16; i++) {
      const t = 120 + i * ((S - 240) / 15);
      c.beginPath(); c.moveTo(t, 48); c.lineTo(t, 110); c.lineTo(250 + ((t - 120) / (S - 240)) * (S - 500), 170); c.stroke();
      c.beginPath(); c.moveTo(48, t); c.lineTo(110, t); c.lineTo(250, 170 + ((t - 120) / (S - 240)) * (S - 560)); c.stroke();
      c.beginPath(); c.moveTo(S - 48, t); c.lineTo(S - 110, t); c.lineTo(S - 250, 170 + ((t - 120) / (S - 240)) * (S - 560)); c.stroke();
    }
  });
  // the marking
  const text = (str: string, px: number, x: number, y: number, a = 0.62, align: CanvasTextAlign = 'center') => {
    ink(a);
    both((c) => { c.font = `600 ${px}px "JetBrains Mono", Menlo, monospace`; c.textAlign = align; c.fillText(str, x, y); });
  };
  text('DIZRUPT', 64, S / 2, S * 0.75, 0.7);
  text('DZ-M1  ·  NEURAL ACCELERATOR', 28, S / 2, S * 0.81, 0.45);
  text('2026 · MUMBAI · 4K9X-A1', 24, S / 2, S * 0.855, 0.38);
  text('e4', 22, S * 0.86, S * 0.93, 0.35, 'right');
  // a data-matrix code in the corner
  ink(0.4);
  const dm = rng(7), cx = S * 0.1, cy = S * 0.84, cell = 6;
  both((c) => {
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (x === 0 || y === 13 || (y === 0 && x % 2 === 0) || (x === 13 && y % 2 === 1) || dm() < 0.45) c.fillRect(cx + x * cell, cy + y * cell, cell - 0.6, cell - 0.6);
  });
  // pin 1: a moulded dimple, glossier than the rest
  g.fillStyle = '#060607'; r.fillStyle = 'rgb(0,80,0)'; b.fillStyle = '#404040';
  for (const c of [g, r, b]) { c.beginPath(); c.arc(S * 0.1, S * 0.1, 24, 0, 7); c.fill(); }
  const tex = (c: HTMLCanvasElement, srgb = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(col, true), rough: tex(rgh), bump: tex(bmp) };
}

/** The lid: a nickel-plated heat spreader, brushed, with the marking lasered dark into it. Returns
    its colour, roughness and bump maps. */
function lidTop() {
  const S = 1024;
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const; };
  const [col, g] = make(), [rgh, r] = make(), [bmp, b] = make();
  // brushed: fine streaks one way, each a slightly different brightness and roughness
  g.fillStyle = '#868a92'; g.fillRect(0, 0, S, S);
  r.fillStyle = 'rgb(0,110,0)'; r.fillRect(0, 0, S, S);
  b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
  const rand = rng(23);
  for (let y = 0; y < S; y += 1) {
    const v = rand();
    g.fillStyle = `rgba(${v < 0.5 ? '255,255,255' : '40,42,48'},${0.03 + rand() * 0.07})`; g.fillRect(0, y, S, 1);
    if (rand() < 0.25) { r.fillStyle = `rgba(0,${70 + rand() * 60},0,0.6)`; r.fillRect(0, y, S, 1); }
  }
  for (let i = 0; i < 260; i++) { // longer scratches in the grain
    const y = rand() * S, x = rand() * S, len = 80 + rand() * 400;
    g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.08})`; g.fillRect(x, y, len, 1);
  }
  // a soft darkening towards the edges, where the plating meets the bevel
  const vg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  // the marking, lasered dark, rough, and cut in
  const ink = () => { g.fillStyle = 'rgba(28,29,34,0.85)'; r.fillStyle = 'rgb(0,220,0)'; b.fillStyle = '#5a5a5a'; };
  const both = (fn: (c: CanvasRenderingContext2D) => void) => { for (const c of [g, r, b]) fn(c); };
  ink();
  both((c) => {
    c.textAlign = 'center';
    c.font = '600 70px "JetBrains Mono", Menlo, monospace'; c.fillText('DIZRUPT', S / 2, S * 0.76);
    c.font = '500 30px "JetBrains Mono", Menlo, monospace'; c.fillText('DZ-M1  ·  NEURAL ACCELERATOR', S / 2, S * 0.825);
    c.font = '500 26px "JetBrains Mono", Menlo, monospace'; c.fillText('2026 · MUMBAI · 4K9X-A1  e4', S / 2, S * 0.87);
  });
  const dm = rng(7), cx = S * 0.08, cy = S * 0.8, cell = 7;
  both((c) => {
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (x === 0 || y === 13 || (y === 0 && x % 2 === 0) || (x === 13 && y % 2 === 1) || dm() < 0.45) c.fillRect(cx + x * cell, cy + y * cell, cell - 0.8, cell - 0.8);
    // pin 1: a small triangle in the corner
    c.beginPath(); c.moveTo(S * 0.06, S * 0.06); c.lineTo(S * 0.13, S * 0.06); c.lineTo(S * 0.06, S * 0.13); c.closePath(); c.fill();
  });
  const tex = (c: HTMLCanvasElement, srgb = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(col, true), rough: tex(rgh), bump: tex(bmp) };
}

/** A small tag for one of the capabilities beyond the featured work: an outline, a mark, its name. */
function capabilityTexture(name: string, code: string) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 160;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(124,242,255,0.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(24, 6); g.lineTo(634, 6); g.lineTo(634, 136); g.lineTo(616, 154); g.lineTo(6, 154); g.lineTo(6, 24); g.closePath(); g.stroke();
  g.fillStyle = 'rgba(124,242,255,0.07)'; g.fill();
  g.fillStyle = 'rgba(124,242,255,0.75)'; g.font = '500 26px "JetBrains Mono", Menlo, monospace';
  g.fillText(`${code} // CAPABILITY`, 30, 52);
  g.fillStyle = '#e8f6ff'; g.font = '600 50px "Inter Tight", system-ui, sans-serif';
  g.fillText(name, 30, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A project's screen: a system console — title bar, the project in big mono type, a node graph of
    the system, a pane of code, an oscilloscope trace and a hex dump, all in corner brackets. */
function screenTexture(pj: (typeof TECH_PROJECTS)[number], k: number) {
  const { name, about, flow } = pj;
  const W = 1280, H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rand = rng(17 + k * 31);
  const mono = (px: number, w = 500) => `${w} ${px}px "JetBrains Mono", Menlo, monospace`;
  const sans = (px: number, w = 500) => `${w} ${px}px "Inter Tight", system-ui, sans-serif`;
  g.fillStyle = '#02060c';
  g.fillRect(0, 0, W, H);
  // fine grid
  g.strokeStyle = 'rgba(60,240,255,0.045)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x < W; x += 24) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 0; y < H; y += 24) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  // title bar
  g.fillStyle = 'rgba(60,240,255,0.08)';
  g.fillRect(0, 0, W, 44);
  g.fillStyle = 'rgba(60,240,255,0.35)';
  g.fillRect(0, 44, W, 1);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(26 + i * 20, 22, 6, 0, 7); g.fill(); });
  g.font = mono(16);
  g.fillStyle = 'rgba(189,246,255,0.75)';
  g.fillText(`node_${String(k + 1).padStart(2, '0')}.sys — ${about.toLowerCase()}`, 96, 28);
  g.textAlign = 'right';
  g.fillStyle = '#3cf0ff';
  g.fillText('● LINK ACTIVE', W - 24, 28);
  g.textAlign = 'left';
  // the name
  g.fillStyle = '#eafcff';
  g.font = mono(64, 600);
  g.fillText(name.toUpperCase(), 40, 122);
  g.fillStyle = '#a58bff';
  g.font = mono(17);
  g.fillText(`FEATURED WORK ${String(k + 1).padStart(2, '0')}  //  ${about.toUpperCase()}  //  ${pj.year}`, 42, 154);
  g.fillStyle = 'rgba(60,240,255,0.25)';
  g.fillRect(40, 176, W - 80, 1);

  // the left column: what it does, what it changed, what it's built with
  const L = 40, LW = 600;
  const wrap = (text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) => {
    const words = text.split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        if (n === maxLines - 1) { while (g.measureText(`${line}…`).width > maxW) line = line.slice(0, -1); g.fillText(`${line}…`, x, y + n * lh); return y + (n + 1) * lh; }
        g.fillText(line, x, y + n * lh); n++; line = w;
      } else line = test;
    }
    g.fillText(line, x, y + n * lh);
    return y + (n + 1) * lh;
  };
  const label = (t: string, y: number) => {
    g.fillStyle = '#3cf0ff'; g.font = mono(14, 600);
    g.fillText(t, L, y);
    g.fillStyle = 'rgba(60,240,255,0.3)'; g.fillRect(L + g.measureText(t).width + 12, y - 5, 40, 1);
  };
  label('// WHAT IT DOES', 214);
  g.fillStyle = 'rgba(234,252,255,0.92)'; g.font = sans(22, 500);
  let y = wrap(pj.summary, L, 248, LW, 30, 4);
  label(`// OUTCOME · ${pj.year}`, y + 26);
  g.fillStyle = 'rgba(234,252,255,0.78)'; g.font = sans(20, 400);
  y = wrap(pj.result, L, y + 58, LW, 28, 3);
  label('// STACK', y + 26);
  g.font = mono(15, 600);
  let cx = L, cy = y + 48;
  for (const st of pj.stack.slice(0, 8)) {
    const w = g.measureText(st).width + 22;
    if (cx + w > L + LW) { cx = L; cy += 38; }
    if (cy > 640) break;
    g.strokeStyle = 'rgba(60,240,255,0.55)'; g.lineWidth = 1.5; g.strokeRect(cx, cy, w, 28);
    g.fillStyle = 'rgba(60,240,255,0.07)'; g.fillRect(cx, cy, w, 28);
    g.fillStyle = '#dff9ff'; g.fillText(st, cx + 11, cy + 19);
    cx += w + 8;
  }

  // the right column: the system in four steps, and its live signal
  const gx = 680, gy = 196, gw = 560, gh = 250;
  g.strokeStyle = 'rgba(60,240,255,0.25)';
  g.lineWidth = 1;
  g.strokeRect(gx, gy, gw, gh);
  g.font = mono(13);
  g.fillStyle = 'rgba(189,246,255,0.5)';
  g.fillText('SYSTEM MAP', gx + 12, gy + 22);
  const pts = flow.map((_, i) => [gx + 70 + i * ((gw - 140) / (flow.length - 1)), gy + 140 + (i % 2 ? -40 : 30)] as const);
  g.strokeStyle = 'rgba(60,240,255,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  pts.forEach(([x, py], i) => (i ? g.lineTo(x, py) : g.moveTo(x, py)));
  g.stroke();
  pts.forEach(([x, py], i) => {
    g.fillStyle = '#02060c'; g.strokeStyle = i % 2 ? '#a58bff' : '#3cf0ff'; g.lineWidth = 3;
    g.beginPath(); g.arc(x, py, 16, 0, 7); g.fill(); g.stroke();
    g.fillStyle = i % 2 ? '#a58bff' : '#3cf0ff';
    g.beginPath(); g.arc(x, py, 5, 0, 7); g.fill();
    g.fillStyle = 'rgba(234,252,255,0.85)'; g.font = mono(14); g.textAlign = 'center';
    g.fillText(flow[i].toUpperCase(), x, py + (i % 2 ? -28 : 40));
    g.textAlign = 'left';
  });
  const oy = 466, oh = 140;
  g.strokeStyle = 'rgba(60,240,255,0.25)'; g.lineWidth = 1;
  g.strokeRect(gx, oy, gw, oh);
  g.fillStyle = 'rgba(189,246,255,0.5)'; g.font = mono(13);
  g.fillText('SIGNAL', gx + 12, oy + 22);
  g.strokeStyle = '#3cf0ff'; g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= gw - 40; x += 4) {
    const py = oy + oh / 2 + 10 + Math.sin(x * 0.045 + k) * 24 * Math.sin(x * 0.006 + k * 2) + (rand() - 0.5) * 8;
    if (x) g.lineTo(gx + 20 + x, py); else g.moveTo(gx + 20 + x, py);
  }
  g.stroke();
  // footer: status line and the way in
  g.fillStyle = 'rgba(189,246,255,0.55)';
  g.font = mono(14);
  g.fillText(`> node_${String(k + 1).padStart(2, '0')} ready · 16/16 lanes · awaiting input_`, 42, 690);
  g.fillStyle = '#3cf0ff';
  g.fillRect(W - 250, 640, 210, 48);
  g.fillStyle = '#021016';
  g.font = mono(18, 700);
  g.fillText('OPEN PROJECT →', W - 232, 671);
  // corner brackets
  g.strokeStyle = '#3cf0ff';
  g.lineWidth = 4;
  for (const [x, by, dx, dy] of [[8, 52, 1, 1], [W - 8, 52, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]] as const) {
    g.beginPath(); g.moveTo(x, by + dy * 28); g.lineTo(x, by); g.lineTo(x + dx * 28, by); g.stroke();
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

/* Metal can't outshine the neon: its highlight is held under the bloom's threshold, so the leads and
   the lid keep a metal sheen as the chip turns but never flare into a white halo. */
function capped<M extends THREE.MeshPhysicalMaterial>(m: M, max: number) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n  gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${max.toFixed(2)}));`);
  };
  return m;
}

export type AiWorld = ReturnType<typeof createAiWorld>;

export function createAiWorld(renderer: THREE.WebGLRenderer, pixelRatio: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040509');
  scene.fog = new THREE.FogExp2('#040509', 0.022);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
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
  // matte black ceramic: almost no shine of its own, the engraving cut into it
  const epoxy = new THREE.MeshPhysicalMaterial({ color: '#333337', map: top.map, roughnessMap: top.rough, roughness: 1, metalness: 0, bumpMap: top.bump, bumpScale: 0.6, clearcoat: 0.05, clearcoatRoughness: 0.75, envMapIntensity: 0.4 });
  const epoxySide = new THREE.MeshPhysicalMaterial({ color: '#08080a', roughness: 0.85, envMapIntensity: 0.4 });
  // the body: a moulded block with the radius a real package has; its top face carries the marking
  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY, H, BODY, 3, 0.03), epoxySide);
  body.castShadow = body.receiveShadow = true;
  chip.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BODY - 0.06, BODY - 0.06), epoxy);
  face.rotation.x = -Math.PI / 2;
  face.position.y = H / 2 + 0.001;
  chip.add(face);
  /* the lid: a nickel-plated heat spreader inset on the ceramic, its edges chamfered; the ceramic rim
     and its engraved traces show round it */
  const LID = BODY * 0.74, LH = 0.045;
  const lidTex = lidTop();
  const lidSide = capped(new THREE.MeshPhysicalMaterial({ color: '#8e929a', metalness: 1, roughness: 0.32, envMapIntensity: 1.2 }), 0.85);
  const lidFace = capped(new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: lidTex.map, metalness: 0.92, roughness: 1, roughnessMap: lidTex.rough, bumpMap: lidTex.bump, bumpScale: 0.35,
    anisotropy: 0.75, anisotropyRotation: 0, envMapIntensity: 0.95, clearcoat: 0.12, clearcoatRoughness: 0.45,
  }), 0.72);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(LID, LH, LID, 3, 0.012), lidSide);
  lid.position.y = H / 2 + LH / 2 - 0.004;
  lid.castShadow = lid.receiveShadow = true;
  chip.add(lid);
  const lidTopMesh = new THREE.Mesh(new THREE.PlaneGeometry(LID - 0.024, LID - 0.024), lidFace);
  lidTopMesh.rotation.x = -Math.PI / 2;
  lidTopMesh.position.y = H / 2 + LH - 0.003;
  lidTopMesh.receiveShadow = true;
  chip.add(lidTopMesh);
  // the exposed pad underneath
  // silver leads: bright metal, brushed enough that the key light reads as a sheen, not a pinpoint
  const tin = new THREE.MeshPhysicalMaterial({ color: '#b9bdc4', metalness: 1, roughness: 0.4, envMapIntensity: 1.1 }); // plated silver, brushed: a sheen, not a flare
  capped(tin, 0.85);
  // the package's edge: a machined metal frame round the top, chamfered, catching the light along it
  const edgeMetal = new THREE.MeshPhysicalMaterial({ color: '#5d6068', metalness: 1, roughness: 0.48 }); // satin: a line of light along it, never a flare
  capped(edgeMetal, 0.8);
  for (let side = 0; side < 4; side++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BODY + 0.012, 0.028, 0.03), edgeMetal);
    const a = (side * Math.PI) / 2;
    bar.position.set(Math.sin(a) * (BODY / 2 - 0.009), H / 2 - 0.006, Math.cos(a) * (BODY / 2 - 0.009));
    bar.rotation.y = a;
    bar.castShadow = true;
    chip.add(bar);
  }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(BODY * 0.55, 0.01, BODY * 0.55), tin);
  pad.position.y = -H / 2 - 0.004;
  chip.add(pad);
  /* the leads: gull-wing, each one bent strip of plated copper: out of the body's side, a rounded
     bend down, a rounded bend into the foot. Drawn as its profile and swept across the lead's width. */
  {
    const T = 0.022, LW = PITCH * 0.42; // thickness, width
    const prof = new THREE.Shape();
    const r1 = 0.05, r2 = 0.05, x0 = BODY / 2 - 0.02, drop = 0.2, foot = 0.17;
    // the top edge out, round the first bend, down, round the second, along the foot; then back under
    prof.moveTo(x0, T / 2);
    prof.lineTo(x0 + 0.08, T / 2);
    prof.absarc(x0 + 0.08, T / 2 - r1, r1, Math.PI / 2, 0, true);
    prof.lineTo(x0 + 0.08 + r1, -drop + r2 + T / 2);
    prof.absarc(x0 + 0.08 + r1 + r2, -drop + r2 + T / 2, r2, Math.PI, Math.PI * 1.5, false);
    prof.lineTo(x0 + 0.08 + r1 + r2 + foot, -drop + T / 2);
    prof.lineTo(x0 + 0.08 + r1 + r2 + foot, -drop - T / 2);
    prof.absarc(x0 + 0.08 + r1 + r2, -drop + r2 + T / 2, r2 + T, Math.PI * 1.5, Math.PI, true);
    prof.lineTo(x0 + 0.08 + r1 - T, T / 2 - r1);
    prof.absarc(x0 + 0.08, T / 2 - r1, r1 - T, 0, Math.PI / 2, false);
    prof.lineTo(x0, -T / 2);
    prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, { depth: LW, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
    geo.translate(0, 0, -LW / 2);
    // the profile is in x (out) and y (up); the chip's frame has its face up (+y): sweep it along z
    const im = new THREE.InstancedMesh(geo, tin, N_PIN * 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let k = 0;
    for (let side = 0; side < 4; side++) {
      q.setFromAxisAngle(up, (side * Math.PI) / 2);
      for (let i = 0; i < N_PIN; i++) {
        p.set(0, 0, (i - (N_PIN - 1) / 2) * PITCH).applyQuaternion(q);
        im.setMatrixAt(k++, m4.compose(p, q, sc));
      }
    }
    im.castShadow = im.receiveShadow = true;
    chip.add(im);
  }
  // the mark, lasered into the epoxy and lit from within, beating
  const markTex = new THREE.TextureLoader().load('/heart.png');
  markTex.colorSpace = THREE.SRGBColorSpace;
  // lasered: it sits in the ceramic, partly see-through, its colour from the glow under it
  // lasered: the etched ceramic is lighter and frosted; under it, the faintest violet glow that beats
  const markMat = new THREE.MeshStandardMaterial({ map: markTex, color: new THREE.Color('#1c1b22'), roughness: 0.9, metalness: 0.2, transparent: true, opacity: 0.88, depthWrite: false, emissive: new THREE.Color('#8a3dff'), emissiveMap: markTex, emissiveIntensity: 0.25 });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.4, BODY * 0.4), markMat);
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, H / 2 + LH - 0.001, -BODY * 0.1);
  chip.add(mark);
  const markGlowMat = new THREE.MeshBasicMaterial({ map: markTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const markGlow = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.52, BODY * 0.52), markGlowMat);
  markGlow.rotation.x = -Math.PI / 2;
  markGlow.position.set(0, H / 2 + LH + 0.001, -BODY * 0.1);
  chip.add(markGlow);

  /* ================= the projects: a screen each, round the chip ================= */
  const projects = TECH_PROJECTS.slice(0, 4);
  const PW = 4.2, PH = PW * 0.5625;
  // at slightly different depths, so they read as launched out into space rather than pinned to a wall
  const slots = [new THREE.Vector3(-7.2, 3.3, -2.6), new THREE.Vector3(7.2, 3.3, -3.3), new THREE.Vector3(-7.2, -3.3, -3.2), new THREE.Vector3(7.2, -3.3, -2.7)];
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
    // a project with a film gets its page in the product's own look, with the film playing in it
    const live = hasFilmPage(pj) ? filmPage(pj, k) : null;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: live ? live.tex : (screenTexture(pj, k) as THREE.Texture) }, uOn: { value: 0 }, uTime, uFocus: { value: 0 },
        uSide: { value: at.x < 0 ? 1 : 0 }, // the network plugs into the edge nearest the chip: build from there
        uGlitch: { value: 0 }, uSeed: { value: 0 }, uDissolve: { value: 0 },
        uLight: { value: live ? 1 : 0 }, // a page in a product's light look: no heavy scanlines or glow on it
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float uOn, uTime, uFocus, uSide, uGlitch, uSeed, uDissolve, uLight; varying vec2 vUv;
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
          c *= mix(0.9 + 0.1 * sin(vUv.y * 600.0), 0.985 + 0.015 * sin(vUv.y * 600.0), uLight); // scanlines
          float scan = 1.0 - smoothstep(0.0, 0.012, abs(vUv.y - (1.0 - fract(uTime * 0.25))));
          c += vec3(0.2, 0.8, 1.0) * scan * 0.25 * grow * (1.0 - uLight * 0.8);
          c *= 0.97 + 0.03 * sin(vUv.y * 8.0 - uTime * 3.0);
          vec3 neuron = vec3(0.35, 0.9, 1.0);
          vec3 outc = c * node * fire * (0.35 + 0.65 * grow)
                    + neuron * node * fire * (1.0 - grow) * (0.7 + spark * 2.0)
                    + neuron * lat * (0.3 + spark * 1.5);
          outc *= mix(0.8 + uFocus * 0.35, 0.78 + uFocus * 0.2, uLight);
          // handing over: the picture breaks back into neurons, cell by cell, each flashing as it goes
          if (uDissolve > 0.0) {
            float gone = h2(id + 31.0) * 0.85 + 0.1;
            float edge = smoothstep(gone - 0.12, gone, uDissolve) * (1.0 - smoothstep(gone, gone + 0.04, uDissolve));
            outc *= 1.0 - step(gone, uDissolve);
            outc += vec3(0.4, 0.9, 1.0) * node * edge * 2.0;
          }
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
      new THREE.MeshBasicMaterial({ opacity: 0, map: plateTexture(`FEATURED WORK ${String(k + 1).padStart(2, '0')} // ${pj.about.toUpperCase()} // ${pj.slug}`), transparent: true, toneMapped: false }),
    );
    plate.position.set(-PW * 0.19, -PH / 2 - 0.26, 0);
    group.add(plate);
    // a poster, if the project has one, replaces the mock
    if (pj.poster) new THREE.TextureLoader().load(pj.poster, (t) => ((t.colorSpace = THREE.SRGBColorSpace), (mat.uniforms.map.value = t)));
    group.visible = false; // nothing of it exists until its network reaches it

    // what it does, what it's built with and what it changed are on the screen itself now
    const cloudU = { uTime, uReveal: { value: 0 } };
    const clouds: { mat: THREE.ShaderMaterial; mesh: THREE.Mesh }[] = [];

    return { group, mat, live, frameMat, edgeMat, clouds, cloudU, cloudOn: 0, plateMat: plate.material as THREE.MeshBasicMaterial, burst: { next: 2 + k * 1.3, until: 0, strength: 0, reseed: 0 } };
  });

  /* ================= the hand-over's particles: each screen's picture, as it breaks up ================= */
  const burst = (() => {
    const n = 900 * panels.length;
    const start = new Float32Array(n * 3), vel = new Float32Array(n * 3), seed = new Float32Array(n);
    panels.forEach((pn, k) => {
      pn.group.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      for (let i = 0; i < 900; i++) {
        const idx = k * 900 + i;
        v.set((Math.random() - 0.5) * PW, (Math.random() - 0.5) * PH, 0.05).applyMatrix4(pn.group.matrixWorld);
        start.set([v.x, v.y, v.z], idx * 3);
        // out towards the camera and away from the middle, so the stream leaves the frame
        const dir = new THREE.Vector3(v.x * 0.35, v.y * 0.35, 6 + Math.random() * 6);
        vel.set([dir.x + (Math.random() - 0.5) * 3, dir.y + (Math.random() - 0.5) * 3, dir.z], idx * 3);
        seed[idx] = Math.random();
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uT: { value: 0 }, uViewH: { value: innerHeight * pixelRatio } },
      vertexShader: /* glsl */ `
        attribute vec3 aVel; attribute float aSeed; uniform float uT, uViewH; varying float vA;
        void main(){
          float t = clamp((uT - aSeed * 0.35) / 0.65, 0.0, 1.0);
          vec3 p = position + aVel * t * t;
          vA = step(0.001, t) * (1.0 - t);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vA * min(0.16 * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z, uViewH * 0.02);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (vA <= 0.0) discard;
          gl_FragColor = vec4(vec3(0.45, 0.9, 1.0) * smoothstep(0.5, 0.0, d) * 1.6, vA); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    return { pts, mat };
  })();

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
      // (the networks out of the chip's sides are retired: the pages come out of the beam now)
      void mergeGeometries; void geos;
      geos.forEach((g) => g.dispose());
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(layers.flat().flatMap((v) => [v.x, v.y, v.z]), 3));
      nodeGeo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers.flatMap((ly, l) => ly.map(() => l)), 1));
      const nodeMat = nodeMatFor();
      void nodeGeo;
      nets.push({ edgeMat, nodeMat, delay: k * 0.06 });
    });
  }

  /* ================= the launch: each project flies out of the chip along a curve ================= */
  // from the chip's edge, out towards the camera in an arc, round to where the screen settles
  /* the beam: a column of light standing off the whole silver lid, out towards the camera; the
     pages come up out of it. Light at its foot, thinning to nothing at its far end, with fine
     scanlines running up it and an edge glow down its sides. */
  const beamU = { uTime, uOn: { value: 0 } };
  const BEAM_L = 7;
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(BODY * 0.74, BEAM_L, BODY * 0.74, 1, 1, 1).translate(0, BEAM_L / 2, 0),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
      uniforms: beamU,
      vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOn; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main(){
          if (uOn <= 0.001) discard;
          float h = vP.y / ${BEAM_L.toFixed(1)};
          // it rises: its top edge climbs as it comes on
          float top = smoothstep(0.0, 1.0, uOn * 1.6);
          if (h > top) discard;
          float fall = pow(1.0 - h, 2.2) * (1.0 - smoothstep(top - 0.25, top, h) * 0.6);
          float edge = pow(1.0 - abs(dot(vN, vV)), 2.0); // brighter where seen edge-on: a volume of light
          float scan = 0.75 + 0.25 * sin(vP.y * 40.0 - uTime * 6.0);
          vec3 c = mix(vec3(0.55, 0.85, 1.0), vec3(0.75, 0.55, 1.0), h);
          float a = (0.9 + edge * 2.2) * fall * scan * min(1.0, uOn * 3.0);
          gl_FragColor = vec4(c * a * 2.4, min(1.0, a));
        }`,
    }),
  );
  beam.position.y = H / 2 + 0.045;
  chip.add(beam);
  // where it stands on the lid, the whole silver square lights up
  const beamFoot = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.78, BODY * 0.78), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: beamU,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uOn, uTime; varying vec2 vUv;
      void main(){ vec2 d = abs(vUv - 0.5) * 2.0; float sq = 1.0 - smoothstep(0.8, 1.0, max(d.x, d.y));
        float a = sq * (1.6 + 0.3 * sin(uTime * 9.0)) * min(1.0, uOn * 2.0);
        gl_FragColor = vec4(vec3(0.75, 0.92, 1.0) * a * 2.0, min(1.0, a)); }`,
  }));
  beamFoot.rotation.x = -Math.PI / 2;
  beamFoot.position.y = H / 2 + 0.05;
  chip.add(beamFoot);

  const launches = slots.map((at, k) => {
    /* out of the beam: first straight up off the lid inside the column of light, stacked with the
       others; then each breaks out of it on its own curve to where it settles */
    const top = new THREE.Vector3(0, 0, 3.4 + k * 0.35);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.35), new THREE.Vector3(0, 0, 1.8 + k * 0.18), top,
      new THREE.Vector3(at.x * 0.45, at.y * 0.55, (top.z + at.z) * 0.55), at.clone(),
    ], false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 80, 0.022, 6, false);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uTime, uLaunch: { value: 0 }, uDim: { value: 1 }, uSeed: { value: k * 0.37 } },
      vertexShader: /* glsl */ `varying float vT; void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLaunch, uDim, uSeed; varying float vT;
        void main(){
          // drawn out behind the screen as it flies; a hot head where it is, a faint trail behind
          if (vT > uLaunch + 0.002 || uLaunch <= 0.001) discard;
          float head = exp(-(uLaunch - vT) * 14.0) * (1.0 - smoothstep(0.95, 1.0, uLaunch));
          float pulse = pow(fract(vT * 1.5 - uTime * 0.45 + uSeed), 18.0) * smoothstep(0.9, 1.0, uLaunch);
          vec3 c = mix(vec3(0.3, 0.88, 1.0), vec3(0.72, 0.42, 1.0), vT);
          float a = (0.16 + head * 2.2 + pulse * 1.4) * mix(0.25, 1.0, smoothstep(0.0, 0.15, vT));
          gl_FragColor = vec4(c * a * uDim, a * uDim);
        }`,
    });
    scene.add(new THREE.Mesh(geo, mat));
    return { curve, mat, t: 0 };
  });

  /* ================= what else it runs: the capabilities beyond the featured work =================
     Small, dim tags on a bus above the chip, each tied back to it by a thin line. They are not work
     to visit: they say the four screens are examples, not the whole of it. */
  const CAPS: [string, string][] = [['Voice AI', 'C1'], ['Workflow Automation', 'C2'], ['Document Processing', 'C3'], ['Custom AI Solutions', 'C4']];
  const caps = CAPS.map(([name, code], c) => {
    const at = new THREE.Vector3((c - 1.5) * 2.75, 4.55 + (c % 2) * 0.32, -4.2);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3 / 4),
      new THREE.MeshBasicMaterial({ map: capabilityTexture(name, code), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    tag.position.copy(at);
    scene.add(tag);
    // its line back to the chip: up out of the top edge and over
    const from = new THREE.Vector3((c - 1.5) * 0.45, BODY / 2 + 0.3, -0.2);
    const curve = new THREE.CubicBezierCurve3(from, from.clone().add(new THREE.Vector3(0, 1.6, -0.6)), at.clone().add(new THREE.Vector3(0, -1.6, 0.4)), at.clone().add(new THREE.Vector3(0, -0.3, 0)));
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.008, 4, false),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uTime, uOn: { value: 0 }, uSeed: { value: c * 0.29 } },
        vertexShader: /* glsl */ `varying float vT; void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uOn, uSeed; varying float vT;
          void main(){
            if (vT > uOn * 1.02) discard;
            float dash = step(0.5, fract(vT * 26.0 - uTime * 0.6));
            float pulse = pow(fract(vT - uTime * 0.3 + uSeed), 20.0);
            float a = (0.08 + 0.1 * dash + pulse * 0.8) * uOn;
            gl_FragColor = vec4(vec3(0.45, 0.9, 1.0) * a, a);
          }`,
      }),
    );
    scene.add(line);
    return { tag, tagMat: tag.material as THREE.MeshBasicMaterial, lineMat: line.material as THREE.ShaderMaterial, delay: c * 0.07 };
  });

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
  const key = new THREE.DirectionalLight('#fff4e8', 1.05);
  key.position.set(3, 4, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.5;
  key.shadow.camera.right = key.shadow.camera.top = 2.5;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key);
  // its shadow, cast back onto the dark behind it: there is nothing there but the shadow
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.55 }));
  catcher.position.set(0, 0, -0.75);
  catcher.receiveShadow = true;
  scene.add(catcher);
  // a cool fill from below, so the ceramic's edges and the leads' undersides read
  const fill = new THREE.DirectionalLight('#9fb8ff', 0.35);
  fill.position.set(-4, -3, 3);
  scene.add(fill);
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
  // between two projects the whole picture loses the signal: rows tear, the channels split, blocks jump
  const glitchPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uSeed: { value: 0 }, uWhite: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float uAmt, uSeed, uWhite; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        if (uAmt > 0.001) {
          float row = floor(uv.y * 48.0);
          uv.x += step(0.7, h(vec2(row, 1.0))) * (h(vec2(row, 2.0)) - 0.5) * 0.18 * uAmt;
          vec2 blk = floor(uv * vec2(16.0, 9.0));
          uv += step(0.9, h(blk)) * (vec2(h(blk + 3.0), h(blk + 5.0)) - 0.5) * 0.08 * uAmt;
        }
        float ca = 0.012 * uAmt;
        vec4 c = vec4(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b, 1.0);
        c.rgb *= 1.0 - 0.25 * uAmt * step(0.5, fract(vUv.y * 220.0));
        c.rgb += vec3(0.3, 0.9, 1.0) * step(0.985, h(vec2(floor(vUv.y * 90.0), 9.0))) * uAmt * 0.4;
        // into the light: the frame burns out to a cool white
        c.rgb = mix(c.rgb, vec3(0.92, 0.97, 1.0) * 1.6, uWhite);
        gl_FragColor = c;
      }`,
  });
  composer.addPass(glitchPass);
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
    // a little from below and to one side, so the beam off the chip reads as a column, not a square
    { pos: new THREE.Vector3(1.8, -3.2, 21.5), look: new THREE.Vector3(0, 0, -1.5) },
    // each screen in the middle, close enough that what's written on it reads
    // the pages come to the camera: it holds on the chip and its beam while they do
    ...slots.map(() => ({ pos: new THREE.Vector3(1.4, -2.4, 17), look: new THREE.Vector3(0, 0, -0.5) })),
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
  let wired = 0, capOn = 0, wasPast = false;
  const fillAt = new THREE.Vector3(), beamA = new THREE.Vector3(), beamB = new THREE.Vector3();
  const tmpExit = new THREE.Vector3(), tmpExit2 = new THREE.Vector3(), camFwd = new THREE.Vector3();
  const corner = new THREE.Vector3();

  return {
    scene,
    camera,
    resize,
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    /** Off screen: the films on its pages stop. */
    sleep(time: number) { panels.forEach((pn) => pn.live?.tick(time, false)); },
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      const q = Math.min(1, Math.max(0, p));
      // which two stops we're between, eased so the camera holds at each
      let i = 0;
      while (i < AI_STOPS.length - 1 && q > AI_STOPS[i + 1]) i++;
      const j = Math.min(AI_STOPS.length - 1, i + 1);
      const f = j === i ? 0 : smooth(0.25, 0.75, (q - AI_STOPS[i]) / (AI_STOPS[j] - AI_STOPS[i]));
      // from one project to the next the picture glitches: hardest in the middle of the move
      const travelGlitch = i >= 2 && j !== i ? Math.pow(Math.sin(Math.PI * f), 0.6) : 0;
      glitchPass.uniforms.uAmt.value = travelGlitch * 0.9;
      if (travelGlitch > 0.01 && Math.random() < 0.35) glitchPass.uniforms.uSeed.value = Math.random() * 90;
      tgtPos.lerpVectors(poses[i].pos, poses[j].pos, f);
      tgtLook.lerpVectors(poses[i].look, poses[j].look, f);
      /* the way out, past the last stop (signals.ai.exit):
         0 the network hands the work over — back to the whole board, it fires, the screens break into particles
         1 out through the chip — into the Dizrupt mark, the reverse of the dive in
         2 the screens become the cards — they fly out at the camera one after another
         3 a plain hand-back — nothing here; the glitch itself is a different one */
      const xp = smooth(AI_EXIT_FROM, 0.97, q);
      const ex = signals.ai.exit;
      if (xp > 0) {
        if (ex === 0 || ex === 2) {
          const w = smooth(0, 0.3, xp);
          tgtPos.lerp(poses[1].pos, w);
          tgtLook.lerp(poses[1].look, w);
        } else if (ex === 1) {
          const w = smooth(0, 1, xp);
          tgtPos.lerp(tmpExit.set(0, 0, 0.9), w);
          tgtLook.lerp(tmpExit2.set(0, 0, 0), w);
        }
      }
      const reach = tgtPos.length() * 0.05;
      tgtPos.x += Math.sin(time * 0.15) * reach * 0.4 + px * (0.2 + reach);
      tgtPos.y += py * (0.1 + reach * 0.5);
      /* overview → page 1: straight into the beam's light, down on to the lid, until the frame burns
         white; page 1 comes up out of the white, and the camera is quietly back at the page view */
      const intoLight = i === 1 && j === 2 ? f : 0;
      const dive = smooth(0, 0.58, intoLight);
      if (intoLight > 0 && intoLight < 0.6) {
        tgtPos.lerpVectors(poses[1].pos, tmpExit.set(0, 0, 1.1), dive * dive);
        tgtLook.lerpVectors(poses[1].look, tmpExit2.set(0, 0, 0), dive);
      }
      const snap = (intoLight >= 0.6) !== wasPast;
      wasPast = intoLight >= 0.6;
      glitchPass.uniforms.uWhite.value = smooth(0.25, 0.58, intoLight) * (1 - smooth(0.6, 0.92, intoLight));
      const k = first || snap ? 1 : 1 - Math.exp(-3.2 * dt);
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
      // exit 0: every network fires at once, then the screens break up into particles that stream out
      const fire = ex === 0 ? smooth(0.25, 0.45, xp) * (1 - smooth(0.75, 1, xp)) : 0;
      const dissolve = ex === 0 ? smooth(0.4, 0.8, xp) : 0;
      burst.pts.visible = dissolve > 0.001;
      burst.mat.uniforms.uT.value = smooth(0.4, 1, xp);
      camera.getWorldDirection(camFwd);
      const focus = f < 0.5 ? i - 2 : j - 2; // the screen being visited, if any
      // which page is up: the first comes out of the beam on the way from the overview (stop 1 → 2)
      const emerge = i >= 2 ? 1 : i === 1 && j === 2 && f >= 0.6 ? 1 : 0;
      const curPage = i >= 2 ? Math.min(panels.length - 1, f < 0.5 ? i - 2 : j - 2) : i === 1 && j === 2 && f >= 0.6 ? 0 : -1;
      const pageMode = i >= 2 ? 1 : i === 1 && j === 2 ? f : 0;
      const tanFov = 2 * Math.tan((camera.fov * Math.PI) / 360);
      // the whole page across the screen: its width fills the frame, nothing of it cropped
      const fillD = (PW / (tanFov * camera.aspect)) * 1.02;
      panels.forEach((pn, k2) => {
        /* One page at a time, filling the screen. The first comes up out of the beam as the scroll
           leaves the overview: small inside the column of light at the lid, rising up it, then out to
           the camera until it fills the frame. After that, each scroll glitches it out into the next. */
        const shown = k2 === curPage;
        const em = k2 === 0 ? emerge : shown ? 1 : 0;
        // page 1 builds out of the white as it clears
        const on = k2 === 0 && i === 1 ? smooth(0.6, 0.9, f) : shown ? 1 : 0;
        pn.mat.uniforms.uOn.value = on;
        pn.live?.tick(time, shown && on > 0.5);
        pn.group.visible = shown && em > 0.001;
        const keep = 1 - (ex === 0 ? smooth(0.5, 0.85, xp) : 0);
        pn.edgeMat.opacity = (shown ? 1 : 0) * keep;
        pn.frameMat.opacity = (shown ? smooth(0.2, 0.6, em) : 0) * keep;
        pn.plateMat.opacity = 0;
        launches[k2].mat.uniforms.uLaunch.value = 0;
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
        // and between two projects: the one being left glitches out, the next one glitches in
        const leaving = (i - 2 === k2 || j - 2 === k2) && i >= 2 && j !== i ? travelGlitch : 0;
        // up full screen its own idle faults are only a flicker; the heavy glitch is for changing page
        pn.mat.uniforms.uGlitch.value = Math.max(glitching ? 0.22 * gb.strength * (Math.floor(time * 20) % 3 === 1 ? 0.6 : 1) : 0, leaving);
        if (!(ex === 2 && xp > 0)) {
          // full screen: square to the camera, at the distance where it covers the frame both ways
          fillAt.copy(camera.position).addScaledVector(camFwd, fillD);
          if (em >= 1) {
            pn.group.position.copy(fillAt);
            pn.group.quaternion.copy(camera.quaternion);
            pn.group.scale.setScalar(1);
          } else {
            // up the beam off the lid, then out to the camera
            chipRoot.updateMatrixWorld();
            beamA.set(0, 0, 0.4); beamB.set(0, 0, 4.2);
            if (em < 0.4) pn.group.position.lerpVectors(beamA, beamB, em / 0.4);
            else pn.group.position.lerpVectors(beamB, fillAt, 1 - Math.pow(1 - (em - 0.4) / 0.6, 2.4));
            pn.group.quaternion.identity().slerp(camera.quaternion, smooth(0.3, 1, em));
            pn.group.scale.setScalar(em < 0.4 ? 0.12 : 0.12 + 0.88 * smooth(0.4, 1, em));
          }
          if (glitching) pn.group.position.x += (Math.random() - 0.5) * 0.04 * gb.strength;
        }
        // its clouds, when the camera has come in close to it: links grow out, then the clouds build
        const close = ((i - 2 === k2 ? 1 - f : 0) + (j - 2 === k2 && j !== i ? f : 0)) * (1 - smooth(0, 0.2, xp));
        void close;
        pn.cloudOn = 0;
        pn.cloudU.uReveal.value = Math.min(1, pn.cloudOn * 1.7);
        // while its thoughts are up, the network feeding it steps back so the clouds read clean
        nets[k2].edgeMat.uniforms.uDim.value = nets[k2].nodeMat.uniforms.uDim.value = (1 - pageMode) * (1 + fire * 2.5);
        launches[k2].mat.uniforms.uDim.value = 0;
        pn.mat.uniforms.uDissolve.value = dissolve;
        // exit 2: each screen flies out at the camera in turn, the last filling the frame
        if (ex === 2 && xp > 0) {
          // each flies up to fill the frame; all but the last then swing away, and the last one stays
          const t0 = 0.08 + k2 * 0.2;
          const t = smooth(t0, t0 + 0.22, xp);
          const away = k2 < panels.length - 1 ? smooth(t0 + 0.22, t0 + 0.34, xp) : 0;
          const fill = PW / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * 1.02; // distance where it fills the width
          tmpExit.copy(camera.position).addScaledVector(camFwd, fill);
          tmpExit.x += (k2 % 2 ? 1 : -1) * away * 9;
          pn.group.position.lerpVectors(slots[k2], tmpExit, t);
          pn.group.rotation.set(0, -Math.sign(slots[k2].x) * 0.22 * (1 - t) + (k2 % 2 ? -1 : 1) * away * 0.6, Math.sin(t * Math.PI) * (k2 % 2 ? 0.25 : -0.25));
          pn.group.renderOrder = Math.round(t * 10) + k2;
        }
        // the callouts float at their own depths, tilted in towards the window, and drift with the cursor
        pn.clouds.forEach((cl, ci) => {
          const o = Math.sign(slots[k2].x);
          cl.mesh.rotation.y = -o * 0.28 + px * 0.12;
          cl.mesh.rotation.x = -py * 0.1 + (ci - 1) * 0.06;
          cl.mesh.position.z = 0.4 + ci * 0.18 + Math.sin(time * 0.8 + ci) * 0.05;
        });
        pn.clouds.forEach((cl, ci) => (cl.mat.uniforms.uOn.value = Math.min(1, Math.max(0, (pn.cloudOn - 0.35 - ci * 0.08) / 0.5))));
        pn.mat.uniforms.uFocus.value += ((k2 === focus ? 1 : 0) - pn.mat.uniforms.uFocus.value) * Math.min(1, dt * 4);
      });

      // the capabilities: up on the whole board, once everything is launched; away when visiting a project
      const board = ((i === 1 ? 1 - f : 0) + (j === 1 && j !== i ? f : 0)) * (1 - smooth(0, 0.3, xp));
      const landed = launches.every((l, k3) => l.t - k3 * 0.22 > 0.98);
      capOn += ((landed ? board : 0) - capOn) * Math.min(1, dt * 2.4);
      caps.forEach((c) => {
        const v = Math.min(1, Math.max(0, (capOn - c.delay) / 0.6));
        c.tagMat.opacity = v * 0.85;
        c.lineMat.uniforms.uOn.value = v;
        c.tag.visible = v > 0.001;
        c.tag.position.y += (Math.sin(time * 0.7 + c.delay * 20) * 0.0015);
      });

      // the chip floats and turns on its own, then holds still once it's wired in
      const free = 1 - smooth(0.0, 0.25, wired);
      chipRoot.position.set(0, Math.sin(time * 0.9) * 0.06 * free, 0);
      chipRoot.rotation.set(Math.sin(time * 0.5) * 0.35 * free - 0.3 * free, Math.sin(time * 0.37) * 0.5 * free + 0.4 * free, Math.sin(time * 0.29) * 0.08 * free);
      // the beam: up as the pages launch, down once they have all landed (or fallen back in)
      const beaming = q > AI_STOPS[1] * 0.6 && xp < 0.4;
      beamU.uOn.value += ((beaming ? 1 : 0) - beamU.uOn.value) * Math.min(1, dt * (beaming ? 2.5 : 1.4));
      beam.visible = beamFoot.visible = beamU.uOn.value > 0.002;
      const bt = beatAt(time % 1);
      // lasered into the ceramic and lit from within: a restrained glow that beats, not a lamp
      markMat.emissiveIntensity = 0.18 + bt * 0.4;
      markGlowMat.opacity = 0.02 + bt * 0.07 + (ex === 1 ? smooth(0.5, 1, xp) * 0.8 : 0);
      dust.rotation.y = time * 0.01;

      // the screen being visited: where it is on screen, for its click target
      const out = signals.aiPanel;
      out.on = xp <= 0 && focus >= 0 && focus < panels.length && Math.abs(f - 0.5) > 0.35 && panels[focus].mat.uniforms.uOn.value > 0.95;
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
