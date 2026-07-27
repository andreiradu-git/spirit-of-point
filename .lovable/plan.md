## Scope

Editable hero stats + patru etape CMS. Livrez incremental, în ordinea de mai jos. La final revenim la debugging upload R2.

### 0. Stats editabile pe hero (rapid)
- În `src/routes/index.tsx`, înlocuiesc textele hardcoded (`10+`, `Years of expertise`, `50+`, `International clients`) cu `<Editable id="hero.stat1.value" />`, `hero.stat1.label`, `hero.stat2.value`, `hero.stat2.label`. Se salvează prin `useSaveText` (deja existent).

### Etapa A — Media Manager R2 complet
Fișier: `src/routes/admin.assets.tsx` + `src/lib/r2.functions.ts` + `src/lib/asset-meta.functions.ts`.
- Search box (nume/label/alt) + filter chips: All / Image / Video / File.
- Sort: Name, Size, Date.
- Grid cu preview, size uman, data upload, badge "Used on site".
- Acțiuni per card: Copy URL, Rename (nou `renameR2Object` — copy+delete), Delete cu confirm, Optimize/Revert (existent).
- Drag&drop multi-upload cu progress bar per fișier (Promise.all + state map).
- Câmpuri editabile extinse pe `asset_meta`: `label`, `alt`, `caption`, `description`, `tags` (text[]). Migrare adaugă coloanele.
- Buton "AI Generate all" per asset — extind `generateAssetMeta` să returneze toate 5 câmpuri.

### Etapa B — Video CMS
Fișier: `src/routes/video.tsx`.
- Sursă: `R2 upload` sau `URL extern` (YouTube/Vimeo/MP4) — detectare automată în player (iframe pt YT/Vimeo, `<video>` pt MP4).
- Replace video, delete, drag&drop reorder (dnd-kit e deja instalat? verific; altfel HTML5 native).
- AI meta pe poster (folosind `generateAssetMeta`).

### Etapa C — Testimonials carousel
Fișier: `src/components/EditableTestimonials.tsx`.
- Carousel orizontal cu swipe touch + mouse drag, autoplay (pauză pe hover), săgeți, dots.
- Folosesc `embla-carousel-react` (deja shadcn/ui carousel îl folosește) — verific instalare.

### Etapa D — Links Manager
Nou: `src/routes/admin.links.tsx` + tabel `links` (id, key, label, url, description, group, sort).
- CRUD complet + AI generate description/label din URL.
- Hook `useLinks(group)` pt afișare pe site (ex. footer, sidebar).

### Note tehnice
- Toate migrațiile respectă GRANT-urile pentru authenticated + service_role, RLS activ.
- Nu ating fluxul de upload R2 în afara `admin.assets` decât în Etapa B (video upload) — bug-ul de env va fi tratat separat la final.

## Livrare
Confirm la fiecare etapă înainte de următoarea, sau merg tot lanțul dacă spui "mergi până la capăt". Începem?
