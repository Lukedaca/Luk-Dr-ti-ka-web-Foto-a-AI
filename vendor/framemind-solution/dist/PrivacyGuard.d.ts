import type { FrameMindMode, ResolvedAction } from './types.js';
export declare class PrivacyGuard {
    readonly mode: FrameMindMode;
    constructor(mode: FrameMindMode);
    assertProviderAllowed(explicitPermission: boolean): void;
    validateAction(action: ResolvedAction): boolean;
    safeEvent(event: string, fields?: Record<string, string | number | boolean>): Record<string, string | number | boolean>;
}
//# sourceMappingURL=PrivacyGuard.d.ts.map