import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createIndex, SPINE_GAP } from './spiral.js';
import { createAtmosphere } from './atmosphere.js';
import { createStatic } from './static.js';
import { openProject, closeProject, onFlight, projectWhite, onNext, showNext, onGlitch } from './project.js';

/* =========================================================
   CONTENT — edit your slides here.
   title:     big headline
   client:    first info line (solution category)
   tags:      second info line (location, etc.)
   shape:     company models: wordmark | hanger | shield | vinyl | openBox | gemRing | armchair
              | pallet | windscreen | diamond | house | glasses
              generic: sphere | cube | wave | helix | torus | grid
   colors:    two hex colours the particles blend between
   places:    map pins (keys in PLACES in map.js); the map zooms into the first one's country
   mapView:   'world' → show the whole world with every pin instead of zooming in
   spin:      true → rotate continuously (for symmetric shapes); otherwise sway around the front view
   summary:   short overview; the project then appears in the Index view and gets a "View overview" button
   caseStudy: { ask, solution, dizruption } → adds the three case study sections to the overview
   results:   [{ value, suffix, label }] → headline numbers that count up on the case page (real only)
   cta:       { label, panel } → button that opens a panel (about | solutions | contact)
   ========================================================= */
const PROJECTS = [
  {
    title: 'Dizrupt',
    places: ['mumbai', 'london', 'newYork', 'bangkok', 'antwerp', 'dubai', 'hongKong', 'johannesburg'],
    mapView: 'world',
    client: 'The solutions designed for what’s next',
    tags: 'Full stack digital marketing agency · Mumbai',
    shape: 'wordmark', colors: ['#5b7cff', '#d4b8ff'],
    cta: { label: 'Explore solutions', panel: 'solutions' },
  },
  {
    title: 'SlickFix',
    summary: 'Slickfix, a fashion accessory brand established in India, provides products that act as a fashion solution, helping women and men overcome their daily dressing dilemmas.',
    places: ['mumbai'],
    client: 'Social & Paid Media Management · Production',
    tags: 'Fashion accessories · India',
    shape: 'hanger', colors: ['#ff3d8b', '#ffc2da'],
    caseStudy: {
      ask: 'Slickfix, a fashion accessory brand established in India, provides products that act as a fashion solution, helping women and men overcome their daily dressing dilemmas. Facing a creative block on their social media, they sought out Dizrupt to provide a unique and fresh approach.',
      solution: 'Our team provided Slickfix with social media, SEO and paid media management solutions, which includes thorough industry research, competitive analysis, brand and communication strategy, monthly content plans and boosting strategy.',
      dizruption: 'With our strategic social solutions, the brand experienced a revitalised online presence, with over 300% increase in sales, 80% increase in following, an expansion of their online community by almost 2x, and a notable uptick in product visibility. This also helped position Slickfix as a dynamic and influential presence in the fashion accessory landscape.',
    },
    results: [
      { value: 300, suffix: '%', label: 'increase in sales' },
      { value: 80, suffix: '%', label: 'increase in following' },
      { value: 2, suffix: '×', label: 'online community' },
    ],
  },
  {
    title: 'Alwrite',
    summary: 'Alwrite is a one of a kind, B2B insurtech start-up in India that aims to transform the commercial insurance industry by redefining the placement and underwriting process via innovative technology.',
    places: ['mumbai'],
    client: 'Branding Solutions',
    tags: 'B2B insurtech · India',
    shape: 'shield', colors: ['#3d6bff', '#b8c8ff'],
    caseStudy: {
      ask: 'Alwrite is a one of a kind, B2B insurtech start-up in India that aims to transform the commercial insurance industry by redefining the placement and underwriting process via innovative technology. Their ask was straightforward - Alwrite needed an identity that captured the modern, tech-driven approach of the brand while resonating with the traditional roots inherent to the insurance sector.',
      solution: 'Our team dived into exhaustive research of the insurance industry, to gain a deep understanding of the sector and uncover valuable insights. From conceptualising the brand name, to creating the overall identity and meticulously designing the logo, we brought the brand to life.',
      dizruption: 'Alwrite - a combination of ‘all (one-stop-shop)’ and ‘underwriting’, presents a contemporary twist to the insurance industry. It signifies a fresh perspective injected into the insurance sector, by leveraging technological capabilities to streamline processes, thus making it accessible to all. The logo also encapsulates the innovative essence of the brand. With Alwrite, everything is set to be truly “alright.”',
    },
  },
  {
    title: 'Nykonos Entertainment',
    summary: 'Based in New York, Nykonos is an entertainment company that thrives on curating events across various electronic genres, featuring a diverse array of artists.',
    places: ['newYork'],
    client: 'Digital Content Creation',
    tags: 'Electronic music events · New York',
    shape: 'vinyl', colors: ['#8a5bff', '#ff4fd8'],
    caseStudy: {
      ask: 'Based in New York, Nykonos is an entertainment company that thrives on curating events across various electronic genres, featuring a diverse array of artists. Craving content as upbeat as their events, they reached out to Dizrupt for a creative spark.',
      solution: 'Our team executed a set of promotional videos that focused on their NYC Launch Party, including artist reveals, location reveals, save the dates, etc. The creatives transported the audience to the pulse of electrifying techno beats mixed with the upbeat spirit of New York.',
      dizruption: 'The promotional videos were able to capture the true essence of the brand and were instrumental in an uplift of the ticket sales for their events. We also got a mandate to create videos for every event ever since.',
    },
  },
  {
    title: 'Mae Mae Industrial',
    summary: 'With a legacy spanning over 40 years and catering to 500+ customers, Mae Mae Industrial stands as the one-stop packaging solution provider based in Thailand.',
    places: ['bangkok'],
    client: 'Website Development',
    tags: 'Packaging solutions · Thailand',
    shape: 'openBox', colors: ['#1fd6b8', '#2a6bff'],
    caseStudy: {
      ask: 'With a legacy spanning over 40 years and catering to 500+ customers, Mae Mae Industrial stands as the one-stop packaging solution provider based in Thailand. In the pursuit of a more modern and professional online representation, Mae Mae Industrial turned to Dizrupt for a website transformation.',
      solution: 'Recognizing the limitations of their old website, which was outdated and not user-friendly, we undertook a comprehensive 360-degree UX-UI revamp to elevate them by meeting the highest industry standards. Our approach resulted in a modern and intuitive user interface with a seamless user experience. We prioritised displaying their extensive clientele, enhancing the customer viewing experience and elevating the overall aesthetic of the website.',
      dizruption: 'The website transformation resulted in a seamless digital experience that not only aligns with modern design principles but also reinforces Mae Mae Industrial’s position as a leading packaging solution provider.',
    },
  },
  {
    title: 'Kiaash',
    summary: 'Kiaash, a UK-based fine jewellery brand, believes in elevating your every day to celebrating special moments.',
    places: ['london'],
    client: 'Social & Paid Media Management',
    tags: 'Fine jewellery · UK',
    shape: 'gemRing', colors: ['#ffb84d', '#fff1d6'],
  },
  {
    title: 'Furnfetch',
    summary: 'FurnFetch, a furniture fetching company in India, redefines furniture sourcing by offering a comprehensive and seamless process that caters to all sourcing needs.',
    places: ['mumbai'],
    client: 'Website Development',
    tags: 'Furniture sourcing · India',
    shape: 'armchair', colors: ['#ff6a3d', '#ffd9a8'],
  },
  {
    title: 'KP Packaging',
    summary: 'For over 30 years, KP Packaging has earned a great reputation as a trusted name in the packaging industry, partnering with brands like Godrej, Amul, and Cipla.',
    places: ['mumbai'],
    client: 'Branding Solutions · SEO',
    tags: 'Packaging · 30+ years · India',
    shape: 'pallet', colors: ['#3fe08a', '#d2ffe2'],
  },
  {
    title: 'AVG Windscreens',
    summary: 'AVG Windscreens, a windscreen repair and replacement company based in the UK, brings over 25 years of experience to the road.',
    places: ['london'],
    client: 'Search Engine Optimization',
    tags: 'Windscreen repair · UK',
    shape: 'windscreen', colors: ['#2ad4ff', '#dff6ff'],
  },
  {
    title: 'Samir Gems',
    summary: 'Samir Gems, an Indian-based legacy diamond manufacturing company with a global footprint across Antwerp, Hong Kong, Dubai, Johannesburg, Mumbai, New York, among others, has emerged as one of the top rough trading and manufacturing companies.',
    places: ['mumbai', 'antwerp', 'hongKong', 'dubai', 'johannesburg', 'newYork'],
    client: 'Digital Content Creation',
    tags: 'Diamond manufacturing · Global',
    shape: 'diamond', colors: ['#9fd8ff', '#ffffff'], spin: true,
  },
  {
    title: 'Maverick Realtors',
    summary: 'Maverick Realtors, a Mumbai-based real estate company with a legacy of over 30 years, is dedicated to the belief that they’re not just constructing houses; they’re building homes.',
    places: ['mumbai'],
    client: 'Digital Content Creation',
    tags: 'Real estate · Mumbai',
    shape: 'house', colors: ['#c9a36b', '#f5f1e6'],
  },
  {
    title: 'Crossline',
    summary: 'Crossline, an Indian B2B eyewear brand, provides premium, trendy and affordable eyewear for all.',
    places: ['mumbai'],
    client: 'Production Solutions',
    tags: 'B2B eyewear · India',
    shape: 'glasses', colors: ['#ff5b5b', '#ffc9b8'],
  },
];

const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
const COUNT = isMobile ? 26000 : 70000;
const TRANSITION_MS = 3000;

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

const SHAPES = {
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

/* ---------- Shaders ---------- */
// Simplex noise by Ashima Arts / Stefan Gustavson (MIT) — github.com/ashima/webgl-noise
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uArcStrength;
uniform float uCoil;
uniform float uHeadOn;    // 1 while the mascot is the shape on screen
uniform float uAurora;    // and 1 while he is to be drawn as light rather than as points
uniform float uBustHalf;  // half his height, so the swell knows where his head ends
uniform float uGlitch;    // a burst: 1 while it tears, 0 otherwise
uniform float uGlitchSeed;
uniform float uGlitchLayer; // 0 body, 1 magenta misprint, 2 cyan misprint
uniform float uBodyReveal;  // intro: body grows out of the eyes
uniform float uEyeReveal;   // intro: the curtain of light kindles before the figure gathers
uniform float uKindle;      // the flicker and breath on that light
varying float vChip;
varying float vEcho;
varying float vRay;         // where this point sits across the aurora's vertical rays
varying float vAurora;      // how much of the aurora look applies here at all
varying float vEdge;        // 1 on the silhouette, 0 deep inside him
varying float vLocalY;      // his own height, for the beam to be measured against
uniform float uHeadYaw;   // where the head is looking, radians
uniform float uHeadPitch;
uniform vec3 uHeadPivot;  // the neck, in the mascot's own space
attribute float aHead;    // >0: weighted neck/head turn; <0: full head turn for legacy eye samples
uniform float uDisperse;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uMouse;
uniform float uMouseStrength;
attribute vec3 aTarget;
attribute float aEdge;    // how near the outline of the shape being headed for this point sits
attribute float aRandom;
varying float vRandom;
varying float vAlpha;
${NOISE}
void main() {
  // Per-particle progress: staggered start, quintic ease in and out.
  // Keep in sync with particleAt() in main.js, which replays this on the CPU.
  float t = clamp((uProgress - aRandom * 0.35) / 0.65, 0.0, 1.0);
  float p = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  vec3 pos = mix(position, aTarget, p);

  // On the way, each particle bows out along its own direction and the cloud swirls a little.
  float arc = sin(p * 3.14159265);
  pos += (vec3(fract(aRandom * 12.9898), fract(aRandom * 78.233), fract(aRandom * 37.719)) - 0.5) * arc * 1.6 * uArcStrength;
  float sw = arc * 0.6 * uArcStrength, c = cos(sw), sn = sin(sw);
  pos.xz = vec2(c * pos.x - sn * pos.z, sn * pos.x + c * pos.z);

  /* uCoil winds the whole shape about its own long axis: the further along a particle sits, the
     further round it is turned, and the turn keeps advancing with time. That is what makes the
     word stand where it is and read as a coil rather than a thing travelling anywhere. Applied
     after the morph, so it is a way of holding the shape, not part of it — no freeze to mirror. */
  if (uCoil > 0.0) {
    float ang = (pos.x * 0.9 + uTime * 1.5) * uCoil;
    float ca = cos(ang), sa = sin(ang);
    pos.yz = vec2(ca * pos.y - sa * pos.z, sa * pos.y + ca * pos.z);
  }

  /* The head turns on the neck to follow the cursor. Weight fades down the neck so the shoulders
     stay put; the eyes (aHead < 0) turn with it fully. Applied in the figure's own space, before the
     scroll's turn of the whole body, so the two compose. */
  float headW = (aHead < 0.0 ? 1.0 : aHead) * uHeadOn;
  if (headW > 0.0) {
    vec3 hp = pos - uHeadPivot;
    float cy = cos(uHeadYaw * headW), sy = sin(uHeadYaw * headW);
    hp.xz = vec2(cy * hp.x + sy * hp.z, -sy * hp.x + cy * hp.z);
    float cp = cos(uHeadPitch * headW), sp = sin(uHeadPitch * headW);
    hp.yz = vec2(cp * hp.y - sp * hp.z, sp * hp.y + cp * hp.z);
    pos = hp + uHeadPivot;
  }
  /* Spider-Verse language: irregular print patches slip independently anywhere on the figure, and
     a minority of bursts knock the whole colour plate out of registration. Two extra point passes
     carry the magenta/cyan echoes while the main body stays readable. */
  vChip = 0.0;
  vEcho = 1.0;
  // gated on the aurora, not the head turn: the head turn is tied to one pose, and he is glitched
  // in both — on the landing he stands in the neutral one
  float glitch = uGlitch * uAurora;
  if (glitch > 0.0) {
    vec2 cell = floor(vec2(
      pos.x * 5.0 + uGlitchSeed * 0.31,
      pos.y * 4.5 - uGlitchSeed * 0.23
    ));
    float cellNoise = fract(sin(dot(cell, vec2(12.9898, 78.233)) + uGlitchSeed * 31.7) * 43758.5453);
    float mode = fract(sin(uGlitchSeed * 19.19) * 43758.5453);
    /* Now and then the entire plate used to slip, which on a figure made of hard points read as
       a fault and on one made of light reads as the whole man teleporting sideways. It still
       happens, but rarely, and it moves him a fraction of what it did. */
    float fullBody = step(0.94, mode);
    float regionHit = step(0.70, cellNoise);
    float activePatch = max(fullBody, regionHit);
    float tear = cellNoise - 0.5;

    if (uGlitchLayer < 0.5) {
      pos.x += activePatch * tear * 0.075 * glitch;
      pos.y += activePatch * (fract(cellNoise * 7.3) - 0.5) * 0.022 * glitch;
      // Tiny comic-book pop flecks: rare and close to the silhouette, never an exploding cloud.
      float chip = activePatch * step(0.993, fract(aRandom * 91.7 + uGlitchSeed));
      pos.x += chip * (fract(aRandom * 7.1) - 0.5) * 0.32 * glitch;
      pos.y += chip * (fract(aRandom * 3.3) - 0.5) * 0.10 * glitch;
      vChip = chip * (1.0 + floor(fract(aRandom * 5.7) * 2.0)) * glitch;
    } else {
      float direction = uGlitchLayer < 1.5 ? -1.0 : 1.0;
      pos.x += activePatch * direction * (0.070 + abs(tear) * 0.09) * glitch;
      pos.y += activePatch * direction * (0.010 + fract(cellNoise * 5.1) * 0.014) * glitch;
      // Preserve most of each patch so it reads as an offset ink plate, not random confetti.
      float plate = step(0.14, fract(aRandom * 37.1 + cellNoise * 9.0));
      vEcho = activePatch * plate * glitch;
    }
  }

  /* ---------- Aurora ----------
     He is not a dust of points standing in the shape of a man; he is a curtain of light in that
     shape. Two things make that read. The surface hangs on a long swell travelling up through him,
     so the whole form moves the way a curtain does rather than sitting still; and the light is
     organised into narrow vertical rays that slide slowly sideways, which is what an aurora
     actually is — field lines lit end on. Everything here is off unless he is the shape on screen,
     so the spine and the project models are untouched. */
  vAurora = uAurora;
  vEdge = aEdge;
  vRay = 0.0;
  if (vAurora > 0.0) {
    float climb = uTime * 0.26;
    // the long swell: low frequency, travelling upward, so he breathes rather than wobbles
    float swell = snoise(vec3(pos.x * 0.5, pos.y * 0.34 - climb, pos.z * 0.5 + 4.1));
    // and a finer ripple across it, so the motion never resolves into one repeating wave
    float ripple = snoise(vec3(pos.x * 1.9 + climb * 0.7, pos.y * 1.25 - climb * 1.6, 7.3));
    /* Almost none of that reaches his head. The displacement is small in absolute terms, but a
       head is small too, and a wobble worth a fraction of a shoulder is worth a whole jawline on a
       face — it read as the man swelling and subsiding. So the swell is held off the head and neck
       and builds downward into the traps, which is also how anything hanging actually moves: still
       where it is held, loose at the bottom. */
    float h = pos.y / uBustHalf;                       // +1 at his crown, -1 at the cut
    float sway = 0.08 + 0.92 * smoothstep(-0.35, -0.95, h);
    pos.x += (swell * 0.085 + ripple * 0.028) * vAurora * sway;
    pos.y += ripple * 0.022 * vAurora * sway;
    pos.z += (swell * 0.06 - ripple * 0.02) * vAurora * sway;
    /* The rays. Narrow columns running down him, bent by the same swell that moves him, and
       sliding sideways over time. The power curve keeps most of him in the dim body of the light
       with a few bright blades in it, which is how a curtain reads — not an even glow. */
    float ray = 0.5 + 0.5 * sin(pos.x * 6.5 + swell * 2.0 + uTime * 0.42);
    vRay = pow(ray, 2.6);
  }

  vec3 q = pos * 0.55 + uTime * 0.12;
  vec3 n = vec3(snoise(q), snoise(q + 31.4), snoise(q - 17.3));
  pos += n * (0.05 + uDisperse * 1.2);
  pos *= 1.0 + uDisperse * 0.6;

  vLocalY = pos.y;   // read after the head turn, so the beam travels down him and not past him

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec2 dir = world.xy - uMouse.xy;
  float dist = length(dir) + 1e-4;
  world.xy += (dir / dist) * smoothstep(1.3, 0.0, dist) * 0.7 * uMouseStrength;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  /* The odd bright speck, which is what gives the field its starlight — but not on the aurora,
     where a hard point in the middle of a soft light is the one thing that would read as a pixel. */
  float sparkle = step(0.985, fract(aRandom * 13.7)) * 2.0 * (1.0 - vAurora);
  /* Much larger on the aurora, and larger still on the bright rays. The points have to overlap
     several deep before they stop being points and start being light; below that no amount of
     softness will save them. */
  // only the rim is drawn, so only the rim is swollen; the inside stays small and unlit
  float swollen = 1.0 + vAurora * vEdge * (2.6 + vRay * 1.4);
  gl_PointSize = uSize * uPixelRatio * swollen * (0.4 + aRandom + sparkle) / -mv.z;

  vRandom = aRandom;
  vAlpha = 0.16 + 0.32 * fract(aRandom * 7.13) + sparkle * 0.2;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uSplit; // 0: smooth blend between the two colours, 1: bone in A, discs tinted, nerves in B
varying float vRandom;
varying float vAlpha;
varying float vChip;
varying float vEcho;
varying float vRay;
varying float vAurora;
varying float vEdge;
varying float vLocalY;
uniform float uBeam;
uniform float uBeamOn;
uniform float uGlitchLayer;
uniform float uTime;
uniform float uBodyReveal;
uniform float uEyeReveal;
uniform float uKindle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  float tone = mix(vRandom, smoothstep(0.72, 0.8, vRandom), uSplit);
  vec3 col = mix(uColorA, uColorB, tone);
  float alpha = a * a * vAlpha;
  if (uGlitchLayer > 0.5) {
    col = uGlitchLayer < 1.5 ? vec3(1.0, 0.05, 0.34) : vec3(0.04, 0.92, 1.0);
    alpha = a * a * vAlpha * vEcho * 0.62;
  } else if (vChip > 0.5) { // brief magenta/cyan print flecks
    col = vChip < 1.5 ? vec3(1.0, 0.08, 0.38) : vec3(0.05, 0.92, 1.0);
    alpha = a * 0.95;
  }

  /* ---------- Aurora ----------
     The sprite loses its edge entirely. A disc with a smoothstep falloff still has a boundary, and
     seventy thousand of them read as seventy thousand discs; an exponential never lands on one, so
     where they overlap there is nothing to see but light. Held far down in return — they are piled
     several deep and additive, and what is reasonable for one point is a white hole for all of
     them together. */
  if (vAurora > 0.0) {
    /* An exponential has no edge to find, which is the point — but it also never reaches zero, and
       whatever is left of it where the sprite is clipped draws the sprite. So it is windowed to
       nothing before the boundary, and what is left is light with no shape of its own. */
    float soft = exp(-d * d * 8.0) * smoothstep(0.5, 0.16, d);
    /* Purple throughout: deep indigo in the body of the light, the brand's violet through the
       rays, and only the very crest of a ray running up to white. An aurora is read by its
       gradient, not its hue — it is nearly all the dim part. */
    vec3 deep = vec3(0.24, 0.05, 0.52);
    vec3 lit = vec3(0.64, 0.22, 1.0);
    vec3 crest = vec3(0.92, 0.80, 1.0);
    vec3 aurora = mix(deep, lit, vRay);
    aurora = mix(aurora, crest, pow(vRay, 6.0) * 0.55);
    /* Held very far down. The sprites are wide enough to pile ten deep, they add, and the bloom
       goes over the top of that — what looks reasonable on one point is a white hole for all of
       them at once. The number below was arrived at by turning it down until he stopped being a
       lamp and started being a light. */
    /* Flat across the points on purpose. The field's usual three-fold spread in per-point alpha is
       what gives it its grain, and grain is the one thing an aurora has none of. */
    /* Only the outline. Squaring the band pulls the light onto the very edge and leaves the
       middle of him dark, so what you see is a figure drawn in light rather than filled with it —
       and the inside is not dimmed, it is simply not drawn. */
    /* A threshold, not a curve. Squaring and then cubing the band both still left a haze across
       the middle of him: tens of thousands of points whose band value is small but not nothing,
       each contributing almost none of it and all of them together contributing a fill. Anything
       that is not close to the outline now contributes exactly zero. */
    /* The threshold sits low now: the value it reads is a lighting term, not a distance, and most
       of a body at a grazing angle lands well under half. Cutting at the old level left only the
       hardest edges and threw the modelling away. */
    float rim = smoothstep(0.32, 0.80, vEdge);
    /* The rays used to carry nearly all the brightness, which meant a jawline only showed where a
       ray happened to cross it and read as dashes rather than as a jaw. The band itself now carries
       most of it and the rays modulate what is already there, so the structure is continuous and
       the aurora runs over it. */
    float glow = soft * (0.45 + 0.62 * vRay) * uKindle * rim;
    col = mix(col, aurora, vAurora);
    alpha = mix(alpha, glow * (0.019 + 0.060 * vAlpha), vAurora);
  }

  /* The beam. Everything it has already passed is lit and stays lit; everything below it is still
     dark; and the beam itself is a bright edge travelling down him. He never moves — this is the
     whole of his arrival. */
  float reveal = uBodyReveal;
  if (uBeamOn > 0.5) {
    float passed = smoothstep(uBeam - 0.05, uBeam + 0.22, vLocalY);
    float crest = exp(-pow((vLocalY - uBeam) * 5.5, 2.0));
    reveal = passed;
    alpha += crest * a * 0.05 * vAurora * smoothstep(0.02, 0.35, vEdge);
  }
  gl_FragColor = vec4(col, alpha * uOpacity * reveal);
}`;

/* ---------- Scene ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const pixelRatio = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
const CAMERA_Z = isMobile ? 9.5 : 7; // where the camera rests once the intro has landed
camera.position.z = CAMERA_Z;

const randoms = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) randoms[i] = Math.random();

const shapeAttrs = PROJECTS.map((p) => {
  const arr = new Float32Array(COUNT * 3);
  (SHAPES[p.shape] || SHAPES.sphere)(arr);
  return new THREE.BufferAttribute(arr, 3);
});
// Colours for the spine column the Index spiral winds around.
const SPINE_COLORS = ['#efe4d2', '#58c4ff']; // bone, cord

const fromAttr = new THREE.BufferAttribute(new Float32Array(shapeAttrs[0].array), 3);
fromAttr.setUsage(THREE.DynamicDrawUsage);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', fromAttr);
geometry.setAttribute('aTarget', shapeAttrs[0]);
/* How near the silhouette a particle sits in the shape it is heading for. Only the mascot has one;
   every other shape leaves it at zero, and the aurora is off for those anyway. */
geometry.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
geometry.setAttribute('aHead', new THREE.BufferAttribute(new Float32Array(COUNT), 1));

const uniforms = {
  uTime: { value: 0 },
  uProgress: { value: 1 },
  uArcStrength: { value: 1 },
  uDisperse: { value: 4 },
  uCoil: { value: 0 },
  uHeadOn: { value: 0 },
  uHeadYaw: { value: 0 },
  uHeadPitch: { value: 0 },
  uHeadPivot: { value: new THREE.Vector3() },
  uGlitch: { value: 0 },
  uGlitchSeed: { value: 0 },
  uGlitchLayer: { value: 0 },
  uBodyReveal: { value: 1 },
  uEyeReveal: { value: 1 },
  uKindle: { value: 1 },
  uSize: { value: 22 },
  uPixelRatio: { value: pixelRatio },
  uMouse: { value: new THREE.Vector3(99, 99, 0) },
  uMouseStrength: { value: 0 },
  uOpacity: { value: 1 },
  uColorA: { value: new THREE.Color(PROJECTS[0].colors[0]) },
  uColorB: { value: new THREE.Color(PROJECTS[0].colors[1]) },
  uSplit: { value: 0 },
  uAurora: { value: 0 },
  uBeam: { value: -9 },     // where the reveal beam stands, in the figure's own height
  uBeamOn: { value: 0 },    // 1 while the beam is what decides whether he is lit
  uBustHalf: { value: 1 },  // half his height, so the swell can be measured against him
};

const material = new THREE.ShaderMaterial({
  uniforms, vertexShader, fragmentShader,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const group = new THREE.Group();
const points = new THREE.Points(geometry, material);
points.frustumCulled = false;

// Separate misregistered colour plates are only drawn during a burst. Sharing every uniform object
// except uGlitchLayer keeps them perfectly in step with the body without another update loop.
const makeGlitchPlate = (layer) => {
  const plateMaterial = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uGlitchLayer: { value: layer } },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const plate = new THREE.Points(geometry, plateMaterial);
  plate.frustumCulled = false;
  plate.visible = false;
  return plate;
};
const glitchGhosts = [makeGlitchPlate(1), makeGlitchPlate(2)];
group.add(points, ...glitchGhosts);
scene.add(group);

const atmosphere = createAtmosphere({ scene, camera, colorA: uniforms.uColorA.value, colorB: uniforms.uColorB.value });
const clients = PROJECTS.filter((p) => p.summary);
const PRESENT_MS = 520; // how long the card takes to square up before its page grows out of it
let presentTimer = 0;
const index = createIndex({
  projects: clients,
  scene,
  camera,
  isMobile,
  onSelect: (p, hit) => {
    goTo(PROJECTS.indexOf(p), { force: true });
    /* The card loses its hold first: it breaks up, and the field behind it with it. Only then does
       it straighten and slide to the middle of the screen, and only then does the page grow out of
       it. Starting the move clean and glitching afterwards reads as an effect laid over a
       transition; this way the fault is what sets the move off. */
    index.fault(clients.indexOf(p), 340);
    triggerGlitch(320, 0.9);
    index.present(clients.indexOf(p)); // the spiral counts in clients, not in every project
    clearTimeout(presentTimer);
    presentTimer = setTimeout(() => openCaseStudy(p, hit), PRESENT_MS);
  },
});

/* Going back, the card leans out of the middle of the screen and into its place on the spiral
   while the page is still shrinking onto it, rather than waiting for it to land and then snapping.
   The lean is finished a little before the page is, so the card is home as the frame meets it. */
onFlight((t, closing) => { if (closing) index.scrubPresent(t / 0.7); });
// the page's own fault pulls the particle field apart with it, in both directions
onGlitch((ms) => triggerGlitch(ms, 0.85));

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
/* Full-resolution bloom, and a tight radius. At half resolution the coarsest mip in the chain is a
   texel some forty pixels across, and a small bright thing — his eyes on black, with nothing else
   in the frame — blooms into a visible soft square rather than a glow. */
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.22, 0.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let introShapeResizeTimer = 0;
function resizeScene() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
  atmosphere.resize();
  clearTimeout(introShapeResizeTimer);
  introShapeResizeTimer = setTimeout(() => {
    if (intro.active && !intro.handover) prepareIntroShapes();
  }, 120);
}
addEventListener('resize', resizeScene);
window.visualViewport?.addEventListener('resize', resizeScene);
new ResizeObserver(resizeScene).observe(document.documentElement);

/* ---------- State & transitions ---------- */
// The rendered headline is sampled only to recover its responsive width and a stable left-to-right
// particle ordering. The sampled glyph shape is never shown; DIZRUPT remains DOM text throughout.
let wordAttr = null;
let introLineAttr = null;
let introWave = null;
let introWaveUniforms = null;

function buildIntroWordAttr() {
  const word = document.getElementById('intro-word');
  const box = word.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(box.width));
  const height = Math.max(1, Math.ceil(box.height));
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d', { willReadFrequently: true });
  const style = getComputedStyle(word);
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing;
  const text = 'DIZRUPT';
  const metrics = ctx.measureText(text);
  const baseline = height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  ctx.fillText(text, width / 2, baseline);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const candidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > 28) candidates.push(y * width + x);
    }
  }

  const arr = new Float32Array(COUNT * 3);
  const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
  const pxToWorld = visibleH / innerHeight;
  if (!candidates.length) {
    SHAPES.wordmark(arr, { size: box.width * pxToWorld, euler: new THREE.Euler(0, 0, 0), lift: 0 });
  } else {
    for (let i = 0; i < COUNT; i++) {
      const pixel = candidates[(Math.random() * candidates.length) | 0];
      const x = pixel % width;
      const y = (pixel / width) | 0;
      arr[i * 3] = (x + Math.random() - 0.5 - width / 2) * pxToWorld;
      arr[i * 3 + 1] = (height / 2 - y + Math.random() - 0.5) * pxToWorld;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.035;
    }
  }
  const attr = new THREE.BufferAttribute(arr, 3);
  attr.introWidth = box.width * pxToWorld;
  return attr;
}

// Re-form the word as an airy particle ribbon. Sorting the source particles by x and assigning the
// target positions in the same order fills the gaps between letters without making particles cross
// the whole word, so the change still reads as one smooth collapse rather than a random scramble.
function buildIntroLineAttr(source) {
  const src = source.array;
  const arr = new Float32Array(src.length);
  const width = source.introWidth || 7;
  const order = Array.from({ length: COUNT }, (_, i) => i)
    .sort((a, b) => src[a * 3] - src[b * 3]);

  for (let rank = 0; rank < COUNT; rank++) {
    const i = order[rank];
    const i3 = i * 3;
    const u = rank / Math.max(COUNT - 1, 1);
    const nx = u * 2 - 1;

    // A long, asymmetric wave: the broad first harmonic makes the sweep, while the smaller one
    // prevents it feeling like a mathematically perfect sine curve.
    const wave = Math.sin((nx + 0.16) * Math.PI * 1.08) * 0.42
      + Math.sin(nx * Math.PI * 2.7 + 0.7) * 0.11
      - nx * 0.07;
    const middle = 1 - Math.abs(nx);
    const core = 0.075 + middle * 0.09 + (0.5 + 0.5 * Math.sin(nx * 9.1 + 1.2)) * 0.045;
    const dust = Math.random();
    const spread = dust < 0.035 ? 0.72 : dust < 0.20 ? 0.34 : core;
    const power = dust < 0.035 ? 0.8 : dust < 0.20 ? 1.25 : 2.25;
    const signed = (Math.random() < 0.5 ? -1 : 1) * Math.pow(Math.random(), power);

    arr[i3] = nx * width * 0.49
      + Math.sin(nx * 6.4) * 0.045
      + (Math.random() - 0.5) * (dust < 0.20 ? 0.15 : 0.035);
    arr[i3 + 1] = wave + signed * spread;
    arr[i3 + 2] = (Math.random() - 0.5) * (dust < 0.20 ? 0.34 : 0.09);
  }
  const attr = new THREE.BufferAttribute(arr, 3);
  attr.introWidth = width;
  return attr;
}

// The intro wave has its own point cloud. The project field can therefore remain a spine behind
// it instead of having to turn from a word into a line and then into an unrelated 3D object.
function installIntroWave(attr) {
  if (!introWave) {
    const waveGeometry = new THREE.BufferGeometry();
    waveGeometry.setAttribute('position', attr);
    waveGeometry.setAttribute('aTarget', attr);
    waveGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    introWaveUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 1 },
      uArcStrength: { value: 0 },
      uDisperse: { value: 0 },
      uCoil: { value: 0 },
      uHeadOn: { value: 0 },
      uHeadYaw: { value: 0 },
      uHeadPitch: { value: 0 },
      uHeadPivot: { value: new THREE.Vector3() },
      uGlitch: { value: 0 },
      uGlitchSeed: { value: 0 },
      uGlitchLayer: { value: 0 },
      uKindle: { value: 1 },
      uAurora: { value: 0 },
      uBeam: { value: -9 },
      uBeamOn: { value: 0 },
      uBustHalf: { value: 1 },
      uSize: { value: isMobile ? 7 : 8.5 },
      uPixelRatio: { value: pixelRatio },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
      uMouseStrength: { value: 0 },
      uOpacity: { value: 0 },
      uColorA: { value: new THREE.Color('#ffffff') },
      uColorB: { value: new THREE.Color('#c9dcff') },
      uSplit: { value: 0 },
    };
    const waveMaterial = new THREE.ShaderMaterial({
      uniforms: introWaveUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    introWave = new THREE.Points(waveGeometry, waveMaterial);
    introWave.frustumCulled = false;
    introWave.renderOrder = 100;
    introWave.visible = false;
    scene.add(introWave);
  } else {
    introWave.geometry.setAttribute('position', attr);
    introWave.geometry.setAttribute('aTarget', attr);
  }
}

async function prepareIntroShapes() {
  // A slow/blocked Google Fonts request must not strand the landing screen at 100%. Give the
  // requested face a short chance to settle, then sample the already-rendered system fallback.
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch { /* system font fallback is still sampleable */ }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  wordAttr = buildIntroWordAttr();
  introLineAttr = buildIntroLineAttr(wordAttr);
  installIntroWave(introLineAttr);
  if (window.site) Object.assign(window.site, { wordAttr, introLineAttr });
}

const spineAttr = (() => {
  const arr = new Float32Array(COUNT * 3);
  SHAPES.spine(arr);
  return new THREE.BufferAttribute(arr, 3);
})();

/* The mascot standing where the spine used to. Both poses are sampled from Claude's rigged blend
   with identical surface coordinates, so the bicep curl moves each particle with its patch of skin
   rather than dissolving one unrelated point cloud into another. */
/* Upper body only. The point clouds on disk are the whole figure — they are built by the other
   pipeline and left alone — so the crop happens here, on the way in: everything below BUST_CUT of
   the figure's height is dropped, with the last stretch of it thinning out rather than ending on a
   flat line across the hips. What is kept is then scaled to stand BUST_HEIGHT tall and centred on
   the eyes, so the face sits in the middle of the screen. */
const BUST_CUT = 0.82;    // fraction of the full height below which nothing is kept:
                          // the face and the traps, and no further down — no shoulders, no arms
const BUST_FADE = 0.055;  // fraction of the height over which it thins out towards that cut
const KINDLE_ZOOM = 1.28; // how far in the view sits while he is only a curtain of light
/* He fills the frame. The visible height at the camera's rest distance is a shade under six units;
   his head alone takes better than half of that, his crown sits near the top edge, and his traps
   run out past both sides and off the bottom. Written as a crown position rather than a centre,
   because where the top of his head lands is the thing that has to be right — the rest of him
   follows it down and out of frame. */
const BUST_HEIGHT = 4.45;
const BUST_TOP = 2.1;                           // where his crown sits, near the top of the frame
const BUST_DROP = BUST_TOP - BUST_HEIGHT / 2;   // ...and the middle that puts it there
uniforms.uBustHalf.value = BUST_HEIGHT / 2;
/* Behind the spiral he is a backdrop, not the subject. Cropped this close and at the size the
   landing shows him, a head the height of the frame sits squarely over the card you are meant to
   be looking at — so on the Index he stands back and lifts, and only his crown clears the cards. */
const INDEX_SCALE = 0.40;
const CASE_SHIFT = 2.35; // how far right the client's model moves while its case study is open
const INDEX_LIFT = 0.5;
/* The mascot now ships everywhere. To hold him back on a host (e.g. while a new figure is being
   signed off) set MASCOT_EVERYWHERE to false: he then only appears on localhost. Either way,
   ?mascot=0 / ?mascot=1 on the URL forces it off or on, for reviewing both versions. */
const MASCOT_EVERYWHERE = true;
const mascotParam = new URLSearchParams(location.search).get('mascot');
const USE_MASCOT = mascotParam !== null
  ? mascotParam !== '0'
  : MASCOT_EVERYWHERE || ['localhost', '127.0.0.1'].includes(location.hostname);
let mascotAttr = null;
let mascotNeutralAttr = null;
let mascotFlexAttr = null;
const centrepiece = () => mascotAttr || spineAttr;

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

function edgeField(positions) {
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

/* Which shape the field is heading for, and the rim that belongs to it. The two are set together
   or the light would be drawn along the outline of the pose he has just left. */
const flatEdge = new THREE.BufferAttribute(new Float32Array(COUNT), 1);
function setTarget(attr) {
  geometry.setAttribute('aTarget', attr);
  geometry.setAttribute('aEdge', attr.edge || flatEdge);
}

async function loadMascot() {
  if (!USE_MASCOT) return;
  try {
    const [neutralResponse, flexResponse, metaResponse] = await Promise.all([
      fetch('mascot-neutral-claude.bin'),
      fetch('mascot-flex-claude.bin'),
      fetch('mascot-transition-claude.json'),
    ]);
    if (!neutralResponse.ok || !flexResponse.ok || !metaResponse.ok) throw new Error('mascot transition unavailable');
    const [neutralRaw, flexRaw, meta] = await Promise.all([
      neutralResponse.arrayBuffer().then((buffer) => new Int16Array(buffer)),
      flexResponse.arrayBuffer().then((buffer) => new Int16Array(buffer)),
      metaResponse.json(),
    ]);
    const available = (neutralRaw.length / 4) | 0; // x, y, z, and the head channel
    if (!available || flexRaw.length !== neutralRaw.length) throw new Error('invalid paired mascot data');
    const head = geometry.attributes.aHead.array;
    const eyeAvailable = Math.min(meta.eyes || 0, available);
    const bodyAvailable = available - eyeAvailable;

    /* The file's own units, where the whole figure is exactly 1 tall. Working in these rather than
       in world units keeps the crop independent of how big the figure ends up on screen. */
    const unit = (raw) => raw * 0.75 / 32767;
    let low = Infinity, high = -Infinity;
    for (let k = 0; k < bodyAvailable; k++) {
      const z = unit(neutralRaw[k * 4 + 2]);
      if (z < low) low = z;
      if (z > high) high = z;
    }
    const cut = low + (high - low) * BUST_CUT;
    const fade = (high - low) * BUST_FADE;
    // the same points every load: a hash of the index, not a random number
    const noise = (k) => fract(Math.sin(k * 12.9898) * 43758.5453);
    const kept = [];
    for (let k = 0; k < bodyAvailable; k++) {
      const above = (unit(neutralRaw[k * 4 + 2]) - cut) / fade;
      if (above <= 0 || (above < 1 && noise(k) > above)) continue;
      kept.push(k);
    }
    if (!kept.length) throw new Error('nothing left of the figure above the cut');

    /* Across, he is centred on the samples the file marks as his face, which is where the framing
       should be built around — the bounding box is thrown sideways by whichever arm is raised. Up
       and down he is centred on the kept part itself, so the whole bust is in frame. */
    let faceX = 0;
    for (let k = bodyAvailable; k < available; k++) faceX += unit(neutralRaw[k * 4]);
    const acrossMid = eyeAvailable ? faceX / eyeAvailable : 0;
    const middle = (cut + high) / 2;
    const scale = BUST_HEIGHT / (high - cut);

    /* No eyes. The face is blank, the way the mascot's own is, and every particle in the file goes
       to the body — the samples the file marks as eyes are simply not read. */
    const sourceIndex = (i) => kept[Math.min(kept.length - 1, Math.floor(i * kept.length / COUNT))];

    const decode = (raw, writeHead = false) => {
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

    mascotNeutralAttr = decode(neutralRaw, true);
    mascotFlexAttr = decode(flexRaw);
    mascotAttr = mascotFlexAttr;
    geometry.attributes.aHead.needsUpdate = true;
    mascotNeutralAttr.edge = edgeField(mascotNeutralAttr.array);
    mascotFlexAttr.edge = edgeField(mascotFlexAttr.array);

    const [px, py, pz] = meta.pivot;
    uniforms.uHeadPivot.value.set((px - acrossMid) * scale, (pz - middle) * scale, -py * scale);
    if (window.site) Object.assign(window.site, {
      mascotAttr, mascotNeutralAttr, mascotFlexAttr,
    });
  } catch (err) {
    console.warn('mascot point cloud unavailable, keeping the spine', err);
  }
}

const state = {
  caseFrom: 'work',
  index: 0,
  ready: false,
  panel: null,
  t0: 0,
  tweenMs: TRANSITION_MS,
  tweening: false,
  lockUntil: 0,
  colorA: new THREE.Color(PROJECTS[0].colors[0]),
  colorB: new THREE.Color(PROJECTS[0].colors[1]),
};

const fract = (x) => x - Math.floor(x);

// Where particle i is at progress `prog` — mirrors the vertex shader, written into `from`.
function particleAt(i, prog, from, to) {
  const r = randoms[i], i3 = i * 3;
  const t = Math.min(Math.max((prog - r * 0.35) / 0.65, 0), 1);
  const p = t * t * t * (t * (t * 6 - 15) + 10);
  const arc = Math.sin(p * Math.PI) * uniforms.uArcStrength.value;
  const x = from[i3] + (to[i3] - from[i3]) * p + (fract(r * 12.9898) - 0.5) * arc * 1.6;
  const y = from[i3 + 1] + (to[i3 + 1] - from[i3 + 1]) * p + (fract(r * 78.233) - 0.5) * arc * 1.6;
  const z = from[i3 + 2] + (to[i3 + 2] - from[i3 + 2]) * p + (fract(r * 37.719) - 0.5) * arc * 1.6;
  const c = Math.cos(arc * 0.6), sn = Math.sin(arc * 0.6);
  from[i3] = c * x - sn * z;
  from[i3 + 1] = y;
  from[i3 + 2] = sn * x + c * z;
}

// Morph the particles from wherever they are right now into the shape in `attr`.
function morphTo(attr, ms = TRANSITION_MS) {
  // Freeze current positions as the new starting point, so interrupting a transition doesn't pop.
  const from = fromAttr.array;
  const to = geometry.attributes.aTarget.array;
  const prog = uniforms.uProgress.value;
  if (prog >= 1) from.set(to);
  else for (let i = 0; i < COUNT; i++) particleAt(i, prog, from, to);
  fromAttr.needsUpdate = true;
  setTarget(attr);
  uniforms.uProgress.value = 0;
  uniforms.uArcStrength.value = 1;
  state.t0 = performance.now();
  state.tweenMs = ms;
  state.tweening = true;
}

function goTo(next, { force = false } = {}) {
  const total = PROJECTS.length;
  next = (next + total) % total;
  const now = performance.now();
  if (!state.ready) return;
  if (!force && (next === state.index || now < state.lockUntil)) return;

  morphTo(shapeAttrs[next]);
  state.lockUntil = now + 1300;
  state.index = next;
  state.colorA.set(PROJECTS[next].colors[0]);
  state.colorB.set(PROJECTS[next].colors[1]);
  audio?.sweep();
}

/* ---------- UI ---------- */
const $ = (s) => document.querySelector(s);

function showSpine() {
  state.colorA.set(centreColours()[0]);
  state.colorB.set(centreColours()[1]);
  /* If the particles are already standing as the spine — or are still on their way to it, which is
     what the intro's stream is doing when the Index opens underneath it — morphing again would bow
     them all out and draw them back in, and you would watch the spine being made a second time. */
  // The Index becomes visible just before the intro stream finishes. A project can therefore be
  // opened and closed during that overlap; `goTo` replaces the stream's spine target with the
  // project's model. Only skip this morph when the stream is *still actually targeting* the spine.
  // Otherwise the project model is left rotating inside the focused card after returning.
  if (intro.streaming && geometry.attributes.aTarget === centrepiece()) return;
  if (geometry.attributes.aTarget === centrepiece() && uniforms.uProgress.value >= 1) return;
  morphTo(centrepiece());
}

// Project page: the banner grows out of the clicked card into a white page with the case study
// (project.js); the particle field dissolves under it (see the disperse and opacity targets in tick).
/* The running order the project page reads its "next" from, and what happens when you follow it:
   the page turns in place while, behind it, the spiral quietly brings that project's card round and
   squares it up — so going back from the third case lands on the third card, not the first. */
onNext((p) => clients[(clients.indexOf(p) + 1) % clients.length] || null);
$('#project-next').addEventListener('click', () => {
  const next = clients[(clients.indexOf(PROJECTS[state.index]) + 1) % clients.length];
  if (!next) return;
  showNext(clients.indexOf(next) + 1, (shown) => {
    goTo(PROJECTS.indexOf(shown), { force: true });
    index.present(clients.indexOf(shown));
  });
});

function openCaseStudy(p, hit = null) {
  openProject(p, hit, null, clients.indexOf(p) + 1);
  openPanel('project');
  /* Now the Index no longer holds the field, it becomes the client's own model — in its colours —
     and stays beside the case study while you read. (The Index keeps the field as the mascot/spine,
     so a morph started while the card is still presenting gets pulled back; this is the one that
     sticks.) */
  goTo(PROJECTS.indexOf(p), { force: true });
}
$('#project-back').addEventListener('click', () => openPanel('index'));
$('#contact-back').addEventListener('click', () => leaveContact());

/* Contact: scrolling past the last project hands over to it, and the hand-over is scrubbed rather
   than fired — every frame of it is tied to how far you have scrolled, so it runs backwards just
   as readily.

   The field itself becomes the page. The cards let go, the spine loses its shape and scatters, the
   colour drains to white, and then the particles draw back together onto a plane that fills the
   frame — a white screen made of the same specks that were the spine a moment ago. The solid white
   page fades up under the last of that, so the two are never seen apart, and the black type
   arrives once the white is whole. */
const CONTACT_STEP = 420;  // scroll distance that carries the hand-over from end to end
const HANDOFF_RATE = 0.42; // and the most of it that can pass in a second — about 2.4s end to end
const MASCOT_COLORS = ['#c9b8ff', '#6f4dff']; // the violet of the mascot on the old site
const centreColours = () => (mascotAttr ? MASCOT_COLORS : SPINE_COLORS);
const SPINE_A = new THREE.Color(SPINE_COLORS[0]);
const SPINE_B = new THREE.Color(SPINE_COLORS[1]);
const WHITE = new THREE.Color('#ffffff');

/* The white screen the particles gather into: a jittered grid filling the view at z = 0. A plain
   random scatter clumps and leaves thin patches, and thin patches read as grey. It is built well
   past the edges of the frame so it still covers when the camera pushes in or the window changes
   shape, and carries a little depth so the field doesn't look like a decal. */
const curtainAttr = (() => {
  const arr = new Float32Array(COUNT * 3);
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z * 1.5;
  const width = height * Math.max(camera.aspect, 1.2);
  const cols = Math.ceil(Math.sqrt(COUNT * (width / height)));
  const rows = Math.ceil(COUNT / cols);
  for (let i = 0; i < COUNT; i++) {
    const x = i % cols;
    const y = (i / cols) | 0;
    arr[i * 3] = ((x + Math.random()) / cols - 0.5) * width;
    arr[i * 3 + 1] = ((y + Math.random()) / rows - 0.5) * height;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }
  return new THREE.BufferAttribute(arr, 3);
})();
const root = document.documentElement;
let exitAcc = 0;

/* Spider-Verse glitches are readable because they are rare, abrupt and over in two or three held
   frames. The old version fired constantly and held a full-strength tear for up to 350ms. */
const mascotGlitch = { start: 0, end: 0, strength: 0 };
function triggerGlitch(ms = 165, strength = 0.72) {
  const now = performance.now();
  uniforms.uGlitchSeed.value = Math.random() * 100;
  mascotGlitch.start = now;
  mascotGlitch.end = now + ms;
  mascotGlitch.strength = strength;
}
function scheduleMascotGlitch() {
  setTimeout(() => {
    /* Whenever he is the shape on screen, which includes the landing he is held on — he used to
       be excluded there, so the one screen he stands still on was the one screen he never broke
       up on. Both of his poses count; the neutral one is what the landing holds. */
    const target = geometry.attributes.aTarget;
    const up = mascotAttr && (target === mascotNeutralAttr || target === mascotFlexAttr);
    if (up && (!intro.active || intro.held)) {
      triggerGlitch(130 + Math.random() * 90, 0.62 + Math.random() * 0.3);
    }
    scheduleMascotGlitch();
  }, 900 + Math.random() * 1900);
}
scheduleMascotGlitch();

const handoff = { p: 0, target: 0, morphing: false, turn: 0, disperse: 0, size: 0 };

// Build the contact headline from real, accessible text into independently masked glyphs. This is
// the same counterflow language as the landing word: neighbouring letters arrive from opposite
// vertical directions, while PROJECT? keeps its heavier emphasis.
function prepareContactCounterflow() {
  const heading = $('.contact-heading');
  heading.setAttribute('aria-label', 'Have a project?');
  const fragment = document.createDocumentFragment();
  let index = 0;
  [
    { text: 'Have a ', emphasis: false },
    { text: 'project?', emphasis: true },
  ].forEach(({ text, emphasis }, segmentIndex, segments) => {
    const segment = document.createElement('span');
    segment.className = 'contact-segment';
    segment.setAttribute('aria-hidden', 'true');
    [...text.trim()].forEach((letter) => {
      if (letter === ' ') {
        const space = document.createElement('span');
        space.className = 'contact-space';
        segment.appendChild(space);
        return;
      }
      const mask = document.createElement('span');
      mask.className = `contact-mask ${index % 2 ? 'from-top' : 'from-bottom'}${emphasis ? ' emphasis' : ''}`;
      const char = document.createElement('span');
      char.className = 'contact-char';
      char.textContent = letter;
      char.style.setProperty('--i', index++);
      mask.appendChild(char);
      segment.appendChild(mask);
    });
    fragment.appendChild(segment);
    if (segmentIndex < segments.length - 1) {
      const gap = document.createElement('span');
      gap.className = 'contact-segment-gap';
      gap.setAttribute('aria-hidden', 'true');
      fragment.appendChild(gap);
    }
  });
  heading.replaceChildren(fragment);
}
prepareContactCounterflow();

// The first movement off the spiral sets the morph up; from there the scroll scrubs uProgress
// itself, so the wordmark forms and unforms under your fingers instead of playing on a timer.
function beginHandoff() {
  if (handoff.morphing) return;
  handoff.morphing = true;
  // the spine has been turning for many revolutions; aim at the nearest whole turn so the screen
  // it becomes ends up square to the camera rather than a plane seen at an angle
  handoff.turn = Math.round(index.angle() / (Math.PI * 2)) * Math.PI * 2;
  morphTo(curtainAttr); // the particles become the white screen
  state.tweening = false; // ...at the pace of the scroll, not the clock
}

function setHandoff(target) {
  handoff.target = THREE.MathUtils.clamp(target, 0, 1);
  if (handoff.target > 0) beginHandoff();
}

// smootherstep: flat at both ends, so the move has no edge where it starts or stops
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

function applyHandoff(p) {
  index.setExit(smooth(clamp01(p / 0.45)));         // the cards are gone before the field scatters
  const morph = smooth(clamp01((p - 0.2) / 0.58));  // spine → screen, whole before the page lands
  if (handoff.morphing) uniforms.uProgress.value = morph;

  /* The scatter is a hump, not a ramp: out to nothing in the middle of the move, back together by
     the end. That is the whole trick — the shape has to be lost before the screen can form, or it
     reads as the spine flattening rather than the particles becoming the page. */
  handoff.disperse = Math.sin(Math.PI * clamp01(p / 0.85)) * 3.6;
  // and they fatten as they gather, so the field closes up into white instead of staying specks
  handoff.size = smooth(clamp01((p - 0.3) / 0.45));

  const white = smooth(clamp01(p / 0.5));
  state.colorA.copy(SPINE_A).lerp(WHITE, white);
  state.colorB.copy(SPINE_B).lerp(WHITE, white);

  root.style.setProperty('--handoff', p.toFixed(4));
  // the page itself comes up under the last of the gathering, and the type only once it is whole
  root.style.setProperty('--contact-in', smooth(clamp01((p - 0.62) / 0.3)).toFixed(4));
  root.style.setProperty('--contact-text', smooth(clamp01((p - 0.82) / 0.16)).toFixed(4));
  const contact = $('#contact');
  contact.classList.toggle('handing', p > 0.001);
  // Hysteresis keeps a slow trackpad near the threshold from repeatedly restarting the reveal.
  if (p >= 0.84) contact.classList.add('contact-text-in');
  else if (p <= 0.72) contact.classList.remove('contact-text-in');
}

/* The swap at either end. Neither of these goes through openPanel: that would morph the particles
   on a timer and fight the scrub that is driving them. */
function commitContact() {
  if (state.panel === 'contact') return;
  state.panel = 'contact';
  $('#index').classList.remove('open');
  $('#contact').classList.add('open');
  audio?.sweep();
}

/* Right back on the spiral. Only here is the morph handed back to the clock — clearing it any
   earlier would let the next scroll start a second morph and snap the wordmark to the spine. */
function releaseContact() {
  handoff.morphing = false;
  if (state.panel === 'index') return;
  state.panel = 'index';
  $('#contact').classList.remove('open', 'contact-text-in');
  $('#index').classList.add('open');
  document.body.classList.remove('panel-open');
  index.focus(clients.length - 1); // back where you left off, at the last project
  audio?.sweep();
}

// the keyboard and touch don't scrub; they ask for the whole move and it eases there
function enterContact() { exitAcc = CONTACT_STEP; setHandoff(1); }
function leaveContact() { exitAcc = 0; setHandoff(0); }

/* Intro: DIZRUPT stays typographic. On entry the live project spiral is already moving behind the
   black landing layer; a restrained depth/focus pull trades sharpness between the two scenes. */
const INTRO_HOLD_AT = 4300; // where it stops and waits: built, flexed, the count up beside him
const INTRO_SWEEP = 6000;   // word tears out → eyes alone → body build → flex → projects
const INTRO_FALLBACK_SWEEP = 2300; // old depth hand-off when the local mascot assets are absent
const INTRO_HOLE = 280;     // px, the radius the cursor opens in the black
const veil = $('.intro-veil');
const intro = {
  active: false,
  handover: false,
  mask: '',
  wordY: 0,
  streaming: false,
  revealIndex: false,
  sweepStarted: 0,
  coil: 0,
  drift: 0,
  timers: [],
  shuffleAnimations: [],
  wordGlitch: 0,
  statsShown: false,
  held: false,
  profile: false,
  stagedAt: 0,
  released: false,
  mascotSequence: false,
  flexStarted: false,
  projectsStarted: false,
  spot: { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2, r: 0 },
};

/* The registered mark is rebuilt from the seven live letters rather than displayed as an image.
   Coordinates describe the same tall, interlocked rhythm as the supplied artwork, while the
   typeface remains the site's Inter Tight. Array order deliberately stays D-I-Z-R-U-P-T so each
   intro glyph can fly to its own final position without ever becoming a different letter. */
const SHUFFLE_LAYOUT = [
  { letter: 'D', x: 41, y: 61, fs: 0.47, r: 0 },
  { letter: 'I', x: 25, y: 31, fs: 0.43, r: 0 },
  { letter: 'Z', x: 50, y: 58, fs: 0.51, r: -31 },
  { letter: 'R', x: 70, y: 48, fs: 0.45, r: 0 },
  { letter: 'U', x: 39, y: 46, fs: 0.46, r: 0 },
  { letter: 'P', x: 34, y: 80, fs: 0.44, r: 0 },
  { letter: 'T', x: 48, y: 17, fs: 0.48, r: 0 },
];

function buildShuffleMark(node) {
  if (!node || node.childElementCount) return;
  node.replaceChildren(...SHUFFLE_LAYOUT.map(({ letter, x, y, fs, r }) => {
    const slot = document.createElement('span');
    slot.className = 'shuffle-slot';
    slot.style.setProperty('--x', x);
    slot.style.setProperty('--y', y);
    slot.style.setProperty('--fs', fs);
    slot.style.setProperty('--r', `${r}deg`);
    const glyph = document.createElement('i');
    glyph.className = `shuffle-glyph${letter === 'Z' ? ' is-z' : ''}`;
    glyph.textContent = letter;
    slot.appendChild(glyph);
    return slot;
  }));
}

function resetLogoShuffle() {
  intro.shuffleAnimations.forEach((animation) => animation.cancel());
  intro.shuffleAnimations.length = 0;
  buildShuffleMark($('#intro-shuffle'));
  buildShuffleMark($('#logo-mark'));
  const stage = $('#intro-shuffle');
  stage?.removeAttribute('style');
  $('#intro')?.classList.remove('shuffle-active');
  document.body.classList.remove('mark-locked');
}

function dockShuffleMark() {
  const stage = $('#intro-shuffle');
  const navMark = $('#logo-mark');
  if (!stage || !navMark || !intro.active || !intro.handover) return;
  const from = stage.getBoundingClientRect();
  const to = navMark.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;
  const scale = Math.min(to.width / from.width, to.height / from.height);
  const animation = stage.animate([
    { left: `${fromX}px`, top: `${fromY}px`, transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { left: `${fromX}px`, top: `${fromY}px`, transform: 'translate(-50%, -50%) scale(.94)', opacity: 1, offset: 0.16 },
    { left: `${toX}px`, top: `${toY}px`, transform: `translate(-50%, -50%) scale(${scale})`, opacity: 1 },
  ], {
    duration: 680,
    easing: 'cubic-bezier(.16, 1, .3, 1)',
    fill: 'both',
  });
  intro.shuffleAnimations.push(animation);
  intro.timers.push(setTimeout(() => document.body.classList.add('mark-locked'), 560));
}

function startLogoShuffle() {
  const stage = $('#intro-shuffle');
  const source = [...document.querySelectorAll('#intro-word .char')];
  const targets = [...stage?.querySelectorAll('.shuffle-slot') || []];
  if (!stage || source.length !== targets.length) return;

  // Motion-reduced users still get the identity change, without the scramble across the screen.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('#intro').classList.add('shuffle-active');
    document.body.classList.add('mark-locked');
    return;
  }

  const width = innerWidth;
  const height = innerHeight;
  const animations = targets.map((slot, i) => {
    const from = source[i].getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = Math.max(0.72, Math.min(2.8, from.height / Math.max(to.height, 1)));
    const direction = i % 2 ? -1 : 1;
    const arcX = direction * (35 + Math.random() * Math.min(110, width * 0.09));
    const arcY = (Math.random() - 0.5) * Math.min(150, height * 0.18);
    const jitterX = (Math.random() - 0.5) * Math.min(90, width * 0.075);
    const jitterY = (Math.random() - 0.5) * Math.min(100, height * 0.13);
    const turn = direction * (18 + Math.random() * 52);
    return slot.animate([
      {
        transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`,
        opacity: 1,
      },
      {
        transform: `translate(-50%, -50%) translate(${dx * 0.7 + arcX}px, ${dy * 0.7 + arcY}px) scale(${scale * 0.9}) rotate(${turn}deg)`,
        opacity: 0.72,
        offset: 0.31,
      },
      {
        transform: `translate(-50%, -50%) translate(${dx * 0.34 + jitterX}px, ${dy * 0.34 + jitterY}px) scale(1.08) rotate(${-turn * 0.38}deg)`,
        opacity: 1,
        offset: 0.65,
      },
      {
        transform: 'translate(-50%, -50%) translate(0, 0) scale(1) rotate(0deg)',
        opacity: 1,
      },
    ], {
      duration: 940 + Math.random() * 170,
      delay: Math.random() * 100,
      easing: 'cubic-bezier(.7, 0, .2, 1)',
      fill: 'both',
    });
  });
  intro.shuffleAnimations.push(...animations);
  $('#intro').classList.add('shuffle-active');
  intro.timers.push(setTimeout(dockShuffleMark, 1110));
}

const introStatic = createStatic($('#intro-static'));

/* The Z loses the signal now and then. Every number below is rolled at the moment it happens —
   how many steps the outage lasts, how long each one holds, how far each colour channel slips,
   which band of the letter drops out — because a fixed set of keyframes plays the identical
   seizure every time, and you notice the repeat long before you notice the effect. */
const glitchRand = (a, b) => a + Math.random() * (b - a);
let introHasGlitched = false;

/* ---------- The count around him ----------
   Each label arrives in one of the languages of the places the work is in, and loses the signal
   into English. The list is the client list read back as tongues: Mumbai, Dubai, Bangkok, Hong
   Kong, Antwerp, Johannesburg. `latin` says whether the script can take the label's tracking and
   its uppercasing — Arabic joins up and Devanagari hangs off a headline, and both come apart if
   they are tracked out. */
const STAT_TONGUES = {
  'founded in': [
    { text: 'स्थापना', latin: false },
    { text: 'تأسست', latin: false },
    { text: 'ก่อตั้ง', latin: false },
    { text: '成立于', latin: false },
    { text: 'opgericht in', latin: true },
    { text: 'fondée en', latin: true },
    { text: 'gesig in', latin: true },
  ],
  solutions: [
    { text: 'समाधान', latin: false },
    { text: 'حلول', latin: false },
    { text: 'โซลูชัน', latin: false },
    { text: '解决方案', latin: false },
    { text: 'oplossingen', latin: true },
    { text: 'izixazululo', latin: true },
  ],
  countries: [
    { text: 'देश', latin: false },
    { text: 'دول', latin: false },
    { text: 'ประเทศ', latin: false },
    { text: '国家', latin: false },
    { text: 'landen', latin: true },
    { text: 'amazwe', latin: true },
  ],
  clients: [
    { text: 'ग्राहक', latin: false },
    { text: 'عملاء', latin: false },
    { text: 'ลูกค้า', latin: false },
    { text: '客户', latin: false },
    { text: 'klanten', latin: true },
    { text: 'amakhasimende', latin: true },
  ],
};

const statCells = () => [...$('#intro-stats').querySelectorAll('.stat')];

// the ghost plates are drawn from data-text, so anything that rewrites a line has to set it too
/* A label is written as a comment — // founded — and the word itself is the only part that ever
   changes. The marker is added here rather than in the stylesheet because both pseudo-elements on
   this line are already spent on the colour plates. */
function statText(el, text, foreign = null) {
  el.innerHTML = `<i class="stat-mark">//</i>${text}`;
  el.dataset.text = `//${text}`;
  if (foreign !== null) el.classList.toggle('is-foreign', foreign);
}

/* One burst of broken signal on a stat: the three channels come apart, a band of it drops out, and
   the whole cell jumps sideways. If `resolve` is given, the label changes to it partway through —
   so the language does not switch cleanly, it switches inside the fault. */
function statFault(cell, ms, resolve = null) {
  const number = cell.querySelector('.stat-n');
  const label = cell.querySelector('.stat-l');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (resolve) { statText(label, resolve, false); resolveNumber(number); }
    return;
  }
  const started = performance.now();
  let swapped = !resolve;
  cell.classList.add('faulting');

  const clear = () => {
    if (resolve && !swapped) resolveNumber(number);
    cell.classList.remove('faulting');
    cell.style.removeProperty('--slip');
    cell.style.removeProperty('clip-path');
    for (const el of [number, label]) {
      for (const key of ['r', 'b']) {
        for (const prop of ['x', 'y', 'o', 'clip']) el.style.removeProperty(`--${key}-${prop}`);
      }
    }
    if (!swapped) statText(label, resolve, false);
  };
  // a backgrounded tab stops serving frames, and the fault would be left on the line for good
  const guard = setTimeout(clear, ms + 400);

  const channel = (el, key, spread) => {
    const top = glitchRand(0, 58);
    el.style.setProperty(`--${key}-x`, `${glitchRand(-spread, spread).toFixed(1)}px`);
    el.style.setProperty(`--${key}-y`, `${glitchRand(-7, 7).toFixed(1)}px`);
    el.style.setProperty(`--${key}-o`, Math.random() < 0.2 ? '0' : glitchRand(0.7, 1).toFixed(2));
    el.style.setProperty(`--${key}-clip`,
      Math.random() < 0.55 ? `inset(${top.toFixed(0)}% 0 ${glitchRand(0, 88 - top).toFixed(0)}% 0)` : 'none');
  };

  const step = () => {
    const t = (performance.now() - started) / ms;
    if (t >= 1 || !intro.active) {
      clearTimeout(guard);
      clear();
      return;
    }
    // the language changes while the picture is at its most broken, never before or after
    if (!swapped && t > 0.45) {
      swapped = true;
      statText(label, resolve, false);
      resolveNumber(number);   // the cipher and the foreign word go together, inside the same tear
    }
    /* Hard. The three channels are thrown well clear of each other, the whole cell jumps, and a
       band of it drops out — the same fault the Z runs on the landing, at the same strength, so
       the two read as one house style rather than as a loud one and a polite one. */
    const force = 1 - t * 0.55;
    const spread = glitchRand(9, 32) * force;
    channel(number, 'r', spread);
    channel(number, 'b', spread * glitchRand(0.6, 1.3));
    channel(label, 'r', spread * 0.8);
    channel(label, 'b', spread * glitchRand(0.5, 1.2));
    cell.style.setProperty('--slip', `${(glitchRand(-16, 16) * force).toFixed(1)}px`);
    cell.style.clipPath = Math.random() < 0.38
      ? `inset(${glitchRand(0, 52).toFixed(0)}% 0 ${glitchRand(0, 40).toFixed(0)}% 0)` : 'none';
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* The count is read, not displayed. One number arrives; he turns his head and looks at it; the
   next arrives and he looks at that. Four times, round the four corners he stands in the middle
   of. Nothing here is on the sequence's own clock — that one is frozen while the landing holds —
   so it all runs on timers from the moment the first number lands. */
const STAT_STEP = 1050;    // between one number landing and the next
const STAT_LOOK = 160;     // and how long you have to see it before he turns to it
const STAT_TONGUE = 560;   // how long its label stays in another language

/* Where each one is, as a place to look: the same left-and-right, up-and-down the cursor would be
   read in, so his head turns to the corners the numbers actually occupy. */
const STAT_CORNER = [
  [-0.52, -0.20],   // 01 founded in, up and to his left
  [0.52, -0.20],    // 02 solutions, up and to his right
  [-0.50, 0.17],    // 03 countries, down and left
  [0.50, 0.17],     // 04 clients, down and right
];

let glanceAt = null;   // where he is looking, or null to go back to following the cursor

function revealStats() {
  const cells = statCells();
  cells.forEach((cell) => {
    cell.classList.remove('is-in');
    const label = cell.querySelector('.stat-l');
    const english = label.dataset.english || label.textContent.replace('//', '').trim();
    label.dataset.english = english;
    // it arrives in one of the tongues of the places the work is in, and loses the signal into English
    const tongues = STAT_TONGUES[english] || [];
    const pick = tongues[(Math.random() * tongues.length) | 0];
    if (pick) statText(label, pick.text, !pick.latin);
    else statText(label, english, false);
  });

  const later = (ms, fn) => intro.timers.push(setTimeout(() => {
    if (intro.active && intro.statsShown) fn();
  }, ms));

  cells.forEach((cell, i) => {
    const at = i * STAT_STEP;
    later(at, () => { cell.classList.add('is-in'); encodeNumber(cell.querySelector('.stat-n')); });
    later(at + STAT_LOOK, () => { glanceAt = STAT_CORNER[i]; });
    later(at + STAT_TONGUE, () => {
      statFault(cell, 260 + Math.random() * 120, cell.querySelector('.stat-l').dataset.english);
    });
  });
  // all four read; he comes back to you, and from here he follows the cursor again
  later(cells.length * STAT_STEP + 620, () => { glanceAt = null; });
  scheduleStatFault();
}

// and then it only ever faults; the English stays English
function scheduleStatFault() {
  intro.timers.push(setTimeout(() => {
    if (!intro.active) return;
    if (intro.statsShown && !intro.released) {
      const cells = statCells();
      statFault(cells[(Math.random() * cells.length) | 0], 110 + Math.random() * 120);
    }
    scheduleStatFault();
  }, 2200 + Math.random() * 3400));
}

/* The numbers arrive as encoded values and are not readable until the same fault that turns their
   label into English resolves them. Nothing counts up: a number rolling from a lower one to a
   higher one says "here is a total being reached", and the point of these four is that they were
   always true and are only now being decoded. Hex, because it reads as a machine's own way of
   writing a number rather than as a slot machine. */
const ENCODE = '0123456789ABCDEF';

/* A value is written as a key and a number — EST·2023 — with the key in the brand violet and
   stable throughout. Only the number is ever a cipher; the key is what tells you which reading you
   are waiting for while it decodes. */
function drawStat(el, text) {
  const key = el.dataset.key ? `<i class="stat-key">${el.dataset.key}·</i>` : '';
  el.innerHTML = key + text;
  // the colour plates behind it are drawn from this, and they carry the key too
  el.dataset.text = (el.dataset.key ? `${el.dataset.key}·` : '') + text;
}

const realValue = (el) => String(el.dataset.to) + (el.dataset.suffix ?? '');

function encodeNumber(el) {
  delete el.dataset.resolved;
  const width = realValue(el).length;
  const scramble = () => {
    if (el.dataset.resolved === '1' || !intro.active) return;
    let out = '';
    for (let k = 0; k < width; k++) out += ENCODE[(Math.random() * ENCODE.length) | 0];
    drawStat(el, out);
    // slow enough that they read as characters rather than as a blur
    intro.timers.push(setTimeout(scramble, 65 + Math.random() * 50));
  };
  scramble();
}

function resolveNumber(el) {
  el.dataset.resolved = '1';
  drawStat(el, realValue(el));
}

/* How far across he stands once he has turned side on: far enough left that the right of the frame
   is clear for the line, measured off the camera so it is the same share of the screen whatever
   shape the window is. On a narrow screen he stays put and the type takes the space below him. */
function profileShift() {
  if (innerWidth <= 900) return 0;
  const visible = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
  return -visible * camera.aspect * 0.17;
}

/* The landing holds on the portrait once it is built. The next scroll is what lets it go on into
   the Index, so the count is read rather than glimpsed. */
/* The landing has two stops, not one. The first scroll turns him side on and puts the line beside
   him; the second lets the whole thing go on into the work. Both are held: the sequence's own
   clock stays frozen through the profile, so nothing runs out from under either of them. */
/* One gesture is one step. A trackpad sends dozens of wheel events for a single flick, and without
   this the first of them turned him side on and the second let the whole thing go — the profile
   arrived and was gone inside the same scroll, which looked like nothing had happened at all. */
const STAGE_GATE = 900;

function releaseIntroHold() {
  if (!intro.held || intro.released) return false;
  const since = performance.now() - intro.stagedAt;
  if (since < STAGE_GATE) return false;
  intro.stagedAt = performance.now();
  glanceAt = null;   // done reading the count
  if (!intro.profile) {
    intro.profile = true;
    $('#intro').classList.remove('stats-in');
    $('#intro').classList.add('profile-in');
    return true;
  }
  intro.released = true;
  intro.held = false;
  intro.profile = false;
  $('#intro').classList.remove('profile-in');
  return true;
}

/* Back up one stop. The landing's stops are a sequence and a sequence reads both ways: the profile
   returns to the count, and the count stays put — behind it is the word tearing out, and replaying
   that is a different thing from stepping back through a held scene. */
function stepIntroBack() {
  if (!intro.held || intro.released || !intro.profile) return false;
  const now = performance.now();
  if (now - intro.stagedAt < STAGE_GATE) return false;
  intro.stagedAt = now;
  intro.profile = false;
  $('#intro').classList.remove('profile-in');
  $('#intro').classList.add('stats-in');
  return true;
}

/* And back into the landing from the work. Scrolling up off the front of the spiral puts you back
   where you came from rather than stopping dead at the first project — the landing is a place on
   the way through, not a door that locks behind you. He is already built and already revealed, so
   this is a re-entry and not a replay: no beam, no decode, nothing counted again. */
function reopenIntro() {
  if (intro.active || !mascotNeutralAttr || !mascotFlexAttr) return false;
  const now = performance.now();
  Object.assign(intro, {
    active: true, handover: true, mascotSequence: true, revealIndex: false, streaming: false,
    statsShown: true, held: true, released: false, profile: true,
    flexStarted: false, projectsStarted: false,
    stagedAt: now, sweepStarted: now - INTRO_HOLD_AT,
  });

  const el = $('#intro');
  el.classList.remove('done');
  el.classList.add('sweeping', 'profile-in');
  document.body.classList.remove('intro-projects');

  fromAttr.array.set(mascotNeutralAttr.array);
  fromAttr.needsUpdate = true;
  setTarget(mascotNeutralAttr);
  uniforms.uProgress.value = 1;
  uniforms.uBodyReveal.value = 1;
  uniforms.uEyeReveal.value = 1;
  uniforms.uBeamOn.value = 0;   // the beam has already run; he does not arrive twice
  state.tweening = false;
  state.colorA.set(MASCOT_COLORS[0]);
  state.colorB.set(MASCOT_COLORS[1]);

  $('#index').classList.remove('open');
  document.body.classList.remove('panel-open');
  state.panel = null;
  return true;
}

function glitchZ() {
  const mask = $('#intro-word .char-mask.flip');
  if (!mask || !intro.active || intro.handover) return;
  const char = mask.querySelector('.char');
  const steps = 4 + ((Math.random() * 4) | 0);
  mask.classList.add('glitch');

  // one colour channel, thrown off registration on its own terms
  const channel = (key, spread) => {
    const top = glitchRand(0, 58);
    char.style.setProperty(`--${key}-x`, `${glitchRand(-spread, spread).toFixed(1)}px`);
    char.style.setProperty(`--${key}-y`, `${glitchRand(-9, 9).toFixed(1)}px`);
    char.style.setProperty(`--${key}-o`, Math.random() < 0.18 ? '0' : glitchRand(0.6, 1).toFixed(2));
    char.style.setProperty(`--${key}-clip`,
      Math.random() < 0.45 ? `inset(${top.toFixed(0)}% 0 ${glitchRand(0, 88 - top).toFixed(0)}% 0)` : 'none');
  };

  const settle = () => {
    mask.classList.remove('glitch');
    mask.style.transform = '';
    mask.style.clipPath = '';
    ['r', 'g', 'b'].forEach((key) => {
      ['x', 'y', 'o', 'clip'].forEach((prop) => char.style.removeProperty(`--${key}-${prop}`));
    });
    // The first torn Z is the colour cue: resolve that glyph directly into Dizrupt purple.
    // Later glitches keep working over that new base colour while the other letters stay white.
    if (!introHasGlitched && intro.active && !intro.handover) {
      introHasGlitched = true;
      $('#intro-word').classList.add('brand-purple');
    }
  };

  const step = (n) => {
    if (n >= steps || !intro.active || intro.handover) return settle();
    // the three channels rarely slip by the same amount, so the split is never symmetrical
    const spread = glitchRand(11, 44);
    channel('r', spread);
    channel('g', spread * glitchRand(0.35, 1));
    channel('b', spread * glitchRand(0.6, 1.25));
    mask.style.transform =
      `scaleX(-1) translate(${glitchRand(-18, 18).toFixed(1)}px, ${glitchRand(-7, 7).toFixed(1)}px)`;
    // Dropping a band out is part of the look, but clipped at the same time as the channel clips
    // it hides the colour split entirely — which is the bit that reads. So it happens less often.
    mask.style.clipPath = Math.random() < 0.32
      ? `inset(${glitchRand(0, 56).toFixed(0)}% 0 ${glitchRand(0, 40).toFixed(0)}% 0)` : 'none';
    setTimeout(() => step(n + 1), glitchRand(36, 96));
  };

  step(0);
}

// The gap is re-rolled every time rather than fixed, so it never settles into a rhythm: often
// enough now that the landing never sits still, but never on a beat you could count along to.
function scheduleZGlitch() {
  if (!intro.active) return;
  intro.timers.push(setTimeout(() => {
    glitchZ();
    scheduleZGlitch();
  }, 700 + Math.random() * 800));
}

function startIntro() {
  resetLogoShuffle();
  intro.active = true;
  introHasGlitched = false;
  introStatic.start(); // the snow runs for as long as the landing screen is up
  intro.handover = false;
  intro.streaming = false;
  intro.revealIndex = false;
  intro.mascotSequence = false;
  intro.flexStarted = false;
  intro.projectsStarted = false;
  intro.profile = false;
  intro.sweepStarted = 0;
  const word = $('#intro-word');
  $('#intro').classList.remove('done', 'reveal', 'ready', 'sweeping', 'wrapped', 'exit', 'word-tearing');
  document.body.classList.remove('intro-depth', 'intro-projects');
  word.classList.remove('in', 'out', 'burn', 'brand-purple'); // clear a previous run, or the letters stay hidden
  cancelAnimationFrame(intro.wordGlitch || 0);
  word.style.removeProperty('opacity');
  word.style.removeProperty('clip-path');
  document.querySelectorAll('.intro-word-shard').forEach((shard) => shard.remove());
  word.replaceChildren(...[...'DIZRUPT'].map((letter, i) => {
    const mask = document.createElement('span');
    // the Z is flipped, so it reads from the other side — the mark's one deliberate quirk.
    // The flip goes on the mask, which has no animation of its own to fight with.
    mask.className = letter === 'Z' ? 'char-mask flip' : 'char-mask';
    const char = document.createElement('span');
    char.className = 'char';
    char.textContent = letter;
    char.dataset.char = letter; // the glitch draws its colour ghosts from this
    char.style.setProperty('--i', i);
    mask.appendChild(char);
    /* A letter has only two pseudo-elements and the split needs three channels, so the blue one
       is a real element. Absolutely positioned, so it sits on the letter without disturbing it. */
    if (letter === 'Z') {
      const ghost = document.createElement('i');
      ghost.className = 'z-ghost';
      ghost.dataset.char = letter;
      ghost.textContent = letter;
      ghost.setAttribute('aria-hidden', 'true');
      char.appendChild(ghost);
    }
    return mask;
  }));
  requestAnimationFrame(() => word.classList.add('in'));
  scheduleZGlitch();

  // The project spine waits invisibly behind the landing screen. The travelling wave is a separate
  // point cloud, so neither the word nor the wave ever has to morph into the project geometry.
  fromAttr.array.set(centrepiece().array);
  fromAttr.needsUpdate = true;
  setTarget(centrepiece());
  uniforms.uProgress.value = 1;
  state.tweening = false;
  uniforms.uDisperse.value = 0;
  uniforms.uOpacity.value = 0;
  uniforms.uBodyReveal.value = 1;
  uniforms.uEyeReveal.value = 1;
  uniforms.uBeamOn.value = 0;
  if (introWave) {
    introWave.visible = false;
    introWaveUniforms.uOpacity.value = 0;
  }
  state.colorA.set(centreColours()[0]);
  state.colorB.set(centreColours()[1]);
}

// the count has reached 100: the tagline and the scroll cue take its place
function introReady() {
  if (intro.active) $('#intro').classList.add('ready');
}

/* The word does not fold away: it loses the signal. Two coloured copies of it are laid over the
   original and all three are torn into horizontal bands that jump sideways by different amounts,
   band by band, frame by frame — the same fault the mirrored Z runs all through the landing, turned
   up until there is nothing left of the word. The scene behind it is black throughout, so what you
   are left looking at is the pair of eyes coming up in the middle of the screen. */
const WORD_GLITCH_MS = 700;
const WORD_BANDS = 8;

function glitchOutWord() {
  const word = $('#intro-word');
  const inner = word.parentElement;
  /* Every band of the word, in each of the three channels, is its own copy of the whole word
     clipped to that band. They sit exactly on top of one another, so at rest they read as the word;
     sliding them apart tears it into strips and pulls its colour out sideways. Doing it with one
     element per layer would only ever show a single strip, and the word would vanish on frame one
     rather than come apart. */
  const layers = [];
  for (let band = 0; band < WORD_BANDS; band++) {
    const top = (band / WORD_BANDS) * 100;
    const bottom = 100 - ((band + 1) / WORD_BANDS) * 100;
    for (const channel of ['w', 'r', 'b']) {
      const copy = word.cloneNode(true);
      copy.id = '';
      copy.className = `intro-word-shard ${channel}`;
      copy.setAttribute('aria-hidden', 'true');
      copy.style.clipPath = `inset(${top.toFixed(2)}% 0 ${bottom.toFixed(2)}% 0)`;
      inner.appendChild(copy);
      layers.push({ el: copy, channel, band });
    }
  }
  word.style.opacity = '0';
  $('#intro').classList.add('word-tearing');

  const start = performance.now();
  const step = () => {
    const t = Math.min((performance.now() - start) / WORD_GLITCH_MS, 1);
    if (t >= 1) {
      layers.forEach(({ el }) => el.remove());
      $('#intro').classList.remove('word-tearing');
      return;
    }
    // it holds together at first and comes apart harder the further it goes
    const violence = 0.25 + t * t * 1.6;
    const slips = [];
    for (let band = 0; band < WORD_BANDS; band++) {
      // only some bands move at any moment; the still ones are what makes the moving ones read
      slips.push(Math.random() < 0.45 + t * 0.4 ? (Math.random() - 0.5) * 150 * violence : 0);
    }
    for (const { el, channel, band } of layers) {
      const apart = (channel === 'r' ? 1 : channel === 'b' ? -1 : 0) * (2 + 26 * violence * Math.random());
      el.style.setProperty('--slip', `${(slips[band] + apart).toFixed(1)}px`);
      // whole bands drop out towards the end, the way a tape loses them
      const dropped = Math.random() < t * 0.55 ? 0 : 1;
      el.style.opacity = (dropped * (1 - t * t)).toFixed(3);
    }
    intro.wordGlitch = requestAnimationFrame(step);
  };
  intro.wordGlitch = requestAnimationFrame(step);
}

// One input starts the focus pull. The destination opens immediately behind the opaque intro, then
// resolves as the landing copy softens; neither scene has to be rebuilt at the hand-off boundary.
function handOver() {
  if (intro.handover || !intro.active) return;
  intro.handover = true;
  intro.streaming = true;
  intro.mascotSequence = !!(mascotNeutralAttr && mascotFlexAttr);
  intro.revealIndex = !intro.mascotSequence;
  intro.flexStarted = false;
  intro.projectsStarted = false;
  intro.sweepStarted = performance.now();
  $('#intro').classList.add('sweeping');
  glitchOutWord();
  document.body.classList.add('intro-depth');
  if (introWave) {
    introWave.visible = false;
    introWaveUniforms.uOpacity.value = 0;
  }
  intro.drift = 0;
  if (intro.mascotSequence) {
    /* He does not gather, drift or assemble. He is already standing where he will stand, in the
       dark, and a beam runs down him and leaves him lit — so nothing about his arrival reads as a
       cloud of particles finding a shape. The positions are final from the first frame; only the
       light moves. */
    fromAttr.array.set(mascotNeutralAttr.array);
    fromAttr.needsUpdate = true;
    setTarget(mascotNeutralAttr);
    uniforms.uProgress.value = 1;
    uniforms.uArcStrength.value = 0;
    uniforms.uBodyReveal.value = 0;
    uniforms.uEyeReveal.value = 0;
    uniforms.uBeam.value = 2.0;   // above his crown: nothing lit yet
    uniforms.uBeamOn.value = 1;
    uniforms.uOpacity.value = 0;
    state.tweening = false;
    state.colorA.set(MASCOT_COLORS[0]);
    state.colorB.set(MASCOT_COLORS[1]);
  } else if (state.panel !== 'index') {
    openPanel('index');
  }
  audio?.sweep();
}

// Kept as a public/devtools alias; the intro itself now needs only one gesture.
function streamAway() {
  if (!intro.handover) handOver();
}

function endIntro() {
  if (!intro.active) return;
  points.scale.setScalar(1);
  points.position.x = 0;
  intro.held = false;
  intro.statsShown = false;
  intro.released = false;
  intro.profile = false;
  $('#intro').classList.remove('stats-in', 'profile-in');
  intro.active = false;
  intro.handover = false;
  intro.streaming = false;
  intro.revealIndex = false;
  intro.mascotSequence = false;
  intro.coil = 0; // every later morph is an ordinary one
  intro.drift = 0;
  if (introWave) {
    introWave.visible = false;
    introWaveUniforms.uOpacity.value = 0;
  }
  intro.timers.forEach(clearTimeout);
  uniforms.uBodyReveal.value = 1;
  uniforms.uEyeReveal.value = 1;
  uniforms.uBeamOn.value = 0;
  introStatic.stop(); // nothing to tune in once the picture has resolved
  $('#intro').classList.add('done');
  document.body.classList.remove('intro-depth', 'intro-projects');
  if (state.panel !== 'index') openPanel('index');
  // `goTo` may have interrupted the stream while the early Index was visible. Repair the field at
  // the boundary even when the Index is already the active panel.
  else showSpine();
}

// Only two views: the index itself, and a project's overview on top of it.
function openPanel(name) {
  const wasIndex = state.panel === 'index';
  /* Leaving a project: the page shrinks back to the card it grew out of, and only once it has
     landed does that card lean back into the spiral. Escape can also land here while the card is
     still only being presented, before the page has opened at all — hence the timer being cleared
     either way, or the page would open a moment after being dismissed. */
  if (name !== 'project') {
    clearTimeout(presentTimer);
    if (state.panel === 'project') closeProject(() => index.release());
    else index.release();
  }
  state.panel = name;
  document.querySelectorAll('.panel').forEach((el) => {
    const open = el.id === `panel-${name}`;
    if (open && !el.classList.contains('open')) el.scrollTop = 0;
    el.classList.toggle('open', open);
  });
  $('#index').classList.toggle('open', name === 'index');
  document.body.classList.toggle('panel-open', name !== 'index');
  if (name === 'index' && !wasIndex) {
    showSpine();
    index.focus(Math.max(0, clients.indexOf(PROJECTS[state.index])));
  }
}

/* ---------- Input ---------- */
/* Scrolling moves a project at a time. The distance scrolled is gathered up, and each threshold
   crossed steps one project, keeping the remainder, so a long swipe keeps going and you can reach
   any project. A trackpad keeps sending events after you lift your fingers; those are recognised by
   their fading size and ignored, which is what stops one flick running away down the list. */
const WHEEL_STEP = 75; // scroll distance that moves one project (one mouse notch is usually 100)
const LINE_HEIGHT = 16;
let wheelAcc = 0;
let wheelAt = 0;
let lastWheel = 0;
let lastAbs = 0;   // for spotting a trackpad coasting to a stop
let decayRun = 0;
let coasting = false;
addEventListener('wheel', (e) => {
  const way = e.deltaY;
  if (intro.active) {
    // the landing reads its stops in both directions; scrolling back up steps back through them
    if (!intro.handover) { if (way > 0) handOver(); return; }
    if (way > 0) releaseIntroHold();
    else stepIntroBack();
    return;
  }
  // once the hand-over is under way the scroll drives it and nothing else, either way
  if (state.panel === 'contact' || handoff.target > 0) {
    exitAcc = THREE.MathUtils.clamp(
      exitAcc + e.deltaY * (e.deltaMode === 1 ? LINE_HEIGHT : e.deltaMode === 2 ? innerHeight : 1),
      0, CONTACT_STEP,
    );
    setHandoff(exitAcc / CONTACT_STEP);
    return;
  }
  if (state.panel !== 'index') return;
  // and off the front of the spiral it goes back into the landing rather than stopping dead
  if (way < 0 && index.atStart() && reopenIntro()) return;
  const now = performance.now();
  const delta = e.deltaY * (e.deltaMode === 1 ? LINE_HEIGHT : e.deltaMode === 2 ? innerHeight : 1);
  const fresh = now - lastWheel > 180; // a pause means a fresh gesture
  const turned = wheelAcc !== 0 && Math.sign(delta) !== Math.sign(wheelAcc);
  if (fresh || turned) { wheelAcc = 0; lastAbs = 0; decayRun = 0; coasting = false; }
  lastWheel = now;

  /* Once you lift your fingers a trackpad keeps sending events that shrink steadily, and those
     shouldn't keep moving the spiral. Only a sustained run of shrinking events counts as coasting:
     judging each event against the gesture's biggest one used to throw away deliberate slow
     scrolling, which felt like the scroll sticking. */
  const size = Math.abs(delta);
  if (size > lastAbs * 1.15 + 0.5) { coasting = false; decayRun = 0; } // you pushed again
  else if (size <= lastAbs * 0.97) { if (++decayRun >= 5) coasting = true; }
  else decayRun = 0; // holding steady: still you
  lastAbs = size;
  if (coasting) return;

  // past the last project, keep scrolling and the view hands over to contact
  if (state.panel === 'index' && index.atEnd() && delta > 0) {
    exitAcc = THREE.MathUtils.clamp(exitAcc + delta, 0, CONTACT_STEP);
    setHandoff(exitAcc / CONTACT_STEP);
    return;
  }
  if (state.panel === 'index') exitAcc = 0;

  wheelAcc = THREE.MathUtils.clamp(wheelAcc + delta, -WHEEL_STEP * 1.5, WHEEL_STEP * 1.5);
  if (Math.abs(wheelAcc) >= WHEEL_STEP && now - wheelAt >= 220) { // spacing sets the pace of a long swipe
    index.step(Math.sign(wheelAcc));
    wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP;
    wheelAt = now;
  }
}, { passive: true });

/* A key that means "go on", and not merely a key.

   Every keydown used to count, which made a shortcut into two commands: cmd fires on its own the
   moment it goes down, so cmd+R entered the site, and the R that followed released the landing —
   the whole sequence gone before the browser had even begun to reload. Modifiers on their own do
   nothing now, and so does anything held with one; what is left is the handful of keys somebody
   actually presses to move forward. */
const ADVANCE = new Set(['Enter', ' ', 'Spacebar', 'ArrowDown', 'ArrowRight', 'PageDown', 'Tab']);
const RETREAT = new Set(['ArrowUp', 'ArrowLeft', 'PageUp']);
const bare = (e) => !e.metaKey && !e.ctrlKey && !e.altKey;
const isAdvance = (e) => bare(e) && ADVANCE.has(e.key);
const isRetreat = (e) => bare(e) && RETREAT.has(e.key);

addEventListener('keydown', (e) => {
  if (intro.active) {
    if (isRetreat(e)) { stepIntroBack(); return; }
    if (!isAdvance(e)) return;
    /* And it only ever advances one beat. The reveal is not interruptible: while it is playing,
       this does nothing, so a second press cannot run it to the end. It waits, the landing holds,
       and the next press is what lets it go on. */
    if (!intro.handover) handOver();
    else releaseIntroHold();
    return;
  }
  if (state.panel === 'contact') {
    if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') leaveContact();
    return;
  }
  if (e.key === 'Escape') return openPanel('index');
  if (state.panel !== 'index') return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    if (index.atEnd()) return enterContact();
    index.step(1);
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    if (index.atStart() && reopenIntro()) return;
    index.step(-1);
  }
});

let touchY = null;
addEventListener('touchstart', (e) => {
  if (intro.active && !intro.handover) handOver();
  touchY = e.touches[0].clientY;
}, { passive: true });
// a click no longer leaves the landing screen: you are meant to be able to move the cursor around
// it and uncover the field. The cue below the word is the button for it.
$('#intro-enter').addEventListener('click', handOver);
addEventListener('touchmove', (e) => {
  if (state.panel === 'contact' && touchY !== null) {
    if (e.touches[0].clientY - touchY > 60) leaveContact();
    return;
  }
  if (state.panel !== 'index' || touchY === null) return;
  const y = e.touches[0].clientY;
  if (Math.abs(touchY - y) > 45) {
    const dir = Math.sign(touchY - y);
    if (dir > 0 && index.atEnd()) enterContact();
    else index.step(dir);
    touchY = y;
  }
}, { passive: true });
addEventListener('touchend', () => { touchY = null; });

/* Where his head is and how fast it is going. Kept here rather than read back off the uniforms so
   the spring has a velocity to carry, which is the whole difference between a turn and a snap. */
const head = { yaw: 0, pitch: 0, yawV: 0, pitchV: 0 };
const HEAD_TURN = 1.9;    // reading the count: slow, and it takes a moment to get going
const HEAD_TRACK = 4.5;   // following the cursor: near enough immediate

const pointer = { x: 0, y: 0, active: false };
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseWorld = new THREE.Vector3();
const cursor = $('#cursor');
const cursorPos = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };

addEventListener('pointerdown', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.active = true;
});
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.active = true;
  cursorPos.tx = e.clientX;
  cursorPos.ty = e.clientY;
  intro.spot.tx = e.clientX;
  intro.spot.ty = e.clientY;
  cursor.classList.toggle('hover', !!e.target.closest('a, button'));
});
document.addEventListener('pointerleave', () => { pointer.active = false; });

/* ---------- Ambient sound (generated, no audio files) ---------- */
let audio = null;
function createAudio() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  filter.Q.value = 5;
  [55, 82.4, 110, 164.8, 220.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = rand(-8, 8);
    const g = ctx.createGain();
    g.gain.value = 0.3 / (i + 1);
    o.connect(g).connect(filter);
    o.start();
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  filter.connect(master).connect(ctx.destination);

  return {
    on: false,
    toggle() {
      this.on = !this.on;
      ctx.resume();
      master.gain.setTargetAtTime(this.on ? 0.15 : 0, ctx.currentTime, 0.5);
    },
    sweep() {
      if (!this.on) return;
      const t = ctx.currentTime;
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setTargetAtTime(1800, t, 0.15);
      filter.frequency.setTargetAtTime(500, t + 0.6, 0.6);
    },
  };
}
$('#sound').addEventListener('click', (e) => {
  audio ??= createAudio();
  audio.toggle();
  e.currentTarget.classList.toggle('on', audio.on);
});

/* ---------- Loop ---------- */
let sky = 1;   // how much of the backdrop is let through
let drift = 0; // how fast it runs past
const clock = new THREE.Clock();
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  uniforms.uTime.value = clock.elapsedTime;

  if (state.tweening) {
    const raw = Math.min((now - state.t0) / state.tweenMs, 1);
    uniforms.uProgress.value = raw;
    if (raw >= 1) state.tweening = false;
  }

  // The local Claude transition is a five-beat reveal: compressed mark, eyes, body assembly,
  // bicep curl, then the project spiral. Without those local assets the original depth rack stays
  // available, so production never waits on a mascot file it was not meant to load.
  if (intro.active && intro.handover) {
    const elapsed = now - intro.sweepStarted;
    const phase = (start, end) => {
      const t = Math.min(Math.max((elapsed - start) / (end - start), 0), 1);
      return t * t * (3 - 2 * t);
    };
    if (intro.mascotSequence) {
      /* The word tears itself out over the first 0.7s. He is already standing there in the dark,
         and a beam runs slowly down him from above his crown to below his traps, leaving him lit
         behind it. Nothing gathers and nothing travels: the only thing that moves is the light. */
      const sweep = phase(700, 3100);
      const body = sweep;
      uniforms.uEyeReveal.value = sweep;
      uniforms.uBodyReveal.value = body;
      // from above his crown to below the cut, whatever height he is set to
      uniforms.uBeam.value = (BUST_HEIGHT / 2 + 0.25) - sweep * (BUST_HEIGHT + 0.6);
      uniforms.uBeamOn.value = 1;

      /* It does not simply fade up. It catches twice and drops out before it holds — the way
         anything running on a current does — and once it is steady it breathes, so the light is
         never a still frame. Both are written against the beat rather than a clock of their own,
         so slowing the sequence down slows the flicker with it. */
      const settling = Math.min(Math.max((elapsed - 560) / 520, 0), 1);
      const catchOne = 1 - 0.85 * Math.exp(-Math.pow((settling - 0.18) * 26, 2));
      const catchTwo = 1 - 0.55 * Math.exp(-Math.pow((settling - 0.42) * 30, 2));
      const breath = 0.94 + 0.06 * Math.sin(elapsed * 0.0042) + 0.02 * Math.sin(elapsed * 0.017);
      uniforms.uKindle.value = catchOne * catchTwo * breath;
      if (!intro.flexStarted) uniforms.uProgress.value = body;

      if (!intro.held && elapsed >= 3800 && !intro.flexStarted) {
        intro.flexStarted = true;
        fromAttr.array.set(mascotNeutralAttr.array);
        fromAttr.needsUpdate = true;
        setTarget(mascotFlexAttr);
        uniforms.uProgress.value = 0;
        uniforms.uArcStrength.value = 0.1;
        state.tweening = false;
      }
      if (intro.flexStarted) uniforms.uProgress.value = phase(3800, 4700);

      /* He is built; he slides off centre and the count arrives in the space he leaves. From here
         the sequence stops rather than running on into the Index — the landing is this portrait
         and these four numbers, and it waits for you. */
      if (elapsed >= 3250 && !intro.statsShown) {
        intro.statsShown = true;
        $('#intro').classList.add('stats-in');
        revealStats();
      }
      if (intro.statsShown && !intro.released) {
        if (!intro.held) intro.stagedAt = now;   // the stop starts its own gate as it is reached
        intro.held = true;
        intro.sweepStarted = now - INTRO_HOLD_AT;   // freeze the clock where it stands
      }

      if (!intro.held && elapsed >= 4700 && !intro.projectsStarted) {
        intro.projectsStarted = true;
        intro.revealIndex = true;
        document.body.classList.add('intro-projects');
        if (state.panel !== 'index') openPanel('index');
      }
    }
    const duration = intro.mascotSequence ? INTRO_SWEEP : INTRO_FALLBACK_SWEEP;
    // While the landing is holding on the portrait, nothing runs the clock out from under it.
    const raw = intro.held ? 0 : Math.min(elapsed / duration, 1);
    if (raw >= 1) endIntro();
  }

  // the hand-over owns the scatter outright while it runs: it is a scrub, not something to chase
  if (handoff.p > 0) uniforms.uDisperse.value = handoff.disperse;
  else {
    /* Once the hand-over starts the scatter has to go, and go quickly — the loader's own scatter is
       no longer anyone's business. Left in, it spreads the word across the whole screen and what
       you see is a field of particles where the background should be flat black. */
    /* The field is blown apart by the white page rising over it and gathers again as it falls, both
       read straight off the page's own move — so it is the same gesture backwards, not a second
       animation that happens to run at the same time. */
    const white = projectWhite();
    const disperseTarget = intro.active ? 0
      : !state.ready ? 4
      : 0.25 * white; // the case page no longer blows the field apart: the model stays whole beside it
    const settle = intro.handover ? 5 : !state.ready ? 10 : white > 0.001 ? 9 : 1.6;
    uniforms.uDisperse.value = damp(uniforms.uDisperse.value, disperseTarget, settle, dt);
  }
  const sizeTarget = 22 + 42 * handoff.size;
  uniforms.uSize.value = damp(uniforms.uSize.value, sizeTarget, 3, dt);
  const mascotField = intro.active && intro.handover && intro.mascotSequence
    && now - intro.sweepStarted >= 560; // the eyes come up as the last of the word goes
  // Behind a case study the client's model stays lit (dimmer on phones, where it sits under the copy).
  const fieldOpacity = intro.active && !intro.revealIndex && !mascotField ? 0 : 1 - projectWhite() * (isMobile ? 0.7 : 0.1);
  const opacitySettle = projectWhite() > 0.001 ? 9 : 4;
  uniforms.uOpacity.value = damp(uniforms.uOpacity.value, fieldOpacity, opacitySettle, dt);
  /* The bloom is eased back while the curtain is the only thing in frame: it is already a broad
     soft light of its own, and a post-process pass over it on a black screen only fogs it. */
  const kindling = intro.active && intro.mascotSequence
    && uniforms.uEyeReveal.value > 0.01 && uniforms.uBodyReveal.value < 0.6;
  const bloomTarget = kindling ? 0.24 : intro.active && intro.handover ? 0.4 : 0.45;
  bloom.strength = damp(bloom.strength, bloomTarget, 3, dt);

  const k = 1 - Math.exp(-1.8 * dt);
  uniforms.uColorA.value.lerp(state.colorA, k);
  uniforms.uColorB.value.lerp(state.colorB, k);

  ndc.set(pointer.x, pointer.y);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(plane, mouseWorld)) {
    uniforms.uMouse.value.lerp(mouseWorld, 1 - Math.exp(-8 * dt));
  }
  // no cursor repulsion on the landing screen: it would hollow out the field exactly where the
  // hole in the black is showing it
  // The mascot's head follows the cursor — and where you click, since the cursor is there too;
  // pointerdown also feeds the pointer for a tap, which never moves it first.
  const targetNow = geometry.attributes.aTarget;
  const headOn = mascotAttr && (targetNow === mascotNeutralAttr || targetNow === mascotFlexAttr)
    ? Math.min(uniforms.uProgress.value, 1) : 0;
  uniforms.uHeadOn.value = damp(uniforms.uHeadOn.value, headOn, 4, dt);
  /* The aurora belongs to the figure, not to one pose of him. The head-turn weighting above is
     gated on the flex specifically, and reusing it here left him drawn as plain points for the
     whole of the intro's build, when he stands in the neutral pose. */
  const auroraOn = headOn;
  uniforms.uAurora.value = damp(uniforms.uAurora.value, auroraOn, 4, dt);
  /* He looks at the count as it arrives, and at you the rest of the time.

     On a spring, not an ease. An exponential ease leaves at full speed the instant the target moves
     and then crawls the last of the way — which is the wrong shape for a head: a head turning to
     look at something accelerates out of rest, travels, and decelerates into the new place. This is
     the same critically damped spring the spiral rides on, run softly for a deliberate glance and
     harder when he is just tracking the cursor. */
  // side on, his head holds the pose: a head that keeps turning to you is not a profile
  const glance = intro.active ? (intro.profile ? [0, 0] : glanceAt) : null;
  const yawTo = glance ? glance[0] : pointer.x * 0.55;
  const pitchTo = glance ? glance[1] : -pointer.y * 0.30;
  const turn = glance ? HEAD_TURN : HEAD_TRACK;
  const settle = 1 - Math.exp(-turn * 4 * dt);
  head.yawV += ((yawTo - head.yaw) * turn - head.yawV) * settle;
  head.pitchV += ((pitchTo - head.pitch) * turn - head.pitchV) * settle;
  head.yaw += head.yawV * dt;
  head.pitch += head.pitchV * dt;
  uniforms.uHeadYaw.value = head.yaw;
  uniforms.uHeadPitch.value = head.pitch;
  // Quantised 38ms holds make the burst feel frame-animated rather than like continuous noise.
  if (now < mascotGlitch.end) {
    /* Quantised holds are what made this read as frame animation on a field of hard points. On a
       figure made of light they read as a stutter, so the steps are shallower and the attack and
       release are long enough that the burst arrives and leaves rather than snapping on and off. */
    const elapsed = now - mascotGlitch.start;
    const heldFrame = Math.floor(elapsed / 52);
    const stepped = heldFrame % 3 === 1 ? 0.74 : 1;
    const attack = Math.min(elapsed / 60, 1);
    const release = Math.min((mascotGlitch.end - now) / 90, 1);
    uniforms.uGlitch.value = mascotGlitch.strength * stepped * Math.min(attack, release);
  } else {
    uniforms.uGlitch.value = damp(uniforms.uGlitch.value, 0, 12, dt);
  }
  const showGlitchPlates = uniforms.uAurora.value > 0.02 && uniforms.uGlitch.value > 0.015;
  glitchGhosts.forEach((ghost) => { ghost.visible = showGlitchPlates; });

  const repel = pointer.active && !intro.active && (!state.panel || state.panel === 'index');
  uniforms.uMouseStrength.value = damp(uniforms.uMouseStrength.value, repel ? 1 : 0, 3, dt);

  if (intro.active) {
    // the hole in the black trails the cursor, and opens only once there is one to follow
    const spot = intro.spot;
    spot.x = damp(spot.x, spot.tx, 11, dt);
    spot.y = damp(spot.y, spot.ty, 11, dt);
    spot.r = damp(spot.r, pointer.active && !intro.handover ? INTRO_HOLE : 0, 4, dt);
    const mask = `radial-gradient(circle ${spot.r.toFixed(0)}px at ${spot.x.toFixed(0)}px ${spot.y.toFixed(0)}px,`
      + ' transparent 0%, rgba(0,0,0,0.5) 42%, #000 76%)';
    if (mask !== intro.mask) {
      intro.mask = mask;
      veil.style.webkitMaskImage = mask;
      veil.style.maskImage = mask;
    }
  }

  // the hand-over to contact: eased towards whatever the scroll last asked for, and committed
  // only at the ends, so a half-finished move can still go either way
  if (handoff.p !== handoff.target) {
    /* Moved at a capped rate rather than eased towards the target: easing towards it covers half
       the move in a moment and then crawls the rest, which reads as fast and then stuck. At a
       steady rate the shaping is left to smootherstep inside applyHandoff, which is flat at both
       ends — so the whole thing starts gently, travels evenly and settles without a stop. */
    const step = HANDOFF_RATE * dt;
    const diff = handoff.target - handoff.p;
    handoff.p += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
    if (handoff.p >= 1) { handoff.p = 1; commitContact(); }
    if (handoff.p <= 0) { handoff.p = 0; releaseContact(); }
    applyHandoff(handoff.p);
  }

  const inIndex = state.panel === 'index';
  const inContact = state.panel === 'contact';
  // Keep the Index invariant explicit: its shared particle field is always the spine, never a
  // project model left behind by an interrupted panel/intro transition.
  if (inIndex && !intro.active && handoff.p <= 0 && geometry.attributes.aTarget !== centrepiece()) {
    showSpine();
  }
  index.update(dt, inIndex || handoff.p > 0, clock.elapsedTime);
  uniforms.uSplit.value = damp(uniforms.uSplit.value, inIndex ? 1 : 0, 2, dt);
  if (intro.active) {
    /* The view sits a little in on the curtain while it is only light, and pulls back as he
       gathers out of it — a push-in done by scaling the field rather than moving the camera, which
       would drag the starfield and the backdrop along with it. */
    const built = uniforms.uBodyReveal.value;
    const zoom = 1 + (KINDLE_ZOOM - 1) * (1 - built);
    if (intro.mascotSequence) points.scale.setScalar(mascotAttr ? zoom : 1);
    // he stands in the lower half of the frame, not the middle of it
    points.position.y = damp(points.position.y, intro.mascotSequence ? BUST_DROP * zoom : 0, 4, dt);
    /* Face on he holds the middle of the frame, with the count set around him. On the profile beat
       he turns a quarter turn — nose to the left of the screen — and moves across to leave the
       right of the frame to the line that arrives there. Eased slowly: it is a camera move as much
       as a turn, and it is the only thing happening on that beat. */
    const sideOn = intro.profile && intro.mascotSequence;
    points.position.x = damp(points.position.x, sideOn ? profileShift() : 0, 2.2, dt);
    points.rotation.y = damp(points.rotation.y, sideOn ? -Math.PI / 2 : 0, 2.0, dt);
  } else if (handoff.p > 0) {
    /* Mid hand-over. It starts tracking the spiral exactly and ends square to the front on the
       nearest whole turn, so the wordmark faces you without ever unwinding backwards. Owned here
       for the whole move, in both directions, or the rotation would jump at the ends. */
    const e = handoff.p * handoff.p * (3 - 2 * handoff.p);
    const spiral = index.angle();
    // no sway at the end of it: the screen is a flat plane, and any tilt shows it edge-on
    points.rotation.y = spiral + (handoff.turn - spiral) * e;
    points.position.y = mascotAttr ? 0 : (((index.lift() % SPINE_GAP) + SPINE_GAP) % SPINE_GAP) * (1 - e);
  } else if (inIndex) {
    // The spine turns and climbs in lockstep with the spiral. The spiral's angle keeps counting
    // up past a full turn, so it must be followed exactly: easing towards it the "short way round"
    // makes the spine spin backwards whenever it falls more than half a turn behind.
    /* The spine was a column: it turned with the spiral and climbed on its own period so it never
       appeared to end. The mascot does neither — he faces you and stays put, and the only thing that
       moves is his head, following the cursor. */
    points.rotation.y = mascotAttr ? damp(points.rotation.y, 0, 6, dt) : index.angle();
    points.position.y = mascotAttr
      ? damp(points.position.y, INDEX_LIFT, 4, dt)
      : ((index.lift() % SPINE_GAP) + SPINE_GAP) % SPINE_GAP;
  } else if (PROJECTS[state.index].spin) {
    points.position.y = damp(points.position.y, 0, 4, dt);
    points.rotation.y += dt * 0.08;
  } else {
    points.position.y = damp(points.position.y, 0, 4, dt);
    // sway around the model's front view, taking the shortest way back after a spin
    const target = Math.sin(clock.elapsedTime * 0.3) * 0.45;
    const diff = Math.atan2(Math.sin(target - points.rotation.y), Math.cos(target - points.rotation.y));
    points.rotation.y += diff * (1 - Math.exp(-1.5 * dt));
  }
  /* A case study slides the client's model across to the right half of the frame, where the pane
     thins out, and it turns there while you read. */
  const caseIn = projectWhite();
  if (!intro.active && handoff.p <= 0) {
    points.position.x = damp(points.position.x, isMobile ? 0 : caseIn * CASE_SHIFT, 3, dt);
  }
  // the intro drives his scale itself; everywhere else he is at rest, and small behind the spiral
  if (!intro.active) {
    const rest = inIndex && mascotAttr ? INDEX_SCALE : 1;
    points.scale.setScalar(damp(points.scale.x, rest * (1 - caseIn * 0.22), 4, dt));
  }
  const upright = inIndex || intro.active || handoff.p > 0; // the screen must not lean with the pointer
  group.rotation.x = damp(group.rotation.x, upright ? 0 : -pointer.y * 0.2, 2, dt);
  group.rotation.z = damp(group.rotation.z, upright ? 0 : -pointer.x * 0.08, 2, dt);
  camera.position.z = damp(camera.position.z, CAMERA_Z - 1.1 * handoff.p, 1.6, dt);
  camera.position.x = damp(camera.position.x, pointer.x * 0.35, 2, dt);
  camera.position.y = damp(camera.position.y, pointer.y * 0.2, 2, dt);
  camera.lookAt(0, 0, 0);

  cursorPos.x = damp(cursorPos.x, cursorPos.tx, 18, dt);
  cursorPos.y = damp(cursorPos.y, cursorPos.ty, 18, dt);
  cursor.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;

  /* Flat black through the intro: the word has to be the only thing on screen. The dust and the
     gradient come up only once the stream is running, which is what makes the backdrop arrive. */
  const skyTarget = intro.active && !intro.revealIndex ? 0 : 1;
  sky = damp(sky, skyTarget, intro.revealIndex ? 0.9 : 6, dt);
  atmosphere.setFade(sky);
  drift = damp(drift, intro.drift, intro.drift ? 0.8 : 1.6, dt);
  atmosphere.setDrift(drift);
  uniforms.uCoil.value = damp(uniforms.uCoil.value, intro.coil, 1.5, dt);
  atmosphere.update(clock.elapsedTime);
  composer.render();
  requestAnimationFrame(tick);
}
tick();

// Handy for live tweaking in the devtools console, e.g. site.uniforms.uSize.value = 30
window.site = { revealStats, statFault, uniforms, state, introStatic, centrepiece, triggerGlitch, wordAttr, spineAttr, bloom, goTo, openPanel, index, scene, points, camera, intro, handoff, setHandoff, startIntro, introReady, streamAway, handOver, endIntro, enterContact, leaveContact };

/* ---------- Loading ---------- */
(function load() {
  const count = $('#intro-count');
  const start = performance.now();
  const DURATION = 1600;
  startIntro(); // the letters arrive while the scene is being built
  const introShapesReady = Promise.all([prepareIntroShapes(), loadMascot()]);
  (function step() {
    const t = Math.min((performance.now() - start) / DURATION, 1);
    count.textContent = Math.round((1 - (1 - t) ** 3) * 100);
    if (t < 1) return requestAnimationFrame(step);
    introShapesReady.then(() => {
      state.ready = true;
      introReady(); // the tagline and the scroll cue replace the count
    });
  })();
})();
