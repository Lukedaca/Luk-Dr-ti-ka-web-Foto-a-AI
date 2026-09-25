# Klasifikace podle EU AI Act (nařízení 2024/1689) — Lukáš AI

Stav k **25. 9. 2026** · *REQUIRES LEGAL REVIEW* — technické posouzení, ne právní stanovisko.

| Oblast | Výsledek |
|---|---|
| Systém | Hybridní AI agent „Lukáš AI" na osobním webu: odpovědi o focení a projektech, navigace, poptávka, hlas |
| Role | Lukáš Drštička — poskytovatel i zavádějící subjekt vlastního AI systému; Google je poskytovatel GPAI modelu (Gemini) |
| Čl. 5 zakázané praktiky | Nepřítomny |
| Čl. 6 + příloha III | Není vysoce rizikový — nerozhoduje o lidech |
| Čl. 50 odst. 1 | **Splněno technicky:** představení jako AI, pevná pravdivá odpověď na „jsi AI?" jako první krok (`src/lib/ai-disclosure.mjs`, test `tests/lukas-gdpr-ai-act.test.mjs`) |
| Čl. 50 odst. 2 | **Otevřené** — strojově čitelné označení syntetického audia (Azure TTS) není doloženo |
| Čl. 4 AI gramotnost | Jediný provozovatel; doporučeno sepsat krátký záznam o vlastní kompetenci |

Spouštěče revize: automatické rozhodování o lidech, práce s dětmi, změna poskytovatele modelu nebo hlasu mimo EU.
