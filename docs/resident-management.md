# Invoer en beheer voor bewoners

Kies eerst de woning. **Iets toevoegen** is de vaste ingang voor nieuwe informatie; **Beheer** bevat personen, onderhoudsafspraken en de dossiercontrole. Je hebt geen 3D-kennis nodig voor deze handelingen.

## Iets vastleggen

| Keuze           | Wanneer gebruiken            | Wat wordt bewaard                                                         |
| --------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Een melding     | Iets vraagt aandacht         | Open klus met plek, toelichting, optionele verantwoordelijke en plandatum |
| Een notitie     | Iets om te onthouden         | Doorzoekbaar tekstbestand bij de plek                                     |
| Een bestand     | Foto, factuur of handleiding | Origineel bestand met herkenbare titel, categorie en toelichting          |
| Uitgevoerd werk | Werk dat al klaar is         | Afgeronde klus met resultaat en werkelijke datum                          |

Begin met een korte titel. Weet je de plek nog niet, kies **Nog te ordenen**. Een persoon en een datum zijn bij een nieuwe melding optioneel. Bij uitgevoerd werk zijn resultaat en werkelijke datum verplicht; een toekomstige uitvoerdatum wordt geweigerd. Een foto of document kan als bewijs worden toegevoegd (één bestand, maximaal 25 MB). Bijlagen bij een klus zijn ook vanuit de klusdetails te openen.

De tekst van een concept blijft per woning tijdens de browsersessie bewaard, ook bij navigeren en herladen. Bestanden moet je na heropenen opnieuw kiezen. Na opslaan verschijnt een bevestiging met een link naar de plek. Herhalen van dezelfde opslagpoging maakt geen dubbele invoer; wijzigingen krijgen een nieuwe opslagcode. Een concept is geen back-up en wordt niet tussen apparaten gedeeld.

## Personen en verantwoordelijkheid

Onder **Beheer → Personen bij deze woning** kun je een bewoner, helper of vakpersoon toevoegen en later naam, rol en optionele contactgegevens wijzigen. Archiveren bewaart de historie. Gearchiveerde personen zijn niet meer beschikbaar voor nieuwe toewijzingen. Open werk dat nog op hun naam staat verschijnt bij de aandachtspunten; wijs dat opnieuw toe.

Deze personen zijn lokale dossierprofielen, **geen persoonlijke logins**. Het kiezen van een invoerder of uitvoerder is een handmatige registratie, geen geverifieerde identiteit. Rechten per persoon, uitnodigingen en toegang vanaf andere apparaten zijn niet ingericht. De bestaande server blijft uitsluitend op de eigen computer bereikbaar.

## Onderhoud opvolgen

1. Bekijk **Onderhoud** en kies wie een melding oppakt. Een bestaande externe organisatie kan als vrije naam blijven staan.
2. Rond werk af met **wat is gedaan**, **de werkelijke datum** en eventueel de uitvoerder. Die informatie verschijnt in de historie.
3. Voeg onder **Beheer → Terugkerend onderhoud** alleen een onderhoudsafspraak toe waarvoor je zelf een interval kent of hebt afgesproken. Kies plek, eerste datum, interval in maanden en eventueel verantwoordelijke.
4. De afspraak zet één open beurt klaar. Na afronden volgt de eerstvolgende kalenderbeurt. Voorbijgegane beurten worden overgeslagen; ze worden niet als uitgevoerd geregistreerd.
5. Je kunt de afspraak bewerken, pauzeren en hervatten. Bewerken werkt de huidige open beurt bij en laat afgeronde historie staan. Pauzeren houdt bestaand open werk zichtbaar en stopt het klaarzetten van volgende beurten.

Het schema blijft aan de oorspronkelijke kalenderdag gekoppeld: maandelijks vanaf 31 januari geeft 28/29 februari en daarna weer 31 maart. Een gewijzigde datum of interval wordt het nieuwe kalenderanker. Bij vroeg afronden komt de volgende beurt na de oorspronkelijke vervaldatum; bij laat afronden na de werkelijke datum. Een oude afgeronde beurt kan niet heropend worden als de volgende al openstaat: werk de open beurt bij. Er zijn geen e-mail- of pushherinneringen.

## Het dossier onderhouden en bewaren

Beheer toont meldingen met een verstreken datum, meldingen zonder actieve verantwoordelijke en bestanden bij **Nog te ordenen**. De eerste vijf open aandachtspunten zijn direct bij te werken. Orden ook de overige invoer via Overzicht, Documenten & foto's en Onderhoud. Recente wijzigingen helpen terugvinden wat er is toegevoegd; dit is geen volledige revisiegeschiedenis.

**Download volledige dossierkopie** bevat gegevens, personen, afspraken, recente wijzigingen, originele bestanden en privéprofielen van de gekozen woning. Bewaar de kopie buiten deze computer. Automatisch terugzetten van JSON is nog niet beschikbaar en vraagt technische hulp. Voor direct herstel van deze versie kan de beheerder de server stoppen en de volledige `data/`-map terugzetten uit een consistente kopie. Zie ook [Data en back-ups](../README.md#data-en-back-ups).

## Implementatie en controle

`server/management.mjs` beheert personen, afspraken en opslagcodes in SQLite; `server/management-routes.mjs` valideert de invoer en koppelt bestanden. Elke verwijzing naar personen en onderdelen wordt binnen dezelfde woning gecontroleerd. De migratie is additief; bestaande documenten, externe eigenaarnamen en afgeronde klussen blijven behouden. `:inbox` is een vaste onderdeel-ID per woning. Namen en contacten worden uitsluitend in de privéopslag bewaard, niet in woningconfiguratie of rendercode.

Databasewijzigingen binnen één invoer zijn atomair. Tijdelijke uploads worden bij mislukte validatie of een herhaalde opslagpoging opgeruimd. Een opslagcode kan niet met een andere inhoud worden hergebruikt. Een mislukte invoer houdt het concept in beeld. De server bepaalt de kalenderdag in Europe/Brussels; beide huidige woningen gebruiken dezelfde tijdzone.

Gecontroleerd op 20 november 2026: 52 tests en productiebuild slagen. De geïsoleerde browserproeven omvatten invoer, conceptbehoud, bijlage lezen, personen wijzigen/archiveren, werk afronden, volgende beurt, afspraak wijzigen en pauzeren/hervatten. Beide nieuwe pagina's zijn bekeken op 320, 390, 768 en 1440 px. De echte dossiers zijn alleen gelezen en met de gevraagde personen aangevuld; hun aantallen bestaande bestanden en klussen bleven gelijk. Zie [controleverslag](verification.md).
