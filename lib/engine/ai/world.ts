import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { signals } from '@/lib/signals';
import { applyFrame } from '../frame';
import { isMobile } from '../config';

const REST = { lift: 0, shift: 0, zoom: 1 };

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   Out of the hand-over comes a microcontroller, floating on its
   own in the dark: a black LQFP package, gull-wing leads down
   every side, the Dizrupt mark glowing in it, beating. Then the
   scroll powers it up: a pulse of light leaves it, circuit traces
   light up from every pin and run out across the dark, and the
   camera pulls back until it is the hub of a network. From there
   the page (components/home/ai) carries the network on: the
   business it runs, drawn over this.

   World frame: the chip at the origin, its face towards +z.
   ========================================================= */

// kept apart from the engine so the page's scroll can read them without loading three.js
import { AI_STOPS, AI_EXIT_FROM, AI_WORLD } from '@/lib/aiStops';
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


/* Metal can't outshine the neon: its highlight is held under the bloom's threshold, so the leads and
   the lid keep a metal sheen as the chip turns but never flare into a white halo. */
/** The underside, as a processor's back is: a green laminate substrate covered edge to edge in gold
    contact pads, a bare dark field in the middle where the small components sit (those are real
    geometry, built beside it). Returns its colour, roughness+metalness (green: roughness, blue:
    metalness) and bump maps. `inner` is the bare field's width as a share of the whole. */
function packageBack(inner: number) {
  const S = 1024;
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const; };
  const [col, g] = make(), [orm, o] = make(), [bmp, b] = make();
  const rand = rng(41);
  // the laminate: a deep solder-mask green, faintly mottled, glossy and not metal
  g.fillStyle = '#2a4a1f'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '120,170,140' : '0,10,6'},${0.02 + rand() * 0.04})`; g.fillRect(rand() * S, rand() * S, 2 + rand() * 30, 2 + rand() * 30); }
  o.fillStyle = 'rgb(0,90,0)'; o.fillRect(0, 0, S, S);
  b.fillStyle = '#7a7a7a'; b.fillRect(0, 0, S, S);
  // a pale edge where the board is cut, as the photos show it
  g.strokeStyle = 'rgba(190,210,170,0.55)'; g.lineWidth = 6; g.strokeRect(3, 3, S - 6, S - 6);
  // the bare field in the middle: darker, almost black-green, matte
  const f0 = (S * (1 - inner)) / 2, f1 = S - f0;
  g.fillStyle = '#16251a'; g.fillRect(f0, f0, f1 - f0, f1 - f0);
  o.fillStyle = 'rgb(0,150,0)'; o.fillRect(f0, f0, f1 - f0, f1 - f0);
  b.fillStyle = '#6e6e6e'; b.fillRect(f0, f0, f1 - f0, f1 - f0);
  // the pads: a tight grid of gold dots over the rest, each a little raised and bright metal
  const n = 34, step = (S - 40) / n, r0 = step * 0.4;
  const pads: [number, number][] = []; // each pad's centre, 0..1 across the face: a pin stands on each
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cx = 20 + (x + 0.5) * step, cy = 20 + (y + 0.5) * step;
    if (cx > f0 - step * 0.6 && cx < f1 + step * 0.6 && cy > f0 - step * 0.6 && cy < f1 + step * 0.6) continue;
    pads.push([cx / S, cy / S]);
    const gr = g.createRadialGradient(cx - r0 * 0.3, cy - r0 * 0.3, r0 * 0.1, cx, cy, r0);
    gr.addColorStop(0, '#ffe7a0'); gr.addColorStop(0.55, '#d8a845'); gr.addColorStop(1, '#9a7028');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r0, 0, 7); g.fill();
    o.fillStyle = 'rgb(0,70,255)'; o.beginPath(); o.arc(cx, cy, r0, 0, 7); o.fill();
    b.fillStyle = '#a8a8a8'; b.beginPath(); b.arc(cx, cy, r0, 0, 7); b.fill();
  }
  // a fine silkscreen frame round the field, and a small triangle for pin 1
  g.strokeStyle = 'rgba(210,225,205,0.4)'; g.lineWidth = 2; g.strokeRect(f0 + 10, f0 + 10, f1 - f0 - 20, f1 - f0 - 20);
  g.fillStyle = 'rgba(210,225,205,0.55)'; g.beginPath(); g.moveTo(f0 + 22, f1 - 22); g.lineTo(f0 + 50, f1 - 22); g.lineTo(f0 + 22, f1 - 50); g.closePath(); g.fill();
  const tex = (c: HTMLCanvasElement, srgb = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(col, true), orm: tex(orm), bump: tex(bmp), pads };
}

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
  /* the back: turn it over and it's a processor's underside — gold contact pads across a green
     substrate, and in the bare field at its centre a cluster of small capacitors standing proud */
  {
    const INNER = 0.36;
    const back = packageBack(INNER);
    const backMat = capped(new THREE.MeshPhysicalMaterial({
      color: '#ffffff', map: back.map, roughness: 1, roughnessMap: back.orm, metalness: 1, metalnessMap: back.orm,
      bumpMap: back.bump, bumpScale: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.9,
    }), 0.85);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(BODY - 0.02, BODY - 0.02), backMat);
    plate.rotation.x = Math.PI / 2; // facing down, out of the back
    plate.position.y = -H / 2 - 0.002;
    plate.receiveShadow = true;
    chip.add(plate);
    /* the pins: a gold pin standing out of every pad, as a socketed processor's are, each a slim
       shaft with a rounded tip; one instanced mesh for all of them */
    {
      const PIN_L = 0.11, PIN_R = 0.0085, side = BODY - 0.02;
      const shaft = new THREE.CylinderGeometry(PIN_R, PIN_R, PIN_L, 8, 1, true);
      shaft.translate(0, -PIN_L / 2, 0);
      const tip = new THREE.SphereGeometry(PIN_R, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      tip.translate(0, -PIN_L, 0);
      const foot = new THREE.CylinderGeometry(PIN_R * 1.9, PIN_R * 2.3, 0.008, 10);
      foot.translate(0, -0.004, 0);
      const pinGeo = mergeGeometries([shaft, tip, foot].map((g) => g.toNonIndexed()));
      const gold = capped(new THREE.MeshPhysicalMaterial({ color: '#d9a94a', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 }), 0.85);
      const pins = new THREE.InstancedMesh(pinGeo, gold, back.pads.length);
      const pm = new THREE.Matrix4();
      back.pads.forEach(([u, v], i) => pins.setMatrixAt(i, pm.makeTranslation((u - 0.5) * side, -H / 2 - 0.002, (v - 0.5) * side)));
      pins.castShadow = true;
      chip.add(pins);
    }
    // the capacitors: tan ceramic bodies with silver ends, in rows, a few larger ones and a few turned
    const capBody = new THREE.MeshPhysicalMaterial({ color: '#8f7c63', roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    const field = BODY * INNER * 0.86, rand = rng(5);
    const caps: { x: number; z: number; w: number; d: number; h: number; turn: boolean }[] = [];
    const cols = 6, rows = 5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rand() < 0.14) continue;
      const big = rand() < 0.18, turn = rand() < 0.25;
      caps.push({
        x: -field / 2 + (c + 0.5) * (field / cols) + (rand() - 0.5) * 0.012,
        z: -field / 2 + (r + 0.5) * (field / rows) + (rand() - 0.5) * 0.012,
        w: big ? 0.085 : 0.062, d: big ? 0.055 : 0.038, h: big ? 0.05 : 0.034, turn,
      });
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const bodies = new THREE.InstancedMesh(box, capBody, caps.length);
    const ends = new THREE.InstancedMesh(box, tin, caps.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), yAx = new THREE.Vector3(0, 1, 0);
    caps.forEach((cp, i) => {
      q.setFromAxisAngle(yAx, cp.turn ? Math.PI / 2 : 0);
      const y = -H / 2 - cp.h / 2 - 0.002;
      bodies.setMatrixAt(i, m4.compose(p.set(cp.x, y, cp.z), q, sc.set(cp.w * 0.62, cp.h, cp.d)));
      for (const sgn of [-1, 1]) {
        const off = new THREE.Vector3(sgn * cp.w * 0.4, 0, 0).applyQuaternion(q);
        ends.setMatrixAt(i * 2 + (sgn > 0 ? 1 : 0), m4.compose(p.set(cp.x + off.x, y, cp.z + off.z), q, sc.set(cp.w * 0.2, cp.h * 1.04, cp.d * 1.04)));
      }
    });
    bodies.castShadow = ends.castShadow = true;
    chip.add(bodies, ends);
  }
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
  mark.position.set(0, H / 2 + LH - 0.001, 0); // in the middle of the lid: the only marking on it
  chip.add(mark);
  const markGlowMat = new THREE.MeshBasicMaterial({ map: markTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const markGlow = new THREE.Mesh(new THREE.PlaneGeometry(BODY * 0.52, BODY * 0.52), markGlowMat);
  markGlow.rotation.x = -Math.PI / 2;
  markGlow.position.set(0, H / 2 + LH + 0.001, 0);
  chip.add(markGlow);


  /* ================= powering up: a pulse, then the traces =================
     On the board behind the chip, a trace runs out of every one of its 64 pins: straight out, a 45°
     fan so the side's traces spread without crossing, then long and straight into the dark. They
     light up from the pins outwards as the chip powers on; after that, data keeps running out
     along them. A via sits at the end of each, where the page's own network picks up. */
  const traces = (() => {
    const geos: THREE.BufferGeometry[] = [];
    const ends: number[] = [], endD: number[] = [];
    const rand = rng(17);
    const Z = -0.21, FOOT = BODY / 2 + 0.36, MAXLEN = 14;
    const dirs = [new THREE.Vector2(1, 0), new THREE.Vector2(-1, 0), new THREE.Vector2(0, 1), new THREE.Vector2(0, -1)];
    dirs.forEach((d, side) => {
      const perp = new THREE.Vector2(-d.y, d.x);
      const run1 = 0.35 + side * 0.04, fan = 1.6;
      for (let i = 0; i < N_PIN; i++) {
        const t = (i - (N_PIN - 1) / 2) * PITCH;
        const a = d.clone().multiplyScalar(FOOT).addScaledVector(perp, t);
        const b = a.clone().addScaledVector(d, run1);
        // the fan: out and sideways at 45°, further the further the pin is from the middle
        const c = b.clone().addScaledVector(d, Math.abs(t) * fan).addScaledVector(perp, t * fan);
        const len3 = 2.2 + rand() * 7.5 * (0.45 + 0.55 * Math.abs(d.x)); // longer across the wide screen
        const e = c.clone().addScaledVector(d, len3);
        const pts = [a, b, c, e].map((v) => new THREE.Vector3(v.x, v.y, Z));
        const path = new THREE.CurvePath<THREE.Vector3>();
        for (let k = 0; k < 3; k++) path.add(new THREE.LineCurve3(pts[k], pts[k + 1]));
        const len = path.getLength();
        const g = new THREE.TubeGeometry(path, 36, 0.011, 3, false);
        const n = g.attributes.position.count, uv = g.attributes.uv;
        const dist = new Float32Array(n), seed = new Float32Array(n).fill(rand());
        for (let v = 0; v < n; v++) dist[v] = (uv.getX(v) * len) / MAXLEN;
        g.setAttribute('aD', new THREE.BufferAttribute(dist, 1));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        g.deleteAttribute('normal');
        g.deleteAttribute('uv');
        geos.push(g);
        ends.push(e.x, e.y, Z);
        endD.push(len / MAXLEN);
      }
    });
    const u = { uTime, uReveal: { value: 0 }, uDim: { value: 1 }, uFire: { value: 0 }, uViewH: { value: innerHeight * pixelRatio } };
    const lineMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: u,
      vertexShader: /* glsl */ `attribute float aD; attribute float aSeed; varying float vD; varying float vSeed;
        void main(){ vD = aD; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uReveal, uDim, uFire; varying float vD; varying float vSeed;
        void main(){
          float front = uReveal * 1.15;
          if (vD > front || uReveal <= 0.001) discard;
          float head = exp(-(front - vD) * 30.0) * (1.0 - smoothstep(0.95, 1.15, front));   // the light running out
          float pulse = pow(fract(vD * 2.2 - uTime * (0.22 + vSeed * 0.2) + vSeed * 7.0), 22.0); // data, after
          vec3 c = mix(vec3(0.3, 0.86, 1.0), vec3(0.7, 0.42, 1.0), step(0.66, vSeed));
          float fade = 1.0 - smoothstep(0.35, 1.0, vD);                                       // into the dark
          float a = (0.16 + pulse * 1.3 * smoothstep(0.5, 1.0, uReveal) + head * 1.8 + uFire * 0.9) * mix(0.25, 1.0, fade);
          gl_FragColor = vec4(c * a * uDim, min(1.0, a * uDim));
        }`,
    });
    const lines = new THREE.Mesh(mergeGeometries(geos), lineMat);
    lines.frustumCulled = false;
    geos.forEach((g) => g.dispose());
    scene.add(lines);
    // the vias at their ends
    const viaGeo = new THREE.BufferGeometry();
    viaGeo.setAttribute('position', new THREE.Float32BufferAttribute(ends, 3));
    viaGeo.setAttribute('aD', new THREE.Float32BufferAttribute(endD, 1));
    const viaMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: u,
      vertexShader: /* glsl */ `attribute float aD; uniform float uReveal, uViewH; varying float vOn;
        void main(){ vOn = smoothstep(aD, aD + 0.05, uReveal * 1.15);
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = vOn * min(0.09 * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z, uViewH * 0.012); }`,
      fragmentShader: /* glsl */ `uniform float uDim; varying float vOn;
        void main(){ float d = length(gl_PointCoord - 0.5); if (vOn <= 0.0) discard;
          float ring = smoothstep(0.5, 0.36, d) * smoothstep(0.18, 0.3, d), core = smoothstep(0.16, 0.06, d);
          gl_FragColor = vec4(vec3(0.5, 0.92, 1.0) * (ring * 0.7 + core) * uDim * vOn, (ring * 0.7 + core) * uDim * vOn); }`,
    });
    const vias = new THREE.Points(viaGeo, viaMat);
    vias.frustumCulled = false;
    scene.add(vias);
    return { u };
  })();

  // the pulse: one ring of light leaves the chip as it powers on
  const pulseMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uT; varying vec2 vUv;
      void main(){
        if (uT <= 0.001 || uT >= 0.999) discard;
        float r = length(vUv - 0.5) * 2.0;           // 0 at the chip, 1 at the ring's full reach
        float at = uT;                                // where the wave front is
        float w = exp(-pow((r - at) / 0.035, 2.0)) + 0.35 * exp(-pow((r - at * 0.82) / 0.06, 2.0));
        float a = w * (1.0 - uT) * smoothstep(0.08, 0.16, r);
        gl_FragColor = vec4(vec3(0.62, 0.9, 1.0) * a * 1.6, a);
      }`,
  });
  const pulse = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), pulseMat);
  pulse.position.z = -0.25;
  scene.add(pulse);

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
  key.shadow.mapSize.setScalar(isMobile ? 512 : 1024);
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
  // (a phone goes without the multisampling: four samples a pixel, twice over, is ~100 MB it can't spare)
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // when the power surges the whole picture loses the signal: rows tear, the channels split, blocks jump
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

  /* ================= the camera: up close, then pulled back to the network ================= */
  const poses = [
    { pos: new THREE.Vector3(1.1, 0.7, 8.6), look: new THREE.Vector3(0, 0, 0) }, // the chip, close (clear of the nav and the captions)
    { pos: new THREE.Vector3(0.6, -1.4, 17), look: new THREE.Vector3(0, 0, 0) }, // powered on: the traces
    { pos: new THREE.Vector3(0, -1.2, 30), look: new THREE.Vector3(0, 0, 0) }, // the hub of it all
  ];
  const away = new THREE.Vector3(0, -0.8, 46); // leaving: further back still, as the hand-back runs
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
  let first = true;

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 58 : 32; // a phone needs the wider lens
    camera.updateProjectionMatrix();
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    traces.u.uViewH.value = innerHeight * pixelRatio;
  };
  resize();

  const smooth = (a: number, b: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  const { wire: WIRE, chaos: CHAOS, order: ORDER, sortFrom: SORT, asideFrom: ASIDE0, asideTo: ASIDE1 } = AI_WORLD;
  const centre = new THREE.Vector3(), edge = new THREE.Vector3();
  // the pointer's own turn of the chip, on top of its float: dragged, it spins and carries on a little
  // when let go; left alone a moment, it eases back the shortest way round into its float
  const grab = { x: 0, y: 0, vx: 0, vy: 0 };
  const wrap = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

  return {
    scene,
    camera,
    bloom,
    resize,
    /** Off screen: nothing runs on its own here. */
    sleep() {},
    /** Gone for good (a phone frees it once the page is well past it): everything it put on the GPU. */
    dispose() {
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
          const uni = (mat as THREE.ShaderMaterial).uniforms;
          if (uni) for (const u of Object.values(uni)) if (u.value instanceof THREE.Texture) textures.add(u.value);
          mat.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      scene.environment?.dispose();
      key.dispose(); // (its shadow map)
      bloom.dispose();
      composer.dispose();
      rt.dispose();
    },
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      const q = Math.min(1, Math.max(0, p));
      // powering on: from the very start of the scroll out of the chip's beat (the ring of light leaves
      // it almost at once), done by a third of the way to what we do, at the same pace as ever
      const act = smooth(WIRE * 0.06, WIRE * 0.6, q);
      const back = smooth(WIRE, CHAOS, q); // then the pull back to the whole network
      const xp = smooth(AI_EXIT_FROM, 0.97, q);
      tgtPos.lerpVectors(poses[0].pos, poses[1].pos, act).lerp(poses[2].pos, back).lerp(away, xp);
      tgtLook.lerpVectors(poses[0].look, poses[1].look, act).lerp(poses[2].look, back);
      /* for the method and the statement the camera pans, so the core and its network slide aside and
         leave the text clear: to 70% across on a wide screen (the text is on the left). A phone keeps
         the text below instead, and the page fits the picture into the room above it (signals.frame) */
      const aside = smooth(ASIDE0, ASIDE1, q) * (1 - xp);
      const half = poses[2].pos.z * Math.tan((camera.fov * Math.PI) / 360); // half the height in view, at the hub
      if (camera.aspect >= 1) { const d = 0.4 * half * camera.aspect * aside; tgtPos.x -= d; tgtLook.x -= d; }
      // the cursor moves it a little, less once it is the hub the page's network hangs off
      const sway = 1 - 0.75 * back;
      tgtPos.x += (Math.sin(time * 0.15) * 0.25 + px * 0.6) * sway;
      tgtPos.y += py * 0.3 * sway;
      const k = first ? 1 : 1 - Math.exp(-3.2 * dt);
      first = false;
      pos.lerp(tgtPos, k);
      look.lerp(tgtLook, k);
      camera.position.copy(pos);
      camera.lookAt(look);

      // the pulse leaves as it powers on, the traces light up behind it
      pulseMat.uniforms.uT.value = smooth(0.08, 0.75, act);
      traces.u.uReveal.value = smooth(0.18, 1, act);
      // they step back while the page's own picture is up over them, and fire as it hands back
      traces.u.uDim.value = 1 - 0.5 * smooth(WIRE, CHAOS, q) - 0.2 * smooth(CHAOS, ORDER, q);
      traces.u.uFire.value = Math.sin(Math.PI * xp);
      // a controlled fault as the power comes up, and a flicker as the chaos is put in order
      const surge = Math.exp(-Math.pow((act - 0.42) / 0.07, 2));
      const sort = Math.sin(Math.PI * smooth(SORT, ORDER, q)) * (q > SORT && q < ORDER ? 1 : 0);
      const fault = Math.max(surge * 0.5, sort * 0.06, xp > 0 && xp < 1 ? 0.2 * Math.sin(Math.PI * xp) : 0);
      glitchPass.uniforms.uAmt.value = fault;
      if (fault > 0.02 && Math.random() < 0.35) glitchPass.uniforms.uSeed.value = Math.random() * 90;
      glitchPass.uniforms.uWhite.value = 0;

      // the chip floats and turns on its own, then holds still, square on, once it is powered
      const free = 1 - smooth(0, 0.55, act);
      chipRoot.position.set(0, Math.sin(time * 0.9) * 0.06 * free, 0);
      chipRoot.rotation.set(Math.sin(time * 0.5) * 0.35 * free - 0.3 * free, Math.sin(time * 0.37) * 0.5 * free + 0.4 * free, Math.sin(time * 0.29) * 0.08 * free);
      {
        const g = signals.aiGrab, step = Math.max(dt, 1 / 240);
        if (g.dx || g.dy) {
          const kx = g.dy * 0.009, ky = g.dx * 0.009;
          grab.x += kx; grab.y += ky;
          grab.vx = kx / step; grab.vy = ky / step;
          g.dx = g.dy = 0;
        } else if (g.down) {
          grab.vx = grab.vy = 0; // held still
        } else {
          grab.x += grab.vx * dt; grab.y += grab.vy * dt;
          const f = Math.exp(-3.5 * dt);
          grab.vx *= f; grab.vy *= f;
        }
        if (!g.down && performance.now() - g.at > 900) {
          const r = Math.exp(-2.4 * dt);
          grab.x = wrap(grab.x) * r; grab.y = wrap(grab.y) * r;
        }
        chipRoot.rotation.x += grab.x * free;
        chipRoot.rotation.y += grab.y * free;
      }
      const bt = beatAt(time % 1);
      // lasered into the ceramic and lit from within: a restrained glow that beats, flaring as it powers on
      markMat.emissiveIntensity = 0.18 + bt * 0.4 + surge * 1.2;
      markGlowMat.opacity = 0.02 + bt * 0.07 + surge * 0.5 + 0.08 * act;
      rimC.intensity = 3 + 4 * act;
      dust.rotation.y = time * 0.01;

      applyFrame(camera, camera.aspect < 1 ? signals.frame.ai : REST);
      // where the chip is on screen: the page's network grows out of it
      centre.set(0, 0, 0).project(camera);
      edge.set(BODY / 2, 0, 0).project(camera);
      const out = signals.aiChip;
      out.x = (centre.x * 0.5 + 0.5) * innerWidth;
      out.y = (-centre.y * 0.5 + 0.5) * innerHeight;
      out.size = Math.abs(edge.x - centre.x) * innerWidth;

      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
  };
}
