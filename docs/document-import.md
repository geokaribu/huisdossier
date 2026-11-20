# Lokale documentimport

Het manifest is privédata en hoort onder `data/imports/`. Gebruik één blijvende `sourceKey` (het vierde CLI-argument) per bronverzameling en stabiele `key`-waarden voor onderdelen en klussen. Wisselende sleutels maken nieuwe records.

```json
{
  "assets": [
    {
      "key": "room:study",
      "name": "Werkkamer",
      "kind": "ruimte",
      "roomId": "study",
      "description": "Notities met bron en peildatum."
    }
  ],
  "documents": [
    {
      "path": "handleidingen/ventilatie.pdf",
      "title": "Ventilatiehandleiding",
      "assetKey": "room:study",
      "category": "maintenance",
      "summary": "Model en onderhoud controleren.",
      "sourceDate": "2026-10-15",
      "historical": false,
      "text": "Vooraf geëxtraheerde tekst."
    }
  ],
  "tasks": [
    {
      "key": "ventilation-check",
      "assetKey": "room:study",
      "title": "Onderhoudsbeurt bevestigen",
      "description": "Uitvoering nog niet bevestigd.",
      "date": "",
      "status": "open",
      "state": "verify",
      "owner": "",
      "sourcePath": "handleidingen/ventilatie.pdf",
      "sourceDate": "2026-10-15"
    }
  ]
}
```

- `kind`: `gebouw`, `dak`, `gevel`, `ruimte`, `installatie`, `overig`. Een `roomId` verwijst naar een bestaande ruimte in het privéplattegrondprofiel. De UI laat deze koppeling ook handmatig kiezen.
- Bestaande onderdelen hebben ID `<woning-id>:<key>`; de vaste `building`, `roof` en `facade` kunnen direct als `assetKey` dienen. Zonder eerdere importsnapshot blijven bestaande onderdelen ongemoeid.
- Documentpaden zijn relatief aan de bronmap of absolute paden daarbinnen. `index` en `archive` worden gerapporteerd en uitgesloten. Originele bytes worden met SHA-256 opgeslagen en blijven los van de leesbare tekst. Markdown/TXT/CSV krijgen hun tekst automatisch; andere formaten gebruiken optioneel `text` uit het manifest. Een gescande PDF zonder tekst kan nog steeds in de reader geopend worden.
- `date` is een concrete afgesproken datum of een lege string. Een bronjaar of een onbekende datum wordt niet automatisch een deadline. `status`: `open` of `done`; `state`: `active`, `hold` of `verify`. Afgeronde historie staat buiten de open lijst. `sourcePath` verbindt een klus met een geïmporteerd origineel.
- Beoordeel gedateerde bronnen vóór import: actuele bewonersinformatie gaat vóór oudere notities, een concept is geen getekende overeenkomst en een oude factuur is geen nieuwe betaalopdracht. Noteer tegenstrijdigheden in `summary` en/of de onderdeelinformatie; verander geen gebouwkenmerken op basis van een onopgelost conflict.

De import werkt in één database-transactie. Onbekende onderdelen breken de import af; gekopieerde bestanden kunnen dan ongekoppeld achterblijven, maar bestaande records veranderen niet. Herimport vergelijkt de database met de vorige importsnapshot en werkt uitsluitend ongewijzigde records bij. Een door de bewoner bewerkt record wordt in `preserved` gerapporteerd; er vindt geen automatische merge plaats. De originele bronmap blijft onaangeroerd.

Elke CLI-import bewaart zijn rapport onder `data/imports/`, inclusief ontbrekende, uitgesloten en behouden records. De export bevat de dossiermetadata, bronverwijzingen, leesbare tekst en originele bytes. Bewaar daarnaast een kopie van de volledige `data/`-map voor herstel met deze versie.
