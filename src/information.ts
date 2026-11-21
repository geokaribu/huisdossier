import type { HouseInformationItem } from "./types";

export const informationTopics = {
  dimensions: "Maten",
  layout: "Indeling",
  finishes: "Afwerking",
  furnishing: "Inrichting",
  sources: "Herkomst",
  accuracy: "Wat is benaderd?",
};
export const informationStatuses = {
  source: "Volgens bron",
  resident: "Volgens bewoner",
  approximate: "Benadering",
  unknown: "Niet vastgesteld",
};

export function informationForRoom(
  items: HouseInformationItem[],
  roomId?: string,
) {
  return roomId
    ? [
        ...items.filter((item) => item.roomIds?.includes(roomId)),
        ...items.filter((item) => !item.roomIds?.length),
      ]
    : items;
}

/** Presentation only: retain every sentence, decimal and date, without inferring facts. */
export function readableUnits(text: string) {
  const segmenter = new Intl.Segmenter("nl", { granularity: "sentence" });
  return [...segmenter.segment(text)]
    .map((segment) => segment.segment.trim())
    .filter(Boolean);
}
