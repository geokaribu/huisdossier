import { Box, Database, ExternalLink, Footprints, Upload } from "lucide-react";
import { InformationBook, PlanInformation } from "./InformationBook";
import { ReadableText } from "./ReadableText";
import { formatDate } from "./formatDate";
import type { HouseData, Floorplan, HouseAppearance } from "./types";
export function SourcesPage({
  data,
  floorplan,
  appearance,
  onInterior,
  onUpload,
}: {
  data: HouseData;
  floorplan: Floorplan | null;
  appearance: HouseAppearance | null;
  onInterior: () => void;
  onUpload: () => void;
}) {
  return (
    <section className="sources-layout">
      <div className="content-panel">
        <div className="section-heading">
          <div>
            <h2>Waar komt het model vandaan?</h2>
            <p>
              Open gebouwdata, gekoppeld aan de gecontroleerde adreslocatie.
            </p>
          </div>
          <Database size={25} />
        </div>
        {floorplan && <PlanInformation plan={floorplan} />}
        {data.house.registry ? (
          <div className="source-block">
            <span className="source-number">GRB</span>
            <div>
              <h3>Het adres en het gebouw</h3>
              <p>
                {data.house.registry.name}: de adreslocatie ligt in de gekozen
                gebouwcontour. Het objectnummer is ook in de hoogtebron
                gecontroleerd.
              </p>
              <dl className="facts">
                <div>
                  <dt>Adreslocatie-ID</dt>
                  <dd>{data.house.registry.addressId}</dd>
                </div>
                <div>
                  <dt>Gebouw</dt>
                  <dd>{data.house.registry.buildingId}</dd>
                </div>
                <div>
                  <dt>Coördinatenstelsel</dt>
                  <dd>{data.source.crs}</dd>
                </div>
              </dl>
              <a
                href={data.house.registry.url}
                target="_blank"
                rel="noreferrer"
              >
                Bekijk adresbron <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ) : (
          <div className="source-block">
            <span className="source-number">BAG</span>
            <div>
              <h3>Het adres en het pand</h3>
              <p>
                Het verblijfsobject van {data.house.address} is via de officiële
                BAG-relatie gekoppeld aan dit pand.{" "}
                {data.house.buildingUnitCount &&
                data.house.buildingUnitCount > 1
                  ? `In dit pand zitten ${data.house.buildingUnitCount} verblijfsobjecten; de 3D-buitenzijde is gedeeld.`
                  : "Het model toont de geregistreerde buitenzijde."}
              </p>
              <dl className="facts">
                <div>
                  <dt>Verblijfsobject van de woning</dt>
                  <dd className="identifier">{data.house.bagVboId}</dd>
                </div>
                <div>
                  <dt>Pand</dt>
                  <dd className="identifier">{data.house.bagPandId}</dd>
                </div>
                <div>
                  <dt>Bouwjaar (registratie)</dt>
                  <dd>{data.house.buildingYear}</dd>
                </div>
                <div>
                  <dt>Gebruiksoppervlakte van de woning</dt>
                  <dd>{data.house.area} m²</dd>
                </div>
              </dl>
              <a href={data.source.urls[0]} target="_blank" rel="noreferrer">
                Bekijk BAG-bron <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
        <div className="source-block">
          <span className="source-number">3D</span>
          <div>
            <h3>{data.source.title ?? "3DBAG"}: de buitenzijde</h3>
            <ReadableText
              text={
                data.source.description ??
                "Een gereconstrueerd model op basis van BAG en hoogtegegevens. Het is geen bouwkundige inmeting. Het bronmodel bevat geen materialen, ramen, deuren of binnenindeling. De aanvullende afwerking en het interieur hebben eigen bronnen."
              }
            />
            <dl className="facts">
              <div>
                <dt>Detailniveau</dt>
                <dd>{data.source.detailLevel ?? "LoD 2.2"}</dd>
              </div>
              <div>
                <dt>Hoogtebron</dt>
                <dd>
                  {data.source.heightSource ?? (
                    <>
                      {String(
                        data.buildings.find((b) => b.target)?.attributes
                          .b3_pw_bron ?? "Onbekend",
                      ).toUpperCase()}{" "}
                      · opnamejaar{" "}
                      {String(
                        data.buildings.find((b) => b.target)?.attributes
                          .b3_pw_datum ?? "onbekend",
                      )}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>Opgehaald op</dt>
                <dd>{formatDate(data.source.fetchedAt)}</dd>
              </div>
              <div>
                <dt>Licentie</dt>
                <dd>{data.source.license}</dd>
              </div>
            </dl>
            <a
              href={data.source.infoUrl ?? data.source.urls[2]}
              target="_blank"
              rel="noreferrer"
            >
              Bekijk de modelbron <ExternalLink size={14} />
            </a>
            <p className="attribution">{data.source.attribution}</p>
          </div>
        </div>
        {floorplan && (
          <div className="source-block">
            <span className="source-number">
              <Footprints size={22} />
            </span>
            <div>
              <h3>Plattegrond: één woonlaag</h3>
              <p>
                Maten, ruimtes en bronnotities staan hierboven per onderwerp.
              </p>
              <button className="button secondary" onClick={onInterior}>
                <Footprints size={16} /> Binnen bekijken
              </button>
            </div>
          </div>
        )}
        {appearance && (
          <div className="source-block">
            <span className="source-number">Foto</span>
            <div>
              <h3>{appearance.label}</h3>
              <InformationBook
                title="Buitenkant & afwerking"
                items={appearance.information ?? []}
                original={[
                  {
                    label: "Afwerking",
                    text: appearance.description,
                  },
                  { label: "Herkomst", text: appearance.attribution },
                ]}
              />
              <a
                href={appearance.front.texture}
                target="_blank"
                rel="noreferrer"
              >
                Bekijk het gereconstrueerde gevelbeeld{" "}
                <ExternalLink size={14} />
              </a>
              <div className="attribution">
                <ReadableText
                  text={`${appearance.attribution} Het gevelbeeld blijft lokaal en staat los van de geometrie en de open-datalicentie.`}
                />
              </div>
              {appearance.aerial && (
                <section className="source-aerial">
                  <a
                    href={appearance.aerial.texture}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Bekijk de luchtfoto <ExternalLink size={14} />
                  </a>
                  <dl className="facts">
                    <div>
                      <dt>Herkomst luchtfoto</dt>
                      <dd>{appearance.aerial.attribution}</dd>
                    </div>
                    <div>
                      <dt>Opgehaald</dt>
                      <dd>{formatDate(appearance.aerial.fetchedAt)}</dd>
                    </div>
                    {appearance.aerial.nativeResolutionMetres && (
                      <div>
                        <dt>Bronresolutie</dt>
                        <dd>
                          {Number(
                            (
                              appearance.aerial.nativeResolutionMetres * 100
                            ).toFixed(2),
                          ).toLocaleString("nl-NL")}{" "}
                          cm per pixel
                        </dd>
                      </div>
                    )}
                    {appearance.aerial.captureDate && (
                      <div>
                        <dt>Opnamedatum</dt>
                        <dd>{formatDate(appearance.aerial.captureDate)}</dd>
                      </div>
                    )}
                    {appearance.aerial.license && (
                      <div>
                        <dt>Licentie</dt>
                        <dd>{appearance.aerial.license}</dd>
                      </div>
                    )}
                  </dl>
                  <p>
                    Op de bovenzijde van het dak geprojecteerd; pixelresolutie
                    is geen meetnauwkeurigheid.
                  </p>
                  {appearance.aerial.sourceUrl && (
                    <>
                      {" "}
                      <a
                        href={appearance.aerial.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bronmetadata
                      </a>
                    </>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      <aside className="next-step-panel">
        <Box size={31} strokeWidth={1.3} />
        <h2>Het model aanvullen</h2>
        <p>Eigen materiaal helpt om de woning verder uit te werken.</p>
        <ul>
          <li>
            {floorplan
              ? "Binnenindeling en rondlopen uit jullie plattegrond"
              : "Een plattegrond voor de binnenindeling"}
          </li>
          <li>Foto’s van gevels en ruimtes</li>
          <li>Scans voor meer detail</li>
          <li>Toestelgegevens en onderhoudshistorie</li>
        </ul>
        <button className="button primary full" onClick={onUpload}>
          <Upload size={16} /> Voeg materiaal toe
        </button>
        <p className="small-note">
          Bestanden en meldingen blijven lokaal op deze computer.
        </p>
      </aside>
    </section>
  );
}
