import { useEffect, useState } from "react";
import { ReadableText } from "./ReadableText";
import {
  CalendarDays,
  Pencil,
  Plus,
  Users,
  Pause,
  Play,
  ClipboardList,
} from "lucide-react";
import { DossierExport } from "./DossierExport";
import { request } from "./api";
import { Dialog } from "./Dialog";
import {
  ContactActions,
  ContactFields,
  contactFieldsData,
} from "./ContactDetails";
import {
  dossierAttention,
  residentDate,
  todayLocal,
} from "./residentWorkflows";
import type {
  Dossier,
  ManagementData,
  MaintenancePlan,
  Person,
  Task,
} from "./types";

export function ManagementPage({
  houseId,
  dossier,
  onRefresh,
  onFiles,
  onEditTask,
  onCapture,
}: {
  houseId: string;
  dossier: Dossier;
  onRefresh: () => Promise<void>;
  onFiles: (id: string) => void;
  onEditTask: (task: Task) => void;
  onCapture: () => void;
}) {
  const [data, setData] = useState<ManagementData | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<
    | { kind: "person"; person?: Person }
    | { kind: "plan"; plan?: MaintenancePlan }
    | null
  >(null);
  const api = `/api/houses/${houseId}`;
  useEffect(() => {
    let active = true;
    request<ManagementData>(`${api}/management`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const mutate = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setData(await request<ManagementData>(`${api}/management`));
      await onRefresh();
      setModal(null);
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const attention = dossierAttention(dossier),
    people = data?.people ?? dossier.people ?? [];
  const problems = [
    ...new Map(
      [...attention.overdue, ...attention.unassigned].map((task) => [
        task.id,
        task,
      ]),
    ).values(),
  ].slice(0, 5);
  return (
    <div className="management-page">
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {error && !modal && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section className="management-check content-panel">
        <div className="section-heading">
          <div>
            <h2>Wat verdient aandacht?</h2>
            <p>Een korte controle helpt om het dossier bruikbaar te houden.</p>
          </div>
          <button className="button secondary" onClick={onCapture}>
            <Plus size={16} />
            Iets vastleggen
          </button>
        </div>
        <div className="management-counts">
          <div>
            <strong>{attention.overdue.length}</strong>
            <span>meldingen met een verstreken datum</span>
          </div>
          <div>
            <strong>{attention.unassigned.length}</strong>
            <span>meldingen zonder actieve verantwoordelijke</span>
          </div>
          <button onClick={() => onFiles(`${houseId}:inbox`)}>
            <strong>{attention.inbox.length}</strong>
            <span>bestanden bij Nog te ordenen</span>
          </button>
        </div>
        {problems.length > 0 ? (
          <div className="management-attention">
            {problems.map((task) => (
              <div key={task.id}>
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {attention.overdue.some((t) => t.id === task.id)
                      ? `Gepland op ${residentDate(task.date)}`
                      : "Wie pakt dit op?"}
                  </small>
                </span>
                <button
                  className="button secondary"
                  onClick={() => onEditTask(task)}
                >
                  Bijwerken
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="form-note">
            Geen open meldingen met een verstreken datum of ontbrekende
            verantwoordelijke.
          </p>
        )}
      </section>
      <section className="content-panel" id="people">
        <div className="section-heading">
          <div>
            <h2>
              <Users size={20} aria-hidden="true" />
              Personen bij deze woning
            </h2>
            <p>
              Kies deze namen bij invoer, opvolging en uitgevoerd onderhoud.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setError("");
              setModal({ kind: "person" });
            }}
          >
            <Plus size={16} />
            Persoon toevoegen
          </button>
        </div>
        {people.length ? (
          <div className="people-list">
            {people.map((person) => (
              <article
                className={`person-row ${person.active ? "" : "archived"}`}
                key={person.id}
              >
                <div className="person-initial" aria-hidden="true">
                  {person.name.trim().slice(0, 1).toLocaleUpperCase("nl")}
                </div>
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.role === "resident"
                      ? "Bewoner"
                      : person.role === "helper"
                        ? "Helpt mee"
                        : "Vakpersoon"}
                    {!person.active ? " · gearchiveerd" : ""}
                  </p>
                  {(person.company || person.specialty) && (
                    <p>
                      {[person.company, person.specialty]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <ContactActions person={person} />
                  {person.notes && <ReadableText text={person.notes} />}
                  {(dossier.contactLinks ?? []).some(
                    (link) => link.personId === person.id,
                  ) && (
                    <p>
                      Gekoppeld aan:{" "}
                      {(dossier.contactLinks ?? [])
                        .filter((link) => link.personId === person.id)
                        .map(
                          (link) =>
                            dossier.assets.find(
                              (asset) => asset.id === link.assetId,
                            )?.name,
                        )
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    setError("");
                    setModal({ kind: "person", person });
                  }}
                  aria-label={`Bewerk persoon ${person.name}`}
                >
                  <Pencil size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="management-empty">
            <p>
              Voeg de mensen toe die het huisdossier bijhouden of onderhoud
              uitvoeren.
            </p>
          </div>
        )}
        <details className="form-note management-note">
          <summary>Over personen in dit dossier</summary>
          <p>
            Dit zijn personen in het lokale dossier. Een gekozen naam legt vast
            bij wie een melding of invoer hoort; het is geen persoonlijke
            aanmelding. Archiveren bewaart de bestaande historie.
          </p>
        </details>
      </section>
      <section className="content-panel" id="maintenance-plans">
        <div className="section-heading">
          <div>
            <h2>
              <CalendarDays size={20} aria-hidden="true" />
              Terugkerend onderhoud
            </h2>
            <p>
              Spreek één keer af wat terugkomt en wanneer de eerste beurt is.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setError("");
              setModal({ kind: "plan" });
            }}
          >
            <Plus size={16} />
            Afspraak toevoegen
          </button>
        </div>
        {!data ? (
          <p role="status">Onderhoudsafspraken laden…</p>
        ) : data.plans.length ? (
          <div className="maintenance-plans">
            {data.plans.map((plan) => (
              <article key={plan.id} className="maintenance-plan">
                <div>
                  <h3>{plan.title}</h3>
                  <p>
                    {
                      dossier.assets.find((asset) => asset.id === plan.assetId)
                        ?.name
                    }{" "}
                    · elke{" "}
                    {plan.intervalMonths === 1
                      ? "maand"
                      : `${plan.intervalMonths} maanden`}
                  </p>
                  <p>
                    {plan.active
                      ? "Volgende beurt"
                      : "Gepauzeerd, geplande datum"}
                    : {residentDate(plan.nextDate)}
                    {plan.assigneeId
                      ? ` · ${people.find((person) => person.id === plan.assigneeId)?.name ?? "Persoon onbekend"}`
                      : ""}
                  </p>
                </div>
                <div className="detail-actions">
                  <button
                    className="icon-button"
                    aria-label={`Bewerk afspraak ${plan.title}`}
                    onClick={() => {
                      setError("");
                      setModal({ kind: "plan", plan });
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        () =>
                          request(`${api}/maintenance-plans/${plan.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ active: !plan.active }),
                          }),
                        plan.active
                          ? "Afspraak gepauzeerd. Een bestaande melding blijft bewaard."
                          : "Afspraak hervat",
                      )
                    }
                  >
                    {plan.active ? <Pause size={15} /> : <Play size={15} />}
                    {plan.active ? "Pauzeren" : "Hervatten"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="management-empty">
            <p>
              Nog geen vaste onderhoudsafspraken. Voeg alleen een interval toe
              dat je zelf hebt afgesproken of uit een handleiding kent.
            </p>
          </div>
        )}
        <details className="management-explanation">
          <summary>Hoe werkt de opvolging?</summary>
          <p>
            Een afspraak zet één onderhoudsmelding klaar. Na afronden verschijnt
            de volgende beurt op de vaste kalender. Gemiste periodes worden
            overgeslagen; de eerstvolgende datum na de uitvoering blijft over.
            Er wordt geen werk als uitgevoerd beschouwd zonder jouw bevestiging.
          </p>
          <p>
            Je ziet de planning wanneer je deze app opent. Er worden geen
            e-mails of meldingen buiten de app verstuurd. Een verkeerde afspraak
            kun je pauzeren; de bestaande melding en historie blijven staan.
          </p>
        </details>
      </section>
      <div className="management-bottom">
        <section className="content-panel">
          <h2>Dossier blijven bijhouden</h2>
          <ol className="resident-checklist">
            <li>Bewaar nieuwe foto's en documenten bij de juiste plek.</li>
            <li>
              Bekijk regelmatig de open meldingen en spreek af wie ze oppakt.
            </li>
            <li>Rond werk af met het resultaat en de werkelijke datum.</li>
            <li>Orden de invoer bij Nog te ordenen en bewaar een kopie.</li>
          </ol>
          <DossierExport
            url={`${api}/export`}
            className="button secondary"
            label="Download dossierkopie"
          />
          <p className="form-note management-note">
            De kopie bevat gegevens, oorspronkelijke bestanden, personen en
            onderhoudsafspraken. Bewaar hem ook buiten deze computer.
            Terugzetten van zo'n kopie gebeurt voorlopig met technische hulp;
            automatisch herstel is nog niet beschikbaar.
          </p>
        </section>
        <section className="content-panel">
          <h2>
            <ClipboardList size={20} aria-hidden="true" />
            Recente wijzigingen
          </h2>
          {data?.activity.length ? (
            <ol className="activity-list">
              {data.activity.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <time dateTime={item.createdAt}>
                    {residentDate(item.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="form-note management-note">
              Nieuwe invoer en wijzigingen via het beheer verschijnen hier.
            </p>
          )}
        </section>
      </div>
      {modal && (
        <Dialog
          title={
            modal.kind === "person"
              ? modal.person
                ? "Persoon bewerken"
                : "Persoon toevoegen"
              : modal.plan
                ? "Onderhoudsafspraak bewerken"
                : "Onderhoudsafspraak toevoegen"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form
            className="resident-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (modal.kind === "person") {
                const person = modal.person;
                mutate(
                  () =>
                    request(`${api}/people${person ? `/${person.id}` : ""}`, {
                      method: person ? "PATCH" : "POST",
                      body: JSON.stringify({
                        name: String(form.get("name")).trim(),
                        role: form.get("role"),
                        email: String(form.get("email") ?? "").trim(),
                        phone: form.get("phone") ?? "",
                        ...contactFieldsData(form),
                        active: person ? form.get("active") === "on" : true,
                      }),
                    }),
                  person ? "Persoon bijgewerkt" : "Persoon toegevoegd",
                );
              } else
                mutate(
                  () =>
                    request(
                      `${api}/maintenance-plans${modal.plan ? `/${modal.plan.id}` : ""}`,
                      {
                        method: modal.plan ? "PATCH" : "POST",
                        body: JSON.stringify({
                          title: form.get("title"),
                          assetId: form.get("assetId"),
                          description: form.get("description") ?? "",
                          firstDate: form.get("firstDate"),
                          intervalMonths: Number(form.get("intervalMonths")),
                          assigneeId: form.get("assigneeId") || null,
                        }),
                      },
                    ),
                  modal.plan
                    ? "Afspraak en open onderhoudsmelding bijgewerkt"
                    : "Afspraak toegevoegd en eerste onderhoudsmelding klaargezet",
                );
            }}
          >
            {modal.kind === "person" ? (
              <>
                <label>
                  Naam
                  <input
                    name="name"
                    required
                    maxLength={200}
                    autoComplete="off"
                    defaultValue={modal.person?.name ?? ""}
                  />
                </label>
                <label>
                  Deze persoon is
                  <select
                    name="role"
                    defaultValue={modal.person?.role ?? "resident"}
                  >
                    <option value="resident">Bewoner</option>
                    <option value="helper">Helpt mee</option>
                    <option value="professional">Vakpersoon</option>
                  </select>
                </label>
                <label>
                  E-mailadres (optioneel)
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    defaultValue={modal.person?.email ?? ""}
                  />
                </label>
                <label>
                  Telefoonnummer (optioneel)
                  <input
                    name="phone"
                    type="tel"
                    maxLength={60}
                    defaultValue={modal.person?.phone ?? ""}
                  />
                </label>
                <ContactFields person={modal.person} />
                {modal.person && (
                  <label className="resident-check">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={modal.person.active}
                    />
                    Actief bij deze woning
                    <small>
                      Uitvinken archiveert de persoon. Controleer daarna open
                      meldingen die nog op deze naam staan.
                    </small>
                  </label>
                )}
              </>
            ) : (
              <>
                <p className="form-note">
                  Het interval is jullie afspraak. De app leidt geen
                  onderhoudstermijn af uit het model.
                </p>
                <label>
                  Wat komt terug?
                  <input
                    name="title"
                    required
                    maxLength={200}
                    placeholder="Bijvoorbeeld: ventilatiefilter controleren…"
                    defaultValue={modal.plan?.title ?? ""}
                  />
                </label>
                <label>
                  Bij welk onderdeel?
                  <select
                    name="assetId"
                    defaultValue={modal.plan?.assetId ?? `${houseId}:building`}
                  >
                    {dossier.assets
                      .filter((asset) => !asset.id.endsWith(":inbox"))
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {modal.plan
                    ? "Datum van de volgende beurt"
                    : "Datum van de eerste beurt"}
                  <input
                    name="firstDate"
                    type="date"
                    required
                    defaultValue={modal.plan?.nextDate ?? todayLocal()}
                  />
                </label>
                <label>
                  Herhalen om de hoeveel maanden?
                  <input
                    name="intervalMonths"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    required
                    defaultValue={modal.plan?.intervalMonths ?? 12}
                  />
                </label>
                <label>
                  Wie pakt het op?
                  <select
                    name="assigneeId"
                    defaultValue={modal.plan?.assigneeId ?? ""}
                  >
                    <option value="">Nog af te spreken</option>
                    {people
                      .filter(
                        (person) =>
                          person.active || person.id === modal.plan?.assigneeId,
                      )
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Werkwijze of bron (optioneel)
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={10000}
                    defaultValue={modal.plan?.description ?? ""}
                  />
                </label>
              </>
            )}
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Annuleren
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
