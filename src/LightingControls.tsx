import { useEffect, useState } from "react";
import { Sun, Moon, Lamp, Check } from "lucide-react";
import { activeLampIds, solarPosition } from "./lighting";
import { request } from "./api";
import { InformationBook } from "./InformationBook";
import { ReadableText } from "./ReadableText";
import type {
  HouseData,
  LampScenario,
  LightingEnvironment,
  LightingSettings,
} from "./types";

export function LightingControls({
  data,
  profile,
  settings,
  onChange,
  onProfile,
  interiorAvailable,
}: {
  data: HouseData;
  profile: LightingEnvironment | null;
  settings: LightingSettings;
  onChange: (value: LightingSettings) => void;
  onProfile: (value: LightingEnvironment) => void;
  interiorAvailable: boolean;
}) {
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const lamp =
    profile?.lamps.find((l) => l.id === settings.selectedLampId) ??
    profile?.lamps[0];
  const [draft, setDraft] = useState<LampScenario | null>(
    lamp?.scenario ?? null,
  );
  useEffect(() => {
    setDraft(lamp?.scenario ?? null);
    setMessage("");
  }, [lamp]);
  const solar = profile && solarPosition(profile, settings);
  const set = (value: Partial<LightingSettings>) =>
    onChange({ ...settings, ...value });
  const changeLamp = (value: Partial<LampScenario>) => {
    if (!lamp || !draft || !profile) return;
    const scenario = { ...draft, ...value };
    setDraft(scenario);
    setMessage("");
    // Preview immediately. Persist only on the explicit save action.
    onProfile({
      ...profile,
      lamps: profile.lamps.map((l) =>
        l.id === lamp.id ? { ...l, scenario } : l,
      ),
    });
  };
  const save = async () => {
    if (!lamp || !draft) return;
    setSaving(true);
    setMessage("");
    try {
      await request(
        `/api/houses/${data.house.id}/lighting/${encodeURIComponent(lamp.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(draft),
        },
      );
      setMessage("Lampprofiel lokaal bewaard.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <details className="lighting-panel">
      <summary>
        <span>
          <Sun size={18} /> Licht & schaduw
        </span>
        <small>
          {settings.enabled
            ? `${settings.date} · ${settings.time} · ${solar && solar.altitude > 0 ? "dag" : "nacht"}`
            : "Bekijk zonlicht en straatverlichting"}
        </small>
      </summary>
      <div className="lighting-body">
        <label className="lighting-switch">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={!profile}
            onChange={(e) =>
              set({ enabled: e.target.checked, neighbors: true })
            }
          />{" "}
          Simulatie aan
        </label>
        {!profile ? (
          <p>Voor deze woning is nog geen lichtomgeving geïmporteerd.</p>
        ) : (
          <>
            <div className="lighting-calendar">
              <label>
                Datum
                <input
                  aria-label="Datum lichtsimulatie"
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={settings.date}
                  onChange={(e) =>
                    e.target.value && set({ date: e.target.value })
                  }
                />
              </label>
              <label>
                Tijd in Nederland
                <input
                  aria-label="Tijd lichtsimulatie"
                  type="time"
                  value={settings.time}
                  onChange={(e) =>
                    e.target.value && set({ time: e.target.value })
                  }
                />
              </label>
              <div className="lighting-presets">
                <button onClick={() => set({ time: "12:00", enabled: true })}>
                  <Sun size={16} /> Dag
                </button>
                <button onClick={() => set({ time: "23:00", enabled: true })}>
                  <Moon size={16} /> Nacht
                </button>
              </div>
            </div>
            <input
              className="lighting-time"
              aria-label="Tijd door de dag"
              type="range"
              min="0"
              max="1439"
              step="5"
              value={
                Number(settings.time.slice(0, 2)) * 60 +
                Number(settings.time.slice(3))
              }
              onChange={(e) => {
                const n = Number(e.target.value);
                set({
                  time: `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`,
                });
              }}
            />
            <div className="lighting-ticks">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <p className="lighting-status" role="status">
              {solar ? (
                <>
                  Zon {solar.altitude > 0 ? "boven" : "onder"} de horizon ·
                  hoogte {solar.altitude.toFixed(1)}° · richting{" "}
                  {solar.azimuth.toFixed(0)}° vanaf noord
                </>
              ) : (
                "Deze lokale tijd bestaat niet door de overgang naar zomertijd. Kies een andere tijd."
              )}
            </p>
            <div className="lighting-options">
              <label>
                <input
                  type="checkbox"
                  checked={settings.neighbors}
                  onChange={(e) => set({ neighbors: e.target.checked })}
                />{" "}
                Omliggende gebouwen (
                {data.buildings.filter((b) => !b.target).length})
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.streetLights}
                  onChange={(e) => set({ streetLights: e.target.checked })}
                />{" "}
                Straatlampen bij nacht
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.indoorLights}
                  onChange={(e) => set({ indoorLights: e.target.checked })}
                />{" "}
                Binnenlampen
              </label>
            </div>
            <label className="lighting-exposure">
              Beeldbelichting{" "}
              <input
                aria-label="Beeldbelichting"
                type="range"
                min="0.25"
                max="4"
                step=".25"
                value={settings.exposure}
                onChange={(e) => set({ exposure: Number(e.target.value) })}
              />
              <span>{settings.exposure.toFixed(2)}×</span>
            </label>
            <details className="lamp-settings">
              <summary>
                <Lamp size={16} /> Straatlampen en aannames
              </summary>
              <p>
                {profile.lamps.length} BGT-posities. Bij nacht rekenen we
                maximaal{" "}
                {
                  activeLampIds(profile, settings.selectedLampId, data.house.rd)
                    .length
                }{" "}
                lampen door: de gekozen lamp en de dichtstbijzijnde overige
                lampen. De andere masten zijn alleen zichtbaar.
              </p>
              {lamp && draft && (
                <>
                  <label>
                    Lichtmast
                    <select
                      aria-label="Lichtmast"
                      value={lamp.id}
                      onChange={(e) => set({ selectedLampId: e.target.value })}
                    >
                      {profile.lamps.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.label} ·{" "}
                          {Math.round(
                            Math.hypot(
                              l.rd[0] - data.house.rd[0],
                              l.rd[1] - data.house.rd[1],
                            ),
                          )}{" "}
                          m van huis
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="lamp-facts">
                    Bronobject: {lamp.sourceType} · armatuur:{" "}
                    {lamp.armatureType ?? "onbekend"}. Oranje markeert de
                    gekozen mast.
                  </p>
                  <div className="lamp-fields">
                    <label>
                      Aangenomen hoogte (m)
                      <input
                        aria-label="Aangenomen lamphoogte"
                        type="number"
                        min="2"
                        max="15"
                        step=".1"
                        value={draft.height}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (n >= 2 && n <= 15) changeLamp({ height: n });
                        }}
                      />
                    </label>
                    <label>
                      Aangenomen lichtstroom (lm)
                      <input
                        aria-label="Aangenomen lichtstroom"
                        type="number"
                        min="0"
                        max="20000"
                        step="100"
                        value={draft.lumens}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (n >= 0 && n <= 20000) changeLamp({ lumens: n });
                        }}
                      />
                    </label>
                    <label>
                      Aangenomen kleur (K)
                      <input
                        aria-label="Aangenomen lichtkleur"
                        type="number"
                        min="1800"
                        max="6500"
                        step="100"
                        value={draft.kelvin}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (n >= 1800 && n <= 6500) changeLamp({ kelvin: n });
                        }}
                      />
                    </label>
                    <label>
                      Lichtverdeling
                      <select
                        aria-label="Lichtverdeling"
                        value={draft.distribution}
                        onChange={(e) =>
                          changeLamp({
                            distribution: e.target
                              .value as LampScenario["distribution"],
                          })
                        }
                      >
                        <option value="point">Rondom (vereenvoudigd)</option>
                        <option value="downward">
                          Naar beneden (vereenvoudigd)
                        </option>
                      </select>
                    </label>
                  </div>
                  <button disabled={saving} onClick={save}>
                    <Check size={15} />
                    {saving ? "Bewaren…" : "Bewaar lampprofiel"}
                  </button>
                  <span className="lamp-save" role="status">
                    {message}
                  </span>
                </>
              )}
            </details>
            <details className="lighting-source">
              <summary>Bronnen en nauwkeurigheid</summary>
              <p>
                <a href={profile.source.url} target="_blank" rel="noreferrer">
                  {profile.source.attribution}
                </a>{" "}
                · {profile.source.license} · opgehaald{" "}
                {new Date(profile.source.fetchedAt).toLocaleDateString("nl-NL")}
                .
              </p>
              <ReadableText text={profile.source.note} />
              <InformationBook
                compact
                title="Wat vertelt dit lichtbeeld?"
                items={[
                  {
                    id: "light-environment",
                    title: "Gebouwen en omgeving",
                    topic: "layout",
                    status: "approximate",
                    value: "circa 45 m",
                    text: "3DBAG bepaalt de gebouwen; de plattegrond is bij benadering daarop uitgelijnd. Bomen en verder gelegen objecten ontbreken; lage zon kan daardoor onvolledige schaduw geven.",
                  },
                  {
                    id: "light-sun",
                    title: "Zonstand en tijd",
                    topic: "sources",
                    status: "source",
                    text: "Zonstand: SunCalc, Nederlandse winter- en zomertijd. In het herhaalde uur bij wintertijd wordt één van beide tijdstippen gebruikt.",
                  },
                  {
                    id: "light-material",
                    title: "Neutraal materiaal tijdens simulatie",
                    topic: "finishes",
                    status: "approximate",
                    text: "Foto's op gevel en dak worden tijdens de simulatie vervangen door neutraal materiaal: foto's bevatten al schaduw en belichting.",
                  },
                  {
                    id: "light-accuracy",
                    title: "Visuele verkenning, geen luxmeting",
                    topic: "accuracy",
                    status: "unknown",
                    text: "Armatuurcurves (IES/LDT), glastransmissie, gordijnen, strooilicht en dimschema's zijn niet ingemeten. Geen betrouwbare luxmeting of voorspelling van lichthinder. Beeldbelichting verandert alleen het beeld.",
                  },
                ]}
              />
            </details>
            <p className="lighting-hint">
              {interiorAvailable
                ? "Kies Binnen kijken en daarna een kamer om de lichtinval te bekijken. In de plattegrond blijft het plafond schaduw werpen."
                : "De buitenzijde is beschikbaar; voor lichtinval binnen is een gekoppelde plattegrond nodig."}
            </p>
          </>
        )}
      </div>
    </details>
  );
}
