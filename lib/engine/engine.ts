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
const CONTACT_SHIFT = 2.15;
const CONTACT_YAW = 0.42;
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
  const [mascot, landmarks, cityModel] = await Promise.all([
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
    SOLUTIONS.map((sol) => ({ name: sol.name, shape: field.shape(sol.shape).array as Float32Array, colors: sol.colors })));
  scene.add(line.group);
  field.register('train', new THREE.BufferAttribute(trainShape(), 3));
  const aerialPos = new THREE.Vector3(0, GROUND + 22, 54);
  const aerialLook = new THREE.Vector3(0, GROUND + 12, 0);
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
  const tmpDir = new THREE.Vector3(), tmpOut = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpUp = new THREE.Vector3();

  field.place(field.shape('mascot:neutral'));
  field.colorA.set(MASCOT_COLORS[0]);
  field.colorB.set(MASCOT_COLORS[1]);
  // build the six solution models now, so scrolling onto one never stalls on it
  SOLUTIONS.forEach((s) => field.shape(s.shape));
  signals.ready = true;

  /* ---------- glitch bursts (Spider-Verse: rare, abrupt, over in a few held frames) ---------- */
  const burst = { start: 0, end: 0, strength: 0 };
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
      if (key.startsWith('mascot:') && !reducedMotion) triggerGlitch(130 + Math.random() * 90, 0.62 + Math.random() * 0.3);
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
  let wasCase = false;
  let sky = 0;
  let boardMeasure = 0;
  let cityDim = 1;
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
      want = ip >= 0.58 ? 'mascot:flex' : ip >= 0.42 ? 'mascot:neutral' : 'mascot:full';
    } else if (section === 'solutions') {
      // he stands whole in the city for a moment, then becomes his train
      want = s.solutions < 0.035 ? 'mascot:full' : 'train';
    } else if (section === 'projects') {
      want = key; // hidden: its particles are out being the cards
    } else {
      want = 'mascot:neutral'; // he sees you out
    }
    // gathering from head-to-toe into the bust is scrubbed by the scroll, as the camera flies in
    const gather = section === 'intro' && !view && !preview && key === 'mascot:full' && want === 'mascot:neutral';
    if (want !== key) {
      const bothMascot = want.startsWith('mascot:') && key.startsWith('mascot:');
      field.morphTo(field.shape(want), gather ? null : bothMascot ? 900 : 1700, gather ? 0.15 : bothMascot ? 0.1 : 1);
      scrubbing = gather;
      key = want;
    }
    if (scrubbing && key === 'mascot:neutral' && section === 'intro') u.uProgress.value = smooth(0.42, 0.55, ip);
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
    u.uBeamOn.value = onIntro ? 1 : 0;
    // from below his feet up past his crown: he is built foot to head
    const feetY = mascot ? mascot.feet : -6;
    u.uBeam.value = feetY - 0.4 + reveal * (BUST_HEIGHT / 2 - feetY + 1.0);
    u.uBodyReveal.value = onIntro ? reveal : 1;
    u.uEyeReveal.value = onIntro ? reveal : 1;
    const whole = key === 'mascot:full' || scrubbing ? 1 - (scrubbing ? u.uProgress.value : 0) : 0;
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
      tx = turned ? profileShift() : 0;
      ty = BUST_DROP;
      sc = 1;
      rot = turned ? -Math.PI / 2 : 0;
    } else if (key === 'train') {
      rot = null;
    } else if (section === 'solutions' || section === 'projects') {
      tx = 0;
      ty = BUST_DROP;
      sc = 1;
      rot = 0;
    } else {
      tx = isMobile ? 0 : -CONTACT_SHIFT;
      ty = isMobile ? 1.35 : BUST_DROP;
      sc = isMobile ? 0.5 : 0.92;
      rot = isMobile ? 0 : CONTACT_YAW;
    }
    const riding = key === 'train' && !view && !preview;
    const pose = line.poseAt(s.trainS);
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
    points.position.y = onIntro ? ty : damp(points.position.y, ty, 4, dt);
    points.scale.setScalar(onIntro ? sc : damp(points.scale.x, sc, 4, dt));
    if (rot !== null) points.rotation.y = damp(points.rotation.y, rot, 2.4, dt);
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
    u.uAurora.value = damp(u.uAurora.value, isMascot ? 1 : 0, 4, dt);

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
      const stepped = Math.floor(e / 52) % 3 === 1 ? 0.74 : 1;
      u.uGlitch.value = burst.strength * stepped * Math.min(e / 60, 1, (burst.end - now) / 90);
    } else u.uGlitch.value = damp(u.uGlitch.value, 0, 12, dt);

    // the cursor parts the models, never him
    ndc.set(p.x, p.y);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(plane, mouseWorld)) u.uMouse.value.lerp(mouseWorld, 1 - Math.exp(-8 * dt));
    u.uMouseStrength.value = damp(u.uMouseStrength.value, p.active && !isMascot && !view && key !== 'train' ? 1 : 0, 3, dt);

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
    u.uOpacity.value = fieldOpacity * mascotVisible;
    field.update(now, time, dt);

    bloom.strength = onIntro && ip < 0.2 ? 0.45 * smooth(0.015, 0.12, ip) : damp(bloom.strength, 0.45, 3, dt);
    const upright = onIntro || section === 'contact' || section === 'projects' || section === 'solutions';
    field.group.rotation.x = damp(field.group.rotation.x, upright ? 0 : -p.y * 0.2, 2, dt);
    field.group.rotation.z = damp(field.group.rotation.z, upright ? 0 : -p.x * 0.08, 2, dt);
    if (onIntro && ip < CAM_KEYS[CAM_KEYS.length - 1]) {
      // the landing's move owns the camera; the cursor leans it only once the board has let go
      camPath(ip, camPos, camLook);
      const lean = smooth(0.015, 0.1, ip);
      camera.position.copy(camPos);
      camera.position.x += p.x * 0.35 * lean;
      camera.position.y += p.y * 0.2 * lean;
      camera.lookAt(camLook);
    } else if (section === 'solutions' && !view && !preview) {
      const sp = s.solutions;
      const a = smooth(0, 0.05, sp), b = smooth(0.06, 0.17, sp);
      camPos.set(0, 0, CAMERA_Z).lerp(aerialPos, a);
      camLook.set(0, 0, 0).lerp(aerialLook, a);
      // alongside the train, on the outside of the loop, a little behind and above it
      const flat = tmpDir.set(pose.dir.x, 0, pose.dir.z).normalize();
      const out = tmpOut.set(pose.pos.x, 0, pose.pos.z);
      if (out.lengthSq() < 4) out.set(flat.z, 0, -flat.x); // still in the plaza: off to its side
      out.normalize();
      const chase = tmpA.copy(pose.pos).addScaledVector(out, 9.5).addScaledVector(flat, -7).add(tmpUp.set(0, 4.5, 0));
      const target = tmpB.copy(pose.pos).addScaledVector(flat, 3).add(tmpUp.set(0, 0.8, 0));
      // the copy is on the left: lean the view so the train sits right of centre
      const left = tmpUp.copy(target).sub(chase).normalize().cross(new THREE.Vector3(0, -1, 0)).normalize();
      target.addScaledVector(left, innerWidth > 900 ? 3.2 : 0);
      camPos.lerp(chase, b);
      camLook.lerp(target, b);
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
    u.uSize.value = 22 * Math.min(3.2, Math.max(1, Math.sqrt(far)));

    // the city is the world he stands in: whole on the landing, a dim backdrop behind everything else
    // whole while it is the subject; stepping back once he is (the count, the profile, the rest)
    cityDim = damp(cityDim, (onIntro && ip < 0.5) || (section === 'solutions' && !preview) ? 1 : view ? 0.15 : 0.35, 2, dt);
    night = damp(night, signals.night, 1.5, dt); // the switch between blue hour and night is a slow fade, not a cut
    city.update(time, onIntro ? smooth(0.1, 0.4, ip) : 1, cityDim, camera.position, night);
    billboard.material.opacity = Math.min(1, cityDim * 1.5);
    const lineReveal = section === 'intro' ? 0 : section === 'solutions' ? Math.min(1.02, smooth(0, 0.14, s.solutions) * 1.02) : 1.02;
    line.update(time, lineReveal, cityDim, s.trainS);
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

    composer.render();
  }
  frame();

  const api = { triggerGlitch, field, index, windowField, camera, scene };
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
