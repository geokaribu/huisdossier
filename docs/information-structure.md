# Informatie per onderwerp en plek

De lange bronbeschrijving blijft het archief, niet de hoofdweergave. `InformationBook` toont maximaal vier gegevens tegelijk, met directe onderwerp- en ruimtekeuze, zoeken en een knop voor de overige gegevens. Een zoekterm doorzoekt alle onderwerpen binnen de gekozen ruimte. Ruimtegegevens staan vóór algemene beperkingen; gegevens van een andere ruimte verschijnen daar niet.

`Floorplan.information` en `HouseAppearance.information` bevatten afzonderlijke items. Dit is extra profielinformatie; geometrie, oorspronkelijke beschrijvingen, bronbestanden en vaste dossier-ID's blijven behouden. Profielen staan uitsluitend in de private opslag. Zowel de API als de dossierexport behouden deze informatie.

| Veld | Betekenis |
| --- | --- |
| `id` | Stabiele unieke sleutel binnen het profiel |
| `title`, `value`, `text` | Naam, optionele korte maat/waarde, volledige toelichting bij dit gegeven |
| `topic` | `dimensions`, `layout`, `finishes`, `furnishing`, `sources`, `accuracy` |
| `status` | `source` = volgens bron; `resident` = volgens bewoner; `approximate` = benadering; `unknown` = niet vastgesteld |
| `source` | Korte herkomst, inclusief datum wanneer bekend |
| `roomIds` | Bestaande vaste kamer-ID's; zonder kamer-ID geldt het gegeven algemeen |
| `assetKinds` | Toepasselijk onderdeeltype voor de buitenafwerking |

Een bronlabel betekent geen bouwkundige verificatie. Een maat die alleen bij één ruimte is vermeld, wordt niet automatisch een bronmaat voor de andere ruimtes. Materiaal- en kleurbenaderingen blijven benaderingen. Vermeld actuele correcties afzonderlijk en benoem eerdere uitwerkingen als eerder; laat achterhaalde tekst niet ongemerkt als actuele toestand verschijnen.

Voeg nieuwe modelgegevens als aparte items aan het betreffende private profiel toe; hergebruik de originele bron en de bestaande kamer-ID. De schema's controleren labels, maximale lengtes, unieke sleutels en kamerrelaties. Er is geen aparte modelkennis-editor toegevoegd: bewonersnotities blijven via **Iets toevoegen** en de bestaande bewerkacties werken.

Zonder gestructureerde items toont de binnenweergave expliciet een modelhoogte, aanwezige profieloppervlaktes en de oorspronkelijke bronbeschrijving. Er worden geen feiten uit vrije tekst geraden.

`ReadableText` maakt lange vrije notities leesbaar met afzonderlijke zinnen. Het bewaart de inhoud, decimalen, datumteksten, links en eenvoudige opmaak. Dit is presentatie, geen automatische factextractie. Documenttabellen en documentkoppen houden hun bestaande structuur. De gedeelde weergave wordt gebruikt bij dossiernotities, documenttekst/samenvatting/herkomst, klusbeschrijvingen/resultaten en persoons-/contactnotities. Lichtuitleg en luchtfotometadata hebben afzonderlijke onderwerpen en velden.
