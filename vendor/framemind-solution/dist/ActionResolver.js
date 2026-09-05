export class ActionResolver {
    constructor(definitions, privacyGuard) {
        this.definitions = definitions;
        this.privacyGuard = privacyGuard;
    }
    resolve(intentId, context, availablePaths = [], explicitNavigation = false) {
        const knownPaths = new Set(availablePaths);
        const actions = [];
        for (const definition of this.definitions) {
            if (!definition.intentIds.includes(intentId))
                continue;
            if (definition.requireExplicitNavigation && !explicitNavigation)
                continue;
            if (definition.tool === 'navigate') {
                const path = definition.args.path;
                if (!path || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path))
                    continue;
                if (path.split('/').includes('..'))
                    continue;
                if (knownPaths.size > 0 && !knownPaths.has(path))
                    continue;
            }
            const action = { id: definition.id, tool: definition.tool, args: { ...definition.args } };
            if (this.privacyGuard.validateAction(action))
                actions.push(action);
            if (actions.length >= 1)
                break;
        }
        return actions;
    }
}
//# sourceMappingURL=ActionResolver.js.map