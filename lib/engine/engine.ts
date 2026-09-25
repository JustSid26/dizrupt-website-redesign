import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAMERA_Z, COUNT, isMobile, reducedMotion } from './config';
import { ParticleField } from './field';
import { BUST_DROP, BUST_HEIGHT, loadMascot } from './mascot';
import { createIndex } from './spiral';
import { createWindowField } from './windowField';
import { createAtmosphere } from './atmosphere';
import { createCity } from './city';
import { BOARD_HEIGHT, createBillboard } from './billboard';
import { createMascotLine, trainShape } from './mascotLine';
import { signals } from '@/lib/signals';
import { clients, slugOf, type Project } from '@/content/projects';
import { SOLUTIONS } from '@/content/solutions';
import { BANNERS } from '@/content/banners';
import { SOCIALS } from '@/content/socials';

/* =========================================================
   The engine: one canvas behind the whole site.

   Nothing in here decides where you are. The page's scroll writes
   signals (lib/signals.ts) and every frame the director reads them
   and works out what the particles should be — the mascot on the
   landing, a solution's model, the project cards, the mascot again
   at contact — and eases everything there. Scroll back and it all
   runs backwards, because it is all derived from where you are.
   ========================================================= */
export type EngineOptions = {
  canvas: HTMLCanvasElement;
  indexLayer: HTMLElement; // where the spiral's hit areas and labels are placed
  onOpenProject: (slug: string) => void;
};

const MASCOT_COLORS: [string, string] = ['#c9b8ff', '#6f4dff'];
const CASE_SHIFT = 2.35;
const MENU_SHIFT = 2.95;
const HEAD_TURN = 1.9; // reading the count: slow, and it takes a moment to get going
const HEAD_TRACK = 4.5; // following the cursor: near enough immediate

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

export async function createEngine({ canvas, indexLayer, onOpenProject }: EngineOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 1);
  renderer.localClippingEnabled = true; // the station is revealed below its build line

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
  camera.position.z = CAMERA_Z;

  const field = new ParticleField(pixelRatio);
  const u = field.uniforms;
  u.uBustHalf.value = BUST_HEIGHT / 2;
  scene.add(field.group);
  const points = field.points;

  const atmosphere = createAtmosphere({ scene, camera, colorA: u.uColorA.value, colorB: u.uColorB.value });
  atmosphere.gradient.visible = false; // the city's night sky is the backdrop now

  // the spiral of client cards (spiral.ts); clicking one presents it, then its case page opens
  let presentTimer = 0;
  const index = createIndex({
    projects: clients,
    scene,
    camera,
    isMobile,
    container: indexLayer,
    onSelect: (p: Project) => {
      const n = clients.indexOf(p);
      index.fault(n, 340);
      triggerGlitch(320, 0.9);
      index.present(n);
      signals.presenting = n;
      clearTimeout(presentTimer);
      presentTimer = window.setTimeout(() => onOpenProject(slugOf(p)), 520);
    },
  });
  const windowField = createWindowField({ scene, count: COUNT, cardScale: index.cardScale });

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.22, 0.26);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    atmosphere.resize();
    if (!built) return;
    billboard.measure();
  built = true;
    const k = camKeys();
    paths = { pos: new THREE.CatmullRomCurve3(k.pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(k.look, false, 'centripetal') };
  };
  let built = false;
  addEventListener('resize', resize);

  /* ---------- the mascot ---------- */
  const loadModel = (url: string) => new GLTFLoader().loadAsync(url).then((g) => g.scene).catch(() => null);
  const [mascot, landmarks, cityModel, trainModel, stationModel] = await Promise.all([
    loadMascot(),
    // the NYC landmarks, modelled in Blender
    new GLTFLoader().loadAsync('/models/nyc.glb').then((g) => {
      const out: { name: string; geometry: THREE.BufferGeometry }[] = [];
      g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push({ name: o.name, geometry: (o as THREE.Mesh).geometry }); });
      return out;
    }).catch(() => []),
    // the whole city, modelled in Blender: one mesh of buildings, and the Times Square screens
    new GLTFLoader().loadAsync('/models/nyc-city.glb').then((g) => {
      let city: THREE.BufferGeometry | null = null;
      const screens: THREE.BufferGeometry[] = [];
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.updateMatrixWorld();
        const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
        if (o.name === 'city') city = geo;
        else if (o.name.startsWith('screen')) screens.push(geo);
      });
      return city ? { city, screens } : null;
    }).catch(() => null),
    // the bullet train and its start station, modelled in Blender
    loadModel('/models/train.glb'),
    loadModel('/models/station.glb'),
  ]);
  if (mascot) {
    field.register('mascot:neutral', mascot.neutral);
    field.register('mascot:flex', mascot.flex);
    field.register('mascot:full', mascot.full);
    (field.geometry.attributes.aHead as THREE.BufferAttribute).array.set(mascot.head);
    field.geometry.attributes.aHead.needsUpdate = true;
    u.uHeadPivot.value.copy(mascot.pivot);
  } else {
    // without the files he is the wordmark, so the site still reads
    field.register('mascot:neutral', field.shape('wordmark'));
    field.register('mascot:flex', field.shape('wordmark'));
    field.register('mascot:full', field.shape('wordmark'));
  }
  /* ---------- the city, and the billboard the landing turns out to be ---------- */
  // he stands head to toe on a low plinth, so the ground is set by where his feet are
  const feetY = BUST_DROP + (mascot ? mascot.feet : -6);
  const PLINTH_TOP = feetY;
  const GROUND = feetY - 1.2;
  const boardAt = new THREE.Vector3(10, GROUND + 9.5, 22);
  const boardFacing = new THREE.Vector3(-0.25, 0, 1).normalize();
  const billboard = createBillboard(boardAt, boardFacing);
  const city = createCity(pixelRatio, { center: boardAt, normal: boardFacing, height: BOARD_HEIGHT }, GROUND, PLINTH_TOP, BUST_DROP + BUST_HEIGHT / 2, landmarks, cityModel);
  scene.add(city.group, billboard.group);
  // his own line, with a station for each solution
  const line = createMascotLine(pixelRatio, GROUND, PLINTH_TOP, isMobile ? 34 : 48,
    SOLUTIONS.map((sol) => ({
      name: sol.name, shape: field.shape(sol.shape).array as Float32Array, colors: sol.colors,
      // the banner at each station shows the work that proves it
      images: [sol.image, ...sol.work.split('·').map((w) => w.trim().toLowerCase())
        .map((w) => Object.entries(BANNERS).find(([title]) => title.toLowerCase().startsWith(w.split(' ')[0]))?.[1])
        .filter((u): u is string => !!u)],
    })),
    stationModel ?? new THREE.Group());
  scene.add(line.group);
  const trainLocal = trainShape(trainModel);
  const TRAIN_HALF = (() => { let m = 0; for (let i = 2; i < trainLocal.length; i += 3) m = Math.max(m, trainLocal[i]); return m; })(); // origin to the nose tip
  /* The real train. Its particles land on it first; then it is shown solid, swept in from its
     wheels to its roof, and they fade. It rides wherever the particles do. */
  const trainClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
  const trainSolid = new THREE.Group();
  if (trainModel) {
    trainModel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.clippingPlanes = [trainClip];
      mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.8);
      m.material = mat;
    });
    trainSolid.add(trainModel);

  }
  trainSolid.visible = false;
  /* One soft light for the modelled things (the station and the train), in the evening's colours:
     a sky above and a warm low sun, dimmer at night. */
  const skyLight = new THREE.HemisphereLight('#9fb0ff', '#1c1826', 0.55);
  const dusk = new THREE.DirectionalLight('#ffc9a0', 0.75);
  dusk.position.set(-20, 18, 30);
  scene.add(skyLight, dusk);
  trainSolid.matrixAutoUpdate = false;
  scene.add(trainSolid);
  let solidK = 0;
  const pose0M = new THREE.Matrix4();
  field.register('train', new THREE.BufferAttribute(trainLocal, 3));
  // the same train, already standing at the start station, in world space: what the windows become
  {
    const pose0 = line.poseAt(0);
    const m = pose0M.compose(pose0.pos, pose0.quat, new THREE.Vector3(1, 1, 1));
    const arr = new Float32Array(trainLocal.length);
    const v = new THREE.Vector3();
    for (let i = 0; i < trainLocal.length; i += 3) {
      v.set(trainLocal[i], trainLocal[i + 1], trainLocal[i + 2]).applyMatrix4(m);
      arr[i] = v.x; arr[i + 1] = v.y; arr[i + 2] = v.z;
    }
    field.register('train:station', new THREE.BufferAttribute(arr, 3));
  }
  const aerialPos = new THREE.Vector3(0, GROUND + 22, 54);
  const stationCamPos = line.stationAt.clone().add(new THREE.Vector3(-10.5, 5.6, 1.5));
  const stationCamLook = line.stationAt.clone().add(new THREE.Vector3(0, 2.2, 6));
  const aerialLook = new THREE.Vector3(0, GROUND + 12, 0);

  /* ---------- the social skyscrapers: the tallest towers facing the city view carry the studio's
     links as lit signs near their tops (clickable at contact, see SocialTowers.tsx) ---------- */
  const socialSigns: THREE.Mesh[] = [];
  if (cityModel) {
    // each building's footprint and height, from the model's per-vertex building data
    const g = (cityModel as unknown as { city: THREE.BufferGeometry }).city;
    const pos = g.attributes.position, uvA = g.attributes.uv, u1 = g.attributes.uv1;
    const blds = new Map<string, { cx: number; cz: number; h: number; maxZ: number; minX: number; maxX: number }>();
    for (let i = 0; i < pos.count; i++) {
      const cx = uvA.getX(i), cz = 1 - uvA.getY(i);
      const key = `${cx.toFixed(2)},${cz.toFixed(2)}`;
      const b = blds.get(key) ?? { cx, cz, h: u1.getX(i), maxZ: -1e9, minX: 1e9, maxX: -1e9 };
      // only the tower's own upper part decides its face (not a podium)
      if (pos.getY(i) > b.h * 0.6) { b.maxZ = Math.max(b.maxZ, pos.getZ(i)); b.minX = Math.min(b.minX, pos.getX(i)); b.maxX = Math.max(b.maxX, pos.getX(i)); }
      blds.set(key, b);
    }
    // tall, in front of the plaza from the camera's side, spread across the view
    const candidates = [...blds.values()].filter((b) => b.h > 11 && b.cz > -26 && b.cz < 8 && Math.abs(b.cx) < 34 && b.maxZ > -1e8 && Math.hypot(b.cx, b.cz) > 13);
    candidates.sort((a, b) => a.cx - b.cx);
    const picks: typeof candidates = [];
    const n = SOCIALS.length;
    for (let k = 0; k < n; k++) {
      const want = -30 + (60 * (k + 0.5)) / n;
      const best = candidates.filter((c) => !picks.includes(c)).sort((a, b) => Math.abs(a.cx - want) - Math.abs(b.cx - want) + (b.h - a.h) * 0.08)[0];
      if (best) picks.push(best);
    }
    picks.sort((a, b) => a.cx - b.cx);
    picks.forEach((b, k) => {
      const soc = SOCIALS[k];
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const x = c.getContext('2d')!;
      x.fillStyle = '#07070c'; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = soc.color; x.lineWidth = 14; x.strokeRect(20, 20, 472, 472);
      x.fillStyle = soc.color === '#ffffff' ? '#ffffff' : soc.color;
      if (soc.path) {
        x.save(); x.translate(106, 106); x.scale(300 / 24, 300 / 24);
        x.fill(new Path2D(soc.path)); x.restore();
      } else if (soc.mark === 'in') {
        x.beginPath();
        x.moveTo(146, 106); x.arcTo(406, 106, 406, 406, 40); x.arcTo(406, 406, 106, 406, 40); x.arcTo(106, 406, 106, 106, 40); x.arcTo(106, 106, 406, 106, 40);
        x.closePath(); x.fill();
        x.fillStyle = '#fff'; x.font = '800 200px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('in', 262, 270);
      } else {
        x.lineWidth = 22; x.strokeStyle = soc.color; x.lineJoin = 'round';
        x.strokeRect(96, 146, 320, 220);
        x.beginPath(); x.moveTo(96, 146); x.lineTo(256, 276); x.lineTo(416, 146); x.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const w = Math.min(4.8, Math.max(2.8, (b.maxX - b.minX) * 1.1)); // big enough to read and click from the city view
      void tex;
      // the hit area: an invisible square where the logo is lit
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ visible: false }));
      /* The logo is the tower's own windows: a grid of panes on its face, those inside the mark lit
         in the brand's colour, the rest left as ordinary dim windows — the way buildings spell
         things out at night. */
      const G = 26;
      const img = x.getImageData(0, 0, 512, 512).data;
      const lp: number[] = [], lc: number[] = [];
      const brand = new THREE.Color(soc.color), dimW = new THREE.Color(0.35, 0.3, 0.22);
      for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
        const px = Math.floor(((gx + 0.5) / G) * 512), py = Math.floor(((gy + 0.5) / G) * 512);
        const i4 = (py * 512 + px) * 4;
        const lum = (img[i4] + img[i4 + 1] + img[i4 + 2]) / 765;
        const onMark = lum > 0.35 && !(px < 30 || py < 30 || px > 482 || py > 482); // not the old frame
        lp.push((gx / (G - 1) - 0.5) * w, (0.5 - gy / (G - 1)) * w, 0);
        const c = onMark ? brand : dimW;
        const k = onMark ? 4 : Math.random() < 0.4 ? 0.35 : 0.04;
        lc.push(c.r * k, c.g * k, c.b * k);
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
      const panes = new THREE.Points(lg, new THREE.PointsMaterial({ size: (w / G) * 0.9, vertexColors: true, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      panes.frustumCulled = false;
      panes.renderOrder = 60; // a lit mark is never lost behind a nearer tower
      sign.add(panes);
      sign.position.set(b.cx, GROUND + b.h * 0.78, b.maxZ + 0.08);
      sign.visible = false;
      scene.add(sign);
      socialSigns.push(sign);
    });
  }
  billboard.measure();

  /* The landing's camera move. It starts square on to the board at the distance where the board
     exactly fills the screen, so the page can hand over to it without a seam; pulls back and swings
     round to show the board on its tower; rises over the city; then flies in to him and ends on the
     same framing every later section uses, so the hand-over at the far end is seamless too. */
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), boardFacing).normalize().negate();
  const at = (v: THREE.Vector3, n: number, sd: number, up: number) =>
    v.clone().addScaledVector(boardFacing, n).addScaledVector(side, sd).add(new THREE.Vector3(0, up, 0));
  const CAM_KEYS = [0.015, 0.13, 0.26, 0.4, 0.55];
  const camKeys = () => {
    const fill = billboard.fillDistance(camera.fov);
    return {
      pos: [at(boardAt, fill, 0, 0), at(boardAt, 11, 5, -1.2), new THREE.Vector3(26, GROUND + 16, 46), new THREE.Vector3(0, GROUND + 22, 54), new THREE.Vector3(0, 0, CAMERA_Z)],
      look: [boardAt.clone(), at(boardAt, 0, 0, -1.2), new THREE.Vector3(6, GROUND + 6, 10), new THREE.Vector3(0, GROUND + 12, 0), new THREE.Vector3(0, 0, 0)],
    };
  };
  let paths = (() => {
    const k = camKeys();
    return { pos: new THREE.CatmullRomCurve3(k.pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(k.look, false, 'centripetal') };
  })();
  const camPath = (ip: number, pos: THREE.Vector3, look: THREE.Vector3) => {
    // map the scroll onto the curve so each key is reached at its own point in the scroll
    let seg = 0;
    while (seg < CAM_KEYS.length - 2 && ip > CAM_KEYS[seg + 1]) seg++;
    const t = clamp01((ip - CAM_KEYS[seg]) / (CAM_KEYS[seg + 1] - CAM_KEYS[seg]));
    const e = t * t * (3 - 2 * t);
    const u = (seg + e) / (CAM_KEYS.length - 1);
    paths.pos.getPoint(u, pos);
    paths.look.getPoint(u, look);
  };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const tmpDir = new THREE.Vector3(), tmpOut = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpUp = new THREE.Vector3();

  field.place(field.shape('mascot:neutral'));
  field.colorA.set(MASCOT_COLORS[0]);
  field.colorB.set(MASCOT_COLORS[1]);
  // build the six solution models now, so scrolling onto one never stalls on it
  SOLUTIONS.forEach((s) => field.shape(s.shape));
  signals.ready = true;

  /* ---------- glitch bursts (Spider-Verse: rare, abrupt, over in a few held frames) ---------- */
  const burst = { start: 0, end: 0, strength: 0 };
  let lastReseed = 0;
  function triggerGlitch(ms = 165, strength = 0.72) {
    const now = performance.now();
    u.uGlitchSeed.value = Math.random() * 100;
    burst.start = now;
    burst.end = now + ms;
    burst.strength = strength;
  }
  let glitchTimer = 0;
  const scheduleGlitch = () => {
    glitchTimer = window.setTimeout(() => {
      if (key.startsWith('mascot:') && !reducedMotion) triggerGlitch(200 + Math.random() * 180, 0.85 + Math.random() * 0.15);
      scheduleGlitch();
    }, 900 + Math.random() * 1900);
  };
  scheduleGlitch();

  /* ---------- pointer ---------- */
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mouseWorld = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const head = { yaw: 0, pitch: 0, yawV: 0, pitchV: 0 };

  /* ---------- the window field's view of the mascot (window.ts flies to and from this) ---------- */
  let fieldOpacity = 0;
  let mascotVisible = 1;
  const source = {
    shape: () => field.target.array,
    matrix: () => points.matrixWorld,
    showing: () => fieldOpacity > 0.3,
  };

  const profileShift = () => {
    if (innerWidth <= 900) return 0;
    const visible = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAMERA_Z;
    return -visible * camera.aspect * 0.17;
  };

  let key = 'mascot:neutral'; // the shape the field is heading for
  let scrubbing = false; // uProgress is being driven by the scroll
  let scrubFrom = '';
  const ride = { s: 0, v: 0 }; // and what it is scrubbing away from

  /* The count, as four windows of his light. Laid out for the close framing the camera lands on
     (2 × 2 across a wide screen, stacked on a narrow one), each a lit frame round a pane of glass
     made of the same particles he was. Rebuilt when the window changes shape. */
  type Panel = { x: number; y: number; z: number; w: number; h: number; yaw: number; pitch: number; m: THREE.Matrix4 };
  const statPanels: Panel[] = [];
  function buildStatWindows() {
    const aspect = innerWidth / innerHeight;
    const halfH = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(22.5));
    const halfW = halfH * aspect;
    statPanels.length = 0;
    const mk = (x: number, y: number, z: number, w: number, h: number, yaw: number, pitch: number) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      statPanels.push({ x, y, z, w, h, yaw, pitch, m });
    };
    if (aspect > 1) {
      /* A curved HUD round you: the outer windows come forward and turn in, the top pair leans down
         to you and the bottom pair up, so the four read as one bent sheet of light. */
      const w = Math.min(2.7, halfW * 0.6), h = Math.min(1.35, halfH * 0.48);
      const gx = Math.min(halfW - w / 2 - 0.2, w / 2 + 0.45), gy = Math.min(halfH - h / 2 - 0.5, h / 2 + 0.32);
      for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) mk(sx * gx, sy * gy - 0.15, 0.3, w, h, -sx * 0.5, sy * 0.24);
    } else {
      const w = halfW * 1.6, h = Math.min(1.2, (halfH * 2 - 1.6) / 4 - 0.25);
      for (let i = 0; i < 4; i++) mk(0, (1.5 - i) * (h + 0.3) - 0.2, 0, w, h, (i % 2 ? 1 : -1) * 0.28, (1.5 - i) * 0.12);
    }
    /* Particle i goes to a window by its own random number, low numbers first — so as the morph runs
       (its stagger is by that same number) the windows build one after another, each drawing its
       frame before its glass fills. */
    const arr = new Float32Array(COUNT * 3);
    const v = new THREE.Vector3();
    const R = field.randoms;
    let seed = 9;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < COUNT; i++) {
      const r = R[i];
      const pi = Math.min(3, Math.floor(r * 4));
      const pnl = statPanels[pi];
      const within = r * 4 - pi; // 0..1: how early in this window's build
      let x, y, z = 0;
      if (within < 0.42) {
        // the frame, front and back, traced round in order
        const t = (within / 0.42) * 2 * (pnl.w + pnl.h);
        [x, y] = t < pnl.w ? [t - pnl.w / 2, -pnl.h / 2] : t < pnl.w + pnl.h ? [pnl.w / 2, t - pnl.w - pnl.h / 2]
          : t < 2 * pnl.w + pnl.h ? [pnl.w / 2 - (t - pnl.w - pnl.h), pnl.h / 2] : [-pnl.w / 2, pnl.h / 2 - (t - 2 * pnl.w - pnl.h)];
        z = rnd() < 0.62 ? 0 : -0.16;
      } else if (within < 0.5) {
        // the depth between front and back at the four corners
        x = (rnd() < 0.5 ? -1 : 1) * pnl.w / 2;
        y = (rnd() < 0.5 ? -1 : 1) * pnl.h / 2;
        z = -rnd() * 0.16;
      } else if (within < 0.58) {
        // corner brackets, standing proud
        const cx = rnd() < 0.5 ? -1 : 1, cy = rnd() < 0.5 ? -1 : 1, along = rnd() * 0.32, hor = rnd() < 0.5;
        x = cx * (pnl.w / 2 + 0.09 - (hor ? along : 0));
        y = cy * (pnl.h / 2 + 0.09 - (hor ? 0 : along));
        z = 0.05;
      } else {
        // the glass, scanlines filling from the bottom
        x = (rnd() - 0.5) * pnl.w * 0.96;
        y = -pnl.h * 0.48 + ((within - 0.58) / 0.42) * pnl.h * 0.96;
        y = Math.round(y / 0.07) * 0.07;
      }
      v.set(x, y, z).applyMatrix4(pnl.m);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    const attr = new THREE.BufferAttribute(arr, 3) as THREE.BufferAttribute & { edge?: THREE.BufferAttribute };
    // the same particles carry his rim light while they are still leaving him
    attr.edge = field.shape('mascot:full').edge;
    field.register('stats', attr);
  }
  buildStatWindows();
  addEventListener('resize', () => { if (key !== 'stats') buildStatWindows(); });
  const corner = new THREE.Vector3();
  let wasCase = false;
  let sky = 0;
  let boardMeasure = 0;
  let cityDim = 1;
  let stationT = 0;
  let night = signals.night;
  const clock = new THREE.Timer();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.getElapsed();
    const now = performance.now();
    const s = signals.scroll;
    const view = signals.caseShape;
    const preview = signals.preview;
    const section = s.section;
    const ip = s.intro;

    /* ---- what the field should be ---- */
    let want = key;
    let colors: [string, string] = MASCOT_COLORS;
    if (view) {
      want = view.shape;
      colors = view.colors;
    } else if (preview) {
      want = preview.shape;
      colors = preview.colors;
    } else if (section === 'intro') {
      // whole in the city → comes apart into the four windows of the count → back into him for the profile
      // whole in the city → four windows of the count → the bullet train at its start station
      want = ip >= 0.785 ? (ride.s > 0.001 ? 'train' : 'train:station') : ip >= 0.44 ? 'stats' : 'mascot:full';
    } else if (section === 'solutions') {
      // he stands whole in the city for a moment, then becomes his train
      want = 'train';
    } else if (section === 'projects') {
      want = key; // hidden: its particles are out being the cards
    } else {
      want = 'mascot:full'; // back where he began, head to toe on his plinth
    }
    // coming apart into the windows is scrubbed by the scroll, as the camera flies in
    const gather = section === 'intro' && !view && !preview
      && ((key === 'mascot:full' && want === 'stats') || (key === 'stats' && want === 'train:station'));
    // the train leaving its station and setting off are the same particles: swap the frame, not the shape
    const handTrain = (key === 'train:station' && want === 'train') || (key === 'train' && want === 'train:station');
    if (want !== key && handTrain) {
      field.place(field.shape(want));
      key = want;
      scrubbing = false;
      if (want === 'train:station') { points.position.set(0, 0, 0); points.quaternion.identity(); }
      else { const p0 = line.poseAt(ride.s); points.position.copy(p0.pos); points.quaternion.copy(p0.quat); }
    }
    if (want !== key) {
      scrubFrom = key;
      const bothMascot = want.startsWith('mascot:') && key.startsWith('mascot:');
      field.morphTo(field.shape(want), gather ? null : bothMascot ? 900 : 1700, gather ? (want === 'stats' ? 2.2 : 1.4) : bothMascot ? 0.1 : 1);
      scrubbing = gather;
      key = want;
    }
    if (scrubbing && key === 'stats' && section === 'intro') u.uProgress.value = smooth(0.44, 0.58, ip);
    else if (scrubbing && key === 'train:station' && section === 'intro') u.uProgress.value = smooth(0.79, 0.94, ip);
    else if (scrubbing) {
      scrubbing = false;
      u.uProgress.value = 1;
    }
    field.colorA.set(colors[0]);
    field.colorB.set(colors[1]);
    const isMascot = key.startsWith('mascot:');

    /* ---- the landing: a beam runs down him and leaves him lit ---- */
    const onIntro = section === 'intro' && !view && !preview;
    const reveal = onIntro ? smooth(0.22, 0.4, ip) : 1;
    u.uBeamOn.value = onIntro && ip < 0.44 ? 1 : 0;
    // from below his feet up past his crown: he is built foot to head
    const feetY = mascot ? mascot.feet : -6;
    u.uBeam.value = feetY - 0.4 + reveal * (BUST_HEIGHT / 2 - feetY + 1.0);
    u.uBodyReveal.value = onIntro ? reveal : 1;
    u.uEyeReveal.value = onIntro ? reveal : 1;
    const fromWhole = scrubbing && scrubFrom === 'mascot:full';
    const whole = key === 'mascot:full' || fromWhole ? 1 - (fromWhole ? u.uProgress.value : 0) : 0;
    u.uFill.value = whole * 0.85;
    u.uKindle.value = (0.94 + 0.06 * Math.sin(now * 0.0042) + 0.02 * Math.sin(now * 0.017)) * (1 + whole * 1.6);

    /* ---- where it stands ---- */
    const menuOpen = signals.menuOpen;
    let tx = 0, ty = 0, sc = 1, rot: number | null = 0;
    if (view) {
      tx = isMobile ? 0 : CASE_SHIFT;
      sc = 0.78;
      rot = null;
    } else if (preview) {
      tx = isMobile ? 0 : MENU_SHIFT;
      ty = isMobile ? 1.9 : 0;
      sc = isMobile ? 0.5 : 0.8;
      rot = null;
    } else if (onIntro) {
      const turned = signals.introBeat === 'profile';
      tx = turned && key !== 'train:station' ? profileShift() : 0;
      ty = key === 'stats' || key === 'train:station' ? 0 : BUST_DROP;
      sc = 1;
      rot = turned && key !== 'train:station' ? -Math.PI / 2 : 0;
    } else if (key === 'train') {
      rot = null;
    } else if (section === 'solutions' || section === 'projects') {
      tx = 0;
      ty = BUST_DROP;
      sc = 1;
      rot = 0;
    } else {
      tx = 0;
      ty = BUST_DROP;
      sc = 1;
      rot = 0;
    }
    const riding = key === 'train' && !view && !preview;
    /* The train drives itself: the scroll only says which stop it is heading for, and it gets there
       on a spring with a speed limit — a gentle pull away, a steady run, a slow arrival — so however
       the scroll jumps, the ride stays slow and smooth. */
    {
      if (section !== 'intro' && section !== 'solutions') signals.rideTarget = null;
      const target = signals.rideTarget ?? (section === 'intro' ? 0 : s.trainS);
      const K = 0.55, C = 1.5, VMAX = 0.40; // stops per second at most: a slow, stately ride
      ride.v += ((target - ride.s) * K - ride.v * C) * dt;
      ride.v = Math.max(-VMAX, Math.min(VMAX, ride.v));
      ride.s += ride.v * dt;
      if (Math.abs(target - ride.s) < 0.0005 && Math.abs(ride.v) < 0.002) { ride.s = target; ride.v = 0; }
      signals.rideS = ride.s;
    }
    const pose = line.poseAt(ride.s);
    /* The camera frames each stop the same way: while the train stands at a station it holds on
       that station's own framing, rather than drifting with the train through it. */
    const nearStop = Math.round(ride.s);
    const dock = nearStop >= 1 ? 1 - smooth(0.03, 0.14, Math.abs(ride.s - nearStop)) : 0; // only as it pulls in
    const camPose = line.poseAt(ride.s + (nearStop - ride.s) * dock);
    if (riding) {
      // on the line: eased onto it while the morph lands, then held to it exactly
      const k = u.uProgress.value >= 1 ? 1 : 1 - Math.exp(-5 * dt);
      points.position.lerp(pose.pos, k);
      points.quaternion.slerp(pose.quat, k);
      points.scale.setScalar(damp(points.scale.x, 1, 5, dt));
    } else {
    points.rotation.x = damp(points.rotation.x, 0, 4, dt);
    points.rotation.z = damp(points.rotation.z, 0, 4, dt);
    points.position.x = damp(points.position.x, tx, onIntro ? 2.2 : 3, dt);
    points.position.z = damp(points.position.z, 0, 3, dt); // the train left him wherever it stopped
    if (!riding && rot !== null) { const q = tmpQ.setFromEuler(tmpE.set(0, rot, 0)); points.quaternion.slerp(q, 1 - Math.exp(-3 * dt)); }
    if (key === 'stats' && onIntro) {
      points.rotation.x = damp(points.rotation.x, -signals.pointer.y * 0.1, 3, dt);
      points.rotation.y = damp(points.rotation.y, signals.pointer.x * 0.16, 3, dt);
    }
    points.position.y = onIntro ? ty : damp(points.position.y, ty, 4, dt);
    points.scale.setScalar(onIntro ? sc : damp(points.scale.x, sc, 4, dt));
    if (rot !== null && !(key === 'stats' && onIntro)) points.rotation.y = damp(points.rotation.y, rot, 2.4, dt);
    else if (view?.spin) points.rotation.y += dt * 0.35;
    else {
      // sway around the model's front, the shortest way back after a spin
      const target = Math.sin(time * 0.3) * 0.45;
      const diff = Math.atan2(Math.sin(target - points.rotation.y), Math.cos(target - points.rotation.y));
      points.rotation.y += diff * (1 - Math.exp(-1.5 * dt));
    }
    }
    for (const g of field.ghosts) {
      g.position.copy(points.position);
      g.rotation.copy(points.rotation);
      g.scale.copy(points.scale);
      g.quaternion.copy(points.quaternion);
    }

    /* ---- light: the aurora belongs to him, not to the models ---- */
    const lit = isMascot ? Math.min(u.uProgress.value, 1) : 0;
    const headOn = key === 'mascot:full' || scrubbing ? 0 : lit;
    u.uHeadOn.value = damp(u.uHeadOn.value, headOn, 4, dt);
    // coming apart into the windows, his light fades with the scroll rather than switching off
    if (fromWhole) u.uAurora.value = 1 - smooth(0.35, 1, u.uProgress.value);
    else u.uAurora.value = damp(u.uAurora.value, isMascot ? 1 : 0, 4, dt);

    // he looks at the count as it arrives, and at you the rest of the time — on a spring
    const p = signals.pointer;
    const glance = onIntro ? (signals.introBeat === 'profile' ? [0, 0] : signals.glance) : null;
    const yawTo = glance ? glance[0] : p.x * 0.55;
    const pitchTo = glance ? glance[1] : -p.y * 0.3;
    const turn = glance ? HEAD_TURN : HEAD_TRACK;
    const settle = 1 - Math.exp(-turn * 4 * dt);
    head.yawV += ((yawTo - head.yaw) * turn - head.yawV) * settle;
    head.pitchV += ((pitchTo - head.pitch) * turn - head.pitchV) * settle;
    head.yaw += head.yawV * dt;
    head.pitch += head.pitchV * dt;
    u.uHeadYaw.value = head.yaw;
    u.uHeadPitch.value = head.pitch;

    if (now < burst.end) {
      const e = now - burst.start;
      // it stutters: the tear is re-rolled every few frames for as long as the burst lasts
      if (now - lastReseed > 55) {
        u.uGlitchSeed.value = Math.random() * 100;
        lastReseed = now;
      }
      const stepped = Math.floor(e / 52) % 3 === 1 ? 0.74 : 1;
      u.uGlitch.value = burst.strength * stepped * Math.min(e / 60, 1, (burst.end - now) / 90);
    } else u.uGlitch.value = damp(u.uGlitch.value, 0, 12, dt);

    // the cursor parts the models, never him
    ndc.set(p.x, p.y);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, mouseWorld)) u.uMouse.value.lerp(mouseWorld, 1 - Math.exp(-8 * dt));
    u.uMouseStrength.value = damp(u.uMouseStrength.value, p.active && !isMascot && !view && !key.startsWith('train') && key !== 'stats' ? 1 : 0, 3, dt);

    /* ---- the spiral ---- */
    if (wasCase && !view) {
      index.release();
      signals.presenting = -1;
    }
    wasCase = !!view;
    const open = !view && s.projectsIn > 0.5;
    indexLayer.parentElement?.classList.toggle('open', open && s.contact < 0.4);
    if (!view && signals.presenting < 0) index.drive(s.projectIndex);
    index.setExit(Math.max(smooth(0, 0.45, s.contact), menuOpen ? 1 : 0));
    index.update(dt, open || (s.contact > 0 && s.contact < 1), time);

    /* ---- the field's own visibility ---- */
    const landing = onIntro && ip < 0.015;
    const fieldTarget = landing ? 0 : view ? (isMobile ? 0.3 : 0.9) : 1;
    fieldOpacity = damp(fieldOpacity, fieldTarget, 4, dt);
    const trainOn = key.startsWith('train') && !view && !preview && (section === 'intro' || section === 'solutions') && !!trainModel;
    const landed = trainOn && u.uProgress.value >= 0.999;
    solidK = landed ? Math.min(1, solidK + dt / 1.1) : trainOn ? 0 : Math.max(0, solidK - dt / 0.4);
    trainSolid.visible = solidK > 0.001;
    if (trainSolid.visible) {
      trainSolid.matrix.copy(points.matrixWorld);
      if (key === 'train:station') trainSolid.matrix.multiply(pose0M);
      trainSolid.matrixWorldNeedsUpdate = true;
      trainSolid.updateMatrixWorld(true);
      // wheels to roof, in the train's own height, measured in the world
      const baseY = new THREE.Vector3().setFromMatrixPosition(trainSolid.matrix).y;
      trainClip.constant = solidK >= 1 ? 1e4 : baseY - 0.05 + solidK * 1.8;
    }
    u.uOpacity.value = fieldOpacity * mascotVisible * (1 - 0.92 * Math.max(0, (solidK - 0.3) / 0.7));
    field.update(now, time, dt);

    bloom.strength = onIntro && ip < 0.2 ? 0.45 * smooth(0.015, 0.12, ip) : damp(bloom.strength, 0.45, 3, dt);
    const upright = onIntro || section === 'contact' || section === 'projects' || section === 'solutions';
    field.group.rotation.x = damp(field.group.rotation.x, upright ? 0 : -p.y * 0.2, 2, dt);
    field.group.rotation.z = damp(field.group.rotation.z, upright ? 0 : -p.x * 0.08, 2, dt);
    if (onIntro && ip > 0.76 && ride.s <= 0.001) {
      // out of the count: back over the city, then down onto the plaza where the station is going up
      const k = smooth(0.76, 0.9, ip);
      const up = Math.sin(k * Math.PI) * 6;
      camPos.set(0, 0, CAMERA_Z).lerp(stationCamPos, k);
      camPos.y += up;
      camPos.z += Math.sin(k * Math.PI) * 10;
      camLook.set(0, 0, 0).lerp(stationCamLook, k);
      camera.position.copy(camPos);
      camera.position.x += p.x * 0.3 * k;
      camera.position.y += p.y * 0.2 * k;
      camera.lookAt(camLook);
    } else if (onIntro && ip < CAM_KEYS[CAM_KEYS.length - 1]) {
      // the landing's move owns the camera; the cursor leans it only once the board has let go
      camPath(ip, camPos, camLook);
      const lean = smooth(0.015, 0.1, ip);
      camera.position.copy(camPos);
      camera.position.x += p.x * 0.35 * lean;
      camera.position.y += p.y * 0.2 * lean;
      camera.lookAt(camLook);
    } else if (section === 'contact' && !view && !preview) {
      // back to the view the city was first seen from
      const k = smooth(0, 0.8, s.contact);
      camPos.set(0, 0, CAMERA_Z).lerp(aerialPos, k);
      camLook.set(0, 0, 0).lerp(aerialLook, k);
      camera.position.copy(camPos);
      camera.position.x += p.x * 0.6;
      camera.position.y += p.y * 0.4;
      camera.lookAt(camLook);
    } else if ((section === 'solutions' || (onIntro && ride.s > 0.001)) && !view && !preview) {
      const sp = s.solutions;
      const a = 0, b = smooth(0.0, 0.35, ride.s); // leaves the station view as the train does
      void sp;
      camPos.copy(stationCamPos).lerp(aerialPos, a);
      camLook.copy(stationCamLook).lerp(aerialLook, a);
      // alongside the train, on the outside of the loop, a little behind and above it
      const flat = tmpDir.set(camPose.dir.x, 0, camPose.dir.z).normalize();
      /* Beside the train: on the avenue that is its left (the side the station camera was on); out on
         the loop it is the outside of the curve. Blended between the two by how far out it is. */
      const r = Math.hypot(camPose.pos.x, camPose.pos.z);
      const beside = tmpOut.set(-flat.z, 0, flat.x);
      if (beside.x > 0) beside.negate();
      const radial = tmpB.set(camPose.pos.x, 0, camPose.pos.z).normalize();
      const out = beside.lerp(radial, smooth(33, 36, r)).normalize(); // only once it is on the loop itself
      // docked, it stands further back and wider, so the whole billboard is in frame beside the train
      const chase = tmpA.copy(camPose.pos).addScaledVector(out, 9 + 3 * dock).addScaledVector(flat, -5 - 5 * dock).add(tmpUp.set(0, 6 + 0.5 * dock + 5 * (1 - dock) * smooth(0.05, 0.3, ride.s), 0)); // over the rooftops while it runs
      // between the train and its billboard (which stands on the far side of the track), a little ahead
      const target = tmpB.copy(camPose.pos).addScaledVector(flat, 5 - 3 * dock).addScaledVector(out, -2.5 - 1.5 * dock).add(tmpUp.set(0, 2.2 + 0.4 * dock - 2.4 * (1 - dock) * smooth(0.05, 0.3, ride.s), 0)); // raised, it looks down to keep the train in frame
      // the copy is on the left: lean the view so the train sits right of centre
      const left = tmpUp.copy(target).sub(chase).normalize().cross(new THREE.Vector3(0, -1, 0)).normalize();
      target.addScaledVector(left, innerWidth > 900 ? -3 : 0); // the copy is on the right: train and board sit left
      camPos.lerp(chase, b);
      camLook.lerp(target, Math.max(b, smooth(0, 0.12, ride.s))); // turn to the train as soon as it moves
      camera.position.copy(camPos);
      camera.position.x += p.x * 0.3;
      camera.position.y += p.y * 0.2;
      camera.lookAt(camLook);
    } else {
      camera.position.x = damp(camera.position.x, p.x * 0.35, 2, dt);
      camera.position.y = damp(camera.position.y, p.y * 0.2, 2, dt);
      camera.position.z = damp(camera.position.z, CAMERA_Z - 1.1 * smooth(0.2, 1, s.contact) * (view ? 0 : 1), 1.6, dt);
      camera.lookAt(0, 0, 0);
    }

    // from across the city his light is spread over far fewer pixels; swell the points so he still reads
    const far = camera.position.distanceTo(points.getWorldPosition(tmpV)) / CAMERA_Z;
    u.uSolid.value = damp(u.uSolid.value, key.startsWith('train') ? 1 : 0, 3, dt);
    u.uSize.value = 22 * Math.min(3.2, Math.max(1, Math.sqrt(far))) * (key.startsWith('train') ? 1.1 : 1);

    // the city is the world he stands in: whole on the landing, a dim backdrop behind everything else
    // whole while it is the subject; stepping back once he is (the count, the profile, the rest)
    cityDim = damp(cityDim, (onIntro && (ip < 0.5 || ip > 0.76)) || (section === 'solutions' && !preview) || section === 'contact' ? 1 : view ? 0.15 : 0.35, 2, dt);
    night = damp(night, signals.night, 1.5, dt); // the switch between blue hour and night is a slow fade, not a cut
    city.update(time, onIntro ? smooth(0.1, 0.4, ip) : 1, cityDim, camera.position, night);
    skyLight.intensity = 0.55 - 0.3 * night;
    dusk.intensity = 0.75 - 0.6 * night;
    billboard.material.opacity = Math.min(1, cityDim * 1.5);
    const stationTarget = section === 'intro' ? smooth(0.77, 0.92, ip) : section === 'solutions' ? 1 : 0;
    stationT = section === 'intro' ? stationTarget : damp(stationT, stationTarget, 3, dt);
    const at0 = line.stops[0] + 0.012;
    // laid a metre and a half ahead of the train's nose from the moment it leaves the station
    const ahead = pose.u + (TRAIN_HALF + 1.5) / line.length;
    const lineReveal = ride.s > 0.001 ? Math.max(at0, ahead)
      : section === 'intro' ? at0 * smooth(0.79, 0.9, ip) : section === 'solutions' ? Math.max(at0, ahead) : 1.02;
    line.update(time, lineReveal, cityDim, ride.s, stationT);
    city.setPlinth(stationT < 0.05); // the station takes the plinth's place
    // the board stays live (its snow and its Z) for as long as it can be seen
    if (billboard.material.opacity > 0.05) billboard.draw(time);
    if (landing && (boardMeasure++ % 30 === 0)) billboard.measure();

    sky = damp(sky, onIntro ? smooth(0.1, 0.3, ip) : 1, 3, dt);
    atmosphere.setFade(sky);
    atmosphere.setDrift(0);
    atmosphere.update(time);

    /* ---- the window field: the front card made of his particles, or back into the field ---- */
    field.group.updateMatrixWorld(true);
    const wantCard = open && s.contact < 0.02 && !menuOpen && !preview && index.presented() < 0.01;
    const back = !view && !wantCard && windowField.target();
    windowField.go(wantCard ? { kind: 'card', n: index.front() } : back ? { kind: 'mascot' } : null, {
      index,
      field: source,
    });
    mascotVisible = windowField.update(dt, time, { index, field: source, camera, height: innerHeight * pixelRatio });

    // the windows hang in front of the city, never behind a tower
    const onTop = key === 'stats';
    for (const pts of [points, ...field.ghosts]) {
      const m = pts.material as THREE.ShaderMaterial;
      if (m.depthTest === onTop) { m.depthTest = !onTop; m.needsUpdate = true; }
    }
    points.renderOrder = onTop ? 50 : 0;
    if (key === 'stats') {
      statPanels.forEach((pnl, i) => {
        const out = signals.statWindows[i];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.set((cx * pnl.w) / 2, (cy * pnl.h) / 2, 0).applyMatrix4(pnl.m).applyMatrix4(points.matrixWorld).project(camera);
          const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        out.x = x0; out.y = y0; out.w = x1 - x0; out.h = y1 - y0;
        out.yaw = pnl.yaw + points.rotation.y;
        out.pitch = pnl.pitch + points.rotation.x;
      });
    }
    // the billboard the train stands at, on screen, so it can be clicked
    {
      const out = signals.billboardHit;
      const k = Math.round(ride.s) - 1;
      const docked = section === 'solutions' && !view && !preview && k >= 0 && Math.abs(ride.s - (k + 1)) < 0.15 && line.screens[k];
      out.on = !!docked;
      out.index = k;
      if (docked) {
        const scr = line.screens[k];
        scr.updateMatrixWorld();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const g = (scr.geometry as THREE.PlaneGeometry).parameters;
        for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.set((cx * g.width) / 2, (cy * g.height) / 2, 0).applyMatrix4(scr.matrixWorld).project(camera);
          const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        Object.assign(out, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    {
      const on = section === 'contact' && !view && s.contact > 0.6;
      socialSigns.forEach((sign, i) => {
        sign.visible = on || s.contact > 0.3;
        const out = signals.socials[i];
        out.on = on;
        if (!on) return;
        const g2 = (sign.geometry as THREE.PlaneGeometry).parameters;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.set((cx * g2.width) / 2, (cy * g2.height) / 2, 0).applyMatrix4(sign.matrixWorld).project(camera);
          const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        Object.assign(out, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      });
    }
    composer.render();
  }
  frame();

  const api = { triggerGlitch, field, index, windowField, camera, scene, signals };
  (window as unknown as { engine: typeof api }).engine = api;

  return {
    ...api,
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(glitchTimer);
      clearTimeout(presentTimer);
      removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
