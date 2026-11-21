import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, X } from "lucide-react";
import { resourceLabels } from "./workspaceLoad";
import type { ResourceName } from "./workspaceLoad";

export function DossierExport({
  url,
  className = "export-link",
  label = "Exporteer dossier",
}: {
  url: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setMessage("");
    setBusy(false);
    return () => controller.current?.abort();
  }, [url]);
  return (
    <>
      <button
        className={className}
        disabled={busy}
        aria-label={busy ? "Dossierkopie voorbereiden" : label}
        title="Download je gegevens en oorspronkelijke bestanden"
        onClick={async () => {
          const pending = new AbortController();
          controller.current = pending;
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch(url, { signal: pending.signal });
            if (!response.ok)
              throw new Error(
                "De dossierkopie kon niet worden gemaakt. Probeer opnieuw.",
              );
            const blob = await response.blob();
            if (pending.signal.aborted) return;
            const href = URL.createObjectURL(blob),
              anchor = document.createElement("a");
            anchor.href = href;
            anchor.download =
              response.headers
                .get("content-disposition")
                ?.match(/filename="([^"]+)"/)?.[1] ?? "huisdossier.json";
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(href), 30000);
            const warnings = (
              response.headers.get("X-Huisdossier-Export-Warnings") ?? ""
            )
              .split(",")
              .filter(Boolean);
            const names = warnings.map(
              (key) =>
                resourceLabels[key as ResourceName] ?? "Interieurbeelden",
            );
            setMessage(
              warnings.length
                ? `Dossierkopie gedownload met je documenten en onderhoud. Niet meegenomen: ${names.join(", ")}. Controleer deze bronnen; de originele lokale gegevens zijn niet gewijzigd.`
                : "Dossierkopie gedownload. Bewaar deze ook buiten je computer.",
            );
          } catch (error) {
            if (!pending.signal.aborted)
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Download mislukt. Probeer opnieuw.",
              );
          } finally {
            if (!pending.signal.aborted) setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        <span>{busy ? "Kopie voorbereiden…" : label}</span>
      </button>
      {message && (
        <div className="export-status" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Sluit exportmelding"
            onClick={() => setMessage("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}
