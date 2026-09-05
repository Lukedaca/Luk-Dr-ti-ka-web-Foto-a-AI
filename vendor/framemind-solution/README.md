# FrameMind Solution 1.0.4

FrameMind Solution is a provider-independent orchestration, knowledge and privacy layer. It is not a foundation model or LLM.

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
