import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  House,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Palette,
  Plus,
  Ruler,
  Send,
  Settings2,
  Square,
  Wallet,
  Wrench,
} from "lucide-react";
import { request } from "./api";
import { Dialog } from "./Dialog";
import { PlaceFilter } from "./HouseAtlas";
import type { Dossier } from "./types";
import type { HousePage } from "./houseSelection";
import "./house-assistant.css";

type Connection = {
  provider: "off" | "openai" | "ollama";
  model: string;
  configured: boolean;
};
type Source = {
  id: string;
  title: string;
  assetId?: string;
  fileId?: string;
  page?: HousePage;
  excerpt: string;
};
type Answer = {
  paragraphs: { text: string; sourceIds: string[] }[];
  missing: string[];
  followUps: string[];
  sources: Source[];
  coverage: {
    files: number;
    readableFiles: number;
    selectedRecords: number;
    unavailable: string[];
  };
};
type Turn = {
  id: number;
  question: string;
  answer?: Answer;
  error?: string;
  stopped?: boolean;
};
const examples = [
  {
    Icon: Ruler,
    label: "De maten van thuis",
    question: "Welke maten zijn bekend en welke zijn nog een benadering?",
  },
  {
    Icon: Wrench,
    label: "Wat vraagt aandacht?",
    question: "Welke klussen staan nog open?",
  },
  {
    Icon: Wallet,
    label: "Wat hebben we uitgegeven?",
    question: "Welke onderhoudskosten zijn geregistreerd?",
  },
  {
    Icon: Palette,
    label: "Kleuren & materialen",
    question: "Wat weten we over de kleuren en afwerking in huis?",
  },
];
function Settings({
  connection,
  onClose,
  onSaved,
}: {
  connection: Connection | null;
  onClose: () => void;
  onSaved: (status: Connection) => void;
}) {
  const [provider, setProvider] = useState<Connection["provider"]>(
    connection?.provider === "off"
      ? "openai"
      : connection?.provider || "openai",
  );
  const [model, setModel] = useState(connection?.model || "gpt-6.2-astra");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const status = await request<Connection>("/api/assistant/settings", {
        method: "PUT",
        body: JSON.stringify({ provider, model, apiKey }),
      });
      setApiKey("");
      onSaved(status);
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Je huisassistent verbinden" onClose={onClose}>
      <form className="assistant-settings" onSubmit={save}>
        <p>
          Kies welk AI-model je vragen beantwoordt. De aansluiting geldt voor
          deze installatie.
        </p>
        <fieldset disabled={busy}>
          <legend>AI-aansluiting</legend>
          <div className="assistant-providers">
            {(
              [
                {
                  id: "openai",
                  label: "OpenAI",
                  detail: "Via je eigen API-sleutel",
                },
                {
                  id: "ollama",
                  label: "Lokaal",
                  detail: "Via Ollama op deze computer",
                },
                { id: "off", label: "Uit", detail: "Geen vragen versturen" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={provider === item.id}
                onClick={() => {
                  setProvider(item.id);
                  setModel(
                    item.id === connection?.provider
                      ? connection.model
                      : item.id === "openai"
                        ? "gpt-6.2-astra"
                        : "",
                  );
                  setApiKey("");
                }}
              >
                <strong>
                  {item.label} {provider === item.id && <Check size={16} />}
                </strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
          {provider !== "off" && (
            <label>
              Modelnaam
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                required
                maxLength={160}
                placeholder={
                  provider === "ollama"
                    ? "Naam van je geïnstalleerde model"
                    : "OpenAI-model"
                }
                autoComplete="off"
              />
            </label>
          )}
          {provider === "openai" && (
            <>
              <label>
                OpenAI API-sleutel
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  maxLength={500}
                  placeholder={
                    connection?.provider === "openai" && connection.configured
                      ? "Laat leeg om de bestaande sleutel te behouden"
                      : "Vul je API-sleutel in"
                  }
                  required={
                    !(
                      connection?.provider === "openai" && connection.configured
                    )
                  }
                />
              </label>
              <p className="assistant-connection-note">
                Je vraag en relevante dossierfragmenten gaan naar OpenAI.
                API-gebruik kan kosten met zich meebrengen. De sleutel blijft in
                de lokale serveropslag en wordt niet in de browser bewaard.{" "}
                <a
                  href="https://developers.openai.com/api/docs/guides/your-data"
                  target="_blank"
                  rel="noreferrer"
                >
                  Gegevens bij OpenAI <ArrowUpRight size={13} />
                </a>
              </p>
            </>
          )}
          {provider === "ollama" && (
            <p className="assistant-connection-note">
              Gebruikt alleen Ollama op 127.0.0.1:11434. Start Ollama zelf met
              een geïnstalleerd model. Er wordt niets gedownload of
              geïnstalleerd.
            </p>
          )}
          {provider !== "off" && (
            <p className="assistant-connection-note">
              De verbinding wordt bij je eerste vraag gecontroleerd. Je gesprek
              blijft alleen in dit geopende huisboek bewaard; verversen of van
              huis wisselen wist het gesprek.
            </p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Check size={18} />
          )}{" "}
          Instellingen bewaren
        </button>
      </form>
    </Dialog>
  );
}
export function HouseAssistant({
  houseId,
  dossier,
  active,
  onPart,
  onDocument,
  onNavigate,
}: {
  houseId: string;
  dossier: Dossier;
  active: boolean;
  onPart: (id: string) => void;
  onDocument: (id: string) => void;
  onNavigate: (page: HousePage) => void;
}) {
  const [connection, setConnection] = useState<Connection | null>(null),
    [statusError, setStatusError] = useState("");
  const [settings, setSettings] = useState(false),
    [scope, setScope] = useState("");
  const [sourcePreview, setSourcePreview] = useState<Source | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null),
    sequence = useRef(0),
    composer = useRef<HTMLTextAreaElement>(null),
    latest = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!active) {
      setSettings(false);
      setSourcePreview(null);
      return;
    }
    const abort = new AbortController();
    request<Connection>("/api/assistant/status", { signal: abort.signal })
      .then((status) => {
        setConnection(status);
        setStatusError("");
      })
      .catch((error) => {
        if (!abort.signal.aborted) setStatusError(error.message);
      });
    return () => abort.abort();
  }, [active]);
  useEffect(() => {
    if (active && turns.length)
      latest.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [turns, active]);
  function clear() {
    controller.current?.abort();
    controller.current = null;
    setTurns([]);
    setBusy(false);
    setDraft("");
  }
  async function ask(question: string, retryId?: number) {
    const text = question.trim();
    if (!text || text.length > 2500 || busy) return;
    if (!connection?.configured) {
      setDraft(text);
      setSettings(true);
      return;
    }
    const id = retryId ?? ++sequence.current;
    const history = turns
      .filter((turn) => turn.answer && turn.id !== retryId)
      .flatMap((turn) => [
        { role: "user", content: turn.question },
        {
          role: "assistant",
          content: [
            ...turn.answer!.paragraphs.map((paragraph) => paragraph.text),
            ...turn.answer!.missing,
          ]
            .join("\n")
            .slice(0, 6000),
        },
      ])
      .slice(-12);
    setTurns((previous) =>
      retryId
        ? previous.map((turn) =>
            turn.id === retryId ? { id, question: text } : turn,
          )
        : [...previous, { id, question: text }],
    );
    setDraft("");
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const answer = await request<Answer>(
        `/api/houses/${encodeURIComponent(houseId)}/assistant`,
        {
          method: "POST",
          signal: abort.signal,
          body: JSON.stringify({ question: text, assetId: scope, history }),
        },
      );
      if (controller.current === abort)
        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, answer } : turn)),
        );
    } catch (error) {
      if (controller.current === abort)
        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  ...(abort.signal.aborted
                    ? { stopped: true }
                    : { error: (error as Error).message }),
                }
              : turn,
          ),
        );
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  function openSource(source: Source) {
    if (
      source.fileId &&
      dossier.attachments.some((file) => file.id === source.fileId)
    )
      onDocument(source.fileId);
    else if (
      source.assetId &&
      dossier.assets.some((asset) => asset.id === source.assetId)
    )
      onPart(source.assetId);
    else if (source.page) onNavigate(source.page);
  }
  const composerForm = (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void ask(draft);
      }}
    >
      <label htmlFor="house-question">
        Je vraag over{" "}
        {scope
          ? dossier.assets.find((asset) => asset.id === scope)?.name
          : "het huis"}
      </label>
      <div>
        <textarea
          id="house-question"
          ref={composer}
          value={draft}
          maxLength={2500}
          rows={2}
          placeholder="Bijvoorbeeld: wat weten we over de keuken?"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void ask(draft);
            }
          }}
        />
        {busy ? (
          <button
            type="button"
            className="assistant-send stop"
            onClick={() => controller.current?.abort()}
            aria-label="Antwoord stoppen"
          >
            <Square size={20} /> Stop
          </button>
        ) : (
          <button
            type="submit"
            className="assistant-send"
            disabled={!draft.trim() || !connection}
            aria-label="Vraag versturen"
          >
            <Send size={21} />
            <span>Vraag maar</span>
          </button>
        )}
      </div>
      <p>
        Antwoorden uit je bewaarde informatie, met bronnen. Controleer
        belangrijke gegevens altijd bij de bron.
      </p>
    </form>
  );
  return (
    <section className="house-assistant" aria-label="Vraag je huis">
      <div className="assistant-toolbar">
        <span
          className={`assistant-status ${connection?.configured ? "connected" : ""}`}
        >
          <span />
          {connection?.configured
            ? `${connection.provider === "openai" ? "OpenAI" : "Lokaal model"} ingesteld`
            : "AI nog niet verbonden"}
        </span>
        <div>
          <button
            className="button secondary"
            onClick={() => setSettings(true)}
            disabled={busy}
          >
            <Settings2 size={17} /> AI instellen
          </button>
          {turns.length > 0 && (
            <button className="button secondary" onClick={clear}>
              <Plus size={17} /> Nieuw gesprek
            </button>
          )}
        </div>
      </div>
      {statusError && (
        <p role="alert" className="error">
          {statusError}
        </p>
      )}
      <fieldset className="assistant-scope" disabled={busy}>
        <legend>Waar gaat je vraag over?</legend>
        <PlaceFilter
          assets={dossier.assets}
          value={scope}
          onChange={(id) => {
            if (id !== scope) {
              clear();
              setScope(id);
            }
          }}
        />
      </fieldset>
      {!turns.length && (
        <div className="assistant-welcome">
          <div className="assistant-house-mark" aria-hidden="true">
            <House size={58} strokeWidth={1.4} />
            <MessageCircle size={33} strokeWidth={1.6} />
          </div>
          <div>
            <h2>
              Wat wil je weten
              <br />
              over thuis?
            </h2>
          </div>
          {composerForm}
          <div className="assistant-examples">
            {examples.map(({ Icon, label, question }) => (
              <button
                key={label}
                onClick={() => {
                  setDraft(question);
                  composer.current?.focus();
                }}
              >
                <Icon size={26} strokeWidth={1.5} />
                <span>{label}</span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="assistant-conversation"
        aria-label="Gesprek met je huis"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {turns.map((turn, index) => (
          <article className="assistant-turn" key={turn.id}>
            <div className="assistant-question">
              <span>Jij</span>
              <p>{turn.question}</p>
            </div>
            {turn.answer && (
              <div className="assistant-answer">
                <div className="assistant-answer-label">
                  <MessageCircle size={20} /> Je huisboek
                </div>
                {turn.answer.paragraphs.map((paragraph, p) => (
                  <div className="assistant-paragraph" key={p}>
                    <p>{paragraph.text}</p>
                    <div className="assistant-citations">
                      {paragraph.sourceIds.map((id) => {
                        const source = turn.answer!.sources.find(
                          (s) => s.id === id,
                        );
                        return (
                          source && (
                            <button
                              key={id}
                              onClick={() => setSourcePreview(source)}
                              title={`Open bron: ${source.title}`}
                            >
                              <BookOpen size={13} />{" "}
                              {turn.answer!.sources.indexOf(source) + 1}.{" "}
                              {source.title}
                            </button>
                          )
                        );
                      })}
                    </div>
                  </div>
                ))}
                {turn.answer.missing.length > 0 && (
                  <div className="assistant-missing">
                    <Lightbulb size={23} />
                    <div>
                      <h3>Dit weten we nog niet</h3>
                      {turn.answer.missing.map((text, i) => (
                        <p key={i}>{text}</p>
                      ))}
                    </div>
                  </div>
                )}
                <details className="assistant-coverage">
                  <summary>Waarop is dit antwoord gebaseerd?</summary>
                  <p>
                    Voor deze vraag zijn {turn.answer.coverage.selectedRecords}{" "}
                    relevante dossierfragmenten geselecteerd. Van{" "}
                    {turn.answer.coverage.files} bestanden bij deze plek hebben
                    er {turn.answer.coverage.readableFiles} bewaarde tekst.
                    Foto's en scans worden niet automatisch uitgelezen.
                  </p>
                  {turn.answer.coverage.unavailable.length > 0 && (
                    <p>
                      Niet beschikbaar bij deze vraag:{" "}
                      {turn.answer.coverage.unavailable.join(", ")}.
                    </p>
                  )}
                </details>
                {index === turns.length - 1 &&
                  turn.answer.followUps.length > 0 && (
                    <div className="assistant-followups">
                      {turn.answer.followUps.map((question) => (
                        <button
                          key={question}
                          disabled={busy}
                          onClick={() => void ask(question)}
                        >
                          {question}
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
            {(turn.error || turn.stopped) && (
              <div
                className="assistant-question-error"
                role={turn.error ? "alert" : "status"}
              >
                <p>{turn.error || "Vraag gestopt."}</p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void ask(turn.question, turn.id)}
                >
                  Opnieuw proberen
                </button>
              </div>
            )}
            {!turn.answer && !turn.error && !turn.stopped && (
              <p className="assistant-thinking" role="status">
                <LoaderCircle size={20} className="spin" /> Je huisboek wordt
                erbij gepakt…
              </p>
            )}
          </article>
        ))}
        <div ref={latest} />
      </div>
      {turns.length > 0 && composerForm}
      {sourcePreview && (
        <Dialog
          title={sourcePreview.title}
          onClose={() => setSourcePreview(null)}
        >
          <div className="assistant-source-preview">
            <span>
              <BookOpen size={17} /> Bewaard bronfragment
            </span>
            {sourcePreview.excerpt
              .split("\n")
              .filter(Boolean)
              .map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            <button
              className="button primary"
              onClick={() => {
                const source = sourcePreview;
                setSourcePreview(null);
                openSource(source);
              }}
            >
              {sourcePreview.fileId
                ? "Open het document"
                : sourcePreview.assetId
                  ? "Open deze plek"
                  : "Open het oorspronkelijke overzicht"}{" "}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </Dialog>
      )}
      {settings && (
        <Settings
          connection={connection}
          onClose={() => setSettings(false)}
          onSaved={setConnection}
        />
      )}
    </section>
  );
}
