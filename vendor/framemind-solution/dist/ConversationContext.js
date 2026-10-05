export class ConversationContext {
    /** Slot → slots that belong to its value (child → childAge); see FrameMindConfig.slotDependencies. */
    constructor(dependencies = {}) {
        this.dependencies = dependencies;
        this.turn = 0;
        this.slots = {};
        this.sourceIds = new Set();
    }
    snapshot() {
        const snapshot = {
            turn: this.turn,
            slots: { ...this.slots },
            sourceIds: [...this.sourceIds],
        };
        if (this.activeIntent)
            snapshot.activeIntent = this.activeIntent;
        return snapshot;
    }
    apply(match) {
        this.turn += 1;
        if (match.id !== 'unknown') {
            this.activeIntent = match.id;
            // Navigation permission is valid only for the current request. Persisting it
            // would allow a later, unrelated turn to trigger an action.
            const { navigationRequested: _ephemeral, ...persistentSlots } = match.slots;
            const kept = { ...this.slots };
            for (const [slot, dependents] of Object.entries(this.dependencies)) {
                const next = persistentSlots[slot];
                if (next === undefined || kept[slot] === undefined || kept[slot] === next)
                    continue;
                for (const dependent of dependents) {
                    if (persistentSlots[dependent] === undefined)
                        delete kept[dependent];
                }
            }
            this.slots = { ...kept, ...persistentSlots };
        }
        return this.snapshot();
    }
    markSource(id) {
        if (id)
            this.sourceIds.add(id);
    }
    reset() {
        this.turn = 0;
        this.activeIntent = undefined;
        this.slots = {};
        this.sourceIds.clear();
    }
}
//# sourceMappingURL=ConversationContext.js.map