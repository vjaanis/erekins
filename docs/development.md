# Izstrāde

## Darba plūsma

1. Izlasi AGENTS.md un uzdevumam atbilstošos docs/ failus.
2. Pārbaudi dzīvo kodu, servisu un nginx stāvokli.
3. Ja trūkst būtiska produkta lēmuma, pieprasi to pirms ieviešanas.
4. Īsi nosauc maināmos failus un paredzētās pārbaudes.
5. Veic mazāko pilno izmaiņu bez nevajadzīgām atkarībām.
6. Izpildi testing.md noteiktās pārbaudes.
7. Publicē tikai pēc lietotāja lūguma un pārbaudi publisko URL.
8. Ja mainās arhitektūra, serviss, ports vai datu vieta, atjaunini dokumentāciju
   un ~/knowledge/SERVER.md.

## Izstrādes noteikumi

- avota kodu rediģē tikai projekta mapē;
- saglabā lietotāja esošās un nesaistītās izmaiņas;
- Git commit vai push veic tikai pēc lietotāja lūguma;
- atkarības pievieno tikai ar skaidru pamatojumu;
- nelieto ārējus fontus, skriptus vai analītiku pēc noklusējuma;
- neveic finanšu noapaļošanu tikai ar vizuālu formatēšanu;
- kļūdas žurnālos neraksta pilnus rēķinu vai personas datus;
- izstrādes serviss klausās tikai uz 127.0.0.1.

## Darbs zem apakšceļa

Lokāli un produkcijā jāpārbauda bāzes ceļš /erekins/. Nedrīkst pieņemt, ka
lietotne vienmēr darbojas domēna saknē. Maršrutiem, aktīviem un pāradresācijām
jāsaglabā /erekins/ prefikss.

## Publicēšana

Klienta daļai publicē index.html un precīzi zināmos failus no assets/ uz
/var/www/vjaanis.gleeze.com/erekins/, saglabājot apakšmapes. OCR servisu palaiž
ar `erekins.service` no projekta mapes un nginx starpnieko `/erekins/api/` uz
`127.0.0.1:3107`.

- OCR sistēmas atkarības ir `tesseract-ocr`, `tesseract-ocr-lav` un
  `tesseract-ocr-eng`;
- dokumentu redzes modelim jaunu `OPENAI_API_KEY` ieraksta tikai projekta
  `.env` failā ar `600` tiesībām; `.env` netiek publicēts vai pievienots Git;
- nginx konfigurācijas izmaiņām obligāti izpilda sudo nginx -t;
- pēc publicēšanas pārbauda HTTP → HTTPS, /erekins/, aktīvus un žurnālus;
- nginx vai serveri nepārstartē bez vajadzības.

## Nodošana

Gala ziņojumā norāda rezultātu, mainītos failus, reāli izpildītās pārbaudes,
publicēšanas statusu un zināmos ierobežojumus.
