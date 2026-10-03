# Arhitektūra

## Statuss

Klienta lietotne izmanto HTML, lokāli glabātu Bootstrap 5.3.8 CSS un tīru
JavaScript. Node.js serviss starpnieko dokumentu redzes pieprasījumus un
nodrošina lokālu OCR rezerves režīmu; datubāzes un autentifikācijas nav.
Formas, aprēķinu un XML apstrāde notiek pārlūkā.

## Vides konteksts

    Avota projekts:   /home/kursants/workspace/erekins
    Publiskā adrese:  https://vjaanis.gleeze.com/erekins/
    Web serveris:     nginx
    Publiskie porti:  80 un 443

nginx apkalpo /var/www/vjaanis.gleeze.com kā statisku sakni. Lietotne ir
publicēta apakšmapē /var/www/vjaanis.gleeze.com/erekins/ un pieejama ar HTTPS.

## Risinājums

### Pašreizējā statiskā klienta lietotne

Failus publicē mapē:

    /var/www/vjaanis.gleeze.com/erekins/

Visām saitēm un aktīviem jādarbojas no bāzes ceļa /erekins/, nevis tikai no
domēna saknes. Priekšroka ir relatīviem URL.

### OCR servera puse

- `erekins.service` klausās tikai `127.0.0.1:3107`;
- nginx ceļu `/erekins/api/` pārsūta uz servisu, noņemot `/erekins/api` prefiksu;
- `POST /ocr` pieņem Base64 kodētu PDF, PNG, JPEG, WEBP vai GIF līdz 8 MB un
  pārbauda, vai faila faktiskā galvene atbilst deklarētajam tipam;
- ja ir `OPENAI_API_KEY`, PDF vai attēls ar `store: false` tiek nosūtīts OpenAI Responses
  API modelim `gpt-6-astra` un rezultāts tiek ierobežots ar stingru JSON shēmu;
- API atslēgu ielādē no projekta `.env` faila; tā nekad nenonāk klientā;
- attēla apstrādes kļūmes vai nekonfigurētas atslēgas gadījumā Tesseract ar
  `lav+eng` valodām nolasa tekstu no procesa standarta ievades; PDF failiem
  nepieciešams dokumentu redzes modelis;
- fails netiek rakstīts diskā, datubāzes nav un pieprasījuma saturs netiek žurnalēts;
- atbilde satur strukturētus rēķina laukus, preču rindas, transkripciju,
  izmantotā dzinēja norādi un brīdinājumus;
- vienai IP adresei atļauti astoņi OCR pieprasījumi minūtē;
- atbalstītas arī UBL vienība `MTQ` (m³) un PVN kategorija `AE` (apgrieztā
  maksāšana).

OCR kļūdas ir sagaidāmas, tādēļ klienta forma nekad neeksportē rezultātu bez
esošās lauku validācijas un lietotājam skaidri prasa salīdzināt ar oriģinālu.

## Nemainīgie principi

- noslēpumi dzīvo tikai .env failā ar tiesībām 600;
- publiskajā JavaScript nav noslēpumu;
- naudas aprēķini neizmanto peldošā komata vērtības bez apzinātas noapaļošanas;
- lietotāja ievadi validē pie uzticamības robežas;
- HTML izvadei neizmanto nepārbaudītu innerHTML;
- pamatfunkcija nav atkarīga no trešās puses CDN;
- lietotne korekti darbojas zem /erekins/ bāzes ceļa.

## Failu struktūra

    erekins/
    ├── AGENTS.md
    ├── README.md
    ├── index.html
    ├── assets/
    │   ├── css/styles.css
    │   ├── js/app.js
    │   ├── js/invoice-core.js
    │   └── vendor/bootstrap.min.css
    ├── examples/
    ├── server/ocr-core.mjs
    ├── server/vision.mjs
    ├── server/server.mjs
    ├── package.json
    ├── tests/invoice-core.test.js
    ├── docs/
    │   ├── product.md
    │   ├── architecture.md
    │   ├── design.md
    │   ├── development.md
    │   └── testing.md
