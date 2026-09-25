import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERA_Z, COUNT, isMobile, reducedMotion } from './config';
import { ParticleField } from './field';
import { BUST_DROP, BUST_HEIGHT, loadMascot } from './mascot';
import { createIndex } from './spiral';
import { createWindowField } from './windowField';
import { createAtmosphere } from './atmosphere';
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
const KINDLE_ZOOM = 1.28; // how far in the view sits while he is only a curtain of light
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
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = CAMERA_Z;

  const field = new ParticleField(pixelRatio);
  const u = field.uniforms;
  u.uBustHalf.value = BUST_HEIGHT / 2;
  scene.add(field.group);
  const points = field.points;

  const atmosphere = createAtmosphere({ scene, camera, colorA: u.uColorA.value, colorB: u.uColorB.value });

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
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.22, 0.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    atmosphere.resize();
  };
  addEventListener('resize', resize);

  /* ---------- the mascot ---------- */
  const mascot = await loadMascot();
  if (mascot) {
    field.register('mascot:neutral', mascot.neutral);
    field.register('mascot:flex', mascot.flex);
    (field.geometry.attributes.aHead as THREE.BufferAttribute).array.set(mascot.head);
    field.geometry.attributes.aHead.needsUpdate = true;
    u.uHeadPivot.value.copy(mascot.pivot);
  } else {
    // without the files he is the wordmark, so the site still reads
    field.register('mascot:neutral', field.shape('wordmark'));
    field.register('mascot:flex', field.shape('wordmark'));
  }
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
  let wasCase = false;
  let sky = 0;
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
      want = ip >= 0.3 ? 'mascot:flex' : 'mascot:neutral';
    } else if (section === 'solutions') {
      const sol = SOLUTIONS[s.solutionIndex];
      want = sol.shape;
      colors = sol.colors;
    } else if (section === 'projects') {
      want = key; // hidden: its particles are out being the cards
      const sol = SOLUTIONS.find((x) => x.shape === key);
      colors = sol ? sol.colors : MASCOT_COLORS;
    } else {
      want = 'mascot:neutral'; // he sees you out
    }
    if (want !== key) {
      const bothMascot = want.startsWith('mascot:') && key.startsWith('mascot:');
      field.morphTo(field.shape(want), bothMascot ? 900 : 1700, bothMascot ? 0.1 : 1);
      key = want;
    }
    field.colorA.set(colors[0]);
    field.colorB.set(colors[1]);
    const isMascot = key.startsWith('mascot:');

    /* ---- the landing: a beam runs down him and leaves him lit ---- */
    const onIntro = section === 'intro' && !view && !preview;
    const reveal = onIntro ? smooth(0.02, 0.24, ip) : 1;
    u.uBeamOn.value = onIntro ? 1 : 0;
    u.uBeam.value = BUST_HEIGHT / 2 + 0.25 - reveal * (BUST_HEIGHT + 0.6);
    u.uBodyReveal.value = onIntro ? reveal : 1;
    u.uEyeReveal.value = onIntro ? reveal : 1;
    u.uKindle.value = 0.94 + 0.06 * Math.sin(now * 0.0042) + 0.02 * Math.sin(now * 0.017);

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
      const zoom = 1 + (KINDLE_ZOOM - 1) * (1 - reveal);
      const side = signals.introBeat === 'profile';
      tx = side ? profileShift() : 0;
      ty = BUST_DROP * zoom;
      sc = zoom;
      rot = side ? -Math.PI / 2 : 0;
    } else if (section === 'solutions' || section === 'projects') {
      tx = isMobile ? 0 : 2.3;
      ty = isMobile ? 1.3 : 0;
      sc = isMobile ? 0.55 : 0.85;
      rot = null;
    } else {
      tx = isMobile ? 0 : -CONTACT_SHIFT;
      ty = isMobile ? 1.35 : BUST_DROP;
      sc = isMobile ? 0.5 : 0.92;
      rot = isMobile ? 0 : CONTACT_YAW;
    }
    points.position.x = damp(points.position.x, tx, onIntro ? 2.2 : 3, dt);
    points.position.y = damp(points.position.y, ty, 4, dt);
    points.scale.setScalar(damp(points.scale.x, sc, onIntro ? 8 : 4, dt));
    if (rot !== null) points.rotation.y = damp(points.rotation.y, rot, 2.4, dt);
    else if (view?.spin) points.rotation.y += dt * 0.35;
    else {
      // sway around the model's front, the shortest way back after a spin
      const target = Math.sin(time * 0.3) * 0.45;
      const diff = Math.atan2(Math.sin(target - points.rotation.y), Math.cos(target - points.rotation.y));
      points.rotation.y += diff * (1 - Math.exp(-1.5 * dt));
    }
    for (const g of field.ghosts) {
      g.position.copy(points.position);
      g.rotation.copy(points.rotation);
      g.scale.copy(points.scale);
    }

    /* ---- light: the aurora belongs to him, not to the models ---- */
    const headOn = isMascot ? Math.min(u.uProgress.value, 1) : 0;
    u.uHeadOn.value = damp(u.uHeadOn.value, headOn, 4, dt);
    u.uAurora.value = damp(u.uAurora.value, headOn, 4, dt);

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
    u.uMouseStrength.value = damp(u.uMouseStrength.value, p.active && !isMascot && !view ? 1 : 0, 3, dt);

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

    bloom.strength = damp(bloom.strength, onIntro && reveal < 0.6 && reveal > 0.01 ? 0.24 : 0.45, 3, dt);
    const upright = onIntro || section === 'contact' || section === 'projects';
    field.group.rotation.x = damp(field.group.rotation.x, upright ? 0 : -p.y * 0.2, 2, dt);
    field.group.rotation.z = damp(field.group.rotation.z, upright ? 0 : -p.x * 0.08, 2, dt);
    camera.position.x = damp(camera.position.x, p.x * 0.35, 2, dt);
    camera.position.y = damp(camera.position.y, p.y * 0.2, 2, dt);
    camera.position.z = damp(camera.position.z, CAMERA_Z - 1.1 * smooth(0.2, 1, s.contact) * (view ? 0 : 1), 1.6, dt);
    camera.lookAt(0, 0, 0);

    sky = damp(sky, landing ? 0 : 1, landing ? 6 : 0.9, dt);
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
