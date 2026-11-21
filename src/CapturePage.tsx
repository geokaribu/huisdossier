import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Camera,
  Wrench,
  ClipboardCheck,
  Save,
} from "lucide-react";
import { request } from "./api";
import { todayLocal } from "./residentWorkflows";
import { parseCost } from "./planning";
import type { Dossier } from "./types";
import { PlaceFilter } from "./HouseAtlas";
import { CaptureHelp } from "./CaptureHelp";

type EntryKind = "task" | "note" | "file" | "completed";
type Draft = {
  requestId: string;
  kind: EntryKind;
  title: string;
  description: string;
  assetId: string;
  recordedById: string;
  assigneeId: string;
  date: string;
  category: string;
  cost: string;
};
const blank = (house: string): Draft => ({
  requestId: crypto.randomUUID(),
  kind: "file",
  title: "",
  description: "",
  assetId: `${house}:inbox`,
  recordedById: "",
  assigneeId: "",
  date: "",
  category: "observations",
  cost: "",
});
export function CapturePage({
  houseId,
  dossier,
  onSaved,
  onOpenDossier,
}: {
  houseId: string;
  dossier: Dossier;
  onSaved: () => Promise<void>;
  onOpenDossier: (id: string) => void;
}) {
  const key = `huisdossier:capture:${houseId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved && ["task", "note", "file", "completed"].includes(saved.kind)) {
        const restored = blank(houseId);
        for (const field of Object.keys(restored) as (keyof Draft)[])
          if (typeof saved[field] === "string")
            Object.assign(restored, { [field]: saved[field] });
        const before = JSON.stringify(restored);
        if (!dossier.assets.some((asset) => asset.id === restored.assetId))
          restored.assetId = `${houseId}:inbox`;
        for (const field of ["recordedById", "assigneeId"] as const)
          if (
            restored[field] &&
            !(dossier.people ?? []).some(
              (person) => person.id === restored[field] && person.active,
            )
          )
            restored[field] = "";
        if (
          JSON.stringify(restored) !== before ||
          !/^[\da-f-]{36}$/i.test(restored.requestId)
        )
          restored.requestId = crypto.randomUUID();
        return restored;
      }
    } catch {
      /* A fresh form remains usable without browser storage. */
    }
    return blank(houseId);
  });
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<{
      assetId: string;
      taskId: string | null;
      fileIds: string[];
    } | null>(null);
  const live = useRef(true),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* Saving to the dossier does not depend on session storage. */
    }
  }, [key, draft]);
  const change = (value: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...value, requestId: crypto.randomUUID() }));
    setError("");
    setSaved(null);
  };
  const reset = () => {
    setDraft(blank(houseId));
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setSaved(null);
    setError("");
  };
  const active = (dossier.people ?? []).filter((person) => person.active);
  const uploadField = (
    <label className="capture-photo-input">
      <Camera size={30} aria-hidden="true" />
      <strong>
        {draft.kind === "file"
          ? "Kies een foto of document"
          : "Foto of document (optioneel)"}
      </strong>
      <input
        ref={fileInput}
        name="file"
        type="file"
        required={draft.kind === "file"}
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;
          setFile(chosen);
          change({
            ...(!chosen ||
            !/^image\/(png|jpeg|webp|gif|avif)$/.test(chosen.type)
              ? { category: "observations" }
              : {}),
            ...(chosen && !draft.title
              ? { title: chosen.name.replace(/\.[^.]+$/, "") }
              : {}),
          });
        }}
      />
      <small>Maximaal 25 MB. Na heropenen kies je een bijlage opnieuw.</small>
    </label>
  );
  const photoChoice = file &&
    /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) && (
      <label className="resident-check capture-photo-choice">
        <input
          type="checkbox"
          checked={draft.category === "photos"}
          onChange={(event) =>
            change({
              category: event.target.checked ? "photos" : "observations",
            })
          }
        />
        <span>Ook in mijn fotohoekje tonen</span>
      </label>
    );
  return (
    <section className="capture-layout">
      <div className="content-panel capture-panel">
        <h2>Wat wil je bewaren?</h2>
        <div className="entry-kind" role="group" aria-label="Soort invoer">
          {(
            [
              [
                "file",
                "Een foto of document",
                Camera,
                "Een plekje in je verzameling",
              ],
              ["note", "Een idee of notitie", FileText, "Iets om te onthouden"],
              ["task", "Een klus", Wrench, "Iets voor je huis"],
              ["completed", "Iets gedaan", ClipboardCheck, "Wat er is gedaan"],
            ] as const
          ).map(([kind, label, Icon, hint]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() =>
                change({ kind, date: kind === "completed" ? todayLocal() : "" })
              }
            >
              <Icon size={19} aria-hidden="true" />
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </div>
        {saved ? (
          <div className="entry-success" role="status">
            <CheckCircle2 size={28} />
            <h3>Opgeslagen in het dossier</h3>
            <p>
              {saved.assetId.endsWith(":inbox")
                ? "Je vindt deze invoer bij Nog te ordenen. Je kunt de juiste plek later kiezen."
                : "Deze invoer is gekoppeld aan het gekozen onderdeel."}
            </p>
            <div className="detail-actions">
              <button
                className="button primary"
                onClick={() => onOpenDossier(saved.assetId)}
              >
                Bekijk in dossier
              </button>
              <button className="button secondary" onClick={reset}>
                Nog iets toevoegen
              </button>
            </div>
          </div>
        ) : (
          <form
            className="resident-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setError("");
              if (file && file.size > 25 * 1024 * 1024) {
                setError("Kies een bestand van maximaal 25 MB.");
                return;
              }
              setBusy(true);
              try {
                const body = new FormData();
                Object.entries(draft).forEach(([key, value]) =>
                  body.set(key, value),
                );
                if (draft.kind === "completed") {
                  const cents = parseCost(draft.cost);
                  if (cents !== null) body.set("costCents", String(cents));
                }
                if (file) body.set("file", file);
                const result = await request<{
                  assetId: string;
                  taskId: string | null;
                  fileIds: string[];
                }>(`/api/houses/${houseId}/entries`, { method: "POST", body });
                if (live.current) {
                  await onSaved();
                  setSaved(result);
                  setDraft(blank(houseId));
                  setFile(null);
                }
              } catch (e) {
                if (live.current) setError((e as Error).message);
              } finally {
                if (live.current) setBusy(false);
              }
            }}
          >
            {draft.kind === "file" && uploadField}
            {draft.kind === "file" && photoChoice}
            <p className="form-note">
              {draft.kind === "task"
                ? "Schrijf kort wat je hebt gezien. Je kunt planning en opvolging later aanvullen."
                : draft.kind === "note"
                  ? "Een idee voor de tuin, die ene verfkleur of iets dat je later wilt onthouden."
                  : draft.kind === "completed"
                    ? "Bewaar het resultaat, de echte uitvoerdatum en eventueel een foto als bewijs."
                    : "Geef het bestand een herkenbare titel, zodat je het later terugvindt."}
            </p>
            <label>
              {draft.kind === "completed" ? "Wat is er gedaan?" : "Korte titel"}
              <input
                name="title"
                value={draft.title}
                onChange={(event) => change({ title: event.target.value })}
                maxLength={200}
                required
                autoComplete="off"
                placeholder={
                  draft.kind === "task"
                    ? "Bijvoorbeeld: ventilator maakt geluid…"
                    : draft.kind === "note"
                      ? "Bijvoorbeeld: ideeën voor het terras"
                      : "Bijvoorbeeld: ons favoriete hoekje"
                }
              />
            </label>
            <fieldset className="capture-place">
              <legend>Geef het een plek</legend>
              <p className="capture-selected-place">
                Gekozen:{" "}
                {dossier.assets.find((asset) => asset.id === draft.assetId)
                  ?.name ?? "Nog te ordenen"}
              </p>
              <PlaceFilter
                assets={dossier.assets}
                value={draft.assetId}
                all={false}
                onChange={(assetId) => change({ assetId })}
              />
            </fieldset>
            <label>
              {draft.kind === "completed"
                ? "Resultaat en bijzonderheden"
                : "Toelichting"}
              {draft.kind === "note" || draft.kind === "completed"
                ? ""
                : " (optioneel)"}
              <textarea
                name="description"
                rows={4}
                maxLength={10000}
                value={draft.description}
                onChange={(event) =>
                  change({ description: event.target.value })
                }
                required={draft.kind === "note" || draft.kind === "completed"}
              />
            </label>
            {draft.kind === "completed" && (
              <label>
                Werkelijk betaalde kosten in euro (optioneel)
                <input
                  name="cost"
                  value={draft.cost}
                  onChange={(event) => change({ cost: event.target.value })}
                  inputMode="decimal"
                  maxLength={12}
                  placeholder="Bijvoorbeeld: 125,50"
                />
                <small>Leeg = onbekend. 0 = geen kosten.</small>
              </label>
            )}
            {(draft.kind === "task" || draft.kind === "completed") && (
              <label>
                {draft.kind === "completed"
                  ? "Uitgevoerd op"
                  : "Geplande datum (optioneel)"}
                <input
                  name="date"
                  type="date"
                  value={draft.date}
                  onChange={(event) => change({ date: event.target.value })}
                  required={draft.kind === "completed"}
                  max={draft.kind === "completed" ? todayLocal() : undefined}
                />
              </label>
            )}
            {draft.kind === "task" && (
              <label>
                Wie pakt het op? (optioneel)
                <select
                  name="assigneeId"
                  value={draft.assigneeId}
                  onChange={(event) =>
                    change({ assigneeId: event.target.value })
                  }
                >
                  <option value="">Nog af te spreken</option>
                  {active.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details className="capture-extra">
              <summary>Wie heeft dit bewaard?</summary>
              <label>
                {draft.kind === "completed"
                  ? "Uitgevoerd door (optioneel)"
                  : "Bewaard door (optioneel)"}
                <select
                  name="recordedById"
                  value={draft.recordedById}
                  onChange={(event) =>
                    change({ recordedById: event.target.value })
                  }
                >
                  <option value="">Niet vastgelegd</option>
                  {active.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </details>
            {draft.kind !== "file" && uploadField}
            {draft.kind !== "file" && photoChoice}
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <div className="resident-form-actions">
              <button className="button primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Opslaan…" : "Opslaan in dossier"}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Wil je dit concept leegmaken? Het is nog niet in het dossier opgeslagen.",
                    )
                  )
                    reset();
                }}
              >
                Concept leegmaken
              </button>
            </div>
          </form>
        )}
      </div>
      {!saved && (
        <CaptureHelp
          kind={draft.kind}
          asset={dossier.assets.find((asset) => asset.id === draft.assetId)}
        />
      )}
    </section>
  );
}
