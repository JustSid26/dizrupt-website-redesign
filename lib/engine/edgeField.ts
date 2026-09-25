// @ts-nocheck — ported verbatim from the original site.
import { COUNT } from './config';
import * as THREE from 'three';
/* How near the silhouette each particle sits, as seen from the front — 1 on the rim, 0 deep
   inside. The figure is lit along that rim and nowhere else, so this is what decides which points
   are the aurora and which are simply not drawn.

   Worked out on a grid rather than per point against per point: the body is drawn into a 2D
   occupancy grid in x and y, every empty cell is seeded at distance zero, and a breadth-first
   sweep floods inward so each filled cell knows how far it is from open space. A particle then
   reads its own cell. Gaps inside the outline — between a raised arm and the chest — are open
   space too, and light the same way, which is right: they are silhouette as much as the outside
   is. */
const EDGE_BAND = 0.16;   // how far in from the rim the light reaches, in world units
/* The outline alone gives you a silhouette and nothing inside it. What actually describes a body
   in the dark is rim light: the surface is bright wherever it turns away from you and black
   wherever it faces you flat, so a shoulder is a bright curve, a pectoral has a lit border and a
   dark face, and a jaw is a line. That is a lighting model, not an edge detector.

   There are no normals in a point cloud, but there is a depth map — the frontmost point of every
   cell, smoothed — and the slope of a depth map is a normal. From that: how edge-on the surface
   is (bright at a grazing angle, dark facing you), weighted so the upward faces catch a little
   more, which is where the light is. Only the points on that front surface are lit by it, or
   everything stacked behind a shoulder lights with it. */
const RIM_POWER = 1.35;   // how quickly the light falls off as the surface turns to face you
const UP_BIAS = 0.45;     // how much more the upward-facing surfaces catch
const FRONT_TOL = 0.07;   // how far behind the frontmost point of a cell still counts as its surface
/* Shading alone under-reads a jaw. A cheek and a jawline can sit at much the same angle to you —
   what makes a jaw a jaw is that the surface turns there *sharply*, and a lighting term measures
   the angle, not the change in it. So the hard creases get a lift on top of the light: the jaw,
   the brow, the ridge along a trap. Only the hard ones; set low, this lights the whole face. */
const CREASE_MIN = 0.014;
const CREASE_MAX = 0.042;
const CREASE_LIFT = 0.5;

export function edgeField(positions) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < COUNT; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  /* The grid has to be coarser than the points are close, or it does not describe a body at all.
     He is a surface, not a solid: sample him finely enough and the inside is full of gaps between
     one point and the next, the flood leaks straight through them, and every particle comes out
     reading as rim. A hundred cells across the figure puts several points in each one. */
  const cell = Math.max(maxX - minX, maxY - minY) / 100;
  const pad = 3;
  const cols = Math.ceil((maxX - minX) / cell) + pad * 2 + 1;
  const rows = Math.ceil((maxY - minY) / cell) + pad * 2 + 1;
  const at = (i) => {
    const cx = Math.floor((positions[i * 3] - minX) / cell) + pad;
    const cy = Math.floor((positions[i * 3 + 1] - minY) / cell) + pad;
    return cy * cols + cx;
  };

  const hit = new Uint8Array(cols * rows);
  // and how near the viewer the frontmost point in each cell is, which is the depth of the surface
  const front = new Float32Array(cols * rows).fill(-Infinity);
  for (let i = 0; i < COUNT; i++) {
    const c = at(i);
    hit[c] = 1;
    const z = positions[i * 3 + 2];
    if (z > front[c]) front[c] = z;
  }
  // and one dilation on top, which closes the pinholes a coarser grid still leaves behind
  const filled = new Uint8Array(cols * rows);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const c = y * cols + x;
      filled[c] = hit[c] || hit[c - 1] || hit[c + 1] || hit[c - cols] || hit[c + cols]
        || hit[c - cols - 1] || hit[c - cols + 1] || hit[c + cols - 1] || hit[c + cols + 1] ? 1 : 0;
    }
  }

  // every open cell is the outside; the sweep runs inward from all of them at once
  const dist = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  let head = 0, tail = 0;
  for (let c = 0; c < filled.length; c++) {
    if (!filled[c]) { dist[c] = 0; queue[tail++] = c; }
  }
  while (head < tail) {
    const c = queue[head++];
    const x = c % cols, y = (c / cols) | 0;
    const d = dist[c] + 1;
    if (x > 0 && dist[c - 1] < 0) { dist[c - 1] = d; queue[tail++] = c - 1; }
    if (x < cols - 1 && dist[c + 1] < 0) { dist[c + 1] = d; queue[tail++] = c + 1; }
    if (y > 0 && dist[c - cols] < 0) { dist[c - cols] = d; queue[tail++] = c - cols; }
    if (y < rows - 1 && dist[c + cols] < 0) { dist[c + cols] = d; queue[tail++] = c + cols; }
  }

  /* How sharply the surface creases at each cell, measured as how far its depth departs from the
     average of its neighbours. The slope itself is no use here: a cheek is steeply sloped near the
     side of the head and perfectly smooth, and keying on slope lit the whole face. A crease is
     where the slope *changes* — the jaw against the neck, the brow, the ridge of a trap — and that
     is what this measures. */
  /* Smoothed first. The frontmost point in a cell is an extreme value drawn from a random sample,
     so it jitters from one cell to the next whether the surface does or not — and that jitter is
     all a crease detector finds if you hand it the raw field. Three passes of a local average take
     the sampling noise out and leave the shape. */
  let depth = front.slice();
  for (let pass = 0; pass < 3; pass++) {
    const next = depth.slice();
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const c = y * cols + x;
        if (!hit[c]) continue;
        let sum = depth[c], n = 1;
        for (const k of [c - 1, c + 1, c - cols, c + cols,
                         c - cols - 1, c - cols + 1, c + cols - 1, c + cols + 1]) {
          if (hit[k]) { sum += depth[k]; n++; }
        }
        next[c] = sum / n;
      }
    }
    depth = next;
  }

  /* The surface normal at each cell, from the slope of that depth map, and from it how much light
     grazes it. A cell facing straight at you gets nothing; one turned almost edge-on gets all of
     it. This is the whole of the look — everything else is just deciding which points belong to
     the surface it was measured on. */
  const shade = new Float32Array(cols * rows);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const c = y * cols + x;
      if (!hit[c]) continue;
      const gx = ((hit[c + 1] ? depth[c + 1] : depth[c]) - (hit[c - 1] ? depth[c - 1] : depth[c])) / (2 * cell);
      const gy = ((hit[c + cols] ? depth[c + cols] : depth[c]) - (hit[c - cols] ? depth[c - cols] : depth[c])) / (2 * cell);
      const len = Math.hypot(gx, gy, 1);
      const facing = 1 / len;          // the z of the normal: 1 dead on, 0 edge on
      const up = Math.max(0, -gy / len); // and how far it tilts up towards the light
      shade[c] = Math.pow(1 - facing, RIM_POWER) * (1 - UP_BIAS + UP_BIAS * up * 2);
    }
  }

  const smooth01 = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

  /* And where that surface creases, measured as how far a cell's depth departs from the average of
     its neighbours. On a smoothly curved cheek this is near zero however steeply it is sloped; on a
     jawline it is the whole step from the jaw to the neck behind it. */
  const crease = new Float32Array(cols * rows);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const c = y * cols + x;
      if (!hit[c]) continue;
      let sum = 0, n = 0;
      for (const k of [c - 1, c + 1, c - cols, c + cols]) {
        if (hit[k]) { sum += depth[k]; n++; }
      }
      if (n) crease[c] = smooth01((Math.abs(depth[c] - sum / n) - CREASE_MIN) / (CREASE_MAX - CREASE_MIN));
    }
  }
  const edge = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const c = at(i);
    // the dilation pushed the outside out by a cell, so that cell is given back here
    const inward = Math.max(0, dist[c] - 2) * cell;
    const rim = 1 - smooth01(inward / EDGE_BAND);   // smooth, so the light has no hard inner border
    // the shading only lights the surface it was measured on, not everything stacked behind it
    const onFront = 1 - smooth01((front[c] - positions[i * 3 + 2]) / FRONT_TOL);
    const lit = Math.min(1, shade[c] + crease[c] * CREASE_LIFT);
    edge[i] = Math.max(rim, lit * onFront);
  }
  return new THREE.BufferAttribute(edge, 1);
}

