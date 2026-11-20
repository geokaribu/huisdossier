import { useEffect, useRef, type MouseEvent } from "react";
import {
  Box,
  Database,
  Download,
  Footprints,
  FolderOpen,
  House,
  LockKeyhole,
  Menu,
  Plus,
  Wrench,
  X,
  Settings2,
} from "lucide-react";
import { housePageUrl, type HousePage } from "./houseSelection";

export const pageInfo: Record<
  HousePage,
  { title: string; description: string }
> = {
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
    title: "Documenten & foto's",
    description:
      "Alle bestanden van deze woning, doorzoekbaar op onderwerp en inhoud.",
  },
  tasks: {
    title: "Onderhoud",
    description:
      "Houd bij wat aandacht vraagt, wie het oppakt en wat al is gedaan.",
  },
  sources: {
    title: "Bronnen & model",
    description:
      "Bekijk de herkomst, nauwkeurigheid en grenzen van de woninggegevens.",
  },
  capture: {
    title: "Iets toevoegen",
    description:
      "Bewaar wat je opmerkt, weet of hebt uitgevoerd. Een korte invoer is genoeg om te beginnen.",
  },
  manage: {
    title: "Beheer",
    description:
      "Regel de personen, onderhoudsafspraken en het bijhouden van deze woning.",
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
      ];
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
      label: "Dossier",
      items: [
        { id: "dossier", label: "Overzicht", Icon: House },
        { id: "capture", label: "Iets toevoegen", Icon: Plus },
        { id: "files", label: "Documenten & foto's", Icon: FolderOpen },
        { id: "tasks", label: "Onderhoud", Icon: Wrench },
      ],
    },
    {
      label: "Woning verkennen",
      items: [
        { id: "model", label: "Buiten bekijken", Icon: Box },
        { id: "interior", label: "Binnen kijken", Icon: Footprints },
      ],
    },
    {
      label: "Achtergrond",
      items: [
        { id: "manage", label: "Beheer", Icon: Settings2 },
        { id: "sources", label: "Bronnen & model", Icon: Database },
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
          {groups.map((group) => (
            <div className="navigation-group" key={group.label}>
              <span className="navigation-label">{group.label}</span>
              {group.items.map(({ id, label, Icon }) => (
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
              ))}
            </div>
          ))}
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
  houses,
  houseId,
  mobile,
  onMenu,
  onHouse,
  onExport,
}: {
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
      <label className="top-house-selector" htmlFor="house-select">
        <House size={18} aria-hidden="true" />
        <span className="sr-only">Woning kiezen</span>
        <select
          id="house-select"
          value={houseId}
          onChange={(event) => onHouse(event.target.value)}
        >
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.address} · {house.city}
            </option>
          ))}
        </select>
      </label>
      <a
        href={onExport}
        className="export-link"
        title="Download het volledige dossier met bestanden"
      >
        <Download size={16} aria-hidden="true" />
        <span>Exporteer dossier</span>
      </a>
    </header>
  );
}
export function WorkspacePageHeading({
  page,
  onAdd,
}: {
  page: HousePage;
  onAdd: () => void;
}) {
  const label =
    page === "tasks"
      ? "Melding toevoegen"
      : page === "dossier"
        ? "Onderdeel toevoegen"
        : page === "files"
          ? "Bestand toevoegen"
          : null;
  return (
    <div className="page-heading">
      <div>
        <h1 id="page-title" tabIndex={-1}>
          {pageInfo[page].title}
        </h1>
        <p>{pageInfo[page].description}</p>
      </div>
      {label && (
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} aria-hidden="true" />
          {label}
        </button>
      )}
    </div>
  );
}
