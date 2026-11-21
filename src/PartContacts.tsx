import { useState } from "react";
import { ReadableText } from "./ReadableText";
import { Plus, Pencil, Users } from "lucide-react";
import { Dialog } from "./Dialog";
import {
  ContactActions,
  ContactFields,
  contactFieldsData,
} from "./ContactDetails";
import { request } from "./api";
import type { Asset, Dossier } from "./types";

export function PartContacts({
  houseId,
  asset,
  dossier,
  onRefresh,
  onManage,
}: {
  houseId: string;
  asset: Asset;
  dossier: Dossier;
  onRefresh: () => Promise<void>;
  onManage: () => void;
}) {
  const links = (dossier.contactLinks ?? []).filter(
    (link) => link.assetId === asset.id,
  );
  const people = dossier.people ?? [];
  const [editing, setEditing] = useState<(typeof links)[number] | "new" | null>(
    null,
  );
  const [personId, setPersonId] = useState("new");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState("");
  const api = `/api/houses/${houseId}/assets/${encodeURIComponent(asset.id)}/contacts`;
  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onRefresh();
      setEditing(null);
      setConfirm("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="part-contacts"
      aria-label={`Contacten voor ${asset.name}`}
    >
      <div className="dossier-column-heading">
        <h3>
          <Users size={16} aria-hidden="true" /> Contacten
        </h3>
        <button
          className="text-link"
          onClick={() => {
            setError("");
            setEditing("new");
            setPersonId(people.some((p) => p.active) ? "" : "new");
          }}
        >
          <Plus size={15} />
          Contact koppelen
        </button>
      </div>
      {links.length ? (
        links.map((link) => {
          const person = people.find((p) => p.id === link.personId);
          if (!person) return null;
          return (
            <article className="part-contact" key={person.id}>
              <div className="contact-heading">
                <div>
                  <strong>{person.name}</strong>
                  <p>
                    {[
                      link.label,
                      person.company,
                      person.specialty,
                      person.active ? "" : "Gearchiveerd",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Bewerk koppeling met ${person.name}`}
                  onClick={() => {
                    setError("");
                    setEditing(link);
                    setPersonId(person.id);
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
              <ContactActions person={person} />
              {(link.notes || person.notes) && (
                <details>
                  <summary>Contactnotities</summary>
                  {link.notes && <ReadableText text={link.notes} />}
                  {person.notes && <ReadableText text={person.notes} />}
                </details>
              )}
              {confirm === person.id ? (
                <div className="contact-actions">
                  <span>Deze koppeling verwijderen?</span>
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      mutate(() =>
                        request(`${api}/${encodeURIComponent(person.id)}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    Ja, loskoppelen
                  </button>
                  <button className="text-link" onClick={() => setConfirm("")}>
                    Annuleren
                  </button>
                </div>
              ) : (
                <button
                  className="text-link contact-unlink"
                  onClick={() => setConfirm(person.id)}
                >
                  Loskoppelen
                </button>
              )}
            </article>
          );
        })
      ) : (
        <p className="form-note">
          Bewaar hier wie je kunt bellen voor dit onderdeel, zoals een dakwerker
          of installateur.
        </p>
      )}
      {error && !editing && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {links.length > 0 && (
        <button className="text-link" onClick={onManage}>
          Contactgegevens beheren →
        </button>
      )}
      {editing && (
        <Dialog
          title={`Contact voor ${asset.name}`}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="resident-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const data = {
                label: String(form.get("label") ?? ""),
                notes: String(form.get("linkNotes") ?? ""),
                ...(personId === "new"
                  ? {
                      person: {
                        name: String(form.get("name")).trim(),
                        role: "professional",
                        phone: String(form.get("phone") ?? ""),
                        email: String(form.get("email") ?? ""),
                        ...contactFieldsData(form),
                      },
                    }
                  : { personId }),
              };
              mutate(() =>
                request(api, { method: "POST", body: JSON.stringify(data) }),
              );
            }}
          >
            <label>
              Wie helpt hierbij?
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                required
                disabled={editing !== "new"}
              >
                <option value="" disabled>
                  Kies een contact
                </option>
                {people
                  .filter((p) => p.active || p.id === personId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.active ? "" : " (gearchiveerd)"}
                    </option>
                  ))}
                <option value="new">Nieuw contact toevoegen…</option>
              </select>
            </label>
            {personId === "new" && (
              <>
                <label>
                  Naam
                  <input name="name" required maxLength={200} />
                </label>
                <label>
                  Telefoonnummer (optioneel)
                  <input name="phone" type="tel" maxLength={60} />
                </label>
                <label>
                  E-mailadres (optioneel)
                  <input name="email" type="email" maxLength={254} />
                </label>
                <ContactFields />
              </>
            )}
            <label>
              Rol bij dit onderdeel (optioneel)
              <input
                name="label"
                maxLength={200}
                defaultValue={editing === "new" ? "" : editing.label}
                placeholder="Bijvoorbeeld: onderhoud dakgoten…"
              />
            </label>
            <label>
              Afspraken over dit onderdeel (optioneel)
              <textarea
                name="linkNotes"
                rows={3}
                maxLength={5000}
                defaultValue={editing === "new" ? "" : editing.notes}
                placeholder="Bijvoorbeeld: laatst gebeld op…, offerte volgt…"
              />
            </label>
            <p className="form-note">
              Contactgegevens kun je later bij Beheer aanpassen. Er wordt geen
              bericht verstuurd.
            </p>
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
                onClick={() => setEditing(null)}
              >
                Annuleren
              </button>
              <button className="button primary" disabled={busy || !personId}>
                {busy ? "Opslaan…" : "Contact bewaren"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
