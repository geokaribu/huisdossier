import { shiftDay } from "./planning.ts";

export function moveCalendarMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

/** Monday-first whole weeks, using date-only UTC arithmetic across DST. */
export function calendarDays(month: string) {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const next = `${moveCalendarMonth(month, 1)}-01`;
  const days = Math.round(
    (Date.parse(`${next}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) /
      86400000,
  );
  return Array.from({ length: Math.ceil((weekday + days) / 7) * 7 }, (_, i) =>
    shiftDay(first, i - weekday),
  );
}
