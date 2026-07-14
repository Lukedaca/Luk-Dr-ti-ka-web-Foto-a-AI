# Editorial redesign — „Monografie fotografa, který staví AI"

Datum: 2026-07-15 · Schváleno: Lukáš (brainstorm v session)

## Cíl
Osobní web (NE FrameMind funnel). Full overhaul: vizuál + copy + struktura sekcí.
Marketingově správně: jasný positioning, konkrétní služby, social proof, agent vysvětlený.

## Koncept
Foto-editorial / temná komora. Fotky = hrdina. Web jako výtisk foto-magazínu.
Motiv: kontaktní arch, muzejní štítky, kapitoly, čísla stránek.

## Struktura sekcí
1. Hero — fullbleed sportovní fotka, claim, 1 primární CTA
2. Vybraná práce — editorial grid z portfolio.json, kapitoly Sport / Portréty / AI projekty
3. Hybridní agent — „Postavil jsem ho sám, zeptej se" + 3 příklady otázek, živý důkaz
4. O mně — příběh; skill bary s procenty PRYČ (antipattern)
5. Služby — konkrétní deliverables (počet fotek, dodání, formát)
6. Spolupráce — Viktorka + reálná čísla
7. Kontakt — Netlify Forms beze změny

## Vizuální jazyk
- Display: Fraunces variable, self-hosted woff2 (CSP bez změny), titulky až 8rem
- Body: Geist (stávající)
- Paleta: charcoal #0d0e10, slonovina #ece8e1, akcent #4ea2e0
- Fotky: pasparta + muzejní štítek (název/datum/místo)
- Film grain: statická SVG dlaždice, bez animace

## Motion
Lenis (v deps), split-type reveal titulků (v deps), clip-path reveal fotek,
jemný parallax uvnitř rámečku, prefers-reduced-motion všude.

## Copy (CZ + EN, i18n slovníky)
- Hero: „Fotím sport a portréty. A stavím AI, která pracuje za mě." (směr)
- Služby s „co dostanete"
- Agent: „Zeptej se agenta — postavil jsem ho sám"
- Meta/OG/JSON-LD přepsat na nové copy

## Nedotčené
Agent backend (netlify/functions), chat mechanika (chatbot.js hooky),
i18n systém, portfolio.json pipeline, security stack, Netlify Forms,
necommitnuté privacy/transparency změny (zůstávají v working tree).

## Odstranit
Skill bary s procenty, hero-particles.js, neural.js (nahrazuje foto motiv).

## Hygiena
Cache-bust ?v= bump všude, build přes npm run build, deploy = push main → Netlify.
