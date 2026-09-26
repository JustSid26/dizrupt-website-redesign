import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* =========================================================
   The hand-over between the city and the AI world, done on the
   real pixels of both: tDiffuse is the city as it was drawn this
   frame, tAi the AI world. uMix runs 0 → 1 (and back, on the way
   out), uMode picks the transition:

   0  Signal loss   the picture fails: macroblocks, datamosh smear,
                    torn scanlines, channels apart; the new world
                    comes through the corruption block by block
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
  { id: 'signal', name: 'Signal loss', duration: 1.7 },
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
      uMix: { value: 0 },
      uMode: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 1.0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse, tAi, tGlyph;
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

      /* ---------- 0: signal loss ---------- */
      vec3 signalLoss(vec2 uv, float t) {
        float env = sin(3.14159 * t);
        float step20 = floor(uTime * 22.0);
        // torn rows: whole bands of the picture jump sideways
        float row = floor(uv.y * mix(40.0, 14.0, h1(step20)));
        float tear = step(1.0 - env * 0.45, h2(vec2(row, step20)));
        uv.x += tear * (h2(vec2(row, step20 + 3.0)) - 0.5) * 0.35 * env;
        // macroblocks, sized like a failing codec's
        float bs = mix(12.0, 48.0, h1(step20 * 0.37 + 1.0));
        vec2 cell = floor(uv * uRes / bs);
        float r = h2(cell);
        float rt = h2(cell + step20);
        // which picture each block shows: the new one arrives block by block, flickering at the edge
        float reveal = step(r, t * 1.25 - 0.12 + (rt - 0.5) * 0.25 * env);
        // datamosh: blocks drag last frame's motion, smearing the picture along a vector
        vec2 mv = (vec2(h2(cell + 7.0), h2(cell + 13.0)) - 0.5) * 0.12 * env * step(0.55, rt);
        vec2 suv = uv - mv;
        // channels apart, further in the torn bands
        float ca = (0.006 + tear * 0.03) * env;
        vec3 c;
        c.r = pick(suv + vec2(ca, 0.0), reveal).r;
        c.g = pick(suv, reveal).g;
        c.b = pick(suv - vec2(ca, 0.0), reveal).b;
        // stuck blocks: flat colour from the block's corner, the codec giving up
        float stuck = step(1.0 - env * 0.18, rt);
        c = mix(c, pick(cell * bs / uRes, reveal) * 1.3, stuck);
        // bit rot: posterize and occasional inverted blocks at the peak
        c = mix(c, floor(c * 5.0) / 5.0, env * 0.6);
        c = mix(c, 1.0 - c, step(0.985 - env * 0.03, rt) * env);
        // snow and scanlines
        c += (h2(uv * uRes + uTime) - 0.5) * 0.25 * env;
        c *= 1.0 - 0.18 * env * step(0.5, fract(uv.y * uRes.y * 0.5));
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
