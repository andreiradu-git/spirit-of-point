# Sincronizare limbă Admin cu pagina publică

## Implementare
- Folosesc exclusiv maparea bilingvă existentă `localizePath`, inclusiv perechile de URL-uri speciale.
- Selectorul „Editing EN / RO” va salva limba de editare și va naviga imediat la versiunea echivalentă a aceleiași pagini, păstrând Edit Mode și autentificarea.
- La orice schimbare de rută EN/RO, inclusiv din selectorul public, starea „Editing” va fi actualizată automat după limba URL-ului.
- În Edit Mode, limba conținutului va proveni din ruta curentă, eliminând posibilitatea ca pagina și câmpurile editabile să folosească limbi diferite.
- Înainte de navigare, câmpul editabil focalizat va fi finalizat prin blur; dacă browserul indică modificări locale nesalvate, schimbarea va cere confirmare.

## Verificare
- Testez comutarea în ambele sensuri pe Home, Food, People, Editorial, Video, Wanders și rutele bilingve speciale.
- Confirm că URL-ul, selectorul Admin și conținutul editabil rămân sincronizate, iar Edit Mode rămâne activ.
- Verific build-ul și erorile aplicației, fără schimbări SEO, sitemap, canonical sau hreflang.
