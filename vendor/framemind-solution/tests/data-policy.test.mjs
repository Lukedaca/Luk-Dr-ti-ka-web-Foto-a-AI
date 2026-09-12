import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DataPolicy,
  SpeechPrivacyGuard,
  planTranscriptPipeline,
  resolveDataPolicy,
  safeOperationalTelemetry,
} from '../dist/index.js';

const azure = {
  id: 'azure-speech',
  allowedAudiences: ['general', 'may-include-minors'],
  supportedPurposes: ['speech-to-text', 'text-to-speech'],
  allowedRegions: ['westeurope'],
  retention: 'real-time only',
  training: 'not used for prebuilt voice',
  verifiedAt: '2026-09-11',
  documentationUrl: 'https://learn.microsoft.com/azure/ai-services/speech-service/',
};

const telemetryProvider = {
  id: 'local-telemetry',
  allowedAudiences: ['general', 'may-include-minors'],
  supportedPurposes: ['telemetry'],
  allowedRegions: [],
  retention: 'ephemeral RAM operational metrics only',
  training: 'not used for training',
  verifiedAt: '2026-09-11',
  documentationUrl: 'https://framemind.cz/telemetry',
};

function tenant(id = 'tenant-a', overrides = {}) {
  return {
    tenantId: id,
    domain: id + '.example.invalid',
    audience: 'may-include-minors',
    processingMode: 'strict',
    dataMode: 'minimal',
    voice: { enabled: true, mode: 'managed', provider: 'azure-speech', region: 'westeurope', locales: ['cs-CZ'], consentRequired: true },
    retention: { transcript: false, visitorMemory: false, leads: false },
    telemetry: { enabled: true, customerContentAllowed: false },
    ...overrides,
  };
}

test('DataPolicy fails closed for strict managed LLM, unknown fields and protected data', () => {
  const policy = new DataPolicy([tenant()], [azure, telemetryProvider]);
  const base = { tenantId: 'tenant-a', audience: 'may-include-minors', provider: 'azure-speech', processingMode: 'strict', region: 'westeurope' };
  assert.equal(policy.authorizeEgress({ ...base, purpose: 'managed-llm', dataClass: 'visitor-content' }).allowed, false);
  assert.equal(policy.authorizeEgress({ ...base, provider: 'unknown', purpose: 'text-to-speech', dataClass: 'public-data', voiceActivated: true }).reason, 'unknown-provider');
  assert.equal(policy.authorizeEgress({ ...base, purpose: 'unknown-purpose', dataClass: 'public-data' }).allowed, false);
  assert.equal(policy.authorizeEgress({ ...base, purpose: 'text-to-speech', dataClass: 'sensitive-data', voiceActivated: true }).allowed, false);
  assert.equal(policy.authorizeEgress({ ...base, purpose: 'text-to-speech', dataClass: 'internal-data', voiceActivated: true }).allowed, false);
});

test('managed voice needs explicit activation, correct region and SpeechPrivacyGuard blocks visitor PII echo', () => {
  const config = tenant();
  const policy = new DataPolicy([config], [azure, telemetryProvider]);
  const base = { tenantId: 'tenant-a', audience: 'may-include-minors', provider: 'azure-speech', purpose: 'text-to-speech', dataClass: 'public-data', processingMode: 'strict', region: 'westeurope' };
  assert.equal(policy.authorizeEgress({ ...base, voiceActivated: false }).reason, 'voice-not-activated');
  assert.equal(policy.authorizeEgress({ ...base, voiceActivated: true }).allowed, true);

  // Region omission or mismatch must DENY
  assert.equal(policy.authorizeEgress({ ...base, region: undefined, voiceActivated: true }).allowed, false);
  assert.equal(policy.authorizeEgress({ ...base, region: 'eastus', voiceActivated: true }).allowed, false);

  const guard = new SpeechPrivacyGuard(policy, config);
  assert.equal(guard.authorizeTts('Moje cislo je 777 123 456.', 'visitor', true).allowed, false);
  assert.equal(guard.authorizeTts('Klubovy kontakt je na overene verejne strance.', 'verified-public-knowledge', true).allowed, true);
  // PII in verified-public-knowledge must also be denied!
  assert.equal(guard.authorizeTts('Odpoved: telefon 777 123 456', 'verified-public-knowledge', true).allowed, false);
});

test('telemetry requires registered provider and excludes customer content', () => {
  const policy = new DataPolicy([tenant()], [azure, telemetryProvider]);
  // Unknown telemetry provider must DENY with unknown-provider
  const unknownDecision = policy.authorizeEgress({
    tenantId: 'tenant-a', audience: 'may-include-minors', provider: 'unknown-telemetry', purpose: 'telemetry',
    dataClass: 'operational-metadata', processingMode: 'strict',
  });
  assert.equal(unknownDecision.allowed, false);
  assert.equal(unknownDecision.reason, 'unknown-provider');

  // Registered telemetry provider allows operational-metadata
  const validDecision = policy.authorizeEgress({
    tenantId: 'tenant-a', audience: 'may-include-minors', provider: 'local-telemetry', purpose: 'telemetry',
    dataClass: 'operational-metadata', processingMode: 'strict',
  });
  assert.equal(validDecision.allowed, true);
  assert.equal(validDecision.reason, 'operational-metadata-only');

  // Customer content in telemetry must DENY
  const contentDecision = policy.authorizeEgress({
    tenantId: 'tenant-a', audience: 'may-include-minors', provider: 'local-telemetry', purpose: 'telemetry',
    dataClass: 'visitor-content', processingMode: 'strict',
  });
  assert.equal(contentDecision.allowed, false);
  assert.equal(contentDecision.reason, 'telemetry-content-denied');

  assert.deepEqual(safeOperationalTelemetry({ tenant: 'tenant-a', latency_ms: 12, query: 'visitor text', email: 'a@example.cz' }), { tenant: 'tenant-a', latency_ms: 12 });
});

test('visitor-memory purpose is gated by tenant retention and forbids PII', () => {
  const memTenant = tenant('mem-tenant', { retention: { transcript: false, visitorMemory: true, leads: false } });
  const noMemTenant = tenant('no-mem-tenant', { retention: { transcript: false, visitorMemory: false, leads: false } });
  const memoryProvider = {
    id: 'local-memory',
    allowedAudiences: ['general', 'may-include-minors'],
    supportedPurposes: ['visitor-memory'],
    allowedRegions: [],
    retention: 'local memory with opt-in and TTL',
    training: 'never trained',
    verifiedAt: '2026-09-11',
    documentationUrl: 'https://framemind.cz/memory-policy',
  };
  const policy = new DataPolicy([memTenant, noMemTenant], [memoryProvider]);

  // Allowed when visitorMemory is true and data is public/visitor-content
  assert.equal(policy.authorizeEgress({
    tenantId: 'mem-tenant', audience: 'may-include-minors', provider: 'local-memory', purpose: 'visitor-memory',
    dataClass: 'visitor-content', processingMode: 'strict',
  }).allowed, true);

  // Denied when visitorMemory is false
  assert.equal(policy.authorizeEgress({
    tenantId: 'no-mem-tenant', audience: 'may-include-minors', provider: 'local-memory', purpose: 'visitor-memory',
    dataClass: 'visitor-content', processingMode: 'strict',
  }).reason, 'visitor-memory-disabled');

  // Denied when data contains visitor personal data
  assert.equal(policy.authorizeEgress({
    tenantId: 'mem-tenant', audience: 'may-include-minors', provider: 'local-memory', purpose: 'visitor-memory',
    dataClass: 'visitor-personal-data', processingMode: 'strict',
  }).reason, 'visitor-personal-data-denied');
});

test('leadBriefEnabled is uncoupled from transcriptStorageEnabled', () => {
  // In lead mode with LEAD_BRIEF_ENABLED=1 but CHAT_TRANSCRIPT_STORAGE_ENABLED=0
  const envMap = new Map([
    ['FRAMEMIND_DATA_MODE', 'lead'],
    ['LEAD_BRIEF_ENABLED', '1'],
    ['CHAT_TRANSCRIPT_STORAGE_ENABLED', '0'],
  ]);
  const resolved = resolveDataPolicy((name) => envMap.get(name));
  assert.equal(resolved.mode, 'lead');
  assert.equal(resolved.transcriptStorageEnabled, false);
  assert.equal(resolved.leadBriefEnabled, true);

  const pipeline = planTranscriptPipeline(resolved);
  assert.equal(pipeline.storage, false);
  assert.equal(pipeline.leadBrief, true);
});

test('cache scope validates tenant context and resists delimiter injection', () => {
  const policy = new DataPolicy([tenant('tenant-a'), tenant('tenant-b')], [azure]);
  const a = policy.cacheScope('tenant-a', 'azure-speech', 'cs-CZ-VlastaNeural', 'cs-CZ', 'greeting-v1');
  const b = policy.cacheScope('tenant-b', 'azure-speech', 'cs-CZ-VlastaNeural', 'cs-CZ', 'greeting-v1');
  assert.notEqual(a, b);

  // Unknown tenant or provider returns null
  assert.equal(policy.cacheScope('unknown', 'azure-speech', 'voice', 'cs-CZ', 'greeting-v1'), null);

  // Voice locale not in tenant voice.locales returns null
  assert.equal(policy.cacheScope('tenant-a', 'azure-speech', 'cs-CZ-VlastaNeural', 'de-DE', 'greeting-v1'), null);

  // Delimiter injection attempt returns null
  assert.equal(policy.cacheScope('tenant-a:evil', 'azure-speech', 'voice', 'cs-CZ', 'phrase'), null);
});

test('mutating external config objects does not alter DataPolicy (immutability)', () => {
  const rawTenant = tenant('mutable-tenant');
  const rawProvider = { ...azure };
  const policy = new DataPolicy([rawTenant], [rawProvider]);

  // Mutate raw objects externally
  rawTenant.processingMode = 'managed';
  rawTenant.audience = 'general';
  rawProvider.allowedAudiences = ['general'];

  // Policy retains original frozen values
  const decision = policy.authorizeEgress({
    tenantId: 'mutable-tenant',
    audience: 'may-include-minors',
    provider: 'azure-speech',
    purpose: 'text-to-speech',
    dataClass: 'public-data',
    processingMode: 'strict',
    region: 'westeurope',
    voiceActivated: true,
  });
  assert.equal(decision.allowed, true);
});
