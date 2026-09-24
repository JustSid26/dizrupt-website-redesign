import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createIndex, SPINE_GAP } from '../spiral.js';

const VARIANTS = {
  portal: {
    number: '01',
    name: 'Continuity Drift',
    note: 'DIZRUPT stays intact, recedes toward the brand position, and hands focus to the already-moving project spiral.',
    duration: 2200,
  },
  prism: {
    number: '02',
    name: 'Shared Frame',
    note: 'A quiet particle outline establishes the project frame before the destination expands into the full viewport.',
    duration: 2100,
  },
  ribbon: {
    number: '03',
    name: 'Lateral Handoff',
    note: 'The intro and project scene share one controlled leftward camera move, with no hard wipe or brightness spike.',
    duration: 2050,
  },
  depth: {
    number: '04',
    name: 'Depth Rack',
    note: 'A cinematic focus pull softens the intro while the existing particle project window resolves behind it.',
    duration: 2300,
  },
  aperture: {
    number: '05',
    name: 'Soft Iris',
    note: 'The destination opens from the visual centre with a restrained circular reveal and a continuous particle field.',
    duration: 2200,
  },
};

const variant = document.body.dataset.transition;
const config = VARIANTS[variant] || VARIANTS.portal;
document.title = `${config.number} · ${config.name} — Dizrupt transition lab`;

document.body.insertAdjacentHTML('afterbegin', `
  <canvas id="fx" aria-hidden="true"></canvas>
  <div class="aurora" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

  <header class="lab-nav">
    <a class="lab-brand" href="../index.html">DI<span>Z</span>RUPT</a>
    <a class="lab-index" href="index.html">Transition lab</a>
    <nav aria-label="Transition variants">
      ${Object.entries(VARIANTS).map(([id, item]) =>
        `<a href="${item.number}-${id}.html"${id === variant ? ' aria-current="page"' : ''}>${item.number}</a>`
      ).join('')}
    </nav>
  </header>

  <main class="experience">
    <section class="project-stage" aria-label="Project index preview">
      <canvas id="project-gl" aria-hidden="true"></canvas>
      <div id="index" class="lab-project-index open" aria-label="Live Dizrupt particle project index">
        <div class="index-cards"></div>
        <p class="index-hint">Scroll to turn the spiral · Click a project for its overview</p>
      </div>
      <div class="stage-shade" aria-hidden="true"></div>
    </section>

    <section class="intro-panel">
      <div class="intro-copy">
        <div class="word-wrap">
          <span class="word-layer ghost ghost-a">DI<span class="flip">Z</span>RUPT</span>
          <h1 class="intro-word">DI<span class="flip">Z</span>RUPT</h1>
          <span class="word-layer ghost ghost-b">DI<span class="flip">Z</span>RUPT</span>
        </div>
        <p>A solutions-led full stack digital marketing<br>agency, headquartered in Mumbai.</p>
      </div>
    </section>
  </main>

  <aside class="lab-caption">
    <span>${config.number} / 05</span>
    <strong>${config.name}</strong>
    <p>${config.note}</p>
  </aside>

  <button class="run" type="button"><span>Run transition</span><i>↗</i></button>
  <button class="replay" type="button" aria-label="Replay transition">R · Replay</button>
  <p class="gesture">Click, scroll or press space</p>
`);

const canvas = document.querySelector('#fx');
const ctx = canvas.getContext('2d');
const runButton = document.querySelector('.run');
const replayButton = document.querySelector('.replay');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = 0;
let height = 0;
let dpr = 1;
let active = false;
let completed = false;
let startedAt = 0;

const PROJECTS = [
  { title: 'SlickFix', client: 'Social & Paid Media Management · Production', tags: 'Fashion accessories · India', colors: ['#ff3d8b', '#ffc2da'] },
  { title: 'Alwrite', client: 'Branding Solutions', tags: 'B2B insurtech · India', colors: ['#3d6bff', '#b8c8ff'] },
  { title: 'Nykonos Entertainment', client: 'Digital Content Creation', tags: 'Electronic music events · New York', colors: ['#8a5bff', '#ff4fd8'] },
  { title: 'Mae Mae Industrial', client: 'Website Development', tags: 'Packaging solutions · Thailand', colors: ['#1fd6b8', '#2a6bff'] },
  { title: 'Kiaash', client: 'Social & Paid Media Management', tags: 'Fine jewellery · UK', colors: ['#ffb84d', '#fff1d6'] },
  { title: 'Furnfetch', client: 'Website Development', tags: 'Furniture sourcing · India', colors: ['#ff6a3d', '#ffd9a8'] },
  { title: 'KP Packaging', client: 'Branding Solutions · SEO', tags: 'Packaging · 30+ years · India', colors: ['#3fe08a', '#d2ffe2'] },
  { title: 'AVG Windscreens', client: 'Search Engine Optimization', tags: 'Windscreen repair · UK', colors: ['#2ad4ff', '#dff6ff'] },
  { title: 'Samir Gems', client: 'Digital Content Creation', tags: 'Diamond manufacturing · Global', colors: ['#9fd8ff', '#ffffff'] },
  { title: 'Maverick Realtors', client: 'Digital Content Creation', tags: 'Real estate · Mumbai', colors: ['#c9a36b', '#f5f1e6'] },
  { title: 'Crossline', client: 'Production Solutions', tags: 'B2B eyewear · India', colors: ['#ff5b5b', '#ffc9b8'] },
];

function createRealProjectIndex() {
  const projectCanvas = document.querySelector('#project-gl');
  const renderer = new THREE.WebGLRenderer({ canvas: projectCanvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = innerWidth < 720 ? 9.5 : 7;
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.68, 0.4, 0.12);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // A lighter version of the site's central particle anatomy. The project cards themselves come
  // directly from spiral.js, so their frame shader, layout, labels and motion are the real system.
  const count = innerWidth < 720 ? 12000 : 28000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const bone = new THREE.Color('#efe4d2');
  const nerve = new THREE.Color('#58c4ff');
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const special = Math.random() > 0.82;
    const level = Math.floor(Math.random() * 24) - 12;
    const localY = (Math.random() - 0.5) * SPINE_GAP * 0.58;
    const angle = Math.random() * Math.PI * 2;
    const shell = Math.random() ** 0.65;
    const radiusX = special ? 0.075 : 0.34 * shell;
    const radiusZ = special ? 0.075 : 0.22 * shell;
    positions[i3] = Math.cos(angle) * radiusX + (special ? 0 : (Math.random() - 0.5) * 0.12);
    positions[i3 + 1] = level * SPINE_GAP + localY;
    positions[i3 + 2] = Math.sin(angle) * radiusZ - (special ? 0.34 : 0);
    const c = special ? nerve : bone;
    colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: innerWidth < 720 ? 0.032 : 0.024,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spine = new THREE.Points(geometry, material);
  spine.frustumCulled = false;
  scene.add(spine);

  const index = createIndex({ projects: PROJECTS, scene, camera, isMobile: innerWidth < 720, onSelect: () => {} });
  const clock = new THREE.Clock();
  function resizeProject() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
  }
  function updateProject() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    index.update(dt, true, time);
    spine.rotation.y = index.angle();
    spine.position.y = ((index.lift() % SPINE_GAP) + SPINE_GAP) % SPINE_GAP;
    composer.render();
  }
  resizeProject();
  return { index, resize: resizeProject, update: updateProject };
}

const realProject = createRealProjectIndex();

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const smoother = (v) => { v = clamp(v); return v * v * v * (v * (v * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;

let seed = 9127;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const PARTICLE_COUNT = innerWidth < 700 ? 420 : 920;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: rand(), y: rand(), z: rand(), a: rand() * Math.PI * 2,
  size: 0.35 + rand() * 1.8,
  tone: rand(),
  speed: 0.4 + rand() * 1.2,
  id: i,
}));

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  realProject.resize();
}
addEventListener('resize', resize);
resize();

function dot(x, y, r, alpha, color = '206,229,255') {
  if (alpha <= 0 || x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2);
  ctx.fill();
}

function drawAmbient(time, reveal) {
  for (const p of particles) {
    const x = (p.x * width + Math.sin(time * 0.00008 * p.speed + p.a) * 18 + width) % width;
    const y = (p.y * height + Math.cos(time * 0.00006 * p.speed + p.a) * 14 + height) % height;
    const alpha = (0.025 + p.tone * 0.11) * (0.45 + reveal * 0.75);
    dot(x, y, p.size * 0.7, alpha, p.tone > 0.82 ? '255,210,164' : '190,222,255');
  }
}

function drawPortal(p, time) {
  const drift = smoother(p);
  for (const q of particles) {
    const x = q.x * width + drift * (28 + q.z * 120);
    const y = q.y * height + Math.sin(q.a + time * 0.00025) * (2 + q.z * 6);
    dot(x, y, q.size * 0.62, (0.035 + q.tone * 0.1) * (1 - p * 0.55));
  }
}

function drawPrism(p) {
  const open = smoother(clamp(p / 0.78));
  const fw = mix(width * 0.16, Math.min(width * 0.68, 940), open);
  const fh = mix(height * 0.08, Math.min(height * 0.64, 590), open);
  const cx = width * 0.5, cy = height * 0.49;
  for (const q of particles) {
    const side = q.id % 4;
    let x; let y;
    if (side === 0) { x = cx - fw / 2; y = cy + (q.y - .5) * fh; }
    else if (side === 1) { x = cx + fw / 2; y = cy + (q.y - .5) * fh; }
    else if (side === 2) { x = cx + (q.x - .5) * fw; y = cy - fh / 2; }
    else { x = cx + (q.x - .5) * fw; y = cy + fh / 2; }
    const fade = 1 - smooth(clamp((p - .68) / .32));
    dot(x, y, q.size * .72, fade * (.04 + q.tone * .2), '165,218,255');
  }
}

function drawRibbon(p, time) {
  const move = smoother(p);
  for (const q of particles) {
    const x = q.x * width - move * width * (.06 + q.z * .1);
    const y = q.y * height + Math.sin(q.a + time * .00035) * 5;
    dot(x, y, q.size * .58, (.035 + q.tone * .1) * (1 - p * .4));
  }
}

function drawDepth(p) {
  const cx = width * 0.5, cy = height * 0.49;
  const pull = smoother(p);
  for (const q of particles) {
    const scale = mix(.68, 1.08, pull * q.speed / 1.6);
    const x = cx + (q.x - .5) * width * scale;
    const y = cy + (q.y - .5) * height * scale;
    dot(x, y, q.size * (.5 + pull * .45), (.025 + q.tone * .09) * (1 - p * .25));
  }
}

function drawAperture(p) {
  const cx = width * 0.5, cy = height * 0.5;
  const open = smoother(p);
  const radius = mix(24, Math.hypot(width, height) * .56, open);
  for (const q of particles) {
    const angle = q.a;
    const spread = (q.z - .5) * 22;
    const x = cx + Math.cos(angle) * (radius + spread);
    const y = cy + Math.sin(angle) * (radius + spread) * .72;
    const fade = 1 - smooth(clamp((p - .72) / .28));
    dot(x, y, q.size * .62, fade * (.035 + q.tone * .13), '184,223,255');
  }
}

function render(time) {
  realProject.update();
  ctx.clearRect(0, 0, width, height);
  const elapsed = active ? time - startedAt : 0;
  const p = active ? clamp(elapsed / config.duration) : completed ? 1 : 0;
  if (!completed) drawAmbient(time, p);
  if (active) {
    if (variant === 'portal') drawPortal(p, time);
    if (variant === 'prism') drawPrism(p);
    if (variant === 'ribbon') drawRibbon(p, time);
    if (variant === 'depth') drawDepth(p);
    if (variant === 'aperture') drawAperture(p);
    if (p >= 1) {
      active = false;
      completed = true;
      document.body.classList.add('is-done');
      document.title = `${config.number} · ${config.name} — project index`;
    }
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function run() {
  if (active) return;
  document.body.classList.remove('is-running', 'is-done');
  void document.body.offsetWidth;
  completed = false;
  active = true;
  startedAt = performance.now();
  document.body.classList.add('is-running');
  document.title = `${config.number} · ${config.name} — transitioning`;
  if (reducedMotion) startedAt -= config.duration * 0.72;
}

function replay() {
  active = false;
  completed = false;
  document.body.classList.remove('is-running', 'is-done');
  document.title = `${config.number} · ${config.name} — Dizrupt transition lab`;
  void document.body.offsetWidth;
  setTimeout(run, 120);
}

runButton.addEventListener('click', run);
replayButton.addEventListener('click', replay);
addEventListener('wheel', (event) => {
  if (event.deltaY > 0 && !active && !completed) run();
  else if (completed) realProject.index.step(Math.sign(event.deltaY));
}, { passive: true });
addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') return replay();
  if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown') run();
});
addEventListener('pointermove', (event) => {
  document.documentElement.style.setProperty('--mx', ((event.clientX / innerWidth - 0.5) * 2).toFixed(3));
  document.documentElement.style.setProperty('--my', ((event.clientY / innerHeight - 0.5) * 2).toFixed(3));
});
