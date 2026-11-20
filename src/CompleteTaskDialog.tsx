import { useState } from "react";
import { Dialog } from "./Dialog";
import { todayLocal } from "./residentWorkflows";
import { parseCost } from "./planning";
import type { Person, Task } from "./types";
export function CompleteTaskDialog({
  task,
  people,
  onClose,
  onComplete,
}: {
  task: Task;
  people: Person[];
  onClose: () => void;
  onComplete: (data: {
    status: "done";
    result: string;
    completedOn: string;
    completedById: string | null;
    costCents: number | null;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      title="Onderhoud afronden"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="resident-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await onComplete({
              status: "done",
              result: String(form.get("result")),
              completedOn: String(form.get("completedOn")),
              completedById: String(form.get("completedById") || "") || null,
              costCents: parseCost(String(form.get("cost") ?? "")),
            });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          <strong>{task.title}</strong>
        </p>
        <label>
          Wat is er gedaan?
          <textarea
            name="result"
            rows={4}
            maxLength={10000}
            required
            placeholder="Bijvoorbeeld: filter vervangen en werking gecontroleerd…"
            defaultValue={task.result ?? ""}
          />
        </label>
        <label>
          Werkelijke uitvoerdatum
          <input
            type="date"
            name="completedOn"
            defaultValue={todayLocal()}
            max={todayLocal()}
            required
          />
        </label>
        <label>
          Uitgevoerd door (optioneel)
          <select name="completedById" defaultValue={task.assigneeId ?? ""}>
            <option value="">Niet vastgelegd</option>
            {people
              .filter((person) => person.active)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Werkelijk betaalde kosten in euro (optioneel)
          <input
            name="cost"
            inputMode="decimal"
            maxLength={12}
            defaultValue={
              task.costCents != null
                ? (task.costCents / 100).toFixed(2).replace(".", ",")
                : ""
            }
            placeholder="Bijvoorbeeld: 125,50"
          />
          <small>
            Leeg = onbekend. Vul 0 in als er geen kosten waren. Bewaar de
            factuur bij deze melding.
          </small>
        </label>
        {task.planId && (
          <p className="form-note">
            Na afronden wordt de volgende beurt volgens de onderhoudsafspraak
            klaargezet. Een gepauzeerde afspraak maakt geen nieuwe melding.
          </p>
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
            onClick={onClose}
          >
            Annuleren
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Opslaan…" : "Als uitgevoerd bewaren"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
