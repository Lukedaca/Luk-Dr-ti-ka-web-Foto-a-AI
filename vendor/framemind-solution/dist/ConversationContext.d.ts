import type { ContextSnapshot, IntentMatch } from './types.js';
export declare class ConversationContext {
    private readonly dependencies;
    private turn;
    private activeIntent;
    private slots;
    private sourceIds;
    /** Slot → slots that belong to its value (child → childAge); see FrameMindConfig.slotDependencies. */
    constructor(dependencies?: Record<string, string[]>);
    snapshot(): ContextSnapshot;
    apply(match: IntentMatch): ContextSnapshot;
    markSource(id: string): void;
    reset(): void;
}
//# sourceMappingURL=ConversationContext.d.ts.map