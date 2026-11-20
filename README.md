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
- **Binnen kijken**: een open 3D-overzicht van de aangeleverde woonlaag, kamerkeuze en rondlopen met WASD/pijltjes of de loopknoppen. Sleep om te kijken; Escape keert terug naar het overzicht. Muren en vaste inrichting begrenzen het lopen; deuropeningen zijn doorgangen.

## Wat het model voorstelt

Het adres is via het officiële BAG-verblijfsobject `0344010000061984` gekoppeld aan pand `0344100000021151`. Dat pand bevat **drie verblijfsobjecten**; het model toont de gedeelde buitenzijde, geen afbakening van alleen nummer 17.

De oorspronkelijke geometrie komt uit 3DBAG LoD 2.2, gebaseerd op BAG en AHN. Het bovenaanzicht is een zicht op het gebouwmodel, geen ingemeten plattegrond. BAG-bouwjaar en gebruiksoppervlakte zijn registratiewaarden, geen eigen inmeting. De bestaande voorbeeldonderdelen komen uit de projectcontext; hun exacte locatie en toestelgegevens zijn onbekend totdat de bewoner ze invult.

**Attributie basisgeometrie:** 3DBAG door TU Delft 3D geoinformation en 3DGI, [CC BY 4.0](https://docs.3dbag.nl/nl/copyright/). BAG via PDOK / Kadaster, Public Domain Mark 1.0. Bron-URL's, ophaaldatum en modelbeperkingen staan in het geïmporteerde JSON-bestand en in de app onder Bronnen & model.

## Lokale gevelafwerking

Een optioneel profiel onder `data/appearance/<woning-id>/profile.json` koppelt een lokaal gevelbeeld aan één RD/NAP-projectievlak. De textuur loopt door over alle coplanaire voorgevelvlakken; de zijkanten krijgen een aparte, indicatieve materiaalafwerking. Zet **Gevelafwerking** uit om de oorspronkelijke BAG-geometrie en basiskleuren te bekijken. De knop met het huisje toont de voorgevel.

De extra dakclose-ups verfijnen de voorzijde tot een zinken dakvlak met twee dakramen en een terugliggend middenbalkon. `src/roof.ts` maakt echte openingen in de dakgeometrie, met raamkozijnen, balkonvloer, zijwanden, deur achter een indicatief scherm, metalen hekwerk en houten zonwering. De raam- en balkonmaten komen uit het privéprofiel en zijn visueel geschat. **Bekijk het dak van dichtbij** kadert deze onderdelen in. Een oorspronkelijke voorgevel die boven de goot doorloopt wordt in de afwerkingsstand op de goothoogte afgeknipt; de brongeometrie blijft intact en is volledig zichtbaar met de afwerking uit of in draadmodel.

Voor de eigen woning is een AI-gecorrigeerd gevelbeeld gemaakt uit twee door de gebruiker aangeleverde Google Maps-screenshots. Het is een visuele reconstructie, geen ongewijzigde foto of inmeting. Bedekte delen zijn aangevuld. De zinken voorste dakhelling, dakramen, het terugliggende balkon, hekwerk en zonwering zijn visueel benaderd uit deze beelden. Een echte [PDOK RGB-luchtfoto](https://www.pdok.nl/ogc-webservices/-/article/pdok-luchtfoto-rgb-open-) wordt op de bovenzijde van het dak geprojecteerd met het RD-bereik van de WMS-aanvraag. De luchtfoto bevat belichting en schaduwen; dakobjecten in de foto zijn daarmee nog geen losse 3D-objecten. Kleine reliëfdetails en zijgevels zijn indicatief. De oorspronkelijke brongeometrie blijft intact. De decoratieve dakvariant gebruikt een expliciete lijst bronvlakken; controleer het profiel en die indices opnieuw na een modelherimport.

Het gevelbeeld, de parameters, de promptnotitie en de bronattributie blijven in de genegeerde `data/`-map. Ze worden niet naar GitHub gepusht. Een verse checkout bevat daarom geen privé-gevelbeeld. De volledige dossierexport bevat het profiel en de originele textuurbestanden; de open-datalicentie van 3DBAG wordt niet op die beelden toegepast. De API biedt uitsluitend bestanden aan die bij het gekozen huisprofiel horen.

## Interieur uit een plattegrond

Een optioneel privéprofiel staat in `data/floorplans/<woning-id>/plan.json`. De generieke viewer gebruikt kamerpolygonen, wandsegmenten met deur- en raamopeningen, vaste inrichting en beginposities in lokale meters. Dit profiel gaat mee in de dossierexport. Het wordt niet in Git opgeslagen of automatisch uit een afbeelding gegenereerd.

De aangeleverde verkoopplattegrond is handmatig overgetrokken en geschaald op de vermelde tuinbreedte van 3,70 m. De plafondhoogte van 2,64 m staat bij de woonkamer; dezelfde hoogte in andere kamers is een aanname. Kameroppervlakken zijn de labels op de tekening. Keuken, kasten, sanitair en trap volgen de getekende posities; kleuren en afwerking zijn indicatief. Alleen deze ene woonlaag is uitgewerkt. De trap is context, geen toegang tot een verzonnen verdieping. Het interieur heeft nog geen ingemeten registratie op het buitenmodel en vervangt de BAG-oppervlakte niet. Kamerkeuze verplaatst de kijker direct naar een vrije beginplek; met de loopbediening beweeg je door de openingen.

Voor een ander huis voeg je een eigen privéprofiel toe. Het formaat wordt gevalideerd in `server/floorplan.mjs`; rendercode bevat geen woningindeling. Ruimtes in deze eerste interieurversie zijn nog geen automatische dossieronderdelen.

Eigen foto's verfijnen het terras met grote grijze tegels, crèmekleurige wanden en klimop, een ronde houten klaptafel, donkere stoelen, plantenrek, potten en regenpijp. De glazen achterpui heeft een vast zijlicht en twee naar buiten openslaande deuren, met lichte verf binnen en dezelfde blauwgrijze kleur als de voordeur buiten. **Terrasdeuren openen/sluiten** wisselt de stand; gesloten deuren, vast glas en open deurvleugels houden de kijker tegen. Een deur wordt niet verplaatst als die in de nieuwe stand door de kijker zou gaan. Dit is een visuele reconstructie; exacte maten en kleuren zijn benaderingen.

`src/terrace.ts` bouwt herbruikbare 3D-objecten. Tegels, wandafwerking, begroeiing, meubilair, kijkrichting en deurparameters komen uit het privéprofiel. Tegelafmetingen, losse objecten en begroeiing zijn afzonderlijk instelbaar. De bladgeometrie gebruikt instancing; een stilstaand beeld wordt niet telkens opnieuw gerenderd. Alle nieuwe profielvelden blijven behouden in de dossierexport.

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
