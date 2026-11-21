import { useState } from "react";
import {
  Ruler,
  Shapes,
  Palette,
  Armchair,
  BookOpen,
  ScanLine,
  Search,
} from "lucide-react";
import type { Floorplan, HouseInformationItem } from "./types";
import {
  informationForRoom,
  informationStatuses,
  informationTopics,
} from "./information";
import { ReadableText } from "./ReadableText";
import "./information-book.css";

const topicIcons = {
  dimensions: Ruler,
  layout: Shapes,
  finishes: Palette,
  furnishing: Armchair,
  sources: BookOpen,
  accuracy: ScanLine,
};

export function InformationBook({
  items,
  title = "Goed om te weten",
  roomId,
  rooms,
  original,
  compact = false,
}: {
  items: HouseInformationItem[];
  title?: string;
  roomId?: string;
  rooms?: Floorplan["rooms"];
  original?: { label: string; text: string }[];
  compact?: boolean;
}) {
  const [chosenRoom, setChosenRoom] = useState("");
  const [topic, setTopic] = useState<keyof typeof informationTopics | "">("");
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const scope = roomId ?? chosenRoom;
  const scoped = informationForRoom(items, scope);
  const matching = scoped.filter((item) =>
    query
      ? `${item.title} ${item.value ?? ""} ${item.text} ${item.source ?? ""}`
          .toLocaleLowerCase("nl")
          .includes(query.toLocaleLowerCase("nl"))
      : !topic || item.topic === topic,
  );
  const visible = all || query ? matching : matching.slice(0, 4);
  const topics = Object.entries(informationTopics).filter(([id]) =>
    scoped.some((item) => item.topic === id),
  );
  if (!items.length)
    return (
      <section className="information-book" aria-label={title}>
        <header className="information-heading">
          <h3>{title}</h3>
        </header>
        {original?.map((part, index) => (
          <section key={index}>
            <h4>{part.label}</h4>
            <ReadableText text={part.text} />
          </section>
        ))}
      </section>
    );
  return (
    <section
      className={`information-book ${compact ? "compact" : ""}`}
      aria-label={title}
    >
      <header className="information-heading">
        <div>
          <h3>{title}</h3>
          <p>Per onderwerp, met de herkomst erbij.</p>
        </div>
        <BookOpen size={25} aria-hidden="true" />
      </header>
      {rooms && !roomId && (
        <div
          className="information-places"
          role="group"
          aria-label="Informatie per ruimte"
        >
          <button
            type="button"
            aria-pressed={!chosenRoom}
            onClick={() => {
              setChosenRoom("");
              setAll(false);
            }}
          >
            Hele huis
          </button>
          {rooms
            .filter((room) =>
              items.some((item) => item.roomIds?.includes(room.id)),
            )
            .map((room) => (
              <button
                type="button"
                key={room.id}
                aria-pressed={chosenRoom === room.id}
                onClick={() => {
                  setChosenRoom(room.id);
                  setAll(false);
                  setTopic("");
                }}
              >
                {room.name}
              </button>
            ))}
        </div>
      )}
      {items.length > 4 && (
        <div className="information-controls">
          <div
            className="information-topics"
            role="group"
            aria-label="Informatieonderwerp"
          >
            <button
              type="button"
              aria-pressed={!topic}
              onClick={() => {
                setTopic("");
                setAll(false);
              }}
            >
              Overzicht
            </button>
            {topics.map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={topic === id}
                onClick={() => {
                  setTopic(id as keyof typeof informationTopics);
                  setAll(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="information-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Zoek een gegeven"
              aria-label="Zoek een gegeven"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      )}
      <div className="information-cards" aria-live="polite">
        {visible.map((item) => {
          const Icon = topicIcons[item.topic];
          return (
            <article
              key={item.id}
              className={`information-card information-${item.topic}`}
            >
              <div className="information-card-top">
                <Icon size={23} aria-hidden="true" />
                <span className={`information-status status-${item.status}`}>
                  {informationStatuses[item.status]}
                </span>
              </div>
              <h4>{item.title}</h4>
              {item.value && (
                <strong className="information-value">{item.value}</strong>
              )}
              <ReadableText text={item.text} />
              {rooms && !scope && item.roomIds?.length ? (
                <span className="information-room-label">
                  {item.roomIds
                    .map((id) => rooms.find((room) => room.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              ) : null}
              {item.source && (
                <footer>
                  <BookOpen size={14} aria-hidden="true" />
                  <span>{item.source}</span>
                </footer>
              )}
            </article>
          );
        })}
      </div>
      {!matching.length && (
        <p className="information-empty">Geen gegevens bij deze keuze.</p>
      )}
      {!query && matching.length > visible.length && (
        <button
          type="button"
          className="information-more"
          onClick={() => setAll(true)}
        >
          Nog {matching.length - visible.length} gegevens tonen
        </button>
      )}
      {all && matching.length > 4 && (
        <button
          type="button"
          className="information-more"
          onClick={() => setAll(false)}
        >
          Minder tonen
        </button>
      )}
      {original?.length ? (
        <details className="information-original">
          <summary>Oorspronkelijke bronbeschrijving</summary>
          {original.map((part, index) => (
            <section key={index}>
              <h4>{part.label}</h4>
              <ReadableText text={part.text} />
            </section>
          ))}
        </details>
      ) : null}
    </section>
  );
}

export function PlanInformation({
  plan,
  roomId,
  compact = false,
}: {
  plan: Floorplan;
  roomId?: string;
  compact?: boolean;
}) {
  const room = plan.rooms.find((room) => room.id === roomId);
  const items: HouseInformationItem[] = plan.information ?? [
    {
      id: "model-ceiling",
      title: "Plafondhoogte in het model",
      value: `${plan.ceilingHeight.toLocaleString("nl-NL")} m`,
      text: "Een modelinstelling. De bronbeschrijving bepaalt voor welke ruimtes deze maat is onderbouwd.",
      topic: "dimensions",
      status: "approximate",
    },
    ...plan.rooms
      .filter((room) => room.area)
      .map((room) => ({
        id: `area:${room.id}`,
        title: `Vermeld oppervlak ${room.name}`,
        value: `${room.area!.toLocaleString("nl-NL")} m²`,
        text: "Waarde uit het opgeslagen ruimteprofiel; geen nieuwe inmeting.",
        topic: "dimensions" as const,
        status: "source" as const,
        roomIds: [room.id],
      })),
  ];
  return (
    <InformationBook
      key={roomId ?? "house"}
      title={
        room
          ? `Maten & achtergrond van ${room.name}`
          : "Je huis, stukje voor stukje"
      }
      items={items}
      roomId={roomId}
      rooms={plan.rooms}
      compact={compact}
      original={[
        { label: "Herkomst", text: plan.source },
        { label: "Modelbeschrijving", text: plan.description },
      ]}
    />
  );
}
