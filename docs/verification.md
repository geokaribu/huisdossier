# Verificatie eerste versie

Gecontroleerd op 20 november 2026, lokaal op Windows met Node 24.

- `npm test`: zeven tests geslaagd. Bewaren na heropenen, bestandsinhoud, volledige export, huisisolatie, ongeldige invoer, BAG-geometrie, doorlopende gevel-UV's, luchtfoto-UV's, loopbotsingen, doorgangen en privéprofielen gecontroleerd.
- `npm run build`: TypeScript en productiebuild geslaagd. De 3D-viewer wordt apart geladen; de standaard bundelgroottewaarschuwing voor Three.js is bekend (ongeveer 150 kB gzip).
- Browser, productieversie op aparte testdatabase: onderdeel maken, melding maken/uitvoeren, foto en document uploaden, foto openen, export downloaden, herladen en data terugvinden geslaagd.
- Interactieve geometrie: gevel aanklikken, dak kiezen, punt vastleggen, bovenaanzicht, omgeving en draadmodel gecontroleerd.
- Desktop en 390 px breed: geen horizontale pagina-overloop; navigatie en broninformatie werken. Geen browserconsolefouten tijdens deze controles.

Testgegevens blijven buiten de eigen runtimegegevens en buiten Git. Er is geen publieke server/publicatie, fotorealistische scan of ingemeten binnenruimte opgeleverd.

Interieurcontrole: negen ruimtes/gebieden uit het privéprofiel hebben een vrije beginplek. Een rastercontrole met dezelfde botsingsregels bereikt alle kamerposities vanuit de hal, inclusief de tuin. In de browser verandert de positie bij WASD en de zichtbare loopknoppen; Escape herstelt het overzicht. Kamerkeuze en slepen om rond te kijken werken. Desktop 1440 px en smal scherm 390 px gecontroleerd op bediening en pagina-overloop. Een kunstmatig verstuurd pointer-event zonder actieve pointer gaf tijdens het testen een pointercapture-fout; de proef met een echte pointer en ingedrukte knop werkt. De actuele luchtfoto is in het bovenaanzicht op het dak gecontroleerd.
