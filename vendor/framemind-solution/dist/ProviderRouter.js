import { CircuitBreaker } from './CircuitBreaker.js';
import { DisabledProviderAdapter } from './DisabledProviderAdapter.js';
export class ProviderRouter {
    constructor(adapter, privacyGuard, circuitBreaker = new CircuitBreaker()) {
        this.privacyGuard = privacyGuard;
        this.circuitBreaker = circuitBreaker;
        this.adapter = adapter !== null && adapter !== void 0 ? adapter : new DisabledProviderAdapter();
    }
    async generate(text, locale, context, explicitPermission, allowedContextSlots = [], maxInputChars = 2000) {
        this.privacyGuard.assertProviderAllowed(explicitPermission);
        if (!this.adapter.enabled || !this.circuitBreaker.canAttempt())
            return null;
        const providerText = text.trim().slice(0, Math.max(1, maxInputChars));
        if (!providerText)
            return null;
        const allowed = new Set(allowedContextSlots);
        const slots = Object.fromEntries(Object.entries(context.slots).filter(([key]) => allowed.has(key)));
        const minimizedContext = {
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
        }
        catch {
            this.circuitBreaker.failure();
            return null;
        }
    }
}
//# sourceMappingURL=ProviderRouter.js.map