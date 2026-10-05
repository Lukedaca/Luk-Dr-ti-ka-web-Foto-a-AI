import type { ContextSnapshot, DiscourseSnapshot, IntentDefinition, IntentMatch, SlotPattern } from './types.js';
export declare class IntentEngine {
    readonly definitions: IntentDefinition[];
    private readonly slotPatterns;
    constructor(definitions: IntentDefinition[], slotPatterns?: SlotPattern[]);
    detect(text: string, context: ContextSnapshot, now?: Date, discourseSnapshot?: DiscourseSnapshot): IntentMatch;
}
//# sourceMappingURL=IntentEngine.d.ts.map