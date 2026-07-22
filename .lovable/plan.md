# Interfață de editare tip Squarespace

Construim un CMS integrat în site, accesibil doar pentru tine (admin), care îți permite să editezi tot conținutul live, fără cod.

## 1. Autentificare admin

- Pagina `/auth` (email + parolă) — Lovable Cloud gestionează conturile.
- Primul cont creat primește automat rol `admin` (tabelul `user_roles` există deja).
- Când ești logat ca admin, apare o bară de editare fixă sus cu: **Edit mode ON/OFF**, **Salvează**, **Logout**.

## 2. Ce vei putea edita (în același UI, direct pe pagină)

**Header**
- Logo (upload imagine)
- Iconițe social (Instagram, Pinterest, etc.) — adaugă/șterge/reordonează, editează link

**Meniu**
- Adaugă / șterge / redenumește / reordonează (drag) pagini
- Ascunde/afișează fiecare item (toggle-ul Video există deja, îl integrăm)

**Homepage**
- Imaginea hero (peștele) — schimbă
- Toate textele (titlu, paragraf, "10+ YEARS…", "50+ CLIENTS")
- Banda de logouri clienți — upload/șterge/reordonează
- Secțiunea "The Studio" — text + galerie (add/remove/reorder/upload)
- Secțiunea "What We Do" — cardurile categorii (imagine, titlu, link)
- Testimoniale — text/video, add/remove/reorder

**Pagini portofoliu (Food, People, Editorial, Patterns, Video, categorii What We Do)**
- Titlu / tagline / descriere
- Galeria: upload multiplu, ștergere, reordonare drag & drop, editare alt text
- Layout (grid / stacked / filmstrip)

**Footer**
- Text copyright, link-uri sociale, informații contact

**Pagina Contact**
- Text, email, telefon, adresă
- Coordonatele hărții Google

**Pagini generice**
- Creează pagini noi și adaugă-le în meniu
- Șterge pagini existente

## 3. Detalii tehnice (pentru referință)

**Backend (Lovable Cloud — deja setat):**
- Tabelele `pages`, `galleries`, `gallery_images`, `menu_items`, `site_settings`, `user_roles` există.
- Bucket `media` (privat) există pentru upload-uri; îl facem public pentru afișare.
- Vom popula DB-ul cu conținutul actual (migrare din JSON-uri → DB) printr-o migrație de seed.

**Frontend:**
- Toate componentele (Hero, ClientLogos, Studio, WhatWeDo, Testimonials, Gallery, Footer, SiteLayout) vor citi din DB via `useQuery` în loc de constante hardcodate.
- Wrapper `<Editable field="...">` afișează textul normal, iar în edit mode devine `contentEditable` cu salvare automată (debounced).
- Componenta `<EditableImage>` pentru imagini (click → upload nou).
- Componenta `<EditableGallery>` cu drag-drop (dnd-kit), buton "+ Add images", buton ștergere per imagine.
- Server functions protejate cu `requireSupabaseAuth` + verificare rol admin pentru toate mutațiile.

**Livrare pe etape:**
1. Auth + rol admin + bară edit mode
2. Migrare conținut actual în DB + citire din DB (site funcționează identic cu azi)
3. Editare texte inline (Header, Hero, secțiuni, Footer, Contact)
4. Upload imagini + editare galerii cu drag-drop
5. Manager meniu (add/remove/reorder pagini)
6. Creator pagini noi

## Ce trebuie de la tine

- Confirmă emailul pe care vrei să-l folosești ca admin (îl vei crea la `/auth` după ce livrez pasul 1).
- Confirmi că mergem pe toate cele 6 etape mai sus, sau vrei să tăiem/prioritizăm ceva?
