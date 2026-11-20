import * as THREE from "three";
import type { Point, Surface } from "./types";

export function triangulateSurface(
  surface: Surface,
  origin: Point,
): THREE.BufferGeometry | null {
  const rings = surface.rings.map((ring) => {
    const points = ring.map(
      (p) =>
        new THREE.Vector3(
          p[0] - origin[0],
          p[2] - origin[2],
          -(p[1] - origin[1]),
        ),
    );
    if (
      points.length > 1 &&
      points[0].distanceToSquared(points[points.length - 1]) < 1e-12
    )
      points.pop();
    return points;
  });
  if (!rings[0] || rings[0].length < 3) return null;
  // Newell normal: stable for concave polygons, independent of the first three vertices.
  const normal = new THREE.Vector3();
  const outer = rings[0];
  for (let i = 0; i < outer.length; i++) {
    const p = outer[i],
      q = outer[(i + 1) % outer.length];
    normal.x += (p.y - q.y) * (p.z + q.z);
    normal.y += (p.z - q.z) * (p.x + q.x);
    normal.z += (p.x - q.x) * (p.y + q.y);
  }
  if (normal.lengthSq() < 1e-15) return null;
  const dominant = [
    Math.abs(normal.x),
    Math.abs(normal.y),
    Math.abs(normal.z),
  ].indexOf(
    Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)),
  );
  const project = (p: THREE.Vector3) =>
    dominant === 0
      ? new THREE.Vector2(p.y, p.z)
      : dominant === 1
        ? new THREE.Vector2(p.x, p.z)
        : new THREE.Vector2(p.x, p.y);
  const faces = THREE.ShapeUtils.triangulateShape(
    outer.map(project),
    rings.slice(1).map((r) => r.map(project)),
  );
  if (!faces.length) return null;
  const vertices = rings.flat();
  // Earcut's 2D winding depends on the chosen projection axis. Restore the
  // source polygon orientation so lighting/shadow normal offsets face outward.
  for (const face of faces) {
    const a = vertices[face[0]],
      b = vertices[face[1]],
      c = vertices[face[2]];
    const faceNormal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a));
    if (faceNormal.dot(normal) < 0) [face[1], face[2]] = [face[2], face[1]];
  }
  const positions = faces.flatMap((face) =>
    face.flatMap((index) => vertices[index].toArray()),
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}
