import type { ContextSnapshot, IntentDefinition, IntentMatch } from './types.js';
export declare class IntentEngine {
    readonly definitions: IntentDefinition[];
    constructor(definitions: IntentDefinition[]);
    detect(text: string, context: ContextSnapshot, now?: Date): IntentMatch;
}
//# sourceMappingURL=IntentEngine.d.ts.map