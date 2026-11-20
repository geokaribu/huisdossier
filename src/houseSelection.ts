export const housePages = [
  "dossier",
  "model",
  "interior",
  "files",
  "tasks",
  "sources",
  "capture",
  "manage",
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
export function readWorkspaceSelection(url: string, assets: { id: string }[]) {
  const params = new URL(url).searchParams;
  const known = (key: string) =>
    assets.find((asset) => asset.id === params.get(key))?.id ?? "";
  const status = params.get("status") ?? "open";
  return {
    part: known("part"),
    scope: known("scope"),
    category: params.get("category") ?? "",
    query: params.get("q") ?? "",
    status: ["open", "done", "all", "hold", "verify"].includes(status)
      ? status
      : "open",
  };
}
export function workspaceSelectionUrl(
  url: string,
  houseId: string,
  page: HousePage,
  selection: ReturnType<typeof readWorkspaceSelection>,
) {
  const next = new URL(housePageUrl(url, houseId, page), url);
  for (const [key, value] of Object.entries({
    part: selection.part,
    scope: page === "files" || page === "tasks" ? selection.scope : "",
    category: page === "files" ? selection.category : "",
    q: page === "files" || page === "tasks" ? selection.query : "",
    status:
      page === "tasks" && selection.status !== "open" ? selection.status : "",
  })) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  return next.pathname + next.search + next.hash;
}
