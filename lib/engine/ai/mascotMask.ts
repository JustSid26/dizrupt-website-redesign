import * as THREE from 'three';

/* The mascot's upper body as a picture for the transition: his bust point cloud, drawn once from the
   front into a small texture, each point a soft dot added on top of the others, so where he's dense
   (his outline, his face) it's bright and his silhouette has some shape inside it. The transition
   spells him out in purple 0s and 1s from it. Square, with his bust filling its height. */
export function mascotMask(renderer: THREE.WebGLRenderer, points: THREE.BufferAttribute) {
  const S = 512;
  const rt = new THREE.WebGLRenderTarget(S, S, { type: THREE.HalfFloatType });
  const box = new THREE.Box3().setFromBufferAttribute(points);
  const h = box.max.y - box.min.y;
  const cy = (box.max.y + box.min.y) / 2;
  const cam = new THREE.OrthographicCamera(-h / 2, h / 2, cy + h / 2, cy - h / 2, -50, 50);
  cam.position.z = 10;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', points);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 7.0; }`,
    fragmentShader: /* glsl */ `void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(smoothstep(0.5, 0.0, d) * 0.22), 1.0); }`,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Points(geo, mat));
  const prev = renderer.getRenderTarget();
  const clear = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(0x000000, clear);
  geo.dispose();
  mat.dispose();
  return rt.texture;
}
