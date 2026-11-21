import { useEffect, useRef, type MouseEvent } from "react";
import {
  Box,
  Database,
  Footprints,
  FolderOpen,
  House,
  LockKeyhole,
  Menu,
  Plus,
  Wrench,
  X,
  UsersRound,
  CalendarDays,
  MessageCircle,
} from "lucide-react";
import { DossierExport } from "./DossierExport";
import { WorkspaceHelp } from "./WorkspaceHelp";
import { HouseChapter } from "./HouseAtlas";
import type { HouseData } from "./types";
import { housePageUrl, type HousePage } from "./houseSelection";

export const pageInfo: Record<
  HousePage,
  { title: string; description: string }
> = {
  assistant: {
    title: "Vraag je huis",
    description:
      "Je huisboek denkt met je mee. Met antwoorden uit wat je hebt bewaard.",
  },
  dossier: {
    title: "Huisdossier",
    description:
      "Vind informatie, documenten en onderhoud bij de juiste plek in huis.",
  },
  model: {
    title: "Buiten bekijken",
    description: "Verken het gebouw en kies een gevel, dak of onderdeel.",
  },
  interior: {
    title: "Binnen kijken",
    description:
      "Kies een ruimte, loop binnen en open het bijbehorende dossier.",
  },
  files: {
    title: "Jouw verzameling",
    description:
      "Foto's, ideeën, handleidingen en alles wat bij je huis hoort.",
  },
  tasks: {
    title: "Klussen voor je huis",
    description: "Wat aandacht vraagt. En wat al is gedaan.",
  },
  sources: {
    title: "Bronnen & model",
    description:
      "Bekijk de herkomst, nauwkeurigheid en grenzen van de woninggegevens.",
  },
  capture: {
    title: "Iets toevoegen",
    description: "Een foto, idee of klus. Geef het een plek.",
  },
  manage: {
    title: "Mensen rond je huis",
    description: "De mensen die meedenken en meehelpen.",
  },
  planning: {
    title: "Je huisagenda",
    description: "De plannen voor je huis, op een rij.",
  },
};
export function followWorkspaceLink(
  event: MouseEvent<HTMLAnchorElement>,
  go: () => void,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  go();
}
export function WorkspaceNavigation({
  houseId,
  page,
  count,
  mobile,
  onClose,
  onNavigate,
}: {
  houseId: string;
  page: HousePage;
  count: number;
  mobile: boolean;
  onClose: () => void;
  onNavigate: (page: HousePage) => void;
}) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const surface = navigation.current!;
    surface.querySelector<HTMLButtonElement>(".navigation-close")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [
        ...surface.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ),
      ].filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    surface.addEventListener("keydown", trap);
    const desktop = window.matchMedia("(min-width: 701px)");
    const resize = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      surface.removeEventListener("keydown", trap);
      desktop.removeEventListener("change", resize);
      previous?.focus({ preventScroll: true });
    };
  }, [mobile]);
  const groups = [
    {
      label: "Van je huis",
      items: [
        { id: "dossier", label: "Mijn huis", Icon: House },
        { id: "assistant", label: "Vraag je huis", Icon: MessageCircle },
        { id: "capture", label: "Iets toevoegen", Icon: Plus },
        { id: "files", label: "Verzameling", Icon: FolderOpen },
        { id: "tasks", label: "Klussen", Icon: Wrench },
      ],
    },
    {
      label: "Je huis in 3D",
      items: [
        { id: "model", label: "Buiten", Icon: Box },
        { id: "interior", label: "Binnen", Icon: Footprints },
      ],
    },
    {
      label: "Praktisch",
      items: [
        { id: "planning", label: "Planning", Icon: CalendarDays },
        { id: "manage", label: "Mensen & afspraken", Icon: UsersRound },
        { id: "sources", label: "Bronnen", Icon: Database },
      ],
    },
  ] as const;
  return (
    <>
      {mobile && (
        <button
          className="navigation-scrim"
          tabIndex={-1}
          aria-label="Navigatie sluiten"
          onClick={onClose}
        />
      )}
      <aside
        ref={navigation}
        id="workspace-navigation"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label="Hoofdnavigatie"
      >
        <div className="sidebar-brand">
          <a
            className="brand"
            href={housePageUrl(window.location.href, houseId, "dossier")}
            onClick={(event) =>
              followWorkspaceLink(event, () => onNavigate("dossier"))
            }
            aria-label="Geokari Huisdossier overzicht"
          >
            <img src="/brand/geokari.png" width="40" height="40" alt="" />
            <span>
              GeoKari<small>Huisdossier</small>
            </span>
          </a>
          <button
            className="icon-button navigation-close"
            aria-label="Navigatie sluiten"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Pagina's">
          {groups.map((group) => {
            const links = group.items.map(({ id, label, Icon }) => (
              <a
                key={id}
                href={housePageUrl(window.location.href, houseId, id)}
                className={`nav-link ${page === id ? "active" : ""}`}
                aria-current={page === id ? "page" : undefined}
                onClick={(event) =>
                  followWorkspaceLink(event, () => onNavigate(id))
                }
              >
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
                {id === "tasks" && count > 0 && (
                  <span className="nav-count">{count}</span>
                )}
              </a>
            ));
            return (
              <div className="navigation-group" key={group.label}>
                {group.label !== "Van je huis" && (
                  <span className="navigation-label">{group.label}</span>
                )}
                {links}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <LockKeyhole size={16} aria-hidden="true" />
          <div>
            <strong>Eigen huis, eigen dossier</strong>
            <span>Lokaal op deze computer</span>
          </div>
        </div>
      </aside>
    </>
  );
}
export function WorkspaceHeader({
  page,
  onNavigate,
  houses,
  houseId,
  mobile,
  onMenu,
  onHouse,
  onExport,
}: {
  page: HousePage;
  onNavigate: (page: HousePage) => void;
  houses: { id: string; address: string; city: string }[];
  houseId: string;
  mobile: boolean;
  onMenu: () => void;
  onHouse: (id: string) => void;
  onExport: string;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-toggle"
        aria-label={mobile ? "Navigatie sluiten" : "Open navigatie"}
        aria-expanded={mobile}
        aria-controls="workspace-navigation"
        onClick={onMenu}
      >
        <Menu size={22} />
      </button>
      <div className="house-switcher" role="group" aria-label="Woning kiezen">
        {houses.map((house) => (
          <button
            key={house.id}
            aria-pressed={houseId === house.id}
            onClick={() => {
              if (houseId !== house.id) onHouse(house.id);
            }}
          >
            <House size={16} aria-hidden="true" />
            <span>
              {house.address}
              <small>{house.city}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="workspace-top-actions">
        <WorkspaceHelp page={page} onNavigate={onNavigate} />
        <DossierExport url={onExport} />
      </div>
    </header>
  );
}
export function WorkspacePageHeading({
  page,
  onAdd,
  data,
  onExplore,
}: {
  page: HousePage;
  onAdd: () => void;
  data: HouseData | null;
  onExplore: () => void;
}) {
  const label =
    page === "tasks"
      ? "Melding toevoegen"
      : page === "files"
        ? "Bestand toevoegen"
        : null;
  return (
    <div
      className={`page-heading chapter-heading ${page === "model" || page === "interior" ? "chapter-spatial" : ""}`}
    >
      <div className="chapter-copy">
        <h1 id="page-title" tabIndex={-1}>
          {pageInfo[page].title}
        </h1>
        {page !== "dossier" && <p>{pageInfo[page].description}</p>}
      </div>
      {label && (
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} aria-hidden="true" />
          {label}
        </button>
      )}
      {data &&
        page !== "dossier" &&
        page !== "model" &&
        page !== "interior" && (
          <HouseChapter data={data} onExplore={onExplore} />
        )}
    </div>
  );
}
