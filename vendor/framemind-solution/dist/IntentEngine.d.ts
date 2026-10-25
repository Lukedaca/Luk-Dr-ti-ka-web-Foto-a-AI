import type { ContextSnapshot, DiscourseSnapshot, IntentDefinition, IntentMatch, SlotPattern } from './types.js';
/** Word that only carries an age slot ("osm", "osmiletý"), not a topic. */
export declare function isAgeToken(token: string): boolean;
export declare class IntentEngine {
    readonly definitions: IntentDefinition[];
    private readonly slotPatterns;
    private readonly trainedExamples;
    constructor(definitions: IntentDefinition[], slotPatterns?: SlotPattern[]);
    hasExactExample(text: string): boolean;
    detect(text: string, context: ContextSnapshot, now?: Date, discourseSnapshot?: DiscourseSnapshot): IntentMatch;
}
//# sourceMappingURL=IntentEngine.d.ts.map