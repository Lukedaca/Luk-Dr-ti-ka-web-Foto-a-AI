# Cinematic Scroll Redesign — design

**Datum:** 2026-06-11
**Větev:** `feat/cinematic-redesign`
**Rozsah:** jen vizuál + pohyb. Texty, sekce a obsah zůstávají beze změny.

## Cíl

Povýšit osobní web na „cinematic scroll" zážitek ve stylu Studio Freight / Awwwards SOTD,
aniž by se přepisoval obsah nebo rozbila stávající premium-motion infrastruktura
(shutter-line, tilt, magnetic, cursor spotlight, hero particles).

## Vizuální směr

Cinematic Scroll. Paleta z existujících design tokenů: signal blue
(`--signal #4ea2e0`, `--signal-hi #6cbcef`) + steel/silver na tmavém navy. Žádná fialová.

## Stack (CSP-safe, self-hosted)

- **lenis** — buttery smooth scroll. Bundlnuto esbuildem do `dist/js/cinematic.min.js`
  (žádné CDN → CSP `script-src 'self'` zůstává beze změny).
- **split-type** — text → per-char spany pro staggered reveal hero jména.
- Vše ostatní vanilla: IntersectionObserver clip-reveals, rAF velocity marquee.

## Komponenty

1. **Lenis smooth scroll** — `duration 1.15`, expo easing. Kotvy (`a[href^="#"]`)
   přepojeny na `lenis.scrollTo`. Vypnuto při `prefers-reduced-motion`. Touch = nativní scroll.
2. **Split-text hero** — `.hero-name` se skládá po znacích (stagger `--ci × 22ms`).
   `.section-title` ZÁMĚRNĚ vynecháno (gradient background-clip text by se rozbil).
3. **Clip-path reveals** — `.portfolio-item`, `.hero-headline` a opt-in `[data-cine-reveal]`
   se odhalují z `inset()` masky při scrollu. Grid se stagguje po sloupcích (`idx%4 × 70ms`).
   Varianta `"slit"` otevírá z tenké horizontální linky (Studio Freight signature).
4. **Scroll-velocity marquee** — pás brand keywords (Sport · Portrét · Fotografie · AI ·
   Automatizace · Web) mezi hero a agentem. Rychlost reaguje na rychlost scrollu (Lenis velocity).

## Bezpečnost / robustnost

- **Žádný hidden state bez JS.** Všechny počáteční skryté stavy jsou gated pod `html.cine-ready`,
  kterou JS přidá až na konci `boot()`. Když modul selže, stránka je celistvá a viditelná.
- **prefers-reduced-motion** → všechno se resolvuje do klidného finálního stavu (`!important`).
- **CSP beze změny** — vše self-hosted v `/dist`.

## Soubory

- `src/js/cinematic.js` (nový) → `dist/js/cinematic.min.js`
- `src/css/main.css` (+cinematic sekce)
- `index.html` (marquee strip, `<script>` load, verze CSS v36, cinematic v1)
- `scripts/build-js.js` (+`cinematic` do modulů)
- `package.json` (+lenis, +split-type)

## Co je MIMO tento rozsah (čeká na obsah od Lukáše)

- Reference/testimonial (nelze vymyslet falešnou citaci)
- Rozšířený příběh „O mně", ceny/balíčky
- i18n marquee (zatím CZ keywords, dekorativní)

## Nasazení

Větev → Netlify deploy preview → Lukáš schválí → merge do `main`.
