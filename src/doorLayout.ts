import type { HingedDoor } from "./types";

/** Shared hinge, leaf width and rotation for mesh, map and walking collision. */
export function hingedDoorLayout(
  width: number,
  config: HingedDoor,
  open: boolean,
) {
  const direction = config.hinge === "start" ? 1 : -1;
  const hinge = config.hinge === "start" ? 0.025 : width - 0.025;
  const leaf = width - 0.05;
  const angle = open
    ? (-direction *
        (config.swing === "positive" ? 1 : -1) *
        config.openAngle *
        Math.PI) /
      180
    : 0;
  return {
    hinge,
    leaf,
    direction,
    angle,
    end: [
      hinge + direction * leaf * Math.cos(angle),
      -direction * leaf * Math.sin(angle),
    ] as [number, number],
  };
}
