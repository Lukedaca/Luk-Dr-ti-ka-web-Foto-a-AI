# Osobní web Lukáš Drštička — Voice Engine & Bezpečnostní report (2026-10-30)

Tento dokument shrnuje kompletní vyčištění od závislostí na Microsoft Azure, audit, zabezpečení a modernizaci hlasového subsystému na osobním webu **Lukáš Drštička (Foto & AI)** (`Luk-Dr-ti-ka-web-Foto-a-AI`).

---

## 1 — Kompletní vyřazení Microsoft Azure

- **Text-to-Speech (TTS)**:
  - Odstraněn Microsoft Azure Cognitive Services Speech REST API (`cs-CZ-VlastaNeural`, SSML šablony, klíče `AZURE_SPEECH_KEY` a regiony `AZURE_SPEECH_REGION`).
  - Jediným a výchozím hlasovým enginem je nyní **Google Gemini 3.8 TTS** (`gemini-3.8-flash-lite-tts` s automatickým fallbackem na `gemini-3.8-flash-tts`), hlas **Sulafat**, autentizovaný výhradně přes hlavičku `x-goog-api-key`.
- **Speech-to-Text (STT / „Mluvit hlasem“)**:
  - Vyřazen Azure Speech STS token generator a Azure REST STT endpoint.
  - Hlasový hovor (`voice.js`) nyní využívá nativní **Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)** přímo v prohlížeči. Odpadla potřeba externích tokenů, cloudového nahrávání audia třetím stranám i zbytečná latence.
- **Smazané soubory**:
  - `netlify/functions/azure-speech-token.mjs` (odstraněn)
  - `netlify/functions/voice-token.js` (odstraněn)
  - `src/js/voice-audio.mjs` (odstraněn)
  - `tests/lukas-azure-speech.test.mjs` (nahrazen `tests/lukas-tts.test.mjs`)
  - `tests/voice-audio.test.mjs` (odstraněn)

---

## 2 — Bezpečnostní a architektonické standardy

1. **Nulové úniky API klíče v URL query parametrech**:
   - Všechny požadavky na Google Gemini API (`chat.mjs`, `tour.mjs`, `tts.js`, `tts-stream.mjs`) předávají klíč striktně v HTTP hlavičce `x-goog-api-key`. Žádný `?key=` se nevyskytuje v kódu.
2. **Server-side bezpečnostní brána (`validateTtsRequestSecurity`)**:
   - V `src/lib/chat-privacy.mjs` provádí striktní kontrolu před odesláním požadavku do TTS modelu:
     - Blokuje jakákoliv kontextová pole (`messages`, `history`, `systemPrompt`, `tools`, `context` apod.).
     - Blokuje rodná čísla, bankovní účty, IBAN, karty, čísla dokladů, telefony a soukromé e-maily.
     - Blokuje pokusy o prompt injection a úniky interních instrukcí.
     - Povoluje pouze oficiální veřejný e-mail `lukas.drsticka@gmail.com`.
3. **Normalizace a dělení vět (`speech-text.mjs`)**:
   - Plynulé a přirozené čtení řadových číslovek (`1. FC` → `První FC`), datumů bez vodicí nuly (`02. 11.` → `2. 11.`), sportovních kategorií (`U-15` → `U patnáct`), zkratek a telefonů.
   - `takeCompleteSentences()` nerozděluje věty na zkratkách (`např.`, `tj.`, `st.`).
4. **WAV/PCM extrakce a okamžité přerušení (`chatbot.js` + `tts-guard.mjs`)**:
   - `extractPcmFromBytes()` odstraňuje WAV (`RIFF/WAVE`) kontejner a zarovnává vzorky na sudý počet bajtů.
   - `AbortController` v `chatbotStopSpeech()` okamžitě ukončuje síťový request při přerušení řeči (barge-in).
   - Velikost klientského modulu `voice.min.js` po vyčištění klesla z 9.04 KB na 5.56 KB.

---

## 3 — Výsledky automatizovaných testů

- **Unit & Integration Suite**:
  - `node --test tests/*.test.mjs && node --test vendor/framemind-solution/tests/*.test.mjs`
  - Výsledek: **145/145 testů prošlo úspěšně (0 chyb, 100% zelené)**.
