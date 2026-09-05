import type { LearningEvent, LearningSink } from './types.js';
export declare class NoopLearningSink implements LearningSink {
    readonly id = "noop";
    record(_event: LearningEvent): Promise<void>;
}
//# sourceMappingURL=NoopLearningSink.d.ts.map