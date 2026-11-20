# Architectural model quality

The private plan remains the authority for this dwelling. A visual correction is not a new measured dimension. Keep its source, approximate dimensions and an original backup in `data/`; do not put dwelling geometry or photos in this repository.

## Geometry and junctions

Framed artwork uses a recessed, correctly oriented canvas in continuous mouldings. Optional artwork textures follow the same private per-house allowlist as wall patterns, including export of the original texture bytes and source metadata. Frame placement and dimensions remain photo estimates. AI-rectified or restored artwork must retain `generated: true` and explicit provenance; do not describe it as an exact photographic reproduction. The texture responds to scene lighting and is never emissive. Interior and exterior viewers own and release their texture maps. Loose pictures disappear in the unfurnished view.

Bedroom furniture is profile-driven through `bedroomFurniture.ts`: a storage bed with supported mattress, folded bedding and throw, sliding wardrobe with configurable panel count/mirror index, framed low cabinet with procedural marble approximation, hamper and potted plant. Loose objects retain IDs but are removed, including their collisions, in the unfurnished view. Explicit fixed ceiling fixtures remain. Furniture dimensions and paint colours inferred from photos stay approximate; warm photographic lighting is not evidence of a different paint colour.

The interior wardrobe mirror uses one bounded 512 × 1024 planar reflection target, only when the mirror faces the camera; the exterior uses a passive material. The interior releases the reflection target when rebuilding or leaving the view. Pendant bulb geometry and light positions share one layout function. Authored pendant sources replace the illustrative room light, so a single-bulb fixture never silently gets a second room source. The night switch also extinguishes bulb emission. Light intensity is a scenario value, not measured photometry.

`planArchitecture.ts` constructs wall cross-sections at each sill, lintel and wall-height transition. Polygon unions remove overlapping faces inside T junctions. Connected corners use bounded miters; source endpoints are never automatically snapped. Horizontal faces are emitted only where material actually begins or ends. This avoids stacked wall caps, flickering coplanar surfaces and tiny artificial ridges.

The interior uses the same construction for skirting, excluding garden boundaries and retaining doorway gaps. A 12 cm display slab and continuous interior subfloor close tracing margins beneath room finishes. The slab thickness is a display convention, not surveyed construction. The walking ceiling meets the wall height directly.

The rear envelope uses the same wall geometry and source wall thicknesses for the perimeter and glazed portal. Exterior paint is split at openings, so it cannot paint over a door or window. The low extension's registration against the taller BAG volume remains approximate. Its outside rendering does not reconstruct the other apartments.

## Exterior assembly

An optional private `appearance.shell` profile selects the source rear wall and the BAG faces replaced in the visual reconstruction. `houseFrame.ts` supplies one facade/plan transform and one main-shell layout. `exteriorShell.ts` shares the same ridge with the sloping roof, side cheeks, flat roof, roof edging and fixtures. The existing BAG rear wall determines the rear contact corners and its potentially sloping lower edge. `rearExterior` inserts those corners into the traced cut line and fills up to that edge instead of stopping at an unrelated constant height. The original model remains available with facade styling disabled; keep the selected surface indices under review after any source reimport.

The low roof is one filled, extruded slab including the wall perimeter. It has no separate coplanar edge caps. Display foundations extend below the ground plane; the main base includes the ridge kink so it follows the side walls exactly. The 12 cm footing thickness is a display convention, not evidence of the real foundation.

The canopy mounts to the roof at the upper balcony opening. Its supports meet both the roof skin and the canopy crossbar. A solid balcony deck supports the corner posts; side rails terminate at the back wall and spindles connect to lower rails. Side-wall UVs follow the dominant horizontal wall direction, avoiding a facade projection stretched along an entire side wall. These checks do not establish hidden construction or measured dimensions.

The inside lighting context uses the same reconstructed structural geometry, clipped above the room ceiling, instead of retaining the superseded BAG roofs. Loose furnishings and terrace boundaries already present in the interior scene are excluded from that extra context.

Synthetic tests probe canopy mount contact, post bearing, ridge/roof-edge agreement, the full sloping rear seam, side-wall texture scale, source preservation and replacement shadow geometry. Visual review covers front, both sides, rear, roof detail and top view, with original/styled and furnished/unfurnished variants. Connectivity alone still does not establish fidelity to the actual dwelling.

If a context building blocks the camera-to-house ray, the viewer cuts the context just before the actual house hit. That clipping applies only to the context's color/depth view; `clipShadows` is disabled so the complete neighbor remains a shadow caster. The viewer explains the cutaway while active. This keeps close front/roof views usable on narrow screens, where the fitting camera can otherwise end up inside a neighboring building.

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
