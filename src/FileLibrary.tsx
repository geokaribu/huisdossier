import { useState } from "react";
import { Download, FileText, LayoutGrid, List } from "lucide-react";
import type { Asset, Attachment } from "./types";
import { categoryName } from "./DocumentReader";

function fileSize(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return megabytes < 1
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${megabytes.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB`;
}
export function FileLibrary({
  files,
  assets,
  compact = false,
  snippets,
  onDocument,
  onPhoto,
  view: chosenView,
  onViewChange,
}: {
  files: Attachment[];
  assets: Asset[];
  compact?: boolean;
  snippets: { id: string; snippet: string }[];
  onDocument: (id: string) => void;
  onPhoto: (file: Attachment) => void;
  view?: "list" | "gallery";
  onViewChange?: (view: "list" | "gallery") => void;
}) {
  const [localView, setLocalView] = useState<"list" | "gallery">("list");
  const view = chosenView ?? localView;
  const setView = onViewChange ?? setLocalView;
  return (
    <div className={`file-library ${compact ? "compact" : ""}`}>
      {!compact && (
        <div
          className="library-view"
          role="group"
          aria-label="Bestandsweergave"
        >
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} aria-hidden="true" />
            Lijst
          </button>
          <button
            aria-pressed={view === "gallery"}
            onClick={() => setView("gallery")}
          >
            <LayoutGrid size={16} aria-hidden="true" />
            Galerij
          </button>
        </div>
      )}
      <div
        className={`library-items ${view === "gallery" && !compact ? "gallery" : "list"}`}
      >
        {files.map((file) => {
          const image = /^(image\/(png|jpeg|webp|gif|avif))$/.test(file.type);
          const snippet = snippets.find((hit) => hit.id === file.id)?.snippet;
          const open = () => (image ? onPhoto(file) : onDocument(file.id));
          return (
            <article
              className={`library-file ${image ? "is-photo" : ""}`}
              key={file.id}
            >
              <button
                className="library-preview"
                onClick={open}
                aria-label={`${image ? "Bekijk" : "Lees"} ${file.name}`}
              >
                {image ? (
                  <img
                    src={file.url}
                    alt=""
                    width="56"
                    height="64"
                    loading="lazy"
                  />
                ) : (
                  <>
                    <FileText size={24} strokeWidth={1.5} aria-hidden="true" />
                    <span>
                      {file.name.split(".").pop()?.toUpperCase().slice(0, 8)}
                    </span>
                  </>
                )}
              </button>
              <div className="library-file-content">
                <button
                  className="file-title"
                  onClick={() => onDocument(file.id)}
                >
                  {file.name}
                </button>
                <div className="library-file-meta">
                  <span>
                    {assets.find((asset) => asset.id === file.assetId)?.name ??
                      "Woning"}
                  </span>
                  {file.category && (
                    <span>{categoryName[file.category] ?? file.category}</span>
                  )}
                  {file.historical && (
                    <span className="historical-label">Historisch</span>
                  )}
                </div>
                {snippet ? (
                  <p className="search-snippet">{snippet}</p>
                ) : (
                  file.summary && (
                    <p className="library-summary">{file.summary}</p>
                  )
                )}
                <span className="library-file-size">{fileSize(file.size)}</span>
              </div>
              <a
                className="icon-button file-download"
                href={`${file.url}?download=1`}
                download
                aria-label={`Download ${file.name}`}
                title="Download bestand"
              >
                <Download size={17} aria-hidden="true" />
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}
