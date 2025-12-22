# 🎨 AI Portfolio Web - Lukáš Drštička

Moderní portfolio web kombinující fotografii a AI development, vytvořený pomocí Vibecoding (Claude & Gemini).

## 🚀 Live Demo

[**Zobrazit živou verzi**](#) <!-- Doplň URL až nasadíš -->

## ✨ Hlavní features

### 🤖 Enhanced AI Chatbot
- **Context Awareness** - bot si pamatuje kontext konverzace
- **Intent Detection** - automatická detekce záměru uživatele s confidence scoring
- **Sentiment Analysis** - rozpoznání nálady uživatele
- **Fuzzy Matching** - toleruje překlepy a variace
- **Entity Recognition** - extrakce klíčových informací z dotazů
- **Multi-turn Conversations** - pokročilé dialogové schopnosti

### 🧠 Neural Network Visualization
- Real-time animovaná vizualizace neural network na pozadí
- Neurony reagují na pohyb myši a kliknutí
- 4-vrstvá architektura (5-8-6-4)
- Dynamické gradient animace
- Pulzující efekty

### ✍️ AI Writing Assistant
- Real-time analýza kontaktního formuláře
- Automatické generování profesionálních textů
- Inteligentní návrhy na vylepšení zprávy
- Detekce chybějících informací (termín, rozpočet, typ projektu)
- Tlačítka pro použití AI návrhů

### 🎨 Design & UX
- Glassmorphism UI design
- Gradient animace
- Responsive layout (mobile-first)
- Smooth scroll animations
- Interactive portfolio gallery s lightbox
- Portfolio filtry (Vše / Fotografie / AI Projekty)

## 🛠️ Technologie

- **HTML5** - sémantický markup
- **TailwindCSS** - utility-first styling
- **Vanilla JavaScript** - žádné frameworky, čistý JS
- **Canvas API** - neural network visualization
- **LocalStorage API** - perzistence chat historie

## 📁 Struktura projektu

```

## ?? Sprava portfolia bez backendu (GitHub Pages)

1) Nahraj fotku do `assets/portfolio/`
   - GitHub UI: `Add file` -> `Upload files`
2) Pridej polozku do `data/portfolio.json`
   - Priklad:
```json
[
  {
    "id": "portret-1",
    "name": "Portret",
    "category": "foto",
    "type": "single",
    "images": ["assets/portfolio/portret-1.jpg"],
    "mainImageIndex": 0
  }
]
```
3) Commit/Push -> GitHub Pages se aktualizuje

Doporuceni: pouzivej kratke nazvy bez mezer (napr. `sport-1.jpg`), obrazky predem zkomprimuj (napr. 1600px na delsi strane).

portfolio-web/
├── index.html          # Hlavní soubor webu
├── README.md           # Tento soubor
└── assets/             # (budoucí) obrázky, ikony
```

## 🎯 AI Features v detailu

### Chatbot Engine
```javascript
- Intent Detection s confidence scoring
- Best-of-patterns algoritmus
- Levenshtein distance pro fuzzy matching
- Context management systém
- Sentiment analysis
- Entity extraction
```

### Writing Assistant
```javascript
- Debounced input analysis (500ms)
- Template-based text generation
- Multi-type suggestions (info/warning/success)
- Auto-expansion pro krátké texty
- Smart completion pro chybějící info
```

### Neural Network
```javascript
- 23 neuronů v 4 vrstvách
- 100+ connections mezi vrstvami
- Mouse proximity detection (150px radius)
- Activity-based brightness modulation
- Gradient color transitions
```

## 🚀 Jak použít

### Lokální development
```bash
# Stačí otevřít index.html v prohlížeči
open index.html

# Nebo použít local server (doporučeno)
python -m http.server 8000
# Otevři: http://localhost:8000
```

### Deploy na GitHub Pages
```bash
# 1. Vytvoř repo
git init
git add .
git commit -m "Initial commit"

# 2. Push do GitHubu
git branch -M main
git remote add origin https://github.com/USERNAME/portfolio.git
git push -u origin main

# 3. Zapni GitHub Pages v Settings > Pages
# Vyber branch: main, folder: / (root)
```

## 📝 TODO / Budoucí vylepšení

- [ ] Přidat skutečné projekty do galerie
- [ ] Implementovat backend pro kontaktní formulář
- [ ] Přidat více AI modelů (TensorFlow.js)
- [ ] Dark/Light mode toggle
- [ ] Service Worker pro offline režim
- [ ] Performance optimalizace (lazy loading)
- [ ] SEO optimalizace
- [ ] Analytics integrace
- [ ] Blog sekce
- [ ] Vícejazyčná verze (EN/CS)

## 🎓 Co jsem se naučil

- Pokročilé JavaScript patterns (OOP, functional programming)
- AI/NLP koncepty bez použití externích API
- Canvas API a animace
- UX/UI design principy
- Git workflow
- Responsive design

## 📊 Statistiky projektu

- **Řádky kódu**: ~2000 řádků JS
- **Chatbot intents**: 6 základních intentů
- **AI patterns**: 30+ vzorů pro intent detection
- **Neural connections**: 100+ spojení
- **Dev čas**: X hodin

## 🤝 Kontakt

- **Email**: lukas.drsticka@gmail.com
- **LinkedIn**: [Tvůj LinkedIn](#)
- **GitHub**: [github.com/tvojejmeno](#)

## 📄 Licence

MIT License - volné použití pro osobní i komerční účely

## 🙏 Poděkování

Vytvořeno pomocí:
- Claude (Anthropic) - AI asistent pro vývoj
- Gemini (Google) - Další AI pomoc
- TailwindCSS - Styling framework

---

⭐ **Star this repo** pokud se ti projekt líbí!

💼 **Hledám práci** v oblasti AI/ML nebo Full-stack development

🚀 **Status**: V aktivním vývoji
