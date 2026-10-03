# E-rēķins

Konteksta karkass jaunai tīmekļa lietotnei, kas paredzēta publicēšanai adresē
https://vjaanis.gleeze.com/erekins/.

Publicētā lietotne: https://vjaanis.gleeze.com/erekins/

## Pašreizējais statuss

- HTML, Bootstrap CSS un JavaScript lietotne ar servera puses OCR servisu;
- manuāla rēķina ievade un UBL 2.1 XML imports;
- PNG, JPEG, WEBP un GIF rēķinu strukturēta nolasīšana ar OpenAI redzes modeli
  un lokālu Tesseract rezerves režīmu;
- aprēķini, pamatvalidācija un UBL XML eksports;
- drukājams rēķina priekšskatījums PDF saglabāšanai;
- rēķini un attēli serverī netiek saglabāti; redzes režīmā attēls tiek nosūtīts
  OpenAI API vienam nolasīšanas pieprasījumam.

## Pārbaudes

    node --check assets/js/invoice-core.js
    node --check assets/js/app.js
    node --check server/server.mjs
    node --test tests/invoice-core.test.js
    node --test tests/ocr-core.test.mjs
    node --test tests/vision.test.mjs

Darba sākumpunkts aģentam ir AGENTS.md. Detalizētais konteksts atrodas docs/.
