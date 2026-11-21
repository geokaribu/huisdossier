import {
  BookOpen,
  Camera,
  Check,
  ClipboardCheck,
  FileText,
  FolderHeart,
  MapPin,
  Wrench,
} from "lucide-react";
import { placeIcon } from "./dossierDisplay";
import type { Asset } from "./types";
import "./capture-help.css";

const tips = {
  file: {
    Icon: Camera,
    example: "De tuin in bloei",
    title: "Kies een foto of document",
    text: "Geef het een titel die je later herkent.",
    result: "Foto of document bij de gekozen plek.",
  },
  note: {
    Icon: FileText,
    example: "Idee voor een leeshoek",
    title: "Schrijf je idee op",
    text: "Een handige tip, een verfkleur of iets om te onthouden.",
    result: "Een doorzoekbare notitie bij de gekozen plek.",
  },
  task: {
    Icon: Wrench,
    example: "De kraan drupt",
    title: "Wat vraagt aandacht?",
    text: "Beschrijf kort wat je ziet. Een datum kan later.",
    result: "Een open klus die je kunt opvolgen.",
  },
  completed: {
    Icon: ClipboardCheck,
    example: "Kraanrubber vervangen",
    title: "Wat heb je gedaan?",
    text: "Bewaar het resultaat en de echte uitvoerdatum.",
    result: "Het werk komt in de historie van deze plek.",
  },
};

export function CaptureHelp({
  kind,
  asset,
}: {
  kind: keyof typeof tips;
  asset?: Asset;
}) {
  const tip = tips[kind];
  const Icon = tip.Icon;
  return (
    <section
      id="capture-help"
      className="capture-guide"
      aria-label="Hulp bij bewaren"
    >
      <header className="capture-guide-heading">
        <div>
          <h2>Hulp bij bewaren</h2>
          <p>Zo geef je het een vaste plek.</p>
        </div>
        <BookOpen size={28} aria-hidden="true" />
      </header>
      <ol className="capture-guide-steps">
        <li className="capture-guide-example">
          <div className="capture-guide-art" aria-hidden="true">
            <span className="capture-guide-postcard">
              <Icon size={40} />
              <span>{tip.example}</span>
            </span>
          </div>
          <div className="capture-guide-copy">
            <span className="capture-guide-step">1</span>
            <h3>{tip.title}</h3>
            <p>{tip.text}</p>
          </div>
        </li>
        <li className="capture-guide-place">
          <div className="capture-guide-art" aria-hidden="true">
            <span className="capture-guide-location">
              {asset ? placeIcon(asset, 48) : <MapPin size={48} />}
              <MapPin className="capture-guide-pin" size={25} />
            </span>
          </div>
          <div className="capture-guide-copy">
            <span className="capture-guide-step">2</span>
            <h3>Geef het een plek</h3>
            <p>
              {asset && !asset.id.endsWith(":inbox")
                ? `Nu gekozen: ${asset.name}.`
                : "Nog niet zeker? Kies ‘Nog te ordenen’ en beslis later."}
            </p>
          </div>
        </li>
        <li className="capture-guide-result">
          <div className="capture-guide-art" aria-hidden="true">
            <span className="capture-guide-folder">
              <FolderHeart size={64} />
              <Check size={24} />
            </span>
          </div>
          <div className="capture-guide-copy">
            <span className="capture-guide-step">3</span>
            <h3>Bewaar het in je huisboek</h3>
            <p>{tip.result}</p>
          </div>
        </li>
      </ol>
      <footer className="capture-guide-note">
        <BookOpen size={18} aria-hidden="true" />
        <p>
          {kind === "completed"
            ? "Kosten erbij? Vul in wat je echt betaalde. Leeg is onbekend; € 0 betekent gratis."
            : "Later verder? Je concepttekst blijft tijdens deze browsersessie bewaard. Een bijlage kies je na heropenen opnieuw."}
        </p>
      </footer>
    </section>
  );
}
