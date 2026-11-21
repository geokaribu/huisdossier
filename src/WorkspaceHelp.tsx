import { useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Box,
  CalendarDays,
  Download,
  FolderHeart,
  Info,
  MessageCircle,
  Plus,
  UsersRound,
} from "lucide-react";
import { Dialog } from "./Dialog";
import type { HousePage } from "./houseSelection";
import "./workspace-help.css";

const topics = [
  {
    id: "explore",
    label: "Je huis ontdekken",
    Icon: Box,
    title: "Begin bij een plek in huis.",
    steps: [
      {
        title: "Kies je woning",
        text: "De adressen bovenaan wisselen tussen je huisboeken. Elke woning heeft haar eigen informatie.",
      },
      {
        title: "Kijk rond",
        text: "Open Mijn huis en tik op een plek. Buiten en Binnen laten je het huis in 3D verkennen. Een binnenmodel is alleen beschikbaar als het voor deze woning is toegevoegd.",
      },
      {
        title: "Open het verhaal van die plek",
        text: "In een ruimtedossier vind je Overzicht, Foto’s & documenten, Klussen & historie en Info & contacten. Bronnen & model legt uit waar de gegevens vandaan komen en wat nog een benadering is.",
      },
    ],
    page: "dossier",
    action: "Naar mijn huis",
  },
  {
    id: "save",
    label: "Iets bewaren",
    Icon: Plus,
    title: "Geef wat je wilt onthouden een plek.",
    steps: [
      {
        title: "Kies wat je toevoegt",
        text: "Foto of document, idee of notitie, een klus of werk dat al gedaan is: je vindt ze bij Iets toevoegen.",
      },
      {
        title: "Koppel het aan een plek",
        text: "Kies bijvoorbeeld een kamer of installatie. Weet je het nog niet? Gebruik Nog te ordenen. Je kunt het later verplaatsen.",
      },
      {
        title: "Bewaar het in je huisboek",
        text: "Na opslaan kun je meteen naar de gekozen plek. Wil je een eigen foto op de startpagina? Vink bij een foto Ook in mijn fotohoekje tonen aan.",
      },
    ],
    page: "capture",
    action: "Iets toevoegen",
  },
  {
    id: "find",
    label: "Iets terugvinden",
    Icon: FolderHeart,
    title: "Die ene foto, maat of handleiding.",
    steps: [
      {
        title: "Begin bij de plek of verzameling",
        text: "Open een kamer voor alles wat daarbij hoort. Verzameling toont de foto’s, notities en documenten van het hele huis.",
      },
      {
        title: "Maak je selectie kleiner",
        text: "Kies een plek, categorie of zoekwoord. Wissel tussen galerij en lijst als dat prettiger kijkt.",
      },
      {
        title: "Bekijk het origineel",
        text: "Tik op een foto om die groter te zien, of open een document om het te lezen en downloaden. Foto’s en scans zijn niet automatisch doorzoekbare tekst.",
      },
    ],
    page: "files",
    action: "Naar de verzameling",
  },
  {
    id: "plan",
    label: "Klussen & agenda",
    Icon: CalendarDays,
    title: "Wat aandacht vraagt, op jouw moment.",
    steps: [
      {
        title: "Leg de klus vast",
        text: "Voeg een klus toe bij de juiste plek. Een datum en verantwoordelijke zijn optioneel: een idee voor later mag er ook gewoon bij.",
      },
      {
        title: "Bekijk je planning",
        text: "Klussen toont wat openstaat en wat al gedaan is. Planning zet gedateerde klussen in de huisagenda. Je kunt een herinnering uitstellen.",
      },
      {
        title: "Bewaar wat er gedaan is",
        text: "Rond de klus af met het resultaat en de werkelijke datum. Vul betaalde kosten in als je ze weet. Leeg betekent onbekend; € 0 betekent gratis.",
      },
    ],
    page: "planning",
    action: "Naar de huisagenda",
  },
  {
    id: "people",
    label: "Mensen rond je huis",
    Icon: UsersRound,
    title: "Weet wie je waarvoor kunt vragen.",
    steps: [
      {
        title: "Bewaar een contact",
        text: "Bij Mensen & afspraken voeg je bewoners, helpers of vakmensen toe met de gegevens die je wilt onthouden.",
      },
      {
        title: "Koppel mensen aan een plek of klus",
        text: "Zo vind je de juiste persoon terug bij een installatie of kamer en kun je een klus aan iemand toewijzen.",
      },
      {
        title: "Maak onderhoud terugkerend",
        text: "Een onderhoudsafspraak kan na afronden een volgende beurt klaarzetten. Deze contacten zijn dossierprofielen; ze krijgen geen account of automatische berichten.",
      },
    ],
    page: "manage",
    action: "Naar mensen & afspraken",
  },
  {
    id: "ask",
    label: "Je huis iets vragen",
    Icon: MessageCircle,
    title: "Stel je vraag aan je huisboek.",
    steps: [
      {
        title: "Verbind de huisassistent",
        text: "Open Vraag je huis en kies AI instellen. Met een eigen OpenAI API-sleutel kun je beginnen; API-gebruik kan kosten veroorzaken. Een lokaal model is ook mogelijk.",
      },
      {
        title: "Vraag naar het huis of één plek",
        text: "Kies een voorbeeld of typ zelf een vraag over maten, documenten, onderhoud of geregistreerde kosten. Je kunt ook doorvragen.",
      },
      {
        title: "Kijk de bronnen na",
        text: "Bronknoppen tonen de bewaarde informatie achter een antwoord. Wat ontbreekt staat apart. Foto’s en scans worden niet automatisch uitgelezen. Bij OpenAI gaan relevante dossierfragmenten naar de aanbieder.",
      },
    ],
    page: "assistant",
    action: "Naar Vraag je huis",
  },
] satisfies {
  id: string;
  label: string;
  Icon: typeof Info;
  title: string;
  steps: { title: string; text: string }[];
  page: HousePage;
  action: string;
}[];

function topicForPage(page: HousePage) {
  if (page === "capture") return "save";
  if (page === "files") return "find";
  if (page === "tasks" || page === "planning") return "plan";
  if (page === "manage") return "people";
  if (page === "assistant") return "ask";
  return "explore";
}

export function WorkspaceHelp({
  page,
  onNavigate,
}: {
  page: HousePage;
  onNavigate: (page: HousePage) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(topicForPage(page));
  const topic = topics.find((item) => item.id === selected)!;
  const Icon = topic.Icon;
  const closeHelp = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="workspace-help-button"
        aria-label="Handleiding openen"
        title="Handleiding"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setSelected(topicForPage(page));
          setOpen(true);
        }}
      >
        <Info size={23} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {open && (
        <Dialog title="Wegwijs in je huisboek" onClose={closeHelp} wide>
          <div className="workspace-help">
            <p className="workspace-help-intro">
              Even kijken hoe iets werkt? Kies een onderwerp.
            </p>
            <div
              className="workspace-help-topics"
              role="group"
              aria-label="Onderwerp van de handleiding"
            >
              {topics.map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={selected === id}
                  onClick={() => setSelected(id)}
                >
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <section
              className={`workspace-help-story help-${topic.id}`}
              aria-labelledby="help-topic-title"
              aria-live="polite"
            >
              <div className="workspace-help-story-heading">
                <span aria-hidden="true">
                  <Icon size={32} strokeWidth={1.5} />
                </span>
                <h3 id="help-topic-title">{topic.title}</h3>
              </div>
              <ol>
                {topic.steps.map((step) => (
                  <li key={step.title}>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setOpen(false);
                  onNavigate(topic.page);
                }}
              >
                {topic.action}
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </section>
            <div className="workspace-help-footer">
              <Download size={20} aria-hidden="true" />
              <p>
                <strong>Een kopie voor jezelf</strong> De downloadknop bovenaan
                bewaart het dossier en de oorspronkelijke bestanden als één
                bestand op je computer.
              </p>
              <BookOpen size={20} aria-hidden="true" />
              <p>
                <strong>Blijf bij de bron</strong> Bekijk Bronnen & model voor
                herkomst en onzekerheden. Een 3D-weergave is geen inmeting.
              </p>
            </div>
            <button
              type="button"
              className="button secondary workspace-help-close"
              onClick={closeHelp}
            >
              Handleiding sluiten
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
