import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  FileText,
  Footprints,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import type { Asset, Dossier, Floorplan, Task } from "./types";
import { categoryName, InlineText } from "./DocumentReader";
import { assetIcon, kindName } from "./dossierDisplay";

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
  onInterior: (roomId: string) => void;
  renderTasks: (tasks: Task[]) => ReactNode;
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
  onInterior,
  renderTasks,
}: Props) {
  const openTasks = dossier.tasks.filter((t) => t.status === "open");
  const [search, setSearch] = useState("");
  const files = dossier.attachments.filter((f) => f.assetId === selected?.id);
  const tasks = dossier.tasks.filter((t) => t.assetId === selected?.id);
  const groups = [
    { name: "Ruimtes", kinds: ["ruimte"] },
    { name: "Gebouw", kinds: ["gebouw", "dak", "gevel"] },
    { name: "Installaties", kinds: ["installatie"] },
    { name: "Onderwerpen", kinds: ["overig"] },
  ];
  return (
    <section className="dossier-home">
      <div className="dossier-overview">
        <div>
          <h2>In dit dossier</h2>
          <p>{dossier.assets.length} ruimtes, onderdelen en onderwerpen</p>
        </div>
        <div className="dossier-stats">
          <button onClick={() => onFiles()}>
            <strong>{dossier.attachments.length}</strong>
            <span>bestanden</span>
          </button>
          <button onClick={() => onTasks(undefined, "open")}>
            <strong>{openTasks.length}</strong>
            <span>open meldingen</span>
          </button>
        </div>
      </div>
      <div className="dossier-workbench">
        <label className="mobile-part-picker">
          Onderdeel
          <select
            aria-label="Kies een dossieronderdeel"
            value={selected?.id ?? ""}
            onChange={(event) => onSelect(event.target.value)}
          >
            {!selected && <option value="">Kies een onderdeel</option>}
            {groups.map((group) => (
              <optgroup label={group.name} key={group.name}>
                {dossier.assets
                  .filter((asset) => group.kinds.includes(asset.kind))
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div
          className="dossier-directory"
          aria-label="Kies een dossieronderdeel"
        >
          <label className="directory-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              name="parts"
              autoComplete="off"
              placeholder="Zoek een onderdeel…"
              aria-label="Zoek een onderdeel"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="directory-groups">
            {groups.map((group) => {
              const items = dossier.assets.filter(
                (asset) =>
                  group.kinds.includes(asset.kind) &&
                  asset.name
                    .toLocaleLowerCase("nl")
                    .includes(search.toLocaleLowerCase("nl")),
              );
              if (!items.length) return null;
              return (
                <details
                  className="directory-group"
                  key={group.name}
                  open={
                    Boolean(search) ||
                    items.some((asset) => asset.id === selected?.id)
                  }
                >
                  <summary>
                    {group.name}
                    <span>{items.length}</span>
                  </summary>
                  {items.map((a) => (
                    <button
                      key={a.id}
                      className={`dossier-tile ${selected?.id === a.id ? "active" : ""}`}
                      aria-pressed={selected?.id === a.id}
                      onClick={() => onSelect(a.id)}
                    >
                      {assetIcon(a.kind, 16)}
                      <strong>{a.name}</strong>
                      <span>
                        {
                          dossier.attachments.filter((f) => f.assetId === a.id)
                            .length
                        }{" "}
                        {dossier.attachments.filter((f) => f.assetId === a.id)
                          .length === 1
                          ? "bestand"
                          : "bestanden"}
                        {openTasks.some((t) => t.assetId === a.id) &&
                          ` · ${openTasks.filter((t) => t.assetId === a.id).length} open`}
                      </span>
                    </button>
                  ))}
                </details>
              );
            })}
            {!dossier.assets.some((asset) =>
              asset.name
                .toLocaleLowerCase("nl")
                .includes(search.toLocaleLowerCase("nl")),
            ) && (
              <p className="directory-empty">
                Geen onderdeel gevonden. Probeer een andere naam.
              </p>
            )}
          </div>
          <button className="directory-add" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            Onderdeel toevoegen
          </button>
        </div>
        {selected && (
          <section
            id="dossier-detail"
            className="content-panel dossier-detail"
            aria-label={`Dossier ${selected.name}`}
          >
            <div className="section-heading">
              <div>
                <span className="subtle-label">{kindName[selected.kind]}</span>
                <h2>{selected.name}</h2>
              </div>
              <div className="detail-actions">
                {selected.roomId &&
                  floorplan?.rooms.some((r) => r.id === selected.roomId) && (
                    <button
                      className="button secondary"
                      onClick={() => onInterior(selected.roomId!)}
                    >
                      <Footprints size={16} /> Bekijk in 3D
                    </button>
                  )}
                <button
                  className="icon-button"
                  aria-label="Onderdeel bewerken"
                  onClick={onEdit}
                >
                  <Pencil size={17} />
                </button>
              </div>
            </div>
            {selected.description && (
              <details
                className="dossier-background"
                key={selected.id}
                open={selected.description.length < 500}
              >
                <summary>
                  Informatie over {selected.name.toLocaleLowerCase("nl")}
                </summary>
                <p className="dossier-notes">
                  <InlineText text={selected.description} />
                </p>
              </details>
            )}
            <div className="dossier-columns">
              <div>
                <div className="dossier-column-heading">
                  <h3>
                    Documenten & foto's <span>({files.length})</span>
                  </h3>
                  <button className="text-link" onClick={onUpload}>
                    <Plus size={15} /> Toevoegen
                  </button>
                </div>
                {files.length ? (
                  <div className="document-links">
                    {files.slice(0, 6).map((f) => (
                      <button key={f.id} onClick={() => onDocument(f.id)}>
                        <FileText size={20} />
                        <span>
                          <strong>{f.name}</strong>
                          <small>
                            {categoryName[f.category ?? ""] ??
                              f.category ??
                              "Bestand"}
                            {f.historical ? " · historisch" : ""}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="form-note">
                    Voeg een foto, handleiding of notitie toe aan deze plek.
                  </p>
                )}
                {files.length > 6 && (
                  <button
                    className="text-link"
                    onClick={() => onFiles(selected.id)}
                  >
                    Alle {files.length} stukken bekijken →
                  </button>
                )}
              </div>
              <div>
                <div className="dossier-column-heading">
                  <h3>
                    Aandacht & historie <span>({tasks.length})</span>
                  </h3>
                  <button className="text-link" onClick={onTask}>
                    <Plus size={15} /> Toevoegen
                  </button>
                </div>
                {tasks.length ? (
                  renderTasks(
                    [
                      ...tasks.filter((t) => t.status === "open"),
                      ...tasks.filter((t) => t.status === "done"),
                    ].slice(0, 4),
                  )
                ) : (
                  <p className="form-note">
                    Leg een klus of uitgevoerd onderhoud vast.
                  </p>
                )}
                {tasks.length > 4 && (
                  <button
                    className="text-link"
                    onClick={() => onTasks(selected.id, "all")}
                  >
                    Alle {tasks.length} aandachtspunten bekijken →
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
