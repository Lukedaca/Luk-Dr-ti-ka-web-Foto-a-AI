# Agent Stage — Design (validováno s Lukášem 2026-07-15)

**Motiv:** Agent jako průvodce. Web = tmavé jeviště, na kterém hybridní agent pracuje. Shadery (liquid metal premium) dělají jeviště, agent je hvězda.

**Rozhodnutí z brainstormu:**
1. Motiv: „Agent jako průvodce" (ne fotka→částice, ne světlo z fotek)
2. Vstup: agent uvítá bublinou, nabídne tour vs. volné prohlížení (ne radikální web=konverzace)
3. Vizuál: liquid metal / shader premium (Paper Shaders — NeuroNoise, LiquidMetal, GodRays, PulsingBorder, Waves)

**Tvrdé zásady (poučení z odmítnutého editorial redesignu):**
- ŽÁDNÉ velké titulky (8rem serif = odmítnuto). Typografie malá, přesná, mono štítky.
- Obsah/copy/sekce se NEMĚNÍ — redesign = jen vizuální vrstva + agent vstup (pravidlo feedback-redesign-keep-content).
- Stavět na design skillech (webgpu-shader-effects), ne handrollovat.
- Fotky nesmí nic přebíjet.

**První dojem:** LiquidMetal logo intro (existující overlay, nová kůže) → NeuroNoise tmavé pozadí se signal blue žílami (pomalé, neinteraktivní) → agentova bublina „Provedu tě?" s volbou. Hlas auto na první gesto.

**Tour:** existující tour.mjs + fallback, nová choreografie světla — cíl kroku svítí (GodRays/spotlight), scéna ztmavne, ghost kurzor (z feat/glass-box-v2) vede.

**Výkon:** 1 shader/viewport, unmount mimo obrazovku, reduced-motion + mobil → statické varianty, barvy z CSS proměnných.

**Deploy:** PR + preview na vizuál, merge po Lukášově OK.
