import { InlineText } from "./InlineText";
import { ReadableText } from "./ReadableText";
import { useEffect, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { request } from "./api";
import type { Attachment, Asset } from "./types";

export const categoryName: Record<string, string> = {
  photos: "Foto's van thuis",
  actions: "Klussen",
  history: "Historie",
  maintenance: "Onderhoud",
  contracts: "Contracten",
  insurance: "Verzekering",
  finance: "Financiën",
  overview: "Overzicht",
  observations: "Observaties",
  purchase: "Aankoop",
  legal: "Juridisch",
  energy: "Energie",
  document: "Document",
  status: "Kamerinformatie",
  tasks: "Klussen",
  reference: "Naslag",
};

export { InlineText } from "./InlineText";

// Local documents are text, never executable HTML. A small renderer keeps source tables readable.
function DocumentText({ text }: { text: string }) {
  const clean = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  return (
    <div className="document-text">
      {clean.split(/\r?\n\s*\r?\n/).map((block, i) => {
        const lines = block.split(/\r?\n/);
        if (
          lines.length > 1 &&
          lines.every((line) => line.trim().startsWith("|"))
        ) {
          const rows = lines.filter((line) => !/^\|?[\s:|\-]+\|?$/.test(line));
          return (
            <div className="document-table" key={i}>
              <table>
                <tbody>
                  {rows.map((line, j) => (
                    <tr key={j}>
                      {line
                        .replace(/^\|/, "")
                        .replace(/\|$/, "")
                        .split("|")
                        .map((cell, k) =>
                          j === 0 ? (
                            <th key={k}>
                              <InlineText text={cell.trim()} />
                            </th>
                          ) : (
                            <td key={k}>
                              <InlineText text={cell.trim()} />
                            </td>
                          ),
                        )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (/^#{1,6}\s/.test(block))
          return (
            <div className="document-headings" key={i}>
              {lines.map((line, j) =>
                /^#{1,6}\s/.test(line) ? (
                  <h3 key={j}>
                    <InlineText text={line.replace(/^#+\s/, "")} />
                  </h3>
                ) : (
                  <ReadableText key={j} text={line} />
                ),
              )}
            </div>
          );
        return <ReadableText key={i} text={block} />;
      })}
    </div>
  );
}

export function DocumentReader({
  file,
  assets,
  onSave,
}: {
  file: Attachment;
  assets: Asset[];
  onSave: (data: {
    assetId: string;
    summary: string;
    category: string;
  }) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(Boolean(file.readable));
  const [error, setError] = useState("");
  const [original, setOriginal] = useState(!file.readable);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    if (file.readable)
      request<{ text: string }>(`${file.url}/text`, {
        signal: controller.signal,
      })
        .then((r) => setText(r.text))
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => controller.abort();
  }, [file.id, file.url, file.readable]);
  return (
    <div className="document-reader">
      <div className="document-meta">
        <span className="badge">
          {categoryName[file.category ?? ""] ?? file.category ?? "Document"}
        </span>
        {file.historical && (
          <span className="badge amber">Historisch bronstuk</span>
        )}
        <span>{assets.find((a) => a.id === file.assetId)?.name}</span>
        {file.sourceDate && <span>Bron: {file.sourceDate}</span>}
      </div>
      {file.summary && (
        <div className="document-summary">
          <ReadableText text={file.summary} />
        </div>
      )}
      {file.source && (
        <details className="document-origin">
          <summary>Herkomst bekijken</summary>
          <ReadableText text={file.source} />
          <p>
            Samenvatting en bronstuk kunnen verschillen. Controleer de peildatum
            bij oude documenten.
          </p>
        </details>
      )}
      <div className="document-toolbar">
        {file.readable && (
          <button
            className={`button ${!original ? "primary" : "secondary"}`}
            onClick={() => setOriginal(false)}
          >
            <FileText size={16} /> Leesbare tekst
          </button>
        )}
        {file.type === "application/pdf" && (
          <button
            className={`button ${original ? "primary" : "secondary"}`}
            onClick={() => setOriginal(true)}
          >
            Originele PDF
          </button>
        )}
        <a
          className="button secondary"
          href={`${file.url}?download=1`}
          download
        >
          <Download size={16} /> Download origineel
        </a>
        <button className="text-button" onClick={() => setEditing(!editing)}>
          Koppeling bewerken
        </button>
      </div>
      {editing && (
        <form
          className="document-edit"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setSaving(true);
            setError("");
            try {
              await onSave({
                assetId: String(form.get("assetId")),
                category: String(form.get("category")),
                summary: String(form.get("summary")),
              });
              setEditing(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Onderdeel
            <select name="assetId" defaultValue={file.assetId}>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categorie
            <select name="category" defaultValue={file.category ?? "document"}>
              {[
                ...new Set([
                  file.category ?? "document",
                  "document",
                  "maintenance",
                  "contracts",
                  "insurance",
                  "finance",
                  "overview",
                  "observations",
                  "purchase",
                  "legal",
                  "energy",
                  "tasks",
                  "history",
                  "reference",
                ]),
              ].map((key) => (
                <option key={key} value={key}>
                  {categoryName[key] ?? key}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wat wil je onthouden?
            <textarea
              name="summary"
              defaultValue={file.summary}
              maxLength={10000}
              rows={4}
            />
          </label>
          <button className="button primary" disabled={saving}>
            {saving ? "Opslaan…" : "Koppeling opslaan"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {!original && loading ? (
        <p>
          <LoaderCircle className="spin" size={18} /> Tekst laden…
        </p>
      ) : !original && text ? (
        <DocumentText text={text} />
      ) : original && file.type === "application/pdf" ? (
        <iframe
          className="document-pdf"
          src={`${file.url}?preview=1`}
          title={file.name}
        />
      ) : (
        <p className="form-note">
          Open het oorspronkelijke bestand met de downloadknop.
        </p>
      )}
    </div>
  );
}
