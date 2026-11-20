# Huisdossier: structuur en vormgeving

Gecontroleerd en bijgewerkt op 20 november 2026. Dit document beschrijft de werkende interface, de ontwerpkeuzes en de uitgevoerde review. Het is geen verklaring van volledige WCAG-conformiteit.

## Richting

- **Product:** bewoners vinden informatie, documenten en onderhoud terug bij een plek of onderdeel van hun woning.
- **Karakter:** rustig, precies en vertrouwd.
- **Wereld:** een werkdossier bij de plattegrond van je eigen huis.
- **Visueel middelpunt:** de echte woning en de eigen foto's; navigatie en panelen blijven terughoudend.
- **Herkenning:** dezelfde ruimte of hetzelfde onderdeel verbindt dossier, documenten, onderhoud en de ruimtelijke weergave.

De oorspronkelijke Huisdossier-conceptnotitie in de second brain beschrijft plaatsgebonden kennis als kern. De recente bewonersvragen voegen een uitgewerkt 3D-model toe. Daarom zijn dossier en ruimtelijke weergave beide rechtstreeks bereikbaar; documenten beheren vereist geen handeling in 3D.

## Navigatie en hoofdtaken

De woningselector bovenaan bepaalt het actieve dossier. De navigatie groepeert de pagina's op hun taak:

| Groep            | Pagina              | Gebruik                                                           |
| ---------------- | ------------------- | ----------------------------------------------------------------- |
| Dossier          | Overzicht           | Onderdeel vinden en de gekoppelde informatie bekijken             |
| Dossier          | Documenten & foto's | Bestanden zoeken, lezen, bekijken en downloaden                   |
| Dossier          | Onderhoud           | Open, uitgevoerde, wachtende en te controleren meldingen opvolgen |
| Woning verkennen | Buiten bekijken     | Gevel, dak en gebouw inspecteren                                  |
| Woning verkennen | Binnen kijken       | Ruimte kiezen, rondlopen en het ruimtedossier openen              |
| Achtergrond      | Bronnen & model     | Herkomst, detailniveau en aannames controleren                    |

De paginatitel noemt de huidige taak. Het adres staat in de woningselector. Exporteren staat als secundaire actie in de bovenbalk. De primaire toevoegactie hoort bij de pagina: onderdeel, bestand of melding. Een modelpagina heeft daardoor geen algemene uploadknop naast de titel.

```mermaid
flowchart LR
  W[Woning kiezen] --> D[Onderdeel zoeken of kiezen]
  D --> I[Informatie en historie]
  I --> F[Document lezen of toevoegen]
  I --> T[Melding bekijken of toevoegen]
  I --> R[Ruimte in 3D bekijken]
  R --> I
```

Op desktop staat de gegroepeerde onderdelenlijst naast de geselecteerde inhoud. Ruimtes, gebouw, installaties en onderwerpen zijn uitklapbaar en doorzoekbaar. Op schermen tot 850 px vervangt een compacte native keuzelijst deze kolom. Na een keuze komt de inhoud in beeld.

De URL bewaart woning, pagina en gekozen onderdeel. De bestands- en onderhoudspagina bewaren ook zoekterm en relevante filters. Component-ID's uit een ander huis worden geweigerd. Een woningwissel wist de vorige selectie en opent het eigen buitenmodel. De terugknop herstelt de eerdere pagina en selectie.

## Ruimtelijke selectie als dossieringang

Een dak of gevel aanklikken houdt de buitenweergave open en selecteert het bijbehorende informatiepaneel. Oranje randen maken de selectie ook op de verfijnde geometrie zichtbaar. Een aanwijzer toont de naam vóór het klikken. Het overzicht toont notities, previews van maximaal drie gekoppelde bestanden en drie onderhouds-/historieregels; de tabs bevatten de volledige gekoppelde lijsten. **Volledig dossier bekijken** opent dezelfde vaste onderdeel-ID op de dossierpagina. Nieuwe bestanden/meldingen uit het paneel horen standaard bij dat geselecteerde onderdeel.

Op schermen tot 1000 px krijgt de paneeltitel na een modelklik focus en komt het paneel in beeld. **Terug naar 3D** gaat terug naar de viewer. De native onderdeelselector is een gelijkwaardige bediening zonder nauwkeurig aanwijzen. Interieur: een korte klik op een gekoppelde ruimte in het open overzicht of op de kleine plattegrond opent het ruimtedossier. De bestaande kamerknoppen blijven de ingang om rond te lopen; slepen in loopstand opent geen dossier.

Dit is selectie van het bestaande gezamenlijke dak-/geveldossier en van gekoppelde ruimtes. Afzonderlijke dakvlakken, gevelzijden, elk raam of ieder meubel zijn geen automatisch aangemaakte dossierobjecten. Dezelfde semantische koppeling kan later expliciete object-ID's gebruiken; de renderer verzint die inhoud niet.

Voor deze aanvulling:

```mermaid
flowchart LR
  K[Klik bronvlak] --> T[Onderdeel selecteren]
  T --> C[Aantallen en tabs]
  R[Kamer kiezen] --> L[Rondlopen]
  L --> D[Aparte Dossier-knop]
```

Gecontroleerde nieuwe bediening:

```mermaid
flowchart LR
  K[Klik zichtbaar onderdeel of kies uit lijst] --> S[Vaste dossier-ID en selectierand]
  S --> I[Notities, bestanden en onderhoud in paneel]
  I --> V[Volledig dossier van hetzelfde onderdeel]
  I --> A[Bestand of melding bij dit onderdeel toevoegen]
  R[Klik gekoppelde ruimte of plattegrond] --> D[Ruimtedossier]
```

Gecontroleerd op 20 november 2026; code in `spatialSelection.ts`, `Viewer.tsx`, `InteriorViewer.tsx` en `main.tsx`. Details van de browserproeven staan in [verificatie](verification.md).

## Vormgeving

| Rol                | Waarde                                                        |
| ------------------ | ------------------------------------------------------------- |
| Hoofdkleur / tekst | Navy `#1F2B35`                                                |
| Primaire actie     | Oranje `#F8891E`, met navy tekst                              |
| Woningweergave     | Crème `#F6F2E7`                                               |
| Werkruimte         | `#F7F8F7`, witte inhoudsvlakken `#FFFFFF`                     |
| Secundaire tekst   | `#52616B`; metadata `#5F6D76`                                 |
| Tekstacties        | Inktblauw `#304E60`, onderstreept                             |
| Scheiding          | `#DCE1E3`; invoerranden `#7E8A91`                             |
| Lettertype         | Lokaal Inter, hoofdzakelijk 400/500, 600 voor beperkte nadruk |
| Iconen             | Lucide; navigatie 18 px, tekstacties 16 px                    |
| Ritme              | 4/8 px; paginamarge 32 px desktop, 24 px tablet, 16 px mobiel |

Navy tekst op oranje heeft ongeveer 5,90:1 contrast. Wit op dit oranje heeft ongeveer 2,45:1 en wordt niet als knoptekst gebruikt. Deze waarden zijn opnieuw berekend uit relatieve luminantie; de oudere contrasttabel in de merknotitie is geen betrouwbare meetbron.

Selectie in de navigatie gebruikt een rustige navy tint met een kleine oranje markering. Oranje is vooral voor de primaire actie. Getallen krijgen tabulaire cijfers. Inhoud krijgt meer ruimte dan navigatie. Kaders scheiden functionele werkvlakken; niet ieder gegeven krijgt een eigen kaart.

### Kleuranalyse en verfijning, 20 november 2026

De richting blijft een zorgvuldig, rustig en persoonlijk woningdossier. De visuele wereld is bouwtekening en dossierpapier: navy voor houvast, neutrale werkvlakken voor langdurig gebruik, crème rond de woningweergave en een kleine oranje markering bij de actieve keuze. De echte woning, foto's en 3D-details dragen de rijke kleur. Dit is een gerichte verfijning van Geokari, geen vervanging van logo, lettertype of ruimtelijke materialen.

De audit vond verspreide kleurdefinities in vier stylesheets, veel bijna gelijke grijsgroene metadatakleuren, bruine tekstacties die op lange lijsten te veel nadruk kregen, zwakke invoerranden en één amberkleur voor meerdere onderhoudsstatussen. De kleurwaarden zaten bovendien zowel in de basisstijl als de werkruimtestijl. De oplossing gebruikt één palet in `src/design-tokens.css`, met vaste rollen voor tekst, oppervlakken, interactie en status. 151 bestaande kleurwaarden zijn in de eerste stap naar deze rollen vertaald; de overige vaste interfacekleuren zijn daarna eveneens gecentraliseerd. Gespecialiseerde 3D-bronkleuren zijn niet opnieuw ingekleurd.

| Combinatie / rol                         | Gemeten contrast | Toepassing                                                                         |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Navy `#1F2B35` op wit                    | 14,43:1          | Hoofdtekst en titels                                                               |
| Secundair `#52616B` op wit               | 6,40:1           | Ondersteunende tekst                                                               |
| Metadata `#5F6D76` op wit / crème        | 5,34:1 / 4,77:1  | Bronvermelding, datums en voettekst                                                |
| Tekstactie `#304E60` op wit              | 8,81:1           | Links met onderstreping; hover wordt navy                                          |
| Navy op Geokari-oranje                   | 5,90:1           | Hoofdactie; witte tekst op dit oranje haalt 2,45:1 en wordt hiervoor niet gebruikt |
| Invoerrand `#7E8A91` op wit / werkruimte | 3,54:1 / 3,33:1  | Velden, keuzelijsten en zoekbalken                                                 |
| Selectierand `#A4601B` op selectievlak   | 4,49:1           | Herkenbare gekozen invoersoort / onderdeel, geen kleine tekstkleur                 |

De verhoudingen zijn berekend uit sRGB-luminantie, vóór afronding getoetst. [W3C tekstcontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) vraagt voor gewone tekst minimaal 4,5:1; [niet-tekstcontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) behandelt essentiële besturings- en toestandskenmerken met 3:1. Een scheidingslijn is iets anders dan een invoerrand: rustige lijnen tussen inhoudsvlakken hoeven geen formulierfunctie te suggereren.

De kleurrollen zijn ook functioneel doorgetrokken: **Open** krijgt warm amber, **Wacht op** een neutrale tint, **Controleren** gedempt blauw en **Afgerond** groen. De tekst blijft de betekenis noemen. Zoek- en formulierfocus gebruikt navy op lichte vlakken; in de donkere navigatie krijgt toetsenbordfocus oranje. Checkboxes en lichtschuiven gebruiken navy voor de bedienbare indicator. Hoofdknoppen hebben een vaste hover-/druktoestand; gewone tekstacties concurreren minder met die knoppen.

De typografie behoudt Inter: paginatitels 30 px op desktop en 26 px op mobiel, gewone hoofdknoppen 14 px en 44 px hoog, metadata overwegend 12 px. Kleine koppen krijgen geen negatieve letterspatiëring. Mobiele invoer en planningkeuzes gebruiken 16 px tekst. Controle- en paneelradii en de belangrijkste tekstmaten hebben gedeelde tokens. Hiermee blijft het ritme gelijk tussen dossier, invoer, beheer en planning.

Gerichte reviewlocaties, inmiddels verholpen:

```text
src/style.css:1532 - voettekst had zwakke en afwijkende grijsgroene tekstkleuren; gebruikt nu de gedeelde tekstrollen
src/style.css:2092 - bruine tekstacties bepaalden lange onderhoudslijsten; gebruikt nu onderstreept inktblauw met een eigen hover
src/workspace.css:155 - woningkeuze was pas bij hover afgebakend; gebruikt nu een herkenbare keuzelijstrand
src/management.css:287 - formuliergrenzen waren circa 1,6:1; gebruikt nu de controlerand van 3,54:1 op wit
src/style.css:1414 - wachtend en te controleren werk deelden amber; hebben nu afzonderlijke kleurrollen met dezelfde tekstlabels
```

De eerste computed-style-scan op negen Koekoekstraat-pagina's markeerde 34 verschijningen onder de tekstgrens, verdeeld over 14 unieke voor-/achtergrondcombinaties. Na de verfijning markeert dezelfde scan geen combinaties onder de toepasselijke tekstgrens en geen gemeten invoerranden onder 3:1. Dit is een scan van zichtbare DOM-tekst met effen achtergronden, inclusief hoofd- en metadatatekst; geen certificering van de hele app. Canvasinhoud, beeldtekst, alle mogelijke gebruikersinhoud, disabled controls en volledige schermlezerbediening vallen buiten die uitspraak. Bronbeelden en ruimtelijke nauwkeurigheid blijven afzonderlijke onderwerpen.

## Kritische review en oplossingen

| Bevinding vóór de herwerking                                       | Gevolg                                         | Oplossing                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Adres als titel op iedere pagina, met dezelfde algemene ondertitel | Huidige taak onduidelijk                       | Taakgerichte titel, woningcontext in selector                                     |
| Alle onderdelen zowel in zijbalk als in een grote tegelwand        | Dubbele navigatie en veel concurrerende doelen | Vaste hoofdnavigatie, één gegroepeerde onderdelenlijst                            |
| Geselecteerde dossierinhoud onder een lange tegelwand              | Veel scrollen voor informatie                  | Inhoud naast de lijst; compacte mobiele selector                                  |
| Grote generieke PDF-kaarten en afgekorte titels                    | Weinig bestanden tegelijk te beoordelen        | Leesbare lijst met volledige titel, onderwerp en samenvatting; galerij op verzoek |
| Lange meldingen als voortdurend zichtbare tekst                    | Status, plek en datum moeilijk te scannen      | Samenvattingsrij; toelichting en bron uitklapbaar                                 |
| Algemene uploadactie op elke pagina                                | Acties volgen de context niet                  | Toevoegactie per dossierpagina, export rustig in bovenbalk                        |
| Lichtinstellingen over volle breedte en dubbele aanzichtknoppen    | Bediening domineert het huis                   | Compacte instellingenstrook; aanzichten op één plek                               |
| Pagina's alleen als buttons; terugknop herstelt de route niet      | Onvoorspelbare navigatie                       | Echte links, browsergeschiedenis en herstel van URL-selectie                      |
| Lege filterresultaten lijken op een leeg nieuw dossier             | Onduidelijke vervolgstap                       | Uitleg over selectie met expliciet filters wissen                                 |
| Mobiel menu zonder afgeschermde focus                              | Toetsenbord kan achter het menu terechtkomen   | Focus begrensd, achtergrond inert, Escape en focusherstel                         |

## Uitwerking per ontwerplaag

1. **Afstanden:** één ritme voor navigatie, koppen, filters, lijsten en werkvlakken.
2. **Kleur:** navy/crème behouden; accenten en secundaire tekst beperkt en benoemd.
3. **Iconen:** Lucide behouden; dubbele dak- en gevelknoppen verwijderd omdat het aanzichtmenu die acties bevat.
4. **Tekst:** concrete paginanamen, acties en lege toestanden; technische importcommando's uit de laadfout verwijderd.
5. **Typografie:** minder concurrerende koppen; leesbare metadata en volledige bestandsnamen.
6. **Indeling:** vaste taaknavigatie, dossier met lijst en inhoud, bibliotheek als lijst/galerij.
7. **Details:** zichtbare actieve toestand, zoekfocus op de hele zoekbalk, rustige tellingen en uitklapbare broninformatie.
8. **Beelden:** het bestaande huis en de eigen beelden dragen de visuele rijkdom. Geen decoratieve AI-afbeeldingen toegevoegd.
9. **Beweging:** geen nieuwe automatische animaties; bestaande reduced-motion-ondersteuning behouden. Mobiel scrollt de gekozen inhoud naar een bruikbare positie.

## Code en onderhoud

- `src/design-tokens.css`: gedeeld Geokari-palet, semantische statussen, focus, tekstmaten en radii; vóór de componentstijlen geladen. Wijzig een kleurrol hier en controleer de combinaties opnieuw; voeg geen nieuwe lokale grijskleur toe voor hetzelfde doel.
- `src/WorkspaceChrome.tsx`: navigatiegroepen, woningselector, paginatitels en contextacties; één bron voor de pagina-informatie.
- `src/DossierHome.tsx`: gegroepeerde onderdelen, mobiele selector en gekoppelde dossierinhoud.
- `src/FileLibrary.tsx`: gedeelde bestandslijst/galerij voor bibliotheek en inspectiepaneel. De hoofdweergave bewaart de gekozen lijst/galerij tijdens asynchroon zoeken.
- `src/houseSelection.ts`: herstel en serialisatie van woning-, pagina- en dossierselectie.
- `src/workspace.css`: vormgeving van de werkruimte en de bijbehorende schermbreedtes. `src/style.css` behoudt de bestaande formulieren en gespecialiseerde viewerbediening. 54 ongebruikte regels voor de vervangen navigatie en bestandstegels zijn verwijderd.

## Bronnen en toepassing

De lokale productcontext en merkbestanden bepalen wat deze app is. Externe richtlijnen helpen de uitvoering beoordelen:

- [Nielsen Norman Group: 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): consistente benamingen, herkenbare keuzes, beperkte visuele ruis en herstelbare navigatie. Toegepast op de taakgroepen, paginatitels en filters.
- [W3C APG: modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus binnen een modal houden, Escape aanbieden en focus teruggeven. Toegepast op het mobiele navigatiepaneel; bestaande invoervensters gebruiken native `dialog`.
- [Carbon: empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states): leg in de lege context uit wat er ontbreekt en welke stap beschikbaar is. Toegepast op zoekresultaten en een nog ontbrekend interieur.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): semantische links, toegankelijke namen, zichtbare focus, URL-staat en overloopcontrole.
- [GOV.UK Design System: colour](https://design-system.service.gov.uk/styles/colour/): functionele kleurrollen om tekst, randen, focus en feedback voorspelbaar toe te passen. De Geokari-kleuren blijven de eigen merkbasis; de GOV.UK-paletwaarden zijn niet overgenomen.

De herwerking gebruikt de werkwijze van **unslop**, door [Damir Sokolovsky](https://heydamir.design/unslop), CC BY 4.0, naast de frontend-design- en web-design-guidelines-skills. De UI en CSS zijn voor dit project geschreven.

## Verificatie en grenzen

49 tests en TypeScript/productiebuild slagen. De nieuwe routecontrole dekt component-ID's van andere woningen, zoektermen met speciale tekens, filterherstel en het verwijderen van irrelevante filters op andere pagina's.

Alle zes pagina's gecontroleerd op 320, 390, 768 en 1440 px: geen horizontale pagina-overloop en geen naamloze actieknoppen. Daarnaast gecontroleerd: onderdeel kiezen/herladen, kamer → 3D → terug, zoekterm en woning herstellen met de terugknop, galerij behouden tijdens zoeken, lege selectie wissen, document openen/Escape, uploadvenster openen zonder wijzigingen te bewaren, beide inrichtingsstanden, badkamerdeur en lichtpaneel. Het mobiele menu begrenst Tab/Shift+Tab, sluit met Escape, herstelt focus en sluit bij omschakelen naar desktop. Affligem toont eigen gegevens en een lege interieurtoestand. Geen consolefouten of waarschuwingen tijdens deze browsercontroles.

Dit is een ontwerp- en gebruikscontrole met functionele proeven, geen volledige audit met schermlezers of alle mogelijke documentformaten. De bestaande waarschuwing over de omvang van de gedeelde Three.js-bundel blijft bestaan. De ruimtelijke nauwkeurigheid en bronbeperkingen van de huisprofielen veranderen niet door deze herwerking.
