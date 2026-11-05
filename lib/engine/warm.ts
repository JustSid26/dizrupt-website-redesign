import * as THREE from 'three';

/* Everything a scene will ever draw, drawn once now, while the page is still loading, so no frame of a
   ride pays for something the first time it shows it. Compiling a material isn't all of it: the first
   time a thing is really drawn its geometry and pictures go up to the GPU, and the graphics driver
   builds the pipeline for that program in that state (its blending, its vertex layout, the buffer it
   draws into: Metal's and Direct3D's are made at the draw, not at the compile). So: every object, hidden
   or out of view, drawn once into a few pixels' corner of the buffer it will be drawn into, and then
   put back as it was. The pixels it leaves there are drawn over by the next frame. */
export function drawAll(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) {
  const shown: THREE.Object3D[] = [], unculled: THREE.Object3D[] = [], mats: THREE.Material[] = [];
  scene.traverse((o) => {
    if (!o.visible) { o.visible = true; shown.push(o); }
    if (o.frustumCulled) { o.frustumCulled = false; unculled.push(o); }
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) if (!mat.visible) { mat.visible = true; mats.push(mat); }
  });
  const prev = renderer.getRenderTarget();
  // (the screen itself: its scissor is the renderer's own)
  const scissor = target ? target.scissor.clone() : renderer.getScissor(new THREE.Vector4()), scissorTest = target ? target.scissorTest : renderer.getScissorTest();
  if (target) { target.scissor.set(0, 0, 2, 2); target.scissorTest = true; } else { renderer.setScissor(0, 0, 2, 2); renderer.setScissorTest(true); }
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    if (target) { target.scissor.copy(scissor); target.scissorTest = scissorTest; } else { renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); }
    renderer.setRenderTarget(prev);
    shown.forEach((o) => (o.visible = false));
    unculled.forEach((o) => (o.frustumCulled = true));
    mats.forEach((mat) => (mat.visible = false));
  }
}

/* Its shaders compiled into that buffer's kind (the same material drawn to the screen is another
   program), without holding the page up: where the browser can (KHR_parallel_shader_compile, nearly
   all of them) the driver compiles them on its own threads while the count keeps counting, and this
   resolves once they are done. */
export function compileFor(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null) {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  const done = renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(prev);
  return done;
}

/** A frame's breath: the count, and anything else the page has to show, gets to draw between the steps
    (or, in a tab in the background, which draws no frames, a moment: it mustn't wait for one). */
export const breathe = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });
