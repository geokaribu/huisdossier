import {
  Building2,
  House,
  Layers3,
  Wrench,
  PanelsTopLeft,
  Inbox,
  Warehouse,
  Sofa,
  CookingPot,
  BedDouble,
  Bath,
  Flower2,
  Toilet,
  DoorOpen,
  Armchair,
} from "lucide-react";
import type { Asset } from "./types";

/** A pictogram for the resident's label, never a claim about furnishings. */
export function placeIcon(asset: Pick<Asset, "name" | "kind">, size = 24) {
  if (asset.kind !== "ruimte") return assetIcon(asset.kind, size);
  const name = asset.name.toLocaleLowerCase("nl");
  const Icon = /woon|zitkamer|salon/.test(name)
    ? Sofa
    : /keuken/.test(name)
      ? CookingPot
      : /slaap|logeer/.test(name)
        ? BedDouble
        : /badkamer|douche/.test(name)
          ? Bath
          : /toilet|\bwc\b/.test(name)
            ? Toilet
            : /tuin|terras|balkon/.test(name)
              ? Flower2
              : /hal|entree|gang/.test(name)
                ? DoorOpen
                : Armchair;
  return <Icon size={size} />;
}
export const kindName: Record<string, string> = {
  gebouw: "Gebouw",
  dak: "Dak",
  gevel: "Gevel",
  ruimte: "Ruimte",
  installatie: "Installatie",
  overig: "Onderdeel",
};
export const assetIcon = (kind: string, size = 18) =>
  kind === "gebouw" ? (
    <Building2 size={size} />
  ) : kind === "installatie" ? (
    <Wrench size={size} />
  ) : kind === "ruimte" ? (
    <House size={size} />
  ) : kind === "dak" ? (
    <Warehouse size={size} />
  ) : kind === "gevel" ? (
    <PanelsTopLeft size={size} />
  ) : kind === "overig" ? (
    <Inbox size={size} />
  ) : (
    <Layers3 size={size} />
  );
