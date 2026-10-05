# FrameMind Solution 1.3.0

FrameMind Solution is a provider-independent orchestration, knowledge and privacy layer. It is not a foundation model or LLM.

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

Consumers should add this repository as a Git subtree and import the versioned `dist/index.js` entry. Club/persona facts, intents, actions and knowledge snapshots belong to the consumer repository, not this core.

## Compliance boundary

This package provides technical privacy and transparency controls. It is not legal certification of GDPR or EU AI Act compliance.
