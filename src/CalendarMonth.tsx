import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDays, moveCalendarMonth } from "./calendar";
import type { Task } from "./types";

export function CalendarMonth({
  month,
  today,
  selected,
  tasks,
  onMonth,
  onDay,
}: {
  month: string;
  today: string;
  selected: string | null;
  tasks: Task[];
  onMonth: (month: string) => void;
  onDay: (date: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const task of tasks)
    if (task.date) counts.set(task.date, (counts.get(task.date) ?? 0) + 1);
  const monthName = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(
    "nl-NL",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return (
    <section className="house-calendar" aria-label="Onderhoudskalender">
      <div className="calendar-month-heading">
        <h2 aria-live="polite">{monthName}</h2>
        <div>
          <button
            aria-label="Vorige maand"
            onClick={() => onMonth(moveCalendarMonth(month, -1))}
          >
            <ChevronLeft size={23} />
          </button>
          <button onClick={() => onDay(today)}>Vandaag</button>
          <button
            aria-label="Volgende maand"
            onClick={() => onMonth(moveCalendarMonth(month, 1))}
          >
            <ChevronRight size={23} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["ma", "di", "wo", "do", "vr", "za", "zo"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days" role="group" aria-label="Kies een dag">
        {calendarDays(month).map((date) => {
          const count = counts.get(date) ?? 0;
          return (
            <button
              key={date}
              data-date={date}
              data-outside={!date.startsWith(month)}
              data-has-tasks={count > 0}
              aria-pressed={selected === date}
              aria-current={date === today ? "date" : undefined}
              aria-label={`${new Date(`${date}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, ${count} ${count === 1 ? "klus" : "klussen"}`}
              onClick={() => onDay(date)}
            >
              <strong>{Number(date.slice(8))}</strong>
              <span className="calendar-task-dots" aria-hidden="true">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                  <i key={i} />
                ))}
                {count > 3 && <small>+{count - 3}</small>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="calendar-key">
        <i /> Er staat een klus gepland. Tik op een dag.
      </p>
    </section>
  );
}
