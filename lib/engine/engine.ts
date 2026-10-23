import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAMERA_Z, COUNT, PIXEL_RATIO, isMobile, reducedMotion } from './config';
import { ParticleField } from './field';
import { BUST_DROP, BUST_HEIGHT, loadMascot } from './mascot';
import { createIndex } from './spiral';
import { createWindowField } from './windowField';
import { createAtmosphere } from './atmosphere';
import { createCity } from './city';
import { BOARD_HEIGHT, createBillboard } from './billboard';
import { createMascotLine, particleBuilder, trainShape } from './mascotLine';
import { signals } from '@/lib/signals';
import { clients, slugOf, type Project } from '@/content/projects';
import { SOLUTIONS } from '@/content/solutions';
import { BANNERS } from '@/content/banners';
import { SOCIALS } from '@/content/socials';
import { site } from '@/content/site';
import { createAiWorld, type AiWorld } from './ai/world';
import { createTransitionPass } from './ai/transition';
import { createWorkTower } from './workTower';
import { isPhoneLayout } from '@/lib/layout';
import { workP, WORK_LEAD } from '@/lib/stops';
import { bannerFor } from '@/content/banners';

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
  onOpenProject: (slug: string, card: HTMLElement | null) => void; // card: the clicked card's hit area, on screen
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
  /* the picture's resolution: the device's own, capped (config.ts). A phone's cap is only a floor to
     start from: once the scene is built it is measured against the phone it is on (see the benchmark
     before `ready`), and a phone that can afford it draws at up to 2x */
  let pixelRatio = PIXEL_RATIO;
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
  let isolating = false, wasIsolating = false; // the work's tower standing alone, this frame and last
  const index = createIndex({
    projects: clients,
    scene,
    camera,
    isMobile,
    container: indexLayer,
    onSelect: (p: Project) => openCard(clients.indexOf(p)),
  });
  // a card opens: it faults, squares up in the middle of the screen, then its page grows out of it
  function openCard(n: number) {
    const p = clients[n];
    if (!p) return;
    index.fault(n, 340);
    triggerGlitch(320, 0.9);
    index.present(n);
    signals.presenting = n;
    clearTimeout(presentTimer);
    presentTimer = window.setTimeout(() => onOpenProject(slugOf(p), index.hit(n)), 520);
  }
  const windowField = createWindowField({ scene, count: COUNT, cardScale: index.cardScale });

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  /* the bloom is a soft glow: a phone draws it from a half-size picture (a quarter of the work) and
     nobody can tell; when frames are running late it drops to a quarter (see quality, below) */
  const bloomScale = () => (isMobile ? (lowQuality ? 0.25 : 0.5) : 1);
  const bloomSize = () => new THREE.Vector2(Math.round(innerWidth * bloomScale()), Math.round(innerHeight * bloomScale()));
  let lowQuality = false;
  const bloom = new UnrealBloomPass(bloomSize(), 0.45, 0.22, 0.26);
  composer.addPass(bloom);
  // the hand-over to the AI world: both pictures, one transition (ai/transition.ts)
  const aiPass = createTransitionPass();
  aiPass.enabled = false;
  aiPass.uniforms.uRes.value.set(innerWidth * pixelRatio, innerHeight * pixelRatio);
  composer.addPass(aiPass);
  composer.addPass(new OutputPass());
  /* Quality, on a phone: a governor. The picture is drawn at one of a few resolutions, from the one
     the benchmark (before `ready`) found the phone can hold down to 1x. Whenever frames run late it
     steps down a notch; once frames have been comfortably quick for a good while it steps back up.
     So the phone settles, in each view, at the sharpest picture it can draw at full frame rate: the
     close-ups sharp, the whole city from the air a notch softer, never a stutter in either. */
  let qualityAt = 0, slowShare = 0, fastSince = 0;
  let levels: number[] = [PIXEL_RATIO], level = 0, curPr = PIXEL_RATIO;
  /* draw at this many device pixels per CSS pixel: the renderer, the composer and the bloom resized,
     and every material that sizes its points by the ratio told, so nothing drawn as points changes
     size on screen (the field's particles, the city's lights, the stations', the sky's) */
  const setRatio = (pr: number) => {
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    composer.setSize(innerWidth, innerHeight);
    const b = bloomSize();
    bloom.setSize(b.x, b.y);
    aiPass.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr);
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        const uni = (mat as THREE.ShaderMaterial).uniforms?.uPixelRatio;
        if (uni) uni.value = pr;
      }
    });
    u.uPixelRatio.value = pr;
  };
  const setLevel = (i: number) => {
    level = Math.max(0, Math.min(levels.length - 1, i));
    curPr = levels[level];
    lowQuality = curPr <= 1; // (the bloom goes to a quarter-size picture at the floor)
    qualityAt = performance.now();
    setRatio(curPr);
  };
  let aiWorld: AiWorld | null = null;
  let aiIdle = 0; // seconds it has been out of reach
  let dark = false; // a phone, all the AI section's: the canvas cleared and left
  // is it in the camera's view at all (as of the last frame's matrices: near enough)
  const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4();
  const inView = (o: THREE.Object3D) => {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return frustum.intersectsObject(o);
  };

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    const b = bloomSize();
    bloom.setSize(b.x, b.y);
    const pr = lowQuality ? 1 : pixelRatio;
    aiPass.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr);
    aiWorld?.resize();
    atmosphere.resize();
    if (!built) return;
    billboard.measure();

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
  /* The work's building: one of the city's own (nyc-city.glb), just behind the plaza on his left,
     facing him; its windows are the work (workTower.ts). Its footprint and height as the model has them. */
  const haze = (city.group.children.find((o) => ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uSkyHorizon) as THREE.Mesh | undefined);
  const tower = createWorkTower({
    // its shaft, from the top of the podium to the setback (both of which it keeps as they are)
    box: { x0: -4.368, x1: -1.232, z0: -15.4316, z1: -12.5684, y0: GROUND + 1.6, h: 13.533 },
    banners: clients.map((c) => bannerFor(c.title)), colors: clients.map((c) => c.colors),
    haze: (haze?.material as THREE.ShaderMaterial | undefined)?.uniforms.uSkyHorizon ?? { value: new THREE.Color('#1a1630') },
    light: (haze?.material as THREE.ShaderMaterial | undefined)?.uniforms as Parameters<typeof createWorkTower>[0]['light'],
  });
  scene.add(tower.group);
  const towerA = new THREE.Vector3(), towerB = new THREE.Vector3(), towerC = new THREE.Vector3();
  // his own line, with a station for each solution
  const line = createMascotLine(pixelRatio, GROUND, PLINTH_TOP, isMobile ? 34 : 48,
    SOLUTIONS.map((sol) => ({
      name: sol.name, shape: field.shape(sol.shape).array as Float32Array, colors: sol.colors,
      film: sol.film,
      filmY: sol.filmY,
      live: sol.live,
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

  const api0: Record<string, unknown> = {};
  const CAM_FOLLOW = 2.6; // how tightly the camera follows the train (per second)
  const CAM_FOLLOW_BACK = 5; // … and riding back, when its trailing would put it on the far side (see rideBack)
  /* ---------- his heart: the DIZRUPT mark, beating in his chest ---------- */
  const heartTex = new THREE.TextureLoader().load('/heart.png');
  heartTex.colorSpace = THREE.SRGBColorSpace;
  // (drawn over whatever is in front of it: it is light on his chest, never hidden behind his own particles or a building)
  const heartMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color(0.95, 0.8, 1.15), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });
  const heart = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), heartMat);
  const heartGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color("#b46bff"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  heart.add(heartGlow);
  /* a phone draws no bloom (the haze it puts round every light in the city): the heart's own glow
     stands in for it there, a soft violet light round the mark, beating with it (drawn first, under it) */
  const haloTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(236, 214, 255, 1)');
    r.addColorStop(0.22, 'rgba(196, 140, 255, 0.55)');
    r.addColorStop(0.55, 'rgba(150, 70, 240, 0.16)');
    r.addColorStop(1, 'rgba(120, 40, 220, 0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const heartHalo = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  heartHalo.renderOrder = 39;
  heartHalo.visible = isMobile;
  heart.add(heartHalo);
  heart.renderOrder = 40;
  if (mascot) {
    // left of his chest (his left, your right), just in front of the surface
    const a3 = mascot.neutral.array as Float32Array;
    const cy = mascot.pivot.y - 1.85, cx = 1.0;
    let fz = 0;
    for (let i = 0; i < a3.length; i += 3) if (Math.abs(a3[i + 1] - cy) < 0.2 && Math.abs(a3[i] - cx) < 0.2) fz = Math.max(fz, a3[i + 2]);
    heart.position.set(cx, cy, fz + 0.05);
  }
  points.add(heart);
  (api0 as { heart?: THREE.Mesh }).heart = heart;

  /* ---------- the social banners: once he stands whole again at contact, light streams out of his
     hands and builds four banners in the air — two on his left, two on his right — each one of the
     studio's links (clickable, see SocialTowers.tsx), built bottom to top by the particles landing ---------- */
  type Banner = { mesh: THREE.Mesh; clip: THREE.Plane; pts: THREE.Points; u: Record<string, { value: unknown }>; bottom: number; h: number; side: number; ghosts: THREE.Mesh[]; base: THREE.Vector3; next: number; until: number };
  const socialBanners: Banner[] = [];
  // his hands, in his own frame: the outermost points at mid height of the full figure
  const hands = { l: new THREE.Vector3(-1.4, -0.8, 0.2), r: new THREE.Vector3(1.4, -0.8, 0.2) };
  if (mascot) {
    const a2 = mascot.full.array as Float32Array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < a2.length; i += 3) { minY = Math.min(minY, a2[i]); maxY = Math.max(maxY, a2[i]); }
    const lo = minY + (maxY - minY) * 0.38, hi = minY + (maxY - minY) * 0.62;
    let lx = Infinity, rx = -Infinity;
    for (let i = 0; i < a2.length; i += 3) {
      const y = a2[i + 1];
      if (y < lo || y > hi) continue;
      if (a2[i] < lx) { lx = a2[i]; hands.l.set(a2[i], y, a2[i + 2]); }
      if (a2[i] > rx) { rx = a2[i]; hands.r.set(a2[i], y, a2[i + 2]); }
    }
  }
  const BWd = 4.6, BHt = 4.6; // just the mark, in light
  const spots = [
    { x: -14, y: GROUND + 9, side: -1 }, { x: -8.5, y: GROUND + 14.5, side: -1 },
    { x: 8.5, y: GROUND + 14.5, side: 1 }, { x: 14, y: GROUND + 9, side: 1 },
  ];
  SOCIALS.slice(0, 4).forEach((soc, k) => {
    const sp = spots[k];
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d')!;
    // the mark alone, drawn in light: its colour lifted towards white, glowing round its edges
    const lit = new THREE.Color(soc.color).lerp(new THREE.Color(1, 1, 1), 0.35);
    const lc = `#${lit.getHexString()}`;
    x.shadowColor = lc; x.shadowBlur = 6;
    x.save(); x.translate(56, 56); x.fillStyle = lc; x.strokeStyle = lc;
    if (soc.path) { x.scale(400 / 24, 400 / 24); x.fill(new Path2D(soc.path)); }
    else if (soc.mark === 'in') {
      x.lineWidth = 30;
      x.beginPath(); x.moveTo(50, 10); x.arcTo(390, 10, 390, 390, 50); x.arcTo(390, 390, 10, 390, 50); x.arcTo(10, 390, 10, 10, 50); x.arcTo(10, 10, 390, 10, 50); x.closePath(); x.stroke();
      x.font = '800 260px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('in', 200, 214);
    } else {
      x.lineWidth = 30; x.lineJoin = 'round'; x.strokeRect(20, 70, 360, 260);
      x.beginPath(); x.moveTo(20, 70); x.lineTo(200, 215); x.lineTo(380, 70); x.stroke();
    }
    x.restore();
    const mark = x.getImageData(0, 0, 512, 512).data;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e4);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BWd, BHt), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.55, 0.55, 0.55), clippingPlanes: [clip], side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    mesh.renderOrder = 70; // never hidden behind a tower
    mesh.position.set(sp.x, sp.y, 3);
    mesh.lookAt(aerialPos.x, sp.y, aerialPos.z);
    mesh.visible = false;
    scene.add(mesh);
    mesh.updateMatrixWorld();
    // red and cyan copies of the mark, only seen while it glitches
    const ghosts = [new THREE.Color(1, 0.1, 0.3), new THREE.Color(0.1, 0.9, 1)].map((gc) => {
      const gm = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: gc.multiplyScalar(0.6), clippingPlanes: [clip], side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      gm.renderOrder = 71;
      gm.visible = false;
      mesh.add(gm);
      return gm;
    });
    // the particles: each has its spot on the banner, and flies there from his hand, bottom row first
    const n = isMobile ? 2200 : 5000;
    const tgt = new Float32Array(n * 3), rnd = new Float32Array(n), col = new Float32Array(n * 3);
    const v = new THREE.Vector3(), brand = new THREE.Color(soc.color).lerp(new THREE.Color(1, 1, 1), 0.3);
    for (let i = 0; i < n; i++) {
      let px = 0, py = 0;
      for (let tries = 0; tries < 40; tries++) {
        px = Math.random() * 512; py = Math.random() * 512;
        if (mark[(Math.floor(py) * 512 + Math.floor(px)) * 4 + 3] > 120) break;
      }
      const edge = true;
      v.set(px / 512 - 0.5, 0.5 - py / 512, 0);
      v.x *= BWd; v.y *= BHt;
      v.applyMatrix4(mesh.matrixWorld);
      tgt.set([v.x, v.y, v.z], i * 3);
      rnd[i] = Math.random();
      const cc = edge ? brand : brand;
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(tgt, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const bottom = sp.y - BHt / 2;
    const u = { uT: { value: 0 }, uTime: { value: 0 }, uHand: { value: new THREE.Vector3() }, uBottom: { value: bottom }, uH: { value: BHt }, uPixelRatio: { value: pixelRatio } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `
        uniform float uT, uTime, uBottom, uH, uPixelRatio; uniform vec3 uHand;
        attribute float aRand; attribute vec3 aCol;
        varying vec3 vCol; varying float vA;
        void main() {
          // its turn comes by how high on the banner it lands: bottom first
          float o = (position.y - uBottom) / uH * 0.75 + aRand * 0.25;
          float t = clamp((uT * 1.35 - o) / 0.35, 0.0, 1.0);
          float e = t * t * (3.0 - 2.0 * t);
          vec3 mid = (uHand + position) * 0.5 + vec3(0.0, 3.0 + aRand * 2.0, 0.0);
          float ie = 1.0 - e;
          vec3 p = ie * ie * uHand + 2.0 * ie * e * mid + e * e * position;
          p += vec3(sin(uTime * 2.0 + aRand * 30.0), cos(uTime * 1.7 + aRand * 20.0), 0.0) * 0.25 * sin(e * 3.14159);
          vA = step(0.001, t) * (1.0 - smoothstep(0.98, 1.0, uT) * 0.8);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(2.0, (2.4 + 3.0 * sin(e * 3.14159)) * 7.0 * uPixelRatio / -mv.z);
          vCol = mix(vec3(0.85, 0.65, 1.0), aCol, e); // his violet, turning the banner's colour as it lands
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5 || vA < 0.01) discard;
          float core = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vCol * 1.5, (core * core * 0.7 + exp(-d * d * 40.0) * 0.8) * vA);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    pts.renderOrder = 70;
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    socialBanners.push({ mesh, clip, pts, u, bottom, h: BHt, side: sp.side, ghosts, base: mesh.position.clone(), next: 2 + Math.random() * 3, until: 0 });
  });
  billboard.measure();
  built = true;

  /* The landing board as a real billboard: a steel back, lit violet edges, lattice columns down to
     the street, a catwalk and spotlight arms. The screen is there from the first frame (it is the
     landing); everything holding it up is built out of particles, bottom to top, with the city. */
  billboard.group.children.forEach((c) => { if ((c as THREE.Points).isPoints) c.visible = false; });
  const rig = new THREE.Group();
  {
    const BWb = BOARD_HEIGHT * (innerWidth / innerHeight), BHb = BOARD_HEIGHT;
    const steel = new THREE.MeshStandardMaterial({ color: '#2b2f37', roughness: 0.4, metalness: 0.8 });
    const edge = new THREE.MeshStandardMaterial({ color: '#b98bff', emissive: '#b98bff', emissiveIntensity: 1.4, roughness: 0.4 });
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff4dc' });
    const put = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      rig.add(mesh);
    };
    put(new THREE.BoxGeometry(BWb + 0.35, BHb + 0.35, 0.3), steel, 0, 0, -0.2);
    for (const [w, h, x, y] of [[BWb + 0.3, 0.07, 0, BHb / 2 + 0.1], [BWb + 0.3, 0.07, 0, -BHb / 2 - 0.1], [0.07, BHb + 0.3, BWb / 2 + 0.1, 0], [0.07, BHb + 0.3, -BWb / 2 - 0.1, 0]])
      put(new THREE.BoxGeometry(w, h, 0.06), edge, x, y, -0.02);
    const groundY = GROUND - boardAt.y, drop = -BHb / 2 - groundY;
    for (const cx of [-BWb * 0.3, BWb * 0.3]) {
      for (const [dx, dz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, -0.75], [0.3, -0.75]])
        put(new THREE.BoxGeometry(0.08, drop, 0.08), steel, cx + dx, groundY + drop / 2, dz);
      for (let y = groundY + 0.5; y < -BHb / 2; y += 1.0) {
        put(new THREE.BoxGeometry(0.72, 0.04, 0.04), steel, cx, y, -0.25, 0, 0.7);
        put(new THREE.BoxGeometry(0.72, 0.04, 0.04), steel, cx, y, -0.75, 0, -0.7);
      }
    }
    put(new THREE.BoxGeometry(BWb, 0.06, 0.8), steel, 0, -BHb / 2 - 0.25, 0.35);
    put(new THREE.BoxGeometry(BWb, 0.45, 0.03), steel, 0, -BHb / 2 - 0.02, 0.74);
    for (let i = 0; i < 5; i++) {
      const x = -BWb * 0.4 + (i * BWb * 0.8) / 4;
      put(new THREE.BoxGeometry(0.05, 0.05, 1.1), steel, x, BHb / 2 + 0.3, 0.35);
      put(new THREE.CylinderGeometry(0.1, 0.16, 0.26, 10), lamp, x, BHb / 2 + 0.22, 0.9, -0.7);
    }
  }
  billboard.group.add(rig);
  scene.updateMatrixWorld(true);
  const buildRig = particleBuilder(rig, scene, pixelRatio, 26);

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
  /* The scroll mapped onto the camera's path as one continuous flight, timed by distance: the camera
     covers the path at an even pace in space (a key is wherever that pace has it, not a set point in
     the scroll), so it never slows down or speeds up between the legs. Before, each leg was eased on
     its own and the build-up came in fits and starts. Easing in and out of the whole flight is the
     scroll's own (lib/stops.ts). */
  /* The first gesture's ride ends where he stands whole in the city (intro 0.42, lib/stops.ts), and
     that is the wide shot, the path's fourth key: the build-up covers the path to there at an even
     pace, and the next ride carries on from it. */
  const IP_BUILT = 0.42, KEY_BUILT = 3;
  let builtAt = { of: null as unknown, a: 0.75 }; // how far along the path, by distance, the wide shot is
  const camPath = (ip: number, pos: THREE.Vector3, look: THREE.Vector3) => {
    if (builtAt.of !== paths.pos) {
      const L = paths.pos.getLengths();
      builtAt = { of: paths.pos, a: L[Math.round((KEY_BUILT / (CAM_KEYS.length - 1)) * (L.length - 1))] / L[L.length - 1] };
    }
    const a0 = CAM_KEYS[0], a1 = CAM_KEYS[CAM_KEYS.length - 1];
    const a = ip <= IP_BUILT
      ? clamp01((ip - a0) / (IP_BUILT - a0)) * builtAt.a
      : builtAt.a + clamp01((ip - IP_BUILT) / (a1 - IP_BUILT)) * (1 - builtAt.a);
    const t = paths.pos.getUtoTmapping(a, 0);
    paths.pos.getPoint(t, pos);
    paths.look.getPoint(t, look);
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
  /* and compile every material and draw one frame now, behind the count, so the first frames of the
     landing aren't spent compiling shaders and uploading textures while the city is trying to move */
  renderer.compile(scene, camera);
  composer.render();
  /* A phone is measured, not assumed. The heaviest picture there is (the city whole, from the air,
     with him standing in it) is drawn a few frames at each resolution in turn, from 2x down, and the
     first the phone draws comfortably inside a frame's budget is the one it gets; if none, it keeps
     its floor (config.ts). The count is still running: this takes a few tenths of a second behind it.
     A phone that keeps up gets the desktop's picture; one that can't still runs smoothly. */
  if (isMobile && !reducedMotion) {
    const gl = renderer.getContext();
    camera.position.copy(aerialPos);
    camera.lookAt(aerialLook);
    city.update(0, 1, 1, camera.position, 1);
    tower.update(0, camera, 1, []);
    /* the frame is timed to the pixel: reading one back can't return until the GPU has drawn it
       (gl.finish() returns early on iOS, and would time only the handing over) */
    const px = new Uint8Array(4);
    const drawn = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const cost = (pr: number) => {
      setRatio(pr);
      composer.render();
      drawn(); // (the first frame at a size pays for its buffers: not counted)
      const N = 6, t0 = performance.now();
      for (let i = 0; i < N; i++) { composer.render(); drawn(); }
      return (performance.now() - t0) / N;
    };
    const cap = Math.min(2, devicePixelRatio);
    let chosen = pixelRatio;
    for (const pr of [2, 1.75, 1.5].filter((v) => v <= cap && v > pixelRatio + 0.01)) {
      if (cost(pr) <= 12) { chosen = pr; break; }
    }
    pixelRatio = chosen;
    // the governor's notches: from what the phone can hold, down to 1x
    levels = [2, 1.75, 1.5, 1.25, 1].filter((v) => v < chosen - 0.01);
    levels.unshift(chosen);
    if (levels[levels.length - 1] > 1) levels.push(1);
  }
  setLevel(0);
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
  const ride = { s: 0, v: 0 };
  let rideBack = 0; // 0..1, how much the train is riding back: the camera follows it tighter then (see follow)
  const contactLook = new THREE.Vector3();
  let wasContact = false;
  let formedAt = -1;
  let headSrc: Float32Array | undefined;
  let heartShow = 0; // when he stood whole at contact (the banners build from then) // and what it is scrubbing away from

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
      // a phone: the four stacked straight, square to you and parallel, so each figure reads at once
      const w = halfW * 1.6, h = Math.min(1.2, (halfH * 2 - 1.6) / 4 - 0.25);
      for (let i = 0; i < 4; i++) mk(0, (1.5 - i) * (h + 0.3) - 0.2, 0, w, h, 0, 0);
    }
    /* No windows: his particles write the numbers themselves, big, one figure in each place. Each
       number is set in type on a small canvas and the particles land on its lit pixels; particle i
       goes to a number by its own random number, so as the morph runs the four arrive together. */
    const glyphs = site.stats.map((st) => {
      const W = 512, H = 176;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.font = '600 150px "JetBrains Mono", ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${st.to}${st.suffix}`, W / 2, H / 2 + 6);
      const data = g.getImageData(0, 0, W, H).data;
      const px: number[] = [];
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (data[(y * W + x) * 4 + 3] > 128) px.push(x / W - 0.5, 0.5 - y / H);
      return px;
    });
    const arr = new Float32Array(COUNT * 3);
    const v = new THREE.Vector3();
    const R = field.randoms;
    let seed = 9;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    /* each figure gets particles in proportion to its size, so all four are lit as densely: shared
       out evenly, the year (four digits) would be spread half as thin as the others and read dimmer */
    const sizes = glyphs.map((g) => g.length / 2), total = sizes.reduce((a, b) => a + b, 0);
    const cum: number[] = [];
    sizes.reduce((acc, s) => (cum.push((acc + s) / total), acc + s), 0);
    for (let i = 0; i < COUNT; i++) {
      let pi = 0;
      while (pi < 3 && R[i] > cum[pi]) pi++;
      const pnl = statPanels[pi];
      const g = glyphs[pi];
      const k = Math.floor(rnd() * (g.length / 2)) * 2;
      // the figure fills the upper part of its place; the label sits under it
      const x = g[k] * pnl.w * 0.95 + (rnd() - 0.5) * 0.012;
      const y = g[k + 1] * pnl.h * 0.6 + pnl.h * 0.1 + (rnd() - 0.5) * 0.012;
      v.set(x, y, (rnd() - 0.5) * 0.04).applyMatrix4(pnl.m);
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
  const rideCamPos = new THREE.Vector3(), rideCamLook = new THREE.Vector3();
  /* the frame the ride's camera last ran (if not the one before, it is picked up afresh: by frames, not
     time, so a slow frame (a shader compiled the first time the station is seen) doesn't snap it) */
  let rideCamFrame = -2, frameNo = 0;
  const rideFrame = { flat: 0, out: 0 }; // the ride camera's framing directions, as headings, eased riding back
  let wasBridge = false;
  let bridgeZoom = 0;
  const bridgeLook = new THREE.Vector3(), bridgeFrom = new THREE.Vector3(), bridgeFromLook = new THREE.Vector3(), heartWorld = new THREE.Vector3();
  let sky = 0;
  let boardMeasure = 0;
  let cityDim = 1;
  let stationT = 0;
  let night = signals.night;
  const clock = new THREE.Timer();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    frameNo++;
    clock.update();
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const time = clock.getElapsed();
    const now = performance.now();
    // the share of recent frames that ran late (over 24ms): what the quality decision reads
    slowShare += ((rawDt > 0.024 ? 1 : 0) - slowShare) * 0.08;
    const s = signals.scroll;
    const view = signals.caseShape;
    const preview = signals.preview;
    // behind the AI world the city holds where the bridge left it: in his heart
    /* behind AI & Automation the city holds what it handed over from: the bridge's view on the way in;
       on the way out to the work (its second half) the tower's wide shot, so as the AI world hands back,
       or comes up again on the way back, the city behind it is already where the work begins */
    const section = s.section === 'ai' ? (signals.ai.p > 0.5 ? 'projects' : 'bridge') : s.section;
    const ip = s.intro;
    // a phone has no train: Solutions is a carousel of cards there, and he stays himself behind it
    const phone = isPhoneLayout();

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
      want = ip >= 0.785 ? (phone ? 'mascot:full' : ride.s > 0.001 ? 'train' : 'train:station') : ip >= 0.44 ? 'stats' : 'mascot:full';
    } else if (section === 'solutions') {
      // he stands whole in the city for a moment, then becomes his train
      want = phone ? 'mascot:full' : 'train';
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
    // the bridge: the train flows back into him as a wave across the city. He is set where he will
    // stand at once, and his particles are carried over from the train, so they travel the whole way
    if (want !== key && section === 'bridge' && key.startsWith('train') && want === 'mascot:full') {
      points.updateMatrix();
      const oldM = points.matrix.clone();
      points.position.set(0, BUST_DROP, 0);
      points.quaternion.identity();
      points.scale.setScalar(1);
      points.updateMatrix();
      field.morphTo(field.shape(want), 3400, 0.6);
      field.rebase(points.matrix.clone().invert().multiply(oldM));
      u.uWave.value = 1;
      scrubFrom = key;
      scrubbing = false;
      key = want;
    }
    if (want !== key) {
      scrubFrom = key;
      const bothMascot = want.startsWith('mascot:') && key.startsWith('mascot:');
      field.morphTo(field.shape(want), gather ? null : bothMascot ? 900 : 1700, gather ? (want === 'stats' ? 2.2 : 1.4) : bothMascot ? 0.1 : 1);
      scrubbing = gather;
      key = want;
    }
    if (scrubbing && key === 'stats' && section === 'intro') u.uProgress.value = smooth(0.44, 0.5, ip);
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
    if (section !== 'contact') wasContact = false;
    if (section !== 'bridge') { wasBridge = false; bridgeZoom = 0; }
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
      /* the profile: on a wide screen he turns side on and the line stands in the space he leaves. A
         phone has no such space (and rides on past it to the train), so he keeps facing you */
      const turned = signals.introBeat === 'profile' && !phone;
      tx = turned && key !== 'train:station' ? profileShift() : 0;
      ty = key === 'stats' || key === 'train:station' ? 0 : BUST_DROP;
      sc = 1;
      rot = key === 'train:station' ? 0 : turned ? -Math.PI / 2 : signals.pointer.x * 0.25;
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
      rot = signals.pointer.x * 0.25; // he turns a little towards you
    }
    const riding = key === 'train' && !view && !preview;
    /* The train drives itself: the scroll only says which stop it is heading for, and it gets there
       on a spring with a speed limit — a gentle pull away, a steady run, a slow arrival — so however
       the scroll jumps, the ride stays slow and smooth. */
    {
      if (section !== 'intro' && section !== 'solutions') signals.rideTarget = null;
      const keyed = signals.rideTarget !== null;
      const target = signals.rideTarget ?? s.trainS; // it follows the scroll from the moment the landing lets go
      if (keyed) {
        /* a gesture sent it to a stop: the scroll is already riding there on a fixed, eased clock,
           so the train rides with it, tightly, and pulls in as the scroll does */
        const prev = ride.s;
        ride.s = damp(ride.s, s.trainS, 7, dt);
        // (the scroll stands a hair past the stop, 0.01 of a station: near enough is there)
        if (Math.abs(target - ride.s) < 0.02) ride.s = target;
        ride.v = (ride.s - prev) / Math.max(dt, 1e-4);
      } else {
        // the scroll drives it: close behind, smoothed, never waiting at a station
        const prev = ride.s;
        ride.s = damp(ride.s, target, 3.2, dt);
        ride.v = (ride.s - prev) / Math.max(dt, 1e-4);
      }
      if (Math.abs(target - ride.s) < 0.0005 && Math.abs(ride.v) < 0.002) { ride.s = target; ride.v = 0; }
      signals.rideS = ride.s;
    }
    const pose = line.poseAt(ride.s);
    /* The camera frames each stop the same way: while the train stands at a station it holds on
       that station's own framing, rather than drifting with the train through it. */
    const nearStop = Math.round(ride.s);
    const dock = nearStop >= 1 ? 1 - smooth(0.03, 0.14, Math.abs(ride.s - nearStop)) : 0; // only as it pulls in
    /* Riding back, the camera's follow (below) trails the train the way it came, which going back is
       ahead of it: left loose, it ends up on the far side looking away. Aiming it further along the
       line to make up for that sent it far from the train on a fast ride or through a bend (the train
       off the bottom of the screen near a billboard; out of frame altogether on the way back to the
       station) and swung it back round on arrival. So riding back it follows tighter, and is aimed
       ahead by exactly what that follow trails at the train's speed (a follow of rate k trails a steady
       speed v by v / k): it frames the train as it does riding forward, and as the train slows the aim
       comes back onto it, never past the stop it is riding to. */
    rideBack = damp(rideBack, ride.v < -0.01 ? 1 : 0, 4, dt);
    const camBase = signals.rideTarget !== null ? ride.s + (nearStop - ride.s) * dock : ride.s; // scrolling: no hold at a station
    const followK = CAM_FOLLOW + (CAM_FOLLOW_BACK - CAM_FOLLOW) * rideBack;
    let camS = camBase + (ride.v < 0 ? (ride.v / followK) * rideBack : 0);
    if (signals.rideTarget !== null && ride.v < 0) camS = Math.max(camS, Math.min(camBase, signals.rideTarget));
    const camPose = line.poseAt(Math.max(0, camS));
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
    // the full figure turns its head too, with weights that leave his legs where they are
    const headArr = field.geometry.attributes.aHead as THREE.BufferAttribute;
    const wantHead = key === 'mascot:full' ? mascot?.fullHead : mascot?.head;
    if (wantHead && headSrc !== wantHead) { (headArr.array as Float32Array).set(wantHead); headArr.needsUpdate = true; headSrc = wantHead; }
    const headOn = scrubbing ? 0 : lit;
    u.uHeadOn.value = damp(u.uHeadOn.value, headOn, 4, dt);
    // coming apart into the windows, his light fades with the scroll rather than switching off
    /* drawn as light (the soft glow with the rim) on a wide screen; a phone draws him standing in the
       city as it draws everything else, as his points, crisp and violet: finer to look at, and the
       glow's blended sprites were the dearest pixels on the page. Except on the way into his heart:
       there the light is the animation (the camera comes in and he dissolves round the heart into
       it), so a phone draws him as light there too, from the bridge to the hand-over */
    const intoHeart = section === 'bridge' || s.section === 'ai';
    if (isMobile && !intoHeart) u.uAurora.value = 0;
    else if (fromWhole) u.uAurora.value = 1 - smooth(0.35, 1, u.uProgress.value);
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
    const open = false; // the work is a tower of windows now (components/home/Projects.tsx), not the spiral
    indexLayer.parentElement?.classList.toggle('open', open && s.contact < 0.4);
    if (!view && signals.presenting < 0) index.drive(s.projectIndex);
    index.setExit(Math.max(smooth(0, 0.45, s.contact), menuOpen ? 1 : 0));
    index.update(dt, open || (s.contact > 0 && s.contact < 1), time);

    /* ---- the field's own visibility ---- */
    const landing = onIntro && ip < 0.015;
    const fieldTarget = landing || (section === 'projects' && !view) ? 0 : view ? (isMobile ? 0.3 : 0.9) : 1;
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
    // what is still playing after the scroll lands: the scroll waits for it (SmoothScroll.tsx)
    signals.busy.morph = field.morphing && !view;
    signals.busy.train = signals.rideTarget !== null && Math.abs(signals.rideTarget - ride.s) > 0.02;

    bloom.strength = onIntro && ip < 0.2 ? 0.45 * smooth(0.015, 0.12, ip) : damp(bloom.strength, 0.45, 3, dt);
    const upright = onIntro || section === 'contact' || section === 'projects' || section === 'solutions';
    field.group.rotation.x = damp(field.group.rotation.x, upright ? 0 : -p.y * 0.2, 2, dt);
    field.group.rotation.z = damp(field.group.rotation.z, upright ? 0 : -p.x * 0.08, 2, dt);
    if (onIntro && ip > 0.76 && ride.s <= 0.001 && !phone) {
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
    } else if (section === 'bridge' && !view && !preview) {
      /* The bridge: from wherever the train left the camera, round to face him as he forms again,
         then in, into the heart beating in his chest. The glitch into the AI world takes it from there. */
      if (!wasBridge) {
        bridgeLook.copy(camera.position).add(camera.getWorldDirection(tmpV).multiplyScalar(12));
        bridgeFrom.copy(camera.position);
        bridgeFromLook.copy(bridgeLook);
      }
      wasBridge = true;
      const bp = s.section === 'ai' ? 1 : s.bridge;
      const k1 = smooth(0.0, 0.3, bp), k2 = smooth(0.45, 0.92, bp);
      heart.getWorldPosition(heartWorld);
      // facing him across the city, the way he was first seen whole: head to toe, over the rooftops
      // the shot he was first seen whole from: head to toe on his plinth, over the city
      tmpA.copy(bridgeFrom).lerp(tmpUp.set(p.x * 2, GROUND + 22 + p.y * 1.5, 54), k1);
      tmpB.copy(bridgeFromLook).lerp(tmpOut.set(0, GROUND + 12, 0), k1);
      // then in: over the rooftops first, coming down level with the heart only at the end, where the
      // plaza round him is clear, and square on to it
      // it stops with the heart big over the rooftops, the towers still round it: the glitch takes it from there
      const fy = tmpA.y, dz = heartWorld.z + 5.2, ty = heartWorld.y - 0.4;
      tmpA.x += (heartWorld.x - tmpA.x) * k2;
      tmpA.z += (dz - tmpA.z) * k2;
      tmpA.y = fy + (ty - fy) * smooth(0.4, 1, k2);
      tmpB.lerp(heartWorld, k2);
      bridgeZoom = k2;
      const k = 1 - Math.exp(-3.2 * dt);
      camera.position.lerp(tmpA, k);
      bridgeLook.lerp(tmpB, k);
      camera.lookAt(bridgeLook);
    } else if (section === 'contact' && !view && !preview) {
      // back to the view the city was first seen from: a slow rise from wherever the camera was
      if (!wasContact) contactLook.copy(camera.position).add(camera.getWorldDirection(tmpV).multiplyScalar(camera.position.length() || 7));
      wasContact = true;
      const k = smooth(0.3, 0.75, s.contact);
      tmpA.set(0, 0, CAMERA_Z).lerp(aerialPos, k);
      tmpB.set(0, 0, 0).lerp(aerialLook, k);
      tmpA.x += p.x * 0.6 * k;
      tmpA.y += p.y * 0.4 * k;
      camera.position.lerp(tmpA, 1 - Math.exp(-2.2 * dt));
      contactLook.lerp(tmpB, 1 - Math.exp(-2.2 * dt));
      camera.lookAt(contactLook);
    } else if ((section === 'solutions' || (onIntro && ride.s > 0.001)) && !view && !preview && !phone) {
      const sp = s.solutions;
      const a = 0, b = smooth(0.0, 0.35, ride.s); // leaves the station view as the train does
      void sp;
      camPos.copy(stationCamPos).lerp(aerialPos, a);
      camLook.copy(stationCamLook).lerp(aerialLook, a);
      // alongside the train, on the outside of the loop, a little behind and above it
      const flat = tmpDir.set(camPose.dir.x, 0, camPose.dir.z).normalize();
      /* Beside the train, always on its left: the side the station camera was on, and, the loop
         running clockwise, the outside of the curve once it is out on it. It turns with the train
         through the bend onto the loop; picking a side by which way it pointed flipped the camera
         across the train halfway round. Settled onto the loop's own outward line once there. */
      const r = Math.hypot(camPose.pos.x, camPose.pos.z);
      const beside = tmpOut.set(-flat.z, 0, flat.x);
      const radial = tmpB.set(camPose.pos.x, 0, camPose.pos.z).normalize();
      const out = beside.lerp(radial, smooth(33, 36, r)).normalize(); // only once it is on the loop itself
      /* Riding back the camera follows the train tightly (rideBack), so it would turn as fast as the line
         does where it comes off the loop: there the framing turns at its own pace instead, as it does
         going forward behind the looser follow. Going forward it is the line's own, as it always was. */
      /* (turned as headings, the short way round: eased as vectors, one swinging round to face the
         other way passes through nothing and snaps) */
      const freshRide = rideCamFrame !== frameNo - 1;
      rideCamFrame = frameNo;
      const kDir = freshRide ? 1 : 1 - Math.exp(-(30 - 27 * rideBack) * dt);
      const turn = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * kDir;
      rideFrame.flat = turn(rideFrame.flat, Math.atan2(flat.x, flat.z));
      rideFrame.out = turn(rideFrame.out, Math.atan2(out.x, out.z));
      flat.set(Math.sin(rideFrame.flat), 0, Math.cos(rideFrame.flat));
      out.set(Math.sin(rideFrame.out), 0, Math.cos(rideFrame.out));
      // docked, it stands further back and wider, so the whole billboard is in frame beside the train
      const chase = tmpA.copy(camPose.pos).addScaledVector(out, 9 + 3 * dock).addScaledVector(flat, -5 - 5 * dock).add(tmpUp.set(0, 6 + 0.5 * dock + 5 * (1 - dock) * smooth(0.05, 0.3, ride.s), 0)); // over the rooftops while it runs
      // between the train and its billboard (which stands on the far side of the track), a little ahead
      const target = tmpB.copy(camPose.pos).addScaledVector(flat, 5 - 3 * dock).addScaledVector(out, -2.5 - 1.5 * dock).add(tmpUp.set(0, 2.2 + 0.4 * dock - 2.4 * (1 - dock) * smooth(0.05, 0.3, ride.s), 0)); // raised, it looks down to keep the train in frame
      // the copy is on the left: lean the view so the train sits right of centre
      const left = tmpUp.copy(target).sub(chase).normalize().cross(new THREE.Vector3(0, -1, 0)).normalize();
      target.addScaledVector(left, innerWidth > 900 ? -3 : 0); // the copy is on the right: train and board sit left
      camPos.lerp(chase, b);
      camLook.lerp(target, Math.max(b, smooth(0, 0.12, ride.s))); // turn to the train as soon as it moves
      /* The camera follows that framing with a little weight rather than bolted to the train: through
         a bend, and as it settles into or swings out of a billboard's framing, the view eases round
         instead of whipping round with the train. Picked up where it is on the first frame. */
      if (freshRide) { rideCamPos.copy(camPos); rideCamLook.copy(camLook); }
      const follow = 1 - Math.exp(-followK * dt);
      rideCamPos.lerp(camPos, follow);
      rideCamLook.lerp(camLook, follow);
      camera.position.copy(rideCamPos);
      camera.position.x += p.x * 0.3;
      camera.position.y += p.y * 0.2;
      camera.lookAt(rideCamLook);
    } else if (section === 'projects' && !view && !preview) {
      // (see below: the city is isolated round the tower while the camera is at it)
      /* The work: from the whole tower into the first window, then out to the facade and across into
         the next, up the building. The camera always faces the facade square on, so each window stays
         a true rectangle on screen for the page to lay its project over. */
      const wp = workP(s.projects), N = tower.count;
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2, aspect = camera.aspect;
      const dWide = Math.max((tower.height + 12) / tanH, (tower.width * 1.7) / (tanH * aspect));
      const dFacade = Math.max((tower.dims.cellH * 12) / tanH, (tower.width * 0.6) / (tanH * aspect)); // pulled back: the floors round the window
      /* at a project: held back from the glass, its window about half the screen's height (most of its
         width on a phone), the facade and its lit neighbours round it, the project's name beside it */
      const dClose = Math.max(tower.dims.winH / (0.52 * tanH), tower.dims.winW / ((aspect < 1 ? 0.8 : 0.62) * tanH * aspect));
      const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
      const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
      let dist: number;
      if (wp <= 0 || wp >= N - 1) {
        // the first and the last are on the front: in from the wide shot, out to it
        const first = wp <= 0, t = clamp01(first ? (wp + WORK_LEAD) / WORK_LEAD : 1 - (wp - (N - 1)) / WORK_LEAD);
        tower.windowWorld(first ? 0 : N - 1, towerA);
        // in to the window at an even pace the whole way (equal steps in log distance read as steady),
        // lined up on it in the first part of the move
        towerC.copy(tower.centre()).lerp(towerA, easeIO(smooth(0, 0.55, t)));
        dist = logLerp(dWide, dClose, smooth(0.04, 1, t));
        camera.position.copy(towerC).addScaledVector(tower.normal, dist);
      } else {
        /* from window i to window i+1: out from the glass, across, in again. On another side of the
           building the camera goes round it: its bearing about the building's axis turns from the one
           facing the first window to the one facing the next, pulled back enough to clear the corner. */
        const i = Math.floor(wp), f = wp - i;
        tower.windowWorld(i, towerA); tower.windowWorld(i + 1, towerB);
        const nA = tower.normalOf(i), nB = tower.normalOf(i + 1);
        const turn = nA.dot(nB) < 0.99;
        const travel = easeIO(smooth(turn ? 0.12 : 0.22, turn ? 0.88 : 0.78, f));
        towerC.copy(towerA).lerp(towerB, travel);
        /* never far enough back for anything but the tower to be in shot: at most the distance where
           its narrower face still covers the frame's width; between windows far apart it pans along the
           facade instead of pulling out, and round a corner it stays tight to the building */
        const dFill = (Math.min(tower.width, tower.depth) / (tanH * aspect)) * 0.78;
        const span = Math.min(dFill, Math.max(dFacade, (towerA.distanceTo(towerB) * 1.5) / tanH));
        dist = logLerp(dClose, span, Math.sin(Math.PI * smooth(0.02, 0.98, f)));
        const camA = tmpA.copy(towerA).addScaledVector(nA, dist), camB = tmpB.copy(towerB).addScaledVector(nB, dist);
        if (!turn) camera.position.lerpVectors(camA, camB, travel);
        else {
          const ax = tower.axis();
          const bear = (v: THREE.Vector3) => Math.atan2(v.x - ax.x, v.z - ax.z);
          const ta = bear(camA);
          let tb = bear(camB);
          while (tb - ta > Math.PI) tb -= Math.PI * 2;
          while (tb - ta < -Math.PI) tb += Math.PI * 2;
          const th = ta + (tb - ta) * travel;
          const rad = Math.hypot(camA.x - ax.x, camA.z - ax.z) * (1 - travel) + Math.hypot(camB.x - ax.x, camB.z - ax.z) * travel;
          camera.position.set(ax.x + Math.sin(th) * rad, camA.y + (camB.y - camA.y) * travel, ax.z + Math.cos(th) * rad);
        }
      }
      /* close to the tower it stands alone: the rest of the city dissolves, so nothing else is ever
         in shot as the camera works round it; it comes back as the camera pulls out to a wide shot */
      const alone = wp <= 0 ? smooth(-WORK_LEAD * 0.7, -WORK_LEAD * 0.35, wp) : wp >= N - 1 ? 1 - smooth(N - 1 + WORK_LEAD * 0.35, N - 1 + WORK_LEAD * 0.7, wp) : 1;
      const ax0 = tower.axis();
      city.setIsolate(alone, ax0.x, ax0.z);
      billboard.group.visible = alone < 0.5;
      isolating = true;
      // the pointer leans the view only on the wide shots: close to the tower a lean would bring the
      // street into the edges of the frame
      const lean = wp <= 0 || wp >= N - 1 ? smooth(dClose * 1.6, dFacade, dist) * smooth(dFacade, dFacade * 2, dist) : 0;
      camera.position.x += p.x * 0.6 * lean;
      camera.position.y += p.y * 0.4 * lean;
      camera.lookAt(towerC);
    } else {
      camera.position.x = damp(camera.position.x, p.x * 0.35, 2, dt);
      camera.position.y = damp(camera.position.y, p.y * 0.2, 2, dt);
      camera.position.z = damp(camera.position.z, CAMERA_Z - 1.1 * smooth(0.2, 1, s.contact) * (view ? 0 : 1), 1.6, dt);
      camera.lookAt(0, 0, 0);
    }

    /* ---- the work's tower: its rooms seen from here, and each project window's place on screen ---- */
    camera.updateMatrixWorld();
    tower.group.visible = !(onIntro && ip < 0.6); // the city builds itself in the landing: it is one of its buildings
    tower.update(time, camera, 0.4 + 0.6 * cityDim, signals.workHidden);
    if (section === 'projects' && !view) {
      for (let k = 0; k < tower.count; k++) tower.screenRect(k, camera, signals.workWindows[k]);
      signals.onWorkFrame?.(); // the page lays the projects over them in this same frame
    }

    if (!isolating && wasIsolating) { city.setIsolate(0, 0, 0); billboard.group.visible = true; }
    wasIsolating = isolating;
    isolating = false;
    // from across the city his light is spread over far fewer pixels; swell the points so he still reads
    const far = camera.position.distanceTo(points.getWorldPosition(tmpV)) / CAMERA_Z;
    u.uSolid.value = damp(u.uSolid.value, key.startsWith('train') ? 1 : 0, 3, dt);
    // (a phone draws its points smaller, there being more of them (config.ts: COUNT); its count's figures bigger, to stand out against the city)
    u.uSize.value = 22 * (isMobile ? 0.95 : 1) * Math.min(3.2, Math.max(1, Math.sqrt(far))) * (key.startsWith('train') ? 1.1 : key === 'stats' && phone ? 1.45 : 1);
    // a phone's figure, drawn as points rather than light, is lifted well up so his violet reads against the city
    // (as points only: drawn as light, on the way into his heart, he is as bright as he ever was)
    u.uGain.value = damp(u.uGain.value, isMobile && isMascot ? 1 + 2.2 * (1 - u.uAurora.value) : 1, 4, dt);
    /* drawn as light, every point is a wide soft sprite piled on the next: a phone draws half as many
       of them then (each brighter, the same light), which is what it drew before it had finer points */
    u.uKeep.value = isMobile ? 0.75 - 0.36 * u.uAurora.value : 1;

    // the city is the world he stands in: whole on the landing, a dim backdrop behind everything else
    // whole while it is the subject; stepping back once he is (the count, the profile, the rest)
    /* (a phone, while he stands whole in the city on the landing: the city steps back to half, or his
       points, drawn without the glow a wide screen gives him, are lost among its windows) */
    const himWhole = isMobile && onIntro && ip > 0.2 && ip < 0.5;
    cityDim = damp(cityDim, himWhole ? 0.5 : section === 'bridge' ? 1 - 0.7 * smooth(0.4, 0.9, s.section === 'ai' ? 1 : s.bridge) : (onIntro && (ip < 0.5 || ip > 0.76)) || (section === 'solutions' && !preview && !phone) || section === 'projects' || section === 'contact' ? 1 : view ? 0.15 : 0.35, 2, dt);
    night = damp(night, signals.night, 1.5, dt); // the switch between blue hour and night is a slow fade, not a cut
    city.update(time, onIntro ? smooth(0.1, 0.4, ip) : 1, cityDim, camera.position, night);
    // the board's rig goes up first, as the camera pulls back from its screen
    buildRig(onIntro ? smooth(0.02, 0.2, ip) : 1, time);
    skyLight.intensity = 0.55 - 0.3 * night;
    dusk.intensity = 0.75 - 0.6 * night;
    billboard.material.opacity = Math.min(1, cityDim * 1.5);
    const stationTarget = phone ? 0 : section === 'intro' ? smooth(0.77, 0.92, ip) : section === 'solutions' ? 1 : 0;
    stationT = section === 'intro' ? stationTarget : damp(stationT, stationTarget, 3, dt);
    const at0 = line.stops[0] + 0.012;
    // laid a metre and a half ahead of the train's nose from the moment it leaves the station
    const ahead = pose.u + (TRAIN_HALF + 1.5) / line.length;
    const lineReveal = ride.s > 0.001 ? Math.max(at0, ahead)
      : section === 'intro' ? at0 * smooth(0.79, 0.9, ip) : section === 'solutions' ? Math.max(at0, ahead) : 1.02;
    line.update(time, lineReveal, cityDim, ride.s, stationT);
    if (wasIsolating || phone) line.group.visible = false; // the work's tower alone: the line and its stations go with the city (a phone never has them)
    city.setPlinth(stationT < 0.05); // the station takes the plinth's place
    // the board stays live (its snow and its Z) for as long as it can be seen
    if (billboard.material.opacity > 0.05 && (landing || inView(billboard.plane))) billboard.draw(time, !landing);
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
      const atContact = section === 'contact' && !view;
      const whole = atContact && key === 'mascot:full' && u.uProgress.value >= 0.999 && mascotVisible > 0.95 && fieldOpacity > 0.9 && s.contact > 0.55;
      if (whole && formedAt < 0) formedAt = time;
      if (!atContact) formedAt = -1;
      socialBanners.forEach((bn, i) => {
        // he stands for a moment, then the banners build one after another
        // only once he is whole again: then they build on their own clock, one after another
        const t = atContact && formedAt > 0 ? Math.min(1, Math.max(0, (time - formedAt - 0.6 - i * 0.45) / 2.4)) : 0;
        bn.u.uT.value = t;
        bn.u.uTime.value = time;
        (bn.u.uHand.value as THREE.Vector3).copy(bn.side < 0 ? hands.l : hands.r).applyMatrix4(points.matrixWorld);
        bn.pts.visible = t > 0.001 && t < 0.999;
        bn.mesh.visible = t > 0.35;
        /* It loses the signal now and then, like his Z: the mark jumps, its red and cyan pull
           apart, it stretches for a frame — in short bursts, at intervals rolled fresh each time. */
        if (time > bn.next) { bn.until = time + 0.15 + Math.random() * 0.25; bn.next = bn.until + 1.5 + Math.random() * 3; }
        const tearing = t >= 0.999 && time < bn.until && !reducedMotion;
        const jig = tearing ? (Math.random() - 0.5) * 0.5 : 0;
        bn.mesh.position.copy(bn.base);
        bn.mesh.translateX(jig);
        bn.mesh.scale.set(tearing && Math.random() < 0.3 ? 1.15 : 1, tearing && Math.random() < 0.2 ? 0.9 : 1, 1);
        bn.ghosts.forEach((gm, gi) => {
          gm.visible = tearing;
          gm.position.set((gi ? 1 : -1) * (0.12 + Math.random() * 0.35), (Math.random() - 0.5) * 0.12, 0.01);
        });
        bn.clip.constant = t >= 0.999 ? 1e4 : bn.bottom + bn.h * Math.min(1, Math.max(0, (t * 1.35 - 0.35) / 0.9));
        const out = signals.socials[i];
        out.on = t >= 0.999;
        if (!out.on) return;
        const g2 = (bn.mesh.geometry as THREE.PlaneGeometry).parameters;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.set((cx * g2.width) / 2, (cy * g2.height) / 2, 0).applyMatrix4(bn.mesh.matrixWorld).project(camera);
          const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        Object.assign(out, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      });
      for (let i = socialBanners.length; i < signals.socials.length; i++) signals.socials[i].on = false;
    }
    {
      // lub-dub: two beats close together, then a rest
      const P = 1.0, ph = time % P; // one beat a second
      const beat = Math.exp(-Math.pow((ph - 0.05) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));
      // (on the landing, it lights as the beam passes his chest, not once he is whole: seen within the ride)
      const show = key.startsWith('mascot:') && !scrubbing && u.uProgress.value > 0.9 && (u.uAurora.value > 0.5 || isMobile) && (!onIntro || reveal > 0.75) ? fieldOpacity * mascotVisible : 0;
      heartShow = damp(heartShow, show, 4, dt);
      heart.visible = heartShow > 0.01;
      heart.scale.setScalar(1 + beat * 0.22);
      // up close it would fill the screen with white: held down as the camera comes in
      const close = 1 - 0.3 * bridgeZoom;
      heartMat.opacity = heartShow * (0.55 + 0.45 * beat) * close;
      heartGlow.scale.setScalar(1.25 + beat * 0.5);
      (heartGlow.material as THREE.MeshBasicMaterial).opacity = heartShow * beat * 0.18 * close;
      if (isMobile) {
        // (a phone's stand-in for the bloom: wider and brighter as the camera comes in to it)
        heartHalo.scale.setScalar(2.4 + beat * 0.5 + bridgeZoom * 1.2);
        (heartHalo.material as THREE.MeshBasicMaterial).opacity = heartShow * (0.32 + 0.22 * beat) * (0.25 + 0.75 * bridgeZoom); // (faint while he stands in the city: it is the zoom in it belongs to)
      }
    }
    /* ---- AI & Automation: built ahead of time, drawn only while it is on screen. A phone has no AI
       world: the page draws its chip (AiNetwork.tsx), the hand-over is to the dark, and once it is
       dark nothing is drawn here at all ---- */
    {
      const ai = signals.ai;
      if (!aiWorld && !phone && (ai.warm || ai.mix > 0)) {
        aiWorld = createAiWorld(renderer, curPr);
        aiWorld.render(dt, time, 0, 0, 0); // compile it now, not on the first frame of the transition
      }
      // a touch screen can't hold both worlds for long: once the page is well past it, it is freed (and
      // built again ahead of the way back)
      aiIdle = aiWorld && isMobile && !ai.warm && ai.mix === 0 ? aiIdle + dt : 0;
      if (aiWorld && (phone || aiIdle > 1.5)) {
        aiPass.uniforms.tAi.value = null;
        aiWorld.dispose();
        aiWorld = null;
        aiIdle = 0;
      }
      const on = ai.mix > 0.0001 && (!!aiWorld || phone);
      aiPass.enabled = on;
      const full = ai.mix >= 0.9999;
      renderPass.enabled = !full;
      bloom.enabled = !full && !isMobile; // (a phone draws its lights without the bloom's haze round them)
      if (on) {
        if (aiWorld) aiPass.uniforms.tAi.value = aiWorld.render(dt, time, ai.play, signals.pointer.x, signals.pointer.y);
        aiPass.uniforms.uMix.value = ai.mix;
        aiPass.uniforms.uMode.value = ai.mode;
        aiPass.uniforms.uTime.value = time;
      } else aiWorld?.sleep();
      // once it is all the AI section's, a phone draws nothing more: one clean dark frame (the hand-over's
      // last still has its tear in it), then the canvas keeps it
      if (phone && full) {
        if (!dark) {
          renderer.setRenderTarget(null);
          renderer.setClearColor(0x040509, 1);
          renderer.clear();
          renderer.setClearColor(0x000000, 1);
          dark = true;
        }
        return;
      }
      dark = false;
    }
    /* the governor: late frames step the picture down a notch at once (well, within a second or so);
       a good stretch of comfortably quick frames steps it back up, one notch at a time */
    if (isMobile && levels.length > 1 && now - qualityAt > 1200) {
      if (slowShare > 0.35) {
        if (level < levels.length - 1) setLevel(level + 1);
        fastSince = 0;
      } else if (slowShare < 0.04) {
        if (!fastSince) fastSince = now;
        else if (now - fastSince > 6000 && level > 0) { setLevel(level - 1); fastSince = 0; }
      } else fastSince = 0;
    }
    /* the DIZRUPT screen: the canvas is under solid black until the hole the cursor opens has opened.
       A phone has no cursor, so until it is touched nothing of the picture can be seen, and drawing
       it would only be work: the frame's state is kept up, the picture is skipped */
    if (isMobile && landing && !view && !preview && signals.introHole < 0.02) return;
    composer.render();
  }
  frame();

  const api = { triggerGlitch, field, index, windowField, camera, scene, signals, renderer, bloom, get aiWorld() { return aiWorld; }, quality: () => ({ low: curPr < pixelRatio, base: pixelRatio }), ...api0 };
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
