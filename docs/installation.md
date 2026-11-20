# Een herhaalbare lokale installatie

Deze handleiding is voor degene die Huisdossier installeert en oplevert. Bewoners en gebruikers voeren informatie in via de interface. De server blijft loopback-only; dit is geen instructie voor publieke hosting.

## Code en gegevens scheiden

Dezelfde gebouwde code kan met verschillende installatiebestanden draaien. Er zijn drie optionele instellingen, allemaal absolute paden:

| Variabele                 | Standaard            | Inhoud                                                                      |
| ------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `HUISDOSSIER_HOUSES_FILE` | `config/houses.json` | JSON-catalogus met panden voor deze installatie                             |
| `HUISDOSSIER_DATA_DIR`    | `data/`              | SQLite, uploads, privéscenario's, afwerking, plattegronden en importbronnen |
| `HUISDOSSIER_MODELS_DIR`  | `public/data/`       | Bronmodellen per dossier-ID                                                 |

Alle importers en de server lezen dezelfde instellingen. De app laadt modellen via `/api/houses/:id/model`; export gebruikt dezelfde modellenmap. De standaardmap onder `public/data` blijft bruikbaar voor de bestaande openbare casussen. Bewaar klantgebonden configuratie en nieuwe modellen bij voorkeur buiten de checkout of onder de genegeerde privémap; voeg ze niet aan Git toe. Een andere modellenmap verwijdert geen al aanwezige kopieën uit `public/data` en maakt de app niet geschikt voor publieke hosting.

Voorbeeld met uitsluitend fictieve paden; maak de eigen catalogus en laat de variabelen gelden voor **alle** start- en importcommando's:

```powershell
$env:HUISDOSSIER_HOUSES_FILE = 'C:\Huisdossier\Voorbeeldklant\houses.json'
$env:HUISDOSSIER_DATA_DIR = 'C:\Huisdossier\Voorbeeldklant\data'
$env:HUISDOSSIER_MODELS_DIR = 'C:\Huisdossier\Voorbeeldklant\models'
npm run check:installation
npm run build
npm start
```

`.env` wordt niet automatisch geladen. Gebruik dezelfde proces-/serviceconfiguratie bij herstart. Een aparte databestandsmap is geen gebruikersautorisatie. Voor twee gelijktijdige processen zijn afzonderlijke poorten nodig (`PORT`); het toewijzen van processen/poorten en het kiezen van de gewenste installatie blijft een beheerhandeling. Open nooit dezelfde installatie met verschillende catalogussen als een vervanging voor echte toegangsrechten.

## Catalogus en startonderdelen

Gebruik de vorm van `config/houses.json`, met een unieke stabiele ID. Verander een bestaand ID niet bij een naams- of adrescorrectie: uploads, profielen en dossiers verwijzen ernaar. `provider` is `bag` (standaard) of `vlaanderen`. BAG vereist een geldig gevormd verblijfsobject-ID. De importer controleert daarna de werkelijke bronrelatie; schemavalidatie bewijst nog geen geldig adres.

`starterAssets` bestaat uit `slug`, `name`, `description` en optioneel `kind`: `gebouw`, `dak`, `gevel`, `ruimte`, `installatie` of `overig`. Zonder `kind` blijft het een installatie voor compatibiliteit met bestaande configuraties. `building`, `roof`, `facade` en `inbox` zijn gereserveerd. Duplicaten, onveilige ID's en onbekende configuratievelden worden vóór serverstart geweigerd.

Voorbeeld van uitsluitend het onderdelenveld voor een kantoorproef, zonder verzonnen onderhoudsinterval:

```json
{
  "starterAssets": [
    {
      "slug": "vergaderruimte",
      "name": "Vergaderruimte",
      "description": "Locatie en gegevens aanvullen.",
      "kind": "ruimte"
    },
    {
      "slug": "contracten",
      "name": "Contracten",
      "description": "Afspraken bij deze locatie.",
      "kind": "overig"
    }
  ]
}
```

Dit is een **fragment**, geen complete catalogus. Het maakt nog geen kantoorplattegrond of meerdere bouwlagen. Startonderdelen worden alleen toegevoegd als ze ontbreken; eigen bewerkingen worden niet vervangen als de configuratie later verandert. Startpakketten hebben nog geen automatische upgradeversies.

## Controleren vóór opleveren

```powershell
npm run import:house -- eigen-dossier-id
npm run check:installation
node scripts/check-installation.mjs --json
```

Import vraagt altijd een expliciet dossier-ID. De Vlaamse importer gebruikt de Vlaamse bron; de lichtimport ondersteunt alleen de Nederlandse BAG/BGT-bron. Documentimport gebruikt ook de ingestelde catalogus en privémap. Elk commando dat nieuwe brondata ophaalt kan afhankelijk zijn van bereikbaarheid en volledigheid van die bron.

`check:installation` is read-only: het maakt geen DB, uploads of profielen en haalt niets van internet op. Het controleert de catalogus en per pand de aanwezigheid/identiteit/bronlabels van het model, schema's van optionele profielen en aanwezigheid van gekoppelde texturen. Exitcode 1 betekent configuratiefout of een fout in deze gecontroleerde bestanden. Een niet-ingericht optioneel profiel is toegestaan. JSON-uitvoer heeft `ready` voor deze lokale bestandscontrole en altijd `hostedReady: false` voor de huidige productversie.

Het commando controleert **niet** de volledige geometrie, ruimtelijke registratie, uploadinhoud, database-integriteit, accounts, rechten, back-upherstel of belasting. Het bestaande dossier en de export vereisen nog een model; zonder model betekent een catalogusitem nog geen bruikbare dossierstart. De test met een nieuw adres kan pas als oplevering tellen nadat ook documenten, invoer en onderhoud in de browser zijn doorlopen.

## Uit beheer nemen, bijwerken en herstellen

Een pand uit de catalogus halen verwijdert geen gegevens. Het verdwijnt uit de selector en de huisgebonden API weigert het. Bij opnieuw configureren zijn de bestaande gegevens weer beschikbaar. Dit is geen verwijder-/privacyflow en geen alternatief voor rechten per gebruiker. Bestaande losse bestanden onder de standaard statische bronmap zijn hiermee niet automatisch verwijderd.

Maak vóór een update een consistente kopie van de volledige installatiegegevens: catalogus, modellen en de gestopte privémap. Externe catalogus/modellenpaden vallen niet vanzelf onder een kopie van `data/`. Test upgrades en herstel eerst in een geïsoleerde installatie. De dossierexport bevat de modelgegevens en originele bestanden, maar heeft nog geen automatische herstelimport. Zie [bewonersbeheer](resident-management.md) en [productaudit](product-readiness.md).
