# Zon, omgeving en straatverlichting

Open **Licht & schaduw** boven de buiten- of binnenweergave. Zet de simulatie aan, kies een Nederlandse datum en tijd, en vergelijk dag en nacht. Binnen kijken gebruikt dezelfde lichtbronnen en dezelfde registratie als het buitenmodel. Beide inrichtingsstanden werken; ramen laten direct licht door, dichte muren, het plafond, meubels en gesloten deurvlakken werpen schaduw. In het open plattegrondbeeld blijft het plafond als onzichtbare schaduwgever aanwezig. Fototexturen op gevel en dak worden tijdelijk vervangen door neutraal materiaal om dubbel opgenomen schaduwen te vermijden.

## Bronnen en import

`npm run import:lighting -- <woning-id>` haalt lichtmastposities binnen 50 m op uit de [PDOK BGT OGC API](https://api.pdok.nl/lv/bgt/ogc/v1/collections/paal?f=json) en de WGS84-woningpositie via BAG. Verlopen registraties en beëindigde objecten worden verwijderd; dubbele versies delen één lokaal object-ID. Alle pagina's moeten verwerkt zijn. De import overschrijft een profiel pas na succesvolle bronaanvragen, maakt een vorige-profielkopie en bewaart eerder aangepaste scenario's per stabiel BGT-ID.

Het profiel en de ruwe BGT-bron staan uitsluitend in `data/lighting/<woning-id>/`; beide zijn privé en gitignored. De API bewaart uitsluitend gevalideerde scenariowaarden, houdt huizen gescheiden en serialiseert gelijktijdige profielbewerkingen. De dossierexport bevat het profiel met bronvermelding en ophaaldatum. De ruwe BGT-download blijft lokaal; de export bevat wel de gebruikte RD-posities en bron-URL.

De [gemeentelijke OVL-catalogus](https://open.utrecht.nl/dataset/ovl-utrecht/b708cede-ba8d-4de6-b83e-10671ae2b8c5) beschrijft objecttypen en locaties, maar verwijst naar CSV-bestanden uit 2021/2018. Bij controle op 20 november 2026 gaven deze downloads HTTP 403. Daarom worden armatuurtype, lichthoogte, lumen, kleurtemperatuur en dimschema **niet** als bevestigd beschouwd. Een BGT-objecttype `lichtmast` is geen armatuurmodel. Hoogtes gebruiken het benaderde straatniveau bij de woning; er is geen bron-z ingemeten.

## Berekening en weergave

- [SunCalc 2](https://github.com/mourner/suncalc) geeft graden en azimut met de klok mee vanaf noord. `src/lighting.ts` zet dit om naar Three.js met X oost, Y omhoog en -Z noord. Kalenderinvoer wordt expliciet in `Europe/Amsterdam` geïnterpreteerd, onafhankelijk van de browserzone. Niet-bestaande zomertijdtijden worden geweigerd; in het dubbele wintertijduur kiest de omzetting één tijdstip.
- De 3DBAG-omgeving levert schaduwgevers. Binnen wordt de inverse van de bestaande plan/RD-registratie gebruikt. Het eigen BAG-bovenvolume wordt boven het kamerplafond afgeknipt, zodat de ruwe gevel geen extra dichte wand achter de gemodelleerde ramen vormt. De registratie is een benadering, geen inmeting.
- Wanneer een profiel een gereconstrueerde buitenmantel gebruikt, volgt de binnenste schaduwcontext diezelfde mantel, dakhelling en lage achterbouw. Vervangen BAG-vlakken worden daar weggelaten. De clipping boven het kamerplafond en de benaderde plan/RD-registratie blijven gelden.
- Hoogte, lichtstroom, kleur en verdeling zijn per mast te verkennen en met **Bewaar lampprofiel** lokaal te bewaren. Wijzigingen geven direct een voorbeeld; herladen verwijdert onbewaarde wijzigingen. De lampen schakelen in als de zon onder de horizon staat. Er is geen echt schakelschema aangesloten.
- Maximaal drie straatlampen geven tegelijk licht: de gekozen mast en de dichtstbijzijnde overige masten. Alle geïmporteerde masten blijven zichtbaar. Dit begrenst het aantal schaduwberekeningen. De rondstralende variant gebruikt lumen / 4π; de neerwaartse variant een vereenvoudigde kegel van 160° met zachte rand. Dat zijn geen gemeten armatuurcurves.
- Omgevingsgeometrie wordt samengevoegd voor minder tekenopdrachten. Schaduwkaarten verversen alleen bij geometrie-, deur- of scenarioverandering. De normaalrichtingen van driehoeken volgen de bronringen, ongeacht triangulatie-as. Dit voorkomt omgekeerde normaaloffsets en schaduwstrepen.

## Grenzen

De omgeving reikt circa 45 m per richting rondom het huis. Verder gelegen schaduwgevers en bomen ontbreken. Vooral bij lage zon is dat onvolledig. Materialen, glas, gordijnen, montagehoek, IES/LDT-verdeling, strooilicht, reflecties tussen oppervlakken, bewolking, werkelijke lampsterkte en dimregime zijn niet gekalibreerd. Zon, hemel en bestaande binnenlampen hebben illustratieve helderheden; er is geen fysiek consistente dag/nachtbelichting of luxkaart. De schuif **Beeldbelichting** is alleen een beeldinstelling. Gebruik dit om richtingen en mogelijke lichtpaden te verkennen, niet om normconformiteit of lichthinder te bepalen.

De gedeelde BAG-buitenzijde omvat mogelijk meer woningen. Het uitgewerkte interieur blijft de aangeleverde woonlaag. De simulatie voegt geen verzonnen bovenverdiepingen toe aan het rondlopen.
