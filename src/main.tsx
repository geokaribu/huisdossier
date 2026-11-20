import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  House,
  FolderOpen,
  Wrench,
  Database,
  Plus,
  Download,
  MapPin,
  ChevronRight,
  LockKeyhole,
  Box,
  FileText,
  Upload,
  X,
  Check,
  Pencil,
  Circle,
  CheckCircle2,
  LocateFixed,
  Search,
  ExternalLink,
  Info,
  Menu,
  LoaderCircle,
  Building2,
  Layers3,
} from "lucide-react";
import { request } from "./api";
import type { HouseData, Attachment, Task, Dossier, Point } from "./types";
import "./style.css";
const Viewer = lazy(() =>
  import("./Viewer").then((module) => ({ default: module.Viewer })),
);

type Page = "model" | "files" | "tasks" | "sources";
type Modal = "asset" | "upload" | "task" | "edit" | null;
const localDate = () => new Date().toLocaleDateString("sv-SE");
const formatDate = (date: string) =>
  new Date(date.length === 10 ? `${date}T12:00:00` : date).toLocaleDateString(
    "nl-NL",
    { day: "numeric", month: "short", year: "numeric" },
  );
const fileSize = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} kB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
const kindName: Record<string, string> = {
  gebouw: "Gebouw",
  dak: "Dak",
  gevel: "Gevel",
  ruimte: "Ruimte",
  installatie: "Installatie",
  overig: "Onderdeel",
};
const assetIcon = (kind: string, size = 18) =>
  kind === "gebouw" ? (
    <Building2 size={size} />
  ) : kind === "installatie" ? (
    <Wrench size={size} />
  ) : kind === "ruimte" ? (
    <House size={size} />
  ) : (
    <Layers3 size={size} />
  );

function App() {
  const [houseId, setHouseId] = useState("");
  const [houses, setHouses] = useState<
    { id: string; name: string; address: string }[]
  >([]);
  const [data, setData] = useState<HouseData | null>(null);
  const [dossier, setDossier] = useState<Dossier>({
    assets: [],
    attachments: [],
    tasks: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState<Page>("model");
  const [modal, setModal] = useState<Modal>(null);
  const [inspectorTab, setInspectorTab] = useState("details");
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("open");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const selected = dossier.assets.find((a) => a.id === selectedId);
  const api = `/api/houses/${houseId}`;
  const reportError = useCallback((message: string) => setError(message), []);
  const refresh = useCallback(async () => {
    if (houseId)
      setDossier(await request<Dossier>(`/api/houses/${houseId}/dossier`));
  }, [houseId]);

  useEffect(() => {
    request<typeof houses>("/api/houses")
      .then((items) => {
        setHouses(items);
        setHouseId(items[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!houseId) return;
    let cancelled = false;
    setData(null);
    setDossier({ assets: [], attachments: [], tasks: [] });
    setPlacing(false);
    Promise.all([
      request<HouseData>(`/data/${houseId}.json`),
      request<Dossier>(`/api/houses/${houseId}/dossier`),
    ])
      .then(([model, records]) => {
        if (!cancelled) {
          setData(model);
          document.title = `${model.house.address} · Geokari Huisdossier`;
          setDossier(records);
          setSelectedId(`${houseId}:building`);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [houseId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const select = (id: string) => {
    setSelectedId(id);
    setPlacing(false);
    setInspectorTab("details");
  };
  const openModal = (type: Modal) => {
    setError("");
    setModal(type);
  };
  async function save(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setModal(null);
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function place(point: Point) {
    if (!selected) return;
    const ok = await save(
      () =>
        request(`${api}/assets/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: selected.name,
            description: selected.description,
            position: point,
          }),
        }),
      "Plek vastgelegd",
    );
    if (ok) setPlacing(false);
  }
  function TaskList({
    tasks,
    compact = false,
  }: {
    tasks: Task[];
    compact?: boolean;
  }) {
    return (
      <div className={compact ? "task-list compact" : "task-list"}>
        {tasks.map((task) => (
          <article className={`task-row ${task.status}`} key={task.id}>
            <button
              className="task-check"
              disabled={busy}
              title={
                task.status === "open"
                  ? "Markeer als uitgevoerd"
                  : "Heropen melding"
              }
              aria-label={`${task.status === "open" ? "Markeer als uitgevoerd" : "Heropen melding"}: ${task.title}`}
              onClick={() =>
                save(
                  () =>
                    request(`${api}/tasks/${task.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        status: task.status === "open" ? "done" : "open",
                      }),
                    }),
                  task.status === "open"
                    ? "Onderhoud als uitgevoerd gemarkeerd"
                    : "Melding heropend",
                )
              }
            >
              {task.status === "open" ? (
                <Circle size={22} />
              ) : (
                <CheckCircle2 size={22} />
              )}
            </button>
            <div>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
              <span className="task-meta">
                {dossier.assets.find((a) => a.id === task.assetId)?.name}{" "}
                <span>·</span> {formatDate(task.date)}
              </span>
            </div>
            <span
              className={`badge ${task.status === "done" ? "green" : "amber"}`}
            >
              {task.status === "done" ? "Uitgevoerd" : "Open"}
            </span>
          </article>
        ))}
      </div>
    );
  }
  function Files({
    files,
    compact = false,
  }: {
    files: Attachment[];
    compact?: boolean;
  }) {
    return (
      <div className={compact ? "file-grid compact" : "file-grid"}>
        {files.map((file) => (
          <article className="file-card" key={file.id}>
            {file.type.startsWith("image/") &&
            [
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/gif",
              "image/avif",
            ].includes(file.type) ? (
              <button
                className="image-preview"
                onClick={() => setLightbox(file)}
                aria-label={`Bekijk ${file.name}`}
              >
                <img src={file.url} alt={file.name} loading="lazy" />
              </button>
            ) : (
              <div className="file-preview">
                <FileText size={30} strokeWidth={1.2} />
                <span>
                  {file.name.split(".").pop()?.toUpperCase().slice(0, 8)}
                </span>
              </div>
            )}
            <div className="file-info">
              <strong title={file.name}>{file.name}</strong>
              <span>
                {fileSize(file.size)} · {formatDate(file.createdAt)}
              </span>
              {!compact && (
                <span>
                  {dossier.assets.find((a) => a.id === file.assetId)?.name}
                </span>
              )}
              <a href={`${file.url}?download=1`} download>
                <Download size={14} /> Download
              </a>
            </div>
          </article>
        ))}
      </div>
    );
  }
  const filteredFiles = dossier.attachments.filter((f) =>
    `${f.name} ${dossier.assets.find((a) => a.id === f.assetId)?.name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const filteredTasks = dossier.tasks
    .filter((t) => taskFilter === "all" || t.status === taskFilter)
    .filter((t) =>
      `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
    );
  const openTasks = dossier.tasks.filter((t) => t.status === "open");
  const relatedFiles = dossier.attachments.filter(
    (f) => f.assetId === selectedId,
  );
  const relatedTasks = dossier.tasks.filter((t) => t.assetId === selectedId);

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}
        aria-label="Hoofdnavigatie"
      >
        <a className="brand" href="/" aria-label="Geokari Huisdossier">
          <img src="/brand/geokari.png" alt="" />
          <span>
            GeoKari<small>Huisdossier</small>
          </span>
        </a>
        <div className="house-switch">
          <House size={19} />
          <div>
            <label htmlFor="house-select">Mijn woning</label>
            <select
              id="house-select"
              value={houseId}
              onChange={(e) => setHouseId(e.target.value)}
            >
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.address}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav>
          {(
            [
              { id: "model", label: "Huis bekijken", Icon: Box },
              { id: "files", label: "Foto’s & documenten", Icon: FolderOpen },
              { id: "tasks", label: "Onderhoud", Icon: Wrench },
              { id: "sources", label: "Bronnen & model", Icon: Database },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-link active" : "nav-link"}
              onClick={() => {
                setPage(id);
                setQuery("");
                setMobileMenu(false);
              }}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "tasks" && openTasks.length > 0 && (
                <span className="nav-count">{openTasks.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="parts-heading">
          <h2>Onderdelen</h2>
          <button
            className="icon-button"
            aria-label="Onderdeel toevoegen"
            title="Onderdeel toevoegen"
            onClick={() => openModal("asset")}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="parts-list">
          {dossier.assets.map((asset) => (
            <button
              key={asset.id}
              className={selectedId === asset.id ? "part active" : "part"}
              onClick={() => {
                select(asset.id);
                setPage("model");
                setMobileMenu(false);
              }}
            >
              {assetIcon(asset.kind, 16)}
              <span>{asset.name}</span>
              {asset.position && <MapPin size={12} className="part-pin" />}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <LockKeyhole size={17} />
          <div>
            <strong>Voor onszelf</strong>
            <span>Lokaal op deze computer</span>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigatie"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>Mijn huisdossier</span>
            <ChevronRight size={14} />
            <strong>{data?.house.name ?? "Ons huis"}</strong>
          </div>
          <span className="local-label">
            <LockKeyhole size={14} /> Eigen gebruik
          </span>
        </header>
        <div className="page-heading">
          <div>
            <div className="location-line">
              <MapPin size={15} />{" "}
              {data ? `${data.house.postcode} ${data.house.city}` : "Utrecht"}
            </div>
            <h1>{data?.house.address ?? "Ons huis"}</h1>
            <p>Alles wat je huis je kan vertellen, op één plek.</p>
          </div>
          <div className="heading-actions">
            <a
              className="button secondary"
              href={houseId ? `${api}/export` : undefined}
            >
              <Download size={16} /> Exporteer dossier
            </a>
            <button
              className="button primary"
              onClick={() => openModal(page === "tasks" ? "task" : "upload")}
            >
              <Plus size={18} />
              {page === "tasks" ? "Melding toevoegen" : "Bestand toevoegen"}
            </button>
          </div>
        </div>
        {error && (
          <div className="alert error" role="alert">
            <Info size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Sluit foutmelding"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {placing && (
          <div className="alert placing-alert">
            <MapPin size={18} />
            <span>
              Wijs een plek op de buitenzijde aan voor{" "}
              <strong>{selected?.name}</strong>. Dit is een handmatige
              markering.
            </span>
            <button onClick={() => setPlacing(false)}>Annuleren</button>
          </div>
        )}
        {!data ? (
          <div className="loading">
            <LoaderCircle className="spin" size={30} />
            <h2>Je huis wordt klaargezet</h2>
            <p>
              {error
                ? "Controleer of het model is geïmporteerd met npm run import:house."
                : "Gebouwmodel en dossier laden…"}
            </p>
          </div>
        ) : (
          <>
            {page === "model" && (
              <>
                <div className="model-layout">
                  <Suspense
                    fallback={
                      <div className="loading">
                        <LoaderCircle className="spin" size={28} />
                        <p>3D-model laden…</p>
                      </div>
                    }
                  >
                    <Viewer
                      data={data}
                      assets={dossier.assets}
                      selected={selected}
                      onSelect={select}
                      placing={placing}
                      onPlace={place}
                      onError={reportError}
                    />
                  </Suspense>
                  <aside
                    className="inspector"
                    aria-label="Geselecteerd onderdeel"
                  >
                    <div className="inspector-heading">
                      <span className="part-icon">
                        {assetIcon(selected?.kind ?? "gebouw", 23)}
                      </span>
                      <div>
                        <span className="subtle-label">
                          {kindName[selected?.kind ?? "gebouw"]}
                        </span>
                        <h2>{selected?.name}</h2>
                      </div>
                      <button
                        className="icon-button"
                        title="Onderdeel bewerken"
                        aria-label="Onderdeel bewerken"
                        onClick={() => openModal("edit")}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    <div
                      className="inspector-tabs"
                      role="tablist"
                      aria-label="Onderdeelinformatie"
                    >
                      {[
                        ["details", "Overzicht"],
                        ["files", `Bestanden (${relatedFiles.length})`],
                        ["tasks", `Onderhoud (${relatedTasks.length})`],
                      ].map(([id, label]) => (
                        <button
                          role="tab"
                          aria-selected={inspectorTab === id}
                          key={id}
                          onClick={() => setInspectorTab(id)}
                          className={inspectorTab === id ? "active" : ""}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="inspector-body" role="tabpanel">
                      {inspectorTab === "details" && (
                        <>
                          <p className="part-description">
                            {selected?.description}
                          </p>
                          {selected?.kind === "gebouw" && (
                            <dl className="facts">
                              <div>
                                <dt>Bouwjaar volgens BAG</dt>
                                <dd>{data.house.buildingYear ?? "Onbekend"}</dd>
                              </div>
                              <div>
                                <dt>Gebruiksoppervlakte woning</dt>
                                <dd>{data.house.area ?? "—"} m²</dd>
                              </div>
                              <div>
                                <dt>Geometrie</dt>
                                <dd>Buitenzijde · LoD 2.2</dd>
                              </div>
                              <div>
                                <dt>Interieur</dt>
                                <dd>Nog vast te leggen</dd>
                              </div>
                            </dl>
                          )}
                          {!["gebouw", "dak", "gevel"].includes(
                            selected?.kind ?? "",
                          ) && (
                            <div className="location-note">
                              <MapPin size={18} />
                              <div>
                                <strong>
                                  {selected?.position
                                    ? "Plek aangewezen"
                                    : "Exacte plek nog onbekend"}
                                </strong>
                                <p>
                                  {selected?.position
                                    ? "Handmatig gemarkeerd op het gebouw."
                                    : "Voeg een foto toe om dit onderdeel herkenbaar te maken."}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="inspector-section">
                            <h3>Bij dit onderdeel</h3>
                            <button
                              className="info-row"
                              onClick={() => setInspectorTab("files")}
                            >
                              <FolderOpen size={17} />
                              <span>Foto’s & documenten</span>
                              <strong>{relatedFiles.length}</strong>
                              <ChevronRight size={15} />
                            </button>
                            <button
                              className="info-row"
                              onClick={() => setInspectorTab("tasks")}
                            >
                              <Wrench size={17} />
                              <span>Onderhoud & meldingen</span>
                              <strong>{relatedTasks.length}</strong>
                              <ChevronRight size={15} />
                            </button>
                          </div>
                          <button
                            className="button full secondary"
                            onClick={() => {
                              setPlacing(!placing);
                              setPage("model");
                            }}
                          >
                            <LocateFixed size={16} />
                            {placing
                              ? "Stop met aanwijzen"
                              : selected?.position
                                ? "Plek opnieuw aanwijzen"
                                : "Plek op gebouw aanwijzen"}
                          </button>
                          {selected?.position && (
                            <button
                              className="text-button full"
                              disabled={busy}
                              onClick={() =>
                                save(
                                  () =>
                                    request(`${api}/assets/${selected.id}`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        name: selected.name,
                                        description: selected.description,
                                        position: null,
                                      }),
                                    }),
                                  "Markering verwijderd",
                                )
                              }
                            >
                              Markering verwijderen
                            </button>
                          )}
                        </>
                      )}
                      {inspectorTab === "files" &&
                        (relatedFiles.length ? (
                          <Files files={relatedFiles} compact />
                        ) : (
                          <Empty
                            icon={<FolderOpen size={28} />}
                            title="Nog geen bestanden"
                            text="Bewaar hier een foto, handleiding of factuur."
                            action="Bestand toevoegen"
                            onAction={() => openModal("upload")}
                          />
                        ))}
                      {inspectorTab === "files" && relatedFiles.length > 0 && (
                        <button
                          className="button secondary full"
                          onClick={() => openModal("upload")}
                        >
                          <Plus size={16} />
                          Bestand toevoegen
                        </button>
                      )}
                      {inspectorTab === "tasks" &&
                        (relatedTasks.length ? (
                          <TaskList tasks={relatedTasks} compact />
                        ) : (
                          <Empty
                            icon={<Wrench size={27} />}
                            title="Nog geen onderhoud"
                            text="Leg een probleem vast of plan een onderhoudsbeurt."
                            action="Melding toevoegen"
                            onAction={() => openModal("task")}
                          />
                        ))}
                      {inspectorTab === "tasks" && relatedTasks.length > 0 && (
                        <button
                          className="button secondary full"
                          onClick={() => openModal("task")}
                        >
                          <Plus size={16} />
                          Melding toevoegen
                        </button>
                      )}
                    </div>
                    <div className="inspector-foot">
                      <Info size={15} />
                      <span>Je dossier groeit met wat je toevoegt.</span>
                    </div>
                  </aside>
                </div>
                <div className="model-caption">
                  <Info size={18} />
                  <p>
                    <strong>Een eerste laag van je huis.</strong> Het model
                    toont het hele pand
                    {data.house.buildingUnitCount
                      ? ` met ${data.house.buildingUnitCount} verblijfsobjecten`
                      : ""}
                    . De binnenindeling, ramen en materialen zijn nog niet
                    vastgelegd. Foto’s en scans maken het straks persoonlijker.
                  </p>
                  <button onClick={() => setPage("sources")}>
                    Bekijk bronnen <ExternalLink size={14} />
                  </button>
                </div>
                <div className="below-model">
                  <div>
                    <h2>Maak er jullie huisdossier van</h2>
                    <p>
                      Begin bij de plekken waar je later iets over wilt
                      terugvinden.
                    </p>
                  </div>
                  <div className="starter-links">
                    {dossier.assets
                      .filter((a) => a.kind === "installatie")
                      .slice(0, 3)
                      .map((a) => (
                        <button key={a.id} onClick={() => select(a.id)}>
                          <span className="starter-icon">
                            {assetIcon(a.kind)}
                          </span>
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {
                                dossier.attachments.filter(
                                  (f) => f.assetId === a.id,
                                ).length
                              }{" "}
                              bestanden
                            </small>
                          </span>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
            {page === "files" && (
              <section className="content-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      Foto’s & documenten{" "}
                      <span>{dossier.attachments.length}</span>
                    </h2>
                    <p>
                      Handleidingen, foto’s en facturen, gekoppeld aan je huis.
                    </p>
                  </div>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder="Zoek een bestand"
                  />
                </div>
                {filteredFiles.length ? (
                  <Files files={filteredFiles} />
                ) : (
                  <Empty
                    icon={<FolderOpen size={36} />}
                    title={
                      query
                        ? "Geen bestanden gevonden"
                        : "Je eerste stukje huiskennis"
                    }
                    text={
                      query
                        ? "Probeer een andere zoekterm."
                        : "Voeg bijvoorbeeld een foto van de elektriciteitskast of de handleiding van de oven toe."
                    }
                    action={query ? undefined : "Bestand toevoegen"}
                    onAction={() => openModal("upload")}
                  />
                )}
              </section>
            )}
            {page === "tasks" && (
              <section className="content-panel">
                <div className="section-heading">
                  <div>
                    <h2>Onderhoud & meldingen</h2>
                    <p>Wat aandacht vraagt en wat er al is gedaan.</p>
                  </div>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder="Zoek in onderhoud"
                  />
                </div>
                <div className="task-filter segmented">
                  {[
                    ["open", `Open (${openTasks.length})`],
                    [
                      "done",
                      `Uitgevoerd (${dossier.tasks.length - openTasks.length})`,
                    ],
                    ["all", "Alles"],
                  ].map(([id, label]) => (
                    <button
                      className={taskFilter === id ? "active" : ""}
                      key={id}
                      onClick={() => setTaskFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredTasks.length ? (
                  <TaskList tasks={filteredTasks} />
                ) : (
                  <Empty
                    icon={<Wrench size={36} />}
                    title={
                      query
                        ? "Geen meldingen gevonden"
                        : taskFilter === "done"
                          ? "Nog geen uitgevoerd onderhoud"
                          : "Alles begint met een melding"
                    }
                    text={
                      query
                        ? "Probeer een andere zoekterm."
                        : "Noteer wat je opmerkt, koppel het aan een onderdeel en houd de opvolging bij."
                    }
                    action="Melding toevoegen"
                    onAction={() => openModal("task")}
                  />
                )}
              </section>
            )}
            {page === "sources" && (
              <section className="sources-layout">
                <div className="content-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Waar komt het model vandaan?</h2>
                      <p>
                        Open gebouwdata, gekoppeld aan het geverifieerde
                        BAG-adres.
                      </p>
                    </div>
                    <Database size={25} />
                  </div>
                  <div className="source-block">
                    <span className="source-number">BAG</span>
                    <div>
                      <h3>Het adres en het pand</h3>
                      <p>
                        Het verblijfsobject van {data.house.address} is via de
                        officiële BAG-relatie gekoppeld aan dit pand.{" "}
                        {data.house.buildingUnitCount &&
                        data.house.buildingUnitCount > 1
                          ? `In dit pand zitten ${data.house.buildingUnitCount} verblijfsobjecten; de 3D-buitenzijde is gedeeld.`
                          : "Het model toont de geregistreerde buitenzijde."}
                      </p>
                      <dl className="facts">
                        <div>
                          <dt>Verblijfsobject van de woning</dt>
                          <dd className="identifier">{data.house.bagVboId}</dd>
                        </div>
                        <div>
                          <dt>Pand</dt>
                          <dd className="identifier">{data.house.bagPandId}</dd>
                        </div>
                        <div>
                          <dt>Bouwjaar (registratie)</dt>
                          <dd>{data.house.buildingYear}</dd>
                        </div>
                        <div>
                          <dt>Gebruiksoppervlakte nummer 17</dt>
                          <dd>{data.house.area} m²</dd>
                        </div>
                      </dl>
                      <a
                        href={data.source.urls[0]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bekijk BAG-bron <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  <div className="source-block">
                    <span className="source-number">3D</span>
                    <div>
                      <h3>3DBAG: de buitenzijde</h3>
                      <p>
                        Een gereconstrueerd model op basis van BAG en
                        hoogtegegevens. Het is geen bouwkundige inmeting.
                        Materiaal, ramen, deuren en de indeling binnen zijn nog
                        niet opgenomen.
                      </p>
                      <dl className="facts">
                        <div>
                          <dt>Detailniveau</dt>
                          <dd>LoD 2.2</dd>
                        </div>
                        <div>
                          <dt>Hoogtebron</dt>
                          <dd>
                            {String(
                              data.buildings.find((b) => b.target)?.attributes
                                .b3_pw_bron ?? "Onbekend",
                            ).toUpperCase()}{" "}
                            · opnamejaar{" "}
                            {String(
                              data.buildings.find((b) => b.target)?.attributes
                                .b3_pw_datum ?? "onbekend",
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Opgehaald op</dt>
                          <dd>{formatDate(data.source.fetchedAt)}</dd>
                        </div>
                        <div>
                          <dt>Licentie</dt>
                          <dd>CC BY 4.0</dd>
                        </div>
                      </dl>
                      <a
                        href={data.source.urls[2]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bekijk het oorspronkelijke 3D-model{" "}
                        <ExternalLink size={14} />
                      </a>
                      <p className="attribution">
                        3DBAG door TU Delft 3D geoinformation en 3DGI. BAG via
                        PDOK / Kadaster (Public Domain Mark 1.0).
                      </p>
                    </div>
                  </div>
                </div>
                <aside className="next-step-panel">
                  <Box size={31} strokeWidth={1.3} />
                  <h2>Van gebouw naar jullie huis</h2>
                  <p>De volgende laag komt van jullie eigen materiaal.</p>
                  <ul>
                    <li>Een plattegrond voor de binnenindeling</li>
                    <li>Foto’s van gevels en ruimtes</li>
                    <li>Scans voor meer detail</li>
                    <li>Toestelgegevens en onderhoudshistorie</li>
                  </ul>
                  <button
                    className="button primary full"
                    onClick={() => openModal("upload")}
                  >
                    <Upload size={16} /> Voeg materiaal toe
                  </button>
                  <p className="small-note">
                    Je uploads en meldingen blijven lokaal. Ze worden niet naar
                    GitHub verstuurd.
                  </p>
                </aside>
              </section>
            )}
          </>
        )}
        <footer className="page-footer">
          <span>GeoKari Huisdossier</span>
          <span>Ruimtelijke kennis, dichtbij huis.</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            {
              asset: "Onderdeel toevoegen",
              upload: "Bestanden toevoegen",
              task: "Onderhoud of melding",
              edit: "Onderdeel bewerken",
            }[modal]
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (modal === "asset") {
                let createdId = "";
                const ok = await save(async () => {
                  const result = await request<{ id: string }>(
                    `${api}/assets`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        name: form.get("name"),
                        kind: form.get("kind"),
                        description: form.get("description"),
                      }),
                    },
                  );
                  createdId = result.id;
                }, "Onderdeel toegevoegd");
                if (ok) {
                  select(createdId);
                  setPage("model");
                }
              } else if (modal === "edit" && selected)
                await save(
                  () =>
                    request(`${api}/assets/${selected.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        name: form.get("name"),
                        description: form.get("description"),
                        position: selected.position,
                      }),
                    }),
                  "Onderdeel bijgewerkt",
                );
              else if (modal === "task")
                await save(
                  () =>
                    request(`${api}/tasks`, {
                      method: "POST",
                      body: JSON.stringify({
                        title: form.get("title"),
                        description: form.get("description"),
                        date: form.get("date"),
                        assetId: form.get("assetId"),
                      }),
                    }),
                  "Melding opgeslagen",
                );
              else if (modal === "upload") {
                const assetId = String(form.get("assetId"));
                const files = form
                  .getAll("file")
                  .filter((f): f is File => f instanceof File && f.size > 0);
                if (!files.length) {
                  setError("Kies ten minste één bestand.");
                  return;
                }
                if (files.some((f) => f.size > 25 * 1024 * 1024)) {
                  setError("Een bestand mag maximaal 25 MB zijn.");
                  return;
                }
                await save(
                  async () => {
                    for (const file of files) {
                      const upload = new FormData();
                      upload.set("file", file);
                      await request(`${api}/assets/${assetId}/files`, {
                        method: "POST",
                        body: upload,
                      });
                    }
                  },
                  `${files.length === 1 ? "Bestand" : "Bestanden"} toegevoegd`,
                );
              }
            }}
          >
            {(modal === "upload" || modal === "task") && (
              <label>
                Bij welk onderdeel?
                <select name="assetId" defaultValue={selectedId} required>
                  {dossier.assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(modal === "asset" || modal === "edit") && (
              <label>
                Naam
                <input
                  name="name"
                  defaultValue={modal === "edit" ? selected?.name : ""}
                  placeholder="Bijvoorbeeld: cv-ketel"
                  maxLength={200}
                  required
                  autoFocus
                />
              </label>
            )}
            {modal === "asset" && (
              <label>
                Soort onderdeel
                <select name="kind" defaultValue="installatie">
                  {Object.entries(kindName).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {modal === "task" && (
              <>
                <label>
                  Wat moet er gebeuren?
                  <input
                    name="title"
                    placeholder="Bijvoorbeeld: ventilatie controleren"
                    maxLength={200}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Datum
                  <input
                    type="date"
                    name="date"
                    defaultValue={localDate()}
                    required
                  />
                </label>
              </>
            )}
            {modal !== "upload" && (
              <label>
                {modal === "task" ? "Toelichting" : "Wat weet je al?"}
                <textarea
                  name="description"
                  rows={4}
                  maxLength={10000}
                  defaultValue={modal === "edit" ? selected?.description : ""}
                  placeholder={
                    modal === "task"
                      ? "Wat viel op? Wie gaat ermee aan de slag?"
                      : "Bijvoorbeeld merk, type, locatie of wat je wilt onthouden."
                  }
                />
              </label>
            )}
            {modal === "upload" && (
              <>
                <label className="upload-area">
                  <Upload size={29} />
                  <strong>Kies foto’s of documenten</strong>
                  <span>Maximaal 25 MB per bestand</span>
                  <input type="file" name="file" multiple required />
                </label>
                <p className="form-note">
                  Bestanden worden op deze computer opgeslagen en gekoppeld aan
                  het gekozen onderdeel.
                </p>
              </>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Annuleren
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Opslaan…
                  </>
                ) : modal === "upload" ? (
                  <>
                    <Upload size={16} />
                    Bestanden opslaan
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Opslaan
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {lightbox && (
        <Dialog title={lightbox.name} onClose={() => setLightbox(null)} wide>
          <img
            className="lightbox-image"
            src={lightbox.url}
            alt={lightbox.name}
          />
          <a
            className="button secondary"
            href={`${lightbox.url}?download=1`}
            download
          >
            <Download size={16} /> Download origineel
          </a>
        </Dialog>
      )}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      close.current();
    };
    element?.addEventListener("cancel", cancel);
    return () => {
      element?.removeEventListener("cancel", cancel);
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={wide ? "dialog wide" : "dialog"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Sluiten" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
