import type { ContextSnapshot, DiscourseSnapshot, IntentDefinition, IntentMatch, SlotValue } from './types.js';
import { escapeRegExp, hasExplicitNavigation, monthFromText, normalizeText, stemText } from './text.js';

function includesTerm(text: string, term: string): boolean {
  const normalized = normalizeText(term);
  if (!normalized) return false;
  return new RegExp(`(?:^|\\s|-)${escapeRegExp(normalized)}(?:$|\\s|-)`).test(text);
}

function includesStemmedTerm(stemmedText: string, term: string): boolean {
  const stemmedTerm = stemText(normalizeText(term));
  if (!stemmedTerm) return false;
  return new RegExp(`(?:^|\\s|-)${escapeRegExp(stemmedTerm)}(?:$|\\s|-)`).test(stemmedText);
}

function isSafePattern(pattern: string): boolean {
  if (!pattern || pattern.length > 200) return false;
  // Tenant patterns intentionally support only a linear-time regex subset.
  // Repetition, lookarounds and backreferences are rejected to prevent ReDoS.
  if (/[+*{]/.test(pattern)) return false;
  if (/\\[1-9]|\\k<|\(\?/.test(pattern)) return false;
  return true;
}

function extractSlots(normalized: string, now: Date): Record<string, SlotValue> {
  const slots: Record<string, SlotValue> = {};
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (yearMatch?.[1]) slots.birthYear = Number(yearMatch[1]);

  const ageMatch = normalized.match(/\b(?:ma|je mu|je ji|je)\s+(\d{1,2})\b/);
  if (ageMatch?.[1]) slots.childAge = Number(ageMatch[1]);

  const nextAgeMatch = normalized.match(/\bv\s+[a-z]+\s+(\d{1,2})\b/);
  if (nextAgeMatch?.[1]) slots.nextAge = Number(nextAgeMatch[1]);

  const birthdayMonth = monthFromText(normalized, 'v');
  if (birthdayMonth) slots.birthdayMonth = birthdayMonth;

  const statedCurrentMonth = monthFromText(normalized, 'ted je');
  const currentMonth = statedCurrentMonth ?? now.getUTCMonth() + 1;
  slots.currentMonth = currentMonth;
  slots.currentYear = now.getUTCFullYear();

  if (!slots.birthYear && typeof slots.nextAge === 'number' && typeof slots.childAge === 'number') {
    const nextAge = slots.nextAge;
    const childAge = slots.childAge;
    if (nextAge === childAge + 1 && typeof slots.birthdayMonth === 'number' && currentMonth < slots.birthdayMonth) {
      slots.birthYear = now.getUTCFullYear() - nextAge;
    }
  }

  if (!slots.birthYear && typeof slots.childAge === 'number' && /\bro[cč]n[ií]k\b/.test(normalized)) {
    slots.birthYear = slots.childAge;
    delete slots.childAge;
  }

  if (hasExplicitNavigation(normalized)) slots.navigationRequested = true;
  return slots;
}

function scoreIntent(definition: IntentDefinition, normalized: string, stemmed: string): number {
  let evidence = 0;
  for (const example of definition.examples ?? []) {
    const candidate = normalizeText(example);
    if (candidate && normalized === candidate) evidence += 120;
    else if (candidate && normalized.includes(candidate)) evidence += 60;
  }
  for (const keyword of definition.keywords ?? []) {
    if (includesTerm(normalized, keyword)) {
      evidence += 18;
    } else if (includesStemmedTerm(stemmed, keyword)) {
      evidence += 16;
    }
  }
  for (const group of definition.keywordGroups ?? []) {
    const allMatch = group.every((keyword) => includesTerm(normalized, keyword) || includesStemmedTerm(stemmed, keyword));
    if (allMatch) evidence += 55 + group.length * 5;
  }
  for (const pattern of definition.patterns ?? []) {
    if (!isSafePattern(pattern)) continue;
    try {
      if (new RegExp(pattern, 'i').test(normalized)) evidence += 70;
    } catch {
      // Invalid tenant patterns must not break local answers.
    }
  }
  return evidence > 0 ? evidence + (definition.priority ?? 0) : 0;
}

export class IntentEngine {
  readonly definitions: IntentDefinition[];

  constructor(definitions: IntentDefinition[]) {
    this.definitions = definitions.slice();
  }

  detect(
    text: string,
    context: ContextSnapshot,
    now = new Date(),
    discourseSnapshot?: DiscourseSnapshot,
  ): IntentMatch {
    const normalizedText = normalizeText(text).slice(0, 2000);
    const stemmedText = stemText(normalizedText);
    const slots = extractSlots(normalizedText, now);

    if (discourseSnapshot?.activeEntity) {
      slots.activeEntityType = discourseSnapshot.activeEntity.type;
      slots.activeEntityName = discourseSnapshot.activeEntity.name;
    }

    let best: IntentDefinition | undefined;
    let bestScore = 0;
    let followUp = false;

    for (const definition of this.definitions) {
      let score = scoreIntent(definition, normalizedText, stemmedText);
      const follows = Boolean(context.activeIntent && definition.followUpFor?.includes(context.activeIntent));
      if (follows && (slots.childAge || slots.birthYear || slots.nextAge)) score += 95;

      // Anaphora boost: if definition matches followUp for last active intent in discourse
      if (discourseSnapshot?.lastIntent && definition.followUpFor?.includes(discourseSnapshot.lastIntent)) {
        if (/^(?:a\s+)?(?:kolik|kde|kdy|jak|proc|cena|rozpis|trener|adresa)\b/i.test(normalizedText)) {
          score += 65;
        }
      }

      if (score > bestScore) {
        best = definition;
        bestScore = score;
        followUp = follows;
      }
    }

    if (!best || bestScore < (best.minScore ?? 20)) {
      return { id: 'unknown', confidence: 0, normalizedText, slots, isFollowUp: false };
    }
    return {
      id: best.id,
      confidence: Math.min(1, bestScore / 120),
      normalizedText,
      slots,
      isFollowUp: followUp,
    };
  }
}

