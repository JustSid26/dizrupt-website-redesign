import * as THREE from 'three';
import { bannerFor, BANNER_ASPECT } from './banners.js';

/* =========================================================
   Index view: every project on a spiral that winds around the
   particle spine. The focused project's card sits large in front of
   the spine, facing the viewer; the rest curve away around it.
   Scrolling turns the spiral; clicking a card opens its overview.
   Each card is a particle frame around a dark panel — the panel is
   where a preview (image/video) will go later.
   ========================================================= */
export const STEP_ANGLE = 1.05; // radians between neighbouring projects
export const STEP_Y = 0.9; // how far each project drops along the spine
export const CARD_LIGHT = 0.32; // how bright a card may show its banner, held under the bloom
export const SPINE_GAP = 0.62; // vertebra spacing; the spine scrolls in step with the cards but repeats on its own period

const X_AXIS = new THREE.Vector3(1, 0, 0);
const CARD_W = 1.3; // card size in card units (scaled up per device below)
const CARD_H = 0.86;
const CORNER = 0.07; // corner radius
const FRONT_TILT = { x: -0.07, y: 0.12, z: 0.035 }; // the focused card leans back slightly, like a card held up to you

const STIFFNESS = 1.6; // a slightly longer, calmer glide between focused projects
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const pad = (n) => String(n).padStart(2, '0');

// Point at fraction s (0–1) around a rounded rectangle, pulled in by `inset`.
function roundedRectPoint(s, inset) {
  const w = CARD_W / 2 - inset, h = CARD_H / 2 - inset, r = Math.max(0.01, CORNER - inset);
  const sx = 2 * (w - r), sy = 2 * (h - r), arc = (Math.PI * r) / 2;
  const segments = [sx, arc, sy, arc, sx, arc, sy, arc];
  let d = s * segments.reduce((a, b) => a + b, 0);
  let k = 0;
  while (k < segments.length - 1 && d > segments[k]) d -= segments[k++];
  const t = d / segments[k];
  switch (k) {
    case 0: return [-w + r + t * sx, -h]; // bottom
    case 1: { const a = -Math.PI / 2 + t * (Math.PI / 2); return [w - r + Math.cos(a) * r, -h + r + Math.sin(a) * r]; }
    case 2: return [w, -h + r + t * sy]; // right
    case 3: { const a = t * (Math.PI / 2); return [w - r + Math.cos(a) * r, h - r + Math.sin(a) * r]; }
    case 4: return [w - r - t * sx, h]; // top
    case 5: { const a = Math.PI / 2 + t * (Math.PI / 2); return [-w + r + Math.cos(a) * r, h - r + Math.sin(a) * r]; }
    case 6: return [-w, h - r - t * sy]; // left
    default: { const a = Math.PI + t * (Math.PI / 2); return [-w + r + Math.cos(a) * r, -h + r + Math.sin(a) * r]; }
  }
}

// Particle frame shared by every card. kind: 0 haze, 1 edge, 2 corner bracket.
function buildFrameGeometry() {
  const pos = [], kind = [], perim = [], rnd = [], scatter = [];
  const dir = new THREE.Vector3();
  const add = (x, y, z, k, s) => {
    pos.push(x, y, z);
    kind.push(k);
    perim.push(s);
    rnd.push(Math.random());
    dir.randomDirection().multiplyScalar(0.6 + Math.random() * 1.4);
    scatter.push(dir.x, dir.y, dir.z);
  };
  const jitter = (a) => (Math.random() - 0.5) * a;

  for (let i = 0; i < 2600; i++) { // glowing outer edge
    const s = Math.random(), [x, y] = roundedRectPoint(s, jitter(0.006));
    add(x, y, jitter(0.006), 1, s);
  }
  for (let i = 0; i < 500; i++) { // back edge, for thickness
    const s = Math.random(), [x, y] = roundedRectPoint(s, 0.008);
    add(x, y, -0.04 + jitter(0.005), 1, s);
  }
  for (let i = 0; i < 600; i++) { // faint inner outline around the preview area
    const [x, y] = roundedRectPoint(Math.random(), 0.03);
    add(x, y, 0.004 + jitter(0.003), 1, -1);
  }
  for (let i = 0; i < 700; i++) { // corner brackets, just outside the edge
    const cx = Math.random() < 0.5 ? -1 : 1, cy = Math.random() < 0.5 ? -1 : 1;
    const along = Math.random() * 0.15, horizontal = Math.random() < 0.5, out = 0.024;
    const x = cx * (CARD_W / 2 + out - (horizontal ? along : 0));
    const y = cy * (CARD_H / 2 + out - (horizontal ? 0 : along));
    add(x + jitter(0.005), y + jitter(0.005), jitter(0.005), 2, -1);
  }
  for (let i = 0; i < 1400; i++) { // glassy haze across the panel, thinning towards the middle
    const x = jitter(CARD_W - 0.08), y = jitter(CARD_H - 0.08);
    if (Math.random() > 0.3 + 0.7 * Math.max(Math.abs(x) / (CARD_W / 2), Math.abs(y) / (CARD_H / 2))) { i--; continue; }
    add(x, y, 0.006 + jitter(0.02), 0, -1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('aPerim', new THREE.Float32BufferAttribute(perim, 1));
  geo.setAttribute('aRandom', new THREE.Float32BufferAttribute(rnd, 1));
  geo.setAttribute('aScatter', new THREE.Float32BufferAttribute(scatter, 3));
  return geo;
}

// Dark rounded panel inside the frame: hides what's behind the card, and will hold the preview later.
function buildPanelGeometry() {
  const shape = new THREE.Shape();
  const w = CARD_W / 2 - 0.012, h = CARD_H / 2 - 0.012, r = CORNER - 0.012;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  const geo = new THREE.ShapeGeometry(shape, 8);
  // ShapeGeometry lays its UVs out in the shape's own units, so a texture on it would repeat at
  // some arbitrary scale. Remap them to run 0→1 across the card instead.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + w) / (2 * w), (uv.getY(i) + h) / (2 * h));
  }
  uv.needsUpdate = true;
  return geo.translate(0, 0, -0.02);
}

// One branch, drawn in unit space from the trunk (0,0,0) out to its card near (1, 0.22, 0):
// a limb that forks twice, with blossom canopies at the tips and petals falling from them.
// kind: 0 wood, 1 blossom, 2 falling petal. aT is how far along the branch a particle sits,
// so the whole thing can grow outwards from the trunk.
function buildBranchGeometry() {
  const pos = [], kind = [], along = [], rnd = [];
  const add = (p, k, t) => { pos.push(p.x, p.y, p.z); kind.push(k); along.push(t); rnd.push(Math.random()); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd2 = (a, b) => a + Math.random() * (b - a);
  const perpendicular = (d) => (Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(d).normalize();

  // a tapered length of wood, with ridges running along the bark
  function wood(from, to, r0, r1, t0, t1, count) {
    const axis = to.clone().sub(from);
    const side = perpendicular(axis.clone().normalize());
    const up = axis.clone().normalize().cross(side).normalize();
    for (let i = 0; i < count; i++) {
      const s = Math.random(), a = Math.random() * Math.PI * 2;
      const r = (r0 + (r1 - r0) * s) * (1 + 0.16 * Math.sin(a * 5)) * (Math.random() < 0.25 ? Math.random() : 1);
      add(from.clone().addScaledVector(axis, s).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r), 0, t0 + (t1 - t0) * s);
    }
  }

  // a canopy of blossom: a few clumps of petals bunched together, flattened a little
  function blossom(center, size, count, t) {
    const clumps = [];
    for (let c = 0; c < 9; c++) {
      clumps.push(center.clone().add(V(rnd2(-1, 1), rnd2(-0.7, 0.7), rnd2(-1, 1)).multiplyScalar(size * 0.6)));
    }
    for (let i = 0; i < count; i++) {
      const c = clumps[Math.floor(Math.random() * clumps.length)];
      // bunched towards each clump's centre, so it reads as clustered flowers rather than a cloud
      const d = V(rnd2(-1, 1), rnd2(-1, 1) * 0.75, rnd2(-1, 1)).normalize().multiplyScalar(size * 0.3 * Math.random() ** 2);
      add(c.clone().add(d), 1, t);
      if (Math.random() < 0.16) add(c.clone().add(d), 2, t); // a good share of these drift off as petals
    }
  }

  // limb that forks: each branch splits in two, reaching up and outwards, blossom at the ends
  function limb(from, dir, length, radius, depth, t0) {
    const to = from.clone().addScaledVector(dir, length);
    wood(from, to, radius, radius * 0.55, t0, t0 + 0.18, Math.round(27000 * radius));
    if (depth === 0) {
      blossom(to, radius * 7 + 0.12, 700, t0 + 0.2);
      return;
    }
    if (depth === 1) blossom(to, radius * 5 + 0.08, 260, t0 + 0.2); // blossom in the crooks too
    const axisSeed = perpendicular(dir);
    for (let k = 0; k < 2; k++) {
      const spin = Math.random() * Math.PI * 2 + k * Math.PI;
      const axis = axisSeed.clone().applyAxisAngle(dir, spin);
      const child = dir.clone().applyAxisAngle(axis, 0.45 + Math.random() * 0.4).normalize();
      child.add(V(0.3, 0.26, 0)).normalize(); // keep reaching out and up, like a spreading crown
      limb(to, child, length * rnd2(0.6, 0.78), radius * 0.62, depth - 1, t0 + 0.18);
    }
  }

  limb(V(0, 0, 0), V(1, 0.3, 0).normalize(), 0.44, 0.075, 2, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(along, 1));
  geo.setAttribute('aRandom', new THREE.Float32BufferAttribute(rnd, 1));
  return geo;
}

const branchShaders = {
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uOpacity;
    uniform float uGrow; // 0 = just a stub at the trunk, 1 = grown out to the card
    uniform vec3 uBark;
    uniform vec3 uLeaf;
    attribute float aKind;
    attribute float aT;
    attribute float aRandom;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float grown = smoothstep(aT, aT + 0.14, uGrow);
      vec3 p = position;
      float fade = 1.0;
      if (aKind > 1.5) {
        // petals let go of the canopy, sway as they fall, and fade out
        float speed = 0.05 + fract(aRandom * 7.0) * 0.05; // each petal falls at its own pace
        float f = fract(uTime * speed + aRandom);
        p.y -= f * 2.6;
        p.x += sin(f * 9.0 + aRandom * 20.0) * 0.22;
        p.z += cos(f * 6.0 + aRandom * 13.0) * 0.22;
        fade = smoothstep(0.0, 0.12, f) * (1.0 - f) * 1.1; // fade in as it lets go, out as it lands
      } else if (aKind > 0.5) {
        // blossom stirs in the air
        p.y += sin(uTime * 1.4 + aRandom * 30.0) * 0.014;
        p.z += cos(uTime * 1.1 + aRandom * 21.0) * 0.014;
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float shimmer = 0.7 + 0.3 * sin(uTime * (1.0 + aRandom * 2.0) + aRandom * 50.0);
      vAlpha = (aKind > 0.5 ? 0.5 : 0.62) * shimmer * fade * uOpacity * grown;
      vColor = aKind > 0.5 ? uLeaf : uBark;
      gl_PointSize = (aKind > 0.5 ? 2.4 + aRandom * 2.0 : 2.0 + aRandom * 1.5) * uPixelRatio * (5.0 / -mv.z);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor, a * a * vAlpha);
    }`,
};

const frameShaders = {
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uOpacity;
    uniform float uReveal; // 0 scattered → 1 assembled
    uniform float uHover;
    uniform float uPulse;  // per-card offset so the border lights don't run in step
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    attribute float aKind;
    attribute float aPerim;
    attribute float aRandom;
    attribute vec3 aScatter;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float t = clamp((uReveal - aRandom * 0.45) / 0.55, 0.0, 1.0);
      float e = t * t * (3.0 - 2.0 * t);
      vec3 p = position + aScatter * (1.0 - e);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      // a light running around the border, and a gentle shimmer everywhere
      float run = aPerim < 0.0 ? 0.0 : pow(1.0 - fract(aPerim - uTime * 0.1 - uPulse), 14.0);
      float shimmer = 0.75 + 0.25 * sin(uTime * (1.5 + aRandom * 3.0) + aRandom * 60.0);
      float base = aKind > 1.5 ? 0.8 : (aKind > 0.5 ? 0.42 : 0.07);
      vAlpha = (base * shimmer + run * (0.9 + uHover)) * (1.0 + uHover * 0.5) * uOpacity * e;
      vColor = mix(uColorA, uColorB, aKind > 1.5 ? 0.75 : run);

      float size = aKind > 0.5 ? 1.6 + aRandom * 1.8 : 1.0 + aRandom * 1.2;
      gl_PointSize = size * (1.0 + run * 1.2) * uPixelRatio * (5.0 / -mv.z);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor, a * a * vAlpha);
    }`,
};

/* The card's face. A plain textured plate most of the time, with the picture torn into bands and
   its colour channels pulled apart during a glitch — the same fault the wordmark and the figure
   run, so the whole site breaks up in one language. */
const panelShaders = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform vec2 uMapScale;   // the window on the picture this card shows
    uniform vec2 uMapOffset;
    uniform float uHasMap;
    uniform float uOpacity;
    uniform float uTint;    // how bright this card may show its banner
    uniform float uGlitch;  // 0 steady, 1 mid-fault
    uniform float uSeed;
    uniform vec3 uBlank;    // the plate a project with no banner falls back to
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n * 78.233 + uSeed) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      if (uHasMap < 0.5) {
        gl_FragColor = vec4(uBlank, uOpacity);
        return;
      }
      // bands of the picture slide sideways, each by its own amount and only some of them at all
      float band = floor(uv.y * 17.0);
      float roll = hash(band);
      float slip = step(0.62, hash(band + 11.0)) * (roll - 0.5) * 0.16 * uGlitch;
      uv.x = clamp(uv.x + slip, 0.0, 1.0);

      // into the part of the picture this card shows, and never outside it
      vec2 m = uv * uMapScale + uMapOffset;
      float lo = uMapOffset.x + 0.001;
      float hi = uMapOffset.x + uMapScale.x - 0.001;

      // and the channels come apart, further on the bands that moved
      float split = (0.004 + abs(slip) * 0.35) * uGlitch * uMapScale.x;
      float r = texture2D(uMap, vec2(clamp(m.x + split, lo, hi), m.y)).r;
      float g = texture2D(uMap, m).g;
      float b = texture2D(uMap, vec2(clamp(m.x - split * 0.75, lo, hi), m.y)).b;
      vec3 colour = vec3(r, g, b);

      // the odd band blows out white for a frame, the way a dropped line does on tape
      colour += step(0.93, hash(band + 31.0)) * uGlitch * 0.35;
      gl_FragColor = vec4(colour * uTint, uOpacity);
    }`,
};

export function createIndex({ projects, scene, camera, isMobile, onSelect }) {
  const RADIUS = isMobile ? 1.7 : 3;
  const CARD_SCALE = isMobile ? 1.2 : 2.3;
  const list = document.querySelector('#index .index-cards');
  const last = projects.length - 1;
  const frameGeo = buildFrameGeometry();
  const panelGeo = buildPanelGeometry();
  const branchGeo = buildBranchGeometry();
  let branchesOn = false;
  let solidBacking = false; // a lit model behind the cards needs fully opaque panels
  const pixelRatio = Math.min(devicePixelRatio, 2);

  let scroll = 0; // which project is at the front (fractional while moving)
  let velocity = 0;
  let snapTo = null;
  let exit = 0;       // 0 on the spiral, 1 once the cards have drifted away
  /* Opening a project starts by presenting its card: the spiral holds still while that one card
     straightens out of its lean, slides to the middle of the screen and squares up to the camera.
     Only then does the page grow out of it, so the picture never jumps from a tilted card to a
     straight frame. `present` runs 0 → 1 for the card named by presentIndex. */
  let present = 0;
  let clockNow = 0;   // the update loop's time, so a fault can be asked for from outside it
  let presentTarget = 0;
  let presentIndex = -1;
  const presentPos = new THREE.Vector3();
  const presentDir = new THREE.Vector3();
  let exitTarget = 0;
  let slide = 0;      // world units the whole spiral is carried to the left, handing over to contact
  let openedAt = -Infinity;
  let wasOpen = false;

  const items = projects.map((p, n) => {
    const card = new THREE.Group();
    card.scale.setScalar(CARD_SCALE);
    card.visible = false;

    const frameMaterial = new THREE.ShaderMaterial({
      ...frameShaders,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: 0 },
        uReveal: { value: 0 },
        uHover: { value: 0 },
        uPulse: { value: n * 0.37 },
        uColorA: { value: new THREE.Color(p.colors[0]) },
        uColorB: { value: new THREE.Color(p.colors[1]) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const frame = new THREE.Points(frameGeo, frameMaterial);
    frame.frustumCulled = false;
    const panelMaterial = new THREE.ShaderMaterial({
      ...panelShaders,
      uniforms: {
        uMap: { value: null },
        uMapScale: { value: new THREE.Vector2(1, 1) },
        uMapOffset: { value: new THREE.Vector2(0, 0) },
        uHasMap: { value: 0 },
        uOpacity: { value: 0 },
        uTint: { value: CARD_LIGHT },
        uGlitch: { value: 0 },
        uSeed: { value: Math.random() * 100 },
        uBlank: { value: new THREE.Color(0x07070b) },
      },
      transparent: true,
      depthWrite: false,
    });
    const panel = new THREE.Mesh(panelGeo, panelMaterial);
    panel.frustumCulled = false;
    card.add(panel, frame);
    scene.add(card);

    /* The card's face is the client's banner. The banners are much wider than a card, so the
       texture is cropped to the middle of the picture rather than squeezed into the shape — which
       is where every one of these puts its logo. */
    const bannerUrl = bannerFor(p.title);
    if (bannerUrl) {
      new THREE.TextureLoader().load(bannerUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const cover = (CARD_W / CARD_H) / BANNER_ASPECT;
        panelMaterial.uniforms.uMapScale.value.set(cover, 1);
        panelMaterial.uniforms.uMapOffset.value.set((1 - cover) / 2, 0);
        panelMaterial.uniforms.uMap.value = texture;
        panelMaterial.uniforms.uHasMap.value = 1;
      });
    }

    // branch from the trunk out to this card (only shown for the tree axis)
    const branchMaterial = new THREE.ShaderMaterial({
      ...branchShaders,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: 0 },
        uGrow: { value: 0 },
        uBark: { value: new THREE.Color('#c9a98f') },
        // sakura pink, tinted towards the project's own colour
        uLeaf: { value: new THREE.Color('#ff8fc8').lerp(new THREE.Color(p.colors[0]), 0.35) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const branch = new THREE.Points(branchGeo, branchMaterial);
    branch.frustumCulled = false;
    branch.visible = false;
    scene.add(branch);

    // invisible hit area over the card, with its text label in the bottom-left corner
    const hit = document.createElement('button');
    hit.className = 'index-hit';
    hit.setAttribute('aria-label', `${p.title}, ${p.client}`);
    const label = document.createElement('div');
    label.className = 'index-label';
    const meta = document.createElement('span');
    meta.className = 'index-meta';
    meta.textContent = `${pad(n + 1)} · ${p.tags}`;
    const title = document.createElement('strong');
    title.textContent = p.title;
    const cat = document.createElement('span');
    cat.className = 'index-cat';
    cat.textContent = p.client;
    label.append(meta, title, cat);
    list.append(hit, label);

    const item = {
      card, frame, panel, frameMaterial, panelMaterial, branch, branchMaterial, hit, label,
      hover: false,
      front: false,
      glitchNext: 0,   // when this card next breaks up, and how long for
      glitchUntil: 0,
    };
    hit.addEventListener('click', () => {
      snapTo = n;
      onSelect(p, hit);
    });
    hit.addEventListener('mouseenter', () => { item.hover = true; });
    hit.addEventListener('mouseleave', () => { item.hover = false; });
    return item;
  });

  // Move one project along. The spring carries whatever speed it already has, so stepping again
  // mid-glide simply extends the journey instead of stuttering.
  function step(dir) {
    snapTo = THREE.MathUtils.clamp(Math.round(snapTo ?? scroll) + dir, 0, last);
  }

  const world = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const attach = new THREE.Vector3();
  const reach = new THREE.Vector3();
  const toScreen = (v) => {
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight];
  };

  function update(dt, open, time) {
    // One critically damped spring carries the whole motion. A flick gives it a starting speed and
    // picks the card it is heading for; the spring decelerates into that card on its own. There are
    // no separate coast and settle stages to hand over between, and re-aiming at another card only
    // changes the acceleration, never the speed, so the spiral (and the spine) never jerks.
    const target = snapTo ?? Math.round(scroll);
    velocity += ((target - scroll) * STIFFNESS - velocity) * (1 - Math.exp(-STIFFNESS * 4 * dt));
    scroll += velocity * dt;
    if (Math.abs(scroll - target) < 0.0008 && Math.abs(velocity) < 0.01) {
      scroll = target;
      velocity = 0;
      snapTo = null;
    }

    exit = damp(exit, exitTarget, 2.6, dt);
    clockNow = time;
    present = damp(present, presentTarget, 9, dt);
    if (open && !wasOpen) openedAt = time;
    wasOpen = open;

    // nearer cards draw later, so each card's panel covers the cards (and spine) behind it
    const order = items.map((_, n) => n).sort((a, b) => Math.cos((b - scroll) * STEP_ANGLE) - Math.cos((a - scroll) * STEP_ANGLE));

    items.forEach((item, n) => {
      const rel = n - scroll;
      const angle = rel * STEP_ANGLE;
      world.set(RADIUS * Math.sin(angle), -rel * STEP_Y, RADIUS * Math.cos(angle));

      // cards round the back of the spine fade away; the spiral fades out towards its ends
      const facing = (Math.cos(angle) + 1) / 2;
      const ends = 1 - THREE.MathUtils.smoothstep(Math.abs(rel), 2.5, 4);
      let opacity = (open ? THREE.MathUtils.smoothstep(facing, 0.15, 0.75) * ends : 0) * (1 - exit);
      // everything but the card being presented steps back, so the one you picked is alone on screen
      if (present > 0.001 && n !== presentIndex) opacity *= 1 - present;

      const fu = item.frameMaterial.uniforms;
      fu.uTime.value = time;
      fu.uOpacity.value = damp(fu.uOpacity.value, opacity, 6, dt);
      fu.uHover.value = damp(fu.uHover.value, item.hover ? 1 : 0, 6, dt);
      // assemble from scattered particles when the Index opens, nearest cards first
      fu.uReveal.value = open ? Math.min(1, Math.max(0, (time - openedAt - Math.abs(rel) * 0.12) / 1.4)) : damp(fu.uReveal.value, 0, 3, dt);
      item.panelMaterial.uniforms.uOpacity.value = fu.uOpacity.value * Math.min(1, fu.uReveal.value * 1.5) * (solidBacking ? 1 : 0.93);
      /* The banner is held well below full brightness, and further back still when the card is not
         the one you are looking at. The scene's bloom starts at a luminance of 0.15, so a banner on
         a white ground — and several of them are — would otherwise blow out into a lamp and take
         the card's border and the labels with it. CARD_LIGHT is the ceiling; the page's own copy of
         the banner is lit from it up to full as the frame flies, so the two never disagree. */
      const pu = item.panelMaterial.uniforms;
      if (pu.uHasMap.value) {
        const lit = Math.max(1 - THREE.MathUtils.smoothstep(Math.abs(rel), 0, 1), item.hover ? 1 : 0);
        pu.uTint.value = CARD_LIGHT * (0.42 + 0.58 * lit);
        /* Only the card you are looking at faults, and only in short bursts: a spiral of glitching
           cards would read as a broken page rather than as the house style. */
        if (Math.abs(rel) < 1.2 && !solidBacking) {
          if (time > item.glitchNext) {
            item.glitchNext = time + 1.1 + Math.random() * 2.6;
            item.glitchUntil = time + 0.09 + Math.random() * 0.1;
            pu.uSeed.value = Math.random() * 100;
          }
          pu.uGlitch.value = time < item.glitchUntil ? 0.7 + Math.random() * 0.3 : 0;
        } else {
          pu.uGlitch.value = 0;
        }
      }
      item.card.visible = fu.uOpacity.value > 0.005;
      const rank = order.indexOf(n);
      item.panel.renderOrder = 10 + rank * 2;
      item.frame.renderOrder = 11 + rank * 2;

      // branch: from the trunk, just below the card's row, out to the card's inner edge
      const bu = item.branchMaterial.uniforms;
      bu.uTime.value = time;
      bu.uOpacity.value = damp(bu.uOpacity.value, branchesOn ? Math.max(opacity, 0.25 * ends) : 0, 4, dt);
      bu.uGrow.value = open && branchesOn
        ? Math.min(1, Math.max(0, (time - openedAt - Math.abs(rel) * 0.12) / 1.6))
        : damp(bu.uGrow.value, 0, 3, dt);
      item.branch.visible = bu.uOpacity.value > 0.005;
      if (item.branch.visible) {
        // run along the trunk's lower side and out to just under the card, where it stays visible;
        // the branch bows up about 0.22 as it goes, so its leaves land at the card's bottom edge
        const drop = (CARD_H / 2) * CARD_SCALE + 0.16;
        attach.set(0, world.y - drop, 0);
        reach.set(world.x * 0.85, world.y - drop, world.z * 0.85).sub(attach);
        const length = reach.length();
        item.branch.position.copy(attach);
        item.branch.quaternion.setFromUnitVectors(X_AXIS, reach.normalize());
        item.branch.scale.setScalar(length);
        item.branch.renderOrder = 9 + rank * 2; // drawn with its own card, so only nearer cards cover it
      }
      if (!open) return;

      // the focused card faces the viewer with a slight lean; the others turn with the spiral
      const focus = 1 - THREE.MathUtils.smoothstep(Math.abs(rel), 0, 1);
      // as the view hands over to contact the cards drift outwards and up, out of the way
      item.card.position.copy(world).multiplyScalar(1 + exit * 0.9);
      item.card.position.y += exit * 1.6;
      item.card.position.x -= slide; // the labels are projected from this, so they travel with it
      item.card.rotation.set(FRONT_TILT.x * focus, angle * (1 - focus) + FRONT_TILT.y * focus, FRONT_TILT.z * focus);
      /* Being presented: carried onto the camera's own axis, at the distance it already sits at, and
         turned to face the camera square on. At the end of it the card is a plain rectangle in the
         middle of the screen, which is exactly what the page's frame can grow out of. */
      if (present > 0.001 && n === presentIndex) {
        item.card.updateMatrixWorld();
        const distance = item.card.position.distanceTo(camera.position);
        presentDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        presentPos.copy(camera.position).addScaledVector(presentDir, distance);
        item.card.position.lerp(presentPos, present);
        item.card.quaternion.slerp(camera.quaternion, present);
      }
      item.card.updateMatrixWorld();

      // hit area = the card's bounding box on screen; the label sits inside its bottom-left corner
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        corner.set((cx * CARD_W) / 2, (cy * CARD_H) / 2, 0).applyMatrix4(item.card.matrixWorld);
        const [sx, sy] = toScreen(corner);
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      const width = maxX - minX;
      const labelScale = width / 760;
      item.hit.style.transform = `translate3d(${minX.toFixed(1)}px, ${minY.toFixed(1)}px, 0) scale(${(width / 100).toFixed(3)}, ${((maxY - minY) / 100).toFixed(3)})`;
      item.hit.style.zIndex = String(10 + rank);
      item.hit.style.pointerEvents = opacity < 0.3 || exit > 0.2 ? 'none' : '';
      item.label.style.transform = `translate3d(${(minX + width * 0.045).toFixed(1)}px, ${(maxY - width * 0.045).toFixed(1)}px, 0) scale(${labelScale.toFixed(3)}) translateY(-100%)`;
      // the label goes with the spiral: the page about to open carries the project's name itself
      item.label.style.opacity = (opacity * (0.35 + 0.65 * focus) * (1 - present)).toFixed(3);
      item.label.style.zIndex = String(10 + rank);
      const front = Math.abs(rel) < 0.5;
      if (front !== item.front) { item.label.classList.toggle('is-front', front); item.front = front; }
      item.label.classList.toggle('is-hover', item.hover);

    });
  }

  return {
    update,
    step,
    setBranches: (on) => { branchesOn = on; },
    setSolidBacking: (on) => { solidBacking = on; },
    focus: (n) => { snapTo = n; },
    // present a card ready for its page to grow out of it, and let it fall back into the spiral
    present: (n) => { presentIndex = n; presentTarget = 1; snapTo = n; },
    /* Break a card up on demand. Clicking one faults it before it lifts off, so the move is led
       into by the picture losing its hold rather than starting clean. */
    fault: (n, ms = 320) => {
      const item = items[n];
      if (!item) return;
      item.glitchUntil = clockNow + ms / 1000;
      item.glitchNext = item.glitchUntil + 1.2;
      item.panelMaterial.uniforms.uSeed.value = Math.random() * 100;
    },
    // driven straight from the page's own move on the way back, so the two never drift apart
    scrubPresent: (v) => { present = presentTarget = Math.max(0, Math.min(1, v)); },
    release: () => { presentTarget = 0; },
    presented: () => present,
    setExit: (v) => { exitTarget = typeof v === 'number' ? v : v ? 1 : 0; },
    setSlide: (x) => { slide = x; },
    atEnd: () => scroll > last - 0.08,
    atStart: () => scroll < 0.08,
    angle: () => -scroll * STEP_ANGLE,
    lift: () => scroll * STEP_Y,
  };
}
