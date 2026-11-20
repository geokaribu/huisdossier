import type { Dossier } from "./types";
export const todayLocal = () =>
  new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const residentDate = (date: string) =>
  new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(
    new Date(date.length === 10 ? `${date}T12:00:00` : date),
  );
export function dossierAttention(dossier: Dossier, today = todayLocal()) {
  const people = dossier.people ?? [],
    open = dossier.tasks.filter((task) => task.status === "open");
  return {
    overdue: open.filter((task) => Boolean(task.date) && task.date < today),
    unassigned: open.filter((task) =>
      task.assigneeId
        ? !people.some((p) => p.id === task.assigneeId && p.active)
        : !task.owner,
    ),
    inbox: dossier.attachments.filter((file) =>
      file.assetId.endsWith(":inbox"),
    ),
  };
}
