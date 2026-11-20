export function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function containsPoint(point, polygon) {
  return (
    insideRing(point, polygon[0]) &&
    !polygon.slice(1).some((ring) => insideRing(point, ring))
  );
}
export function interiorPoint(polygon) {
  const ring = polygon[0],
    xs = ring.map((p) => p[0]),
    ys = ring.map((p) => p[1]);
  const mid = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  if (containsPoint(mid, polygon)) return mid;
  for (let y = 1; y < 20; y++)
    for (let x = 1; x < 20; x++) {
      const p = [
        Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * x) / 20,
        Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * y) / 20,
      ];
      if (containsPoint(p, polygon)) return p;
    }
  throw Error("Geen binnenpunt in gebouwcontour gevonden.");
}
export function numberValue(value) {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) throw Error("Ongeldige bronhoogte");
  return n;
}

/** LoD1 extrusion of the source polygon, including holes; no invented roof form. */
export function extrudeFootprint(polygon, ground, height) {
  if (
    !Number.isFinite(ground) ||
    !Number.isFinite(height) ||
    height <= 0 ||
    height > 100
  )
    throw Error("Ongeldige gebouwhoogte");
  const rings = polygon.map((ring, index) => {
    const points = ring.map((p) => [p[0], p[1]]);
    if (
      points.length > 1 &&
      points[0][0] === points.at(-1)[0] &&
      points[0][1] === points.at(-1)[1]
    )
      points.pop();
    if (points.length < 3) throw Error("Ongeldige gebouwcontour");
    const area = points.reduce((s, a, i) => {
      const b = points[(i + 1) % points.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
    return (index === 0 ? area < 0 : area > 0) ? points.reverse() : points;
  });
  const at = (ring, z) => ring.map((p) => [p[0], p[1], +z.toFixed(3)]);
  const surfaces = [
    {
      type: "GroundSurface",
      rings: rings.map((r) => at([...r].reverse(), ground)),
    },
    { type: "RoofSurface", rings: rings.map((r) => at(r, ground + height)) },
  ];
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      surfaces.push({
        type: "WallSurface",
        rings: [
          [
            [...a, ground],
            [...b, ground],
            [...b, ground + height],
            [...a, ground + height],
          ],
        ],
      });
    }
  return surfaces;
}
