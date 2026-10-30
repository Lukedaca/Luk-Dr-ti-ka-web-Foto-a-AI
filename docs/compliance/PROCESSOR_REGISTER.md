# Registr zpracovatelů — lukasdrsticka-ai-and-foto.com

Stav k **30. 10. 2026** (ověřeno proti kódu) · Správce: Lukáš Drštička, IČO 29790603
Smlouvy čl. 28 = standardní DPA poskytovatelů → ověřit a archivovat podle
`FrameMind web/docs/compliance/dpa/KONTROLNI_SEZNAM_DPA_POSKYTOVATELU.md`.

| Poskytovatel | Služba | Účel | Údaje | Region | Kód |
|---|---|---|---|---|---|
| Netlify, Inc. (USA) | Hosting, funkce, Forms, Blobs | Provoz webu; kontaktní formulář; bezpečnostní události 30 dní | IP, User-Agent; obsah formuláře; bezpečnostní události s IP | USA / CDN | `netlify.toml`, `netlify/functions/*`, `_lib/security-monitor.mjs` |
| Google (Gemini API) | `gemini-3.8-flash` (fallback `gemini-3.7-flash`) | Odpověď na dotaz, který FrameMind Solution nezná; choreografie prohlídky | Zprávy konverzace bez e-mailů a telefonů; kontext prohlídky bez kontaktů | USA | `netlify/functions/chat.mjs`, `tour.mjs` |
| Google (Gemini TTS) | `gemini-3.8-flash-lite-tts` (Sulafat) | Čtení odpovědí agenta (syntéza řeči na žádost) | Text odpovědi bez PII | USA | `netlify/functions/tts.js`, `tts-stream.mjs` |
| Upstash | Redis | Paměť agenta (jen se souhlasem, souhrn bez kontaktů, 180 dní); počítadlo rate limitu (klíč s IP, vyprší s oknem limitu) | Souhrn témat; IP | **neověřeno** | `_lib/visitor-memory.mjs`, `_lib/limits.mjs` |
| Google (Gmail SMTP) | E-mail | Bezpečnostní upozornění a denní souhrn správci | Typ události, IP, User-Agent | USA | `_lib/alert-sender.mjs` |
| Cloudflare | Turnstile | Ochrana proti botům — **jen pokud jsou nastavené klíče** (k 11. 6. 2026 nebyly) | Token výzvy, IP | USA / globální | `_lib/security.mjs` |

## Neaktivní / odstraněné

- Microsoft Azure Speech — vyřazeno 30. 10. 2026, nahrazeno Gemini TTS a prohlížečovým Web Speech API.
- Formspree — přepis hlasového hovoru, **odstraněno 25. 9. 2026**.
- Gemini Live — hlasový hovor přepsán na Azure 25. 9. 2026.
- Cloudflare Web Analytics — povoleno v CSP, ale skript se na stránkách nenačítá.
