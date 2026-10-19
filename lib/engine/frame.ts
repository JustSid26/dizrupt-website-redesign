import type * as THREE from 'three';

/** Fit the picture into part of the screen (signals.frame): `lift` px up, `shift` px left, scaled by
    `zoom` about the new centre. The full screen again once all are back to rest. */
export function applyFrame(camera: THREE.PerspectiveCamera, f: { lift: number; shift: number; zoom: number }) {
  if (Math.abs(f.lift) < 0.5 && Math.abs(f.shift) < 0.5 && Math.abs(f.zoom - 1) < 0.002) {
    if (camera.view?.enabled || camera.zoom !== 1) {
      camera.zoom = 1;
      camera.clearViewOffset(); // (updates the projection)
    }
    return;
  }
  camera.zoom = f.zoom;
  camera.setViewOffset(innerWidth, innerHeight, f.shift, f.lift, innerWidth, innerHeight); // (updates the projection)
}
