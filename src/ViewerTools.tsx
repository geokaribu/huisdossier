import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Maximize,
  Minimize,
  Minus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import "./viewer-tools.css";

/** Shared, on-demand controls keep the model visible and avoid gesture-only actions. */
export function ViewerTools({
  target,
  walking = false,
  onNavigate,
  onZoom,
  onStep,
}: {
  target: RefObject<HTMLElement | null>;
  walking?: boolean;
  onNavigate: (x: number, y: number, pan: boolean) => void;
  onZoom: (factor: number) => void;
  onStep?: (x: number, y: number) => void;
}) {
  const [full, setFull] = useState(false);
  const [pan, setPan] = useState(false);
  const [message, setMessage] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === target.current;
      setFull(active);
      if (!active) button.current?.focus({ preventScroll: true });
    };
    document.addEventListener("fullscreenchange", changed);
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node))
        panel.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [target]);
  const direction = (step = false) => {
    const verb = step ? "Stap" : walking ? "Kijk" : pan ? "Verplaats" : "Draai";
    return (
      <div
        className="viewer-direction-pad"
        role="group"
        aria-label={step ? "Stappen" : "Kijkrichting"}
      >
        {(
          [
            [-1, 0, "naar links", ArrowLeft],
            [0, -1, step ? "vooruit" : "omhoog", ArrowUp],
            [0, 1, step ? "achteruit" : "omlaag", ArrowDown],
            [1, 0, "naar rechts", ArrowRight],
          ] as const
        ).map(([x, y, label, Icon]) => (
          <button
            key={label}
            type="button"
            aria-label={`${verb} ${label}`}
            title={`${verb} ${label}`}
            onClick={() => (step ? onStep?.(x, y) : onNavigate(x, y, pan))}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
    );
  };
  return (
    <div className="viewer-tools">
      <details
        ref={panel}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            panel.current?.removeAttribute("open");
            panel.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          <SlidersHorizontal size={17} /> Bediening
        </summary>
        <div className="viewer-tools-panel">
          <strong>
            {walking ? "Rondkijken en lopen" : "Het model verkennen"}
          </strong>
          {!walking && (
            <label>
              Beweging
              <select
                aria-label="Camerabediening"
                value={pan ? "pan" : "orbit"}
                onChange={(e) => setPan(e.target.value === "pan")}
              >
                <option value="orbit">Draaien</option>
                <option value="pan">Verplaatsen</option>
              </select>
            </label>
          )}
          {direction()}
          {walking ? (
            <>
              <span className="subtle-label">Stap voor stap</span>
              {direction(true)}
            </>
          ) : (
            <div className="viewer-zoom">
              <button aria-label="Zoom in" onClick={() => onZoom(0.8)}>
                <Plus size={18} /> Inzoomen
              </button>
              <button aria-label="Zoom uit" onClick={() => onZoom(1.25)}>
                <Minus size={18} /> Uitzoomen
              </button>
            </div>
          )}
          <p>
            {walking
              ? "Klik voor een stap. Met focus in het beeld: W A S D of pijltjes om te lopen; sleep om te kijken. Esc geeft het overzicht."
              : "Sleep om te draaien; de rechtermuisknop verplaatst het beeld. Klik in het beeld en scroll om te zoomen. Op je telefoon kun je verticaal over het beeld scrollen. Gebruik deze knoppen voor precieze bewegingen zonder slepen."}
          </p>
        </div>
      </details>
      <button
        className="icon-button"
        ref={button}
        disabled={!document.fullscreenEnabled}
        aria-label={full ? "Verlaat volledig scherm" : "Volledig scherm"}
        title={full ? "Verlaat volledig scherm" : "Volledig scherm"}
        onClick={async () => {
          try {
            setMessage("");
            if (document.fullscreenElement) await document.exitFullscreen();
            else await target.current?.requestFullscreen();
          } catch {
            setMessage("Volledig scherm is niet beschikbaar in deze browser.");
          }
        }}
      >
        {full ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      {message && (
        <span className="viewer-tools-message" role="status">
          {message}
        </span>
      )}
    </div>
  );
}
