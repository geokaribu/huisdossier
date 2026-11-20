import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { reminderTasks } from "./planning";
import { todayLocal } from "./residentWorkflows";
import type { Dossier } from "./types";

const eventName = "huisdossier-reminders";
const key = (house: string) => `huisdossier:reminders:${house}`;
type Settings = {
  enabled: boolean;
  days: number;
  person: string;
  error?: string;
};
function read(house: string): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(key(house)) ?? "null");
    if (
      value &&
      typeof value.enabled === "boolean" &&
      [0, 1, 7, 30].includes(value.days) &&
      typeof value.person === "string"
    )
      return value;
  } catch {
    /* Browser storage can be disabled. */
  }
  return { enabled: false, days: 7, person: "" };
}
function write(house: string, settings: Settings) {
  localStorage.setItem(key(house), JSON.stringify(settings));
  window.dispatchEvent(new Event(eventName));
}
const sentInSession = new Set<string>();
export function MaintenanceReminders({
  houseId,
  dossier,
  onOpen,
}: {
  houseId: string;
  dossier: Dossier;
  onOpen: () => void;
}) {
  useEffect(() => {
    let active = true;
    const send = () => {
      if (!active) return;
      const settings = read(houseId),
        today = todayLocal();
      if (
        !settings.enabled ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      )
        return;
      const tasks = reminderTasks(
        dossier.tasks,
        today,
        settings.days,
        settings.person,
      );
      if (!tasks.length) return;
      const sent = `${key(houseId)}:sent:${today}`;
      try {
        if (sentInSession.has(sent) || localStorage.getItem(sent)) return;
        const notice = new Notification("Huisdossier · onderhoud", {
          body: `${tasks.length} ${tasks.length === 1 ? "melding vraagt" : "meldingen vragen"} aandacht. Open je planning om ze te bekijken.`,
          tag: `huisdossier-${houseId}`,
        });
        notice.onclick = () => {
          window.focus();
          onOpen();
          notice.close();
        };
        sentInSession.add(sent);
        localStorage.setItem(sent, "1");
      } catch {
        try {
          write(houseId, {
            ...settings,
            enabled: false,
            error:
              "Deze browser kan geen bureaubladmelding tonen. Gebruik het planningsoverzicht of je agenda.",
          });
        } catch {
          /* The in-app planning remains available. */
        }
      }
    };
    const check = () => {
      if (navigator.locks) {
        void navigator.locks.request(`${key(houseId)}:lock`, send).catch(() => {
          /* A future focus or timer retries. */
        });
      } else send();
    };
    check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener(eventName, check);
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(timer);
      active = false;
      window.removeEventListener(eventName, check);
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, [houseId, dossier, onOpen]);
  return null;
}
export function ReminderSettings({
  houseId,
  dossier,
}: {
  houseId: string;
  dossier: Dossier;
}) {
  const [settings, setSettings] = useState(() => read(houseId)),
    [error, setError] = useState("");
  useEffect(() => {
    const reload = () => setSettings(read(houseId));
    window.addEventListener(eventName, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(eventName, reload);
      window.removeEventListener("storage", reload);
    };
  }, [houseId]);
  const save = (value: Settings) => {
    try {
      write(houseId, value);
      setError("");
    } catch {
      setError(
        "De voorkeur kon niet worden bewaard. Sta lokale browseropslag toe.",
      );
    }
  };
  return (
    <section className="content-panel reminder-settings">
      <div className="section-heading">
        <div>
          <h2>
            <Bell size={19} aria-hidden="true" /> Herinneringen op deze computer
          </h2>
          <p>
            Het overzicht werkt altijd. Bureaubladmeldingen verschijnen alleen
            zolang Huisdossier open staat in deze browser, maximaal één per dag
            per woning.
          </p>
        </div>
      </div>
      <div className="planning-options">
        <label>
          Herinner mij
          <select
            value={settings.days}
            onChange={(e) =>
              save({ ...settings, days: Number(e.target.value) })
            }
          >
            <option value={0}>Vanaf de onderhoudsdatum</option>
            <option value={1}>1 dag vooraf</option>
            <option value={7}>7 dagen vooraf</option>
            <option value={30}>30 dagen vooraf</option>
          </select>
        </label>
        <label>
          Voor wie?
          <select
            value={settings.person}
            onChange={(e) => save({ ...settings, person: e.target.value })}
          >
            <option value="">Iedereen</option>
            <option value="unassigned">Zonder verantwoordelijke</option>
            {dossier.people?.map((person) => (
              <option value={person.id} key={person.id}>
                {person.name}
                {person.active ? "" : " (gearchiveerd)"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="button secondary"
        onClick={async () => {
          if (settings.enabled) {
            save({ ...settings, enabled: false, error: undefined });
            return;
          }
          if (!("Notification" in window)) {
            setError(
              "Deze browser ondersteunt geen bureaubladmeldingen. Gebruik je agenda voor herinneringen.",
            );
            return;
          }
          try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
              setError(
                "Meldingen zijn niet toegestaan. Je kunt dit wijzigen in de instellingen van je browser.",
              );
              return;
            }
            save({ ...settings, enabled: true, error: undefined });
          } catch {
            setError(
              "Meldingen zijn hier niet beschikbaar. Gebruik het overzicht of je agenda.",
            );
          }
        }}
      >
        {settings.enabled
          ? "Bureaubladmeldingen uitschakelen"
          : "Bureaubladmeldingen inschakelen"}
      </button>
      <p className="form-note">
        Voor herinneringen als de app gesloten is: voeg de planning toe aan je
        eigen agenda. Deze lokale app verstuurt geen e-mails of pushberichten.
      </p>
      {(error || settings.error) && (
        <p className="alert error" role="alert">
          {error || settings.error}
        </p>
      )}
    </section>
  );
}
