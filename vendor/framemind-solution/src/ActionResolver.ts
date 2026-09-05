import { PrivacyGuard } from './PrivacyGuard.js';
import type { ActionDefinition, ContextSnapshot, ResolvedAction } from './types.js';

export class ActionResolver {
  constructor(
    private readonly definitions: ActionDefinition[],
    private readonly privacyGuard: PrivacyGuard,
  ) {}

  resolve(
    intentId: string,
    context: ContextSnapshot,
    availablePaths: string[] = [],
    explicitNavigation = false,
  ): ResolvedAction[] {
    const knownPaths = new Set(availablePaths);
    const actions: ResolvedAction[] = [];
    for (const definition of this.definitions) {
      if (!definition.intentIds.includes(intentId)) continue;
      if (definition.requireExplicitNavigation && !explicitNavigation) continue;
      if (definition.tool === 'navigate') {
        const path = definition.args.path;
        if (!path || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) continue;
        if (path.split('/').includes('..')) continue;
        if (knownPaths.size > 0 && !knownPaths.has(path)) continue;
      }
      const action: ResolvedAction = { id: definition.id, tool: definition.tool, args: { ...definition.args } };
      if (this.privacyGuard.validateAction(action)) actions.push(action);
      if (actions.length >= 1) break;
    }
    return actions;
  }
}
