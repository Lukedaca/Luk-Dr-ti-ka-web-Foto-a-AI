import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPersonalPortfolioProfile,
  DataPolicy,
} from '../vendor/framemind-solution/dist/index.js';
import {
  createPersonalPortfolioTenantPolicy,
  createPersonalPortfolioProviderRegister,
  createPersonalPortfolioDataPolicy,
  PORTFOLIO_TENANT_ID,
  LOCAL_MEMORY_PROVIDER_ID,
} from '../src/lib/tenant-policy.mjs';
import {
  LUKAS_PROFILE,
  lukasConfig,
  createLukasEngine,
} from '../src/config/lukas.mjs';
import {
  normalizeVisitorId,
  buildMemorySummary,
  buildMemoryContext,
  VISITOR_TTL_DAYS,
} from '../netlify/functions/_lib/visitor-memory.mjs';

test('PersonalPortfolioProfile: correctly initializes portfolio identity and sections', () => {
  assert.equal(LUKAS_PROFILE.domain, 'personal-portfolio');
  assert.equal(LUKAS_PROFILE.id, 'lukas-drsticka-portfolio');
  assert.match(LUKAS_PROFILE.disclosure, /Lukáš AI/i);
  assert.match(LUKAS_PROFILE.privacyNotice, /prohlížeči/i);

  // Sections
  const sectionIds = LUKAS_PROFILE.sections.map((s) => s.id);
  assert.ok(sectionIds.includes('portfolio'));
  assert.ok(sectionIds.includes('skills'));
  assert.ok(sectionIds.includes('o-mne'));
  assert.ok(sectionIds.includes('spoluprace'));
  assert.ok(sectionIds.includes('pricing'));
  assert.ok(sectionIds.includes('kontakt'));
  assert.ok(sectionIds.includes('hybridni-agent'));

  // Capabilities
  const capNames = LUKAS_PROFILE.capabilities.map((c) => c.name);
  assert.ok(capNames.includes('navigation'));
  assert.ok(capNames.includes('gallery_filter'));
  assert.ok(capNames.includes('theme_control'));
  assert.ok(capNames.includes('media'));
  assert.ok(capNames.includes('lead_inquiry'));
});

test('TenantPolicy: personal portfolio tenant has strict privacy and opt-in memory', () => {
  const tenant = createPersonalPortfolioTenantPolicy();
  assert.equal(tenant.tenantId, PORTFOLIO_TENANT_ID);
  assert.equal(tenant.domain, 'lukasdrsticka-ai-and-foto.com');
  assert.equal(tenant.audience, 'general');
  assert.equal(tenant.processingMode, 'strict');
  assert.equal(tenant.dataMode, 'minimal');

  // Retention: transcript is never stored, visitor memory is opt-in, leads are allowed
  assert.equal(tenant.retention.transcript, false);
  assert.equal(tenant.retention.visitorMemory, true);
  assert.equal(tenant.retention.leads, true);

  // Telemetry is disabled
  assert.equal(tenant.telemetry.enabled, false);
  assert.equal(tenant.telemetry.customerContentAllowed, false);
});

test('DataPolicy: authorizes visitor-memory egress only for sanitized content', () => {
  const policy = createPersonalPortfolioDataPolicy();

  // 1. Sanitized visitor content is allowed
  const contentAuth = policy.authorizeEgress({
    tenantId: PORTFOLIO_TENANT_ID,
    audience: 'general',
    provider: LOCAL_MEMORY_PROVIDER_ID,
    purpose: 'visitor-memory',
    dataClass: 'visitor-content',
    processingMode: 'strict',
  });
  assert.equal(contentAuth.allowed, true);
  assert.equal(contentAuth.reason, 'visitor-memory-configured');

  // 2. Raw personal data in visitor-memory is strictly forbidden
  const piiAuth = policy.authorizeEgress({
    tenantId: PORTFOLIO_TENANT_ID,
    audience: 'general',
    provider: LOCAL_MEMORY_PROVIDER_ID,
    purpose: 'visitor-memory',
    dataClass: 'visitor-personal-data',
    processingMode: 'strict',
  });
  assert.equal(piiAuth.allowed, false);
  assert.equal(piiAuth.reason, 'visitor-personal-data-denied');

  // 3. When visitor memory is disabled in tenant policy, egress is denied
  const disabledPolicy = new DataPolicy(
    [createPersonalPortfolioTenantPolicy(() => 'false')],
    createPersonalPortfolioProviderRegister(),
  );
  // simulate tenant with visitorMemory = false
  const noMemTenant = {
    ...createPersonalPortfolioTenantPolicy(),
    retention: { transcript: false, visitorMemory: false, leads: true },
  };
  const policyNoMem = new DataPolicy([noMemTenant], createPersonalPortfolioProviderRegister());
  const deniedAuth = policyNoMem.authorizeEgress({
    tenantId: PORTFOLIO_TENANT_ID,
    audience: 'general',
    provider: LOCAL_MEMORY_PROVIDER_ID,
    purpose: 'visitor-memory',
    dataClass: 'visitor-content',
    processingMode: 'strict',
  });
  assert.equal(deniedAuth.allowed, false);
  assert.equal(deniedAuth.reason, 'visitor-memory-disabled');
});

test('VisitorMemory: ID normalization, TTL, and contact data redaction', () => {
  assert.equal(VISITOR_TTL_DAYS, 180);

  // Normalization
  assert.equal(normalizeVisitorId('visitor-abc-12345'), 'visitor-abc-12345');
  assert.equal(normalizeVisitorId('invalid id with spaces!'), '');
  assert.equal(normalizeVisitorId('short'), '');

  // Summary generation with contact redaction
  const messages = [
    { role: 'user', content: 'Dobrý den, chci nafotit zápas. Můj email je jan.novak@seznam.cz a tel 777 123 456.' },
    { role: 'assistant', content: 'Rád nafotím zápas! Napište mi přes formulář.' },
  ];
  const summary = buildMemorySummary({
    messages,
    assistantText: 'Rád nafotím zápas! Napište mi přes formulář.',
    mode: 'talk',
  });

  assert.match(summary, /\[email\]/);
  assert.match(summary, /\[telefon\]/);
  assert.ok(!summary.includes('jan.novak@seznam.cz'));
  assert.ok(!summary.includes('777 123 456'));

  // Context formatting
  const ctx = buildMemoryContext({ summary, preferences: { last_mode: 'talk' } });
  assert.match(ctx, /OPT-IN PAMET NAVSTEVNIKA/);
  assert.match(ctx, /Posledni rezim: talk/);
});

test('LukasEngine: FrameMindEngine integrates tenant policy and passes data policy checks', async () => {
  const engine = createLukasEngine();
  assert.ok(engine.dataPolicy instanceof DataPolicy);

  // Engine responds to queries normally while enforcing policy
  const res = await engine.respond({ text: 'Ahoj' });
  assert.equal(res.reason, 'known');
  assert.match(res.text, /Lukáš AI/i);
});
