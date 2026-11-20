export const housePages = [
  "dossier",
  "model",
  "interior",
  "files",
  "tasks",
  "sources",
] as const;
export type HousePage = (typeof housePages)[number];
export function resolveHouseId(
  houses: { id: string }[],
  url: string,
  stored: string | null,
) {
  const requested = new URL(url).searchParams.get("house") ?? stored;
  return (
    houses.find((house) => house.id === requested)?.id ?? houses[0]?.id ?? ""
  );
}
export function resolveHousePage(url: string): HousePage {
  const page = new URL(url).searchParams.get("page");
  return housePages.includes(page as HousePage)
    ? (page as HousePage)
    : "dossier";
}
export function housePageUrl(url: string, houseId: string, page: HousePage) {
  const next = new URL(url);
  next.searchParams.set("house", houseId);
  next.searchParams.set("page", page);
  return next.pathname + next.search + next.hash;
}
