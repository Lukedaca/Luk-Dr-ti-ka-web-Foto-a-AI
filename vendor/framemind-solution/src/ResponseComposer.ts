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
    context: Pick<ContextSnapshot, 'slots'> | { slots: Record<string, unknown> },
    cadence?: CadenceConfig,
    seed = '',
    listConjunction?: string,
  ): string {
    const base = template?.trim() || record?.content.trim() || '';
    const values: Record<string, unknown> = {
      ...context.slots,
      ...(record?.data ?? {}),
      record: record ?? {},
    };
    const interpolated = base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path: string) => {
      const value = valueAt(path, values);
      if (value === undefined || value === null) return '';
      if (Array.isArray(value) && listConjunction) {
        const items = value.map(String);
        return items.length < 2
          ? items.join('')
          : `${items.slice(0, -1).join(', ')} ${listConjunction} ${items[items.length - 1]}`;
      }
      return String(value);
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

