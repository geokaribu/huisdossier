import { getPosition } from "suncalc";
import type { LightingEnvironment, LightingSettings } from "./types.ts";

const calendar = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function wallClock(date: Date) {
  const parts = Object.fromEntries(
    calendar.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
/** A Dutch civil time, independent of the browser/OS zone. Reject skipped DST times. */
export function dutchInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return null;
  const desired = `${date}T${time}:00`,
    utc = Date.parse(desired + "Z");
  if (!Number.isFinite(utc)) return null;
  let value = utc;
  for (let i = 0; i < 4; i++) {
    const correction = utc - Date.parse(wallClock(new Date(value)) + "Z");
    value += correction;
    if (correction === 0) break;
  }
  const result = new Date(value);
  return wallClock(result) === desired ? result : null;
}
export function defaultLightingSettings(): LightingSettings {
  return {
    enabled: false,
    date: wallClock(new Date()).slice(0, 10),
    time: "12:00",
    neighbors: true,
    streetLights: true,
    indoorLights: false,
    selectedLampId: "",
    exposure: 1,
  };
}
export function solarPosition(
  profile: LightingEnvironment,
  settings: LightingSettings,
) {
  const instant = dutchInstant(settings.date, settings.time);
  return instant
    ? getPosition(instant, profile.latitude, profile.longitude)
    : null;
}
/** SunCalc 2: degrees, clockwise from NORTH. Three world: X east, Y up, -Z north. */
export function sunDirection(
  azimuth: number,
  altitude: number,
): [number, number, number] {
  const az = (azimuth * Math.PI) / 180,
    alt = (altitude * Math.PI) / 180;
  return [
    Math.sin(az) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(az) * Math.cos(alt),
  ];
}
export const coneAngle = (80 * Math.PI) / 180;
export function lampIntensity(
  lumens: number,
  distribution: "point" | "downward",
) {
  return (
    lumens /
    (distribution === "point"
      ? 4 * Math.PI
      : 2 * Math.PI * (1 - Math.cos(coneAngle)))
  );
}
export function activeLampIds(
  profile: LightingEnvironment,
  selected: string,
  rd: [number, number],
) {
  const sorted = [...profile.lamps].sort(
    (a, b) =>
      Math.hypot(a.rd[0] - rd[0], a.rd[1] - rd[1]) -
      Math.hypot(b.rd[0] - rd[0], b.rd[1] - rd[1]),
  );
  const chosen = sorted.find((l) => l.id === selected);
  return [...(chosen ? [chosen] : []), ...sorted.filter((l) => l !== chosen)]
    .slice(0, 3)
    .map((l) => l.id);
}
