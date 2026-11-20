import * as THREE from "three";
import type { Floorplan, PlanDecoration } from "./types";

export function loadArtworkTextures(plan: Floorplan, onLoad: () => void) {
  const maps = new Map<string, THREE.Texture>();
  for (const item of plan.decorations ?? []) {
    const source = item.artwork;
    if (!source || maps.has(source.texture)) continue;
    const map = new THREE.TextureLoader().load(source.texture, onLoad);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    maps.set(source.texture, map);
  }
  return maps;
}

/** A recessed canvas in continuous mitred mouldings; local +Z faces the room. */
export function framedArtwork(
  item: PlanDecoration,
  maps: Map<string, THREE.Texture> = new Map(),
) {
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  group.userData.componentId = item.id;
  group.userData.role = "picture-frame";
  const [w, d] = item.size,
    h = item.height;
  const border = Math.min(w, h) * 0.1;
  const wood = new THREE.MeshStandardMaterial({
    color: item.color ?? "#382b21",
    roughness: 0.65,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#181b17",
    roughness: 0.7,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: "#997444",
    roughness: 0.38,
    metalness: 0.45,
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), dark);
  backing.position.set(0, h / 2, -d / 2 + 0.006);
  backing.castShadow = true;
  group.add(backing);
  function ring(
    inset: number,
    width: number,
    depth: number,
    front: number,
    material: THREE.Material,
  ) {
    const left = -w / 2 + inset,
      right = w / 2 - inset,
      bottom = inset,
      top = h - inset;
    const shape = new THREE.Shape([
      new THREE.Vector2(left, bottom),
      new THREE.Vector2(right, bottom),
      new THREE.Vector2(right, top),
      new THREE.Vector2(left, top),
    ]);
    shape.holes.push(
      new THREE.Path([
        new THREE.Vector2(left + width, bottom + width),
        new THREE.Vector2(left + width, top - width),
        new THREE.Vector2(right - width, top - width),
        new THREE.Vector2(right - width, bottom + width),
      ]),
    );
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.001,
        bevelSize: 0.001,
        bevelSegments: 1,
        steps: 1,
      }),
      material,
    );
    mesh.position.z = front - depth;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = "frame-moulding";
    group.add(mesh);
  }
  ring(0, border * 0.17, d * 0.8, d * 0.3, dark);
  ring(border * 0.17, border * 0.08, d * 0.65, d * 0.4, gold);
  ring(border * 0.25, border * 0.36, d * 0.7, d * 0.3, wood);
  ring(border * 0.61, border * 0.08, d * 0.8, d * 0.5, gold);
  ring(border * 0.69, border * 0.2, d * 0.45, d * 0.1, dark);
  ring(border * 0.89, border * 0.11, d * 0.6, d * 0.35, gold);
  for (const y of [border * 0.43, h - border * 0.43]) {
    const plaque = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), gold);
    plaque.scale.set(w * 0.065, border * 0.11, 0.004);
    plaque.position.set(0, y, d * 0.31);
    group.add(plaque);
  }
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(w - border * 2, h - border * 2),
    new THREE.MeshStandardMaterial({
      color: item.artwork ? "#ffffff" : "#4a5140",
      map: item.artwork ? (maps.get(item.artwork.texture) ?? null) : null,
      roughness: 0.92,
    }),
  );
  canvas.position.set(0, h / 2, 0);
  canvas.receiveShadow = true;
  canvas.userData.role = "artwork-canvas";
  group.add(canvas);
  return group;
}
