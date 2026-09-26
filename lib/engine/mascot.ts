import * as THREE from 'three';
import { COUNT } from './config';
import { edgeField } from './edgeField';

/* The mascot, as two point clouds with identical surface coordinates — neutral and flexed — so the
   bicep curl moves each particle with its own patch of skin. Upper body only: the files are the
   whole figure, so everything below BUST_CUT of his height is dropped, thinning out over BUST_FADE
   rather than ending on a flat line. What is kept is scaled to stand BUST_HEIGHT tall and centred
   across on his face. */
export const BUST_CUT = 0.82;
export const BUST_FADE = 0.055;
export const BUST_HEIGHT = 4.45;
export const BUST_TOP = 2.1; // where his crown sits, near the top of the frame
export const BUST_DROP = BUST_TOP - BUST_HEIGHT / 2;

export type MascotAttr = THREE.BufferAttribute & { edge?: THREE.BufferAttribute };
export type Mascot = {
  neutral: MascotAttr;
  flex: MascotAttr;
  full: MascotAttr; // head to toe, in the bust's own frame: its upper particles are the bust's own
  feet: number; // where his soles are, in that frame
  fullHead: Float32Array; // the head-turn weights for the full figure (its legs don't turn with the head)
  head: Float32Array; // per particle: how much the neck turn moves it
  pivot: THREE.Vector3; // the neck, in the figure's own space
};

const fract = (x: number) => x - Math.floor(x);

export async function loadMascot(base = ''): Promise<Mascot | null> {
  try {
    const [n, f, m] = await Promise.all([
      fetch(`${base}/mascot-neutral-claude.bin`),
      fetch(`${base}/mascot-flex-claude.bin`),
      fetch(`${base}/mascot-transition-claude.json`),
    ]);
    if (!n.ok || !f.ok || !m.ok) throw new Error('mascot files unavailable');
    const [neutralRaw, flexRaw, meta] = await Promise.all([
      n.arrayBuffer().then((b) => new Int16Array(b)),
      f.arrayBuffer().then((b) => new Int16Array(b)),
      m.json() as Promise<{ eyes?: number; pivot: [number, number, number] }>,
    ]);
    const available = (neutralRaw.length / 4) | 0; // x, y, z and the head channel
    if (!available || flexRaw.length !== neutralRaw.length) throw new Error('invalid paired mascot data');
    const eyeAvailable = Math.min(meta.eyes || 0, available);
    const bodyAvailable = available - eyeAvailable;

    // the file's own units, where the whole figure is exactly 1 tall
    const unit = (raw: number) => (raw * 0.75) / 32767;
    let low = Infinity;
    let high = -Infinity;
    for (let k = 0; k < bodyAvailable; k++) {
      const z = unit(neutralRaw[k * 4 + 2]);
      if (z < low) low = z;
      if (z > high) high = z;
    }
    const cut = low + (high - low) * BUST_CUT;
    const fade = (high - low) * BUST_FADE;
    // the same points every load: a hash of the index, not a random number
    const noise = (k: number) => fract(Math.sin(k * 12.9898) * 43758.5453);
    const kept: number[] = [];
    const below: number[] = [];
    for (let k = 0; k < bodyAvailable; k++) {
      const above = (unit(neutralRaw[k * 4 + 2]) - cut) / fade;
      if (above <= 0 || (above < 1 && noise(k) > above)) {
        below.push(k);
        continue;
      }
      kept.push(k);
    }
    if (!kept.length) throw new Error('nothing left of the figure above the cut');

    // centred across on his face (the samples the file marks as eyes), up and down on what is kept
    let faceX = 0;
    for (let k = bodyAvailable; k < available; k++) faceX += unit(neutralRaw[k * 4]);
    const acrossMid = eyeAvailable ? faceX / eyeAvailable : 0;
    const middle = (cut + high) / 2;
    const scale = BUST_HEIGHT / (high - cut);
    const sourceIndex = (i: number) => kept[Math.min(kept.length - 1, Math.floor((i * kept.length) / COUNT))];

    const head = new Float32Array(COUNT);
    const decode = (raw: Int16Array, writeHead = false): MascotAttr => {
      const arr = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const j = sourceIndex(i) * 4;
        arr[i * 3] = (unit(raw[j]) - acrossMid) * scale;
        arr[i * 3 + 1] = (unit(raw[j + 2]) - middle) * scale;
        arr[i * 3 + 2] = -unit(raw[j + 1]) * scale;
        if (writeHead) head[i] = Math.max(0, raw[j + 3] / 32767);
      }
      return new THREE.BufferAttribute(arr, 3);
    };
    const neutral = decode(neutralRaw, true);
    /* Head to toe. Most particles keep exactly the point they have in the bust, so when he gathers
       from the whole figure into the bust only the rest — his legs and hips — travel, flowing up into
       him; the face never moves. */
    const UPPER = 0.42;
    const full: MascotAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
    const farr = full.array as Float32Array;
    farr.set(neutral.array);
    const fullHead = new Float32Array(head);
    if (below.length) {
      for (let i = 0; i < COUNT; i++) {
        if (noise(i * 7 + 3) < UPPER) continue;
        fullHead[i] = 0;
        const j = below[Math.floor(noise(i * 13 + 5) * below.length)] * 4;
        farr[i * 3] = (unit(neutralRaw[j]) - acrossMid) * scale;
        farr[i * 3 + 1] = (unit(neutralRaw[j + 2]) - middle) * scale;
        farr[i * 3 + 2] = -unit(neutralRaw[j + 1]) * scale;
      }
    }
    full.edge = edgeField(farr);
    const feet = (low - middle) * scale;
    const flex = decode(flexRaw);
    neutral.edge = edgeField(neutral.array);
    flex.edge = edgeField(flex.array);
    const [px, py, pz] = meta.pivot;
    const pivot = new THREE.Vector3((px - acrossMid) * scale, (pz - middle) * scale, -py * scale);
    return { neutral, flex, full, feet, head, fullHead, pivot };
  } catch (err) {
    console.warn('mascot point cloud unavailable', err);
    return null;
  }
}
