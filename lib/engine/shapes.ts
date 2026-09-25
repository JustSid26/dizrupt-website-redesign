// @ts-nocheck — the shape library is ported verbatim from the original site; each builder fills a
// Float32Array of COUNT xyz points.
/* Particle shapes: every model the field can become. SHAPES[name](arr, opts?) writes COUNT points. */
import * as THREE from 'three';
import { COUNT, isMobile } from './config';

/* ---------- Particle shapes ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const out = new THREE.Vector3();

function put(arr, i, x, y, z, euler) {
  tmp.set(x, y, z);
  if (euler) tmp.applyEuler(euler);
  arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
}

// Centre a finished point cloud, scale its largest side to `size`, then rotate it.
function fit(arr, size, euler) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i++) {
    const k = i % 3;
    if (arr[i] < min[k]) min[k] = arr[i];
    if (arr[i] > max[k]) max[k] = arr[i];
  }
  const c = min.map((m, k) => (m + max[k]) / 2);
  const s = size / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    put(arr, i, (arr[i3] - c[0]) * s, (arr[i3 + 1] - c[1]) * s, (arr[i3 + 2] - c[2]) * s, euler);
  }
}

// Picks random points spread evenly over mesh surfaces, plus points along hard
// edges so outlines read crisply. A part is a BufferGeometry or { geo, weight, edges }.
function makeSampler(parts, edgeAngle = 25) {
  const tri = { src: [], off: [], cum: [], total: 0 };
  const seg = { src: [], off: [], cum: [], total: 0 };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();

  for (const part of parts) {
    const { geo, weight = 1, edges = true } = part.isBufferGeometry ? { geo: part } : part;
    const p = (geo.index ? geo.toNonIndexed() : geo).attributes.position.array;
    for (let i = 0; i < p.length; i += 9) {
      a.fromArray(p, i);
      b.fromArray(p, i + 3).sub(a);
      c.fromArray(p, i + 6).sub(a);
      const area = b.cross(c).length() * 0.5 * weight;
      if (area <= 0) continue;
      tri.total += area; tri.src.push(p); tri.off.push(i); tri.cum.push(tri.total);
    }
    if (!edges) continue;
    const e = new THREE.EdgesGeometry(geo, edgeAngle).attributes.position.array;
    for (let i = 0; i < e.length; i += 6) {
      seg.total += a.fromArray(e, i).distanceTo(b.fromArray(e, i + 3)) * weight;
      seg.src.push(e); seg.off.push(i); seg.cum.push(seg.total);
    }
  }

  const pick = (set) => {
    const r = Math.random() * set.total, cum = set.cum;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    return lo;
  };

  return (target, edgeShare = 0.3) => {
    if (seg.total > 0 && Math.random() < edgeShare) {
      const k = pick(seg), s = seg.src[k], o = seg.off[k];
      return target.fromArray(s, o).lerp(b.fromArray(s, o + 3), Math.random());
    }
    const k = pick(tri), s = tri.src[k], o = tri.off[k];
    const r1 = Math.sqrt(Math.random()), r2 = Math.random();
    target.fromArray(s, o).multiplyScalar(1 - r1);
    target.addScaledVector(b.fromArray(s, o + 3), r1 * (1 - r2));
    return target.addScaledVector(c.fromArray(s, o + 6), r1 * r2);
  };
}

function fromParts(arr, parts, { edgeShare = 0.3, size = 4.2, euler } = {}) {
  const sample = makeSampler(parts);
  for (let i = 0; i < COUNT; i++) {
    sample(out, edgeShare);
    arr[i * 3] = out.x; arr[i * 3 + 1] = out.y; arr[i * 3 + 2] = out.z;
  }
  fit(arr, size, euler);
}

// Building blocks for models
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (rTop, rBottom, h, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(rTop, rBottom, h, 24).translate(x, y, z);
const tube = (pts, radius, weight = 1) => ({
  geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), Math.min(600, pts.length * 32), radius, 8),
  weight,
  edges: false,
});
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });

function roundedRect(path, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export const SHAPES = {
  /* ----- Generic shapes ----- */
  // opts lets the intro build the same word flat-on, centred and sized to the headline on screen
  wordmark(arr, opts = {}) {
    const S = 0.38, GAP = 0.3;
    const poly = (pts) => {
      const shape = new THREE.Shape();
      pts.forEach(([x, y], k) => (k ? shape.lineTo(x, y) : shape.moveTo(x, y)));
      return shape;
    };
    const withBowl = (shape) => {
      // counter of P and R
      const h = new THREE.Path();
      h.moveTo(S, 1.28);
      h.lineTo(0.85, 1.28);
      h.absarc(0.85, 1.45, 0.17, -Math.PI / 2, Math.PI / 2, false);
      h.lineTo(S, 1.62);
      h.lineTo(S, 1.28);
      shape.holes.push(h);
      return shape;
    };
    const D = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.8, 0);
      shape.absarc(0.8, 1, 1, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(0, 2);
      shape.lineTo(0, 0);
      const h = new THREE.Path();
      h.moveTo(S, S);
      h.lineTo(0.8, S);
      h.absarc(0.8, 1, 1 - S, -Math.PI / 2, Math.PI / 2, false);
      h.lineTo(S, 2 - S);
      h.lineTo(S, S);
      shape.holes.push(h);
      return [shape, 1.8];
    };
    const I = () => [poly([[0, 0], [S, 0], [S, 2], [0, 2], [0, 0]]), S];
    // mirrored, to match the flipped Z in the wordmark on the page
    const Z = () => {
      const w = 1.5;
      const pts = [[0, 2], [1.5, 2], [1.5, 1.62], [0.55, 0.38], [1.5, 0.38], [1.5, 0], [0, 0], [0, 0.38], [0.95, 1.62], [0, 1.62], [0, 2]];
      return [poly(pts.map(([x, y]) => [w - x, y])), w];
    };
    const R = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0, 2);
      shape.lineTo(0.85, 2);
      shape.absarc(0.85, 1.45, 0.55, Math.PI / 2, -Math.PI / 2, true);
      shape.lineTo(1.5, 0);
      shape.lineTo(1.06, 0);
      shape.lineTo(0.44, 0.9);
      shape.lineTo(S, 0.9);
      shape.lineTo(S, 0);
      shape.lineTo(0, 0);
      return [withBowl(shape), 1.5];
    };
    const U = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 2);
      shape.lineTo(0, 0.75);
      shape.absarc(0.75, 0.75, 0.75, Math.PI, 0, false);
      shape.lineTo(1.5, 2);
      shape.lineTo(1.5 - S, 2);
      shape.lineTo(1.5 - S, 0.75);
      shape.absarc(0.75, 0.75, 0.75 - S, 0, Math.PI, true);
      shape.lineTo(S, 2);
      shape.lineTo(0, 2);
      return [shape, 1.5];
    };
    const P = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0, 2);
      shape.lineTo(0.85, 2);
      shape.absarc(0.85, 1.45, 0.55, Math.PI / 2, -Math.PI / 2, true);
      shape.lineTo(S, 0.9);
      shape.lineTo(S, 0);
      shape.lineTo(0, 0);
      return [withBowl(shape), 1.4];
    };
    const T = () => [poly([[0, 2], [1.5, 2], [1.5, 1.62], [0.94, 1.62], [0.94, 0], [0.56, 0], [0.56, 1.62], [0, 1.62], [0, 2]]), 1.5];

    const parts = [];
    let x = 0;
    for (const [shape, width] of [D(), I(), Z(), R(), U(), P(), T()]) {
      parts.push(extrude(shape, 0.45).translate(x, 0, 0));
      x += width + GAP;
    }
    fromParts(arr, parts, {
      edgeShare: 0.35,
      size: opts.size ?? (isMobile ? 3.4 : 7),
      euler: opts.euler ?? new THREE.Euler(0.08, -0.2, 0),
    });
    // lift the word above the slide title
    const lift = opts.lift ?? 0.8;
    if (lift) for (let i = 1; i < arr.length; i += 3) arr[i] += lift;
  },

  // SlickFix: a clothes hanger with a tie draped over it
  hanger(arr) {
    const hook = [[0, 0.95, 0], [0, 1.3, 0]];
    for (let a = Math.PI; a >= -0.9; a -= 0.25) hook.push([0.32 + 0.32 * Math.cos(a), 1.62 + 0.32 * Math.sin(a), 0]);
    const body = [
      [0, 0.95, 0], [-0.7, 0.58, 0], [-1.6, 0.02, 0], [-2.05, -0.5, 0], [-1.9, -0.75, 0], [0, -0.75, 0],
      [1.9, -0.75, 0], [2.05, -0.5, 0], [1.6, 0.02, 0], [0.7, 0.58, 0], [0, 0.95, 0],
    ];
    const tie = new THREE.Shape();
    tie.moveTo(-0.2, 0);
    tie.lineTo(0.2, 0);
    tie.lineTo(0.12, -0.32);
    tie.lineTo(0.42, -2.2);
    tie.lineTo(0, -2.55);
    tie.lineTo(-0.42, -2.2);
    tie.lineTo(-0.12, -0.32);
    tie.lineTo(-0.2, 0);
    fromParts(arr, [
      tube(hook, 0.06, 1.5),
      tube(body, 0.075, 1.5),
      cyl(0.1, 0.1, 0.25, 0, 0.95, 0),
      extrude(tie, 0.05).translate(0.85, -0.72, 0.1),
      extrude(tie, 0.05).scale(1, 0.55, 1).translate(0.85, -0.72, -0.15),
    ], { edgeShare: 0.25, size: 4.4, euler: new THREE.Euler(0.15, -0.4, 0.04) });
  },

  // Alwrite: an insurance shield with a check mark
  shield(arr) {
    const s = new THREE.Shape();
    s.moveTo(0, 1.7);
    s.quadraticCurveTo(0.8, 1.3, 1.5, 1.45);
    s.lineTo(1.5, 0.3);
    s.quadraticCurveTo(1.45, -1.1, 0, -1.9);
    s.quadraticCurveTo(-1.45, -1.1, -1.5, 0.3);
    s.lineTo(-1.5, 1.45);
    s.quadraticCurveTo(-0.8, 1.3, 0, 1.7);
    const body = new THREE.ExtrudeGeometry(s, {
      depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 24,
    }).translate(0, 0, -0.15);
    const rim = s.getPoints(40).map((p) => [p.x * 0.8, p.y * 0.8 - 0.05, 0.26]);
    fromParts(arr, [
      { geo: body, weight: 0.6 },
      tube(rim, 0.035, 1.2),
      tube([[-0.75, 0.05, 0.38], [-0.2, -0.55, 0.38]], 0.14, 2.5),
      tube([[-0.2, -0.55, 0.38], [0.85, 0.8, 0.38]], 0.14, 2.5),
      { geo: new THREE.SphereGeometry(0.14, 16, 12).translate(-0.2, -0.55, 0.38), weight: 2.5, edges: false },
    ], { edgeShare: 0.2, size: 4.2, euler: new THREE.Euler(0.1, -0.45, 0) });
  },

  // Nykonos Entertainment: a vinyl record with a tonearm
  vinyl(arr) {
    const arm = makeSampler([
      cyl(0.3, 0.34, 0.22, 2.35, 0.11, -1.55),
      cyl(0.07, 0.07, 0.4, 2.35, 0.4, -1.55),
      tube([[2.35, 0.58, -1.55], [2.15, 0.6, -0.7], [1.65, 0.56, 0.2], [1.1, 0.46, 0.75]], 0.045, 3),
      box(0.24, 0.07, 0.42, 1.02, 0.42, 0.88),
      new THREE.CylinderGeometry(0.16, 0.16, 0.34, 20).rotateX(Math.PI / 2).translate(2.4, 0.58, -1.95),
      cyl(0.05, 0.05, 0.16, 0, 0.08, 0),
    ]);
    for (let i = 0; i < COUNT; i++) {
      const k = Math.random(), a = Math.random() * Math.PI * 2;
      if (k < 0.62) {
        // grooves, with gaps between tracks, and the outer edge
        let g;
        do { g = Math.floor(Math.random() * 40); } while (g % 10 === 9);
        const r = k < 0.05 ? 2 : 0.8 + g * 0.03 + rand(-0.004, 0.004);
        put(arr, i, Math.cos(a) * r, rand(-0.01, 0.01), Math.sin(a) * r);
      } else if (k < 0.76) {
        // centre label
        const r = k < 0.66 ? 0.72 : 0.72 * Math.sqrt(Math.random());
        put(arr, i, Math.cos(a) * r, 0.02, Math.sin(a) * r);
      } else {
        arm(out, 0.3);
        put(arr, i, out.x, out.y, out.z);
      }
    }
    fit(arr, 4.4, new THREE.Euler(0.8, 0.35, 0));
  },

  // Mae Mae Industrial: an open shipping box
  openBox(arr) {
    const W = 3, H = 2, D = 2.2, FLAP = 1.05, OPEN = 1.05, FRONT = D / 2 + 0.02;
    const plane = (w, h) => new THREE.PlaneGeometry(w, h);
    const arrow = (x) => [
      tube([[x, -0.55, FRONT], [x, 0.3, FRONT]], 0.03, 3),
      tube([[x - 0.16, 0.12, FRONT], [x, 0.34, FRONT]], 0.03, 3),
      tube([[x, 0.34, FRONT], [x + 0.16, 0.12, FRONT]], 0.03, 3),
    ];
    fromParts(arr, [
      plane(W, D).rotateX(-Math.PI / 2).translate(0, -H / 2, 0),
      plane(W, H).translate(0, 0, D / 2),
      plane(W, H).translate(0, 0, -D / 2),
      plane(D, H).rotateY(Math.PI / 2).translate(-W / 2, 0, 0),
      plane(D, H).rotateY(Math.PI / 2).translate(W / 2, 0, 0),
      plane(W, FLAP).translate(0, FLAP / 2, 0).rotateX(OPEN).translate(0, H / 2, D / 2),
      plane(W, FLAP).translate(0, FLAP / 2, 0).rotateX(-OPEN).translate(0, H / 2, -D / 2),
      plane(D, FLAP).translate(0, FLAP / 2, 0).rotateY(Math.PI / 2).rotateZ(OPEN).translate(-W / 2, H / 2, 0),
      plane(D, FLAP).translate(0, FLAP / 2, 0).rotateY(Math.PI / 2).rotateZ(-OPEN).translate(W / 2, H / 2, 0),
      box(1.1, 0.65, 0.02, -0.55, -0.1, D / 2 + 0.01), // shipping label
      ...arrow(0.85),
      ...arrow(1.15),
    ], { edgeShare: 0.35, size: 4.2, euler: new THREE.Euler(0.5, -0.6, 0) });
  },

  // Kiaash: a solitaire ring
  gemRing(arr) {
    const gem = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, -0.55), new THREE.Vector2(0.62, 0), new THREE.Vector2(0.4, 0.24), new THREE.Vector2(0.001, 0.24),
    ], 8).translate(0, 2.4, 0);
    const prongs = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      .map(([sx, sz]) => tube([[0.2 * sx, 1.75, 0.2 * sz], [0.42 * sx, 2.45, 0.42 * sz]], 0.035, 2));
    fromParts(arr, [
      { geo: new THREE.TorusGeometry(1.5, 0.13, 16, 160), edges: false },
      cyl(0.34, 0.16, 0.32, 0, 1.78, 0),
      { geo: gem, weight: 2.5 },
      ...prongs,
    ], { edgeShare: 0.3, size: 4.2, euler: new THREE.Euler(0.2, 0.55, 0) });
  },

  // Furnfetch: a lounge armchair
  armchair(arr) {
    const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      .map(([sx, sz]) => cyl(0.06, 0.035, 0.5, 1.15 * sx, -0.47, 0.88 * sz));
    fromParts(arr, [
      box(2.7, 0.45, 2.2),
      box(2.1, 0.3, 1.8, 0, 0.375, 0.15),
      box(2.7, 1.9, 0.4).rotateX(-0.12).translate(0, 1.05, -0.95),
      box(2.1, 1.25, 0.25).rotateX(-0.12).translate(0, 1.15, -0.66),
      box(0.3, 0.8, 2.2, -1.2, 0.55, 0),
      box(0.3, 0.8, 2.2, 1.2, 0.55, 0),
      ...legs,
    ], { edgeShare: 0.35, size: 3.6, euler: new THREE.Euler(0.35, -0.6, 0) });
  },

  // KP Packaging: cartons stacked on a pallet
  pallet(arr) {
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push(box(3.6, 0.08, 0.46, 0, -1.15, -1.3 + k * 0.65));
    for (const x of [-1.6, 0, 1.6]) for (const z of [-1.25, 0, 1.25]) parts.push(box(0.4, 0.3, 0.4, x, -1.34, z));
    const H = 1.05, BOTTOM = -1.11 + H / 2;
    const carton = (x, y, z) => parts.push(
      { geo: box(1.62, H, 1.22, x, y, z), weight: 0.7 },
      { geo: box(0.28, 0.02, 1.23, x, y + H / 2 + 0.01, z), weight: 3 }, // tape
    );
    carton(-0.88, BOTTOM, -0.68);
    carton(0.88, BOTTOM, -0.68);
    carton(-0.88, BOTTOM, 0.68);
    carton(0.88, BOTTOM, 0.68);
    carton(-0.88, BOTTOM + H + 0.02, -0.68);
    fromParts(arr, parts, { edgeShare: 0.45, size: 4, euler: new THREE.Euler(0.55, -0.6, 0) });
  },

  // AVG Windscreens: the front of a car with a chip crack spreading across the windscreen
  windscreen(arr) {
    const P = new THREE.Vector3();
    // u: -1..1 across, v: 0 (bottom) .. 1 (top); curved and raked back
    const glass = (u, v) => P.set(u * (2 - 0.45 * v), 1.3 * v, 0.45 * (1 - u * u) * (1 - 0.5 * v) - 1.1 * v);
    const U0 = -0.35, V0 = 0.55, BRANCHES = 14;
    for (let i = 0; i < COUNT; i++) {
      const k = Math.random();
      if (k < 0.12) {
        glass(rand(-1, 1), Math.random());
      } else if (k < 0.26) {
        // frame and pillars
        const e = Math.floor(Math.random() * 4), t = rand(-1, 1);
        if (e === 0) glass(t, 0);
        else if (e === 1) glass(t, 1);
        else glass(e === 2 ? -1 : 1, (t + 1) / 2);
        P.y += rand(-0.03, 0.03);
      } else if (k < 0.56) {
        let u, v;
        if (Math.random() < 0.2) {
          // broken ring around the impact
          const a = Math.random() * Math.PI * 2;
          if (Math.sin(a * 3) > 0.6) { i--; continue; }
          const r = 0.13 + 0.02 * Math.sin(a * 7);
          u = U0 + Math.cos(a) * r * 0.9;
          v = V0 + Math.sin(a) * r * 1.5;
        } else {
          // crack branches
          const b = i % BRANCHES;
          const len = 0.25 + ((((Math.sin(b * 91.7) * 437.1) % 1) + 1) % 1) * 0.45;
          const t = Math.random() ** 0.7 * len;
          const a = (b / BRANCHES) * Math.PI * 2 + Math.sin(b * 3.1) * 0.3;
          u = U0 + (Math.cos(a) * t + 0.02 * Math.sin(t * 40 + b)) * 0.9;
          v = V0 + (Math.sin(a) * t + 0.02 * Math.cos(t * 33 + b)) * 1.5;
        }
        glass(THREE.MathUtils.clamp(u, -1, 1), THREE.MathUtils.clamp(v, 0, 1));
        P.z += 0.02;
      } else if (k < 0.62) {
        // impact point
        const r = Math.random() < 0.5 ? 0.05 : Math.sqrt(Math.random()) * 0.05, a = Math.random() * Math.PI * 2;
        glass(U0 + Math.cos(a) * r, V0 + Math.sin(a) * r * 1.6);
        P.z += 0.02;
      } else if (k < 0.68) {
        // parked wipers
        const start = Math.random() < 0.5 ? -0.85 : 0.1, t = Math.random() * 0.72;
        glass(start + t, 0.05 + t * 0.12);
        P.z += 0.04;
      } else if (k < 0.88) {
        // bonnet (with a denser front edge)
        const u = rand(-1, 1), w = k < 0.72 ? 1 : Math.random();
        P.set(u * 2.05, -0.08 * w - 0.3 * w * w + 0.1 * (1 - u * u) * w, 0.45 * (1 - u * u) + 2.3 * w);
      } else if (k < 0.93) {
        // headlights
        const s = Math.random() < 0.5 ? -1 : 1, a = Math.random() * Math.PI * 2;
        P.set(s * 1.45 + Math.cos(a) * 0.38, -0.5 + Math.sin(a) * 0.13, 2.53);
      } else {
        // roof
        const w = Math.random();
        glass(rand(-1, 1), 1);
        P.set(P.x * (1 - 0.05 * w), P.y + 0.06 * w, P.z - 1.5 * w);
      }
      put(arr, i, P.x, P.y, P.z);
    }
    fit(arr, 4.4, new THREE.Euler(0.22, -0.5, 0));
  },

  // Samir Gems: a cut diamond
  diamond(arr) {
    const e = new THREE.Euler(0.3, 0, 0.12);
    const SIDES = 8, seg = (Math.PI * 2) / SIDES;
    const R = 2, TABLE = 1.15, CROWN = 0.7, PAVILION = 1.9, OFFSET = 0.6;
    const polygon = (a) => Math.cos(seg / 2) / Math.cos((((a % seg) + seg) % seg) - seg / 2);
    for (let i = 0; i < COUNT; i++) {
      let a = Math.random() * Math.PI * 2;
      if (Math.random() < 0.25) a = Math.round(a / seg) * seg; // facet edges
      const k = Math.random();
      let r, y;
      if (k < 0.5) { const t = 1 - Math.sqrt(Math.random()); r = R * (1 - t); y = -PAVILION * t; }
      else if (k < 0.85) { const t = Math.random(); r = R + (TABLE - R) * t; y = CROWN * t; }
      else { r = TABLE * Math.sqrt(Math.random()); y = CROWN; }
      const f = polygon(a);
      put(arr, i, Math.cos(a) * r * f, y + OFFSET, Math.sin(a) * r * f, e);
    }
  },

  // Maverick Realtors: a home
  house(arr) {
    const roof = new THREE.Shape();
    roof.moveTo(-1.9, 0);
    roof.lineTo(1.9, 0);
    roof.lineTo(0, 1.35);
    roof.lineTo(-1.9, 0);
    const pane = (w, h, x, y, z) => [box(w, h, 0.06, x, y, z), box(0.04, h, 0.1, x, y, z), box(w, 0.04, 0.1, x, y, z)];
    fromParts(arr, [
      box(3.2, 1.9, 2.4, 0, 0.95, 0),
      extrude(roof, 2.8).translate(0, 1.9, -1.4),
      box(0.4, 0.9, 0.4, 0.95, 2.75, -0.4),
      { geo: box(0.7, 1.15, 0.06, -0.7, 0.575, 1.22), weight: 2 },
      ...pane(0.9, 0.75, 0.75, 1.1, 1.22),
      { geo: box(0.06, 0.65, 0.9, 1.62, 1.1, 0), weight: 2 },
      { geo: new THREE.TorusGeometry(0.22, 0.035, 8, 40).translate(0, 2.4, 1.42), weight: 3, edges: false },
      { geo: box(4.6, 0.06, 3.8, 0, -0.03, 0.3), weight: 0.25 },
      { geo: box(0.7, 0.02, 0.8, -0.7, 0.01, 1.62), weight: 1.5 },
    ], { edgeShare: 0.35, size: 4.2, euler: new THREE.Euler(0.3, -0.6, 0) });
  },

  // Index view: a thoracic spinal column, built from anatomy: body, disc, arch, processes and facet
  // joints, with the cord and nerve roots. Every level repeats every SPINE_GAP so it scrolls endlessly.
  // Particles are split by their fixed random value: most form bone, a thin band the discs, and the
  // highest (drawn in the second colour while the Index is open) the cord, roots and disc cores.
  // x is left/right, z is front (+) / back (-).
  spine(arr) {
    const GAP = SPINE_GAP, HALF = 10, S = 1.75; // S widens the bones so the column reads at a distance
    const BODY = 0.22; // half-height of a vertebral body
    const DISC_H = GAP - 2 * BODY;
    const DISC_Y = BODY + DISC_H / 2;
    const AW = 0.34, AD = 0.24; // body half-width across, half-depth front to back
    const CORD_Z = -0.36;
    const P = new THREE.Vector3(), jitter = new THREE.Vector3();
    const level = () => (Math.floor(Math.random() * HALF * 2) - HALF) * GAP;
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    // body cross-section: an oval, flattened and slightly hollowed at the back
    const kidney = (t, a, b) => {
      const c = Math.cos(t), sn = Math.sin(t);
      return [a * c, b * sn + (sn < 0 ? 0.08 * sn * sn : 0)];
    };
    const bezier = (a, b, c, t) => {
      const u = 1 - t;
      return [0, 1, 2].map((k) => u * u * a[k] + 2 * u * t * b[k] + t * t * c[k]);
    };
    const tube = (a, b, c, t, r) => {
      const q = bezier(a, b, c, t);
      jitter.randomDirection().multiplyScalar(r * (Math.random() < 0.75 ? 1 : Math.random()));
      return P.set(q[0] + jitter.x, q[1] + jitter.y, q[2] + jitter.z);
    };
    const blob = (x, y, z, rx, ry, rz) => {
      jitter.randomDirection();
      return P.set(x + jitter.x * rx, y + jitter.y * ry, z + jitter.z * rz);
    };

    for (let i = 0; i < COUNT; i++) {
      const r = randoms[i], pick = Math.random(), th = Math.random() * Math.PI * 2;
      let ly = level();

      if (r > 0.8) {
        /* ----- cord and nerves ----- */
        if (pick < 0.4) {
          // spinal cord in the canal, with a brighter central canal
          const rad = Math.random() < 0.2 ? 0.014 : 0.075;
          P.set(Math.cos(th) * rad, rand(-HALF, HALF) * GAP, CORD_Z + Math.sin(th) * rad * 0.85);
          ly = 0;
        } else if (pick < 0.8) {
          // a pair of roots leaves at each level and splits in two
          const sd = side(), t = Math.random() ** 1.4, branch = Math.random();
          const exit = [sd * 0.6, DISC_Y - 0.14, -0.24];
          if (branch < 0.55) tube([sd * 0.07, DISC_Y, CORD_Z], [sd * 0.3, DISC_Y - 0.02, CORD_Z + 0.04], exit, t, 0.016 * (1 - t * 0.5));
          else if (branch < 0.8) tube(exit, [sd * 0.85, DISC_Y - 0.24, -0.06], [sd * 1.0, DISC_Y - 0.46, 0.1], t, 0.011 * (1 - t * 0.6));
          else tube(exit, [sd * 0.7, DISC_Y - 0.26, -0.46], [sd * 0.78, DISC_Y - 0.46, -0.62], t, 0.009 * (1 - t * 0.6));
        } else if (pick < 0.88) {
          blob(side() * 0.34, DISC_Y - 0.03, CORD_Z + 0.05, 0.045, 0.032, 0.032); // root ganglion
        } else {
          // soft core of the disc
          jitter.randomDirection().multiplyScalar(Math.cbrt(Math.random()));
          P.set(jitter.x * 0.13, DISC_Y + jitter.y * 0.045, 0.01 + jitter.z * 0.09);
        }
      } else if (r > 0.72) {
        /* ----- disc: rings of annulus, inset from the bone and bulging at the waist ----- */
        const ring = [1, 0.87, 0.74][Math.floor(Math.random() * 3)];
        const yy = rand(-1, 1), bulge = 0.93 * ring * (1 + 0.06 * (1 - yy * yy));
        const [x, z] = kidney(th, AW * bulge, AD * bulge);
        P.set(x, DISC_Y + (yy * DISC_H) / 2, z);
      } else if (pick < 0.22) {
        /* ----- bone ----- */
        // body wall, pinched at the waist
        const yy = rand(-1, 1), waist = 1 - 0.22 * (1 - yy * yy);
        const [x, z] = kidney(th, AW * waist, AD * waist);
        P.set(x, yy * BODY, z);
      } else if (pick < 0.36) {
        // bright rims around both endplates, which give each vertebra its edge
        const [x, z] = kidney(th, AW + rand(-0.006, 0.006), AD + rand(-0.006, 0.006));
        P.set(x, side() * (BODY - rand(0, 0.012)), z);
      } else if (pick < 0.44) {
        // dished endplate faces
        const rr = Math.sqrt(Math.random());
        const [x, z] = kidney(th, AW * 0.97 * rr, AD * 0.97 * rr);
        P.set(x, side() * (BODY - 0.022 * (1 - rr * rr)), z);
      } else if (pick < 0.47) {
        // a little trabecular dust inside the body
        const rr = Math.cbrt(Math.random());
        const [x, z] = kidney(th, AW * 0.9 * rr, AD * 0.85 * rr);
        P.set(x, rand(-BODY, BODY) * 0.95, z);
      } else if (pick < 0.53) {
        // pedicles: short struts from the back of the body to the arch
        const sd = side();
        tube([sd * 0.2, 0.04, -0.16], [sd * 0.21, 0.04, -0.27], [sd * 0.21, 0.04, -0.36], Math.random(), 0.055);
      } else if (pick < 0.65) {
        // laminae: plates arching round the canal to meet at the midline
        const sd = side(), t = Math.random();
        const q = bezier([sd * 0.21, 0, -0.36], [sd * 0.22, 0, -0.52], [0, 0, -0.56], t);
        P.set(q[0] + rand(-0.022, 0.022), rand(-0.07, 0.12), q[2] + rand(-0.025, 0.025));
        if (Math.random() < 0.35) P.y = Math.random() < 0.5 ? -0.07 : 0.12; // crisp top and bottom edges
      } else if (pick < 0.78) {
        // transverse processes: wings reaching back and out, with club tips
        const sd = side(), t = Math.random();
        if (t < 0.85) tube([sd * 0.22, 0.05, -0.35], [sd * 0.45, 0.09, -0.42], [sd * 0.63, 0.12, -0.5], t / 0.85, 0.055 - 0.018 * (t / 0.85));
        else blob(sd * 0.64, 0.12, -0.51, 0.055, 0.05, 0.05);
      } else if (pick < 0.93) {
        // spinous process: a blade sloping down and back, overlapping the level below
        const t = Math.random();
        if (t < 0.85) {
          const k = t / 0.85, q = bezier([0, 0.03, -0.56], [0, -0.1, -0.82], [0, -0.32, -1.04], k);
          const blade = 0.085 - 0.035 * k; // tall and thin, like a real blade
          const dy = Math.random() < 0.4 ? side() * blade : rand(-blade, blade);
          P.set(q[0] + rand(-0.028, 0.028), q[1] + dy, q[2] + rand(-0.022, 0.022));
        } else {
          blob(0, -0.33, -1.06, 0.035, 0.055, 0.05);
        }
      } else {
        // facet joints: posts reaching up and down to interlock with the next vertebra
        const sd = side();
        if (Math.random() < 0.5) tube([sd * 0.22, 0.12, -0.38], [sd * 0.23, 0.22, -0.4], [sd * 0.22, 0.32, -0.41], Math.random(), 0.04);
        else tube([sd * 0.19, -0.06, -0.5], [sd * 0.2, -0.16, -0.52], [sd * 0.19, -0.26, -0.52], Math.random(), 0.04);
      }

      put(arr, i, P.x * S, P.y + ly, P.z * S);
    }
  },

  // Shown instead of a particle column when the axis is a solid model: a faint drift of motes around it.
  glasses(arr) {
    const parts = [];
    for (const s of [-1, 1]) {
      const cx = s * 1.2;
      const rim = roundedRect(new THREE.Shape(), cx, 0, 2.16, 1.62, 0.55);
      rim.holes.push(roundedRect(new THREE.Path(), cx, 0, 1.9, 1.36, 0.42));
      parts.push(
        extrude(rim, 0.1).translate(0, 0, -0.05),
        { geo: new THREE.ShapeGeometry(roundedRect(new THREE.Shape(), cx, 0, 1.9, 1.36, 0.42), 16), weight: 0.3, edges: false },
        box(0.14, 0.22, 0.24, s * 2.3, 0.4, -0.1),
        tube([[s * 2.32, 0.4, -0.2], [s * 2.38, 0.38, -1.4], [s * 2.33, 0.25, -2.5], [s * 2.2, -0.2, -2.95]], 0.05, 2),
      );
    }
    parts.push(tube([[-0.14, 0.3, 0], [0, 0.42, 0], [0.14, 0.3, 0]], 0.05, 2));
    fromParts(arr, parts, { edgeShare: 0.3, size: 4.4, euler: new THREE.Euler(0.25, -0.6, 0) });
  },
};

export { rand, fit, put, makeSampler, fromParts };
