import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Mascot } from '../mascot';

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   The chip is his heart. Out of the hand-over comes an AI
   accelerator, floating on its own in the dark: a silicon die
   with its interference sheen ringed by HBM stacks on the
   interposer... now a round, flat nano-tech arc reactor, the
   Dizrupt mark beating in its core.

   Then the scroll builds him round it. Signals leave the chip
   along a branching tree of nerves that runs through his whole
   figure, head to toe; each particle of him lights where its
   nerve arrives, and the chip settles into his chest as the
   heart. Built, the heart keeps beating and every beat sends
   a pulse out along the nerves.

   World frame: the chip (the heart) is the origin; he stands
   round it at his own scale (the landing's mascot units).
   ========================================================= */
const CHIP = 0.3; // the package is ~7 across in its own units; this makes it the size of his heart

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export type AiWorld = ReturnType<typeof createAiWorld>;

// lub-dub: two beats close together, then a rest (the landing's heart, the same shape)
const BEAT_GLSL = /* glsl */ `float beatAt(float ph) { return exp(-pow((ph - 0.05) / 0.06, 2.0)) + 0.65 * exp(-pow((ph - 0.3) / 0.07, 2.0)); }`;
const beatAt = (ph: number) => Math.exp(-Math.pow((ph - 0.05) / 0.06, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));

export function createAiWorld(renderer: THREE.WebGLRenderer, pixelRatio: number, mascot: Mascot | null) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040509');
  scene.fog = new THREE.FogExp2('#040509', 0.018);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 300);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const uTime = { value: 0 };
  const uFront = { value: 0 }; // how far along the nerves the build has come (path length)
  const uBuilt = { value: 0 };
  const uViewH = { value: innerHeight * pixelRatio };

  /* ================= the chip ================= */
  const chipRoot = new THREE.Group(); // floats, turns, then settles facing out of his chest
  scene.add(chipRoot);
  const chip = new THREE.Group(); // the package, in its own units, lying on its back
  chip.scale.setScalar(CHIP);
  chip.rotation.x = Math.PI / 2; // its top faces +z: out of his chest, towards us
  chipRoot.add(chip);


  /* The reactor, the nano-tech kind: round and flat, set flush in a plate of dark nano-tech
     titanium (hex grain, engraved panel seams, a bevelled edge). In it, under flush glass, the
     light: a white-hot ring cut into segments, fine concentric rings inside it over a deep fill,
     and the core, where the Dizrupt mark beats. Local frame: it lies in x–z, its face towards +y
     (the group turns that out of his chest). Built as flat shapes in x–y and extruded, then laid
     down by the sub-group below. */
  const outline = Array.from({ length: 160 }, (_, i) => {
    const t = (i / 160) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(t), Math.sin(t));
  });
  const R = 2.7; // the reactor's radius; the plate runs out to 1.25 R
  const ringAt = (s: number) => outline.map((p) => p.clone().multiplyScalar(R * s));
  const toShape = (pts: THREE.Vector2[]) => new THREE.Shape(pts);
  const ring = (outer: number, inner: number) => {
    const sh = toShape(ringAt(outer));
    sh.holes.push(new THREE.Path(ringAt(inner).reverse()));
    return sh;
  };
  const face = new THREE.Group();
  face.rotation.x = -Math.PI / 2;
  chip.add(face);
  const layer = (shape: THREE.Shape, depth: number, z: number, mat: THREE.Material, bevel = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 4 });
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    m.castShadow = m.receiveShadow = true;
    face.add(m);
    return m;
  };

  // nanotech grain: a fine hex grid in the housing's bump and roughness
  const hexTex = (() => {
    const S = 512, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = '#888';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#333';
    g.lineWidth = 2;
    const r = 11, w = Math.sqrt(3) * r;
    for (let row = -1; row * r * 1.5 < S + r; row++)
      for (let col = -1; col * w < S + w; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          if (k) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
        g.stroke();
      }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.35, 0.35); // extrude UVs are in shape units
    return t;
  })();
  const titanium = new THREE.MeshPhysicalMaterial({
    color: '#2a2d33', metalness: 1, roughness: 0.38, bumpMap: hexTex, bumpScale: 0.6,
    clearcoat: 0.45, clearcoatRoughness: 0.3,
  });
  const titaniumLight = new THREE.MeshPhysicalMaterial({ color: '#8b9098', metalness: 1, roughness: 0.28 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#0c0f15', metalness: 0.7, roughness: 0.35 });

  // the plate: a disc with the reactor's well cut from it, bevelled; a bright lip round the well
  layer(ring(1.25, 0.8), 0.36, 0, titanium, 0.06);
  // engraved panel seams across the plate, the way the nano suit's plates meet
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.42 * R, 0.025, 0.02), dark);
    seam.position.set(Math.cos(a) * 1.03 * R, Math.sin(a) * 1.03 * R, 0.415);
    seam.rotation.z = a;
    face.add(seam);
  }
  layer(ring(1.03, 1.015), 0.012, 0.41, dark); // and one round it
  layer(ring(0.81, 0.775), 0.46, 0, titaniumLight);
  // behind the light, the back of the well
  layer(toShape(ringAt(0.8)), 0.06, 0, dark);

  // the light: a bright ring, a softer fill, an inner outline and the core
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.9, 1.0), toneMapped: false });
  // the fill between the rings is deep, brightening out towards the ring and in towards the core
  const fillTex = (() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0.0, '#9fe6ff');
    grd.addColorStop(0.42, '#1d5f9a');
    grd.addColorStop(0.62, '#0b2a52');
    grd.addColorStop(0.86, '#2c86c8');
    grd.addColorStop(1.0, '#bff1ff');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / (2 * R * 0.7), 1 / (2 * R * 0.7)); // extrude UVs are shape units: fit the fill
    t.offset.set(0.5, 0.5);
    return t;
  })();
  const fillMat = new THREE.MeshBasicMaterial({ map: fillTex, color: new THREE.Color(1, 1, 1), toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.95, 1.0), toneMapped: false });
  layer(ring(0.775, 0.66), 0.02, 0.1, ringMat);
  layer(ring(0.66, 0.34), 0.02, 0.095, fillMat);
  layer(ring(0.36, 0.31), 0.02, 0.1, ringMat);
  layer(toShape(ringAt(0.31)), 0.02, 0.095, coreMat);

  // the rings' light, drawn as neon: a soft cyan spill round each, a white-hot line down its middle
  const neonTex = (() => {
    const S = 1024, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const path = (sc: number) => {
      g.beginPath();
      ringAt(sc).forEach((p, i) => {
        const x = (p.x / (2 * R) + 0.5) * S, y = (0.5 - p.y / (2 * R)) * S;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
    };
    const u = S / (2 * R); // pixels per unit
    for (const [sc, w] of [[0.718, 0.115 * R], [0.5, 0.018 * R], [0.42, 0.012 * R], [0.335, 0.05 * R]] as const) {
      g.lineJoin = 'round';
      for (const [blur, alpha, width] of [[70, 0.5, 2.2], [28, 0.8, 1.2], [8, 1, 0.8]] as const) {
        g.shadowColor = `rgba(80,200,255,${alpha})`;
        g.shadowBlur = blur;
        g.strokeStyle = `rgba(90,205,255,${alpha})`;
        g.lineWidth = w * u * width;
        path(sc);
        g.stroke();
      }
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(235,252,255,1)';
      g.lineWidth = w * u * 0.35;
      path(sc);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), neonMat);
  neon.rotation.x = -Math.PI / 2;
  neon.position.y = 0.125;
  chip.add(neon);

  // the ring is cut into segments: thin dark gaps across it, flush with the light
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.13 * R, 0.022, 0.03), dark);
    cut.position.set(Math.cos(a) * 0.718 * R, Math.sin(a) * 0.718 * R, 0.135);
    cut.rotation.z = a;
    face.add(cut);
  }
  // and finer ticks round the core, like a lens barrel
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry((k % 5 ? 0.03 : 0.06) * R, 0.008, 0.02), titaniumLight);
    tick.position.set(Math.cos(a) * 0.59 * R, Math.sin(a) * 0.59 * R, 0.13);
    tick.rotation.z = a;
    face.add(tick);
  }

  // the glass over it all: a thin heart, clear, catching the room
  layer(toShape(ringAt(0.8)), 0.02, 0.33, new THREE.MeshPhysicalMaterial({
    color: '#cfefff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
  }));

  // a soft halo of its light round it
  const haloTex = (() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  })();
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: new THREE.Color(0.2, 0.55, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.36; // behind the housing: it glows out round the edges, not over the face
  chip.add(halo);

  // the mark in the core: his heart, beating
  const heartTex = new THREE.TextureLoader().load('/heart.png');
  heartTex.colorSpace = THREE.SRGBColorSpace;
  const heartMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color(0.95, 0.8, 1.15), transparent: true, depthWrite: false, toneMapped: false });
  const heart = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), heartMat);
  heart.position.set(0, 0.125, 0.05);
  heart.rotation.x = -Math.PI / 2;
  chip.add(heart);
  const heartGlowMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const heartGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), heartGlowMat);
  heartGlow.position.set(0, 0.13, 0.05);
  heartGlow.rotation.x = -Math.PI / 2;
  chip.add(heartGlow);

  /* ================= him: the nerves and the particles ================= */
  let figure: THREE.Group | null = null;
  let maxL = 1;
  const center = new THREE.Vector3(0, -2.5, 0);
  let height = 9;
  if (mascot) {
    const full = mascot.full.array as Float32Array;
    // where his heart is in his own frame: the landing puts it here (engine.ts)
    const neutral = mascot.neutral.array as Float32Array;
    const hy = mascot.pivot.y - 1.85, hx = 1.0;
    let hz = 0;
    for (let i = 0; i < neutral.length; i += 3) if (Math.abs(neutral[i + 1] - hy) < 0.2 && Math.abs(neutral[i] - hx) < 0.2) hz = Math.max(hz, neutral[i + 2]);
    const H = new THREE.Vector3(hx, hy, hz - 0.15); // just inside his chest
    figure = new THREE.Group();
    figure.position.copy(H).negate();
    scene.add(figure);
    const count = full.length / 3;
    const box = new THREE.Box3().setFromBufferAttribute(mascot.full);
    box.getCenter(center).sub(H);
    height = box.max.y - box.min.y;

    // the nerves: a tree grown out from the heart through a sample of his points, each joining
    // the nearest one already reached, so the branches follow his body out to the fingertips
    const N = 2200;
    const nodes = new Float32Array((N + 1) * 3);
    nodes.set([H.x, H.y, H.z], 0);
    const rand = rng(21);
    for (let k = 1; k <= N; k++) {
      const i = Math.floor(rand() * count);
      nodes[k * 3] = full[i * 3];
      nodes[k * 3 + 1] = full[i * 3 + 1];
      nodes[k * 3 + 2] = full[i * 3 + 2];
    }
    const d0 = (k: number) => Math.hypot(nodes[k * 3] - H.x, nodes[k * 3 + 1] - H.y, nodes[k * 3 + 2] - H.z);
    const order = Array.from({ length: N }, (_, k) => k + 1).sort((a, b) => d0(a) - d0(b));
    const L = new Float32Array(N + 1);
    const parent = new Int32Array(N + 1).fill(-1);
    const reached = [0];
    for (const k of order) {
      let best = 0, bd = Infinity;
      const x = nodes[k * 3], y = nodes[k * 3 + 1], z = nodes[k * 3 + 2];
      for (const j of reached) {
        const dx = nodes[j * 3] - x, dy = nodes[j * 3 + 1] - y, dz = nodes[j * 3 + 2] - z;
        // a slight pull towards joining nearer the heart, so trunks form rather than a web
        const d = Math.hypot(dx, dy, dz) + L[j] * 0.04;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      parent[k] = best;
      L[k] = L[best] + Math.hypot(nodes[best * 3] - x, nodes[best * 3 + 1] - y, nodes[best * 3 + 2] - z);
      reached.push(k);
    }
    maxL = Math.max(...L);
    const lp: number[] = [], ll: number[] = [];
    for (let k = 1; k <= N; k++) {
      const j = parent[k];
      lp.push(nodes[j * 3], nodes[j * 3 + 1], nodes[j * 3 + 2], nodes[k * 3], nodes[k * 3 + 1], nodes[k * 3 + 2]);
      ll.push(L[j], L[k]);
    }
    const nerveGeo = new THREE.BufferGeometry();
    nerveGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    nerveGeo.setAttribute('aL', new THREE.Float32BufferAttribute(ll, 1));
    const nerves = new THREE.LineSegments(nerveGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uFront, uBuilt },
      vertexShader: /* glsl */ `attribute float aL; varying float vL; void main(){ vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uFront, uBuilt; varying float vL;
        ${BEAT_GLSL}
        void main(){
          if (vL > uFront) discard;
          // the build's leading edge burns bright; behind it the nerve settles to a faint glow
          float lead = exp(-(uFront - vL) * 3.0) * (1.0 - uBuilt);
          // every heartbeat sends a pulse out along the nerves
          float beat = beatAt(fract(uTime - vL / 5.0)) * uBuilt;
          vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.72, 0.4, 1.0), smoothstep(0.0, 6.0, vL));
          // every trunk starts at the heart: fade them there, or they pile up into one white blot
          float root = smoothstep(0.15, 1.6, vL);
          float a = (0.07 + lead * 0.9 + beat * 0.45) * root;
          gl_FragColor = vec4(c * (1.0 + lead * 1.2 + beat * 1.0), a);
        }`,
    }));
    figure.add(nerves);

    // each particle of him lights when its nerve gets there: the reach of its nearest node
    const cell = 0.45;
    const grid = new Map<string, number[]>();
    const keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let k = 0; k <= N; k++) {
      const kk = keyOf(nodes[k * 3], nodes[k * 3 + 1], nodes[k * 3 + 2]);
      (grid.get(kk) ?? grid.set(kk, []).get(kk)!).push(k);
    }
    const reach = new Float32Array(count);
    const seed = new Float32Array(count);
    const ratio = maxL / Math.max(...order.map(d0));
    for (let i = 0; i < count; i++) {
      const x = full[i * 3], y = full[i * 3 + 1], z = full[i * 3 + 2];
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = -1, bd = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const list = grid.get(`${cx + a},${cy + b},${cz + c}`);
        if (!list) continue;
        for (const k of list) {
          const d = Math.hypot(nodes[k * 3] - x, nodes[k * 3 + 1] - y, nodes[k * 3 + 2] - z);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
      }
      reach[i] = best >= 0 ? L[best] + bd : Math.hypot(x - H.x, y - H.y, z - H.z) * ratio;
      seed[i] = rand();
    }
    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.BufferAttribute(full, 3));
    bodyGeo.setAttribute('aReach', new THREE.BufferAttribute(reach, 1));
    bodyGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const body = new THREE.Points(bodyGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uFront, uBuilt, uViewH, uHeart: { value: H } },
      vertexShader: /* glsl */ `
        attribute float aReach, aSeed; uniform float uTime, uFront, uBuilt, uViewH; uniform vec3 uHeart;
        varying float vOn; varying float vFlash; varying float vSeed; varying float vBeat;
        ${BEAT_GLSL}
        void main(){
          float since = uFront - aReach;
          vOn = step(0.0, since);
          vFlash = exp(-max(since, 0.0) * 5.0) * vOn * (1.0 - uBuilt);
          vSeed = aSeed;
          vBeat = beatAt(fract(uTime - aReach / 5.0)) * uBuilt;
          // they pop into place: a little outward of where they land, settling as they arrive
          vec3 p = position + normalize(position - uHeart + 1e-4) * 0.25 * vFlash;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = vOn * (0.028 + vFlash * 0.02) * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vOn; varying float vFlash; varying float vSeed; varying float vBeat;
        void main(){
          if (vOn < 0.5) discard;
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          // his own violets (the landing's), a cyan flash where the signal has just arrived
          vec3 base = mix(vec3(0.79, 0.72, 1.0), vec3(0.44, 0.3, 1.0), vSeed);
          vec3 c = mix(base, vec3(0.5, 0.95, 1.0), vFlash * 0.8) * (0.9 + vFlash * 0.5 + vBeat * 0.5);
          gl_FragColor = vec4(c, a * (0.75 + vFlash * 0.25));
        }`,
    }));
    figure.add(body);

    // a dark mirror floor under his feet, catching him and the heart
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshPhysicalMaterial({ color: '#07080d', roughness: 0.28, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = box.min.y - 0.02;
    floor.receiveShadow = true;
    figure.add(floor);
  }

  // dust in the light
  const dust = (() => {
    const n = 700, p: number[] = [];
    const r2 = rng(5);
    for (let i = 0; i < n; i++) p.push((r2() - 0.5) * 18, center.y + (r2() - 0.5) * height * 1.2, (r2() - 0.5) * 12);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#9aa6c8', size: 0.02, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  })();
  scene.add(dust);

  /* ================= light ================= */
  const key = new THREE.DirectionalLight('#fff4e8', 1.4);
  key.position.set(2.5, 4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2;
  key.shadow.camera.right = key.shadow.camera.top = 2;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rimC = new THREE.PointLight('#35d8ff', 3, 12, 1.6);
  rimC.position.set(-3, 1.5, -3.5); // behind: a rim, never a glint straight back at the camera
  const rimV = new THREE.PointLight('#a310e7', 4, 12, 1.6);
  rimV.position.set(3, -1, -3);
  scene.add(rimC, rimV);

  /* ================= its own buffers and bloom ================= */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.renderToScreen = false;
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // no single glint may outshine the heart: a pinpoint specular off a metal edge is thousands of
  // times brighter than anything else, and the bloom would smear it into a halo across the screen
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c.rgb * min(1.0, 3.0 / max(m, 1e-4)), c.a); }`,
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.12, 1.6);
  composer.addPass(bloom);

  /* ================= the camera: the chip close, pulling back as he's built round it ================= */
  const C = center;
  const far = height * 1.95;
  const keys = {
    pos: [
      new THREE.Vector3(0.7, 0.45, 5.2),
      new THREE.Vector3(1.6, 0.9, 8.0),
      new THREE.Vector3(C.x + 3.5, C.y + 2.2, far * 0.62),
      new THREE.Vector3(C.x + 0.5, C.y + 0.6, far),
      new THREE.Vector3(C.x - 4.5, C.y - 0.2, far * 0.95),
    ],
    look: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.3, -0.3, 0), new THREE.Vector3(C.x, C.y + 1.5, 0), new THREE.Vector3(C.x, C.y, 0), new THREE.Vector3(C.x, C.y + 0.4, 0)],
  };
  const posC = new THREE.CatmullRomCurve3(keys.pos, false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(keys.look, false, 'centripetal');
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
  let first = true;

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 52 : 32; // a phone needs the wider lens
    camera.updateProjectionMatrix();
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    uViewH.value = innerHeight * pixelRatio;
  };
  resize();

  const smooth = (a: number, b: number, t: number) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  let build = 0;

  return {
    scene,
    camera,
    resize,
    /** p: 0..1 through the section; px, py: the pointer (-1..1) */
    render(dt: number, time: number, p: number, px: number, py: number) {
      uTime.value = time;
      const q = Math.min(1, Math.max(0, p));
      posC.getPointAt(q, tgtPos);
      lookC.getPointAt(q, tgtLook);
      const reach = tgtPos.length() * 0.06; // the cursor leans the view more the further out we are
      tgtPos.x += Math.sin(time * 0.15) * reach * 0.5 + px * (0.2 + reach);
      tgtPos.y += py * (0.1 + reach * 0.5);
      const k = first ? 1 : 1 - Math.exp(-3.2 * dt);
      first = false;
      pos.lerp(tgtPos, k);
      look.lerp(tgtLook, k);
      camera.position.copy(pos);
      camera.lookAt(look);

      // the build follows the scroll, eased so the signals travel rather than jump
      const want = smooth(0.1, 0.72, q);
      build += (want - build) * (1 - Math.exp(-2.5 * dt));
      uFront.value = build * maxL * 1.04;
      uBuilt.value = smooth(0.92, 1.0, build);

      // the chip floats, turning to show itself, until he's round it; then it's his heart, still
      const free = 1 - smooth(0.0, 0.35, build);
      // in his chest it's a compact heart, not the showpiece it was floating on its own
      chipRoot.scale.setScalar(1 - 0.58 * smooth(0.08, 0.5, build));
      chipRoot.position.set(0, Math.sin(time * 0.9) * 0.06 * free, 0);
      chipRoot.rotation.set(Math.sin(time * 0.5) * 0.35 * free - 0.25 * free, Math.sin(time * 0.37) * 0.5 * free + 0.35 * free, Math.sin(time * 0.29) * 0.08 * free);
      // it beats: the mark, its glow, and the light it throws
      const bt = beatAt(time % 1);
      heartMat.color.setRGB(0.85, 0.6, 1.2).multiplyScalar(1.4 + bt * 1.0);
      heartGlowMat.opacity = 0.15 + bt * 0.35;
      heartGlow.scale.setScalar(1 + bt * 0.12);
      // the reactor's light swells with each beat and the coils catch it
      ringMat.color.setRGB(0.35, 0.82, 1.0).multiplyScalar(1.2 + bt * 0.4);
      neonMat.color.setScalar(1.1 + bt * 0.9);
      fillMat.color.setScalar(0.55 + bt * 0.3);
      coreMat.color.setRGB(0.1, 0.35, 0.6).multiplyScalar(0.8 + bt * 0.5);
      haloMat.opacity = 0.3 + bt * 0.25;
      dust.rotation.y = time * 0.01;

      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
  };
}
