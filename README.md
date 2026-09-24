# Ajaruum · Broneeringud

Valmis koolitöö: JSON-andmetest loodud broneeringute ülevaade eesti keeles.

**Veebileht:** https://marteeowo.github.io/Veeb-is.t---nr1/

## Käivitamine

Vaja on ainult staatilist veebiserverit. Näiteks projekti kaustas:

```sh
python -m http.server 8086
```

Ava http://localhost:8086. Ehitussammu, raamistikku ega rakenduse sõltuvusi pole.

## Ülesande nõuded

- `index.html`: tabeli päiserida ja tühi `tbody`, mitte ühtegi ette kirjutatud andmerida.
- `app.js`: Fetch API, `console.log` enne renderdamist, tabelikeha leidmine DOM-ist, ridade loomine `createElement` ja `append` abil.
- Iga rida saab teenuse järgi klassi `juuksur`, `massaaz`, `spa` või `kosmeetika`.
- `styles.css`: neli erinevat heledat reatausta, teenusemärgised, mobiilivaade ja fookusolekud.
- Lisaks teenusefiltrid, kliendi/teenuse otsing, koguarv, teenuste arvud ja osakaalud, periood, tulemuste arv ning kuupäeva/kellaaja sortimine.
- Laadimine, tühi tulemus, veateade ja uuesti proovimine. Kõik 100 rida on korraga DOM-is; tabeli sees saab kerida.

## Andmeallika CORS-piirang

Rakendus proovib alati esmalt Fetch API-ga õpetaja aadressi:
https://metshein.com/kordamine/json/broneeringud.json

24.09.2026 kontrollimisel ei saatnud server `Access-Control-Allow-Origin` päist. Tavaline brauser blokeerib seetõttu otsepäringu teisest domeenist, ka GitHub Pagesist. Seda ei saa parandada kliendipoolses JavaScriptis; `no-cors` annaks loetamatu vastuse.

Otsepäringu ebaõnnestumisel laadib rakendus Fetch API-ga `data/broneeringud.json` faili. See on 24.09.2026 allikast alla laaditud **muutmata koopia**, mitte väljamõeldud andmed. Lehel on varukoopia kasutamine ja kuupäev nähtav. Mõlema päringu ebaõnnestumisel ilmub veateade. Konsoolis on vastav hoiatus ning laaditud JSON; brauser võib lisaks näidata CORS-võrguviga. Kui allika CORS-päis parandatakse, töötab otsepäring ilma koodimuudatuseta.

Varukoopia ei uuene automaatselt. Uuendamiseks salvesta allika JSON uuesti samasse faili, muuda varukoopia kuupäev `app.js`-is ja avalda muudatus. Nupp „Värskenda” proovib päringuid uuesti, kuid ei muuda serverisse salvestatud koopiat.

## Kontrollimine

```sh
node --check app.js
git diff --check
```

Automaatne brauseritest kasutab eraldi arendustööriistana Playwrighti ja Chromiumi (need ei ole veebilehe sõltuvused):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser.cjs http://localhost:8086/
```

Test kontrollib pärisvõrgu laadimist, konsooliväljundit, tühja algset tabelit, teenuseid, otsingut, filtreid, sortimist, 320/390/768/1440 px vaateid ning eraldi simuleeritud laadimis-, vea-, tühja andmestiku ja taastumise olekuid.

GitHub Pages avaldab `main` haru juurkausta. `.nojekyll` tagab failide tavalise staatilise serveerimise.
