import * as THREE from 'three';
import { COUNT, TRANSITION_MS } from './config';
import { vertexShader, fragmentShader } from './fieldShaders';
import { SHAPES } from './shapes';

/* The particle field: COUNT points that morph from wherever they are into any shape. Every shape on
   the site — the mascot, the six solutions, each client's model — is a target for the same points,
   so nothing ever cuts: it re-forms.

   Each particle carries its start (position) and its target (aTarget); uProgress runs 0 → 1 with a
   staggered, quintic ease and a bow out along the way. Interrupting a morph freezes the current
   positions on the CPU (particleAt mirrors the vertex shader) so it never pops. */
type Target = THREE.BufferAttribute & { edge?: THREE.BufferAttribute };

export class ParticleField {
  readonly randoms = new Float32Array(COUNT);
  readonly geometry = new THREE.BufferGeometry();
  readonly group = new THREE.Group();
  readonly points: THREE.Points;
  readonly ghosts: THREE.Points[];
  readonly from: THREE.BufferAttribute;
  readonly uniforms;
  private flatEdge = new THREE.BufferAttribute(new Float32Array(COUNT), 1);
  private shapes = new Map<string, Target>();
  private tween = { t0: 0, ms: TRANSITION_MS, on: false };
  colorA = new THREE.Color('#c9b8ff');
  colorB = new THREE.Color('#6f4dff');

  constructor(pixelRatio: number) {
    for (let i = 0; i < COUNT; i++) this.randoms[i] = Math.random();
    this.from = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
    this.from.setUsage(THREE.DynamicDrawUsage);
    const g = this.geometry;
    g.setAttribute('position', this.from);
    g.setAttribute('aTarget', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aEdge', this.flatEdge);
    g.setAttribute('aRandom', new THREE.BufferAttribute(this.randoms, 1));
    g.setAttribute('aHead', new THREE.BufferAttribute(new Float32Array(COUNT), 1));

    this.uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 1 },
      uArcStrength: { value: 1 },
      uDisperse: { value: 0 },
      uCoil: { value: 0 },
      uHeadOn: { value: 0 },
      uHeadYaw: { value: 0 },
      uHeadPitch: { value: 0 },
      uHeadPivot: { value: new THREE.Vector3() },
      uGlitch: { value: 0 },
      uGlitchSeed: { value: 0 },
      uGlitchLayer: { value: 0 },
      uBodyReveal: { value: 1 },
      uEyeReveal: { value: 1 },
      uKindle: { value: 1 },
      uSize: { value: 22 },
      uPixelRatio: { value: pixelRatio },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
      uMouseStrength: { value: 0 },
      uOpacity: { value: 0 },
      uColorA: { value: new THREE.Color('#c9b8ff') },
      uColorB: { value: new THREE.Color('#6f4dff') },
      uSplit: { value: 0 },
      uAurora: { value: 0 },
      uBeam: { value: -9 },
      uBeamOn: { value: 0 },
      uBustHalf: { value: 1 },
    };
    const make = (layer: number) => {
      const m = new THREE.ShaderMaterial({
        uniforms: layer ? { ...this.uniforms, uGlitchLayer: { value: layer } } : this.uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      return p;
    };
    this.points = make(0);
    // misregistered colour plates, drawn only during a glitch burst
    this.ghosts = [make(1), make(2)];
    this.ghosts.forEach((p) => (p.visible = false));
    this.group.add(this.points, ...this.ghosts);
  }

  /** A shape by name, built once and kept. */
  shape(name: string): Target {
    let a = this.shapes.get(name);
    if (!a) {
      const arr = new Float32Array(COUNT * 3);
      (SHAPES[name as keyof typeof SHAPES] || SHAPES.wordmark)(arr);
      a = new THREE.BufferAttribute(arr, 3);
      this.shapes.set(name, a);
    }
    return a;
  }
  register(name: string, attr: Target) {
    this.shapes.set(name, attr);
  }

  get target(): Target {
    return this.geometry.attributes.aTarget as Target;
  }

  /** Point the field at a shape, with the rim light that belongs to it. */
  private setTarget(attr: Target) {
    this.geometry.setAttribute('aTarget', attr);
    this.geometry.setAttribute('aEdge', attr.edge || this.flatEdge);
  }

  /** Be the shape now, no travel. */
  place(attr: Target) {
    this.from.array.set(attr.array);
    this.from.needsUpdate = true;
    this.setTarget(attr);
    this.uniforms.uProgress.value = 1;
    this.tween.on = false;
  }

  /** Where particle i is at progress `prog`, written into `from` — mirrors the vertex shader. */
  private particleAt(i: number, prog: number, from: Float32Array, to: ArrayLike<number>) {
    const r = this.randoms[i];
    const i3 = i * 3;
    const fract = (x: number) => x - Math.floor(x);
    const t = Math.min(Math.max((prog - r * 0.35) / 0.65, 0), 1);
    const p = t * t * t * (t * (t * 6 - 15) + 10);
    const arc = Math.sin(p * Math.PI) * this.uniforms.uArcStrength.value;
    const x = from[i3] + (to[i3] - from[i3]) * p + (fract(r * 12.9898) - 0.5) * arc * 1.6;
    const y = from[i3 + 1] + (to[i3 + 1] - from[i3 + 1]) * p + (fract(r * 78.233) - 0.5) * arc * 1.6;
    const z = from[i3 + 2] + (to[i3 + 2] - from[i3 + 2]) * p + (fract(r * 37.719) - 0.5) * arc * 1.6;
    const c = Math.cos(arc * 0.6);
    const sn = Math.sin(arc * 0.6);
    from[i3] = c * x - sn * z;
    from[i3 + 1] = y;
    from[i3 + 2] = sn * x + c * z;
  }

  /** Morph from wherever the particles are right now into `attr`. `ms` null: the caller scrubs uProgress. */
  morphTo(attr: Target, ms: number | null = TRANSITION_MS, arc = 1) {
    if (attr === this.target && this.uniforms.uProgress.value >= 1) return;
    const from = this.from.array as Float32Array;
    const to = this.target.array;
    const prog = this.uniforms.uProgress.value;
    if (prog >= 1) from.set(to);
    else for (let i = 0; i < COUNT; i++) this.particleAt(i, prog, from, to);
    this.from.needsUpdate = true;
    this.setTarget(attr);
    this.uniforms.uProgress.value = 0;
    this.uniforms.uArcStrength.value = arc;
    this.tween.t0 = performance.now();
    this.tween.ms = ms ?? 0;
    this.tween.on = ms !== null;
  }

  get morphing() {
    return this.tween.on;
  }

  update(now: number, time: number, dt: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    if (this.tween.on) {
      const raw = Math.min((now - this.tween.t0) / this.tween.ms, 1);
      u.uProgress.value = raw;
      if (raw >= 1) this.tween.on = false;
    }
    const k = 1 - Math.exp(-1.8 * dt);
    u.uColorA.value.lerp(this.colorA, k);
    u.uColorB.value.lerp(this.colorB, k);
    const plates = u.uAurora.value > 0.02 && u.uGlitch.value > 0.015;
    this.ghosts.forEach((g) => (g.visible = plates));
  }
}
