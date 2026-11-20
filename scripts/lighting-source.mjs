/** BGT keeps historical versions alongside current ones. Never double-count a mast. */
export function activeLightMasts(features, center, radius) {
  const active = new Map(),
    [x, y] = center;
  for (const f of features) {
    const p = f.properties;
    if (
      (p.plus_type !== "lichtmast" && p.type !== "lichtmast") ||
      p.eind_registratie ||
      p.termination_date ||
      p.status !== "bestaand" ||
      f.geometry?.type !== "Point"
    )
      continue;
    const q = f.geometry.coordinates;
    if (
      !Number.isFinite(q[0]) ||
      !Number.isFinite(q[1]) ||
      !p.lokaal_id ||
      Math.hypot(q[0] - x, q[1] - y) > radius
    )
      continue;
    const old = active.get(p.lokaal_id);
    if (
      !old ||
      (p.tijdstip_registratie ?? "") >
        (old.properties.tijdstip_registratie ?? "")
    )
      active.set(p.lokaal_id, f);
  }
  return [...active.values()];
}
