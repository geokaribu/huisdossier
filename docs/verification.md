# Verificatie eerste versie

Gecontroleerd op 20 november 2026, lokaal op Windows met Node 24.

- `npm test`: veertien tests geslaagd. Bewaren na heropenen, bestandsinhoud, volledige export, huisisolatie, ongeldige invoer, BAG-geometrie, doorlopende gevel-UV's, luchtfoto-UV's, loopbotsingen, doorgangen en privéprofielen gecontroleerd. Extra controles: vaste glaspanelen, open/gesloten deurvleugels, gedraaide meubelcontouren en behoud van terrasparameters in API/export.
- `npm run build`: TypeScript en productiebuild geslaagd. De 3D-viewer wordt apart geladen; de standaard bundelgroottewaarschuwing voor Three.js is bekend (ongeveer 150 kB gzip).
- Browser, productieversie op aparte testdatabase: onderdeel maken, melding maken/uitvoeren, foto en document uploaden, foto openen, export downloaden, herladen en data terugvinden geslaagd.
- Interactieve geometrie: gevel aanklikken, dak kiezen, punt vastleggen, bovenaanzicht, omgeving en draadmodel gecontroleerd.
- Desktop en 390 px breed: geen horizontale pagina-overloop; navigatie en broninformatie werken. Geen browserconsolefouten tijdens deze controles.

Testgegevens blijven buiten de eigen runtimegegevens en buiten Git. Er is geen publieke server/publicatie, fotorealistische scan of ingemeten binnenruimte opgeleverd.

Wandafwerking: veertien tests geslaagd, inclusief een raycastcontrole op afzonderlijke wandzijden, onder-/bovenkleur en vrijgehouden deuropeningen. Wandkleuren en sierlijst blijven behouden in API en export. Gang en straatslaapkamer zijn visueel gecontroleerd op desktop en 390 px; geen consolefouten of horizontale overloop. Verfkleuren en lijsthoogte zijn uit bewonersfoto's benaderd.

Terrascontrole: bij gesloten deuren stopt lopen vanuit de woonkamer vóór de pui; na openen bereikt dezelfde looproute het terras. De vaste ruit en beide open vleugels hebben een contour voor botsingen. Alle negen kamerbeginpunten blijven vrij en bereikbaar met de geplaatste meubels. Op 390 px werken de deurknop en loopknoppen zonder horizontale overloop. Geen browserconsolefouten tijdens de laatste controles. De export bevat de zeven terrasobjecten en het deurprofiel.

Interieurcontrole: negen ruimtes/gebieden uit het privéprofiel hebben een vrije beginplek. Een rastercontrole met dezelfde botsingsregels bereikt alle kamerposities vanuit de hal, inclusief de tuin. In de browser verandert de positie bij WASD en de zichtbare loopknoppen; Escape herstelt het overzicht. Kamerkeuze en slepen om rond te kijken werken. Desktop 1440 px en smal scherm 390 px gecontroleerd op bediening en pagina-overloop. Een kunstmatig verstuurd pointer-event zonder actieve pointer gaf tijdens het testen een pointercapture-fout; de proef met een echte pointer en ingedrukte knop werkt. De actuele luchtfoto is in het bovenaanzicht op het dak gecontroleerd.

Dakcontrole: twee glasopeningen en de balkonuitsparing met raycasts gecontroleerd; geen zinken dakvlak achter de openingen. Het dakprofiel inclusief ramen en terugliggend balkon blijft behouden in API en export. De nieuwe knop voor dakdetail, de originele geometrie met afwerking uit, en een smal scherm zijn in de browser gecontroleerd.

Gecombineerd buitenmodel: gevelopeningen met raycasts, negdiepte, dorpels, expliciete plattegrondtransformatie, lage achterbouw en dakobjecten getest. De originele BAG-oppervlakken en invoerplattegrond blijven ongewijzigd. De API/export bewaart de plaatsing, gevelparameters en dakdetails. De negen beginpunten blijven vrij en bereikbaar na plaatsing van de woonkamermeubels.

De gemeentelijke luchtfoto is als PNG van 1600 × 1600 pixels voor 40 × 40 m opgehaald. De live WMS-metadata meldt 25 mm bronresolutie en opname 8 april 2026. De nieuwe metadata blijft behouden in de bestaande API/export-test. Bovenaanzicht, voorgevel en achterbouw visueel gecontroleerd met de nieuwe foto. Alle vijf aanzichten, afwerking uit, draadmodel, overgang naar binnen en terrasdeuren werken op 390 px zonder pagina-overloop of consolefouten. Het profiel bevat nu elf terras- en woonkamerobjecten.
