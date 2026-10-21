# FrameMind Solution 2.1.0

FrameMind Solution is a provider-independent orchestration, knowledge and privacy layer. It is not a foundation model or LLM.

Version 2.1.0 elevates local conversational intelligence across five layers without external API dependencies:
- **Slot-Pivot & Mention-Pivot Ellipsis (`FrameMindEngine`)**: Short follow-ups that only supply a new slot or named entity consumed by the active rule ("A béčko?", "A 2016?", "A s Olomoucí?", "A web?") pivot the active intent locally, including during stateless `history` replay.
- **Colloquial Czech Synonyms & 1-Edit Typo Tolerance (`text.ts`, `IntentEngine`, `SemanticIntents`)**: Secondary fallback pass expands colloquial Czech expressions (`expandCzechSynonyms`) and tolerates single-character substitutions or adjacent transpositions on words >= 6 characters (`isWithinOneEdit`).
- **Multi-Facet & Compound Multi-Intent Composition (`ResponseFacets`, `FrameMindEngine`)**: Combines multiple supplementary facets (`resolveRuleFacet`, e.g. `voice+existing_web`) without duplicating `{{record.content}}`, and resolves two-clause factual compound questions in a single turn (`secondaryIntent`).
- **Progressive Disclosure (`FrameMindEngine`, `ResponseFacets`)**: Follow-up facet turns on a record the visitor already saw in the current session omit the redundant `{{record.content}}` overview prefix.
- **Budget Slot Extraction (`IntentEngine`)**: Extracts Czech budget constraints (`budgetKc`, e.g. "do 10 000 Kč", "do 8 tisíc") into `context.slots`.

Version 2.0.0 enables built-in character n-gram semantic intent resolution by default in `withIntentTraining`, makes stateless `replayHistory` asynchronous so semantic and facet follow-ups work across serverless turns, and adds object-array projection (`{{partners.name}}`) in `ResponseComposer`.

Version 1.8.0 lets a `selectBy` entry take its value from the visitor's text
(`mentioned: true`): the record whose `data[dataField]` the text names, in any Czech word
form, with known values read from the store (live records), never from a phrase list. Other
selectors' slots narrow the candidates and each selector may carry its own `template`. Once
the text names a known value, the rule never answers with its default record; a tie or no
candidate leaves the question to the next layer ("Jak jsme hráli se Slavonínem?" no longer
gets the last match against another opponent). Words that name such a value are not
passed to the semantic layer as intent evidence.

Version 1.7.0 adds a built-in, model-free resolver for that layer
(`ngramSemanticIntents`: TF-IDF over character n-grams of normalized, stemmed text).
It runs in-process in browsers and serverless functions without any download.

Version 1.6.0 adds an opt-in semantic decision layer: when lexical detection returns
`unknown`, a host-supplied local embedding model may select an existing intent, whose
rule still composes the answer from verified knowledge. It never generates text and
requires `processing: 'local'`. See [semantic intents](docs/SEMANTIC-INTENTS.md).

Version 1.5.0 adds opt-in standalone social intents and selects slot values by
their last occurrence in the visitor's message. Each consumer defines its own
social phrases, business rules, factual records and action permissions.

Version 1.4.0 adds owner-reviewed, tenant-scoped intent training packs through
`withIntentTraining`. Corrections match a whole normalized message and select an
existing intent. They leave factual sources, freshness checks and permissions in
the normal engine path. See [local training](docs/INTENT-TRAINING.md).

Version 1.2 adds a canonical fail-closed DataPolicy, provider-neutral voice contracts,
SpeechPrivacyGuard, allowlisted telemetry, and a server-only Azure Speech adapter.
Processing mode, retention mode, and voice mode are separate controls.

Version 1.2.1 answers locally only on the message's own lexical evidence: the follow-up
bonus no longer lets the previous topic capture an unrelated question, which now goes to
`unknown` (and to the managed model when enabled). Rules may add `ageRangeTemplate` to
answer an age without a birth year with both grounded candidate records.

Version 1.2.2 adds `history` to `FrameMindRequest`: stateless hosts (serverless handlers
that create the engine per request) pass prior user turns and a fresh dialogue context is
rebuilt from them, so a follow-up such as "A kdy trénujou?" keeps the age said earlier.
Unsafe turns are skipped; a live session context is never overwritten.

Version 1.2.3 reads a child's age written as a word ("je mu osm", "sedm let", "osmiletý")
in an age context only, adds tenant `slotPatterns` (e.g. a club category typed as "u9" →
`category: "U-9"`, linear-time regex subset only) and lets a rule's `selectBy` be an array
tried in order (the first entry drives `ageRangeTemplate`).

Version 1.2.4 lets one rule combine a default `recordId` with `selectBy`: a slot present
in the context picks its record (e.g. "A kolik to stojí?" after automation → the automation
price), otherwise the default record answers. A present slot without a matching record is
never replaced by the default.

Version 1.3.0 adds four opt-in features; a configuration without them behaves as 1.2.4:
- `facets` on a response rule: exactly one matching facet (keywords as whole words, also
  stemmed) replaces the rule's template, so "Kde je školička?" gets only the place. A short
  message without its own intent ("A kde?", max 5 words) is answered by a facet of the
  previous intent's rule. The response carries `facet`.
- `slotDependencies` in the config: when a slot changes value, dependent slots are cleared
  unless the same message sets them (`{ child: ['childAge', 'birthYear'] }`).
- `listConjunction` in the config: array data render as "pondělí a čtvrtek".
- `engine.upsertRecords(records)`: adds or replaces validated records in a running engine
  (live data that arrive after start).

Version 1.0 provides:

- deterministic local intent matching and slot extraction;
- versioned knowledge records with source and freshness checks;
- ephemeral session context without transcript persistence;
- allowlisted actions that never derive URLs from conversation text;
- local-first response composition;
- an explicitly gated optional provider layer;
- a circuit breaker, privacy guard and local-only voice capability checks;
- a disabled learning sink by default.

Version 1.0.2 additionally verifies knowledge hashes against their content, makes action permission request-scoped, rejects unsafe tenant regular expressions, minimizes managed-provider payloads and provides bounded session isolation for shared server deployments.

Version 1.0.3 keeps SHA-256 verification compatible with ES2019 browser bundles and compiles the distributed core to that target.

Version 1.0.4 introduces the universal `SiteNavigation` module: domain-agnostic DOM scanning for links and dropdown menus, explicit UI action intent detection, fuzzy query-to-link/menu matching with Czech stop-word filtering, and `PendingNavigationManager` for coordinating text/voice TTS playback with page transitions.

`strict` mode never calls a provider. `managed` mode requires an enabled adapter and explicit per-request permission. Known local intents are always resolved before any provider is considered.

## Secure deployment

Browser deployments may keep one `FrameMindEngine` instance per visitor. A server that shares an engine between visitors must configure `sessions.requireSessionId: true` and pass an opaque `sessionId` with every request. Session storage is memory-only, bounded by `maxSessions`, and expires after `idleTtlMs`.

Managed-provider requests require both `allowManagedProvider: true` and an explicit `providerText`. FrameMind never silently substitutes the raw local request. Callers should redact `providerText`; no context slots leave the local boundary unless named in `provider.allowedContextSlots`.

Configured intent patterns use a deliberately restricted regular-expression subset. Repetition, lookarounds, backreferences and patterns longer than 200 characters are ignored.

## Build and test

```bash
npm ci
npm test
```

`dist/` is committed so consuming agents can use a Git subtree without registry access or nested dependency installation during a Netlify build.

## Distribution

Consumers import the versioned `dist/index.js` entry from `vendor/framemind-solution`. Club/persona facts, intents, actions and knowledge snapshots belong to the consumer repository, not this core.

Consumer distribution targets and how the core gets there:

| Consumer | Vendoring | Sync |
|---|---|---|
| `viktorie-prerov-agent` | Git subtree | `git subtree pull --prefix=vendor/framemind-solution <core> main --squash` |
| `framemind-hybrid-sport-agent` | Git subtree | same as above, from its own clone |
| `FrameMind web` (framemind.cz) | plain copy (`dist`, `src`, `tests`, package files, README) | `git -C <core> archive <sha> \| tar -x -C vendor/framemind-solution` |
| `Luk-Dr-ti-ka-web-Foto-a-AI` (personal web) | plain copy (same files, plus `tsconfig.json`) | same as above |
| `framemind-hybrid-agent` (business reference template) | plain copy | same as above |

Consumers that run `scripts/verify-compliance.mjs` (Viktorka, framemind.cz) also keep `coreVersion` in `docs/compliance/deployment-profile.json` equal to the vendored version.

In this workspace, `node scripts/sync-agent-core.mjs --apply` copies the enumerated files for this change and verifies SHA-256. `--check` is read-only.
It does not synchronize unrelated core changes or copy client facts/configuration.

## Compliance boundary

This package provides technical privacy and transparency controls. It is not legal certification of GDPR or EU AI Act compliance.
