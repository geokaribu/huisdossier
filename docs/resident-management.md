# Invoer en beheer voor bewoners

Kies eerst de woning. **Iets toevoegen** is de vaste ingang voor nieuwe informatie; **Planning** toont wat eraan komt; **Beheer** bevat personen, onderhoudsafspraken en de dossiercontrole. Je hebt geen 3D-kennis nodig voor deze handelingen.

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

Een contact heeft optioneel bedrijf, vakgebied, telefoonnummer, e-mail, website en contactnotities. Vanuit **Overzicht → onderdeel → Contacten** of het informatiepaneel bij het 3D-model kun je een bestaande persoon koppelen of meteen een nieuw contact toevoegen. Noteer daar ook de rol en afspraken voor dat onderdeel. Zo kan dezelfde dakwerker bij dak én gevel horen zonder dubbele contactgegevens. Telefoon, e-mail en website openen de bijbehorende toepassing; Huisdossier verstuurt zelf geen bericht.

De contactgegevens wijzig je bij **Beheer**. De rol en afspraken per onderdeel wijzig je met het potlood bij de koppeling. **Loskoppelen** verwijdert alleen de relatie en onderdeelnotities, na bevestiging; de persoon en onderhoudshistorie blijven bestaan. Gearchiveerde contacten blijven bij bestaande onderdelen zichtbaar en zijn niet voor nieuwe koppelingen te kiezen.

## Onderhoud opvolgen

1. Bekijk **Onderhoud** en kies wie een melding oppakt. Een bestaande externe organisatie kan als vrije naam blijven staan.
2. Rond werk af met **wat is gedaan**, **de werkelijke datum** en eventueel de uitvoerder. Die informatie verschijnt in de historie.
3. Voeg onder **Beheer → Terugkerend onderhoud** alleen een onderhoudsafspraak toe waarvoor je zelf een interval kent of hebt afgesproken. Kies plek, eerste datum, interval in maanden en eventueel verantwoordelijke.
4. De afspraak zet één open beurt klaar. Na afronden volgt de eerstvolgende kalenderbeurt. Voorbijgegane beurten worden overgeslagen; ze worden niet als uitgevoerd geregistreerd.
5. Je kunt de afspraak bewerken, pauzeren en hervatten. Bewerken werkt de huidige open beurt bij en laat afgeronde historie staan. Pauzeren houdt bestaand open werk zichtbaar en stopt het klaarzetten van volgende beurten.

Het schema blijft aan de oorspronkelijke kalenderdag gekoppeld: maandelijks vanaf 31 januari geeft 28/29 februari en daarna weer 31 maart. Een gewijzigde datum of interval wordt het nieuwe kalenderanker. Bij vroeg afronden komt de volgende beurt na de oorspronkelijke vervaldatum; bij laat afronden na de werkelijke datum. Een oude afgeronde beurt kan niet heropend worden als de volgende al openstaat: werk de open beurt bij.

## Planning, herinneringen en je agenda

**Planning** groepeert open meldingen in **Over datum**, **Vandaag & komende 30 dagen**, **Nog een datum kiezen** en een uitklapbare lijst **Later gepland**. Filter op een persoon of zonder verantwoordelijke. Vanuit iedere melding kun je het onderdeel openen, aanpassen of afronden. Werk met de status Wacht op blijft zichtbaar.

**Herinnering uitstellen** kiest een nieuwe herinneringsdatum binnen Huisdossier. De onderhoudsdatum blijft gelijk, achterstallig werk blijft in het overzicht en je kunt het uitstel opheffen. Dit verandert eerder geïmporteerde agenda-afspraken niet.

Onder **Herinneringen op deze computer** kies je het aantal dagen vooraf en eventueel een persoon. **Bureaubladmeldingen inschakelen** vraagt pas na je klik toestemming aan de browser. De app controleert tijdens het openstaan iedere minuut en bij terugkeren naar het venster. Een dagelijkse registratiesleutel beperkt herhaling per woning; browsers met Web Locks stemmen dit tussen tabbladen af. De voorkeur en verzendregistratie gelden voor deze browser en dit lokale app-adres. Er is geen achtergrondservice als de browser gesloten is. Op browsers zonder bruikbare bureaubladmeldingen blijft het overzicht werken. Mobiele ondersteuning van deze desktopfunctie is niet gegarandeerd. Zie [MDN over meldingen en toestemming](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).

Voor je eigen agenda download je een losse melding via **Naar agenda** of alle open meldingen met datum in de selectie via **Download planning (.ics)**. Optioneel voeg je een alarm toe op één of zeven dagen vooraf, om 09:00 volgens de tijdzone van de ontvangende agenda. Controleer na import of die agenda de herinnering overneemt. De meldingen staan als hele dagen en blokkeren geen tijd; er is geen tijdstip van een vakman verondersteld. Het bestand bevat geen uitnodigingen.

Een import is een **momentopname**. Wijzigingen, afgeronde meldingen en volgende onderhoudsbeurten worden niet automatisch in je agenda bijgewerkt. Importeer bij voorkeur in een aparte onderhoudsagenda; opnieuw importeren kan duplicaten veroorzaken, afhankelijk van je agenda. [Google legt het ontbreken van synchronisatie uit](https://support.google.com/calendar/answer/37118?hl=nl); [Microsoft onderscheidt importeren van abonneren](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web). Een abonnement, OAuth-koppeling en geplande e-mail- of pushbezorging zijn niet ingericht. Een externe agenda kan de uitsluitend lokale server niet als openbare agenda ophalen.

Het bestand volgt [iCalendar (RFC 5545)](https://www.rfc-editor.org/rfc/rfc5545): vaste identiteit per installatie/woning/melding, private gebeurtenissen, tekstescaping, UTF-8-regelafbreking en een exclusieve einddatum. Terugkerend onderhoud exporteert alleen de huidige open beurt, passend bij de bestaande afrondingsflow.

## Werkelijke kosten bewaren

Bij **Onderhoud afronden** of **Iets toevoegen → Uitgevoerd werk** kun je de werkelijk betaalde kosten in euro invullen. Gebruik bijvoorbeeld `125,50`, zonder duizendtallen. Leeg betekent onbekend; `0` betekent gratis uitgevoerd. De app bewaart gehele centen. Je kunt het bedrag later wijzigen via **Onderhoud → Afgerond → melding bewerken**; het staat ook in de klusdetails.

Planning toont het jaartotaal voor de hele woning, op basis van de werkelijke uitvoerdatum. Alleen afgerond werk met een bedrag telt mee; er staat hoeveel afgeronde meldingen nog geen bedrag hebben. Een volgende onderhoudsbeurt neemt de oude kosten niet over. Dit is een registratie van onderhoud, geen boekhouding of kostenraming.

## Het dossier onderhouden en bewaren

Beheer toont meldingen met een verstreken datum, meldingen zonder actieve verantwoordelijke en bestanden bij **Nog te ordenen**. De eerste vijf open aandachtspunten zijn direct bij te werken. Orden ook de overige invoer via Overzicht, Documenten & foto's en Onderhoud. Recente wijzigingen helpen terugvinden wat er is toegevoegd; dit is geen volledige revisiegeschiedenis.

**Download volledige dossierkopie** bevat gegevens, personen, afspraken, recente wijzigingen, originele bestanden en privéprofielen van de gekozen woning. Bewaar de kopie buiten deze computer. Automatisch terugzetten van JSON is nog niet beschikbaar en vraagt technische hulp. Voor direct herstel van deze versie kan de beheerder de server stoppen en de volledige `data/`-map terugzetten uit een consistente kopie. Zie ook [Data en back-ups](../README.md#data-en-back-ups).

## Implementatie en controle

`server/management.mjs` beheert personen, onderdeelcontacten, afspraken en opslagcodes in SQLite; `server/management-routes.mjs` valideert de invoer en koppelt bestanden. `server/planning-routes.mjs` levert contactkoppelingen en agenda-export. Elke verwijzing naar personen en onderdelen wordt binnen dezelfde woning gecontroleerd. Migratie 4 voegt contactdetails, onderdeelcontacten en een installatie-identiteit toe; bestaande documenten, externe eigenaarnamen en afgeronde klussen blijven behouden. `:inbox` is een vaste onderdeel-ID per woning. Namen en contacten worden uitsluitend in de privéopslag bewaard, niet in woningconfiguratie of rendercode. Dossierexport bevat ook contactkoppelingen, kosten en uitgestelde herinneringen. Lokale browservoorkeuren maken daar geen deel van uit.

Databasewijzigingen binnen één invoer zijn atomair. Tijdelijke uploads worden bij mislukte validatie of een herhaalde opslagpoging opgeruimd. Een opslagcode kan niet met een andere inhoud worden hergebruikt. Een mislukte invoer houdt het concept in beeld. De server bepaalt de kalenderdag in Europe/Brussels; beide huidige woningen gebruiken dezelfde tijdzone.

Gecontroleerd op 20 november 2026: 66 tests en productiebuild slagen. De geïsoleerde browserproeven omvatten ook een contact bij het dak toevoegen, wijzigen en op mobiel koppelingnotities bewerken; herinneringen uitstellen; afronden met kosten en die later wijzigen; uitgevoerd werk met € 0 vastleggen; agendabestand downloaden; en nagebootste browsermeldingen met toestemming na een klik en dagelijkse herhalingscontrole na herladen. Planning is bekeken op 320, 390, 768 en 1440 px. Na een consistente back-up en migratie zijn de bestaande onderdelen, documenten, taken en personen via inhoudshashes ongewijzigd bevonden. Beide echte dossiers zijn op desktop en mobiel alleen gelezen; testinvoer blijft in de aparte database. De herinneringen zijn niet in echte Google-, Outlook-, Apple- of Zoho-accounts geïmporteerd. Zie [controleverslag](verification.md).
