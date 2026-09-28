import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Mascot } from '../mascot';

/* =========================================================
   AI & Automation: its own world, drawn by the same renderer
   into its own buffers and handed to the transition pass.

   The chip is his heart. Out of the hand-over comes an AI
   accelerator, floating on its own in the dark: a silicon die
   with its interference sheen ringed by HBM stacks on the
   interposer... now an arc reactor: coils, a light ring, and in
   its hub the Dizrupt mark, beating.

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
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = chip) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* An arc reactor, built like a machined part: a steel housing turned on a lathe, bolts round its
     rim, a ring of copper coils wound on their cores and clamped in steel, a light ring glowing
     inside them, struts to a centre hub, insulated leads with bare copper ends running from the
     coils to the hub, and under a glass lens in the hub the Dizrupt mark, beating. Local frame:
     it lies in x–z, its face towards +y (the group turns that out of his chest). */
  const steel = new THREE.MeshPhysicalMaterial({ color: '#8f949c', metalness: 1, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const steelDark = new THREE.MeshPhysicalMaterial({ color: '#2c2f35', metalness: 1, roughness: 0.42 });
  // machining: fine concentric rings in the roughness, the way a turned face catches the light
  const turned = (() => {
    const S = 512, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgb(0,110,0)';
    g.fillRect(0, 0, S, S);
    for (let r = 4; r < S / 2; r += 2.2) {
      g.strokeStyle = `rgb(0,${90 + ((r * 37) % 60)},0)`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(S / 2, S / 2, r, 0, 7);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  })();
  const face = new THREE.MeshPhysicalMaterial({ color: '#3d424a', metalness: 1, roughness: 1, roughnessMap: turned, clearcoat: 0.15 });

  // the housing: a lathe profile — back plate, raised outer rim with a chamfer, a recessed well
  {
    const prof: [number, number][] = [
      [0.0, -0.32], [3.3, -0.32], [3.46, -0.24], [3.5, 0.18], [3.42, 0.34], [3.12, 0.36], [3.05, 0.2],
      [2.95, 0.02], [0.0, 0.02],
    ];
    const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 128);
    add(lathe, steel, 0, 0, 0);
    // the well's floor, turned
    const well = add(new THREE.CircleGeometry(2.95, 128), face, 0, 0.021, 0);
    well.rotation.x = -Math.PI / 2;
    // bolts round the rim: hex heads with a washer
    const hexMat = new THREE.MeshPhysicalMaterial({ color: '#6f747c', metalness: 1, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const x = Math.cos(a) * 3.26, z = Math.sin(a) * 3.26;
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24), steelDark, x, 0.365, z);
      const hex = add(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6), hexMat, x, 0.41, z);
      hex.rotation.y = a;
    }
  }

  // the coils: ten copper windings on dark cores, each a short arc of the ring, clamped at both ends
  const N_COIL = 10, R_COIL = 2.28;
  const copperTex = (() => {
    // windings: tight parallel turns across the coil, each catching the light a little differently
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 16;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 512; x++) {
      const k = (x % 14) / 14;
      const v = 0.45 + 0.55 * Math.sin(k * Math.PI);
      g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * v)},${Math.round(255 * v)})`;
      g.fillRect(x, 0, 1, 16);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const copper = new THREE.MeshPhysicalMaterial({
    color: '#c7783f', metalness: 1, roughness: 0.32, bumpMap: copperTex, bumpScale: 4,
    emissive: '#3aa8ff', emissiveIntensity: 0, clearcoat: 0.5, clearcoatRoughness: 0.3,
  });
  const coreMat = new THREE.MeshPhysicalMaterial({ color: '#15161a', metalness: 0.4, roughness: 0.6 });
  const span = (Math.PI * 2) / N_COIL;
  const arc = span * 0.74;
  for (let i = 0; i < N_COIL; i++) {
    const a0 = i * span + (span - arc) / 2;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(R_COIL, 0.27, 20, 40, arc), copper);
    coil.rotation.x = -Math.PI / 2;
    coil.rotation.z = a0; // after the x turn, z spins it round the reactor's axis
    coil.position.y = 0.33;
    coil.castShadow = coil.receiveShadow = true;
    chip.add(coil);
    // the core it's wound on, seen at its ends, and the steel clamps holding it
    for (const e of [a0, a0 + arc]) {
      const x = Math.cos(e) * R_COIL, z = -Math.sin(e) * R_COIL;
      const cap = add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), coreMat, x, 0.33, z);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(e), 0, -Math.cos(e)));
      const clamp = add(new RoundedBoxGeometry(0.2, 0.46, 0.7, 2, 0.04), steel, Math.cos(e) * R_COIL, 0.3, -Math.sin(e) * R_COIL);
      clamp.rotation.y = e;
    }
  }
  // copper's texture runs round each coil: repeat it so the turns are tight
  copperTex.repeat.set(1, 1); // ~36 turns a coil: fine, but each one still reads

  // the light ring inside the coils: the reactor's glow, and a softer halo on the floor round it
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.9, 1.0), toneMapped: false });
  const lightRing = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.09, 16, 160), ringMat);
  lightRing.rotation.x = -Math.PI / 2;
  lightRing.position.y = 0.2;
  chip.add(lightRing);
  const haloTex = (() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.16, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.35, 'rgba(255,255,255,1)');
    grd.addColorStop(0.62, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  })();
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: new THREE.Color(0.25, 0.7, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  chip.add(halo);

  // struts from the housing's well in to the hub, in the gaps between the coils
  for (let i = 0; i < N_COIL; i++) {
    const a = i * span;
    const s = add(new RoundedBoxGeometry(0.9, 0.08, 0.12, 2, 0.02), steelDark, Math.cos(a) * 1.62, 0.1, -Math.sin(a) * 1.62);
    s.rotation.y = a;
  }

  // the hub: a steel collar, the lens over the mark
  {
    const collar = new THREE.LatheGeometry(
      [[0, 0.02], [1.18, 0.02], [1.22, 0.1], [1.2, 0.46], [1.1, 0.5], [1.02, 0.44], [0.98, 0.3], [0, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)),
      96,
    );
    add(collar, steel, 0, 0, 0);
    // a dark glass lens, domed, with the mark glowing beneath it
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 64, 24, 0, Math.PI * 2, 0, 0.8),
      new THREE.MeshPhysicalMaterial({ color: '#9fd9ff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.18, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }),
    );
    lens.position.y = 0.3 - Math.cos(0.8) * 1.35;
    lens.scale.y = 0.55;
    chip.add(lens);
    const under = add(new THREE.CircleGeometry(0.98, 96), new THREE.MeshPhysicalMaterial({ color: '#0a0e16', metalness: 0.6, roughness: 0.3 }), 0, 0.301, 0);
    under.rotation.x = -Math.PI / 2;
  }

  // the leads: insulated wire from each coil in to the hub, arching over the struts, copper at the ends
  {
    const insulation = new THREE.MeshPhysicalMaterial({ color: '#1b1c20', roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.5 });
    const insulationRed = new THREE.MeshPhysicalMaterial({ color: '#5a1418', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.5 });
    const bare = new THREE.MeshPhysicalMaterial({ color: '#d48a4e', metalness: 1, roughness: 0.3 });
    for (let i = 0; i < N_COIL; i++) {
      const a = i * span + span / 2; // from the middle of each coil
      for (const off of [-0.09, 0.09]) {
        const aa = a + off * 0.4;
        const from = new THREE.Vector3(Math.cos(aa) * (R_COIL - 0.26), 0.38, -Math.sin(aa) * (R_COIL - 0.26));
        const to = new THREE.Vector3(Math.cos(aa) * 1.2, 0.44, -Math.sin(aa) * 1.2);
        const mid = from.clone().lerp(to, 0.5).setY(0.62);
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 10, false), off < 0 ? insulation : insulationRed);
        wire.castShadow = true;
        chip.add(wire);
        for (const [p, t] of [[from, curve.getTangent(0)], [to, curve.getTangent(1)]] as const) {
          const end = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10), bare);
          end.position.copy(p);
          end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.clone().normalize());
          chip.add(end);
        }
      }
    }
  }

  // the mark in the hub: his heart, lit from inside and beating
  const heartTex = new THREE.TextureLoader().load('/heart.png');
  heartTex.colorSpace = THREE.SRGBColorSpace;
  const heartMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color(0.95, 0.8, 1.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const heart = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), heartMat);
  heart.position.y = 0.305;
  heart.rotation.x = -Math.PI / 2;
  chip.add(heart);
  const heartGlowMat = new THREE.MeshBasicMaterial({ map: heartTex, color: new THREE.Color('#b46bff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const heartGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), heartGlowMat);
  heartGlow.position.y = 0.31;
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
      heartMat.color.setRGB(0.95, 0.8, 1.15).multiplyScalar(1.0 + bt * 0.9);
      heartGlowMat.opacity = 0.15 + bt * 0.35;
      heartGlow.scale.setScalar(1 + bt * 0.12);
      // the reactor's light swells with each beat and the coils catch it
      ringMat.color.setRGB(0.35, 0.85, 1.0).multiplyScalar(2.4 + bt * 1.2);
      haloMat.opacity = 0.6 + bt * 0.4;
      copper.emissiveIntensity = 0.04 + bt * 0.08;
      dust.rotation.y = time * 0.01;

      composer.render(dt);
      return composer.readBuffer.texture;
    },
    get texture() {
      return composer.readBuffer.texture;
    },
  };
}
