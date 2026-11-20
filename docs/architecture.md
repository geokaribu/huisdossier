# Eerste versie: lokaal huis inspecteren

## Besloten scope

Bron: gesprek met Karian/Kilian op 20 november 2026; het voorstel om een eerste inspecteerbare versie te maken is geaccepteerd. Eigen gebruik; Geokari-huisstijl. Bestaande conceptcontext: database eerst, geen permanente IoT, eigen huis gevolgd door het huis van de ouders.

De versie levert de geverifieerde buitenzijde van het pand, dossieronderdelen, originele bestanden en onderhoud. Aanvullende privéprofielen leveren een visuele gevel- en dakafwerking en één woonlaag uit de aangeleverde plattegrond. Deze aanvullende reconstructies zijn geen ingemeten geometrie.

Aanvulling 20 november 2026: de gebruiker heeft twee gevelbeelden aangeleverd. Een apart lokaal afwerkingsprofiel projecteert een AI-gecorrigeerd frontbeeld op de bestaande voorgevel. Zijmaterialen, cornice en een opgeschoonde mansardedak/dakkapelvariant zijn visuele benaderingen. Het profiel kan worden uitgeschakeld; de originele brongeometrie wordt niet overschreven. Afwerking en attributie blijven privé in `data/appearance/` en gaan mee in de dossierexport. Deze laag staat los van de feitelijke BAG-gegevens en van toekomstige ingemeten geometrie.

## Structuur

Een tweede aanvulling op 20 november 2026 gebruikt een PDOK-luchtfoto op dakvlakken en een handmatig overgetrokken plattegrond als los interieur. Beide profielen blijven in de privémap en in de volledige export. `InteriorViewer.tsx` leest uitsluitend profielgeometrie; `walkthrough.ts` verzorgt botsingen met wanden, doorgangen, vaste inrichting en de buitengrens. Kleine bewegingsstappen voorkomen dat een vertraagd frame een muur overslaat. De loopstand werkt met toetsen, slepen en zichtbare aanraakknoppen. De woonlaag is niet ingemeten gekoppeld aan het BAG-buitenmodel; er zijn geen andere verdiepingen afgeleid. De bron en aannames zijn vanuit de interface leesbaar.

Een Node-proces serveert de lokale API en de webinterface. React/TypeScript verzorgt de interface; Three.js verzorgt alleen de weergave. Express valideert mutaties met Zod. Node SQLite bewaart records en losse bestanden bewaren de originelen. De keuze voor SQLite maakt deze versie eenvoudig op één computer te gebruiken; netwerkhosting of meerdere accounts vraagt een apart ontwerp en is geen impliciete vervolgfunctionaliteit.

De gegevensrelatie is `woning → onderdeel → bestanden / onderhoud`. Een onderdeel heeft een vast ID en optioneel een RD/NAP-positie. Een ruimteonderdeel kan met een vaste `room_id` aan de plattegrond worden gekoppeld. De viewer bezit geen dossierinhoud. Daarmee kan een later GLB- of splatmodel dezelfde dossierkoppelingen gebruiken.

De importer controleert het BAG-verblijfsobject, volgt de officiële pandrelatie en haalt dat exacte pand op bij 3DBAG. Bij een onduidelijke meervoudige pandrelatie stopt de import. CityJSON-oppervlakken behouden hun semantiek; RD/NAP-coördinaten worden in de viewer lokaal rond het huis verschoven om precisieverlies te voorkomen. Concave vlakken en gaten worden via vlakprojectie en Earcut getrianguleerd.

## Grenzen en vervolgstappen

Het dossier heeft nu een eigen ingang naast het 3D-model. Ruimteonderdelen verwijzen met `room_id` naar het privéplattegrondprofiel; dezelfde ID laat de gebruiker van kamer naar dossier en terug gaan. De viewer blijft onafhankelijk van documentinhoud. De nieuwe dossierpagina en documentreader zijn afzonderlijke React-componenten.

De ingerichte en oningerichte weergave komen uit hetzelfde privéplattegrondprofiel. De gedeelde pure functie `floorplanForView` filtert losse decoratie voor rendering én loopbotsingen. Keukenonderdelen, regenpijp en trapnis blijven standaard staan; kledingkasten verdwijnen standaard. `fixed` kan de classificatie bij decoratie en fixtures overschrijven, bijvoorbeeld voor een bevestigde inbouwkast. Bij de trapnis laat `contents: false` alleen de vaste ombouw en plank staan. Wanden, afwerking, ramen, deuren, sanitair, kamer-ID's en dossierkoppelingen veranderen niet. Camerapositie en deurstand blijven behouden bij wisselen; als een teruggezet meubel de looppositie bezet, wordt een vrije kamerpositie gebruikt.

`GET /api/houses/:id/floorplan?view=unfurnished` geeft de afgeleide variant; zonder parameter blijft de oorspronkelijke ingerichte plattegrond beschikbaar. De export behoudt het oorspronkelijke `floorplan`-veld en voegt beide plannen toe onder `floorplanVariants`. Er wordt geen tweede bronbestand bijgehouden dat uit de pas kan lopen. Alleen de weergavevoorkeur staat per woning in browseropslag; de plattegrond blijft privédata op schijf.

SQLite-migratie 2 voegt ruimtekoppelingen, documentmetadata/zoektekst, taakmetadata en importsnapshots toe zonder bestaande records te vervangen. De leeslijst bevat geen volledige documenttekst; inhoud zoeken en lezen gebruikt aparte huisgebonden endpoints. Tekst wordt veilig als tekst/React-elementen weergegeven, nooit als door de gebruiker aangeleverde HTML. PDF-originelen krijgen een expliciete lokale preview; andere originelen blijven downloads. Nieuwe tekstuploads worden lokaal geïndexeerd, binaire extractie is een expliciete importstap.

De documentimport gebruikt vaste sleutels en inhoudschecksums. Herhalen behoudt eigen bewerkingen en afgeronde taken. Bronbestanden, manifest, samenvattingen en tekstextracties blijven uitsluitend in de privéopslag. Onbekende deadlines blijven leeg; bronstatus en verantwoordelijkheid zijn los van de open/afgerond-status bewaard. Dit voegt geen automatische herhaling, herinneringsdienst of externe synchronisatie toe.

1. Eerste inspectie met bewoners: model en adresrelatie beoordelen, oorspronkelijke tekeningen en gevelbeelden verzamelen.
2. Foto's van ventilatie, elektriciteitskast en oven toevoegen; merk/type en echte plek vastleggen.
3. De uitgewerkte plattegrond en ruimtekoppelingen controleren met de bewoners; maten en materialen ter plaatse verifiëren.
4. Eén ruimte of gevel met eigen opnames reconstrueren; fotogrammetrie en splats vergelijken op uiterlijk, bestandsomvang en browsergebruik.
5. Back-upherstel via export, versiegeschiedenis en overdracht uitwerken voordat data op een gedeelde server komt.

Er is geen geclaimde meetnauwkeurigheid. Een punt dat een bewoner aanwijst is een markering, geen inmeting. Open-data-opnamedatum, ophaaldatum en privé-onderhoudsdatum worden afzonderlijk bewaard.

De aanvullende buitenlaag koppelt de bestaande woonlaag nu bij benadering aan de straatgevel. `houseEnvelope.ts` gebruikt de expliciete private schaal/ankerregistratie voor de achterbouw, pui en het terras. De foto-interpretatie van de woonkamer gebruikt dezelfde objecten binnen en buiten. Oorspronkelijke bronvlakken worden alleen in de afwerkingsstand verborgen; openbare geometrie en vaste dossier-ID's blijven behouden.

De eerdere PDOK-daktextuur is vervangen door een Utrechtse WMS-uitsnede op de oorspronkelijke 25 mm pixelresolutie (actuele laag: opname 8 april 2026). De aanvraag bewaart exact RD-bereik en pixelafmetingen. De live servicemetadata is leidend voor de opnamedatum; de catalogusbeschrijving van de actuele laag liep bij ophalen nog achter. Aerial-profielen bewaren optioneel bronresolutie, opnamedatum, metadata-URL, licentie en toelichting, zonder die velden te verliezen bij API/export. Dakobjecten blijven afzonderlijke visuele interpretaties.

Wandkleuren staan per zijde en lengtebereik in het private plattegrondprofiel. `wallCoatings.ts` bekleedt uitsluitend bestaande massieve wandstukken: deuropeningen blijven vrij, de andere zijde van een gedeelde wand houdt haar eigen kleur. Een optionele onderkleur met hoogte en sierlijst maakt tweekleurige gangen mogelijk. Kozijnkleuren en effen vloerkleuren zijn eveneens optioneel per opening/ruimte; de bestaande standaardafwerking blijft de terugvaloptie.

`utilityNiche.ts` bouwt een herbruikbare trapnis met apparaten, schuine betimmering en opslag uit een privaat decoratieprofiel. De bestaande gedraaide meubelcontour houdt de looproute vrij van de nis. Voor smalle ruimten kan het profiel een ruimere begin-kijkhoek instellen (`viewFov`); kamerwissels herstellen hun eigen kijkhoek en het overzicht gebruikt weer de standaardlens. Afmetingen en plaatsing uit foto's blijven benaderingen.

Tuinwanden kunnen via `outsideRoomId` expliciet bij een buitenruimte horen, ook zonder klimplanten. Dezelfde wand en tuinobjecten verschijnen in de binnen- en buitenweergave. `openDoorLeaves` deelt de deurvleugelposities tussen loopbotsingen en de kleine plattegrond: de deurknop wijzigt het 3D-model en de 2D-opening tegelijk. De beginstand komt uit het private deurprofiel.

Wandbekleding heeft optioneel een textuurbestand, fysieke herhaalmaat, attributie en AI-aanduiding. UV's volgen de lengte/hoogte van de wand en lopen door over onderbroken wandstukken, ook aan de andere zijde. Texturen blijven per woning onder `data/floorplans/` en worden uitsluitend via gevalideerde bestandsnamen uit het eigen profiel aangeboden. De lees-API geeft daarvoor een huisgebonden URL; de export houdt het ruwe profiel en de bytes apart in `floorplanFiles`. De buitenviewer deelt de bekende lage binnenwanden en afwerking achter de pui. De aanvullende zit-/eetmeubels en keuken hebben herbruikbare geometrie; plaatsing en visuele interpretaties blijven privaat.
