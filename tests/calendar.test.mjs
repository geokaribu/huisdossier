import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDays, moveCalendarMonth } from "../src/calendar.ts";

test("calendar weeks retain leap day, a Monday start and adjacent month dates", () => {
  const days = calendarDays("2028-02");
  assert.equal(days[0], "2028-01-31");
  assert.ok(days.includes("2028-02-29"));
  assert.equal(days.at(-1), "2028-03-05");
  assert.equal(new Set(days).size, days.length);
});
test("calendar month navigation and complete weeks survive year and DST boundaries", () => {
  assert.equal(moveCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(moveCalendarMonth("2027-01", -1), "2026-12");
  for (const month of ["2026-03", "2026-10", "2026-11"]) {
    const days = calendarDays(month);
    assert.equal(new Date(days[0] + "T12:00:00Z").getUTCDay(), 1);
    assert.equal(new Date(days.at(-1) + "T12:00:00Z").getUTCDay(), 0);
    assert.ok(days.includes(month + "-01"));
    for (let i = 1; i < days.length; i++)
      assert.equal(Date.parse(days[i]) - Date.parse(days[i - 1]), 86400000);
  }
});
