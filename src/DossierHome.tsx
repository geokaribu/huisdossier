import type { ReactNode } from "react";
import { ChevronRight, FileText, Footprints, Pencil, Plus } from "lucide-react";
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
  onDocument,
  onInterior,
  renderTasks,
}: Props) {
  const openTasks = dossier.tasks.filter((t) => t.status === "open");
  const files = dossier.attachments.filter((f) => f.assetId === selected?.id);
  const tasks = dossier.tasks.filter((t) => t.assetId === selected?.id);
  const assets = [
    ...dossier.assets.filter((a) => a.kind === "ruimte"),
    ...dossier.assets.filter((a) => a.kind !== "ruimte"),
  ];
  return (
    <section className="dossier-home">
      <div className="dossier-intro">
        <div>
          <span className="subtle-label">
            Jullie huis, van binnen en buiten
          </span>
          <h2>Wat wil je terugvinden?</h2>
          <p>
            Kies een ruimte of onderwerp voor documenten, afspraken en klussen.
          </p>
        </div>
        <div className="dossier-stats">
          <button onClick={() => onFiles()}>
            <strong>{dossier.attachments.length}</strong>
            <span>documenten & foto's</span>
          </button>
          <button onClick={() => onTasks(undefined, "open")}>
            <strong>{openTasks.length}</strong>
            <span>open aandachtspunten</span>
          </button>
        </div>
      </div>
      <div className="dossier-directory" aria-label="Kies een dossieronderdeel">
        {assets.map((a) => (
          <button
            key={a.id}
            className={`dossier-tile ${selected?.id === a.id ? "active" : ""}`}
            aria-pressed={selected?.id === a.id}
            onClick={() => onSelect(a.id)}
          >
            {assetIcon(a.kind, 20)}
            <strong>{a.name}</strong>
            <span>
              {dossier.attachments.filter((f) => f.assetId === a.id).length}{" "}
              stukken · {openTasks.filter((t) => t.assetId === a.id).length}{" "}
              open
            </span>
          </button>
        ))}
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
            <p className="dossier-notes">
              <InlineText text={selected.description} />
            </p>
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
    </section>
  );
}
