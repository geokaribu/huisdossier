import type { FurnishingView } from "./furnishings";

export function FurnishingChoice({
  value,
  onChange,
}: {
  value: FurnishingView;
  onChange: (value: FurnishingView) => void;
}) {
  return (
    <div className="furnishing-choice">
      <div
        className="segmented"
        role="group"
        aria-label="Inrichting van de woning"
      >
        <button
          aria-pressed={value === "furnished"}
          className={value === "furnished" ? "active" : ""}
          onClick={() => onChange("furnished")}
        >
          Ingericht
        </button>
        <button
          aria-pressed={value === "unfurnished"}
          className={value === "unfurnished" ? "active" : ""}
          onClick={() => onChange("unfurnished")}
        >
          Oningericht
        </button>
      </div>
      <p>
        Dezelfde woning, met of zonder losse inrichting. Vaste keuken en
        sanitair blijven staan.
      </p>
    </div>
  );
}
