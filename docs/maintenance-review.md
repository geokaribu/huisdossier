# Technische reviewkaart

Deze kaart beschrijft de onderhoudsronde van 21 november 2026, na de huisboekinterface in `c143d9b`. De lokale installatie is het opgeleverde product; publieke hosting en accounts vallen buiten dit contract.

## Waar hoort een wijziging?

| Wijziging                                         | Eigenaar in de code                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Klant, woning, bronprovider en startonderdelen    | Klantmap `installation.json` / `houses.json`; validatie in `server/runtime-config.mjs`     |
| Installeren, kiezen, controleren                  | `scripts/init-customer.mjs`, `scripts/customer.mjs`, `server/installation-check.mjs`       |
| Back-up/herstel en procesuitsluiting              | `server/installation-backup.mjs`, `server/installation-lock.mjs`                           |
| Dossier, migraties en consistente exportselectie  | `server/store.mjs`; HTTP/bytes in `server/app.mjs`                                         |
| Modelcontract voor API, import en oplevercontrole | `server/model.mjs`; atomisch schrijven in `server/atomic-json.mjs`                         |
| Bewonersinvoer, planning, AI                      | Bestaande afzonderlijke `management-*`, `planning-*`, `assistant-*` modules                |
| Ruimte- en dossierinterface                       | `src/DossierHome.tsx`, `src/DossierWorkspace.tsx`, `src/InformationBook.tsx`               |
| Klussen en bronweergave                           | `src/TaskList.tsx`, `src/SourcesPage.tsx`                                                  |
| Woningkeuze, navigatie, gedeelde dialoogtoestand  | `src/main.tsx`; URL- en laadcontracten in `src/houseSelection.ts` / `src/workspaceLoad.ts` |
| Bronafhankelijke 3D-vormen                        | Bestaande viewer/geometrie-modules; privéparameters in de klantmap                         |

## Gerepareerde oorzaken

- **Privébestanden via Vite:** vóór statische middleware staat een bestandsgrens die de privémap, catalogus, SQLite en verborgen configuratie afschermt. Tests gebruiken echte Vite-middleware en ook ruwe HTTP-paden, omdat `fetch` dotsegmenten kan normaliseren voordat het verzoek wordt verstuurd. De API-vrijstelling geldt alleen zonder traversal; privépaden blijven via expliciete huisgebonden routes bereikbaar.
- **Verschillende modelcontroles:** API, import en installatiecontrole delen één schema. Metadata blijft behouden; niet-eindige coördinaten, onvolledige vlakken, ontbrekend CRS of een verkeerde woning-ID worden geweigerd. Dit bewijst schema-/bronconsistentie, geen meetnauwkeurigheid.
- **Halve export bij gelijktijdige invoer:** dossier, beheerdata en bestandslijst worden synchroon in één SQLite-leestransactie vastgelegd vóór het asynchroon lezen van originele bytes. Ontbrekende originelen veroorzaken een fout. Model-/profielverrijkingen blijven afzonderlijke bestandsmomentopnamen; de offline installatieback-up is de volledige herstelkopie.
- **Late antwoorden na woningwissel:** een generatie van de werkruimte begrenst opslaan, verversen en opnieuw laden, ook A→B→A. URL-herstel wacht op het dossier van de bestemmingswoning. Een oude afronding kan het nieuwe scherm niet sluiten, selecteren of een melding tonen.
- **Onbedoeld opnieuw opbouwen van klusdetails:** `TaskList` is een zelfstandig component met expliciete invoer en callbacks. `SourcesPage` is eveneens uit het hoofdbestand gehaald. Geen dubbele bron van dossierdata of nieuwe abstractielaag toegevoegd.
- **Handmatige kopieën en imports tijdens een back-up:** server, importers en back-up delen hetzelfde exclusieve proces-slot. De offline kopie omvat configuratie, database/WAL, uploads, profielen en modellen. Herstel controleert hashes en SQLite in een nieuwe map; actieve of bestaande doelen worden geweigerd.

## Beheer en verificatie

De [installatiehandleiding](installation.md) is de uitvoerbare route voor nieuwe klanten, updates en herstel. `npm run verify` draait de regressietests, TypeScript en de productiebuild; GitHub Actions voert dezelfde route op Windows en Linux uit. Browsermutaties gebruiken uitsluitend synthetische woningen. De afzonderlijke herstelproef gebruikt een offline kopie van de echte installatie en vergelijkt alle tabellen; er wordt geen privé-inhoud in testfixtures of Git opgenomen.

Zie [verificatieverslag](verification.md) voor de concrete uitkomsten en beperkingen. De preflight gebruikt bewust een volledig geldig model in zijn positieve fixture: de oude fixture liet geometrie/bronvelden weg die de API al vereiste. Die wijziging herstelt de bedoelde contracttoets.

## Resterende onderhoudslast

`main.tsx`, de viewers en de stylesheet blijven substantieel. De twee concrete zelfstandige schermdelen zijn afgesplitst; verdere opsplitsing hoort bij een volgende inhoudelijke wijziging met dezelfde interactiecontroles. Dependencies, gebruikte illustraties, bronmodellen en productiebuild blijven aanwezig om de app direct bruikbaar te houden. Het opruimcommando verwijdert alleen bekende tijdelijke captures en testuitvoer.

Automatische dependency-upgrades, operationele back-upplanning, monitoring, een bewaarbeleid en ondersteuning voor meerdere online klanten vragen nog expliciet beheer. CI controleert een wijziging; het installeert die niet automatisch bij klanten. Houd een versie en herstelkopie per klant bij.
