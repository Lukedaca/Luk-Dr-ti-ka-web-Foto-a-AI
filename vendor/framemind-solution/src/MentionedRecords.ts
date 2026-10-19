import type { KnowledgeRecord, SelectBy, SlotValue } from './types.js';
import { normalizeText, stemCzechWord } from './text.js';

// 1.8.0 — record selection by a value the visitor names ("se Slavonínem" → opponent
// "FK Slavonín"). Known values come from the store, so live data define what can be named.

/** Shorter words are mostly prepositions and abbreviations ("nad", "u", "FK"). */
const MIN_WORD_LENGTH = 4;

function words(value: string): string[] {
  return normalizeText(value).split(' ').filter((word) => word.length >= MIN_WORD_LENGTH && !/^\d+$/.test(word));
}

/**
 * Same word in another case: each form starts with the other's stem. Both directions, so
 * "start" does not name "Staré" although the stems "start"/"star" share a prefix.
 */
function sameWord(a: string, b: string): boolean {
  return a.startsWith(stemCzechWord(b)) && b.startsWith(stemCzechWord(a));
}

function stringValues(record: KnowledgeRecord, field: string): string[] {
  const value = record.data?.[field];
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Score of every known value the text names. A word naming several values counts
 * proportionally less ("Velkou" fits "Velká Bystřice" and "Velké Losiny"; "Bystřicí" decides).
 */
export function mentionScores(text: string, knownValues: Iterable<string>): Map<string, number> {
  const valueWords = new Map<string, string[]>();
  for (const value of knownValues) if (!valueWords.has(value)) valueWords.set(value, words(value));
  const scores = new Map<string, number>();
  for (const word of new Set(words(text))) {
    const named = [...valueWords].filter(([, list]) => list.some((item) => sameWord(word, item))).map(([value]) => value);
    for (const value of named) scores.set(value, (scores.get(value) ?? 0) + 1 / named.length);
  }
  return scores;
}

/** Known values of the given fields across records. */
export function knownValues(records: KnowledgeRecord[], fields: Iterable<string>): string[] {
  const list = [...fields];
  return records.flatMap((record) => list.flatMap((field) => stringValues(record, field)));
}

/**
 * The text without words that name a known value. A name says what the visitor asks about,
 * not what they want to know, so it must not count as evidence for an intent.
 */
export function withoutMentions(text: string, values: Iterable<string>): string {
  const valueWords = [...new Set([...values].flatMap(words))];
  if (!valueWords.length) return text;
  return text
    .split(/\s+/)
    .filter((token) => {
      const word = normalizeText(token);
      return word.length < MIN_WORD_LENGTH || !valueWords.some((item) => sameWord(word, item));
    })
    .join(' ');
}

export type MentionSelection =
  | { kind: 'none' }
  | { kind: 'record'; record: KnowledgeRecord; selector: SelectBy }
  | { kind: 'unresolved' };

/**
 * `none` = the text names no known value (other selectors decide as before), `record` = the
 * first mention selector with a clear winner, `unresolved` = a known value was named but no
 * selector settles it, so the caller must not substitute a default record.
 */
export function selectMentioned(
  text: string,
  selectors: SelectBy[],
  records: KnowledgeRecord[],
  slots: Record<string, SlotValue | undefined>,
  defaultRecord?: KnowledgeRecord,
  usable: (record: KnowledgeRecord) => boolean = () => true,
): MentionSelection {
  const mentionSelectors = selectors.filter((selector) => selector.mentioned);
  if (!mentionSelectors.length || !text) return { kind: 'none' };
  const scores = mentionScores(text, knownValues(records, new Set(mentionSelectors.map((selector) => selector.dataField))));
  if (!scores.size) return { kind: 'none' };

  const narrowing = selectors.filter((selector) => !selector.mentioned && selector.slot && slots[selector.slot] !== undefined);
  const narrowingFields = selectors.filter((selector) => !selector.mentioned && selector.slot).map((selector) => selector.dataField);
  for (const selector of mentionSelectors) {
    // Expired records still say what can be named, but never answer: an upcoming match from
    // an earlier load must not hide the result of the same match.
    const pool = records.filter((record) => (!selector.recordType || record.type === selector.recordType)
      && usable(record)
      && stringValues(record, selector.dataField).some((value) => scores.has(value))
      && narrowing.every((item) => record.data?.[item.dataField] === slots[item.slot!]));
    if (!pool.length) continue;
    const scoreOf = (record: KnowledgeRecord) => Math.max(...stringValues(record, selector.dataField).map((value) => scores.get(value) ?? 0));
    const best = Math.max(...pool.map(scoreOf));
    const top = pool.filter((record) => scoreOf(record) === best);
    const topValues = new Set(top.map((record) => stringValues(record, selector.dataField).find((value) => scores.get(value) === best)));
    if (topValues.size > 1) return { kind: 'unresolved' };
    // Same value for several records (two teams played the same opponent): without a slot
    // from the text, the rule's default record says which one is meant; else store order.
    const preferred = !narrowing.length && defaultRecord
      ? top.find((record) => narrowingFields.every((field) => record.data?.[field] === defaultRecord.data?.[field]))
      : undefined;
    return { kind: 'record', record: preferred ?? top[0]!, selector };
  }
  return { kind: 'unresolved' };
}
