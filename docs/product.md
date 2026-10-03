# Produkts

## Darba nosaukums

E-rēķins

## Plānotā adrese

https://vjaanis.gleeze.com/erekins/

## Pašreiz zināmais

Lietotne palīdz privātpersonai vai saimnieciskās darbības veicējam pārlūkā
sagatavot rēķina datus, pārbaudīt pamatlaukus, izveidot UBL XML un saglabāt
drukājamu PDF. Dati netiek sūtīti uz serveri vai tur saglabāti.

## Apstiprinātais sākotnējais tvērums

1. Lietotne veido rēķinu un aprēķina summas, bet rēķinus neglabā.
2. Galvenais lietotājs ir privātpersona vai individuāls sagatavotājs.
3. Autentifikācija un vairāki lietotāji nav nepieciešami.
4. Formas un XML dati tiek apstrādāti pārlūkā; OCR attēls viena pieprasījuma
   laikā tiek apstrādāts servera atmiņā un netiek saglabāts.
5. Pieejams UBL XML eksports un pārlūka drukas PDF.
6. Var importēt un rediģēt PEPPOL / EN 16931 UBL Invoice XML.
7. Rēķina attēlu strukturēti nolasa servera pusē pieslēgts OpenAI dokumentu
   redzes modelis. Ja tas nav pieejams, darbojas lokāls Tesseract OCR.
   Atpazītie lauki un pilnais teksts pirms eksporta lietotājam jāpārbauda.
8. OCR atbalsta PDF, PNG, JPEG, WEBP un GIF failus līdz 8 MB. PDF failu tekstu
   un lapu attēlus analizē dokumentu redzes modelis; lokālais rezerves OCR
   paredzēts tikai attēliem.

## Sākotnējie kvalitātes principi

- saskarne ir latviešu valodā un saprotama bez tehniskām zināšanām;
- lietotājs pirms saglabāšanas vai eksporta var pārskatīt rezultātu;
- aprēķini ir paredzami, pārbaudāmi un skaidri izskaidroti;
- sensitīvi dati netiek vākti vai glabāti bez apstiprinātas vajadzības;
- kļūdas ir redzamas tekstā, nevis tikai ar krāsu;
- galvenā plūsma darbojas ar tastatūru un mobilajā ierīcē.
- OpenAI API atslēga dzīvo tikai servera `.env` failā ar `600` tiesībām;
  publiskajā JavaScript nav atslēgu.
- datus jāsagatavo LV e-rēķina izveidošanai šis varētu būt galvenais logs
- izveido rēķina pārskata - rediģēšanas iespēju ar norādēm par obligati nepieciešamo informaciju
- paredzi pēc pārskata e-rēķina lejuplādi
- jāparedz iespēju ielādēt arī e-ŗēķinu lai varētu to apskatīt un izveidot PDF


# Galvenie lietošanas scenāriji

1. Lietotājs augšupielādē UBL XML rēķinu, to labo un lejupielādē atjaunotu XML.
2. Lietotājs pats aizpilda e-rēķina datus un lejupielādē UBL XML.
3. Lietotājs importē vai aizpilda rēķinu un drukas skatā saglabā PDF dokumentu.
4. Lietotājs augšupielādē rēķina PDF,jpg, attēlu  pārbauda OCR tekstu un labo automātiski
   aizpildītos laukus pirms XML vai PDF izveides.

Kļūdas paziņojumā norāda konkrēto lauku. Obligātie lauki ir atzīmēti. Lietotne
neļauj eksportēt XML, kam nav izturēta lokālā pamatvalidācija. Pilna PEPPOL
Schematron atbilstība jāpārbauda specializētā ārējā validatorā.

# Tīmekļa vietnes saturs

Saturam jābūt latviešu valodā.

# Tīmekļa lietotnes arhitektūra

Šī ir vienas lapas tīmekļa vietne.
Tīmekļa lietotnei jābūt vienkāršai, lai to varētu lietot bez visādu papildu rīku instalēšanas. Tas nozīmē HTML, CSS, JS.
Izmanto Bootstrap. Ja vajag, te ir dokumentācija: https://getbootstrap.com/docs/
Strukturētos datus no PDF un rēķinu attēliem iegūst OpenAI API dokumentu redzes
modelis ar servera puses starpnieku. UBL XML imports joprojām notiek tikai
pārlūkā un netiek sūtīts API.

## E-rēķinu piemēri

Derīgu e-rēķinu piemēri atrodas mapē `examples`.
Izmanto tos, lai saprastu e-rēķinu struktūru, izstrādātu un pārbaudītu XML ģenerēšanu un veidotu testus.
Piemēri neaizstāj e-rēķina specifikāciju. Ja piemērs un specifikācija šķiet pretrunīgi, par autoritatīvu uzskati specifikāciju.

# Izmaiņu veikšana
Veicot izmaiņas pārbaudi vai nevajag atjaunināt Aģenta failu.
