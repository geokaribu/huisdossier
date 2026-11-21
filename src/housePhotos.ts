import type { Attachment } from "./types";

/** A scanned bill can also be an image. The home display is an explicit choice. */
export function latestHousePhoto(files: Attachment[], assetId?: string) {
  return files
    .filter(
      (file) =>
        file.category === "photos" &&
        /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) &&
        (!assetId || file.assetId === assetId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
