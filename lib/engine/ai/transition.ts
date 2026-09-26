import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* =========================================================
   The hand-over between the city and the AI world, done on the
   real pixels of both: tDiffuse is the city as it was drawn this
   frame, tAi the AI world. uMix runs 0 → 1 (and back, on the way
   out), uMode picks the transition:

   0  Signal loss   the picture glitches, green binary bleeds through,
                    the whole screen becomes a storm of binary, and
                    the binary decodes into the new world
   1  Neural scan   a scan front sweeps the screen; everything it
                    passes is read as edges and a lattice, and
                    resolves into the new world behind it
   2  ASCII decode  the screen is transcoded into characters, the
                    characters re-encode to the new picture, then
                    decode back to pixels
   3  CRT reboot    the city powers off to a line and a dot; the
                    AI world boots up out of the dark
   ========================================================= */
export const TRANSITIONS = [
  { id: 'signal', name: 'Signal loss', duration: 2.6 },
  { id: 'scan', name: 'Neural scan', duration: 2.0 },
  { id: 'ascii', name: 'ASCII decode', duration: 2.3 },
  { id: 'crt', name: 'CRT reboot', duration: 2.6 },
] as const;

function glyphAtlas() {
  // a luminance ramp, then code characters for the scramble
  const chars = ' .:-=+*#%@01<>/{';
  const c = document.createElement('canvas');
  c.width = 64 * chars.length;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.font = '700 54px "JetBrains Mono", Menlo, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...chars].forEach((ch, i) => g.fillText(ch, i * 64 + 32, 34));
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function createTransitionPass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tAi: { value: null },
      tGlyph: { value: glyphAtlas() },
      tMascot: { value: null },
      uMix: { value: 0 },
      uMode: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 1.0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse, tAi, tGlyph, tMascot;
      uniform float uMix, uTime, uExposure;
      uniform int uMode;
      uniform vec2 uRes;
      varying vec2 vUv;

      float h1(float n) { return fract(sin(n * 91.345) * 47453.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      // the AI world is HDR: tone map it here, the city is already display-ready linear
      vec3 A(vec2 uv) { return texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb; }
      vec3 B(vec2 uv) { return aces(texture2D(tAi, clamp(uv, 0.0, 1.0)).rgb * uExposure); }
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec3 pick(vec2 uv, float w) { return w > 0.5 ? B(uv) : A(uv); }

      /* ---------- 0: signal loss ----------
         The page glitches a little; green binary starts bleeding through in streams; then the whole
         screen is binary, tearing and flickering; then the binary decodes into the new world. */
      vec3 signalLoss(vec2 uv, float t) {
        float step20 = floor(uTime * 20.0);
        float light = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.6, 0.72, t)); // the first, small glitches
        float bin = pow(smoothstep(0.2, 0.62, t), 1.8);                               // how much is binary: a trickle, then a flood
        float full = smoothstep(0.5, 0.62, t) * (1.0 - smoothstep(0.84, 0.98, t));   // the whole-screen binary storm

        // torn rows: a few at first, the whole picture shredding in the storm
        float row = floor(uv.y * mix(36.0, 18.0, h1(step20)));
        float tear = step(1.0 - (light * 0.12 + full * 0.5), h2(vec2(row, step20)));
        uv.x += tear * (h2(vec2(row, step20 + 3.0)) - 0.5) * (0.04 + full * 0.3);

        // the binary grid; each column's digits fall at their own speed
        vec2 cellPx = vec2(11.0, 17.0);
        vec2 gp = uv * uRes / cellPx;
        vec2 cell = floor(gp);
        float colH = h2(vec2(cell.x, 7.0));
        float fall = uTime * (3.0 + colH * 9.0);
        vec2 fcell = floor(vec2(gp.x, gp.y + fall));
        vec2 f = fract(vec2(gp.x, gp.y + fall));

        // when this cell hands its picture over to the new world
        float sw = 0.66 + h2(cell) * 0.12 + (1.0 - uv.y) * 0.08;
        float useB = step(sw, t);
        float ca = 0.004 * light + 0.018 * full + tear * 0.02;
        vec3 src;
        src.r = pick(uv + vec2(ca, 0.0), useB).r;
        src.g = pick(uv, useB).g;
        src.b = pick(uv - vec2(ca, 0.0), useB).b;

        // where the binary is: streams down some columns first, then everywhere
        float stream = fract(fcell.y * 0.035 + colH * 5.0);
        float seed = colH * 0.55 + stream * 0.35 + h2(cell) * 0.1;
        float cov = step(seed, bin * 1.12);
        cov *= 1.0 - smoothstep(sw, sw + 0.1, t);   // decoded cells go back to pixels

        // the digit: 0 or 1, flipping now and then; brightness from the picture beneath
        float flip = floor(uTime * (2.0 + h2(fcell) * 10.0));
        float digit = step(0.5, h2(fcell + flip * 0.13));
        vec2 guv = vec2((10.0 + digit + clamp(f.x, 0.1, 0.9)) / 16.0, 1.0 - f.y);
        float glyph = texture2D(tGlyph, guv).r;
        float l = luma(src);
        // the leading digit of each stream burns white-green
        float head = smoothstep(0.93, 1.0, stream);
        vec3 green = mix(vec3(0.1, 1.0, 0.35), vec3(0.8, 1.0, 0.85), head);
        vec3 bits = green * glyph * (0.35 + l * 2.2 + head * 1.5) + src * 0.06;
        // the storm: whole blocks of digits flash, drop out or invert
        vec2 blk = floor(uv * uRes / 64.0);
        float bh = h2(blk + step20);
        bits *= 1.0 + full * step(0.9, bh) * 1.5;
        bits *= 1.0 - full * step(bh, 0.06);
        bits = mix(bits, vec3(0.1, 1.0, 0.35) * (1.0 - glyph) * 0.6, full * step(0.97, bh));

        vec3 c = mix(src, bits, cov);

        // in the storm the mascot comes through: his upper body spelled out in purple binary, rising
        // from the bottom of the screen, flickering in and out and torn with the rest of it
        float him = smoothstep(0.42, 0.52, t) * (1.0 - smoothstep(0.74, 0.82, t));
        him *= step(0.18, h1(floor(uTime * 14.0) + 5.0));                 // the signal drops him now and then
        if (him > 0.0) {
          float aspect = uRes.x / uRes.y;
          vec2 cc = (cell + 0.5) * cellPx / uRes;                         // read him per character, not per pixel
          cc.x += tear * (h2(vec2(row, step20 + 9.0)) - 0.5) * 0.05;      // the tears catch him too, a little
          vec2 m = vec2((cc.x - 0.5) * aspect / 0.95 + 0.5, cc.y / 0.95);
          float inside = step(0.0, m.x) * step(m.x, 1.0) * step(m.y, 1.0);
          float dens = inside * texture2D(tMascot, m).r;
          float body = smoothstep(0.08, 0.3, dens);
          float halo = inside * smoothstep(0.0, 0.08, texture2D(tMascot, m + vec2(0.0, -0.01)).r + dens);
          c *= 1.0 - 0.55 * halo * him;
          if (body > 0.0) {
            // his own digits: they don't fall, they flicker in place
            float fl = floor(uTime * (4.0 + h2(cell) * 12.0));
            float dg = step(0.5, h2(cell + fl * 0.17));
            vec2 fc = fract(gp);
            float gl = texture2D(tGlyph, vec2((10.0 + dg + clamp(fc.x, 0.1, 0.9)) / 16.0, 1.0 - fc.y)).r;
            // Dizrupt purple, a touch lighter where he's densest (the face, the outline); never white
            vec3 violet = mix(vec3(0.5, 0.03, 0.82), vec3(0.72, 0.3, 1.0), smoothstep(0.3, 1.6, dens));
            vec3 hisBits = violet * gl * min(2.2, 1.3 + dens * 0.8);
            hisBits = mix(hisBits, violet * 0.5 * (1.0 - gl), full * step(0.975, bh)); // inverted blocks
            // the green storm backs off round him so he reads
            c = mix(c, hisBits + c * 0.08, body * him);
          }
        }

        // a little snow and scanlines while it's failing
        float noise = light * 0.12 + full * 0.18;
        c += (h2(uv * uRes + uTime) - 0.5) * noise;
        c *= 1.0 - (light * 0.1 + full * 0.2) * step(0.5, fract(uv.y * uRes.y * 0.5));
        return c;
      }

      /* ---------- 1: neural scan ---------- */
      float edges(vec2 uv, float w) {
        vec2 px = 1.5 / uRes;
        float l = luma(pick(uv - vec2(px.x, 0.0), w)), r = luma(pick(uv + vec2(px.x, 0.0), w));
        float d = luma(pick(uv - vec2(0.0, px.y), w)), u = luma(pick(uv + vec2(0.0, px.y), w));
        return clamp(length(vec2(r - l, u - d)) * 4.0, 0.0, 1.0);
      }
      vec3 neuralScan(vec2 uv, float t) {
        // the front comes down the screen, bowed like a wave through a lattice
        float bow = 0.06 * sin(uv.x * 6.2831 + uTime * 1.5);
        float front = mix(-0.25, 1.25, t);
        float d = (1.0 - uv.y) - front + bow;     // < 0: already scanned
        float band = 0.22;
        float inBand = smoothstep(-band, 0.0, d) * (1.0 - smoothstep(0.0, 0.015, d));
        float done = 1.0 - smoothstep(-band, -band * 0.4, d);
        // before the front: the city; in its wake: edges and a lattice, then the new world
        vec3 base = mix(A(uv), B(uv), done);
        float w = d < -band * 0.5 ? 1.0 : 0.0;
        float e = edges(uv, w);
        vec2 g = abs(fract(uv * uRes / 22.0) - 0.5);
        float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
        vec2 dotc = abs(fract(uv * uRes / 22.0) - 0.5);
        float dots = smoothstep(0.12, 0.0, length(dotc));
        vec3 scan = vec3(0.02, 0.03, 0.06) + vec3(0.25, 0.85, 1.0) * e * 1.4 + vec3(0.35, 0.2, 1.0) * grid * 0.35 + vec3(0.6, 0.9, 1.0) * dots * 0.6;
        vec3 c = mix(base, scan, inBand);
        // the front itself: a bright line and a glow ahead of it
        c += vec3(0.4, 0.9, 1.0) * (smoothstep(0.012, 0.0, abs(d)) * 1.6 + smoothstep(0.08, 0.0, d) * step(0.0, d) * 0.25);
        // the part not yet scanned dims a little as it waits
        c *= 1.0 - 0.25 * step(0.0, d) * smoothstep(0.0, 0.3, t);
        return c;
      }

      /* ---------- 2: ascii decode ---------- */
      vec3 asciiDecode(vec2 uv, float t) {
        float env = smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.78, 1.0, t));
        float cs = mix(8.0, 14.0, env) ;
        vec2 cellPx = vec2(cs, cs * 1.6);
        vec2 cell = floor(uv * uRes / cellPx);
        vec2 cuv = (cell + 0.5) * cellPx / uRes;
        vec2 f = fract(uv * uRes / cellPx);
        // each character switches source at its own moment, in a sweep from the middle out
        float sw = h2(cell) * 0.35 + length(cuv - 0.5) * 0.5 + 0.12;
        float w = step(sw, t);
        vec3 src = pick(cuv, w);
        float l = clamp(luma(src) * 1.4, 0.0, 1.0);
        float gi = floor(l * 9.99);
        // near its switch, the character scrambles through code glyphs
        float near = 1.0 - smoothstep(0.0, 0.06, abs(t - sw));
        float step30 = floor(uTime * 30.0);
        gi = mix(gi, 10.0 + floor(h2(cell + step30) * 6.0), step(0.5, near * h2(cell * 3.1 + step30)));
        vec2 guv = vec2((gi + clamp(f.x, 0.08, 0.92)) / 16.0, 1.0 - f.y);
        float glyph = texture2D(tGlyph, guv).r;
        vec3 tint = mix(vec3(0.55, 1.0, 0.8), vec3(0.65, 0.85, 1.0), w);
        vec3 asc = glyph * mix(tint * (0.45 + l * 1.4), src * 2.2 + 0.2, 0.5) * (1.0 + near * 1.4);
        vec3 px = pick(uv, t > 0.5 ? 1.0 : 0.0);
        return mix(px, asc, env);
      }

      /* ---------- 3: crt reboot ---------- */
      vec3 crt(vec2 uv, float t) {
        vec2 c = uv - 0.5;
        vec3 col = vec3(0.0);
        if (t < 0.42) {
          // power off: squeeze to a bright line, then the line to a dot
          float sy = 1.0 - smoothstep(0.0, 0.2, t);
          float sx = 1.0 - smoothstep(0.2, 0.34, t);
          sy = max(sy, 0.004);
          sx = max(sx, 0.004);
          vec2 q = c / vec2(sx, sy) + 0.5;
          float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
          float boost = 1.0 + smoothstep(0.05, 0.22, t) * 6.0;
          col = A(q) * inside * boost;
          // the afterglow of the dot fading on the phosphor
          float dot = smoothstep(0.02, 0.0, length(c * vec2(uRes.x / uRes.y, 1.0))) * smoothstep(0.42, 0.3, t) * smoothstep(0.2, 0.34, t);
          col += vec3(0.8, 0.9, 1.0) * dot * 2.0;
        } else if (t > 0.55) {
          // boot: a line opens across, then the picture rolls open, overbright, and settles
          float k = (t - 0.55) / 0.45;
          float sx = smoothstep(0.0, 0.2, k);
          float sy = smoothstep(0.18, 0.55, k);
          sy = sy + sin(sy * 3.14159) * 0.06; // overshoot
          sx = max(sx, 0.002);
          sy = max(sy, 0.004);
          vec2 q = c / vec2(sx, sy) + 0.5;
          float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
          float settle = smoothstep(0.55, 1.0, k);
          // a rolling bar and wobble while the sync locks
          q.x += sin(q.y * 40.0 + uTime * 30.0) * 0.004 * (1.0 - settle);
          float roll = smoothstep(0.1, 0.0, abs(fract(q.y - uTime * 0.9) - 0.5)) * (1.0 - settle);
          vec3 b;
          float ca = 0.012 * (1.0 - settle);
          b.r = B(q + vec2(ca, 0.0)).r; b.g = B(q).g; b.b = B(q - vec2(ca, 0.0)).b;
          b *= 1.0 + (1.0 - settle) * 1.5 + roll * 0.4;
          b *= 0.85 + 0.15 * (1.0 - settle) * step(0.5, fract(q.y * uRes.y * 0.5)) + 0.15 * settle;
          col = b * inside;
        }
        return col;
      }

      void main() {
        float t = clamp(uMix, 0.0, 1.0);
        vec3 c;
        if (t <= 0.0001) c = A(vUv);
        else if (t >= 0.9999) c = B(vUv);
        else if (uMode == 0) c = signalLoss(vUv, t);
        else if (uMode == 1) c = neuralScan(vUv, t);
        else if (uMode == 2) c = asciiDecode(vUv, t);
        else c = crt(vUv, t);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  return pass;
}
