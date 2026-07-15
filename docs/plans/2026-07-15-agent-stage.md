# Agent Stage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Vizuální vrstva „tmavé jeviště pro agenta" — shader scéna (Paper Shaders), ghost kurzor tour se světelnou choreografií, agent uvítání. Obsah/sekce/ID beze změny.

**Architecture:** Vanilla stack zůstává (esbuild moduly, Tailwind). Nový modul `stage.js` = jediný vlastník shaderů (mount/unmount, reduced-motion, CSS var barvy). Ghost kurzor pilíře se berou z hotové větve `feat/glass-box-v2`. Design viz `2026-07-15-agent-stage-design.md`.

**Tech Stack:** @paper-design/shaders (vanilla core, PIN verze), esbuild, existující chatbot.js/tour.mjs.

---

## Kontrakt

- ID kontrakt z `2026-07-15-editorial-redesign.md` platí beze změny (tam je i kontrolní příkaz).
- Copy/sekce/i18n mapy NEDOTČENÉ. netlify/functions NEDOTČENÉ (kromě ničeho).
- **Cache bump: přeskočit spálená čísla!** Editorial krátce shippnul styles v42/boot v48/core v42/i18n v17/chatbot v24 → nové verze: **styles v43, boot v49, core v43, i18n v18, chatbot v25** (jinak CDN/browser cache může servírovat editorial obsah).
- Každý task = build + ID check + commit.

### Task 1: Ghost kurzor základ z glass-box-v2
- `git merge feat/glass-box-v2` do `feat/agent-stage` (main je po revertu na stavu před editorial → mělo by jít čistě; konflikty řešit ve prospěch glass-box verze chatbot.js, cache čísla podle kontraktu výše).
- Build + smoke: bundle obsahuje `chatbotRunAction`/ghost kurzor.
- Commit `feat(agent): ghost kurzor pilíře z glass-box-v2`.

### Task 2: Shader engine stage.js
- `npm i @paper-design/shaders` (pin). Prozkoumat exports (vanilla API) — mount pattern do canvasu.
- Create `src/js/stage.js`: `stageMount(el, shaderName, opts)` + IntersectionObserver unmount + `prefers-reduced-motion` → statická varianta (první frame / CSS gradient fallback) + barvy z `getComputedStyle` (--signal, --ink-900).
- `scripts/build-js.js`: modules + `stage`, − `hero-particles`.
- core.js: load `stage.min.js?v=1`, odstranit hero-particles load.
- Commit `feat(stage): shader engine (Paper Shaders vanilla)`.

### Task 3: Hero scéna
- index.html hero: canvas pro NeuroNoise pozadí (za obsahem, `pointer-events:none`), VŠECHNA hero ID zůstávají. Particle canvas pryč.
- Logo intro overlay: LiquidMetal na LD SVG (stage.js), fallback = stávající SVG animace.
- Agent uvítací bublina (jednou za session, sessionStorage): „Provedu tě?" → `chatbotTourStart()` / zavřít. Auto-voice na první gesto (existující mechanismus).
- Commit `feat(hero): shader scéna + liquid logo + agent uvítání`.

### Task 4: Tour světelná choreografie
- chatbot.js: při tour kroku spotlight overlay (fixed, radial mask na target rect, scéna -20 % jas) + GodRays canvas nad cílem (stage.js API). Cleanup při konci/převzetí řízení.
- Commit `feat(tour): spotlight + god rays choreografie`.

### Task 5: Portfolio akcent + předěly
- PulsingBorder na hover karet (jen desktop, jen viditelné), Waves static linky mezi sekcemi (CSS/canvas static).
- Commit `feat(polish): pulsing border + waves předěly`.

### Task 6: SEO cherry + finální bump + PR
- Ručně vrátit z 980f8b7: JSON-LD sameAs (Lukedaca + reálný LinkedIn), EN i18n title/desc, llms.txt Služby řádek NE (sekce Služby neexistuje — llms.txt nechat podle reálného webu!).
- Všechny cache bumpy dle kontraktu. Build + ID check finální.
- Push, `gh pr create`, preview URL Lukášovi. Merge až po jeho OK.
