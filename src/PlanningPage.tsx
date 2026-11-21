import { useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Pencil,
  Plus,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { CalendarMonth } from "./CalendarMonth";
import "./calendar-page.css";
import { ReminderSettings } from "./MaintenanceReminders";
import {
  formatCost,
  planningGroups,
  recordedCosts,
  shiftDay,
} from "./planning";
import { residentDate, todayLocal } from "./residentWorkflows";
import { request } from "./api";
import type { Dossier, Task } from "./types";

export function PlanningPage({
  houseId,
  dossier,
  onRefresh,
  onEdit,
  onComplete,
  onPart,
  onManage,
  onCapture,
}: {
  houseId: string;
  dossier: Dossier;
  onRefresh: () => Promise<void>;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onPart: (id: string) => void;
  onManage: () => void;
  onCapture: () => void;
}) {
  const [person, setPerson] = useState(""),
    [alarm, setAlarm] = useState("0"),
    [snooze, setSnooze] = useState<Task | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [selection, setSelection] = useState<
    "month" | "all" | "overdue" | "unscheduled" | "day"
  >("month");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const agenda = useRef<HTMLElement>(null);
  const today = todayLocal(),
    groups = planningGroups(dossier.tasks, today, 30, person);
  const year = today.slice(0, 4),
    costs = recordedCosts(dossier.tasks, year);
  const dated = [...groups.overdue, ...groups.soon, ...groups.later];
  const monthly = dated.filter((task) => task.date.startsWith(month));
  const visible =
    selection === "day"
      ? dated.filter((task) => task.date === selectedDay)
      : selection === "month"
        ? monthly
        : selection === "all"
          ? [...dated, ...groups.unscheduled]
          : groups[selection];
  const agendaTitle =
    selection === "day" && selectedDay
      ? residentDate(selectedDay)
      : selection === "month"
        ? "Deze maand"
        : selection === "overdue"
          ? "Nog open na de datum"
          : selection === "unscheduled"
            ? "Nog een datum kiezen"
            : "Alle open klussen";
  const api = `/api/houses/${houseId}`;
  const calendarUrl = (task?: string) =>
    `${api}/calendar.ics?${new URLSearchParams({ ...(person ? { assignee: person } : {}), ...(task ? { task } : {}), alarm })}`;
  const reminder = async (task: Task, date: string | null) => {
    setBusy(true);
    setError("");
    try {
      await request(`${api}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ remindOn: date }),
      });
      await onRefresh();
      setSnooze(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const renderTask = (task: Task) => (
    <article className="planning-task" key={task.id}>
      <div className="planning-date">
        <strong>
          {task.date
            ? new Date(`${task.date}T12:00:00`).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
              })
            : "—"}
        </strong>
        <span>{task.date ? task.date.slice(0, 4) : "Geen datum"}</span>
      </div>
      <div className="planning-task-body">
        <h3>{task.title}</h3>
        <p>
          <button className="text-link" onClick={() => onPart(task.assetId)}>
            {dossier.assets.find((asset) => asset.id === task.assetId)?.name ??
              "Onderdeel"}
          </button>
          <span>
            {" "}
            {dossier.people?.find((p) => p.id === task.assigneeId)?.name ||
            task.owner
              ? ` · ${dossier.people?.find((p) => p.id === task.assigneeId)?.name || task.owner}`
              : ""}
            {task.state === "hold"
              ? " · Wacht op"
              : task.state === "verify"
                ? " · Controleren"
                : ""}
          </span>
        </p>
        {task.remindOn && task.remindOn > today && (
          <p className="reminder-snoozed">
            Herinnering uitgesteld tot {residentDate(task.remindOn)}.
            Onderhoudsdatum blijft{" "}
            {task.date ? residentDate(task.date) : "nog te plannen"}.
          </p>
        )}
        <div className="planning-actions">
          <button className="agenda-complete" onClick={() => onComplete(task)}>
            <CheckCircle2 size={15} />
            Afronden
          </button>
          <button
            className="agenda-edit"
            aria-label={`Details en aanpassen: ${task.title}`}
            title="Details en aanpassen"
            onClick={() => onEdit(task)}
          >
            <Pencil size={17} />
          </button>
          {task.date && (
            <>
              <button
                className="agenda-reminder"
                aria-label={`Herinnering: ${task.title}`}
                title="Herinnering instellen"
                onClick={() => {
                  setError("");
                  setSnooze(task);
                }}
              >
                <Clock3 size={17} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
  return (
    <div className="planning-page">
      <div className="planning-top-actions">
        <div
          className="category-choices planning-persons"
          role="group"
          aria-label="Toon planning voor"
        >
          <button aria-pressed={!person} onClick={() => setPerson("")}>
            Iedereen
          </button>
          {dossier.people?.map((p) => (
            <button
              key={p.id}
              aria-pressed={person === p.id}
              onClick={() => setPerson(p.id)}
            >
              {p.name}
              {p.active ? "" : " (gearchiveerd)"}
            </button>
          ))}
          <button
            aria-pressed={person === "unassigned"}
            onClick={() => setPerson("unassigned")}
          >
            Nog niemand gekozen
          </button>
        </div>
        <button className="button primary" onClick={onCapture}>
          <Plus size={19} /> Klus toevoegen
        </button>
      </div>
      <div className="calendar-workspace">
        <CalendarMonth
          month={month}
          today={today}
          selected={selection === "day" ? selectedDay : null}
          tasks={dated}
          onMonth={(value) => {
            setMonth(value);
            setSelection("month");
            setSelectedDay(null);
          }}
          onDay={(date) => {
            setSelectedDay(date);
            setMonth(date.slice(0, 7));
            setSelection("day");
            if (window.matchMedia("(max-width: 900px)").matches)
              requestAnimationFrame(() => {
                agenda.current?.focus({ preventScroll: true });
                agenda.current?.scrollIntoView({
                  block: "start",
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                });
              });
          }}
        />
        <section
          className="calendar-agenda"
          aria-label="Klussen bij de kalender"
          ref={agenda}
          tabIndex={-1}
        >
          <div className="calendar-agenda-heading">
            <div>
              <span>Je huis, op tijd</span>
              <h2>{agendaTitle}</h2>
            </div>
            <CalendarDays size={27} aria-hidden="true" />
          </div>
          <div
            className="calendar-agenda-filters"
            role="group"
            aria-label="Welke klussen"
          >
            {(
              [
                { id: "month", label: "Deze maand", count: monthly.length },
                {
                  id: "overdue",
                  label: "Over datum",
                  count: groups.overdue.length,
                },
                {
                  id: "unscheduled",
                  label: "Nog te plannen",
                  count: groups.unscheduled.length,
                },
                {
                  id: "all",
                  label: "Alles",
                  count: dated.length + groups.unscheduled.length,
                },
              ] as const
            ).map(({ id, label, count }) => (
              <button
                key={id}
                aria-pressed={selection === id}
                onClick={() => setSelection(id)}
              >
                {label}
                <small>{count}</small>
              </button>
            ))}
          </div>
          <div className="calendar-agenda-items" aria-live="polite">
            {visible.length ? (
              visible.map(renderTask)
            ) : (
              <div className="calendar-day-empty">
                <CheckCircle2 size={50} />
                <h3>Ruimte in je planning</h3>
                <p>
                  {selection === "day"
                    ? "Op deze dag staan geen open klussen."
                    : "Er staan geen open klussen in deze selectie."}
                </p>
                <button className="button secondary" onClick={onCapture}>
                  <Plus size={17} /> Een klus toevoegen
                </button>
              </div>
            )}
          </div>
          <button className="planning-manage-link" onClick={onManage}>
            Mensen & terugkerende afspraken <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
      {error && !snooze && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <details className="planning-tools">
        <summary>
          <Bell size={21} /> Agenda, herinneringen & kosten
        </summary>
        <div className="planning-secondary">
          <section className="content-panel calendar-export">
            <h2>
              <CalendarDays size={19} aria-hidden="true" /> Je eigen agenda
            </h2>
            <p>
              Download de {dated.length} open{" "}
              {dated.length === 1 ? "melding" : "meldingen"} met datum in deze
              selectie. Importeer het bestand in je agenda, liefst in een aparte
              agenda voor huisonderhoud.
            </p>
            <label>
              Herinnering in het agendabestand
              <select value={alarm} onChange={(e) => setAlarm(e.target.value)}>
                <option value="0">Geen herinnering toevoegen</option>
                <option value="1">1 dag vooraf om 09:00</option>
                <option value="7">7 dagen vooraf om 09:00</option>
              </select>
            </label>
            {dated.length > 0 ? (
              <a className="button secondary" href={calendarUrl()} download>
                <Download size={16} />
                Download planning (.ics)
              </a>
            ) : (
              <p className="form-note">
                Kies eerst een datum bij minstens één open melding.
              </p>
            )}
            <p className="form-note">
              Dit is een momentopname, geen automatische synchronisatie. Latere
              wijzigingen en afrondingen moet je ook in je agenda bijwerken.
              Opnieuw importeren kan dubbele afspraken geven. Herinneringen en
              de tijdzone worden door je agenda verwerkt; controleer ze na het
              importeren. Alleen de eerstvolgende onderhoudsbeurt wordt
              meegenomen.
            </p>
          </section>
          <section className="content-panel maintenance-costs">
            <h2>Uitgevoerd onderhoud in {year}</h2>
            <strong className="cost-total">
              {costs.known
                ? formatCost(costs.cents)
                : "Nog geen kosten vastgelegd"}
            </strong>
            <p>
              {costs.known} van {costs.total} afgeronde meldingen hebben een
              bedrag. Het totaal bevat alleen vastgelegde kosten voor de hele
              woning.
            </p>
            <p className="form-note">
              Vul bij het afronden de werkelijk betaalde kosten in. Laat het
              veld leeg als het bedrag onbekend is; € 0 betekent gratis
              uitgevoerd.
            </p>
          </section>
        </div>
        <ReminderSettings key={houseId} houseId={houseId} dossier={dossier} />
      </details>
      {snooze && (
        <Dialog
          title="Herinnering uitstellen"
          onClose={() => {
            if (!busy) setSnooze(null);
          }}
        >
          <form
            className="resident-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              reminder(snooze, String(form.get("remindOn")));
            }}
          >
            <p>
              <strong>{snooze.title}</strong>
            </p>
            <label>
              Opnieuw herinneren vanaf
              <input
                type="date"
                name="remindOn"
                required
                min={shiftDay(today, 1)}
                defaultValue={
                  snooze.remindOn && snooze.remindOn > today
                    ? snooze.remindOn
                    : shiftDay(today, 7)
                }
              />
            </label>
            <p className="form-note">
              Dit stelt alleen de herinnering in Huisdossier uit. De
              onderhoudsdatum en eerder geïmporteerde agenda-afspraken
              veranderen niet.
            </p>
            <div className="contact-actions">
              <a className="text-link" href={calendarUrl(snooze.id)} download>
                <Download size={16} /> Deze klus naar je agenda
              </a>
              {snooze.remindOn && (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => reminder(snooze, null)}
                >
                  Uitstel opheffen
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="alert error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setSnooze(null)}
              >
                Annuleren
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Opslaan…" : "Herinnering uitstellen"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
