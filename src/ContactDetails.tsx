import { Phone, Mail, ExternalLink } from "lucide-react";
import type { Person } from "./types";

export function ContactFields({ person }: { person?: Person }) {
  return (
    <>
      <label>
        Bedrijf (optioneel)
        <input
          name="company"
          maxLength={200}
          defaultValue={person?.company ?? ""}
        />
      </label>
      <label>
        Vakgebied (optioneel)
        <input
          name="specialty"
          maxLength={200}
          placeholder="Bijvoorbeeld: dakwerken, elektriciteit…"
          defaultValue={person?.specialty ?? ""}
        />
      </label>
      <label>
        Website (optioneel)
        <input
          type="url"
          name="website"
          placeholder="https://…"
          maxLength={2000}
          defaultValue={person?.website ?? ""}
        />
      </label>
      <label>
        Contactnotities (optioneel)
        <textarea
          name="notes"
          rows={3}
          maxLength={5000}
          placeholder="Bijvoorbeeld: klantnummer, bereikbaarheid of eerdere ervaringen…"
          defaultValue={person?.notes ?? ""}
        />
      </label>
    </>
  );
}
export function ContactActions({ person }: { person: Person }) {
  return (
    <div className="contact-actions">
      {person.phone && (
        <a href={`tel:${person.phone.replace(/[^+\d]/g, "")}`}>
          <Phone size={14} aria-hidden="true" />
          {person.phone}
        </a>
      )}
      {person.email && (
        <a href={`mailto:${encodeURIComponent(person.email)}`}>
          <Mail size={14} aria-hidden="true" />
          {person.email}
        </a>
      )}
      {person.website && /^https?:\/\//i.test(person.website) && (
        <a href={person.website} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" />
          Website
        </a>
      )}
    </div>
  );
}
export const contactFieldsData = (form: FormData) =>
  Object.fromEntries(
    ["company", "specialty", "website", "notes"].map((key) => [
      key,
      String(form.get(key) ?? "").trim(),
    ]),
  );
