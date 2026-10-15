import * as THREE from 'three';

/* =========================================================
   The work's building: one of the city's own, just behind the
   plaza, and the selected work is in its windows.

   It keeps its place, its footprint and its height in the
   skyline; its walls are dressed in windows big enough to see
   into. Each is "interior mapped": the shader traces the view
   ray into a room behind the glass (back wall, floor, ceiling,
   sides), so the rooms have depth and shift as the camera
   moves. Some have things in them, the studio's kind of things:
   a desk and its two glowing screens, a sofa under a neon tube,
   shelves of records, a ring light and a camera, the mirrored Z
   in neon on the wall, a rack of servers blinking; some are dark.

   The project windows are their banners on the glass. The page
   lays each project's full-screen picture over its window as
   the camera arrives (components/home/Projects.tsx), so the
   building reports where each one is on screen every frame.
   ========================================================= */

const PIECES = 6;

/* ---- the furniture, as cut-outs on one atlas: ink is the silhouette, colour is what glows ---- */
function furnitureAtlas() {
  const S = 256, c = document.createElement('canvas');
  c.width = S * PIECES; c.height = S;
  const g = c.getContext('2d')!;
  const ink = '#06050b';
  const at = (i: number, fn: () => void) => { g.save(); g.translate(i * S, 0); g.fillStyle = ink; g.strokeStyle = ink; fn(); g.restore(); };
  const glow = (col: string, fn: () => void) => { g.save(); g.fillStyle = col; g.strokeStyle = col; fn(); g.restore(); };
  // 0: a desk, two screens glowing violet and pink, a chair
  at(0, () => {
    g.fillRect(24, 156, 208, 10); g.fillRect(34, 166, 9, 90); g.fillRect(212, 166, 9, 90);
    g.fillRect(60, 92, 66, 46); g.fillRect(134, 92, 66, 46); g.fillRect(89, 138, 8, 18); g.fillRect(163, 138, 8, 18);
    glow('rgba(163,16,231,0.7)', () => g.fillRect(64, 96, 58, 38));
    glow('rgba(255,61,139,0.65)', () => g.fillRect(138, 96, 58, 38));
    g.fillRect(104, 176, 48, 10); g.fillRect(100, 128, 10, 56); g.fillRect(124, 186, 8, 70);
  });
  // 1: a low sofa under a neon tube light, a plant
  at(1, () => {
    g.fillRect(30, 178, 160, 44); g.fillRect(30, 150, 160, 36); g.fillRect(20, 170, 22, 60); g.fillRect(178, 170, 22, 60);
    glow('rgba(255,61,139,0.25)', () => { g.fillRect(30, 60, 160, 28); });
    glow('rgba(255,61,139,0.85)', () => { g.fillRect(40, 70, 140, 8); });
    g.fillRect(214, 200, 26, 56);
    for (let l = 0; l < 6; l++) { g.beginPath(); g.ellipse(227 + Math.cos(l * 1.3) * 14, 186 - l * 9, 11, 5, l * 0.7, 0, Math.PI * 2); g.fill(); }
  });
  // 2: shelves of records and boxes
  at(2, () => {
    g.fillRect(34, 26, 8, 230); g.fillRect(214, 26, 8, 230);
    for (let y = 26; y < 256; y += 58) g.fillRect(34, y, 188, 7);
    for (let s = 0; s < 4; s++) for (let b = 0; b < 11; b++) {
      if ((b * 3 + s) % 5 === 4) continue;
      const x = 46 + b * 15, top = 26 + s * 58;
      if ((b + s) % 3 === 0) { g.beginPath(); g.arc(x + 6, top + 36, 15, 0, Math.PI * 2); g.fill(); } // a record facing out
      else g.fillRect(x, top + 58 - 44, 11, 44);
    }
    glow('rgba(163,16,231,0.6)', () => { g.beginPath(); g.arc(112, 26 + 58 * 2 + 36, 4, 0, Math.PI * 2); g.fill(); });
  });
  // 3: a content corner: a ring light, a camera on its tripod, a backdrop
  at(3, () => {
    g.fillRect(150, 24, 96, 170); // the backdrop roll
    glow('rgba(255,236,250,0.85)', () => { g.lineWidth = 10; g.beginPath(); g.arc(70, 84, 38, 0, Math.PI * 2); g.stroke(); });
    g.lineWidth = 6; g.beginPath(); g.moveTo(70, 122); g.lineTo(70, 220); g.moveTo(70, 220); g.lineTo(44, 256); g.moveTo(70, 220); g.lineTo(96, 256); g.stroke();
    g.fillRect(104, 118, 40, 26); g.fillRect(118, 108, 14, 10);
    g.beginPath(); g.moveTo(124, 144); g.lineTo(124, 214); g.moveTo(124, 214); g.lineTo(104, 256); g.moveTo(124, 214); g.lineTo(144, 256); g.stroke();
    glow('rgba(255,45,79,0.9)', () => { g.beginPath(); g.arc(138, 124, 3, 0, Math.PI * 2); g.fill(); }); // recording
  });
  // 4: the mirrored Z in neon on the wall, a beanbag under it
  at(4, () => {
    glow('rgba(163,16,231,0.25)', () => { g.fillRect(64, 30, 128, 130); });
    glow('rgba(196,92,255,0.95)', () => {
      g.lineWidth = 9; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(172, 50); g.lineTo(84, 50); g.lineTo(172, 140); g.lineTo(84, 140); g.stroke(); // Z, mirrored
    });
    g.beginPath(); g.ellipse(128, 222, 66, 36, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(118, 190, 44, 30, -0.2, 0, Math.PI * 2); g.fill();
  });
  // 5: a rack of servers blinking, and a tall plant
  at(5, () => {
    g.fillRect(60, 40, 96, 216);
    for (let r = 0; r < 9; r++) {
      g.save(); g.fillStyle = '#0d0b16'; g.fillRect(66, 48 + r * 23, 84, 18); g.restore();
      glow(r % 3 === 0 ? 'rgba(31,214,184,0.9)' : r % 3 === 1 ? 'rgba(61,107,255,0.85)' : 'rgba(255,61,139,0.85)', () => {
        g.fillRect(72, 54 + r * 23, 5, 5); g.fillRect(82, 54 + r * 23, 5, 5);
      });
    }
    g.fillRect(190, 196, 30, 60);
    for (let l = 0; l < 9; l++) { g.beginPath(); g.ellipse(205 + Math.sin(l * 1.7) * 18, 182 - l * 15, 14, 5, l * 0.9, 0, Math.PI * 2); g.fill(); }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const facadeVert = /* glsl */ `
  varying vec3 vLocal, vWorld;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const facadeFrag = /* glsl */ `
  precision highp float;
  varying vec3 vLocal, vWorld;
  uniform vec3 uCam;          // the camera, in this face's own space (z out of the wall)
  uniform vec3 uCamWorld, uHaze, uSkyTop;
  uniform float uNight, uLit; // the city's own light (facade.ts), so its windows are lit as theirs are
  uniform vec2 uCell, uWin, uOrigin;
  uniform float uCols, uRows, uRoomD, uTime, uDim, uSeed;
  uniform vec2 uProjects[16]; // the cells that hold work: drawn by their own panels
  uniform int uProjectCount;
  uniform sampler2D uAtlas;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.0) * 43758.5453); }
  vec3 skyAt(vec3 d) {
    float h = clamp(d.y, -0.2, 1.0);
    return mix(uHaze, uSkyTop, smoothstep(0.0, 0.6, h)) * (h < 0.0 ? 0.35 : 1.0);
  }

  void main() {
    vec2 g = (vLocal.xy - uOrigin) / uCell;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 winHalf = uWin / uCell * 0.5;
    bool inGrid = cell.x >= 0.0 && cell.y >= 0.0 && cell.x < uCols && cell.y < uRows;
    // the wall: dark stone, a line at each floor
    // the wall: as dark as its neighbours' (these are linear values: the screen lifts them a lot)
    vec3 col = vec3(0.011, 0.011, 0.017) + vec3(0.006, 0.006, 0.009) * smoothstep(0.47, 0.5, abs(f.y));
    bool project = false;
    for (int i = 0; i < 16; i++) {
      if (i >= uProjectCount) break;
      if (all(equal(cell, uProjects[i]))) project = true;
    }
    if (inGrid && abs(f.x) <= winHalf.x && abs(f.y) <= winHalf.y && !project) {
      // the room behind this window
      float r = hash(cell), r2 = hash(cell + 17.3), r3 = hash(cell + 41.9);
      /* lit exactly as the rest of the city is (facade.ts): as many rooms on, whole floors dark now
         and then, the same two lamps at the same strength, and glass that gives back the sky */
      float lit = step(1.0 - uLit, r) * step(0.12, hash(vec2(cell.y, 3.0)));
      vec3 lamp = mix(vec3(1.0, 0.62, 0.3), vec3(0.72, 0.85, 1.0), step(0.4, r2)) * (0.16 + 0.22 * r3) * (0.8 + uNight * 0.5);
      lamp *= 1.0 - 0.6 * step(0.7, hash(cell + 2.0)) * step(0.05, f.y / winHalf.y); // blinds half down in some
      vec3 tone = lamp * 2.2; // a room's walls, floor and ceiling average out to its lamp seen flat
      float flick = r3 > 0.95 ? step(0.25, fract(sin(floor(uTime * 7.0 + r * 30.0)) * 999.0)) : 1.0;
      vec3 p = vec3(f * uCell, 0.0);
      vec3 cam = vec3(uCam.xy - (uOrigin + (cell + 0.5) * uCell), uCam.z);
      vec3 d = normalize(p - cam);
      vec3 glass = mix(vec3(0.01, 0.012, 0.018), skyAt(reflect(d, vec3(0.0, 0.0, 1.0))), 0.25 + 0.6 * pow(1.0 - abs(d.z), 3.0));
      vec3 halfRoom = vec3(uCell * 0.5, uRoomD);
      float tBack = (-uRoomD - p.z) / d.z;
      float tx = d.x > 0.0 ? (halfRoom.x - p.x) / d.x : (-halfRoom.x - p.x) / d.x;
      float ty = d.y > 0.0 ? (halfRoom.y - p.y) / d.y : (-halfRoom.y - p.y) / d.y;
      float t = min(tBack, min(tx, ty));
      vec3 hit = p + d * t;
      float depth = clamp(-hit.z / uRoomD, 0.0, 1.0);
      vec3 room;
      if (t == tBack) room = tone * 0.5;
      else if (t == ty) room = d.y < 0.0 ? tone * 0.2 : tone * (0.72 + 0.25 * (1.0 - depth));
      else room = tone * (0.3 + 0.12 * depth);
      room *= 0.6 + 0.4 * (1.0 - depth);
      // a piece of the studio standing in it, partway back
      if (r2 < 0.66 && lit > 0.5) {
        float zf = -uRoomD * (0.42 + 0.3 * r3);
        float tf = (zf - p.z) / d.z;
        if (tf < t) {
          vec3 fh = p + d * tf;
          vec2 fuv = vec2(fh.x / (uCell.x * 0.92) + 0.5, (fh.y + halfRoom.y) / (uCell.y * 0.96));
          if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
            float piece = floor(r2 / 0.66 * ${PIECES.toFixed(1)});
            vec4 a = texture2D(uAtlas, vec2((piece + fuv.x) / ${PIECES.toFixed(1)}, fuv.y));
            if (a.a > 0.5 && max(a.r, max(a.g, a.b)) < 0.06) room = vec3(0.004, 0.003, 0.006) + tone * 0.02;
            else if (a.a > 0.05) room = mix(room, a.rgb * 0.9, a.a); // the studio's neon: the only colour in the building
          }
        }
      }
      room *= lit * flick;
      /* from further off a room is only its light, the way every other building's windows are: the
         interiors come in as the camera closes on the facade, so from across the city it is one of them */
      vec3 flat_ = lamp * lit * flick;
      room = mix(room, flat_, smoothstep(5.0, 10.0, distance(vWorld, uCamWorld))) + glass;
      vec2 e = abs(f) / winHalf;
      float frame = step(0.9, max(e.x, e.y));
      col = mix(room, vec3(0.02, 0.02, 0.028), clamp(frame, 0.0, 1.0));
    }
    // far away it goes into the night the way the rest of the city does
    col = mix(col, uHaze, smoothstep(45.0, 150.0, distance(vWorld, uCamWorld)) * 0.75);
    gl_FragColor = vec4(col * uDim, 1.0);
  }
`;

export type Box = { x0: number; x1: number; z0: number; z1: number; y0: number; h: number };

type Light = { uSkyTop: { value: THREE.Color }; uNight: { value: number }; uLit: { value: number } };
export function createWorkTower(opts: { box: Box; banners: (string | null)[]; colors: [string, string][]; haze: { value: THREE.Color }; light?: Light }) {
  const { box } = opts;
  const n = opts.banners.length;
  const group = new THREE.Group();
  const grow = 0.03; // a hair outside the building's own walls
  const W = box.x1 - box.x0 + grow * 2, Dp = box.z1 - box.z0 + grow * 2, H = box.h + grow;
  group.position.set((box.x0 + box.x1) / 2, box.y0, box.z1 + grow); // the foot of the front face
  const atlas = furnitureAtlas();
  const camWorld = { value: new THREE.Vector3() };

  /* the window grid on a face, at the city's own scale (facade.ts: storeys of about 0.3, a window
     to every bay): the work's windows are ordinary windows among the rest, spread up the front */
  const CELL_H = 0.3, BASE = 0.3, TOP = 0.12;
  const grid = (width: number) => {
    const cols = Math.max(1, Math.round(width / 0.28));
    const cellW = width / cols;
    const winW = cellW * 0.66, winH = CELL_H * 0.62;
    const rows = Math.floor((H - BASE - TOP) / CELL_H);
    return { cols, rows, cellW, winW, winH, origin: new THREE.Vector2(-width / 2, BASE) };
  };
  const front = grid(W);
  /* which face each project is on, in order round the building: front, right, back, left, front …
     It goes all the way round (twice, for eleven) and ends on the front again, so the way out to the
     contact is the same front view the way in was; where there are more projects than turns, the
     camera stays on a face for a window or two. Faces: 0 front (+z), 1 right (+x), 2 back, 3 left. */
  const turns = Math.floor((n - 1) / 4) * 4, stays = n - 1 - turns;
  const faceOf: number[] = [0];
  for (let k = 1, f = 0, stayed = 0; k < n; k++) {
    const due = Math.round(((k) * stays) / Math.max(1, n - 1)) > stayed; // spread the stays along the way
    if (due && stayed < stays) stayed++; else f = (f + 1) % 4;
    faceOf.push(f);
  }
  const FACES = [
    { width: W, at: new THREE.Vector3(0, 0, 0), rotY: 0 },
    { width: Dp, at: new THREE.Vector3(W / 2, 0, -Dp / 2), rotY: Math.PI / 2 },
    { width: W, at: new THREE.Vector3(0, 0, -Dp), rotY: Math.PI },
    { width: Dp, at: new THREE.Vector3(-W / 2, 0, -Dp / 2), rotY: -Math.PI / 2 },
  ];
  const grids = FACES.map((f) => grid(f.width));
  const cells = Array.from({ length: n }, (_, k) => {
    const gr = grids[faceOf[k]];
    const row = Math.round(3 + (k * (gr.rows - 7)) / Math.max(1, n - 1)); // a few floors apart, all the way up
    const col = 1 + ((k * 3 + (k >> 1)) % Math.max(1, gr.cols - 2)); // across the bays, never at a corner
    return new THREE.Vector2(col, row);
  });

  const faces: { mesh: THREE.Mesh; u: Record<string, THREE.IUniform> }[] = [];
  FACES.forEach((F, fi) => {
    const gr = grids[fi];
    const projects = cells.filter((_, k) => faceOf[k] === fi);
    const u = {
      uCam: { value: new THREE.Vector3() },
      uCamWorld: camWorld,
      uHaze: opts.haze,
      uSkyTop: opts.light?.uSkyTop ?? { value: new THREE.Color(0.005, 0.008, 0.028) },
      uNight: opts.light?.uNight ?? { value: 1 },
      uLit: opts.light?.uLit ?? { value: 0.5 },
      uCell: { value: new THREE.Vector2(gr.cellW, CELL_H) },
      uWin: { value: new THREE.Vector2(gr.winW, gr.winH) },
      uOrigin: { value: gr.origin },
      uCols: { value: gr.cols },
      uRows: { value: gr.rows },
      uRoomD: { value: 0.34 },
      uTime: { value: 0 },
      uDim: { value: 1 },
      uSeed: { value: fi + 1 },
      uProjects: { value: Array.from({ length: 16 }, (_, i) => projects[i] ?? new THREE.Vector2(-9, -9)) },
      uProjectCount: { value: projects.length },
      uAtlas: { value: atlas },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(F.width, H).translate(0, H / 2, 0),
      new THREE.ShaderMaterial({ vertexShader: facadeVert, fragmentShader: facadeFrag, uniforms: u }),
    );
    mesh.position.copy(F.at);
    mesh.rotation.y = F.rotY;
    group.add(mesh);
    faces.push({ mesh, u });
  });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), new THREE.MeshBasicMaterial({ color: '#05050a' }));
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(0, H, -Dp / 2);
  group.add(roof);

  // a project window's centre in its face's own frame (z out of the wall)
  const local = (k: number) => { const gr = grids[faceOf[k]]; return new THREE.Vector3(gr.origin.x + (cells[k].x + 0.5) * gr.cellW, gr.origin.y + (cells[k].y + 0.5) * CELL_H, 0.002); };

  // the work in its windows: the banner on the glass in a plain dark frame, like the rest of the city's
  const loader = new THREE.TextureLoader();
  const panels = cells.map((_, k) => {
    const c = local(k), gr = grids[faceOf[k]];
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(gr.winW * 1.12, gr.winH * 1.12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.02, 0.028), toneMapped: false }),
    );
    frame.position.set(c.x, c.y, 0.004);
    // dimmed to sit among the neighbours' lit windows, warm like their lamps
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.38, 0.33), toneMapped: false });
    const url = opts.banners[k];
    if (url) {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      const a = 2574 / 894, w = gr.winW / gr.winH; // the banner is wider than the window: its middle
      t.repeat.set(w / a, 1); t.offset.set((1 - w / a) / 2, 0);
      mat.map = t;
    } else mat.color.set(opts.colors[k][0]).multiplyScalar(0.4);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(gr.winW, gr.winH), mat);
    glass.position.set(c.x, c.y, 0.006);
    faces[faceOf[k]].mesh.add(frame, glass);
    return { frame, glass };
  });

  /* ---- where things are ---- */
  const normals = FACES.map((F) => new THREE.Vector3(Math.sin(F.rotY), 0, Math.cos(F.rotY)));
  const normal = normals[0];
  const normalOf = (k: number) => normals[faceOf[k]];
  const windowWorld = (k: number, out = new THREE.Vector3()) => { group.updateMatrixWorld(); return out.copy(local(k)).applyMatrix4(faces[faceOf[k]].mesh.matrixWorld); };
  const corner = new THREE.Vector3(), toCam = new THREE.Vector3(), wc = new THREE.Vector3();
  // the window's rectangle on screen, in CSS pixels; face: how square on to it the camera is (1 straight on)
  function screenRect(k: number, camera: THREE.Camera, out: { x: number; y: number; w: number; h: number; on: boolean; face?: number }) {
    const c = local(k), gr = grids[faceOf[k]], m = faces[faceOf[k]].mesh.matrixWorld;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, behind = false;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set(c.x + (sx * gr.winW) / 2, c.y + (sy * gr.winH) / 2, c.z).applyMatrix4(m).project(camera);
      if (corner.z > 1) behind = true;
      const x = (corner.x * 0.5 + 0.5) * innerWidth, y = (-corner.y * 0.5 + 0.5) * innerHeight;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    out.x = minX; out.y = minY; out.w = maxX - minX; out.h = maxY - minY;
    wc.copy(c).applyMatrix4(m);
    out.face = toCam.copy(camera.position).sub(wc).normalize().dot(normalOf(k));
    out.on = !behind && out.face > 0;
  }

  const inv = new THREE.Matrix4();
  function update(time: number, camera: THREE.Camera, dim: number, hide: number[] = []) {
    group.updateMatrixWorld();
    camWorld.value.copy(camera.position);
    for (const f of faces) {
      f.u.uTime.value = time;
      f.u.uDim.value = dim;
      inv.copy(f.mesh.matrixWorld).invert();
      (f.u.uCam.value as THREE.Vector3).copy(camera.position).applyMatrix4(inv);
    }
    // a window whose project is up on the page gives way to it; its frame stays, to fly past
    panels.forEach((p, k) => { p.glass.visible = !hide.includes(k); });
  }

  group.updateMatrixWorld();
  return {
    group, update, screenRect, windowWorld, normal, normalOf, faceOf, count: n,
    centre: () => new THREE.Vector3(0, H * 0.5, 0).applyMatrix4(group.matrixWorld),
    height: H, width: W,
    dims: { cellH: CELL_H, winW: front.winW, winH: front.winH },
    // the building's own axis, on the ground
    axis: () => new THREE.Vector3(0, 0, -Dp / 2).applyMatrix4(group.matrixWorld),
    depth: Dp,
  };
}
