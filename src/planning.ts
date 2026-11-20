import type { Task } from "./types";

export function shiftDay(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function assignedTo(task: Task, person: string) {
  return (
    !person ||
    (person === "unassigned" ? !task.assigneeId : task.assigneeId === person)
  );
}
export function planningGroups(
  tasks: Task[],
  today: string,
  days = 30,
  person = "",
) {
  const horizon = shiftDay(today, days);
  const groups: Record<"overdue" | "soon" | "later" | "unscheduled", Task[]> = {
    overdue: [],
    soon: [],
    later: [],
    unscheduled: [],
  };
  for (const task of tasks.filter(
    (task) => task.status === "open" && assignedTo(task, person),
  )) {
    const key = !task.date
      ? "unscheduled"
      : task.date < today
        ? "overdue"
        : task.date <= horizon
          ? "soon"
          : "later";
    groups[key].push(task);
  }
  for (const tasks of Object.values(groups))
    tasks.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "nl"),
    );
  return groups;
}
export function reminderTasks(
  tasks: Task[],
  today: string,
  days: number,
  person = "",
) {
  return tasks.filter(
    (task) =>
      task.status === "open" &&
      task.date &&
      task.date <= shiftDay(today, days) &&
      (!task.remindOn || task.remindOn <= today) &&
      assignedTo(task, person),
  );
}
export function recordedCosts(tasks: Task[], year: string) {
  const completed = tasks.filter(
    (task) => task.status === "done" && task.completedAt?.startsWith(year),
  );
  const known = completed.filter((task) => task.costCents != null);
  return {
    cents: known.reduce((sum, task) => sum + (task.costCents ?? 0), 0),
    known: known.length,
    total: completed.length,
  };
}
export const formatCost = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export function parseCost(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+([,.]\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Vul kosten in als bedrag, bijvoorbeeld 125,50, zonder duizendtallen.",
    );
  const cents = Math.round(Number(value.trim().replace(",", ".")) * 100);
  if (cents > 100000000) throw new Error("Vul een bedrag tot € 1.000.000 in.");
  return cents;
}
