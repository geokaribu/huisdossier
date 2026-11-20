import * as THREE from "three";
import type { Asset } from "./types.ts";

/** Dossier identity is semantic and stable; it never uses triangle or mesh indices. */
export function spatialAsset(
  object: THREE.Object3D,
  houseId: string,
  assets: Asset[],
): Asset | undefined {
  const chain: THREE.Object3D[] = [];
  for (let node: THREE.Object3D | null = object; node; node = node.parent)
    chain.push(node);
  if (chain.some((node) => node.userData.isTarget === false)) return;
  for (const node of chain) {
    if (typeof node.userData.assetId === "string")
      return assets.find((asset) => asset.id === node.userData.assetId);
    if (typeof node.userData.roomId === "string")
      return assets.find(
        (asset) =>
          asset.kind === "ruimte" && asset.roomId === node.userData.roomId,
      );
  }
  if (!chain.some((node) => node.userData.isTarget === true)) return;
  const surface = chain.find(
    (node) => typeof node.userData.surfaceType === "string",
  )?.userData.surfaceType;
  const slug =
    surface === "RoofSurface"
      ? "roof"
      : surface === "WallSurface"
        ? "facade"
        : "building";
  return assets.find((asset) => asset.id === `${houseId}:${slug}`);
}

export function visibleSpatialHit(
  hits: THREE.Intersection[],
): THREE.Intersection | undefined {
  return hits.find((hit) => {
    if (!(hit.object instanceof THREE.Mesh)) return false;
    for (let node: THREE.Object3D | null = hit.object; node; node = node.parent)
      if (!node.visible) return false;
    const material = Array.isArray(hit.object.material)
      ? hit.object.material[hit.face?.materialIndex ?? 0]
      : hit.object.material;
    if (!material?.visible) return false;
    const planes = material.clippingPlanes ?? [];
    const clipped = planes.map(
      (plane: THREE.Plane) => plane.distanceToPoint(hit.point) < 0,
    );
    return (
      !clipped.length ||
      !(material.clipIntersection
        ? clipped.every(Boolean)
        : clipped.some(Boolean))
    );
  });
}

function objectVisible(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

/** Track the whole gesture: dragging back to the start and pinching are not taps. */
export class SpatialTap {
  private pointers = new Map<number, [number, number]>();
  private moved = false;
  down(
    event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY" | "button">,
  ) {
    if (!this.pointers.size) this.moved = false;
    if (event.button !== 0 || this.pointers.size) this.moved = true;
    this.pointers.set(event.pointerId, [event.clientX, event.clientY]);
  }
  move(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    const start = this.pointers.get(event.pointerId);
    if (
      start &&
      Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5
    )
      this.moved = true;
  }
  up(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    this.move(event);
    const tap =
      this.pointers.has(event.pointerId) &&
      this.pointers.size === 1 &&
      !this.moved;
    this.pointers.delete(event.pointerId);
    return tap;
  }
  cancel(event: Pick<PointerEvent, "pointerId">) {
    this.moved = true;
    this.pointers.delete(event.pointerId);
  }
}

/** Each outline owns only its edge buffers, never the original geometry/materials. */
export function selectionOutline(
  objects: THREE.Mesh[],
  houseId: string,
  assets: Asset[],
  selectedId: string,
) {
  const group = new THREE.Group();
  for (const mesh of objects) {
    if (spatialAsset(mesh, houseId, assets)?.id !== selectedId) continue;
    if (!objectVisible(mesh)) continue;
    mesh.updateWorldMatrix(true, false);
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 35),
      new THREE.LineBasicMaterial({
        color: "#F8891E",
        depthTest: true,
        clippingPlanes: material.clippingPlanes,
        clipIntersection: material.clipIntersection,
      }),
    );
    outline.applyMatrix4(mesh.matrixWorld);
    outline.renderOrder = 3;
    group.add(outline);
  }
  return group;
}
