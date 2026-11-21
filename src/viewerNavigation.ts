import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Discrete camera actions provide the same operations as dragging. */
export function nudgeCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  x: number,
  y: number,
  pan = false,
) {
  const offset = camera.position.clone().sub(controls.target);
  if (pan) {
    const shift = new THREE.Vector3(x, -y, 0)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(offset.length() * 0.12);
    camera.position.add(shift);
    controls.target.add(shift);
  } else {
    const orbit = new THREE.Spherical().setFromVector3(offset);
    orbit.theta += (x * Math.PI) / 12;
    orbit.phi = THREE.MathUtils.clamp(
      orbit.phi + (y * Math.PI) / 18,
      Math.max(0.01, controls.minPolarAngle),
      Math.min(Math.PI - 0.01, controls.maxPolarAngle),
    );
    camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
  }
  controls.update();
}

export function zoomCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  factor: number,
) {
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(
    offset.length() * factor,
    controls.minDistance,
    controls.maxDistance,
  );
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}
