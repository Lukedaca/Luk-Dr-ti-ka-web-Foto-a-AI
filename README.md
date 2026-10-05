# Lukas Drsticka Web

Portfolio web pro fotografii, AI projekty a automatizace. Web je pripraveny pro deploy na Netlify a obsahuje prepinani jazyka `CZ / EN`.

## Co je soucasti

- staticky frontend v rootu projektu
- buildovane assety v `dist/`
- Netlify Functions v `netlify/functions/`
- hybridni agent „Lukas AI" (chat + hlas) napojeny pres Netlify Functions
- jazykovy prepinac `CZ / EN` s ulozenim volby a podporou `?lang=cs|en`

## Lokalni spusteni

### 1. Instalace

```bash
npm install
```

### 2. Development

```bash
npm run dev
```

To spusti:

- Tailwind watch
- lokalni staticky server

### 3. Produkcni build

```bash
npm run build
```

Build udela:

- `dist/css/styles.min.css`
- `dist/js/*.min.js`
- optimalizaci obrazku

## Netlify deploy

Projekt je pripraveny pro Netlify z GitHub repozitare.

- build command: `npm run build`
- publish directory: `.`
- functions directory: `netlify/functions`

Konfigurace je v [netlify.toml](./netlify.toml).

## Agent „Lukas AI" (stav 6. 10. 2026)

- Lokalni jadro **FrameMind Solution 1.3.0** ve `vendor/framemind-solution` (prosta kopie, ne subtree; postup v README jadra). Bezi v prohlizeci (`src/js/chatbot.js`) i na serveru (`netlify/functions/chat.mjs` vytvari engine pres `createLukasEngine`); konfigurace je v `src/config/lukas.mjs`. Na Gemini jde dotaz jen kdyz ho jadro nezna, je nastaveny klic a projde `SafetyShield.isSafeForProvider`.
- Nove funkce jadra 1.3.0 (facets, slotDependencies, listConjunction, upsertRecords) jsou opt-in a osobni web je nezapina.
- Co jadro nezna, odpovi Google Gemini: `gemini-3.8-flash`, zalozni `gemini-3.7-flash` (env `GEMINI_CHAT_MODEL` v produkci nenastavena). Prohlidka (`tour.mjs`) take `gemini-3.8-flash`.
- Hlas: Microsoft Azure Speech `northeurope`, jen na zadost navstevnika.
- Kompletni seznam poskytovatelu a dat: `docs/compliance/PROCESSOR_REGISTER.md`.

## AI a voice konfigurace

Environment variables se nastavuji jen v Netlify (nikdy do repozitare). Nazvy, ktere kod cte, najdes prikazem `grep -rhoE "process\.env\.[A-Z_]+" netlify/functions | sort -u` — hodnoty z dashboardu nevypisuj.

## Jazykove verze

Web umi:

- prepnout mezi `CZ` a `EN`
- ulozit vybranou verzi do localStorage
- otevrit primo konkretni jazyk pres URL:

```text
/?lang=cs
/?lang=en
```

## Testy

```bash
npm test   # testy webu (tests/*.test.mjs) + testy vendorizovaneho jadra
```

## Doporuceny release postup

```bash
npm test
npm run build
git add <zmenene soubory>
git commit -m "..."
git push
```

Netlify site `lukasdrsticka` je napojeny na GitHub (`main`), push spusti deploy automaticky a build (`npm run build`) bezi na Netlify — `dist/js` se necommituje.
