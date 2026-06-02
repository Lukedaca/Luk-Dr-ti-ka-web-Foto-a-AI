# Živá ukázka — agent-driven tour (2026-06-02)

## Cíl
Vychytávka pro hybridního agenta na osobním webu, která prodává hybridního agenta **firmám**. Diferenciátor: agent web nejen komentuje, ale **fyzicky ovládá** — mluví (ženský hlas Sulafat) a zároveň scrolluje, zvýrazňuje, filtruje galerii, předvyplní poptávku. Návštěvník (firma) si hned řekne "tohle chci taky".

Mluvící chatboti jsou v 2026 standard; ovládání stránky hlasem ne. Stavíme na existující sadě 24 nástrojů (`_lib/tools.mjs`) — z 80 % hotovo, jen je zřetězíme do choreografie.

## Klíčová vlastnost: AI vrstva (personalizace)
Tour generuje LLM (`gemini-3.5-flash`) dynamicky a **přizpůsobí naraci oboru návštěvníka** (e-shop / služby / restaurace / jiné). "Takhle by to dělal VÁŠ agent." Scripted scénář (CZ/EN) je deterministický fallback, aby demo nikdy nespadlo.

Bilingual: CZ i EN (řízeno `chatbotState` jazykem; pohání naraci i TTS).

## Architektura

### Backend — `netlify/functions/tour.mjs` (nový, samostatný)
- Vstup: `{ context?: string, lang: "cs"|"en" }`.
- `gemini-3.5-flash` (stejný klíč chain `GEMINI_API_KEY||GEMMA_API_KEY||Gemini||GEMINI`) vrátí JSON pole 5–6 kroků:
  `{ "say": "...", "tool": "scroll_to", "args": { "section": "skills" } }`
- **Visual-tool whitelist** (nikdy odesílací akce): `scroll_to, highlight_element, toggle_theme, open_lightbox, play_showreel, filter_gallery, show_project_detail, compare_before_after, show_portfolio_stats, prefill_contact_form, show_pricing, compare_services, check_availability`.
- **Validace** každého kroku proti enumům z `_lib/tools.mjs` (SECTIONS, GALLERY_CATEGORIES, highlight targets). Nevalidní krok se zahodí. Když zbyde < 3 kroků → vrať `null` (frontend vezme scripted fallback).
- `prefill_contact_form` jen demo placeholder data, NIKDY `send_inquiry`.
- Výstup: `{ steps: [...], source: "ai", lang }` nebo `{ steps: null }`.
- chat.mjs se NEMĚNÍ (nižší riziko).

### Frontend — sequencer v `chatbot.js` (prefix `chatbotTour*`)
- Launch: tlačítko `▶ Živá ukázka` / `▶ Live demo` v hlavičce agenta + obor-chips (E-shop / Služby / Restaurace / Obecná).
- `chatbotTourStart(context)`: fetch `/tour` → kroky (nebo scripted fallback).
- Pro každý krok: `chatbotTourSpeak(say, lang)` (recykluje `chatbotRequestSpeechAudio` + queued play, Promise po dohrání) → `chatbotExecuteToolCall({tool,args})` → settle delay (~700 ms) → další.
- Overlay: caption aktuální narace, progress tečky, **Stop** + **Přeskočit**. Stop nastaví `chatbotTourAborted`, zastaví audio.
- Recykluje existující executor i TTS — žádná duplicita.

### Scripted fallback (CZ + EN)
Baked-in pole kroků ve frontendu, identická struktura. Použije se když `/tour` selže/vrátí null nebo offline.

## Bezpečnost / YAGNI
- Tour = jen vizuální akce. Žádné odeslání formuláře.
- v1: jeden skvělý tour CZ+EN, bez Live API/WebSocket.
- Demo neblokuje normální chat; je to spouštěný set-piece.

## Soubory
- nový `netlify/functions/tour.mjs`
- nový `docs/plans/2026-06-02-agent-tour-design.md`
- úprava `src/js/chatbot.js` (sequencer + UI + fallback)
- úprava HTML (launch tlačítko v panelu agenta) + i18n stringy (cs/en)
- bump `?v=` cache verzí
