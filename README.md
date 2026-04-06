# Lukas Drsticka Web

Portfolio web pro fotografii, AI projekty a automatizace. Web je pripraveny pro deploy na Netlify a obsahuje prepinani jazyka `CZ / EN`.

## Co je soucasti

- staticky frontend v rootu projektu
- buildovane assety v `dist/`
- Netlify Functions v `netlify/functions/`
- chat assistant a voice vrstva napojena pres Netlify Functions
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

## AI a voice konfigurace

Pro produkcni provoz je potreba doplnit vlastni environment variables v Netlify.

Minimalne zkontroluj:

- klice pro Google / Gemini endpointy pouzivane v `netlify/functions`
- pripadne dalsi tajne hodnoty podle aktualni implementace backend funkcí

API klice se do repozitare neukladaji.

## Jazykove verze

Web umi:

- prepnout mezi `CZ` a `EN`
- ulozit vybranou verzi do localStorage
- otevrit primo konkretni jazyk pres URL:

```text
/?lang=cs
/?lang=en
```

## Doporuceny release postup

```bash
npm run build
git add .
git commit -m "feat: finalize bilingual website"
git push
```

Po pushi do branche napojene na Netlify se spusti novy deploy automaticky.
