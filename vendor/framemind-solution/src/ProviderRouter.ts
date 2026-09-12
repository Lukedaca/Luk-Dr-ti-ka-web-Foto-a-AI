import { CircuitBreaker } from './CircuitBreaker.js';
import { DataPolicy } from './DataPolicy.js';
import { DisabledProviderAdapter } from './DisabledProviderAdapter.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import { SafetyShield } from './SafetyShield.js';
import type { ContextSnapshot, ProviderAdapter, ProviderResponse, TenantDeploymentPolicy } from './types.js';

export class ProviderRouter {
  private readonly adapter: ProviderAdapter;

  constructor(
    adapter: ProviderAdapter | undefined,
    private readonly privacyGuard: PrivacyGuard,
    private readonly circuitBreaker = new CircuitBreaker(),
    private readonly dataPolicy?: DataPolicy,
    private readonly tenantPolicy?: TenantDeploymentPolicy,
  ) {
    this.adapter = adapter ?? new DisabledProviderAdapter();
  }

  async generate(
    text: string,
    locale: string,
    context: ContextSnapshot,
    explicitPermission: boolean,
    allowedContextSlots: string[] = [],
    maxInputChars = 2000,
  ): Promise<ProviderResponse | null> {
    this.privacyGuard.assertProviderAllowed(explicitPermission);
    if (!this.dataPolicy || !this.tenantPolicy) return null;
    const decision = this.dataPolicy.authorizeEgress({
      tenantId: this.tenantPolicy.tenantId,
      audience: this.tenantPolicy.audience,
      provider: this.adapter.id,
      purpose: 'managed-llm',
      dataClass: 'visitor-content',
      processingMode: this.tenantPolicy.processingMode,
    });
    if (!decision.allowed) return null;
    if (!this.adapter.enabled || !this.circuitBreaker.canAttempt()) return null;
    const providerText = text.trim().slice(0, Math.max(1, maxInputChars));
    if (!providerText || !SafetyShield.isSafeForProvider(providerText)) return null;
    const allowed = new Set(allowedContextSlots);
    const slots = Object.fromEntries(Object.entries(context.slots).filter(([key]) => allowed.has(key)));
    const minimizedContext: ContextSnapshot = {
      turn: context.turn,
      slots,
      sourceIds: [],
      ...(context.activeIntent ? { activeIntent: context.activeIntent } : {}),
    };
    try {
      const response = await this.adapter.generate({ text: providerText, locale, context: minimizedContext });
      if (!response || typeof response.text !== 'string' || typeof response.providerId !== 'string') {
        throw new Error('invalid provider response');
      }
      this.circuitBreaker.success();
      return { ...response, text: response.text.trim().slice(0, 8000) };
    } catch {
      this.circuitBreaker.failure();
      return null;
    }
  }
}
