// @ts-nocheck — ported from the original site.
import * as THREE from 'three';
import { CARD_W, CARD_H, CORNER } from './spiral';

/* =========================================================
   The window field. The front project's card is not simply
   shown: it is made. The mascot comes apart and every one of
   his particles flies to one pixel of the card, taking that
   pixel's colour as it lands — particle i becomes pixel i.
   Turning the spiral, the same particles lift off the card
   you leave and rebuild the one you arrive at. Once a card
   is whole the real, crisp banner takes over under it.

   An anchor is where a particle stands at either end of a
   flight: a card (its pixel on that card, moving with the
   card), the mascot (its point on him, moving with him) or
   frozen (wherever it was when a flight was cut short).
   ========================================================= */
const CARD = 0, MASCOT = 1, FROZEN = 2;
const FLIGHT = 3.6;  // seconds for a whole flight
const STAGGER = 0.7; // how much of it is the stagger: the card unzips edge first and pours across
const SETTLE = 0.45;  // how long the crisp banner takes to come up under a finished card

const vertexShader = /* glsl */ `
uniform float uP;
uniform float uTime;
uniform float uFromKind, uToKind;
uniform mat4 uFromMat, uToMat;
uniform float uPitch;      // world size of one pixel of the card
uniform float uProj;       // pixels per world unit at distance 1
uniform float uMascotSize;
uniform vec3 uFromC, uToC; // the middle of each end, so the stream knows which way it runs
uniform float uHalf;       // half a card's width, in the world
uniform float uSpread;     // how thick the stream is: a ribbon between cards, a cloud off the mascot
attribute vec2 aCell;      // this particle's pixel, 0..1 across the card
attribute vec4 aR;
attribute vec3 aMascot;
attribute vec3 aFrozen;
varying vec2 vCell;
varying float vCard;
varying float vArc;
varying vec4 vR;

vec3 anchor(float kind, mat4 m) {
  if (kind < 0.5) return (m * vec4((aCell.x - 0.5) * ${CARD_W.toFixed(4)}, (aCell.y - 0.5) * ${CARD_H.toFixed(4)}, 0.0, 1.0)).xyz;
  if (kind < 1.5) return (m * vec4(aMascot, 1.0)).xyz;
  return aFrozen;
}

void main() {
  // Keep in sync with freeze() in window.js, which replays this on the CPU.
  /* A flow, not a burst. The side of the old card nearest the new one lets go first and the rest
     follows it off, so the card unzips; each particle rides an arch out towards you and over, and
     the stream pours into the new card in the same order it left. */
  vec3 A = anchor(uFromKind, uFromMat), B = anchor(uToKind, uToMat);
  vec3 run = uToC - uFromC;
  vec3 dir = length(run) > 0.001 ? normalize(run) : vec3(1.0, 0.0, 0.0);
  float lead = clamp(dot(A - uFromC, dir) / uHalf, -1.0, 1.0);
  float st = (0.5 - 0.5 * lead) * 0.92 + aR.x * 0.08;
  float t = clamp((uP - st * ${STAGGER.toFixed(2)}) / ${(1 - STAGGER).toFixed(2)}, 0.0, 1.0);
  float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float arc = sin(e * 3.14159265);
  vec3 C = (A + B) * 0.5 + vec3(0.0, 0.5, 1.2) + (aR.yzw - 0.5) * uSpread;
  float ie = 1.0 - e;
  vec3 p = ie * ie * A + 2.0 * ie * e * C + e * e * B;
  // the ribbon carries a wave: crests roll along it from the old card to the new
  float wave = sin(e * 3.14159265 * 3.0 - uTime * 3.2 + aCell.y * 1.5);
  p.y += wave * 0.32 * arc;
  p.z += cos(e * 3.14159265 * 3.0 - uTime * 3.2) * 0.18 * arc;

  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float card = mix(uFromKind < 0.5 ? 1.0 : 0.0, uToKind < 0.5 ? 1.0 : 0.0, e);
  float size = mix(uMascotSize * (0.5 + aR.y), uPitch * uProj * 1.0, card);
  gl_PointSize = size * (1.0 + arc * 0.5) / -mv.z;
  vCell = aCell;
  vCard = card;
  vArc = arc;
  vR = aR;
  // how far into the flight, for the colour to change over
  vR.x = e;
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uFromMap, uToMap;
uniform vec4 uFromWin, uToWin;       // the part of each banner its card shows: scale.xy, offset.xy
uniform float uFromLit, uToLit;      // 0 violet (the mascot), else the card's brightness
uniform float uAlpha;
varying vec2 vCell;
varying float vCard;
varying float vArc;
varying vec4 vR;

vec3 violet() { return mix(vec3(0.24, 0.05, 0.52), vec3(0.64, 0.22, 1.0), vR.y); }
vec3 look(sampler2D map, vec4 win, float lit) {
  if (lit <= 0.0) return violet();
  return texture2D(map, vCell * win.xy + win.zw).rgb * lit;
}

void main() {
  vec2 q = gl_PointCoord - 0.5;
  // squares while they are the picture, soft light while they fly
  float round = max(1.0 - vCard, vArc);
  float d = length(q);
  float soft = smoothstep(0.5, 0.0, d);
  float a = mix(1.0, soft * soft, round);
  if (a < 0.01) discard;

  // the card's own rounded corners
  vec2 c = abs(vCell - 0.5) * vec2(${CARD_W.toFixed(4)}, ${CARD_H.toFixed(4)});
  vec2 k = c - vec2(${(CARD_W / 2 - CORNER).toFixed(4)}, ${(CARD_H / 2 - CORNER).toFixed(4)});
  float out_ = step(${CORNER.toFixed(4)}, length(max(k, 0.0)));
  a *= 1.0 - out_ * vCard;

  vec3 col = mix(look(uFromMap, uFromWin, uFromLit), look(uToMap, uToWin, uToLit), smoothstep(0.25, 0.75, vR.x));
  // in flight they are light: violet through the brand's cyan, rippling across the card
  float ray = 0.5 + 0.5 * sin(vCell.x * 9.0 + vCell.y * 4.0 + vR.z * 6.0);
  vec3 aurora = mix(vec3(0.55, 0.2, 1.0), vec3(0.2, 0.85, 1.0), ray);
  col = mix(col, aurora * 0.75, vArc * 0.35);
  // on the mascot they pile deep and add, so each one is held right down
  float alpha = mix(0.07, 1.0, vCard) * (1.0 - vArc * 0.3);
  gl_FragColor = vec4(col, a * alpha * uAlpha);
}`;

export function createWindowField({ scene, count, cardScale }) {
  const aspect = CARD_W / CARD_H;
  const cols = Math.round(Math.sqrt(count * aspect));
  const rows = Math.floor(count / cols);
  const cells = cols * rows;

  const cell = new Float32Array(count * 2);
  const rand = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const n = i % cells;
    cell[i * 2] = ((n % cols) + 0.5) / cols;
    cell[i * 2 + 1] = 1 - (Math.floor(n / cols) + 0.5) / rows;
    for (let k = 0; k < 4; k++) rand[i * 4 + k] = Math.random();
  }
  const mascot = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const frozen = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  mascot.setUsage(THREE.DynamicDrawUsage);
  frozen.setUsage(THREE.DynamicDrawUsage);

  const geometry = new THREE.BufferGeometry();
  // the positions are all worked out in the shader; this only sets the count
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aCell', new THREE.BufferAttribute(cell, 2));
  geometry.setAttribute('aR', new THREE.BufferAttribute(rand, 4));
  geometry.setAttribute('aMascot', mascot);
  geometry.setAttribute('aFrozen', frozen);

  const uniforms = {
    uP: { value: 1 },
    uTime: { value: 0 },
    uFromKind: { value: MASCOT },
    uToKind: { value: MASCOT },
    uFromMat: { value: new THREE.Matrix4() },
    uToMat: { value: new THREE.Matrix4() },
    uPitch: { value: (CARD_W * cardScale) / cols },
    uProj: { value: 1 },
    uMascotSize: { value: 6 },
    uFromC: { value: new THREE.Vector3() },
    uToC: { value: new THREE.Vector3() },
    uHalf: { value: (CARD_W * cardScale) / 2 },
    uSpread: { value: 0.5 },
    uFromMap: { value: null },
    uToMap: { value: null },
    uFromWin: { value: new THREE.Vector4(1, 1, 0, 0) },
    uToWin: { value: new THREE.Vector4(1, 1, 0, 0) },
    uFromLit: { value: 0 },
    uToLit: { value: 0 },
    uAlpha: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 100;
  points.visible = false;
  scene.add(points);

  /* Where the flight stands. `to` is what it is heading for: { kind: 'card', n } or
     { kind: 'mascot' } or null for nothing at all. */
  const state = { from: null, to: null, p: 1, settled: 0, alpha: 0, time: 0 };
  const fromCard = { n: -1 }, toCard = { n: -1 };

  // Where particle i is right now, in the world — mirrors the vertex shader.
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  function anchorAt(i, kind, m, out) {
    if (kind === CARD) out.set((cell[i * 2] - 0.5) * CARD_W, (cell[i * 2 + 1] - 0.5) * CARD_H, 0).applyMatrix4(m);
    else if (kind === MASCOT) out.fromArray(mascot.array, i * 3).applyMatrix4(m);
    else out.fromArray(frozen.array, i * 3);
    return out;
  }
  function freeze() {
    const u = uniforms, P = u.uP.value, t0 = u.uTime.value;
    const next = new Float32Array(count * 3);
    const fc = u.uFromC.value, tc = u.uToC.value;
    const dir = tc.clone().sub(fc);
    if (dir.length() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
    const ctl = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const r = i * 4;
      anchorAt(i, u.uFromKind.value, u.uFromMat.value, a);
      anchorAt(i, u.uToKind.value, u.uToMat.value, b);
      const lead = Math.min(1, Math.max(-1, ctl.copy(a).sub(fc).dot(dir) / u.uHalf.value));
      const st = (0.5 - 0.5 * lead) * 0.92 + rand[r] * 0.08;
      const t = Math.min(Math.max((P - st * STAGGER) / (1 - STAGGER), 0), 1);
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      const arc = Math.sin(e * Math.PI), ie = 1 - e, sp = u.uSpread.value;
      ctl.copy(a).add(b).multiplyScalar(0.5);
      ctl.x += (rand[r + 1] - 0.5) * sp;
      ctl.y += 0.5 + (rand[r + 2] - 0.5) * sp;
      ctl.z += 1.2 + (rand[r + 3] - 0.5) * sp;
      for (let k = 0; k < 3; k++) {
        const ak = a.getComponent(k), bk = b.getComponent(k), ck = ctl.getComponent(k);
        next[i * 3 + k] = ie * ie * ak + 2 * ie * e * ck + e * e * bk;
      }
      next[i * 3 + 1] += Math.sin(e * Math.PI * 3 - t0 * 3.2 + cell[i * 2 + 1] * 1.5) * 0.32 * arc;
      next[i * 3 + 2] += Math.cos(e * Math.PI * 3 - t0 * 3.2) * 0.18 * arc;
    }
    // what is left of the flight is measured from where the cloud stands now
    u.uFromC.value.lerpVectors(fc, tc, P);
    frozen.array.set(next);
    frozen.needsUpdate = true;
    // the colour it was showing goes with it: whichever end it was nearer
    if (P > 0.5) {
      u.uFromMap.value = u.uToMap.value;
      u.uFromWin.value.copy(u.uToWin.value);
      u.uFromLit.value = u.uToLit.value;
    }
    u.uFromKind.value = FROZEN;
  }

  function setLook(which, card) {
    const u = uniforms;
    const map = which === 'from' ? u.uFromMap : u.uToMap;
    const win = which === 'from' ? u.uFromWin.value : u.uToWin.value;
    const lit = which === 'from' ? u.uFromLit : u.uToLit;
    if (!card) { lit.value = 0; return; }
    const pu = card.panelUniforms;
    map.value = pu.uHasMap.value ? pu.uMap.value : null;
    win.set(pu.uMapScale.value.x, pu.uMapScale.value.y, pu.uMapOffset.value.x, pu.uMapOffset.value.y);
    lit.value = map.value ? pu.uTint.value : 0;
  }

  /* Head for something new. `index` gives the cards; `field` the mascot's current shape and his
     transform; `animate` false puts the particles straight there (coming back from a case study,
     where the card is already on screen). */
  function go(to, { index, field, animate = true }) {
    const u = uniforms;
    const same = (x, y) => x && y && x.kind === y.kind && x.n === y.n;
    if (same(to, state.to)) return;
    const was = state.to;
    state.to = to;
    if (!to) return; // fades out where it is
    if (to.kind === 'mascot') {
      mascot.array.set(field.shape());
      mascot.needsUpdate = true;
    }
    const offCard = was?.kind === 'card' && u.uP.value >= 1 && animate;
    if (!offCard && (!was || state.alpha < 0.02 || !animate)) {
      if (to.kind === 'card' && animate && field.showing()) {
        // out of the mascot
        mascot.array.set(field.shape());
        mascot.needsUpdate = true;
        u.uFromKind.value = MASCOT;
        u.uFromMat.value.copy(field.matrix());
        u.uFromLit.value = 0;
        u.uP.value = 0;
      } else {
        u.uFromKind.value = to.kind === 'card' ? CARD : MASCOT;
        u.uP.value = 1;
      }
    } else if (offCard || (u.uP.value >= 1 && was.kind === 'card')) {
      // lifting off a finished card: the card is still where it was, so start from it
      u.uFromKind.value = CARD;
      u.uFromMat.value.copy(index.card(was.n).matrix);
      setLook('from', index.card(was.n));
      u.uP.value = 0;
    } else {
      freeze();
      u.uP.value = 0;
    }
    fromCard.n = u.uFromKind.value === CARD && was?.kind === 'card' ? was.n : -1;
    u.uToKind.value = to.kind === 'card' ? CARD : MASCOT;
    toCard.n = to.kind === 'card' ? to.n : -1;
    if (to.kind === 'card') setLook('to', index.card(to.n));
    else u.uToLit.value = 0;
    if (u.uP.value < 1) state.settled = 0;
  }

  /* Once a frame, after the cards and the mascot have moved. Returns how much of the mascot's own
     field should show (he is hidden while his particles are out here being a window). */
  function update(dt, time, { index, field, camera, height }) {
    const u = uniforms;
    u.uTime.value = time;
    u.uProj.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    u.uMascotSize.value = u.uPitch.value * u.uProj.value * 1.6;
    if (u.uP.value < 1) u.uP.value = Math.min(1, u.uP.value + dt / FLIGHT);

    // a card keeps moving on the spiral, and the flight follows it there
    if (state.to?.kind === 'card') {
      const c = index.card(state.to.n);
      u.uToMat.value.copy(c.matrix);
      setLook('to', c);
    } else if (state.to?.kind === 'mascot') u.uToMat.value.copy(field.matrix());
    if (u.uFromKind.value === CARD && fromCard.n >= 0) u.uFromMat.value.copy(index.card(fromCard.n).matrix);
    if (u.uFromKind.value !== FROZEN) u.uFromC.value.setFromMatrixPosition(u.uFromMat.value);
    if (state.to) u.uToC.value.setFromMatrixPosition(u.uToMat.value);
    // a ribbon between two cards; a looser cloud when he is one end of it
    u.uSpread.value = u.uFromKind.value === MASCOT || u.uToKind.value === MASCOT ? 1.2 : 0.1;

    const done = u.uP.value >= 1;
    const onCard = state.to?.kind === 'card';
    // a finished card hands over to the crisp banner; anything else stays drawn in particles
    state.settled = done && onCard ? Math.min(1, state.settled + dt / SETTLE) : 0;
    const alphaTo = !state.to ? 0 : onCard ? 1 - state.settled : done ? 0 : 1;
    state.alpha = !state.to || (done && !onCard) ? Math.max(0, state.alpha - dt / 0.35) : alphaTo;
    u.uAlpha.value = state.alpha;
    points.visible = state.alpha > 0.002;

    // the real panels hide under the particles that are standing in for them
    const P = u.uP.value;
    index.veil((n) => {
      if (!points.visible) return 0;
      if (onCard && n === state.to.n) return 1 - state.settled;
      if (n === fromCard.n) return 1 - THREE.MathUtils.smoothstep(P, 0.45, 1);
      return 0;
    });

    // and the mascot's own field hides while his particles are out here (or are the card)
    const fromMascot = u.uFromKind.value === MASCOT;
    if (onCard) return fromMascot ? 1 - THREE.MathUtils.smoothstep(P, 0, 0.12) : 0;
    if (state.to?.kind === 'mascot') return THREE.MathUtils.smoothstep(P, 0.8, 1);
    return 1;
  }

  return { go, update, target: () => state.to, debug: () => ({ ...state, p: uniforms.uP.value, from: uniforms.uFromKind.value }) };
}
