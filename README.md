# POKER – Texas Hold'em proti botům

Single-player Texas Hold'em v prohlížeči. Čisté HTML/CSS/vanilla JS + Bootstrap 5 z CDN, žádný build, žádné npm, žádný backend. Určeno pro hostování na GitHub Pages a hraní hlavně na mobilu jednou rukou (funguje i na desktopu).

## Funkce

- Ty proti 1–5 botům (výchozí 3), start 1 000 žetonů, blindy 10/20 rostoucí každých 8 rukou
- Fold / check / call / raise (slider + tlačítka Min, ½ potu, Pot, All-in)
- Plný průběh: preflop → flop → turn → river → showdown, rotace dealera a blindů
- Heads-up (1 bot) podle pravidel: dealer je malý blind a jedná první preflop
- Side poty, all-iny, vracení nevyrovnaných sázek, split pot s lichým žetonem
- Vyhodnocení 5 z 7 karet včetně kickerů a wheelu A-2-3-4-5, české názvy rukou
- Míchání Fisher-Yates přes `crypto.getRandomValues`
- Čtyři osobnosti botů: **Opatrný** (tight-pasivní), **Divoch** (loose-agresivní), **Blafér**, **Kalkulátor**; při více botech se střídají
- Boti rozhodují podle preflop tabulky (percentil ruky), Monte Carlo equity postflop, pot odds a trochy náhody; před akcí „přemýšlejí“ 0,5–1,5 s
- Karty kreslené v CSS, animace rozdávání a otáčení, zvýraznění vítězné pětice
- Jméno hráče (max 16 znaků) se vždy vykresluje přes `textContent`, nikdy přes `innerHTML`
- Do `localStorage` se ukládá jméno, počet botů, stav žetonů (pokračování hry), nastavení a statistiky
- PWA: manifest, service worker (offline po první návštěvě), ikony

## Struktura projektu

```
index.html            vstupní stránka
css/style.css         styly
js/engine/            čistá herní logika bez DOMu
  deck.js               balíček, shuffle (crypto), parsování karet
  evaluator.js          vyhodnocení rukou, české názvy
  pots.js               side poty a rozdělení potů
  game.js               stavový automat hry (sázkové kolo, blindy, showdown)
  bots.js               osobnosti, preflop tabulka, equity, rozhodování
js/ui/                vykreslování a ovládání
  dom.js, storage.js, messages.js, tableView.js, app.js
tests/                testy herní logiky
test.html             spuštění testů v prohlížeči
manifest.json, sw.js  PWA
icons/                ikony aplikace
```

Herní logika (`js/engine`) nezávisí na DOMu ani na počtu hráčů a je pokrytá testy.

## Spuštění lokálně

Stačí statický server (service worker nefunguje přes `file://`):

```bash
python3 -m http.server 8000
```

a otevřít <http://localhost:8000>.

## Testy

V prohlížeči otevři <http://localhost:8000/test.html>, nebo v terminálu:

```bash
node tests/run-node.js
```

Testy pokrývají mimo jiné royal flush, wheel, kickery, split pot, více all-inů s různými stacky, heads-up i 6 hráčů, šuffle a chování botů. Obsahují také fuzz test, který odehraje stovky rukou s náhodnými akcemi a hlídá zachování žetonů.

## Nasazení na GitHub Pages

1. Pushni repozitář na GitHub (větev `main`).
2. V repozitáři otevři **Settings → Pages**.
3. V sekci **Build and deployment** vyber **Source: Deploy from a branch**.
4. Vyber větev **main** a složku **/ (root)**, ulož.
5. Za minutu nebo dvě bude hra dostupná na `https://kratochvil1993.github.io/POKER/`.

Všechny cesty v aplikaci jsou relativní, takže hra běží i v podadresáři (`/POKER/`).

### Instalace na iPhone

V Safari otevři hru, dej **Sdílet → Přidat na plochu**. Spustí se na celou obrazovku jako aplikace.

### Po úpravách

Service worker používá pro vlastní soubory strategii „nejdřív síť“, takže po nasazení se nové verze načtou hned. Při změně seznamu souborů v `sw.js` zvyš `CACHE_NAME`.

## Licence

Osobní projekt, bez licence.
