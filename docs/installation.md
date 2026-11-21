# Een herhaalbare lokale installatie

Eén codebasis, een eigen map per klant. Node 24+ is vereist. Bewoners vullen hun huisboek in via de app; onderstaande stappen zijn voor installatie en onderhoud. De server luistert alleen op `127.0.0.1`.

## Een klant starten

Installeer en bouw de gedeelde code één keer:

```powershell
npm ci
npm run verify
```

Maak een **nieuwe** map buiten de codecheckout. Het commando vraagt adres, plaats, postcode, naam en een vaste dossier-ID:

```powershell
npm run customer:init -- C:\Huisdossier-klanten\Voorbeeld
npm run customer -- C:\Huisdossier-klanten\Voorbeeld check
npm run customer -- C:\Huisdossier-klanten\Voorbeeld start
```

Open `http://127.0.0.1:4173`. Zonder 3D-model werken plaatsen, documenten, notities, klussen en export al. De wizard kiest `provider: "none"` en verzint geen kamers, materialen of bronrelaties. Voeg eigen plaatsen in de app toe. AI is optioneel en wordt per installatie ingesteld via **Vraag je huis**.

Voor vooraf ingerichte woningen:

```powershell
npm run customer:init -- C:\Huisdossier-klanten\Voorbeeld --catalog C:\Invoer\houses.json
```

Een bestaande map wordt nooit overschreven. De nieuwe klantmap bevat:

| Bestand/map         | Doel                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `installation.json` | Versie 1, catalogus-, data-, modellenpad en poort                      |
| `houses.json`       | Woningen en startonderdelen                                            |
| `data/`             | SQLite, uploads, privéprofielen, importbronnen en eventuele AI-sleutel |
| `models/`           | Bronmodellen per vaste woning-ID                                       |
| `.gitignore`        | Houdt deze installatiegegevens buiten Git                              |

Paden in `installation.json` zijn relatief aan dit bestand. De klantmap kan daardoor worden verplaatst zonder broncode te wijzigen. Pas voor een tweede gelijktijdige klant de `port` aan. Eén installatie mag slechts door één server of muterend import-/back-upproces tegelijk worden gebruikt. Houd de hele klantmap privé; een back-up bevat ook eventuele AI-instellingen en sleutels.

## Woningen en startonderdelen aanpassen

Een minimale volledige `houses.json` met uitsluitend fictieve inhoud:

```json
[
  {
    "id": "voorbeeldhuis",
    "name": "Ons huisboek",
    "address": "Voorbeeldstraat 1",
    "postcode": "1000 AA",
    "city": "Voorbeeldstad",
    "provider": "none",
    "starterAssets": [
      {
        "slug": "werkkamer",
        "name": "Werkkamer",
        "description": "Volgens bewoners.",
        "kind": "ruimte",
        "roomId": "office"
      }
    ]
  }
]
```

`roomId` is optioneel en koppelt aan dezelfde vaste kamer-ID in een eigen plattegrondprofiel. Een startonderdeel maakt geen plattegrond. Toegestane `kind`: `gebouw`, `dak`, `gevel`, `ruimte`, `installatie`, `overig`. Zonder `kind` blijft het een installatie. `building`, `roof`, `facade`, `inbox` zijn gereserveerde slugs. Duplicaten, onveilige ID's en onbekende velden worden geweigerd. Startonderdelen worden alleen toegevoegd als ze ontbreken; een herstart vervangt eigen tekst en kamerkoppelingen niet.

Verander bestaande woning-ID's of onderdeelsleutels niet bij een adres- of naamscorrectie: gegevens en bronkoppelingen verwijzen ernaar. Een woning uit de catalogus halen verwijdert geen gegevens; heractiveren met dezelfde ID maakt ze opnieuw bereikbaar. Dit is geen privacy-/verwijderflow.

Voor bronmodellen: `bag` vereist een verblijfsobject-ID (`vboId`) en RD-anker (`rd`); `vlaanderen` vereist een passend Lambert 72-anker in het historische veld `rd`. Neem de overige bronvelden over uit het bestaande catalogusformaat. De bronimport controleert de werkelijke adres-/gebouwrelatie. `query` wordt standaard uit het adres afgeleid. Bronmodellen behouden attributie, licentie, CRS, exacte bronrelatie en ophaaldatum. Een model is geen geverifieerd interieur.

Stop de klantserver vóór importeren:

```powershell
npm run customer -- C:\Huisdossier-klanten\Voorbeeld import:house voorbeeldhuis
npm run customer -- C:\Huisdossier-klanten\Voorbeeld check
```

`import:lighting` ondersteunt alleen de Nederlandse BAG/BGT-bron. `import:dossier` verwacht daarnaast bronmap, privaat manifest en optioneel een bronsleutel; zie [de importhandleiding](document-import.md). Dezelfde klantkeuze geldt voor alle importers. Modelimport valideert tussenuitvoer en vervangt het actieve JSON-bestand atomisch; maak vóór bronupdates een back-up voor versieherstel.

## Back-up, herstel en updates

Stop de server met Ctrl+C. Een actieve installatie weigert back-up en een tweede start. Alle meegeleverde importers gebruiken hetzelfde installatieslot. Na een afgebroken proces wordt een slot met een aantoonbaar verdwenen proces-ID automatisch opgeruimd. Verwijder een ongeldig slotbestand niet zonder eerst vast te stellen dat alle schrijvende processen gestopt zijn.

Maak een **nieuwe** back-upmap, buiten de bronmappen:

```powershell
npm run customer -- C:\Huisdossier-klanten\Voorbeeld backup D:\Backups\Voorbeeld-2026-11-21
npm run restore -- D:\Backups\Voorbeeld-2026-11-21 C:\Huisdossier-klanten\Voorbeeld-herstel
npm run customer -- C:\Huisdossier-klanten\Voorbeeld-herstel check
```

De back-up bevat catalogus, modellen, gehele privémap, draagbare installatieconfiguratie en SHA-256-bestandscontrole. SQLite-integriteit wordt gecontroleerd. Symlinks worden geweigerd. Herstel weigert bestaande doelmappen en gewijzigde/onvolledige back-ups. Dit is een **volledige installatiekopie**; de JSON-dossierexport heeft nog geen bijbehorende terugimport. Controleer na herstel de app met een eigen poort, documenten/originelen en onderhoud voordat de herstelde installatie de oude vervangt. Bewaar back-ups op een afzonderlijke gegevensdrager met passend toegangsbeheer; het commando versleutelt niet en regelt geen automatische planning of bewaartermijn.

Bijwerken: stop → back-up → nieuwe code ophalen → `npm ci` → `npm run verify` → klantcontrole → starten. De database gebruikt additieve migraties. Terugrollen betekent bijpassende oude code plus herstel van de vooraf gemaakte installatiekopie; start oude code niet blind op een al bijgewerkte database. Update de gedeelde code eerst met een herstelde proefinstallatie vóór alle klanten opnieuw starten.

## Bestaande installatie en technische controles

Zonder klantcommando blijven `config/houses.json`, `data/`, `public/data/` en poort 4173 de standaard. `npm run dev`, `npm start`, `npm run check:installation`, `npm run backup -- <nieuwe-map>` blijven daarvoor werken.

`HUISDOSSIER_INSTALLATION` mag rechtstreeks een absoluut pad naar `installation.json` aanwijzen. Legacy absolute variabelen `HUISDOSSIER_HOUSES_FILE`, `HUISDOSSIER_DATA_DIR`, `HUISDOSSIER_MODELS_DIR` blijven ondersteund en overschrijven die paden bij rechtstreeks starten. Het expliciete `customer`-commando verwijdert deze drie oude overrides uit zijn subprocess zodat een achtergebleven shellinstelling geen andere klant kiest. `PORT` overschrijft de descriptorpoort. `.env` wordt niet automatisch geladen.

`check:installation` is read-only en offline: catalogus, volledige modelschemavalidatie inclusief eindige geometriecoördinaten/bronlabels/CRS/woning-ID, optionele profielen en gekoppelde texturen. Een ontbrekend model is bij `provider: none` toegestaan. Een onjuist aanwezig model blijft een fout. JSON-uitvoer (`check --json`) heeft `ready` voor deze bestandscontrole en `hostedReady: false`. Het controleert geen volledige ruimtelijke juistheid, database/uploadkoppelingen, rechten of belasting; back-up/herstel controleert apart de database en gekopieerde bytes.

`npm run verify` voert tests, TypeScript en productiebuild uit. GitHub Actions herhaalt dit op Windows en Linux met Node 24. Tijdelijke ontwikkelbeelden opruimen: `npm run clean` toont de selectie; `npm run clean -- --apply` verwijdert uitsluitend `.playwright-mcp`, `test-results` en `huisdossier-*.png` in de projectroot. Privégegevens, dependencies, broncode en de gebouwde app blijven staan.

Publieke hosting, accounts, klantenrechten, automatische scans, automatische updates en een beheerde back-updienst zijn niet ingericht. Zie [productaudit](product-readiness.md) en [technische reviewkaart](maintenance-review.md).
