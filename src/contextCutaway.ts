import * as THREE from "three";

/** Cut context between the camera and the actual house hit, without cutting its shadows. */
export function contextCutaway(
  context: THREE.Group,
  houseMeshes: () => THREE.Object3D[],
) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 0), 1),
    probe = new THREE.Raycaster();
  context.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material]) {
        material.clippingPlanes = [plane];
        material.clipShadows = false;
      }
  });
  return (camera: THREE.Camera, target: THREE.Vector3) => {
    plane.setComponents(0, 0, 0, 1);
    if (!context.visible) return false;
    const direction = target.clone().sub(camera.position).normalize();
    probe.set(camera.position, direction);
    const house = probe.intersectObjects(houseMeshes(), false)[0];
    if (!house) return false;
    const neighbor = probe.intersectObject(context, true)[0];
    if (!neighbor || neighbor.distance >= house.distance - 0.05) return false;
    plane.setFromNormalAndCoplanarPoint(
      direction,
      house.point.clone().addScaledVector(direction, -0.1),
    );
    return true;
  };
}
