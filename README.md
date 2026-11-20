# Geokari Huisdossier

Een lokaal huisdossier met een inspecteerbaar 3D-gebouwmodel, foto's, documenten en onderhoud per onderdeel. Eerste casus: Koekoekstraat 17, **3514 CS Utrecht**.

## Starten

Node.js **24 of nieuwer** is nodig (SQLite zit in Node). Alle frontendbibliotheken en het Inter-lettertype staan lokaal; het model is alvast geïmporteerd.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. Voor een gebouwde versie:

```powershell
npm run build
npm start
```

De server luistert uitsluitend op de eigen computer. Er is nog geen account- of deelvoorziening voor netwerkhosting. Maak deze server niet publiek toegankelijk zonder authenticatie, autorisatie en een hosting/back-upplan.

## Wat werkt

- Het echte 3DBAG-pand draaien, zoomen, van boven bekijken, als draadmodel tonen en met/zonder omgeving inspecteren.
- Dak- en gevelvlakken aanklikken; onderdelen ook via de lijst kiezen.
- Eigen onderdelen aanmaken en bewerken; een plek op de buitenzijde markeren. Posities gebruiken RD + NAP, onafhankelijk van de viewer.
- Foto's en documenten toevoegen, terugvinden, bekijken en downloaden (25 MB per bestand).
- Onderhoud of een melding aan een onderdeel koppelen, dateren, afvinken en heropenen.
- Het volledige dossier exporteren, inclusief model, metadata en originele bestandsinhoud als base64 in één JSON-bestand.
- Op smalle schermen navigeren met het menu bovenaan.

## Wat het model voorstelt

Het adres is via het officiële BAG-verblijfsobject `0344010000061984` gekoppeld aan pand `0344100000021151`. Dat pand bevat **drie verblijfsobjecten**; het model toont de gedeelde buitenzijde, geen afbakening van alleen nummer 17.

De geometrie komt uit 3DBAG LoD 2.2, gebaseerd op BAG en AHN. Gevelkleuren zijn alleen een weergavestijl. Er zijn geen ramen, deuren, geveltexturen of binnenruimtes verzonnen. Het bovenaanzicht is een zicht op het gebouwmodel, geen ingemeten plattegrond. BAG-bouwjaar en gebruiksoppervlakte zijn registratiewaarden, geen eigen inmeting. De bestaande voorbeeldonderdelen komen uit de projectcontext; hun exacte locatie en toestelgegevens zijn onbekend totdat de bewoner ze invult.

**Attributie:** 3DBAG door TU Delft 3D geoinformation en 3DGI, [CC BY 4.0](https://docs.3dbag.nl/nl/copyright/). BAG via PDOK / Kadaster, Public Domain Mark 1.0. Bron-URL's, ophaaldatum en modelbeperkingen staan in het geïmporteerde JSON-bestand en in de app onder Bronnen & model. Geen Google Street View-data gebruikt.

## Projectindeling

```text
config/houses.json          Woningconfiguratie; geen adressen in de viewer hardcoderen
scripts/import-house.mjs    Verifieert VBO → pand en importeert echte open geometrie
public/data/                Reproduceerbare open brondata voor de viewer
public/brand/               Bestaande Geokari-assets en Inter met OFL-licentie
src/                       React/TypeScript-interface, viewer en geometrieconversie
server/                    Express-API en SQLite-opslag
tests/                     Integratietests voor bewaren, isolatie en export
docs/                      Architectuur en vervolgstappen
data/                      Privé runtimegegevens (gitignored)
```

## Data en back-ups

`data/huisdossier.sqlite` bevat het dossier; `data/uploads/` bevat originele bestanden. Deze map wordt nooit aan Git toegevoegd. `HUISDOSSIER_DATA_DIR` kan een andere absolute opslagmap aanwijzen. De UI gebruikt geen localStorage als primaire opslag.

Maak een export via **Exporteer dossier**, of stop de server en kopieer de volledige `data/`-map als consistente back-up. Een volledige JSON-export bevat alle bestanden en kan daardoor groot worden. Een herstelknop voor JSON-exports is nog niet gebouwd; voor direct herstel met deze versie gebruik je een kopie van de volledige `data/`-map. Modeldata onder `public/data/` is openbare brondata, niet de privé-inhoud van het dossier.

## Een volgend huis

Voeg een woning met een eigen `id`, BAG-verblijfsobject-ID, adres en RD-punt toe aan `config/houses.json` en voer uit:

```powershell
npm run import:house -- woning-id
```

Herstart de server. Het tweede huis krijgt eigen records en bestanden; API-toegang wordt per woning begrensd. Je kunt per woning eigen `starterAssets` configureren; ventilatie, elektriciteitskast en oven zijn alleen voor Koekoekstraat ingesteld. Dit is een herbruikbare lokale app, nog geen platform voor meerdere accounts.

Een herimport vervangt alleen het openbare gebouwmodel. Dossierrecords en bestandskoppelingen gebruiken vaste onderdeel-ID's en blijven bestaan. Handmatige markeringen blijven op RD/NAP-coördinaten staan; controleer ze bij een gewijzigd model.

## Controleren

```powershell
npm test
npm run build
```

De integratietests gebruiken een tijdelijke database. Ze controleren het bewaren na heropenen, upload/download, export met originele inhoud, datavalidatie en scheiding tussen twee huizen.

Geokari-stijl: Inter, logo uit de eigen brandmap, navy `#1F2B35`, oranje `#F8891E` en crème `#F6F2E7`; Lucide-iconen. Geen externe fonts of trackers.
