import { Building2, House, Layers3, Wrench } from "lucide-react";
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
  ) : (
    <Layers3 size={size} />
  );
