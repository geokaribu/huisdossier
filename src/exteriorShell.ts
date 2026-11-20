import * as THREE from "three";
import type { HouseAppearance, Point, Surface } from "./types.ts";
import { mainShellLayout } from "./houseFrame.ts";
import { projectAerial, projectMaterial } from "./appearance.ts";

/** Replaces explicitly selected BAG faces only in the visual reconstruction. */
export function exteriorShell(
  profile: HouseAppearance,
  origin: Point,
  surfaces: Surface[],
  wallMap: THREE.Texture | null = null,
  aerialMap: THREE.Texture | null = null,
) {
  const group = new THREE.Group(),
    layout = mainShellLayout(profile, origin, surfaces);
  if (!layout) return group;
  const wall = new THREE.MeshStandardMaterial({
    color: wallMap ? "#ffffff" : profile.materials.wall,
    map: wallMap,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const roof = new THREE.MeshStandardMaterial({
    color: aerialMap ? "#ffffff" : "#b5b6ad",
    map: aerialMap,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  function polygon(
    points: THREE.Vector3[],
    material: THREE.Material,
    role: string,
    type = "WallSurface",
  ) {
    const center = new THREE.Vector3(
      layout!.width / 2,
      layout!.top / 2,
      (layout!.left.z + layout!.right.z) / 4,
    );
    const faceCenter = points
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / points.length);
    const normal = points[1]
      .clone()
      .sub(points[0])
      .cross(points[2].clone().sub(points[0]));
    if (normal.dot(faceCenter.sub(center)) < 0) points = [...points].reverse();
    // All faces are planar convex quads here; the source wall's lower edge may slope.
    const positions = [];
    for (let i = 1; i < points.length - 1; i++)
      for (const p of [points[0], points[i], points[i + 1]])
        positions.push(...p.clone().applyMatrix4(layout!.matrix).toArray());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeVertexNormals();
    if (type === "RoofSurface" && profile.aerial && aerialMap)
      projectAerial(geometry, profile.aerial, origin);
    else projectMaterial(geometry, profile, origin, type === "RoofSurface");
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { role, isTarget: true, surfaceType: type };
    group.add(mesh);
  }
  const { left, right, top, frontTop, ridgeLeft, ridgeRight, width } = layout;
  for (const [x, ridge, rear] of [
    [0, ridgeLeft, left],
    [width, ridgeRight, right],
  ] as const) {
    const base = new THREE.Vector3(x, 0, 0),
      ridgeBase = ridge.clone().setY(0),
      backBase = rear.clone().setY(0);
    polygon(
      [base, ridgeBase, ridge, new THREE.Vector3(x, frontTop, 0)],
      wall,
      "main-sloping-cheek",
    );
    polygon(
      [ridgeBase, backBase, rear.clone().setY(top), ridge],
      wall,
      "main-side-wall",
    );
  }
  polygon(
    [left, right, right.clone().setY(top), left.clone().setY(top)],
    wall,
    "main-rear-wall",
  );
  polygon(layout.roof, roof, "main-flat-roof", "RoofSurface");
  const base = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(width, 0, 0),
    ridgeRight.clone().setY(0),
    right.clone().setY(0),
    left.clone().setY(0),
    ridgeLeft.clone().setY(0),
  ];
  const shape = new THREE.Shape(base.map((p) => new THREE.Vector2(p.x, -p.z)));
  const foundation = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    steps: 1,
    bevelEnabled: false,
  });
  foundation
    .rotateX(-Math.PI / 2)
    .translate(0, -0.12, 0)
    .applyMatrix4(layout.matrix);
  const footing = new THREE.Mesh(foundation, wall);
  footing.castShadow = footing.receiveShadow = true;
  footing.userData = {
    role: "main-foundation",
    isTarget: true,
    surfaceType: "GroundSurface",
  };
  group.add(footing);
  return group;
}
