import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  Plus,
  Search,
  LayoutGrid,
  House,
  Building2,
  LampDesk,
  Shapes,
} from "lucide-react";
import { HouseBookCover } from "./HouseBookCover";
import type {
  Asset,
  Attachment,
  Dossier,
  Floorplan,
  HouseData,
  HouseAppearance,
  Task,
} from "./types";
import { RoomDossier } from "./RoomDossier";
import { placeIcon } from "./dossierDisplay";
import { latestHousePhoto } from "./housePhotos";

interface Props {
  dossier: Dossier;
  selected?: Asset;
  floorplan: Floorplan | null;
  onSelect: (id: string) => void;
  onFiles: (assetId?: string) => void;
  onTasks: (assetId?: string, filter?: "open" | "all") => void;
  onUpload: () => void;
  onTask: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onDocument: (id: string) => void;
  onPhoto: (file: Attachment) => void;
  onInterior: (roomId: string) => void;
  onCapture: () => void;
  onExplore: () => void;
  detailOpen: boolean;
  onBack: () => void;
  renderTasks: (tasks: Task[]) => ReactNode;
  contacts?: ReactNode;
  spatialHome?: ReactNode;
  data?: HouseData | null;
  appearance?: HouseAppearance | null;
  roomPreview?: ReactNode;
}

export function DossierHome({
  dossier,
  selected,
  floorplan,
  onSelect,
  onFiles,
  onTasks,
  onUpload,
  onTask,
  onEdit,
  onAdd,
  onDocument,
  onPhoto,
  onInterior,
  onCapture,
  onExplore,
  detailOpen,
  onBack,
  renderTasks,
  contacts,
  spatialHome,
  data,
  appearance,
  roomPreview,
}: Props) {
  const openTasks = dossier.tasks.filter((t) => t.status === "open");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [showAll, setShowAll] = useState(false);
  const groups = [
    { name: "Kamers", kinds: ["ruimte"], Icon: House },
    { name: "Gebouw", kinds: ["gebouw", "dak", "gevel"], Icon: Building2 },
    { name: "Techniek", kinds: ["installatie"], Icon: LampDesk },
    { name: "Overig", kinds: ["overig"], Icon: Shapes },
  ];
  const matchingAssets = dossier.assets
    .filter(
      (asset) =>
        (!group ||
          groups
            .find((item) => item.name === group)
            ?.kinds.includes(asset.kind)) &&
        asset.name
          .toLocaleLowerCase("nl")
          .includes(search.toLocaleLowerCase("nl")),
    )
    .sort(
      (a, b) =>
        groups.findIndex((item) => item.kinds.includes(a.kind)) -
        groups.findIndex((item) => item.kinds.includes(b.kind)),
    );
  const visibleAssets =
    search || group || showAll ? matchingAssets : matchingAssets.slice(0, 8);
  return (
    <section className="dossier-home">
      {!detailOpen && (
        <>
          {spatialHome ?? (
            <HouseBookCover onCapture={onCapture} onExplore={onExplore} />
          )}
          <div className="dossier-overview">
            <div>
              <h2>Jouw plekken</h2>
            </div>
          </div>
          <div className="dossier-workbench">
            <div
              id="housebook-places"
              tabIndex={-1}
              className="dossier-directory housebook-directory"
              aria-label="Kies een dossieronderdeel"
            >
              <label className="directory-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  name="parts"
                  autoComplete="off"
                  placeholder="Zoek een plek"
                  aria-label="Zoek een onderdeel"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div
                className="place-choices"
                role="group"
                aria-label="Soort plek"
              >
                <button
                  className="place-choice choice-all"
                  aria-pressed={!group}
                  onClick={() => setGroup("")}
                >
                  <span>
                    <LayoutGrid size={23} aria-hidden="true" />
                  </span>
                  Alles
                </button>
                {groups
                  .filter((item) =>
                    dossier.assets.some((asset) =>
                      item.kinds.includes(asset.kind),
                    ),
                  )
                  .map(({ name, Icon }) => (
                    <button
                      className={`place-choice choice-${name.toLowerCase()}`}
                      key={name}
                      aria-pressed={group === name}
                      onClick={() => setGroup(name)}
                    >
                      <span>
                        <Icon size={23} aria-hidden="true" />
                      </span>
                      {name}
                    </button>
                  ))}
              </div>
              <div className="place-grid" aria-live="polite">
                {visibleAssets.map((a) => {
                  const photo = latestHousePhoto(dossier.attachments, a.id);
                  return (
                    <button
                      key={a.id}
                      className={`place-card place-${a.kind} ${selected?.id === a.id ? "active" : ""}`}
                      aria-pressed={selected?.id === a.id}
                      onClick={() => onSelect(a.id)}
                    >
                      <span className="place-drawing" aria-hidden="true">
                        {photo ? (
                          <img src={photo.url} alt="" loading="lazy" />
                        ) : (
                          placeIcon(a, 32)
                        )}
                      </span>
                      <strong>{a.name}</strong>
                      {(dossier.attachments.some(
                        (file) => file.assetId === a.id,
                      ) ||
                        openTasks.some((task) => task.assetId === a.id)) && (
                        <small>
                          {
                            dossier.attachments.filter(
                              (f) => f.assetId === a.id,
                            ).length
                          }{" "}
                          {dossier.attachments.filter((f) => f.assetId === a.id)
                            .length === 1
                            ? "bestand"
                            : "bestanden"}
                          {openTasks.some((t) => t.assetId === a.id) &&
                            ` · ${openTasks.filter((t) => t.assetId === a.id).length} open`}
                        </small>
                      )}
                      <ChevronRight
                        className="place-arrow"
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
                {!visibleAssets.length && (
                  <p className="directory-empty">
                    Geen onderdeel gevonden. Probeer een andere naam.
                  </p>
                )}
              </div>
              {!search && !group && matchingAssets.length > 8 && (
                <button
                  className="place-show-all"
                  aria-expanded={showAll}
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll
                    ? "Minder plekken tonen"
                    : `Alle ${matchingAssets.length} plekken tonen`}
                </button>
              )}
              <button className="directory-add" onClick={onAdd}>
                <Plus size={16} aria-hidden="true" />
                Onderdeel toevoegen
              </button>
            </div>
          </div>
        </>
      )}
      {detailOpen && selected && (
        <RoomDossier
          key={selected.id}
          dossier={dossier}
          asset={selected}
          floorplan={floorplan}
          data={data}
          appearance={appearance}
          preview={roomPreview}
          contacts={contacts}
          onBack={onBack}
          onExplore={onExplore}
          onInterior={onInterior}
          onEdit={onEdit}
          onUpload={onUpload}
          onTask={onTask}
          onFiles={onFiles}
          onTasks={onTasks}
          onDocument={onDocument}
          onPhoto={onPhoto}
          renderTasks={renderTasks}
        />
      )}
    </section>
  );
}
