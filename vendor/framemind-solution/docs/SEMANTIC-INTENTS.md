# Sémantická rozhodovací vrstva (1.6.0, opt-in)

Lexikální detekce záměrů zůstává první. Když vrátí `unknown` a nezabere ani doptávka
na předchozí téma („A kde?“), může hostitel nechat rozhodnout lokální embedding model,
**který z existujících záměrů** zpráva myslí. Odpověď pak skládá pravidlo toho záměru
z ověřených záznamů — vrstva nikdy negeneruje text. Když si není jistá, request
pokračuje přesně jako dřív (u konzumentů s řízeným modelem typicky ke Gemini).

Bez `semanticIntents` v konfiguraci se jádro chová jako 1.5.0.

## Zapojení u hostitele

```js
import { SemanticIntentIndex, collectIntentExamples } from '@framemind/solution';

const examples = collectIntentExamples(config.intents);      // examples + exactExamples
const vectors = await embed(examples.map((e) => e.text));    // model hostitele
const index = new SemanticIntentIndex(examples.map((e, i) => ({ intentId: e.intentId, vector: vectors[i] })));

const engine = new FrameMindEngine({
  ...config,
  semanticIntents: {
    processing: 'local',               // povinné: model běží uvnitř nasazení
    resolver: async (text) => index.rank((await embed([text]))[0]),
    minScore: 0.88,                    // výchozí hodnoty viz níže
    minMargin: 0.04,
    excludeIntents: ['recruitment_contact'],
  },
}, snapshot);
```

- **`processing: 'local'` je povinné.** Resolver dostává surový text návštěvníka a
  neprochází `DataPolicy`. Cloudové embedding API by tak obešlo rozhodnutí o odchodu
  dat; jiná hodnota než `'local'` vrstvu vypne.
- Vrstva vybere jen záměr, který má pravidlo odpovědi (`responses`). Vyloučený záměr
  (`excludeIntents`, např. zachycení kontaktu) se nikdy nevybere a nepropadne na druhý
  v pořadí.
- Chyba resolveru = „nejistý“, žádná výjimka ven.
- Odpověď nese `semantic: { intentId, score, margin }`, když záměr vybrala vrstva —
  pro telemetrii a měření.

## Výchozí prahy a jak byly změřené

`DEFAULT_SEMANTIC_MIN_SCORE = 0.88`, `DEFAULT_SEMANTIC_MIN_MARGIN = 0.04` platí pro
**EmbeddingGemma 2** (`onnx-community/embeddinggemma-2-ONNX`, q8, transformers.js 4.3.1,
prefix `task: sentence similarity | query: ` u dotazu i příkladů).

Měření 11. 10. 2026 na konfiguraci Viktorky (38 záměrů, 182 příkladů) a ruční sadě
68 parafrází v záběru + 14 vět mimo záběr, přes skutečný `FrameMindEngine`:

| | správně | špatně | falešná odpověď mimo záběr |
|---|---|---|---|
| jádro bez vrstvy | 29 | 5 | 2 |
| jádro + vrstva | 42 | 5 | 2 |

Všech 13 rozhodnutí vrstvy bylo správných; chyby v tabulce jsou chyby lexikální
detekce. Odstup je důležitější než práh: bez odstupu vrstva odpovídala i na věty mimo
záběr. Sada je malá a prahy byly laděné na ní — jiný model, prefix nebo jazyk je nutné
změřit znovu. Průměrně ~0,3–0,4 s na dotaz na CPU (q8), jen u dotazů, které lexikální
detekce nezná.

## Kde model běží

Jádro nemá závislost na modelu. Model (~314 MB q8 textová část) patří na server
nasazení; v prohlížeči je pro mobily příliš těžký. Místo běhu je součást datového
toku nasazení (registr zpracovatelů, DPIA) — u Viktorky ho určí volba hostingu.

## Vestavěný resolver bez modelu (1.7.0)

Pro nasazení, kde model běžet nemůže (serverless funkce, prohlížeč), má jádro vlastní
resolver: TF-IDF nad znakovými n-gramy (3–5) normalizovaného a stemmovaného textu.
Bez závislostí, bez stahování, ~1–2 ms na celý průchod enginem.

```js
import { ngramSemanticIntents } from '@framemind/solution';

const engine = new FrameMindEngine({
  ...config,
  semanticIntents: ngramSemanticIntents(config.intents, { excludeIntents: ['recruitment_contact'] }),
}, snapshot);
```

`config.intents` musí být finální seznam (po `withIntentTraining`), aby resolver znal
i schválené trénovací příklady. Prahy `NGRAM_SEMANTIC_MIN_SCORE = 0.35`,
`NGRAM_SEMANTIC_MIN_MARGIN = 0.15`.

Měření 11. 10. 2026, konfigurace Viktorky, skutečný engine:

| sada | jádro | jádro + n-gramy |
|---|---|---|
| ladicí (68 v záběru + 14 mimo) | 29 správně / 5 špatně / 2 falešné | 44 / 6 / 2 |
| kontrolní, psaná před měřením (38 + 10) | 23 / 2 / 2 | 29 / 2 / 2 |

Jediná nová chyba je dvojznačná otázka „Kolik se platí za fotbal?“ (vstupné místo
příspěvků). N-gramy poznají parafráze se společným kmenem slova; synonyma bez
společného kmene („tábor“ × „kemp“) poznají jen s trénovacím příkladem nebo
embedding modelem.
