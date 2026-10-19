import type { FrameMindConfig } from './types.js';
export interface IntentTrainingPack {
    schemaVersion: 1;
    tenantId: string;
    revision: number;
    examples: Array<{
        text: string;
        intentId: string;
    }>;
}
export interface IntentTrainingOptions {
    /** Enable built-in character n-gram semantic intent resolver (default: true in v2.0.0). */
    semanticIntents?: boolean;
    /** Intents excluded from semantic similarity selection. */
    excludeIntents?: readonly string[];
}
/** Apply owner-reviewed routing corrections without changing facts or permissions. */
export declare function withIntentTraining(config: FrameMindConfig, raw: unknown, tenantId: string, options?: IntentTrainingOptions): FrameMindConfig;
//# sourceMappingURL=IntentTraining.d.ts.map