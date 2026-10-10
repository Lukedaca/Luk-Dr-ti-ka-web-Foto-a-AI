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
/** Apply owner-reviewed routing corrections without changing facts or permissions. */
export declare function withIntentTraining(config: FrameMindConfig, raw: unknown, tenantId: string): FrameMindConfig;
//# sourceMappingURL=IntentTraining.d.ts.map