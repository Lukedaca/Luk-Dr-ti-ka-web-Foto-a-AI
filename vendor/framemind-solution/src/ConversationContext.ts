import type { ContextSnapshot, IntentMatch, SlotValue } from './types.js';

export class ConversationContext {
  private turn = 0;
  private activeIntent: string | undefined;
  private slots: Record<string, SlotValue> = {};
  private sourceIds = new Set<string>();

  /** Slot → slots that belong to its value (child → childAge); see FrameMindConfig.slotDependencies. */
  constructor(private readonly dependencies: Record<string, string[]> = {}) {}

  snapshot(): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      turn: this.turn,
      slots: { ...this.slots },
      sourceIds: [...this.sourceIds],
    };
    if (this.activeIntent) snapshot.activeIntent = this.activeIntent;
    return snapshot;
  }

  apply(match: IntentMatch): ContextSnapshot {
    this.turn += 1;
    if (match.id !== 'unknown') {
      this.activeIntent = match.id;
      // Navigation permission is valid only for the current request. Persisting it
      // would allow a later, unrelated turn to trigger an action.
      const { navigationRequested: _ephemeral, ...persistentSlots } = match.slots;
      const kept: Record<string, SlotValue> = { ...this.slots };
      for (const [slot, dependents] of Object.entries(this.dependencies)) {
        const next = persistentSlots[slot];
        if (next === undefined || kept[slot] === undefined || kept[slot] === next) continue;
        for (const dependent of dependents) {
          if (persistentSlots[dependent] === undefined) delete kept[dependent];
        }
      }
      this.slots = { ...kept, ...persistentSlots };
    }
    return this.snapshot();
  }

  markSource(id: string): void {
    if (id) this.sourceIds.add(id);
  }

  reset(): void {
    this.turn = 0;
    this.activeIntent = undefined;
    this.slots = {};
    this.sourceIds.clear();
  }
}
