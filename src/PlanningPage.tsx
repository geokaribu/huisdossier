import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Pencil,
} from "lucide-react";
import { Dialog } from "./Dialog";
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
  const today = todayLocal(),
    groups = planningGroups(dossier.tasks, today, 30, person);
  const year = today.slice(0, 4),
    costs = recordedCosts(dossier.tasks, year);
  const dated = [...groups.overdue, ...groups.soon, ...groups.later];
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
            ·{" "}
            {dossier.people?.find((p) => p.id === task.assigneeId)?.name ||
              task.owner ||
              "Nog niemand gekozen"}
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
          <button className="text-link" onClick={() => onComplete(task)}>
            <CheckCircle2 size={15} />
            Afronden
          </button>
          <button className="text-link" onClick={() => onEdit(task)}>
            <Pencil size={14} />
            Aanpassen
          </button>
          {task.date && (
            <>
              <button
                className="text-link"
                onClick={() => {
                  setError("");
                  setSnooze(task);
                }}
              >
                <Clock3 size={14} />
                Herinnering uitstellen
              </button>
              <a className="text-link" href={calendarUrl(task.id)} download>
                <CalendarDays size={14} />
                Naar agenda
              </a>
            </>
          )}
          {task.remindOn && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => reminder(task, null)}
            >
              Uitstel opheffen
            </button>
          )}
        </div>
      </div>
    </article>
  );
  return (
    <div className="planning-page">
      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>Wat komt eraan?</h2>
            <p>
              Open onderhoud op volgorde van datum. Ook uitgestelde
              herinneringen blijven hier zichtbaar.
            </p>
          </div>
          <button className="button primary" onClick={onCapture}>
            Onderhoud toevoegen
          </button>
        </div>
        <div className="planning-options">
          <label>
            Toon planning voor
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">Iedereen</option>
              <option value="unassigned">Zonder verantwoordelijke</option>
              {dossier.people?.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                  {p.active ? "" : " (gearchiveerd)"}
                </option>
              ))}
            </select>
          </label>
          <button className="text-link" onClick={onManage}>
            Terugkerend onderhoud & contacten beheren →
          </button>
        </div>
        <div className="planning-counts">
          <span>
            <strong>{groups.overdue.length}</strong> over datum
          </span>
          <span>
            <strong>{groups.soon.length}</strong> komende 30 dagen
          </span>
          <span>
            <strong>{groups.unscheduled.length}</strong> nog te plannen
          </span>
        </div>
        {Object.values(groups).every((items) => !items.length) && (
          <p className="planning-empty">
            Er staat geen open onderhoud in deze selectie. Voeg een klus toe of
            stel bij Beheer terugkerend onderhoud in.
          </p>
        )}
        {(
          [
            ["overdue", "Over datum"],
            ["soon", "Vandaag & komende 30 dagen"],
            ["unscheduled", "Nog een datum kiezen"],
          ] as const
        ).map(
          ([key, title]) =>
            groups[key].length > 0 && (
              <section className={`planning-group ${key}`} key={key}>
                <h2>
                  {title} <span>({groups[key].length})</span>
                </h2>
                {groups[key].map(renderTask)}
              </section>
            ),
        )}
        {groups.later.length > 0 && (
          <details className="planning-later">
            <summary>Later gepland ({groups.later.length})</summary>
            {groups.later.map(renderTask)}
          </details>
        )}
        {error && !snooze && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
      </section>
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
            Opnieuw importeren kan dubbele afspraken geven. Herinneringen en de
            tijdzone worden door je agenda verwerkt; controleer ze na het
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
            Vul bij het afronden de werkelijk betaalde kosten in. Laat het veld
            leeg als het bedrag onbekend is; € 0 betekent gratis uitgevoerd.
          </p>
        </section>
      </div>
      <ReminderSettings key={houseId} houseId={houseId} dossier={dossier} />
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
