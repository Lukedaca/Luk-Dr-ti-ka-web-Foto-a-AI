import type { ContextSnapshot, IntentMatch } from './types.js';
export declare class ConversationContext {
    private turn;
    private activeIntent;
    private slots;
    private sourceIds;
    snapshot(): ContextSnapshot;
    apply(match: IntentMatch): ContextSnapshot;
    markSource(id: string): void;
    reset(): void;
}
//# sourceMappingURL=ConversationContext.d.ts.map