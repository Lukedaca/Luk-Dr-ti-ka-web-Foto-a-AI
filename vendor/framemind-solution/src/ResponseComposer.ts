import type { ContextSnapshot, KnowledgeRecord } from './types.js';

function valueAt(path: string, values: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, values);
}

export class ResponseComposer {
  compose(template: string | undefined, record: KnowledgeRecord | undefined, context: ContextSnapshot): string {
    const base = template?.trim() || record?.content.trim() || '';
    const values: Record<string, unknown> = {
      ...context.slots,
      ...(record?.data ?? {}),
      record: record ?? {},
    };
    return base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path: string) => {
      const value = valueAt(path, values);
      return value === undefined || value === null ? '' : String(value);
    }).replace(/\s+/g, ' ').trim();
  }
}
