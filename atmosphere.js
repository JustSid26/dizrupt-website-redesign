import * as THREE from 'three';

/* =========================================================
   Background atmosphere: a slow dark colour gradient behind everything,
   plus a drift of dust particles through the scene. Both take their
   colour from the current slide, so the background shifts as you move.
   ========================================================= */
const DUST = 12000;
const SPREAD = { x: 44, y: 26, z: 30 }; // volume the dust drifts through
const DEPTH = -26; // the gradient sits far behind the models

const gradientShaders = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec2 vUv;
    uniform float uFade;
    void main() {
      float t = uTime * 0.05;
      // two soft pools of colour drifting slowly past each other
      float a = smoothstep(0.55, 0.0, distance(vUv, vec2(0.3 + 0.13 * sin(t), 0.34 + 0.1 * cos(t * 0.8))));
      float b = smoothstep(0.6, 0.0, distance(vUv, vec2(0.72 + 0.11 * cos(t * 0.7), 0.7 + 0.12 * sin(t * 0.9))));
      // kept very low: these values are lifted a lot when the frame is converted to screen colour
      vec3 col = uColorA * a * a * 0.02 + uColorB * b * b * 0.015;
      col += vec3(0.0012, 0.0012, 0.0028);   // never quite black
      col *= 0.45 + 0.55 * smoothstep(0.75, 0.15, distance(vUv, vec2(0.5))); // keep the corners black
      // a touch of noise, so the gradient doesn't band
      col += (fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.004;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

const dustShaders = {
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec3 uSpread;
    uniform float uDrift;
    attribute float aRandom;
    attribute float aSpeed;
    varying float vAlpha;
    varying float vTone;
    void main() {
      vec3 p = position;
      // drift upwards at its own pace and wrap round, swaying as it goes
      p.y = mod(p.y + uTime * aSpeed + uSpread.y * 0.5, uSpread.y) - uSpread.y * 0.5;
      /* uDrift slides the whole backdrop to the left, the nearer motes faster than the far ones.
         Nothing in the middle of the screen has to move for that to read as the middle of the
         screen travelling right — which is the point: the word stays exactly where it is. */
      p.x = mod(p.x - uTime * uDrift * (2.2 + aRandom * 5.5) + uSpread.x * 0.5, uSpread.x) - uSpread.x * 0.5;
      p.x += sin(uTime * 0.12 + aRandom * 40.0) * 0.6;
      p.z += cos(uTime * 0.09 + aRandom * 27.0) * 0.5;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.3 + aRandom * 3.2) * uPixelRatio * (8.0 / -mv.z);
      // fade the nearest and furthest motes, so they drift in and out of view
      float depth = -mv.z;
      vAlpha = (0.22 + 0.6 * fract(aRandom * 7.13)) * smoothstep(1.5, 5.0, depth) * smoothstep(42.0, 26.0, depth);
      vTone = fract(aRandom * 3.77);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uFade;
    varying float vAlpha;
    varying float vTone;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(mix(uColorA, uColorB, vTone), a * a * vAlpha * uFade);
    }`,
};

export function createAtmosphere({ scene, camera, colorA, colorB }) {
  const pixelRatio = Math.min(devicePixelRatio, 2);
  // uFade holds the whole backdrop back: the intro starts on flat black and only lets the
  // dust and the gradient in once the field starts moving.
  const shared = { uTime: { value: 0 }, uColorA: { value: colorA }, uColorB: { value: colorB }, uFade: { value: 1 }, uDrift: { value: 0 } };

  // --- gradient backdrop ---
  const dist = camera.position.z - DEPTH;
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
  const gradient = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({ ...gradientShaders, uniforms: shared, depthWrite: false, depthTest: false }),
  );
  gradient.position.z = DEPTH;
  gradient.renderOrder = -1000; // always first, so it replaces the empty black
  gradient.frustumCulled = false;
  scene.add(gradient);

  // --- drifting dust ---
  const positions = new Float32Array(DUST * 3);
  const randoms = new Float32Array(DUST);
  const speeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
    positions[i * 3 + 2] = -SPREAD.z * 0.75 + Math.random() * SPREAD.z;
    randoms[i] = Math.random();
    speeds[i] = 0.08 + Math.random() * 0.22;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
  dustGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    ...dustShaders,
    uniforms: { ...shared, uPixelRatio: { value: pixelRatio }, uSpread: { value: new THREE.Vector3(SPREAD.x, SPREAD.y, SPREAD.z) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  dust.renderOrder = -900;
  scene.add(dust);

  function resize() {
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - DEPTH);
    gradient.scale.set(h * camera.aspect * 1.1, h * 1.1, 1);
  }
  resize();

  function update(time) {
    shared.uTime.value = time;
    gradient.position.x = camera.position.x; // stay put behind the camera's small drift
    gradient.position.y = camera.position.y;
  }

  return {
    update, resize, gradient, dust,
    setFade: (v) => { shared.uFade.value = v; },
    setDrift: (v) => { shared.uDrift.value = v; },
  };
}
