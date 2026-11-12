# POKER – Texas Hold'em proti botům

Single-player Texas Hold'em v prohlížeči. Čisté HTML/CSS/vanilla JS + Bootstrap 5 z CDN, žádný build, žádný backend. Určeno pro hostování na GitHub Pages a hraní hlavně na mobilu jednou rukou.

> Stav: ve vývoji. Tento README se průběžně doplňuje.

## Plánované funkce

- Hráč proti 1–5 botům, start 1000 žetonů, rostoucí blindy
- Fold / check / call / raise / all-in, side poty, split pot
- Boti s odlišnými osobnostmi (tight-pasivní, loose-agresivní, blafér, kalkulátor)
- Responzivní UI (mobile-first), karty kreslené v CSS/SVG
- Ukládání jména, počtu botů, žetonů a statistik do `localStorage`
- PWA (manifest + service worker)

## Struktura projektu

```
index.html        vstupní stránka
css/              styly
js/engine/        čistá herní logika bez DOMu (deck, evaluator, pot manager, betting, boti)
js/ui/            vykreslování a ovládání
test.html         testy herní logiky (otevřít v prohlížeči)
```

## Spuštění lokálně

Stačí statický server (kvůli service workeru nestačí otevřít soubor přes `file://`):

```bash
python3 -m http.server 8000
```

a otevřít <http://localhost:8000>.

## Nasazení na GitHub Pages

1. Pushni repozitář na GitHub (větev `main`).
2. V repozitáři otevři **Settings → Pages**.
3. V sekci **Build and deployment** vyber **Source: Deploy from a branch**.
4. Vyber větev **main** a složku **/ (root)**, ulož.
5. Za minutu nebo dvě bude hra dostupná na `https://kratochvil1993.github.io/POKER/`.

## Licence

Osobní projekt, bez licence.
