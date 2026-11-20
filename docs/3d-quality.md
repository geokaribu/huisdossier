# Architectural model quality

The private plan remains the authority for this dwelling. A visual correction is not a new measured dimension. Keep its source, approximate dimensions and an original backup in `data/`; do not put dwelling geometry or photos in this repository.

## Geometry and junctions

`planArchitecture.ts` constructs wall cross-sections at each sill, lintel and wall-height transition. Polygon unions remove overlapping faces inside T junctions. Connected corners use bounded miters; source endpoints are never automatically snapped. Horizontal faces are emitted only where material actually begins or ends. This avoids stacked wall caps, flickering coplanar surfaces and tiny artificial ridges.

The interior uses the same construction for skirting, excluding garden boundaries and retaining doorway gaps. A 12 cm display slab and continuous interior subfloor close tracing margins beneath room finishes. The slab thickness is a display convention, not surveyed construction. The walking ceiling meets the wall height directly.

The rear envelope uses the same wall geometry and source wall thicknesses for the perimeter and glazed portal. Exterior paint is split at openings, so it cannot paint over a door or window. The low extension's registration against the taller BAG volume remains approximate. Its outside rendering does not reconstruct the other apartments.

## Review criteria

| Check                | Evidence / limit                                                                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room enclosure       | Inspect supplied plan boundaries and both sides of required partitions. Walkability alone does not prove enclosure. A synthetic wet-room test raycasts the partition to ceiling height and verifies the hall route.                                                    |
| Joins and normals    | Synthetic L, T and diagonal junctions; finite coordinates, unit face normals, bounded miters, no internal face at a T junction. Different finish groups retain their own materials.                                                                                    |
| Openings             | Openings sorted without mutating input. Sills, lintels, door gaps and skirting checked separately. Closed glazed doors and open leaf collisions retain existing tests.                                                                                                 |
| Floors / ceiling     | Continuous base below room polygons; no floor strips floating below thresholds. Ceiling does not hover above the walls.                                                                                                                                                |
| Material scale       | Wall finish UVs use world distance. Wallpaper keeps its existing physical repeat scale and separate wall faces. Photo colors remain estimates.                                                                                                                         |
| Lighting             | Shadow camera centered on the dwelling, tighter frustum, normal bias; lower room-light intensity with inverse-square decay. One directional shadow source avoids per-room point-shadow rendering costs. Fill lighting remains illustrative, not a daylight simulation. |
| Color / transparency | Explicit sRGB output; color maps remain sRGB. Transparent interior glazing does not write depth, reducing sorting artifacts.                                                                                                                                           |
| Roof / exterior      | Existing genuine window and balcony openings remain raycast tested; roof detail and rear views inspected. Current photographs do not verify hidden roof or shared-building construction.                                                                               |
| Interaction          | Furnished and unfurnished room routes, terrace-door states, desktop and 390 px viewport. No primary data is changed by switching views.                                                                                                                                |

## Primary references

- [Three.js: Shadows](https://threejs.org/manual/pages/shadows.html): shadow-map costs, frustum resolution, bias, coplanar surfaces and depth writes.
- [Three.js: Color Management](https://threejs.org/manual/pages/color-management.html): linear lighting, sRGB color textures and display output.
- [polygon-clipping](https://github.com/mfogel/polygon-clipping): non-overlapping polygon unions and differences used for exposed wall boundaries.

Do not describe the result as surveyed, photogrammetric or fully photorealistic. Unseen surfaces and dimensions require more evidence.
