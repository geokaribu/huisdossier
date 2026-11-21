import { useMemo, type ReactNode } from "react";
import {
  ArrowUpRight,
  Box,
  CalendarDays,
  FolderHeart,
  Footprints,
  Plus,
  Wrench,
  LayoutGrid,
  Camera,
  MessageCircle,
} from "lucide-react";
import { placeIcon } from "./dossierDisplay";
import { latestHousePhoto } from "./housePhotos";
import type { Asset, Attachment, Dossier, HouseData } from "./types";

/** A diagram of the imported shell, without adding inferred rooms or materials. */
export function HouseMiniature({ data }: { data: HouseData }) {
  const drawing = useMemo(() => {
    const surfaces = data.buildings
      .filter((b) => b.target)
      .flatMap((b) => b.surfaces)
      .filter(
        (s) => s.type !== "GroundSurface" && s.rings.some((r) => r.length >= 3),
      );
    const vertices = surfaces.flatMap((s) => s.rings.flat());
    if (!vertices.length) return null;
    const origin = vertices[0];
    const project = (p: number[]) => [
      (p[0] - origin[0] - p[1] + origin[1]) * 0.86,
      (p[0] - origin[0] + p[1] - origin[1]) * 0.36 - (p[2] - origin[2]) * 0.95,
    ];
    const points = vertices.map(project);
    const [minX, minY, maxX, maxY] = points.reduce(
      ([x0, y0, x1, y1], [x, y]) => [
        Math.min(x0, x),
        Math.min(y0, y),
        Math.max(x1, x),
        Math.max(y1, y),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    );
    const width = Math.max(maxX - minX, 1),
      height = Math.max(maxY - minY, 1);
    const padding = Math.max(width, height) * 0.1;
    return {
      box: `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`,
      surfaces: surfaces
        .map((s) => ({
          roof: s.type === "RoofSurface",
          depth:
            s.rings[0].reduce(
              (n, p) => n + p[0] - origin[0] + p[1] - origin[1],
              0,
            ) / s.rings[0].length,
          path: s.rings
            .map(
              (ring) =>
                ring
                  .map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`)
                  .join(" ") + "Z",
            )
            .join(" "),
        }))
        .sort((a, b) => a.depth - b.depth),
    };
  }, [data]);
  if (!drawing) return <Box size={56} aria-hidden="true" />;
  return (
    <svg className="house-miniature" viewBox={drawing.box} aria-hidden="true">
      {drawing.surfaces.map((surface, i) => (
        <path
          key={i}
          d={surface.path}
          fillRule="evenodd"
          fill={surface.roof ? "#f4aa5c" : "#fffaf0"}
          stroke="#827665"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function HouseChapter({
  data,
  onExplore,
}: {
  data: HouseData;
  onExplore: () => void;
}) {
  return (
    <button
      className="house-chapter"
      onClick={onExplore}
      aria-label="Open je huis in 3D"
    >
      <HouseMiniature data={data} />
      <span>
        <Box size={15} aria-hidden="true" /> Je huis in 3D{" "}
        <ArrowUpRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

export function SpatialHome({
  onAssistant,
  dossier,
  children,
  hasInterior,
  onExplore,
  onInterior,
  onCapture,
  onFiles,
  onTasks,
  onPlanning,
  onPhoto,
}: {
  dossier: Dossier;
  children: ReactNode;
  hasInterior: boolean;
  onExplore: () => void;
  onInterior: () => void;
  onCapture: () => void;
  onFiles: () => void;
  onTasks: () => void;
  onPlanning: () => void;
  onPhoto: (file: Attachment) => void;
  onAssistant: () => void;
}) {
  const featured = latestHousePhoto(dossier.attachments);
  const photos = featured ? [featured] : [];
  return (
    <section className="spatial-home" aria-label="Je huis en alles eromheen">
      <div className="spatial-welcome">
        <div>
          <h2>Hier ben je thuis.</h2>
          <p>Je plekken, je foto's en alles wat je wilt onthouden.</p>
        </div>
        <button className="button primary" onClick={onCapture}>
          <Plus size={18} /> Iets bewaren
        </button>
      </div>
      <div className="house-stage">
        <div className="house-stage-scene">
          {children}
          <div className="house-stage-links">
            <button onClick={onExplore}>
              <Box size={17} /> Buiten verkennen <ArrowUpRight size={16} />
            </button>
            {hasInterior && (
              <button onClick={onInterior}>
                <Footprints size={17} /> Binnen kijken{" "}
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>
        <aside
          className={`home-memory ${photos.length ? "has-photos" : ""}`}
          aria-label="Kleine dingen van thuis"
        >
          <div className="home-memory-pictures">
            {photos.length ? (
              photos.map((photo) => (
                <button
                  className="home-photo"
                  key={photo.id}
                  onClick={() => onPhoto(photo)}
                  aria-label={`Bekijk foto: ${photo.name}`}
                >
                  <img src={photo.url} alt="" loading="lazy" />
                  <span>
                    {dossier.assets.find((asset) => asset.id === photo.assetId)
                      ?.name ?? photo.name}
                  </span>
                </button>
              ))
            ) : (
              <img
                className="home-still-life"
                src="/illustrations/thuisalbum.png"
                width="1536"
                height="1024"
                alt=""
              />
            )}
          </div>
          <div className="home-memory-copy">
            <h3>
              Kleine dingen
              <br />
              van thuis.
            </h3>
            <p>
              {photos.length
                ? "Een kijkje in wat je hebt bewaard."
                : "Die fijne hoek. Een nieuw idee. Een foto van hoe het was."}
            </p>
            <button className="home-memory-add" onClick={onCapture}>
              <Camera size={20} /> Iets van thuis bewaren
            </button>
            <button className="home-memory-open" onClick={onFiles}>
              Open je verzameling <ArrowUpRight size={16} />
            </button>
          </div>
        </aside>
      </div>
      <div
        className="home-practical"
        role="group"
        aria-label="Handig voor je huis"
      >
        <button onClick={onFiles}>
          <FolderHeart size={21} /> Alles wat je bewaart
        </button>
        <button onClick={onTasks}>
          <Wrench size={21} /> Klussen & wat al gedaan is
        </button>
        <button onClick={onPlanning}>
          <CalendarDays size={21} /> Je huisagenda
        </button>
        <button onClick={onAssistant}>
          <MessageCircle size={21} /> Vraag je huis
        </button>
      </div>
    </section>
  );
}

export function PlaceFilter({
  assets,
  value,
  onChange,
  all = true,
}: {
  assets: Asset[];
  value: string;
  onChange: (id: string) => void;
  all?: boolean;
}) {
  return (
    <div className="place-filter" role="group" aria-label="Filter op plek">
      {all && (
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange("")}
        >
          <LayoutGrid size={23} />
          <span>Hele huis</span>
        </button>
      )}
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          aria-pressed={value === asset.id}
          onClick={() => onChange(asset.id)}
        >
          {placeIcon(asset, 23)}
          <span>{asset.name}</span>
        </button>
      ))}
    </div>
  );
}
