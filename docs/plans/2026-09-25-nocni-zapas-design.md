# Noční zápas — redesign osobního webu (design)

Schváleno Lukášem 25. 9. 2026. Větev `feat/nocni-zapas`, do produkce až po jeho OK na deploy preview.

## Motiv

Web jako stadion po setmění. Jeden motiv, všechno z něj vychází:

- **Světlomety** — dva studené LED kužely (`#e8f1ff`) ze stožárů v horních rozích, natáčí se podle scrollu (CSS `animation-timeline: scroll()`, bez JS, bez WebGL). Bez podpory nebo s `prefers-reduced-motion` stojí.
- **Čáry hřiště** — azur `#38bdf8` z loga, 1 px s jemnou září. Hero = půlicí čára + středový kruh + výkopová značka. Sekce = pomezní čára s rohovým obloukem. Panel agenta = pokutové území s obloukem.
- **Fotky se rozsvítí** — při vjezdu do viewportu z přítmí na plný jas (`animation-timeline: view()`); bez podpory jsou rovnou plně rozsvícené.
- **Soupiska** — výbava podaná jako sestava na zápas: Kód / Foto / AI.
- **Mantinel** — loga FrameMind a FrameMind Sports na bílé LED tabuli (loga v originále na bílé, varianta CZ/EN podle jazyka).
- **Tabule** — agent má hlavičku jako světelná tabule, obsah zůstává čitelný text.

Podklad `#06080d`, text `#eceff4`. Malá přesná typografie (Geist + systémové mono na štítky), žádné obří titulky.

## Fotky

Vždy v původním poměru stran — žádné `object-fit: cover`, nic se neořízne. `width`/`height` atributy odpovídají skutečným rozměrům (CLS).

## Obsah

Copy beze změny. Nové: sekce FrameMind (mantinel), Soupiska, credit v patičce
„Redesign: Lukáš Drštička & Jarvis (Claude Code · Opus 5.5)". Soupiska jen z ověřených zdrojů
(GitHub repozitáře, Lukášovo zadání) — žádné názvy modelů.

## Úklid

- Homepage i galerie přestanou tahat `assets/styles.css`, `swiss-redesign.css`, `remove-tech-stack.css`.
- `main.css` zkrácen na Tailwind + font + hlasový orb.
- 11 galerií: vložené `<style>` bloky pryč, jeden `assets/gallery.css`.
- Hlavička statická.

## Anti-slop

Žádné gradientové plochy, bloby, glassmorphism, emoji, generické ikony ani vymyšlená čísla.
Každý efekt musí mít stadionový důvod.
