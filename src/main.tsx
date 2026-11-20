import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  FolderOpen,
  Wrench,
  Database,
  Plus,
  Download,
  MapPin,
  ChevronRight,
  Box,
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
  LoaderCircle,
  Footprints,
} from "lucide-react";
import { request } from "./api";
import { DocumentReader, categoryName } from "./DocumentReader";
import { DossierHome } from "./DossierHome";
import { FurnishingChoice } from "./FurnishingChoice";
import { LightingControls } from "./LightingControls";
import { defaultLightingSettings } from "./lighting";
import { floorplanForView } from "./furnishings";
import type { FurnishingView } from "./furnishings";
import { assetIcon, kindName } from "./dossierDisplay";
import {
  resolveHouseId,
  resolveHousePage,
  housePageUrl,
  readWorkspaceSelection,
  workspaceSelectionUrl,
} from "./houseSelection";
import type {
  HouseData,
  HouseAppearance,
  Attachment,
  Task,
  Dossier,
  Point,
  Floorplan,
  LightingEnvironment,
} from "./types";
import {
  WorkspaceNavigation,
  WorkspaceHeader,
  WorkspacePageHeading,
  pageInfo,
} from "./WorkspaceChrome";
import { FileLibrary } from "./FileLibrary";
import { Dialog } from "./Dialog";
import { CapturePage } from "./CapturePage";
import { ManagementPage } from "./ManagementPage";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import "./style.css";
import "./workspace.css";
import "./management.css";
const Viewer = lazy(() =>
  import("./Viewer").then((module) => ({ default: module.Viewer })),
);
const InteriorViewer = lazy(() =>
  import("./InteriorViewer").then((module) => ({
    default: module.InteriorViewer,
  })),
);

type Page =
  | "dossier"
  | "model"
  | "interior"
  | "files"
  | "tasks"
  | "sources"
  | "capture"
  | "manage";
type Modal = "asset" | "upload" | "task" | "task-edit" | "edit" | null;
const formatDate = (date: string) =>
  !date
    ? "Nog te plannen"
    : new Date(
        date.length === 10 ? `${date}T12:00:00` : date,
      ).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
function App() {
  const [lighting, setLighting] = useState<LightingEnvironment | null>(null);
  const [lightSettings, setLightSettings] = useState(defaultLightingSettings);
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [furnishingView, setFurnishingView] =
    useState<FurnishingView>("furnished");
  const displayPlan = useMemo(
    () => (floorplan ? floorplanForView(floorplan, furnishingView) : null),
    [floorplan, furnishingView],
  );
  const [appearance, setAppearance] = useState<HouseAppearance | null>(null);
  const [houseId, setHouseId] = useState("");
  const [houses, setHouses] = useState<
    { id: string; name: string; address: string; city: string }[]
  >([]);
  const [data, setData] = useState<HouseData | null>(null);
  const [dossier, setDossier] = useState<Dossier>({
    assets: [],
    attachments: [],
    tasks: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [page, setPageState] = useState<Page>(() =>
    resolveHousePage(window.location.href),
  );
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
  const [readerId, setReaderId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [scope, setScope] = useState("");
  const [category, setCategory] = useState("");
  const [libraryView, setLibraryView] = useState<"list" | "gallery">("list");
  const [searchHits, setSearchHits] = useState<
    { id: string; snippet: string }[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [initialRoom, setInitialRoom] = useState<string | undefined>();
  const reader = dossier.attachments.find((f) => f.id === readerId);
  const selected = dossier.assets.find((a) => a.id === selectedId);
  const api = `/api/houses/${houseId}`;
  const reportError = useCallback((message: string) => setError(message), []);
  const activeHouse = useRef(houseId);
  activeHouse.current = houseId;
  const setPage = (next: Page) => {
    if (next !== page && houseId)
      history.pushState(
        null,
        "",
        housePageUrl(window.location.href, houseId, next),
      );
    setPageState(next);
    setMobileMenu(false);
  };
  useEffect(() => {
    if (!houses.length) return;
    const restore = () => {
      setHouseId(resolveHouseId(houses, window.location.href, null));
      setPageState(resolveHousePage(window.location.href));
      setMobileMenu(false);
      const route = readWorkspaceSelection(
        window.location.href,
        dossier.assets,
      );
      setSelectedId(route.part || `${houseId}:building`);
      setQuery(route.query);
      setScope(route.scope);
      setCategory(route.category);
      setTaskFilter(route.status);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [houses, dossier.assets, houseId]);
  useEffect(() => {
    if (!mobileMenu) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenu(false);
        document.querySelector<HTMLButtonElement>(".mobile-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [mobileMenu]);
  const refresh = useCallback(async () => {
    if (houseId) {
      const records = await request<Dossier>(`/api/houses/${houseId}/dossier`);
      if (activeHouse.current === houseId) setDossier(records);
    }
  }, [houseId]);

  useEffect(() => {
    request<typeof houses>("/api/houses")
      .then((items) => {
        setHouses(items);
        let stored: string | null = null;
        try {
          stored = localStorage.getItem("huisdossier:house");
        } catch {
          /* storage optional */
        }
        setHouseId(resolveHouseId(items, window.location.href, stored));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!houseId || data?.house.id !== houseId) return;
    history.replaceState(
      null,
      "",
      workspaceSelectionUrl(window.location.href, houseId, page, {
        part: selectedId,
        scope,
        category,
        query,
        status: taskFilter,
      }),
    );
    try {
      localStorage.setItem("huisdossier:house", houseId);
    } catch {
      /* selection still works */
    }
  }, [
    houseId,
    data?.house.id,
    page,
    selectedId,
    scope,
    category,
    query,
    taskFilter,
  ]);
  useEffect(() => {
    if (!houseId) return;
    try {
      setFurnishingView(
        localStorage.getItem(`huisdossier:view:${houseId}`) === "unfurnished"
          ? "unfurnished"
          : "furnished",
      );
    } catch {
      setFurnishingView("furnished");
    }
    let cancelled = false;
    setData(null);
    setError("");
    setNotice("");
    setSelectedId("");
    setMobileMenu(false);
    setAppearance(null);
    setFloorplan(null);
    setLighting(null);
    setLightSettings(defaultLightingSettings());
    setDossier({ assets: [], attachments: [], tasks: [] });
    setPlacing(false);
    setReaderId(null);
    setLightbox(null);
    setModal(null);
    setCompletingTask(null);
    setQuery("");
    setScope("");
    setCategory("");
    setLibraryView("list");
    setSearchHits(null);
    setInitialRoom(undefined);
    Promise.all([
      request<HouseData>(`/api/houses/${houseId}/model`),
      request<Dossier>(`/api/houses/${houseId}/dossier`),
      request<HouseAppearance | null>(`/api/houses/${houseId}/appearance`),
      request<Floorplan | null>(`/api/houses/${houseId}/floorplan`),
      request<LightingEnvironment | null>(`/api/houses/${houseId}/lighting`),
    ])
      .then(([model, records, finish, plan, light]) => {
        if (!cancelled) {
          setData(model);
          setAppearance(finish);
          setFloorplan(plan);
          setLighting(light);
          setLightSettings((s) => ({
            ...s,
            selectedLampId: light?.lamps[0]?.id ?? "",
          }));
          document.title = `${model.house.address} · Geokari Huisdossier`;
          setDossier(records);
          const route = readWorkspaceSelection(
            window.location.href,
            records.assets,
          );
          setSelectedId(route.part || `${houseId}:building`);
          setQuery(route.query);
          setScope(route.scope);
          setCategory(route.category);
          setTaskFilter(route.status);
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
    if (!houseId || page !== "files" || !query.trim()) {
      setSearchHits(null);
      setSearching(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    setSearchHits(null);
    const timer = setTimeout(() => {
      request<{ id: string; snippet: string }[]>(
        `${api}/search?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      )
        .then(setSearchHits)
        .catch((e) => {
          if (!controller.signal.aborted) setSearchError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [houseId, api, page, query, dossier.attachments]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title = `${pageInfo[page].title}${data ? ` · ${data.house.address}` : ""} · Geokari`;
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }, [page, data]);

  const select = (id: string) => {
    setSelectedId(id);
    setPlacing(false);
    setInspectorTab("details");
  };
  const inspectSpatial = (id: string) => {
    if (!dossier.assets.some((asset) => asset.id === id)) return;
    select(id);
    requestAnimationFrame(() => {
      const heading = document.getElementById("spatial-part-title");
      heading?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1000px)").matches)
        document
          .getElementById("spatial-inspector")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const openDossier = (id: string) => {
    select(id);
    setPage("dossier");
    setMobileMenu(false);
    if (window.matchMedia("(max-width: 850px)").matches)
      requestAnimationFrame(() =>
        document.getElementById("dossier-detail")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        }),
      );
  };
  const showFiles = (assetId = "") => {
    setScope(assetId);
    setQuery("");
    setCategory("");
    setPage("files");
  };
  const showTasks = (assetId = "") => {
    setScope(assetId);
    setQuery("");
    setPage("tasks");
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
                task.status === "open"
                  ? setCompletingTask(task)
                  : save(
                      () =>
                        request(`${api}/tasks/${task.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            status: "open",
                          }),
                        }),
                      "Melding heropend",
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

              <span className="task-meta">
                {dossier.assets.find((a) => a.id === task.assetId)?.name}{" "}
                <span>·</span>{" "}
                {task.status === "done"
                  ? `Afgerond: ${task.completedAt || task.date ? formatDate(task.completedAt || task.date) : "datum niet vastgelegd"}`
                  : formatDate(task.date)}
                {task.owner && (
                  <>
                    {" "}
                    ·{" "}
                    {dossier.people?.find(
                      (person) => person.id === task.assigneeId,
                    )?.name ?? task.owner}
                  </>
                )}
              </span>
              {(task.description ||
                task.source ||
                task.result ||
                dossier.attachments.some(
                  (file) => file.taskId === task.id,
                )) && (
                <details className="task-details">
                  <summary>Toelichting{task.source ? " & bron" : ""}</summary>
                  {task.result && (
                    <p>
                      <strong>Uitvoering:</strong> {task.result}
                      {task.completedById && (
                        <>
                          {" "}
                          ·{" "}
                          {dossier.people?.find(
                            (person) => person.id === task.completedById,
                          )?.name ?? "Persoon niet bekend"}
                        </>
                      )}
                    </p>
                  )}
                  {task.description && <p>{task.description}</p>}
                  {dossier.attachments
                    .filter((file) => file.taskId === task.id)
                    .map((file) => (
                      <button
                        key={file.id}
                        className="text-link task-evidence"
                        onClick={() =>
                          /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)
                            ? setLightbox(file)
                            : setReaderId(file.id)
                        }
                      >
                        Bekijk bijlage: {file.name}
                      </button>
                    ))}
                  {task.source && (
                    <div className="task-source">
                      {task.sourceId &&
                      dossier.attachments.some(
                        (f) => f.id === task.sourceId,
                      ) ? (
                        <button
                          className="text-link"
                          onClick={() => setReaderId(task.sourceId!)}
                        >
                          Bekijk bron
                        </button>
                      ) : (
                        <span>Bron: {task.source}</span>
                      )}
                      {task.sourceDate && (
                        <span> · {formatDate(task.sourceDate)}</span>
                      )}
                    </div>
                  )}
                </details>
              )}
            </div>
            <span
              className={`badge ${task.status === "done" ? "green" : "amber"}`}
            >
              {task.status === "done"
                ? "Afgerond"
                : task.state === "hold"
                  ? "Wacht op"
                  : task.state === "verify"
                    ? "Controleren"
                    : "Open"}
            </span>
            <button
              className="icon-button"
              aria-label={`Bewerk ${task.title}`}
              onClick={() => {
                setEditingTask(task);
                openModal("task-edit");
              }}
            >
              <Pencil size={16} />
            </button>
          </article>
        ))}
      </div>
    );
  }
  const filteredFiles = dossier.attachments
    .filter((f) => !scope || f.assetId === scope)
    .filter((f) => !category || f.category === category)
    .filter((f) => !query.trim() || searchHits?.some((h) => h.id === f.id));
  const filteredTasks = dossier.tasks
    .filter((t) => !scope || t.assetId === scope)
    .filter(
      (t) =>
        taskFilter === "all" ||
        (taskFilter === "hold" || taskFilter === "verify"
          ? t.status === "open" && t.state === taskFilter
          : t.status === taskFilter),
    )
    .filter((t) =>
      `${t.title} ${t.description} ${t.owner ?? ""} ${dossier.assets.find((a) => a.id === t.assetId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const openTasks = dossier.tasks.filter((t) => t.status === "open");
  const relatedFiles = dossier.attachments.filter(
    (f) => f.assetId === selectedId,
  );
  const relatedTasks = dossier.tasks.filter((t) => t.assetId === selectedId);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        Naar de inhoud
      </a>
      <WorkspaceNavigation
        houseId={houseId}
        page={page}
        count={openTasks.length}
        mobile={mobileMenu}
        onClose={() => setMobileMenu(false)}
        onNavigate={(next) => {
          setPage(next);
          setQuery("");
          setScope("");
          setCategory("");
        }}
      />
      <main
        className="workspace"
        id="workspace-content"
        tabIndex={-1}
        inert={mobileMenu}
      >
        <WorkspaceHeader
          houses={houses}
          houseId={houseId}
          mobile={mobileMenu}
          onMenu={() => setMobileMenu(!mobileMenu)}
          onExport={houseId ? `${api}/export` : "#"}
          onHouse={(id) => {
            history.pushState(
              null,
              "",
              workspaceSelectionUrl(window.location.href, id, "model", {
                part: "",
                scope: "",
                category: "",
                query: "",
                status: "open",
              }),
            );
            setHouseId(id);
            setPageState("model");
          }}
        />
        <WorkspacePageHeading
          page={page}
          onAdd={() =>
            openModal(
              page === "tasks"
                ? "task"
                : page === "dossier"
                  ? "asset"
                  : "upload",
            )
          }
        />
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
                ? "Het woningmodel kon niet worden geladen. Herlaad de pagina om het opnieuw te proberen."
                : "Gebouwmodel en dossier laden…"}
            </p>
          </div>
        ) : (
          <>
            {(page === "model" || page === "interior") && (
              <div className="model-settings">
                {" "}
                {floorplan && (
                  <FurnishingChoice
                    value={furnishingView}
                    onChange={(view) => {
                      setFurnishingView(view);
                      try {
                        localStorage.setItem(
                          `huisdossier:view:${houseId}`,
                          view,
                        );
                      } catch {
                        /* The view still works when browser storage is disabled. */
                      }
                    }}
                  />
                )}
                <LightingControls
                  data={data}
                  profile={lighting}
                  settings={lightSettings}
                  onChange={setLightSettings}
                  onProfile={setLighting}
                  interiorAvailable={Boolean(floorplan && appearance?.rear)}
                />
              </div>
            )}
            {page === "capture" && (
              <CapturePage
                key={houseId}
                houseId={houseId}
                dossier={dossier}
                onSaved={refresh}
                onOpenDossier={openDossier}
              />
            )}
            {page === "manage" && (
              <ManagementPage
                key={houseId}
                houseId={houseId}
                dossier={dossier}
                onRefresh={refresh}
                onFiles={showFiles}
                onEditTask={(task) => {
                  setEditingTask(task);
                  openModal("task-edit");
                }}
                onCapture={() => setPage("capture")}
              />
            )}
            {page === "dossier" && (
              <DossierHome
                dossier={dossier}
                selected={selected}
                floorplan={floorplan}
                onSelect={openDossier}
                onFiles={showFiles}
                onTasks={(id, filter = "open") => {
                  setTaskFilter(filter);
                  showTasks(id);
                }}
                onUpload={() => openModal("upload")}
                onTask={() => {
                  setEditingTask(null);
                  openModal("task");
                }}
                onAdd={() => openModal("asset")}
                onEdit={() => openModal("edit")}
                onDocument={setReaderId}
                onInterior={(id) => {
                  setInitialRoom(id);
                  setPage("interior");
                }}
                renderTasks={(tasks) => <TaskList tasks={tasks} compact />}
              />
            )}
            {page === "interior" &&
              (floorplan ? (
                <Suspense
                  fallback={
                    <div className="loading">
                      <LoaderCircle className="spin" size={28} />
                      <p>Interieur laden…</p>
                    </div>
                  }
                >
                  <InteriorViewer
                    data={data}
                    appearance={appearance}
                    lighting={lighting}
                    lightSettings={lightSettings}
                    key={`${houseId}:${initialRoom ?? "overview"}`}
                    plan={displayPlan!}
                    initialRoomId={initialRoom}
                    onDossier={(roomId) => {
                      const asset = dossier.assets.find(
                        (a) => a.kind === "ruimte" && a.roomId === roomId,
                      );
                      if (asset) openDossier(asset.id);
                    }}
                    dossierRooms={dossier.assets
                      .filter((a) => a.kind === "ruimte" && a.roomId)
                      .map((a) => a.roomId!)}
                  />
                </Suspense>
              ) : (
                <div className="loading">
                  <Footprints size={30} />
                  <h2>Nog geen interieur</h2>
                  <p>Voor deze woning is nog geen plattegrond uitgewerkt.</p>
                </div>
              ))}
            {page === "model" && (
              <>
                <div className="spatial-part-picker">
                  <label htmlFor="spatial-part">
                    Kies een onderdeel of klik het aan in 3D
                  </label>
                  <select
                    id="spatial-part"
                    value={selectedId}
                    onChange={(event) => select(event.target.value)}
                  >
                    {dossier.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                      lighting={lighting}
                      lightSettings={lightSettings}
                      onNeighbors={(enabled) =>
                        setLightSettings((s) => ({ ...s, neighbors: enabled }))
                      }
                      data={data}
                      appearance={appearance}
                      floorplan={displayPlan}
                      onInterior={() => setPage("interior")}
                      assets={dossier.assets}
                      selected={selected}
                      onSelect={inspectSpatial}
                      placing={placing}
                      onPlace={place}
                      onError={reportError}
                    />
                  </Suspense>
                  <aside
                    id="spatial-inspector"
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
                        <h2 id="spatial-part-title" tabIndex={-1}>
                          {selected?.name}
                        </h2>
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
                      role="group"
                      aria-label="Onderdeelinformatie"
                    >
                      {[
                        ["details", "Overzicht"],
                        ["files", `Bestanden (${relatedFiles.length})`],
                        ["tasks", `Onderhoud (${relatedTasks.length})`],
                      ].map(([id, label]) => (
                        <button
                          aria-pressed={inspectorTab === id}
                          key={id}
                          onClick={() => setInspectorTab(id)}
                          className={inspectorTab === id ? "active" : ""}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="inspector-body">
                      <button
                        className="button secondary full spatial-dossier-link"
                        onClick={() => openDossier(selectedId)}
                      >
                        <FolderOpen size={16} /> Volledig dossier bekijken
                      </button>
                      {inspectorTab === "details" && (
                        <>
                          <details
                            className="part-description-collapsed"
                            key={selectedId}
                            open={(selected?.description?.length ?? 0) < 300}
                          >
                            <summary>Notities over dit onderdeel</summary>
                            <p className="part-description">
                              {selected?.description}
                            </p>
                          </details>
                          {selected?.kind === "gebouw" && (
                            <dl className="facts">
                              <div>
                                <dt>Bouwjaar (registratie)</dt>
                                <dd>{data.house.buildingYear ?? "Onbekend"}</dd>
                              </div>
                              <div>
                                <dt>Gebruiksoppervlakte woning</dt>
                                <dd>
                                  {data.house.area
                                    ? `${data.house.area} m²`
                                    : "Onbekend"}
                                </dd>
                              </div>
                              <div>
                                <dt>Geometrie</dt>
                                <dd>
                                  Buitenzijde ·{" "}
                                  {data.source.detailLevel ?? "LoD 2.2"}
                                </dd>
                              </div>
                              <div>
                                <dt>Interieur</dt>
                                <dd>
                                  {floorplan ? (
                                    <button
                                      className="text-link"
                                      onClick={() => setPage("interior")}
                                    >
                                      Binnen bekijken →
                                    </button>
                                  ) : (
                                    "Nog vast te leggen"
                                  )}
                                </dd>
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
                          <div className="spatial-preview">
                            {relatedFiles.length > 0 && (
                              <>
                                <h3>
                                  Foto’s & documenten ({relatedFiles.length})
                                </h3>
                                <FileLibrary
                                  files={relatedFiles.slice(0, 3)}
                                  assets={dossier.assets}
                                  compact
                                  snippets={[]}
                                  onDocument={setReaderId}
                                  onPhoto={setLightbox}
                                />
                                {relatedFiles.length > 3 && (
                                  <button
                                    className="text-link"
                                    onClick={() => setInspectorTab("files")}
                                  >
                                    Alle {relatedFiles.length} bestanden
                                    bekijken →
                                  </button>
                                )}
                              </>
                            )}
                            {!relatedFiles.length && (
                              <>
                                <h3>Foto’s & documenten</h3>
                                <p>Nog geen bestanden bij dit onderdeel.</p>
                              </>
                            )}
                            <h3>
                              Onderhoud & historie ({relatedTasks.length})
                            </h3>
                            {relatedTasks.length ? (
                              <TaskList
                                tasks={relatedTasks.slice(0, 3)}
                                compact
                              />
                            ) : (
                              <p>
                                Nog geen meldingen of uitgevoerd werk bij dit
                                onderdeel.
                              </p>
                            )}
                            {relatedTasks.length > 3 && (
                              <button
                                className="text-link"
                                onClick={() => setInspectorTab("tasks")}
                              >
                                Alle {relatedTasks.length} meldingen bekijken →
                              </button>
                            )}
                            <div className="spatial-add-actions">
                              <button
                                className="button secondary full"
                                onClick={() => openModal("upload")}
                              >
                                <Upload size={15} /> Bestand toevoegen
                              </button>
                              <button
                                className="button secondary full"
                                onClick={() => openModal("task")}
                              >
                                <Plus size={15} /> Melding toevoegen
                              </button>
                            </div>
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
                          <FileLibrary
                            files={relatedFiles}
                            assets={dossier.assets}
                            compact
                            snippets={[]}
                            onDocument={setReaderId}
                            onPhoto={setLightbox}
                          />
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
                      <button
                        className="text-link spatial-back"
                        onClick={() =>
                          document.querySelector(".viewer")?.scrollIntoView({
                            block: "start",
                            behavior: "instant",
                          })
                        }
                      >
                        Terug naar 3D ↑
                      </button>
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
                    .{" "}
                    {appearance
                      ? `De voorgevel is visueel gereconstrueerd uit je beelden. ${appearance.aerial ? "De bovenzijde van het dak gebruikt een luchtfoto. " : ""}Zijgevels en dakdetails zijn benaderd. ${floorplan ? "Je plattegrond is uitgewerkt onder Binnen kijken." : "Het interieur is nog niet vastgelegd."}`
                      : "De binnenindeling, ramen en materialen zijn nog niet vastgelegd. Foto’s en scans maken het straks persoonlijker."}
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
                      Bestanden van deze woning{" "}
                      <span>{dossier.attachments.length}</span>
                    </h2>
                  </div>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder="Zoek in bestanden en inhoud…"
                  />
                </div>
                <div className="dossier-filters">
                  <label>
                    Onderdeel
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="">Alle onderdelen</option>
                      {dossier.assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Categorie
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Alle categorieën</option>
                      {[
                        ...new Set(
                          dossier.attachments
                            .map((f) => f.category)
                            .filter((v): v is string => Boolean(v)),
                        ),
                      ]
                        .sort()
                        .map((c) => (
                          <option key={c} value={c}>
                            {categoryName[c] ?? c}
                          </option>
                        ))}
                    </select>
                  </label>
                  <span role="status">
                    {searching
                      ? "Inhoud doorzoeken…"
                      : `${filteredFiles.length} stukken`}
                  </span>
                </div>
                {(scope || category || query) && (
                  <button
                    className="text-link reset-filters"
                    onClick={() => {
                      setScope("");
                      setCategory("");
                      setQuery("");
                    }}
                  >
                    Wis zoekterm en filters
                  </button>
                )}
                {searchError && (
                  <p className="alert error" role="alert">
                    Zoeken mislukt: {searchError}
                  </p>
                )}
                {searching ? (
                  <p className="form-note">Documenten doorzoeken…</p>
                ) : filteredFiles.length ? (
                  <FileLibrary
                    files={filteredFiles}
                    view={libraryView}
                    onViewChange={setLibraryView}
                    assets={dossier.assets}
                    snippets={searchHits ?? []}
                    onDocument={setReaderId}
                    onPhoto={setLightbox}
                  />
                ) : (
                  <Empty
                    icon={<FolderOpen size={36} />}
                    title={
                      query || scope || category
                        ? "Geen bestanden binnen deze selectie"
                        : "Voeg je eerste bestand toe"
                    }
                    text={
                      query || scope || category
                        ? "Wis de filters of probeer een andere zoekterm."
                        : "Voeg bijvoorbeeld een foto van de elektriciteitskast of de handleiding van de oven toe."
                    }
                    action={
                      query || scope || category
                        ? "Filters wissen"
                        : "Bestand toevoegen"
                    }
                    onAction={() =>
                      query || scope || category
                        ? (setScope(""), setCategory(""), setQuery(""))
                        : openModal("upload")
                    }
                  />
                )}
              </section>
            )}
            {page === "tasks" && (
              <section className="content-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      Opvolging <span>{openTasks.length} open</span>
                    </h2>
                  </div>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder="Zoek in onderhoud…"
                  />
                </div>
                <div className="dossier-filters">
                  <label>
                    Onderdeel
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      <option value="">Alle onderdelen</option>
                      {dossier.assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span>{filteredTasks.length} aandachtspunten</span>
                </div>
                <div className="task-filter segmented">
                  {[
                    ["open", `Open (${openTasks.length})`],
                    [
                      "done",
                      `Uitgevoerd (${dossier.tasks.length - openTasks.length})`,
                    ],
                    ["all", "Alles"],
                    ["hold", "Wacht op"],
                    ["verify", "Controleren"],
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
                      query || scope
                        ? "Geen meldingen binnen deze selectie"
                        : taskFilter === "done"
                          ? "Nog geen uitgevoerd onderhoud"
                          : "Geen open meldingen in deze weergave"
                    }
                    text={
                      query || scope
                        ? "Wis de filters of probeer een andere zoekterm."
                        : "Je kunt een melding toevoegen of de uitgevoerde werkzaamheden bekijken."
                    }
                    action={
                      query || scope ? "Filters wissen" : "Melding toevoegen"
                    }
                    onAction={() =>
                      query || scope
                        ? (setScope(""), setQuery(""))
                        : openModal("task")
                    }
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
                        Open gebouwdata, gekoppeld aan de gecontroleerde
                        adreslocatie.
                      </p>
                    </div>
                    <Database size={25} />
                  </div>
                  {data.house.registry ? (
                    <div className="source-block">
                      <span className="source-number">GRB</span>
                      <div>
                        <h3>Het adres en het gebouw</h3>
                        <p>
                          {data.house.registry.name}: de adreslocatie ligt in de
                          gekozen gebouwcontour. Het objectnummer is ook in de
                          hoogtebron gecontroleerd.
                        </p>
                        <dl className="facts">
                          <div>
                            <dt>Adreslocatie-ID</dt>
                            <dd>{data.house.registry.addressId}</dd>
                          </div>
                          <div>
                            <dt>Gebouw</dt>
                            <dd>{data.house.registry.buildingId}</dd>
                          </div>
                          <div>
                            <dt>Coördinatenstelsel</dt>
                            <dd>{data.source.crs}</dd>
                          </div>
                        </dl>
                        <a
                          href={data.house.registry.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Bekijk adresbron <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ) : (
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
                            <dd className="identifier">
                              {data.house.bagVboId}
                            </dd>
                          </div>
                          <div>
                            <dt>Pand</dt>
                            <dd className="identifier">
                              {data.house.bagPandId}
                            </dd>
                          </div>
                          <div>
                            <dt>Bouwjaar (registratie)</dt>
                            <dd>{data.house.buildingYear}</dd>
                          </div>
                          <div>
                            <dt>Gebruiksoppervlakte van de woning</dt>
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
                  )}
                  <div className="source-block">
                    <span className="source-number">3D</span>
                    <div>
                      <h3>{data.source.title ?? "3DBAG"}: de buitenzijde</h3>
                      <p>
                        {data.source.description ?? (
                          <>
                            Een gereconstrueerd model op basis van BAG en
                            hoogtegegevens. Het is geen bouwkundige inmeting.
                            Het bronmodel bevat geen materialen, ramen, deuren
                            of binnenindeling. De aanvullende afwerking en het
                            interieur hebben eigen bronnen.
                          </>
                        )}
                      </p>
                      <dl className="facts">
                        <div>
                          <dt>Detailniveau</dt>
                          <dd>{data.source.detailLevel ?? "LoD 2.2"}</dd>
                        </div>
                        <div>
                          <dt>Hoogtebron</dt>
                          <dd>
                            {data.source.heightSource ?? (
                              <>
                                {String(
                                  data.buildings.find((b) => b.target)
                                    ?.attributes.b3_pw_bron ?? "Onbekend",
                                ).toUpperCase()}{" "}
                                · opnamejaar{" "}
                                {String(
                                  data.buildings.find((b) => b.target)
                                    ?.attributes.b3_pw_datum ?? "onbekend",
                                )}
                              </>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Opgehaald op</dt>
                          <dd>{formatDate(data.source.fetchedAt)}</dd>
                        </div>
                        <div>
                          <dt>Licentie</dt>
                          <dd>{data.source.license}</dd>
                        </div>
                      </dl>
                      <a
                        href={data.source.infoUrl ?? data.source.urls[2]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bekijk de modelbron <ExternalLink size={14} />
                      </a>
                      <p className="attribution">{data.source.attribution}</p>
                    </div>
                  </div>
                  {floorplan && (
                    <div className="source-block">
                      <span className="source-number">
                        <Footprints size={22} />
                      </span>
                      <div>
                        <h3>Plattegrond: één woonlaag</h3>
                        <details className="source-detail">
                          <summary>Herkomst, maten en aannames</summary>
                          <p>{floorplan.source}</p>
                          <p>{floorplan.description}</p>
                        </details>
                        <button
                          className="button secondary"
                          onClick={() => setPage("interior")}
                        >
                          <Footprints size={16} /> Binnen bekijken
                        </button>
                      </div>
                    </div>
                  )}
                  {appearance && (
                    <div className="source-block">
                      <span className="source-number">Foto</span>
                      <div>
                        <h3>{appearance.label}</h3>
                        <details className="source-detail">
                          <summary>Hoe de afwerking is opgebouwd</summary>
                          <p>{appearance.description}</p>
                        </details>
                        <a
                          href={appearance.front.texture}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Bekijk het gereconstrueerde gevelbeeld{" "}
                          <ExternalLink size={14} />
                        </a>
                        <p className="attribution">
                          {appearance.attribution} Het gevelbeeld blijft lokaal
                          en staat los van de geometrie en de open-datalicentie.
                        </p>
                        {appearance.aerial && (
                          <p>
                            <a
                              href={appearance.aerial.texture}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Bekijk de luchtfoto <ExternalLink size={14} />
                            </a>
                            <br />
                            <small>
                              {appearance.aerial.attribution}. Opgehaald op{" "}
                              {formatDate(appearance.aerial.fetchedAt)}. De foto
                              is op de bovenzijde van het dak geprojecteerd.
                              {appearance.aerial.nativeResolutionMetres &&
                                ` Bronresolutie: ${Number((appearance.aerial.nativeResolutionMetres * 100).toFixed(2)).toLocaleString("nl-NL")} cm per pixel.`}
                              {appearance.aerial.captureDate &&
                                ` Opname: ${formatDate(appearance.aerial.captureDate)}.`}
                              {appearance.aerial.license &&
                                ` ${appearance.aerial.license}.`}
                              {appearance.aerial.sourceUrl && (
                                <>
                                  {" "}
                                  <a
                                    href={appearance.aerial.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Bronmetadata
                                  </a>
                                </>
                              )}
                            </small>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <aside className="next-step-panel">
                  <Box size={31} strokeWidth={1.3} />
                  <h2>Het model aanvullen</h2>
                  <p>
                    Eigen materiaal helpt om de woning verder uit te werken.
                  </p>
                  <ul>
                    <li>
                      {floorplan
                        ? "Binnenindeling en rondlopen uit jullie plattegrond"
                        : "Een plattegrond voor de binnenindeling"}
                    </li>
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
                    Bestanden en meldingen blijven lokaal op deze computer.
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
      {completingTask && (
        <CompleteTaskDialog
          task={completingTask}
          people={dossier.people ?? []}
          onClose={() => setCompletingTask(null)}
          onComplete={async (values) => {
            const currentHouse = houseId;
            await request(`${api}/tasks/${completingTask.id}`, {
              method: "PATCH",
              body: JSON.stringify(values),
            });
            await refresh();
            if (activeHouse.current === currentHouse) {
              setCompletingTask(null);
              setNotice("Uitgevoerd onderhoud bewaard");
            }
          }}
        />
      )}
      {modal && (
        <Dialog
          title={
            {
              asset: "Onderdeel toevoegen",
              upload: "Bestanden toevoegen",
              task: "Onderhoud of melding",
              "task-edit": "Melding bewerken",
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
                        ...(floorplan
                          ? { roomId: form.get("roomId") || null }
                          : {}),
                      }),
                    },
                  );
                  createdId = result.id;
                }, "Onderdeel toegevoegd");
                if (ok) {
                  if (page === "model") select(createdId);
                  else openDossier(createdId);
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
                        ...(floorplan
                          ? { roomId: form.get("roomId") || null }
                          : {}),
                      }),
                    }),
                  "Onderdeel bijgewerkt",
                );
              else if (modal === "task" || modal === "task-edit")
                await save(
                  () =>
                    request(
                      `${api}/tasks${modal === "task-edit" ? `/${editingTask!.id}` : ""}`,
                      {
                        method: modal === "task-edit" ? "PATCH" : "POST",
                        body: JSON.stringify({
                          title: form.get("title"),
                          description: form.get("description"),
                          date: form.get("date"),
                          assetId: form.get("assetId"),
                          assigneeId:
                            form.get("assigneeId") === "external"
                              ? null
                              : form.get("assigneeId") || null,
                          owner:
                            form.get("assigneeId") === "external"
                              ? String(form.get("owner") || "")
                              : "",
                          state: form.get("state"),
                        }),
                      },
                    ),
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
            {(modal === "upload" ||
              modal === "task" ||
              modal === "task-edit") && (
              <label>
                Bij welk onderdeel?
                <select
                  name="assetId"
                  defaultValue={
                    modal === "task-edit" ? editingTask?.assetId : selectedId
                  }
                  required
                >
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
            {(modal === "asset" || modal === "edit") && floorplan && (
              <label>
                Ruimte in de plattegrond (optioneel)
                <select
                  name="roomId"
                  defaultValue={
                    modal === "edit" ? (selected?.roomId ?? "") : ""
                  }
                >
                  <option value="">Geen kamer gekoppeld</option>
                  {floorplan.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(modal === "task" || modal === "task-edit") && (
              <>
                <label>
                  Wat moet er gebeuren?
                  <input
                    name="title"
                    defaultValue={
                      modal === "task-edit" ? editingTask?.title : ""
                    }
                    placeholder="Bijvoorbeeld: ventilatie controleren"
                    maxLength={200}
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Datum uit planning of bron (optioneel)
                  <input
                    type="date"
                    name="date"
                    defaultValue={
                      modal === "task-edit" ? editingTask?.date : ""
                    }
                  />
                </label>
                <label>
                  Wie pakt het op?
                  <select
                    name="assigneeId"
                    defaultValue={
                      modal === "task-edit"
                        ? editingTask?.assigneeId ||
                          (editingTask?.owner ? "external" : "")
                        : ""
                    }
                  >
                    <option value="">Nog af te spreken</option>
                    {(dossier.people ?? [])
                      .filter(
                        (person) =>
                          person.active ||
                          person.id === editingTask?.assigneeId,
                      )
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                          {!person.active ? " (gearchiveerd)" : ""}
                        </option>
                      ))}
                    <option value="external">
                      Andere persoon of organisatie
                    </option>
                  </select>
                </label>
                <details className="external-person">
                  <summary>Naam van een andere persoon of organisatie</summary>
                  <label>
                    Alleen gebruikt bij Andere persoon of organisatie
                    <input
                      name="owner"
                      maxLength={200}
                      defaultValue={
                        modal === "task-edit" ? (editingTask?.owner ?? "") : ""
                      }
                      placeholder="Bijvoorbeeld een onderhoudsbedrijf…"
                    />
                  </label>
                </details>
                <label>
                  Opvolging
                  <select
                    name="state"
                    defaultValue={
                      modal === "task-edit"
                        ? (editingTask?.state ?? "active")
                        : "active"
                    }
                  >
                    <option value="active">Open</option>
                    <option value="hold">Wacht op iemand of budget</option>
                    <option value="verify">Eerst controleren</option>
                  </select>
                </label>
              </>
            )}
            {modal !== "upload" && (
              <label>
                {modal === "task" || modal === "task-edit"
                  ? "Toelichting"
                  : "Wat weet je al?"}
                <textarea
                  name="description"
                  rows={4}
                  maxLength={10000}
                  defaultValue={
                    modal === "edit"
                      ? selected?.description
                      : modal === "task-edit"
                        ? editingTask?.description
                        : ""
                  }
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
      {reader && (
        <Dialog title={reader.name} onClose={() => setReaderId(null)} wide>
          <DocumentReader
            key={reader.id}
            file={reader}
            assets={dossier.assets}
            onSave={async (data) => {
              await request(`${api}/files/${reader.id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
              });
              await refresh();
              setNotice("Documentkoppeling bijgewerkt");
            }}
          />
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
        name="search"
        autoComplete="off"
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
createRoot(document.getElementById("root")!).render(<App />);
