import { TaskList } from "./TaskList";
import { SourcesPage } from "./SourcesPage";
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
  Plus,
  Download,
  MapPin,
  ChevronRight,
  Box,
  Upload,
  X,
  Check,
  Pencil,
  CheckCircle2,
  LocateFixed,
  Search,
  ExternalLink,
  Info,
  LoaderCircle,
  Footprints,
} from "lucide-react";
import { request } from "./api";
import { ReadableText } from "./ReadableText";
import { loadWorkspace, resourceLabels } from "./workspaceLoad";
import type { VisualResources, ResourceName } from "./workspaceLoad";
import { DocumentReader, categoryName } from "./DocumentReader";
import { DossierHome } from "./DossierHome";
import { PlaceFilter, SpatialHome } from "./HouseAtlas";
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
import { HouseAssistant } from "./HouseAssistant";
import { ManagementPage } from "./ManagementPage";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { PlanningPage } from "./PlanningPage";
import { PartContacts } from "./PartContacts";
import { MaintenanceReminders } from "./MaintenanceReminders";
import { parseCost } from "./planning";
import type { HousePage } from "./houseSelection";
import "./design-tokens.css";
import "./style.css";
import "./workspace.css";
import "./management.css";
import "./planning.css";
import "./housebook.css";
import "./house-atlas.css";
import "./interior-workspace.css";
import "./home-life.css";
const Viewer = lazy(() =>
  import("./Viewer").then((module) => ({ default: module.Viewer })),
);
const InteriorViewer = lazy(() =>
  import("./InteriorViewer").then((module) => ({
    default: module.InteriorViewer,
  })),
);

type Page = HousePage;
type Modal = "asset" | "upload" | "task" | "task-edit" | "edit" | null;

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
  const [dossierReady, setDossierReady] = useState(false);
  const [loadedHouseId, setLoadedHouseId] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [visualLoading, setVisualLoading] = useState(true);
  const [resourceIssues, setResourceIssues] = useState<ResourceName[]>([]);
  const [dossier, setDossier] = useState<Dossier>({
    assets: [],
    attachments: [],
    tasks: [],
  });
  const [selectedId, setSelectedId] = useState("");
  const [page, setPageState] = useState<Page>(() =>
    resolveHousePage(window.location.href),
  );
  const [dossierPartOpen, setDossierPartOpen] = useState(false);
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
  const [libraryView, setLibraryView] = useState<"list" | "gallery">("gallery");
  const [searchHits, setSearchHits] = useState<
    { id: string; snippet: string }[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [initialRoom, setInitialRoom] = useState<string | undefined>();
  const reader = dossier.attachments.find((f) => f.id === readerId);
  const selected = dossier.assets.find((a) => a.id === selectedId);
  const api = `/api/houses/${houseId}`;
  const activeHouse = useRef(houseId);
  const workspaceGeneration = useRef(0);
  if (activeHouse.current !== houseId) workspaceGeneration.current++;
  activeHouse.current = houseId;
  const applyResource = (
    name: ResourceName,
    value: VisualResources[ResourceName],
  ) => {
    if (name === "model") setData(value as HouseData | null);
    if (name === "appearance") setAppearance(value as HouseAppearance | null);
    if (name === "floorplan") setFloorplan(value as Floorplan | null);
    if (name === "lighting") {
      const light = value as LightingEnvironment | null;
      setLighting(light);
      setLightSettings((s) => ({
        ...s,
        selectedLampId: light?.lamps[0]?.id ?? "",
      }));
    }
  };
  const retryResources = async () => {
    const requestedHouse = houseId;
    const generation = workspaceGeneration.current;
    const current = () =>
      activeHouse.current === requestedHouse &&
      generation === workspaceGeneration.current;
    const pending = [...resourceIssues];
    setVisualLoading(true);
    setResourceIssues([]);
    await Promise.allSettled(
      pending.map(async (name) => {
        try {
          const value = await request<VisualResources[ResourceName]>(
            `${api}/${name}`,
          );
          if (current()) applyResource(name, value);
        } catch {
          if (current()) setResourceIssues((issues) => [...issues, name]);
        }
      }),
    );
    if (current()) setVisualLoading(false);
  };
  const setPage = (next: Page) => {
    if (next === "dossier") setDossierPartOpen(false);
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
      const nextHouseId = resolveHouseId(houses, window.location.href, null);
      setPageState(resolveHousePage(window.location.href));
      setMobileMenu(false);
      if (nextHouseId !== houseId) {
        setDossierReady(false);
        setHouseId(nextHouseId);
        return; // Destination selection is validated only after its own dossier arrives.
      }
      const route = readWorkspaceSelection(
        window.location.href,
        dossier.assets,
      );
      setSelectedId(route.part || `${houseId}:building`);
      setDossierPartOpen(Boolean(route.part));
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
      const generation = workspaceGeneration.current;
      const records = await request<Dossier>(`/api/houses/${houseId}/dossier`);
      if (
        activeHouse.current === houseId &&
        generation === workspaceGeneration.current
      )
        setDossier(records);
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
      .catch(() => {
        setError("De woningen konden niet worden geladen.");
        setLoadFailed(true);
      });
  }, [loadAttempt]);
  useEffect(() => {
    if (!houseId || !dossierReady || loadedHouseId !== houseId) return;
    history.replaceState(
      null,
      "",
      workspaceSelectionUrl(window.location.href, houseId, page, {
        part: page === "dossier" && !dossierPartOpen ? "" : selectedId,
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
    dossierReady,
    loadedHouseId,
    page,
    selectedId,
    dossierPartOpen,
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
    setDossierReady(false);
    setLoadedHouseId("");
    setBusy(false);
    setLoadFailed(false);
    setVisualLoading(true);
    setResourceIssues([]);
    setError("");
    setNotice("");
    setSelectedId("");
    setDossierPartOpen(false);
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
    setLibraryView("gallery");
    setSearchHits(null);
    setInitialRoom(undefined);
    const controller = new AbortController();
    loadWorkspace(
      <T,>(url: string) => request<T>(url, { signal: controller.signal }),
      `/api/houses/${houseId}`,
      (records) => {
        if (cancelled) return;
        setDossier(records);
        setLoadedHouseId(houseId);
        const route = readWorkspaceSelection(
          window.location.href,
          records.assets,
        );
        setSelectedId(route.part || `${houseId}:building`);
        setDossierPartOpen(Boolean(route.part));
        setQuery(route.query);
        setScope(route.scope);
        setCategory(route.category);
        setTaskFilter(route.status);
        setDossierReady(true);
      },
      (name, value) => {
        if (cancelled) return;
        applyResource(name, value);
      },
      (name) => {
        if (cancelled) return;
        if (name === "dossier") {
          setError("Het dossier kon niet worden geladen. Probeer opnieuw.");
          setLoadFailed(true);
        } else setResourceIssues((issues) => [...issues, name]);
      },
    ).then(() => {
      if (!cancelled) setVisualLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [houseId, loadAttempt]);
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
    if (page === "dossier" && (!dossierPartOpen || id !== selectedId))
      history.pushState(
        null,
        "",
        workspaceSelectionUrl(window.location.href, houseId, "dossier", {
          part: id,
          scope: "",
          category: "",
          query: "",
          status: "open",
        }),
      );
    select(id);
    setPage("dossier");
    setDossierPartOpen(true);
    setMobileMenu(false);
    requestAnimationFrame(() => {
      const detail = document.getElementById("dossier-detail");
      detail?.focus({ preventScroll: true });
      detail?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
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
    const generation = workspaceGeneration.current;
    const current = () => generation === workspaceGeneration.current;
    setBusy(true);
    setError("");
    try {
      await action();
      if (!current()) return false;
      await refresh();
      if (!current()) return false;
      setModal(null);
      setNotice(message);
      return true;
    } catch (e) {
      if (current()) setError((e as Error).message);
      return false;
    } finally {
      if (current()) setBusy(false);
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
  const taskListProps = {
    dossier,
    busy,
    onComplete: setCompletingTask,
    onReopen: (task: Task) => {
      void save(
        () =>
          request(`${api}/tasks/${task.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "open" }),
          }),
        "Melding heropend",
      );
    },
    onEdit: (task: Task) => {
      setEditingTask(task);
      openModal("task-edit");
    },
    onDocument: setReaderId,
    onPhoto: setLightbox,
  };
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
      {data?.house.id === houseId && (
        <MaintenanceReminders
          houseId={houseId}
          dossier={dossier}
          onOpen={() => {
            if (activeHouse.current === houseId) setPage("planning");
          }}
        />
      )}
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
        data-page={page}
        id="workspace-content"
        tabIndex={-1}
        inert={mobileMenu}
      >
        <WorkspaceHeader
          page={page}
          onNavigate={setPage}
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
          data={data}
          onExplore={() => setPage("model")}
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
        {resourceIssues.length > 0 && dossierReady && (
          <div className="alert" role="status">
            <Info size={18} />
            <span>
              {resourceIssues.map((name) => resourceLabels[name]).join(", ")}{" "}
              kon niet worden geladen. Je dossier blijft beschikbaar.
            </span>
            <button
              disabled={visualLoading}
              onClick={() => void retryResources()}
            >
              Opnieuw proberen
            </button>
          </div>
        )}
        {!dossierReady ? (
          <div className="loading">
            {!loadFailed && <LoaderCircle className="spin" size={30} />}
            <h2>Je huis wordt klaargezet</h2>
            <p>
              {loadFailed
                ? "Je gegevens zijn niet veranderd. Probeer de verbinding opnieuw."
                : "Dossier laden…"}
            </p>
            {loadFailed && (
              <button
                className="button secondary"
                onClick={() => setLoadAttempt((n) => n + 1)}
              >
                Opnieuw proberen
              </button>
            )}
          </div>
        ) : (
          <>
            <div hidden={page !== "assistant"}>
              <HouseAssistant
                key={houseId}
                houseId={houseId}
                dossier={dossier}
                active={page === "assistant"}
                onPart={openDossier}
                onNavigate={setPage}
                onDocument={(id) => {
                  const file = dossier.attachments.find(
                    (item) => item.id === id,
                  );
                  if (file?.type.startsWith("image/")) setLightbox(file);
                  else setReaderId(id);
                }}
              />
            </div>
            {data && (page === "model" || page === "interior") && (
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
            {!data && (page === "model" || page === "sources") && (
              <div className="content-panel model-unavailable" role="status">
                {visualLoading ? (
                  <LoaderCircle className="spin" size={28} />
                ) : (
                  <Box size={28} />
                )}
                <h2>
                  {visualLoading
                    ? "Gebouwmodel laden"
                    : "Nog geen beschikbaar gebouwmodel"}
                </h2>
                <p>
                  {visualLoading
                    ? "Je dossier is al klaar voor gebruik."
                    : "Bekijk je onderdelen, documenten en onderhoud in het dossier. Een 3D-model kan later worden toegevoegd of hersteld."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => setPage("dossier")}
                >
                  Open het dossier
                </button>
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
            {page === "planning" && (
              <PlanningPage
                key={houseId}
                houseId={houseId}
                dossier={dossier}
                onRefresh={refresh}
                onEdit={(task) => {
                  setEditingTask(task);
                  openModal("task-edit");
                }}
                onComplete={setCompletingTask}
                onPart={openDossier}
                onManage={() => setPage("manage")}
                onCapture={() => setPage("capture")}
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
                data={data}
                appearance={appearance}
                roomPreview={
                  dossierPartOpen &&
                  selected?.roomId &&
                  displayPlan?.rooms.some(
                    (room) => room.id === selected.roomId,
                  ) ? (
                    <Suspense
                      fallback={
                        <div className="room-preview-loading">
                          <Footprints size={52} />
                        </div>
                      }
                    >
                      <InteriorViewer
                        preview
                        key={`${houseId}:portrait:${selected.id}`}
                        data={data}
                        appearance={appearance}
                        lighting={lighting}
                        lightSettings={lightSettings}
                        plan={displayPlan}
                        initialRoomId={selected.roomId}
                      />
                    </Suspense>
                  ) : undefined
                }
                spatialHome={
                  data ? (
                    <SpatialHome
                      dossier={dossier}
                      hasInterior={Boolean(floorplan)}
                      onExplore={() => setPage("model")}
                      onInterior={() => setPage("interior")}
                      onCapture={() => setPage("capture")}
                      onFiles={() => showFiles()}
                      onTasks={() => {
                        setTaskFilter("open");
                        showTasks();
                      }}
                      onPlanning={() => setPage("planning")}
                      onAssistant={() => setPage("assistant")}
                      onPhoto={setLightbox}
                    >
                      <Suspense
                        fallback={
                          <div className="loading">
                            <LoaderCircle className="spin" size={28} />
                            <p>Je huis laden…</p>
                          </div>
                        }
                      >
                        <Viewer
                          compact
                          data={data}
                          appearance={appearance}
                          floorplan={displayPlan}
                          lighting={lighting}
                          lightSettings={lightSettings}
                          onNeighbors={(enabled) =>
                            setLightSettings((s) => ({
                              ...s,
                              neighbors: enabled,
                            }))
                          }
                          onInterior={() => setPage("interior")}
                          assets={dossier.assets}
                          selected={undefined}
                          onSelect={openDossier}
                          placing={false}
                          onPlace={place}
                        />
                      </Suspense>
                    </SpatialHome>
                  ) : undefined
                }
                selected={selected}
                contacts={
                  selected && (
                    <PartContacts
                      key={`${houseId}/${selected.id}`}
                      houseId={houseId}
                      asset={selected}
                      dossier={dossier}
                      onRefresh={refresh}
                      onManage={() => setPage("manage")}
                    />
                  )
                }
                floorplan={floorplan}
                onSelect={openDossier}
                detailOpen={dossierPartOpen}
                onBack={() => {
                  setDossierPartOpen(false);
                  requestAnimationFrame(() => {
                    const places = document.getElementById("housebook-places");
                    places?.focus({ preventScroll: true });
                    places?.scrollIntoView({
                      block: "start",
                      behavior: "instant",
                    });
                  });
                }}
                onCapture={() => setPage("capture")}
                onExplore={() => setPage(floorplan ? "interior" : "model")}
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
                onPhoto={setLightbox}
                onInterior={(id) => {
                  setInitialRoom(id);
                  setPage("interior");
                }}
                renderTasks={(tasks) => (
                  <TaskList {...taskListProps} tasks={tasks} compact />
                )}
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
                  {visualLoading ? (
                    <LoaderCircle className="spin" size={30} />
                  ) : (
                    <Footprints size={30} />
                  )}
                  <h2>
                    {visualLoading ? "Interieur laden…" : "Nog geen interieur"}
                  </h2>
                  <p>
                    {visualLoading
                      ? "Je dossier is al beschikbaar."
                      : "Voor deze woning is nog geen plattegrond uitgewerkt."}
                  </p>
                </div>
              ))}
            {page === "model" && data && (
              <>
                <PlaceFilter
                  assets={dossier.assets}
                  value={selectedId}
                  onChange={select}
                  all={false}
                />
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
                          {selected && (
                            <PartContacts
                              key={`${houseId}/${selected.id}`}
                              houseId={houseId}
                              asset={selected}
                              dossier={dossier}
                              onRefresh={refresh}
                              onManage={() => setPage("manage")}
                            />
                          )}
                          <details
                            className="part-description-collapsed"
                            key={selectedId}
                            open={(selected?.description?.length ?? 0) < 300}
                          >
                            <summary>Notities over dit onderdeel</summary>
                            <ReadableText text={selected?.description ?? ""} />
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
                                {...taskListProps}
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
                          <TaskList
                            {...taskListProps}
                            tasks={relatedTasks}
                            compact
                          />
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
                <PlaceFilter
                  assets={dossier.assets}
                  value={scope}
                  onChange={setScope}
                />
                <div className="dossier-filters visual-file-filters">
                  <div
                    className="category-choices"
                    role="group"
                    aria-label="Categorie"
                  >
                    <button
                      aria-pressed={!category}
                      onClick={() => setCategory("")}
                    >
                      Alles
                    </button>
                    {[
                      ...new Set(
                        dossier.attachments
                          .map((f) => f.category)
                          .filter((v): v is string => Boolean(v)),
                      ),
                    ]
                      .sort()
                      .map((c) => (
                        <button
                          key={c}
                          aria-pressed={category === c}
                          onClick={() => setCategory(c)}
                        >
                          {categoryName[c] ?? c}
                        </button>
                      ))}
                  </div>
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
                <PlaceFilter
                  assets={dossier.assets}
                  value={scope}
                  onChange={setScope}
                />
                <p className="filter-result" role="status">
                  {filteredTasks.length} aandachtspunten in deze selectie
                </p>
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
                      aria-pressed={taskFilter === id}
                      key={id}
                      onClick={() => setTaskFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredTasks.length ? (
                  <TaskList {...taskListProps} tasks={filteredTasks} />
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
            {page === "sources" && data && (
              <SourcesPage
                data={data}
                floorplan={floorplan}
                appearance={appearance}
                onInterior={() => setPage("interior")}
                onUpload={() => openModal("upload")}
              />
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
            const generation = workspaceGeneration.current;
            const currentHouse = houseId;
            await request(`${api}/tasks/${completingTask.id}`, {
              method: "PATCH",
              body: JSON.stringify(values),
            });
            await refresh();
            if (
              activeHouse.current === currentHouse &&
              generation === workspaceGeneration.current
            ) {
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
                          ...(modal === "task-edit" &&
                          editingTask?.status === "done"
                            ? {
                                costCents: parseCost(
                                  String(form.get("cost") ?? ""),
                                ),
                              }
                            : {}),
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
                {modal === "task-edit" && editingTask?.status === "done" && (
                  <label>
                    Werkelijk betaalde kosten in euro (optioneel)
                    <input
                      name="cost"
                      inputMode="decimal"
                      maxLength={12}
                      defaultValue={
                        editingTask.costCents != null
                          ? (editingTask.costCents / 100)
                              .toFixed(2)
                              .replace(".", ",")
                          : ""
                      }
                      placeholder="Bijvoorbeeld: 125,50"
                    />
                    <small>Leeg = onbekend. 0 = geen kosten.</small>
                  </label>
                )}
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
              const generation = workspaceGeneration.current;
              await request(`${api}/files/${reader.id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
              });
              await refresh();
              if (generation === workspaceGeneration.current)
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
