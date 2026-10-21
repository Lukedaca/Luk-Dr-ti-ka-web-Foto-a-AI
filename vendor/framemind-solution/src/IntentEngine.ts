import type { ContextSnapshot, DiscourseSnapshot, IntentDefinition, IntentMatch, SlotPattern, SlotValue } from './types.js';
import { escapeRegExp, expandCzechSynonyms, hasExplicitNavigation, isWithinOneEdit, monthFromText, normalizeText, stemText } from './text.js';

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

/**
 * Same-length 1-edit typo tolerance (single substitution or adjacent transposition) on
 * words >= 6 chars sharing a 2-char prefix. Same-length constraint prevents matching
 * different grammatical number/case endings (e.g. "trenink" vs "treninky").
 */
function includesFuzzyTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm || normalizedTerm.includes(' ') || normalizedTerm.length < 6) return false;
  const words = text.split(/[\s-]+/).filter(Boolean);
  return words.some((word) => word.length === normalizedTerm.length && isWithinOneEdit(word, normalizedTerm));
}

function isSafePattern(pattern: string): boolean {
  if (!pattern || pattern.length > 200) return false;
  // Tenant patterns intentionally support only a linear-time regex subset.
  // Repetition, lookarounds and backreferences are rejected to prevent ReDoS.
  if (/[+*{]/.test(pattern)) return false;
  if (/\\[1-9]|\\k<|\(\?/.test(pattern)) return false;
  return true;
}

// Czech age words (normalized, no diacritics): cardinal ("je mu osm") and the stem of the
// adjective ("osmiletý" → "osmilet"). Only read in an age context, never as a bare number.
const AGE_WORDS: Record<string, number> = {
  ctyri: 4, pet: 5, sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10, jedenact: 11, dvanact: 12,
  trinact: 13, ctrnact: 14, patnact: 15, sestnact: 16, sedmnact: 17, osmnact: 18, devatenact: 19,
};
const AGE_ADJECTIVE_STEMS: Record<string, number> = {
  ctyr: 4, peti: 5, sesti: 6, sedmi: 7, osmi: 8, deviti: 9, deseti: 10, jedenacti: 11, dvanacti: 12,
  trinacti: 13, ctrnacti: 14, patnacti: 15, sestnacti: 16, sedmnacti: 17, osmnacti: 18, devatenacti: 19,
};
const AGE_WORD_ALTERNATION = Object.keys(AGE_WORDS).join('|');
const AGE_WORD_RE = new RegExp(`\\b(?:ma|je mu|je ji|je|jsou mu)\\s+(${AGE_WORD_ALTERNATION})\\b|\\b(${AGE_WORD_ALTERNATION})\\s+let\\b`);
const AGE_ADJECTIVE_RE = new RegExp(`\\b(${Object.keys(AGE_ADJECTIVE_STEMS).join('|')})let[a-z]*\\b`);

function extractAge(normalized: string): number | undefined {
  const digits = normalized.match(/\b(?:ma|je mu|je ji|je)\s+(\d{1,2})\b/) ?? normalized.match(/\b(\d{1,2})\s+let\b/);
  if (digits?.[1]) return Number(digits[1]);
  const word = normalized.match(AGE_WORD_RE);
  const cardinal = word?.[1] ?? word?.[2];
  if (cardinal) return AGE_WORDS[cardinal];
  const adjective = normalized.match(AGE_ADJECTIVE_RE)?.[1];
  return adjective ? AGE_ADJECTIVE_STEMS[adjective] : undefined;
}

function extractBudgetKc(normalized: string): number | undefined {
  const thousands = normalized.match(/\b(?:do|max|maximalne|rozpocet|kolem|cca|za)\s+(\d{1,3})\s*(?:tisic|tis)\b/);
  if (thousands?.[1]) return Number(thousands[1]) * 1000;
  const explicitKc = normalized.match(/\b(\d{1,3}(?:\s\d{3})+|\d{3,6})\s*(?:kc|korun|czk)\b/);
  if (explicitKc?.[1]) return Number(explicitKc[1].replace(/\s+/g, ''));
  const prefixed = normalized.match(/\b(?:do|max|maximalne|rozpocet)\s+(\d{1,3}(?:\s\d{3})+|\d{4,6})\b/);
  if (prefixed?.[1]) return Number(prefixed[1].replace(/\s+/g, ''));
  return undefined;
}

function extractPatternSlots(normalized: string, patterns: SlotPattern[]): Record<string, SlotValue> {
  const slots: Record<string, SlotValue> = {};
  const positions: Record<string, number> = {};
  for (const item of patterns) {
    if (!item?.slot || typeof item.value !== 'string' || !isSafePattern(item.pattern)) continue;
    try {
      const expression = new RegExp(item.pattern, 'g');
      let match: RegExpExecArray | null;
      while ((match = expression.exec(normalized)) !== null) {
        if (match.index >= (positions[item.slot] ?? -1)) {
          slots[item.slot] = item.value.replace(/\$1/g, match[1] ?? '');
          positions[item.slot] = match.index;
        }
        // Optional-only patterns can match an empty string. Never loop on them.
        if (match[0].length === 0) expression.lastIndex += 1;
      }
    } catch {
      // Invalid tenant patterns must not break local answers.
    }
  }
  return slots;
}

function extractSlots(normalized: string, now: Date): Record<string, SlotValue> {
  const slots: Record<string, SlotValue> = {};
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (yearMatch?.[1]) slots.birthYear = Number(yearMatch[1]);

  const age = extractAge(normalized);
  if (age !== undefined) slots.childAge = age;

  const budgetKc = extractBudgetKc(normalized);
  if (budgetKc !== undefined && Number.isFinite(budgetKc) && budgetKc > 0) {
    slots.budgetKc = budgetKc;
  }

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
  if (definition.standalone) {
    const phrases = [
      ...(definition.examples ?? []),
      ...(definition.keywords ?? []),
      ...(definition.keywordGroups ?? []).map((group) => group.join(' ')),
    ];
    return phrases.some((phrase) => normalized === normalizeText(phrase))
      ? 120 + (definition.priority ?? 0)
      : 0;
  }
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
    } else if (includesFuzzyTerm(normalized, keyword)) {
      evidence += 15;
    }
  }
  for (const group of definition.keywordGroups ?? []) {
    const allMatch = group.every(
      (keyword) =>
        includesTerm(normalized, keyword)
        || includesStemmedTerm(stemmed, keyword)
        || includesFuzzyTerm(normalized, keyword),
    );
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

  private readonly slotPatterns: SlotPattern[];
  private readonly trainedExamples = new Map<string, IntentDefinition>();

  constructor(definitions: IntentDefinition[], slotPatterns: SlotPattern[] = []) {
    this.definitions = definitions.slice();
    this.slotPatterns = slotPatterns.slice();
    for (const definition of this.definitions) {
      for (const example of definition.exactExamples ?? []) {
        const normalized = normalizeText(example);
        if (!normalized || normalized.length > 2000) throw new Error('Invalid exact intent example');
        const previous = this.trainedExamples.get(normalized);
        if (previous && previous.id !== definition.id) throw new Error(`Conflicting exact intent example: ${previous.id} / ${definition.id}`);
        this.trainedExamples.set(normalized, definition);
      }
    }
  }

  hasExactExample(text: string): boolean {
    const normalized = normalizeText(text);
    return normalized.length <= 2000 && this.trainedExamples.has(normalized);
  }

  detect(
    text: string,
    context: ContextSnapshot,
    now = new Date(),
    discourseSnapshot?: DiscourseSnapshot,
  ): IntentMatch {
    const normalizedText = normalizeText(text).slice(0, 2000);
    const stemmedText = stemText(normalizedText);
    const slots = { ...extractSlots(normalizedText, now), ...extractPatternSlots(normalizedText, this.slotPatterns) };

    if (discourseSnapshot?.activeEntity) {
      slots.activeEntityType = discourseSnapshot.activeEntity.type;
      slots.activeEntityName = discourseSnapshot.activeEntity.name;
    }

    // Corrections choose an existing intent; normal safety, knowledge freshness,
    // response composition and action permissions still run in FrameMindEngine.
    const trained = this.trainedExamples.get(normalizedText);
    if (trained && normalizeText(text).length <= 2000) {
      return {
        id: trained.id,
        confidence: 1,
        normalizedText,
        slots,
        isFollowUp: Boolean(context.activeIntent && trained.followUpFor?.includes(context.activeIntent)),
      };
    }

    let best: IntentDefinition | undefined;
    let bestScore = 0;
    let followUp = false;

    for (const definition of this.definitions) {
      const lexical = scoreIntent(definition, normalizedText, stemmedText);
      let score = lexical;
      const follows = Boolean(context.activeIntent && definition.followUpFor?.includes(context.activeIntent));
      if (follows && (slots.childAge || slots.birthYear || slots.nextAge)) score += 95;

      // Anaphora boost only breaks ties between intents the message itself supports.
      // Without own lexical evidence it hijacked unrelated questions ("Kdy je trénink?"
      // after a recruitment question) — those belong to unknown, i.e. the managed model.
      if (lexical > 0 && discourseSnapshot?.lastIntent && definition.followUpFor?.includes(discourseSnapshot.lastIntent)) {
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

    // Fallback pass: colloquial Czech synonyms when strict lexical did not match.
    if (!best || bestScore < (best.minScore ?? 20)) {
      const expandedNormalized = expandCzechSynonyms(normalizedText);
      if (expandedNormalized !== normalizedText) {
        const expandedStemmed = stemText(expandedNormalized);
        for (const definition of this.definitions) {
          if (definition.standalone) continue;
          const lexical = scoreIntent(definition, expandedNormalized, expandedStemmed);
          let score = lexical;
          const follows = Boolean(context.activeIntent && definition.followUpFor?.includes(context.activeIntent));
          if (follows && (slots.childAge || slots.birthYear || slots.nextAge)) score += 95;
          if (lexical > 0 && discourseSnapshot?.lastIntent && definition.followUpFor?.includes(discourseSnapshot.lastIntent)) {
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
