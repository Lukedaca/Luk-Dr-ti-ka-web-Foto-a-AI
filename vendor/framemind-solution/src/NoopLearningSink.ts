import type { LearningEvent, LearningSink } from './types.js';

export class NoopLearningSink implements LearningSink {
  readonly id = 'noop';

  async record(_event: LearningEvent): Promise<void> {
    // Intentionally empty: v1 never exports raw or pseudonymized conversations.
  }
}
