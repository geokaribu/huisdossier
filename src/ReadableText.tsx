import { InlineText } from "./InlineText";
import { readableUnits } from "./information";

export function ReadableText({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="readable-text">
      {text
        .split(/\r?\n\s*\r?\n/)
        .filter(Boolean)
        .map((block, i) => {
          const units = readableUnits(block);
          return block.length > 240 && units.length > 1 ? (
            <ul key={i} className="readable-points">
              {units.map((unit, j) => (
                <li key={j}>
                  <InlineText text={unit} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              <InlineText text={block} />
            </p>
          );
        })}
    </div>
  );
}
