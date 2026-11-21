# Vraag je huis

De huisassistent beantwoordt vragen over de gekozen woning: kamers, bronnotities, modelgegevens, documenten met bewaarde tekst, mensen, klussen en geregistreerde onderhoudskosten. Open **Vraag je huis** in de navigatie of onder het 3D-model op de startpagina.

## Verbinden

Zonder aansluiting staat de assistent uit. Open **AI instellen**:

- **OpenAI:** vul een eigen API-sleutel en modelnaam in. De standaardmodelnaam is `gpt-6.2-astra`. Je vraag, recente gespreksberichten en geselecteerde dossierfragmenten gaan naar OpenAI. Dit is betaald API-gebruik, los van een ChatGPT-abonnement. De aansluiting wordt bij de eerste vraag gecontroleerd.
- **Lokaal:** start zelf Ollama op dezelfde computer en vul de naam van een geïnstalleerd model in dat gestructureerde JSON-uitvoer ondersteunt. Alleen `http://127.0.0.1:11434/api/chat` wordt gebruikt; de app installeert of downloadt geen modellen.
- **Uit:** blokkeert nieuwe vragen en verwijdert een eventueel in het configuratiebestand bewaarde API-sleutel.

Instellingen gelden voor de lokale installatie en staan in `assistant-config.json` binnen de geconfigureerde privémap (standaard `data/`). De sleutel wordt niet teruggestuurd door de API, in browseropslag gezet of in dossierexports opgenomen. Houd ook back-ups van deze privémap privé. Als alternatief ondersteunt de server `OPENAI_API_KEY` en `OPENAI_MODEL` als procesomgevingsvariabelen; een expliciete opgeslagen keuze gaat voor. Een `.env` wordt niet automatisch ingelezen.

OpenAI-verzoeken gebruiken `store: false`. Dat is geen garantie dat de aanbieder geen tijdelijke veiligheidslogs bewaart: zie [OpenAI gegevensbeleid voor de API](https://developers.openai.com/api/docs/guides/your-data). [Responses API met gestructureerde uitvoer](https://developers.openai.com/api/docs/guides/structured-outputs) en [Ollama gestructureerde uitvoer](https://docs.ollama.com/capabilities/structured-outputs) bepalen het antwoordformaat.

## Vragen en bronnen

1. Kies **Hele huis** of één bestaande plek. Een andere plek begint een nieuw gesprek.
2. Typ je vraag of kies een voorbeeld. Enter verstuurt; Shift+Enter begint een nieuwe regel. **Stop** breekt een verzoek af.
3. Lees de korte alinea's en hun bronknoppen. Een bronknop toont een bewaard fragment, met een knop naar het oorspronkelijke document, de plek of het overzicht. De fragmenten zijn rechtstreeks door de server samengesteld, niet door het taalmodel geschreven.
4. Ontbrekende informatie verschijnt apart. **Opnieuw proberen** herhaalt een mislukte vraag; vervolgvragen nemen de recente gesprekscontext mee.

Het gesprek blijft in het geheugen van de geopende pagina, ook wanneer je tussendoor een bron of andere werkpagina opent. **Nieuw gesprek**, verversen of van woning wisselen wist het. Er wordt geen chatgeschiedenis in de database of browseropslag geschreven.

## Grenzen

- De server selecteert maximaal 18 bronrecords, met maximaal 24.000 tekens broninhoud, uit uitsluitend de gekozen woning en eventuele plek. De laatste twaalf gespreksberichten helpen vervolgvragen begrijpen. Niet alle dossierinhoud gaat bij iedere vraag mee; een gerichte vraag kan extra informatie vindbaar maken.
- Een PDF of foto in de bibliotheek is niet automatisch leesbare tekst. De assistent krijgt alleen al bewaarde documenttekst, bestandsgegevens en samenvattingen. Geen nieuwe OCR, beeldanalyse, webzoekopdracht of scan.
- Bronstatus, datum, modelaannames en onzekerheden gaan mee in de context. Modelmaten zijn geen ingemeten maten. 3DBAG beschrijft een buitenzijde van een pand, mogelijk met meerdere woningen. Controleer feitelijke antwoorden bij hun bron; een geldige bron-ID bewijst op zichzelf niet dat een taalmodel de inhoud juist heeft geïnterpreteerd.
- Kostentotalen worden op de server berekend uit afgeronde klussen. Onbekend blijft onbekend en telt niet als nul. Deze kosten zijn geen compleet huishoudbudget.
- De assistent kan het dossier niet wijzigen of gereedschappen uitvoeren. De provider krijgt geen hulpmiddelen, bestandspaden of API-sleutels als gesprekscontext. Contactgegevens zoals telefoon en e-mail worden niet als aparte bronvelden meegestuurd; eventuele vrije notities/documenttekst worden als dossierinhoud behandeld.
- Eén gelijktijdige vraag en maximaal twaalf verzoeken per minuut per woning; een providerverzoek heeft een tijdslimiet van zestig seconden. Foutmeldingen geven geen ruwe providerinhoud of sleutels weer.

## Verificatie op 21 november 2026

83 tests en de productiebuild slagen. Nieuwe tests dekken woning-/plekisolerering, bronstatus, bronverwijzingen, onvolledige antwoorden, providerfouten, lokale endpoints, sleutelafscherming, kosten zonder bedrag en verzoeklimieten. Browserproeven gebruiken synthetische woningen en een expliciet nagebootst antwoord; er zijn geen privégegevens voor testvragen naar een AI-aanbieder verstuurd. Desktop, tablet en 320/390 px gecontroleerd op overloop en bediening. Een echte modelrespons is pas te controleren zodra een sleutel of lokaal model is ingesteld. De bestaande waarschuwing over de grootte van de gedeelde 3D-bundel blijft bestaan.
