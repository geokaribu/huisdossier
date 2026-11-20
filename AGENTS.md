# Huisdossier

Een lokale Geokari-app. Start met `npm ci` en `npm run dev` (Node 24+).

- Woningconfiguratie staat standaard in `config/houses.json`; `server/runtime-config.mjs` deelt validatie en eventuele installatiegebonden catalogus-, opslag- en modellenpaden met de importers. Vermijd adressen en kamerindelingen in generieke componenten.
- Privé-inhoud staat alleen in `data/` en mag nooit naar Git. Gebruik geïsoleerde testdata voor browserproeven.
- Modelleer geen ramen, materialen of interieur als geverifieerd zonder bronmateriaal. 3DBAG is een gereconstrueerde buitenzijde van een BAG-pand; het pand kan meerdere woningen bevatten.
- Dossierkoppelingen gebruiken vaste onderdeel-ID's, geen mesh-indexen. Posities zijn optionele RD/NAP-markeringen met herkenbare herkomst.
- Houd Geokari-huisstijl aan: de bestaande assets onder `public/brand`, Inter, navy/oranje/crème en Lucide.
- Importeer open modellen met `npm run import:house`. Behoud attributie, licentie, exacte BAG-relatie en ophaaldatum.
- Voer bij functionele wijzigingen `npm test` en `npm run build` uit. Controleer interacties op desktop en een smal scherm wanneer de UI wijzigt.
- De server is alleen voor loopbackgebruik. Publieke hosting, accounts, externe opslag en automatische scans zijn niet geconfigureerd.
