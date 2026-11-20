# Eerste versie: lokaal huis inspecteren

## Besloten scope

Bron: gesprek met Karian/Kilian op 20 november 2026; het voorstel om een eerste inspecteerbare versie te maken is geaccepteerd. Eigen gebruik; Geokari-huisstijl. Bestaande conceptcontext: database eerst, geen permanente IoT, eigen huis gevolgd door het huis van de ouders.

De eerste versie levert de geverifieerde buitenzijde van het pand, dossieronderdelen, originele bestanden en onderhoud. Plattegronden, ingemeten interieurs en fotorealisme hebben eigen opnames nodig en zijn nog niet opgenomen.

Aanvulling 20 november 2026: de gebruiker heeft twee gevelbeelden aangeleverd. Een apart lokaal afwerkingsprofiel projecteert een AI-gecorrigeerd frontbeeld op de bestaande voorgevel. Zijmaterialen, cornice en een opgeschoonde mansardedak/dakkapelvariant zijn visuele benaderingen. Het profiel kan worden uitgeschakeld; de originele brongeometrie wordt niet overschreven. Afwerking en attributie blijven privé in `data/appearance/` en gaan mee in de dossierexport. Deze laag staat los van de feitelijke BAG-gegevens en van toekomstige ingemeten geometrie.

## Structuur

Een Node-proces serveert de lokale API en de webinterface. React/TypeScript verzorgt de interface; Three.js verzorgt alleen de weergave. Express valideert mutaties met Zod. Node SQLite bewaart records en losse bestanden bewaren de originelen. De keuze voor SQLite maakt deze versie eenvoudig op één computer te gebruiken; netwerkhosting of meerdere accounts vraagt een apart ontwerp en is geen impliciete vervolgfunctionaliteit.

De gegevensrelatie is `woning → onderdeel → bestanden / onderhoud`. Een onderdeel heeft een vast ID en optioneel een RD/NAP-positie. Een ruimte is een onderdeeltype; een ingemeten verdiepings- en ruimtehiërarchie kan worden toegevoegd wanneer er een plattegrond beschikbaar is. De viewer bezit geen dossierinhoud. Daarmee kan een later GLB- of splatmodel dezelfde dossierkoppelingen gebruiken.

De importer controleert het BAG-verblijfsobject, volgt de officiële pandrelatie en haalt dat exacte pand op bij 3DBAG. Bij een onduidelijke meervoudige pandrelatie stopt de import. CityJSON-oppervlakken behouden hun semantiek; RD/NAP-coördinaten worden in de viewer lokaal rond het huis verschoven om precisieverlies te voorkomen. Concave vlakken en gaten worden via vlakprojectie en Earcut getrianguleerd.

## Grenzen en vervolgstappen

1. Eerste inspectie met bewoners: model en adresrelatie beoordelen, oorspronkelijke tekeningen en gevelbeelden verzamelen.
2. Foto's van ventilatie, elektriciteitskast en oven toevoegen; merk/type en echte plek vastleggen.
3. Plattegrond en binnenindeling aanbrengen op basis van bronmateriaal, met bronvermelding en onzekerheid.
4. Eén ruimte of gevel met eigen opnames reconstrueren; fotogrammetrie en splats vergelijken op uiterlijk, bestandsomvang en browsergebruik.
5. Back-upherstel via export, versiegeschiedenis en overdracht uitwerken voordat data op een gedeelde server komt.

Er is geen geclaimde meetnauwkeurigheid. Een punt dat een bewoner aanwijst is een markering, geen inmeting. Open-data-opnamedatum, ophaaldatum en privé-onderhoudsdatum worden afzonderlijk bewaard.
