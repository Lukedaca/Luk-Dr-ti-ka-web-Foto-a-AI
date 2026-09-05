import { PrivacyGuard } from './PrivacyGuard.js';
import type { ActionDefinition, ContextSnapshot, ResolvedAction } from './types.js';
export declare class ActionResolver {
    private readonly definitions;
    private readonly privacyGuard;
    constructor(definitions: ActionDefinition[], privacyGuard: PrivacyGuard);
    resolve(intentId: string, context: ContextSnapshot, availablePaths?: string[], explicitNavigation?: boolean): ResolvedAction[];
}
//# sourceMappingURL=ActionResolver.d.ts.map