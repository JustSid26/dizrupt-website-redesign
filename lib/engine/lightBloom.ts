import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import type { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* The glow round the city's lights (and the AI world's), for a fraction of a bloom's work. The bright
   parts of the picture are taken down to a quarter-size copy and blurred there, then again at a
   sixteenth and a sixty-fourth: a tight glow, a wider one and a haze, the three a bloom adds up from
   its five, added together again on the small pictures. Every pass is drawn on a small picture. The
   last step, adding it back onto the whole picture, is not a pass of its own: the output pass, which
   reads every pixel anyway, adds it as it goes, one texture read a pixel (glowInOutput, below). Where
   there is no output pass after it (the AI world's own picture), `composite` adds it with one pass. */

const vertexShader = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// the bright parts only (a glint held under `uClamp`, so one pinpoint can't flare), averaged down
const brightShader = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uThreshold, uClamp;
  varying vec2 vUv;
  vec3 bright(vec3 c) {
    c *= min(1.0, uClamp / max(max(c.r, max(c.g, c.b)), 1e-4));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return c * smoothstep(uThreshold, uThreshold + 0.1, l);
  }
  void main() {
    // four taps, each the filtering's average of four texels
    vec3 s = bright(texture2D(tSrc, vUv + vec2(-0.25, -0.25) * uTexel).rgb) + bright(texture2D(tSrc, vUv + vec2(0.25, -0.25) * uTexel).rgb)
           + bright(texture2D(tSrc, vUv + vec2(-0.25, 0.25) * uTexel).rgb) + bright(texture2D(tSrc, vUv + vec2(0.25, 0.25) * uTexel).rgb);
    gl_FragColor = vec4(s * 0.25, 1.0);
  }`;
// a quarter the size again: four taps, each four texels' average
const downShader = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }`;
// a gaussian nine texels wide, one way, in five taps (each between two texels: the filtering does the rest)
const blurShader = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
    c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
    c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;
// a wider glow added into the next finer one (drawn additively), so the last step reads only one
const upShader = /* glsl */ `
  uniform sampler2D tSrc;
  uniform float uScale;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uScale, 1.0); }`;
const GLOW_SUM = /* glsl */ `texture2D(tGlow, vUv).rgb * (uGlow * uGlowGain)`;
const compositeShader = /* glsl */ `
  uniform sampler2D tGlow;
  uniform float uGlow, uGlowGain;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(${GLOW_SUM}, 1.0); }`;

const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false, ...extra });

export class LightBloomPass extends Pass {
  /** how strong, and how much of each of the three (tight, wide, haze) */
  strength: number;
  weights: THREE.Vector3;
  private composite: boolean;
  private levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[];
  private quad = new FullScreenQuad();
  private bright: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private comp: THREE.ShaderMaterial | null;
  private gain = { value: 1 }; // (strength × the tight glow's weight: the others are added in at theirs)

  constructor(o: { strength: number; threshold: number; weights: [number, number, number]; clamp?: number; composite?: boolean }) {
    super();
    this.needsSwap = false; // (the picture passes through untouched; the glow is beside it)
    this.strength = o.strength;
    this.weights = new THREE.Vector3(...o.weights);
    this.composite = !!o.composite;
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.levels = [0, 1, 2].map(() => ({ a: rt(), b: rt() }));
    this.bright = mat(brightShader, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: o.threshold }, uClamp: { value: o.clamp ?? 1e4 } });
    this.down = mat(downShader, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.blur = mat(blurShader, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.up = mat(upShader, { tSrc: { value: null }, uScale: { value: 1 } }, { transparent: true, blending: THREE.AdditiveBlending });
    this.comp = this.composite
      ? mat(compositeShader, { ...this.glowUniforms() }, { transparent: true, blending: THREE.AdditiveBlending })
      : null;
    this.setSize();
  }

  /** the glow, for a shader that adds it (glowInOutput): uGlow is how much (the caller's), uGlowGain the pass's */
  glowUniforms() {
    return { tGlow: { value: this.levels[0].a.texture }, uGlow: { value: 0 }, uGlowGain: this.gain };
  }

  /** (sized by the CSS picture, not the device's: the glow's spread is the same at any resolution) */
  setSize() {
    let w = Math.max(1, Math.ceil(innerWidth / 4)), h = Math.max(1, Math.ceil(innerHeight / 4));
    for (const l of this.levels) {
      l.a.setSize(w, h);
      l.b.setSize(w, h);
      w = Math.max(1, Math.ceil(w / 4));
      h = Math.max(1, Math.ceil(h / 4));
    }
  }

  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    const draw = (m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      this.quad.material = m;
      renderer.setRenderTarget(target);
      this.quad.render(renderer);
    };
    this.levels.forEach((l, k) => {
      const w = l.a.width, h = l.a.height;
      if (k === 0) {
        this.bright.uniforms.tSrc.value = read.texture;
        this.bright.uniforms.uTexel.value.set(1 / w, 1 / h);
        draw(this.bright, l.a);
      } else {
        const p = this.levels[k - 1].a;
        this.down.uniforms.tSrc.value = p.texture;
        this.down.uniforms.uTexel.value.set(1 / p.width, 1 / p.height);
        draw(this.down, l.a);
      }
      this.blur.uniforms.tSrc.value = l.a.texture;
      this.blur.uniforms.uDir.value.set(1 / w, 0);
      draw(this.blur, l.b);
      this.blur.uniforms.tSrc.value = l.b.texture;
      this.blur.uniforms.uDir.value.set(0, 1 / h);
      draw(this.blur, l.a);
    });
    // the haze into the wide glow, the wide glow into the tight one, each at its weight to the next
    const w = this.weights;
    for (const [k, scale] of [[1, w.z / w.y], [0, w.y / w.x]] as const) {
      this.up.uniforms.tSrc.value = this.levels[k + 1].a.texture;
      this.up.uniforms.uScale.value = scale;
      draw(this.up, this.levels[k].a);
    }
    this.gain.value = this.strength * w.x;
    if (this.comp) {
      this.comp.uniforms.uGlow.value = 1;
      draw(this.comp, this.renderToScreen ? null : read);
    }
    renderer.autoClear = autoClear;
  }

  dispose() {
    for (const l of this.levels) { l.a.dispose(); l.b.dispose(); }
    for (const m of [this.bright, this.down, this.blur, this.up, this.comp]) m?.dispose();
    this.quad.dispose();
  }
}

/**
 * The output pass, adding a LightBloomPass's glow to every pixel as it tone-maps it: the glow costs
 * one small texture read a pixel there, not a pass of its own. Returns the strength to set each
 * frame (0: none, and the pass that makes it can be switched off).
 */
export function glowInOutput(output: OutputPass, bloom: LightBloomPass) {
  const u = bloom.glowUniforms();
  Object.assign(output.uniforms, u);
  const m = output.material;
  const a = 'uniform sampler2D tDiffuse;', b = 'gl_FragColor = texture2D( tDiffuse, vUv );';
  if (!m.fragmentShader.includes(a) || !m.fragmentShader.includes(b)) throw new Error('glowInOutput: OutputShader has changed');
  m.fragmentShader = m.fragmentShader
    .replace(a, `${a}\nuniform sampler2D tGlow;\nuniform float uGlow, uGlowGain;`)
    .replace(b, `${b}\nif (uGlow > 0.0) gl_FragColor.rgb += ${GLOW_SUM};`);
  m.needsUpdate = true;
  return u.uGlow;
}
