## Obiectiv

Optimizarea exclusivă a paginilor Video EN și RO, fără schimbări la videoclipuri, player, ordine, design general, sitemap-uri sau celelalte pagini.

## Implementare

- Actualizez title, meta description și textele sociale pentru `/video` și `/ro/video` cu formulările furnizate.
- Păstrez canonicals și hreflang-urile existente, adaug explicit `index, follow` dacă lipsește și verific unicitatea metadatelor.
- Adaug în pagina Video, în limba rutei:
  - exact un H1 și introducerea solicitată înaintea proiectelor;
  - secțiunea H2 și textul solicitat după proiecte;
  - FAQ-ul cu cele cinci întrebări, într-un accordion discret, semantic și accesibil, cu răspunsurile prezente în HTML-ul inițial;
  - legături interne naturale spre Food, portofoliu comercial și Contact, fără a modifica navigația.
- Adaug câte o schemă `WebPage` și o schemă `FAQPage` corectă pentru fiecare limbă, fără a modifica sau duplica cele trei scheme `VideoObject` existente.

## Verificare

- Verific local HTML-ul SSR, aspectul la desktop/tabletă/mobil și lipsa erorilor.
- Public și verific direct pe `www.pointstudio.ro` ambele URL-uri: HTTP 200, title, description, canonical, hreflang, robots, un singur H1, H2, FAQ în HTML, WebPage/FAQPage și exact trei VideoObject intacte.
- Confirm că ambele URL-uri rămân în sitemap-ul principal și că video sitemap-ul existent rămâne funcțional și neschimbat ca structură.
