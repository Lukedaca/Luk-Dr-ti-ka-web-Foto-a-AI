import type { CadenceConfig, ContextSnapshot, KnowledgeRecord } from './types.js';
export declare class ResponseComposer {
    compose(template: string | undefined, record: KnowledgeRecord | undefined, context: Pick<ContextSnapshot, 'slots'> | {
        slots: Record<string, unknown>;
    }, cadence?: CadenceConfig, seed?: string, listConjunction?: string): string;
}
//# sourceMappingURL=ResponseComposer.d.ts.map