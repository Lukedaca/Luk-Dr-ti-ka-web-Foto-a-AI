import { composeCadence, selectVariant } from './ConversationalCadence.js';
import type { CadenceConfig, ContextSnapshot, KnowledgeRecord } from './types.js';

function valueAt(path: string, values: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, values);
}

export class ResponseComposer {
  compose(
    template: string | undefined,
    record: KnowledgeRecord | undefined,
    context: ContextSnapshot,
    cadence?: CadenceConfig,
    seed = '',
  ): string {
    const base = template?.trim() || record?.content.trim() || '';
    const values: Record<string, unknown> = {
      ...context.slots,
      ...(record?.data ?? {}),
      record: record ?? {},
    };
    const interpolated = base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path: string) => {
      const value = valueAt(path, values);
      return value === undefined || value === null ? '' : String(value);
    }).replace(/\s+/g, ' ').trim();

    if (!cadence) {
      return interpolated;
    }

    const opener = cadence.openers?.length ? selectVariant(cadence.openers, seed) : '';
    const detail = cadence.details?.length ? selectVariant(cadence.details, seed) : '';
    const hook = cadence.hooks?.length ? selectVariant(cadence.hooks, seed) : '';

    return composeCadence({
      opener,
      core: interpolated,
      detail,
      hook,
    });
  }
}

