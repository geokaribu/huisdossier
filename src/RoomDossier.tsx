import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  FileText,
  Footprints,
  Info,
  LayoutGrid,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import type {
  Asset,
  Attachment,
  Dossier,
  Floorplan,
  HouseData,
  HouseAppearance,
  Task,
} from "./types";
import { HouseMiniature } from "./HouseAtlas";
import { FileLibrary } from "./FileLibrary";
import { ReadableText } from "./ReadableText";
import { InformationBook, PlanInformation } from "./InformationBook";
import { kindName, placeIcon } from "./dossierDisplay";
import { residentDate } from "./residentWorkflows";
import "./room-dossier.css";

export function RoomDossier({
  dossier,
  asset,
  floorplan,
  data,
  appearance,
  preview,
  contacts,
  onBack,
  onExplore,
  onInterior,
  onEdit,
  onUpload,
  onTask,
  onFiles,
  onTasks,
  onDocument,
  onPhoto,
  renderTasks,
}: {
  dossier: Dossier;
  asset: Asset;
  floorplan: Floorplan | null;
  data?: HouseData | null;
  appearance?: HouseAppearance | null;
  preview?: ReactNode;
  contacts?: ReactNode;
  onBack: () => void;
  onExplore: () => void;
  onInterior: (id: string) => void;
  onEdit: () => void;
  onUpload: () => void;
  onTask: () => void;
  onFiles: (id: string) => void;
  onTasks: (id: string, filter: "open" | "all") => void;
  onDocument: (id: string) => void;
  onPhoto: (file: Attachment) => void;
  renderTasks: (tasks: Task[]) => ReactNode;
}) {
  const [section, setSection] = useState("overview");
  const [view, setView] = useState<"list" | "gallery">("gallery");
  const files = dossier.attachments.filter((file) => file.assetId === asset.id);
  const openFile = (file: Attachment) =>
    /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)
      ? onPhoto(file)
      : onDocument(file.id);
  const tasks = dossier.tasks.filter((task) => task.assetId === asset.id);
  const open = tasks.filter((task) => task.status === "open");
  const recent = open.length
    ? open.slice(0, 2)
    : tasks
        .filter((task) => task.status === "done")
        .sort((a, b) =>
          (b.completedAt || b.date).localeCompare(a.completedAt || a.date),
        )
        .slice(0, 2);
  const room = floorplan?.rooms.find((room) => room.id === asset.roomId);
  const explore = () => (room ? onInterior(room.id) : onExplore());
  const tabs = [
    { id: "overview", label: "Overzicht", Icon: LayoutGrid },
    {
      id: "files",
      label: "Foto’s & documenten",
      Icon: Camera,
      count: files.length,
    },
    {
      id: "tasks",
      label: "Klussen & historie",
      Icon: Wrench,
      count: open.length,
    },
    { id: "info", label: "Info & contacten", Icon: Info },
  ];
  return (
    <section
      id="dossier-detail"
      tabIndex={-1}
      className="room-dossier"
      aria-label={`Dossier ${asset.name}`}
    >
      <button className="room-back" onClick={onBack}>
        <ArrowLeft size={18} /> Alle plekken
      </button>
      <header className="room-hero">
        <div className="room-identity">
          <span className="room-identity-icon" aria-hidden="true">
            {placeIcon(asset, 40)}
          </span>
          <p>
            {kindName[asset.kind] ?? "Onderdeel"}
            {room?.area ? ` · ${room.area.toLocaleString("nl-NL")} m²` : ""}
          </p>
          <h2>{asset.name}</h2>
          <button className="room-edit" onClick={onEdit}>
            <Pencil size={15} /> Gegevens aanpassen
          </button>
        </div>
        <div className="room-portrait">
          <div className="room-portrait-image" aria-hidden="true" inert>
            {preview ??
              (data ? <HouseMiniature data={data} /> : placeIcon(asset, 100))}
          </div>
          {(room || data) && (
            <button className="room-explore" onClick={explore}>
              <Footprints size={19} />{" "}
              {room ? "Rondkijken in 3D" : "Je huis in 3D"}
              <ArrowUpRight size={18} />
            </button>
          )}
        </div>
      </header>
      <div
        className="room-sections"
        role="group"
        aria-label="Inhoud van deze plek"
      >
        {tabs.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            aria-pressed={section === id}
            aria-controls="room-content"
            onClick={() => setSection(id)}
          >
            <Icon size={23} aria-hidden="true" />
            <span>{label}</span>
            {count != null && count > 0 && <small>{count}</small>}
          </button>
        ))}
      </div>
      <div
        id="room-content"
        className={`room-content room-content-${section}`}
        role="region"
        aria-label={tabs.find((tab) => tab.id === section)?.label}
      >
        {section === "overview" && (
          <div className="room-overview-layout">
            <section className="room-collection">
              <div className="room-section-title">
                <h3>Bij deze plek bewaard</h3>
                {files.length > 0 && (
                  <button onClick={() => setSection("files")}>
                    Alles bekijken <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
              {files.length ? (
                <div className="room-keepsakes">
                  {files.slice(0, 3).map((file) => (
                    <button key={file.id} onClick={() => openFile(file)}>
                      <span className="room-keepsake-image">
                        {/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) ? (
                          <img src={file.url} alt="" loading="lazy" />
                        ) : (
                          <FileText size={38} />
                        )}
                      </span>
                      <strong>{file.name}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <button className="room-first-photo" onClick={onUpload}>
                  <span className="photo-stack" aria-hidden="true">
                    <Camera size={42} />
                    <span>
                      <Plus size={21} />
                    </span>
                  </span>
                  <strong>Geef deze plek een foto</strong>
                  <span>Of bewaar een handleiding, factuur of notitie.</span>
                  <b>
                    <Plus size={17} /> Iets toevoegen
                  </b>
                </button>
              )}
            </section>
            <section className="room-next">
              <div className="room-section-title">
                <h3>{open.length ? "Nu te doen" : "Laatst gedaan"}</h3>
                <Wrench size={20} aria-hidden="true" />
              </div>
              {recent.length ? (
                recent.map((task) => (
                  <button
                    className="room-task-glance"
                    key={task.id}
                    onClick={() => setSection("tasks")}
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 size={25} />
                    ) : (
                      <Wrench size={25} />
                    )}
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.status === "done" ? "Gedaan" : "Gepland"}
                        {task.completedAt || task.date
                          ? ` · ${residentDate(task.status === "done" ? task.completedAt || task.date : task.date)}`
                          : " · nog geen datum"}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))
              ) : (
                <div className="room-no-tasks">
                  <CheckCircle2 size={42} />
                  <p>Hier staan nog geen klussen.</p>
                </div>
              )}
              <button className="room-add-task" onClick={onTask}>
                <Plus size={19} /> Een klus toevoegen
              </button>
            </section>
          </div>
        )}
        {section === "files" && (
          <section className="room-panel">
            <div className="room-section-title">
              <h3>Foto’s & documenten</h3>
              <button className="button primary" onClick={onUpload}>
                <Plus size={18} /> Toevoegen
              </button>
            </div>
            {files.length ? (
              <FileLibrary
                files={files}
                assets={dossier.assets}
                snippets={[]}
                view={view}
                onViewChange={setView}
                onDocument={(id) => {
                  const file = files.find((file) => file.id === id);
                  if (file) openFile(file);
                }}
                onPhoto={onPhoto}
              />
            ) : (
              <p>Er is nog niets bewaard bij deze plek.</p>
            )}
            {files.length > 0 && (
              <button className="room-more" onClick={() => onFiles(asset.id)}>
                Open in de verzameling <ArrowUpRight size={16} />
              </button>
            )}
          </section>
        )}
        {section === "tasks" && (
          <section className="room-panel">
            <div className="room-section-title">
              <h3>Klussen & historie</h3>
              <button className="button primary" onClick={onTask}>
                <Plus size={18} /> Klus toevoegen
              </button>
            </div>
            {tasks.length ? (
              renderTasks([
                ...open,
                ...tasks.filter((task) => task.status === "done"),
              ])
            ) : (
              <p>Voeg een klus toe of leg vast wat er is gedaan.</p>
            )}
            {tasks.length > 0 && (
              <button
                className="room-more"
                onClick={() => onTasks(asset.id, "all")}
              >
                Open bij alle klussen <ArrowUpRight size={16} />
              </button>
            )}
          </section>
        )}
        {section === "info" && (
          <div className="room-info-layout">
            {floorplan && (room || asset.kind === "gebouw") && (
              <div className="room-information-wide">
                <PlanInformation plan={floorplan} roomId={room?.id} />
              </div>
            )}
            {appearance?.information?.some((item) =>
              item.assetKinds?.includes(asset.kind),
            ) && (
              <div className="room-information-wide">
                <InformationBook
                  title={`Achtergrond van ${asset.name}`}
                  items={appearance.information.filter((item) =>
                    item.assetKinds?.includes(asset.kind),
                  )}
                />
              </div>
            )}
            <section className="room-panel">
              <h3>Over {asset.name.toLocaleLowerCase("nl")}</h3>
              {asset.description ? (
                <div className="room-notes">
                  <ReadableText text={asset.description} />
                </div>
              ) : (
                <p>Er is nog geen informatie toegevoegd.</p>
              )}
              <button className="room-more" onClick={onEdit}>
                <Pencil size={16} /> Informatie aanvullen
              </button>
            </section>
            <div className="room-panel">{contacts}</div>
          </div>
        )}
      </div>
    </section>
  );
}
