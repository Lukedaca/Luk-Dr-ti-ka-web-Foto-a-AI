import type { ExtractedLead, SafetyCheckResult } from './types.js';

const PROFANITY_ROOTS = [
  'debil', 'idiot', 'kkt', 'kokot', 'pica', 'picov', 'kurv', 'hovno',
  'hajzl', 'srac', 'zmrd', 'chcipn', 'mrdk', 'buzerant', 'curak',
  'fuck', 'bitch', 'cunt', 'asshole', 'retard', 'nigger', 'faggot', 'bastard', 'shit',
];

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/i,
  /forget\s+(?:all\s+)?(?:your\s+)?rules/i,
  /zapomen\s+(?:na\s+)?(?:vsechn[ya]\s+)?(?:pravidla|instrukce)/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
  /pretend\s+you\s+are\s+(?:unrestricted|evil|dan)/i,
  /bypass\s+(?:all\s+)?safety/i,
  /system\s+prompt\s+override/i,
];

const PHONE_REGEX = /(?:(?:\+|00)(?:420|421)[-\s]?)?[1-9]\d{2}[-\s]?\d{3}[-\s]?\d{3}\b|\b[1-9]\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

function normalizeAscii(text: string): string {
  return String(text || '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export class SafetyShield {
  /**
   * Checks if user input is safe to process.
   * If toxic or an injection attack, the message MUST be dropped and never learned from.
   */
  static checkSafety(text: string): SafetyCheckResult {
    const raw = String(text || '').trim();
    if (!raw) return { isSafe: true };

    const norm = normalizeAscii(raw);

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(raw) || pattern.test(norm)) {
        return {
          isSafe: false,
          reason: 'injection',
          flags: ['prompt_injection'],
        };
      }
    }
    const tokens = norm.split(/[^a-z0-9]+/);

    for (const token of tokens) {
      if (!token) continue;
      for (const root of PROFANITY_ROOTS) {
        if (token === root || token.startsWith(root) || token.includes(root)) {
          return {
            isSafe: false,
            reason: 'profanity',
            flags: ['profanity_or_harassment', root],
          };
        }
      }
    }

    return { isSafe: true };
  }

  /**
   * Sanitizes all Personally Identifiable Information (PII) like phone numbers and emails.
   * Safe to pass to analytics or topic clustering without storing user identities.
   */
  static sanitizePii(text: string): string {
    if (!text) return '';
    return text
      .replace(EMAIL_REGEX, '[EMAIL]')
      .replace(PHONE_REGEX, '[PHONE]')
      .replace(/\b(?:rodne\s+cislo|rc)\s*[:=]?\s*\d{6}\/?\d{3,4}\b/gi, '[PERSONAL_ID]');
  }

  /**
   * Identifies and extracts legitimate lead information (name, phone, email, recruitment child year)
   * so it can be routed directly to the authorized recipient (Stream 1),
   * while never leaking into public model weights or memory (Stream 2).
   */
  static extractLead(text: string, contextHint?: string): ExtractedLead {
    const raw = String(text || '').trim();
    const emails = raw.match(EMAIL_REGEX);
    const phones = raw.match(PHONE_REGEX);

    const email = emails && emails.length > 0 ? emails[0] : undefined;
    const phone = phones && phones.length > 0 && phones[0] ? phones[0].replace(/\s+/g, '') : undefined;

    // Detect recruitment child birth year (e.g. "ročník 2017", "nar. 2016", "syn 2018")
    let childYear: number | undefined;
    const yearMatch = raw.match(/(?:rocnik|naroz(?:en|eny|ena)?|rok|syn|dcera)\s*[:=]?\s*(20[0-2]\d)\b/i)
      || raw.match(/\b(201[0-9]|202[0-5])\b/);
    if (yearMatch && yearMatch[1]) {
      const parsed = parseInt(yearMatch[1], 10);
      if (parsed >= 2005 && parsed <= 2025) {
        childYear = parsed;
      }
    }

    // Detect candidate name
    let name: string | undefined;
    const nameMatch = raw.match(/(?:jmenuji\s+se|jmenuju\s+se|jsem|jmeno[:=]?)\s+([A-ZÁ-Ž][a-zá-ž]+(?:\s+[A-ZÁ-Ž][a-zá-ž]+)?)/i);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
    }

    const norm = normalizeAscii(raw + ' ' + (contextHint || ''));
    const isRecruitment = /nabor|pripravka|fotbal|trenink|klub|mladez|kategorie/.test(norm) || !!childYear;
    const isInquiry = /foceni|fotograf|portret|zapas|atelier|agent|chatbot|web|cenik/.test(norm);

    const type = isRecruitment ? 'recruitment' : isInquiry ? 'inquiry' : 'general';
    const validLead = !!(phone || email || (name && (childYear || isRecruitment)));

    return {
      validLead,
      type,
      name,
      phone,
      email,
      childYear,
      notes: raw.slice(0, 300),
    };
  }
}
