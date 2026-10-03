# Pārbaudes

## Pamatprincipi

- pārbauda gan aprēķinu pareizību, gan lietotāja plūsmu;
- katram aprēķina noteikumam ir robežgadījumi un zināms sagaidāmais rezultāts;
- publisko /erekins/ pārbauda atsevišķi no lokālās vides;
- automatizē atkārtotus aprēķinus un validāciju;
- vizuālu uzdevumu pārbauda pārlūkā, ne tikai ar komandrindu.

Pamata automatizētās pārbaudes:

    node --check assets/js/invoice-core.js
    node --check assets/js/app.js
    node --check server/server.mjs
    node --test tests/invoice-core.test.js
    node --test tests/ocr-core.test.mjs
    node --test tests/vision.test.mjs

## Obligātās pārbaudes

### Saturs un struktūra

- lapai ir pareizs lang, title, meta apraksts un viens h1;
- virsrakstu hierarhija un semantiskie orientieri ir loģiski;
- nav pagaidu teksta, bojātu saišu vai trūkstošu aktīvu;
- visas iekšējās adreses darbojas zem /erekins/.

### Aprēķini

Kad aprēķinu noteikumi ir zināmi, pārbauda vismaz:

- tukšas un nederīgas vērtības;
- nulli, negatīvas vērtības un lielas summas;
- decimāldaļu ievadi un noapaļošanu;
- atlaides, nodokļus un kopsummu secību;
- vairāku rindu summēšanu;
- paredzamu rezultātu atkārtotā aprēķinā.

Sagaidāmos piemērus dokumentē kopā ar produkta noteikumiem, nevis izdomā testā.

### Responsivitāte un pieejamība

- 320 × 568, 390 × 844, 768 × 1024 un 1366 × 768;
- nav horizontālas ritināšanas vai nogriezta satura;
- visi lauki un darbības sasniedzami ar tastatūru;
- fokuss ir redzams un secīgs;
- kļūdas un dinamiskie rezultāti tiek paziņoti ekrānlasītājam;
- kontrasts atbilst WCAG AA;
- pārbaude pie 200% palielinājuma un samazinātas kustības režīmā.

### Drošība un privātums

- avotos un publiskajos failos nav noslēpumu;
- ievade netiek ievietota DOM ar nepārbaudītu innerHTML;
- servera pusē ievade tiek validēta, ja serveris pastāv;
- žurnāli nesatur nevajadzīgus personas vai rēķina datus;
- pārlūka krātuvē netiek glabāti sensitīvi dati bez apstiprināta pamatojuma;
- ārējie pieprasījumi un integrācijas ir dokumentētas.
- OCR noraida neatbalstītu vai nepareizi marķētu PDF/attēla saturu un failus virs 8 MB;
- OCR pieprasījumu saturs un atpazītais teksts netiek rakstīts žurnālā.
- redzes modeļa atbilde tiek atkārtoti validēta serverī;
- OpenAI kļūmes gadījumā atslēgas vai rēķina saturs netiek ierakstīts žurnālā;
  attēla pieprasījums pāriet lokālajā OCR režīmā, bet PDF saņem skaidru servisa
  nepieejamības kļūdu.

### Produkcija

Pēc publicēšanas pārbauda:

    curl -fsSI http://vjaanis.gleeze.com/erekins/
    curl -fsSI https://vjaanis.gleeze.com/erekins/

Sagaidāms HTTP 301 uz HTTPS un HTTPS 200. Papildus pārbauda katru CSS,
JavaScript, `GET /erekins/api/health`, TLS sertifikātu un nginx vai lietotnes
kļūdu žurnālu.

## Pabeigšanas kritēriji

- pieņemšanas kritēriji ir izpildīti;
- aprēķinu noteikumi ir testēti ar zināmiem piemēriem;
- galvenā plūsma darbojas telefonā, datorā un ar tastatūru;
- nav konsoles, tīkla vai servera kļūdu;
- dokumentācija atbilst faktiskajam risinājumam;
- produkcija pārbaudīta, ja izmaiņa ir publicēta.
