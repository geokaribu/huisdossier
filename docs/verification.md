# Verificatie eerste versie

Gecontroleerd op 20 november 2026, lokaal op Windows met Node 24.

- `npm test`: vier tests geslaagd. Bewaren na heropenen, bestandsinhoud, volledige export, huisisolatie, ongeldige invoer, BAG-geometrie, doorlopende gevel-UV's en lokale textuurexport gecontroleerd.
- `npm run build`: TypeScript en productiebuild geslaagd. De 3D-viewer wordt apart geladen; de standaard bundelgroottewaarschuwing voor Three.js is bekend (ongeveer 150 kB gzip).
- Browser, productieversie op aparte testdatabase: onderdeel maken, melding maken/uitvoeren, foto en document uploaden, foto openen, export downloaden, herladen en data terugvinden geslaagd.
- Interactieve geometrie: gevel aanklikken, dak kiezen, punt vastleggen, bovenaanzicht, omgeving en draadmodel gecontroleerd.
- Desktop en 390 px breed: geen horizontale pagina-overloop; navigatie en broninformatie werken. Geen browserconsolefouten tijdens deze controles.

Testgegevens blijven buiten de eigen runtimegegevens en buiten Git. Er is geen publieke server/publicatie, fotorealistische scan of ingemeten binnenruimte opgeleverd.
