import type { InteractiveTarget, ResolvedAction, SiteLink, SiteMenu } from './types.js';

const MAX_TARGET_LENGTH = 320;

function isHostMatchingApex(hostname: string, apex: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const cleanApex = apex.toLowerCase().replace(/\.$/, '');
  return host === cleanApex || host.endsWith(`.${cleanApex}`);
}

export function normalizeNavTarget(
  value: unknown,
  baseOrigin = 'https://framemind.invalid',
  allowedApex?: string,
): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_TARGET_LENGTH || /[\u0000-\u001f]/.test(raw)) return null;
  if (raw.includes('/..') || raw.includes('../') || raw.split('/').includes('..')) return null;

  // Relative paths without apex restriction
  if (raw.startsWith('/') && !raw.startsWith('//') && !/[?#\\]/.test(raw)) {
    return raw;
  }

  let url: URL;
  try {
    url = new URL(raw, baseOrigin);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Disallow insecure HTTP unless local test origin
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null;

  if (allowedApex) {
    if (!isHostMatchingApex(url.hostname, allowedApex)) return null;
    const cleanApex = allowedApex.toLowerCase().replace(/\.$/, '');
    const host = url.hostname.toLowerCase();
    if (host === cleanApex || host === `www.${cleanApex}`) {
      const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
      return `${path}${url.search}${url.hash}`;
    }
  } else {
    // If no apex restriction, allow same origin or relative paths
    try {
      const base = new URL(baseOrigin);
      if (url.origin === base.origin) {
        const path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
        return `${path}${url.search}${url.hash}`;
      }
    } catch {}
  }

  return url.href;
}

export function sanitizeNavLinks(
  raw: unknown,
  maxLinks = 160,
  normalizer?: (path: string) => string | null,
): SiteLink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SiteLink[] = [];
  const normalize = normalizer ?? ((p: string) => normalizeNavTarget(p));

  for (const item of raw) {
    if (!item || typeof item.path !== 'string') continue;
    const path = normalize(item.path);
    if (!path || path === '/' || path.startsWith('/embed') || seen.has(path)) continue;
    const label = typeof item.label === 'string'
      ? item.label.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
      : '';
    if (!label) continue;
    seen.add(path);
    out.push({ label, path });
    if (out.length >= maxLinks) break;
  }
  return out;
}

export function normalizeNavText(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\be[\s-]*shop(?=[a-z]*\b)/g, 'eshop')
    .replace(/\bu[\s-]+(\d{1,2})\b/g, 'u$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DEFAULT_STOP_WORDS = new Set([
  'a', 'aby', 'ale', 'by', 'bych', 'chci', 'chtel', 'chtela', 'chteli', 'do', 'doved', 'dovedte',
  'je', 'ja', 'ji', 'jsem', 'k', 'kam', 'co', 'jak', 'jaka', 'jake', 'jaky', 'kde', 'kdo', 'kdy',
  'kolik', 'klub', 'klubu', 'klubovy', 'ma', 'mate', 'mi', 'me', 'mohl', 'mohla', 'muze', 'muzete',
  'myslel', 'myslela', 'na', 'nabizi', 'nabidka', 'nabidce', 'nabidku', 'o', 'najdi', 'najde', 'najdes',
  'najdete', 'nam', 'naviguj', 'navigujte', 'odkaz', 'otevri', 'otevrit', 'otevrete', 'prosim',
  'prehled', 'prejdi', 'prejdete', 'se', 'sekce', 'sekci', 'stoji', 'stranka', 'stranku', 'ukaz',
  'ukazat', 'ukazte', 'tam', 'uvnitr', 'v', 've', 'vsechno', 'web', 'webu', 'zobraz', 'zobrazit',
  'zobrazte', 'proklikni', 'prokliknete', 'sroluj', 'srolujte', 'scrolluj', 'scrollujte',
  'rozbal', 'rozbalte', 'klikni', 'kliknete', 'prepni', 'prepnete', 'vyber', 'vyberte', 'oznac', 'oznacte',
  'menu', 'to', 'ten', 'ta', 'ty', 'tom', 'tomu', 'tento', 'tuto', 'tahle',
  'videt', 'otevrit', 'prejit', 'prohlidnout', 'najit',
]);

const DEFAULT_TOKEN_ALIASES: Record<string, string> = {
  obchod: 'eshop',
  fanshop: 'eshop',
  shop: 'eshop',
  merch: 'eshop',
  fotky: 'galerie',
  fotografie: 'galerie',
  foto: 'galerie',
  galerii: 'galerie',
  cenik: 'cenik',
  ceny: 'cenik',
  tarify: 'cenik',
};

function meaningfulTokens(
  value: string,
  aliases: Record<string, string> = DEFAULT_TOKEN_ALIASES,
  stopWords: Set<string> = DEFAULT_STOP_WORDS,
): string[] {
  return normalizeNavText(value)
    .split(' ')
    .map((token) => aliases[token] || token)
    .filter((token) => token && !stopWords.has(token) && (token.length >= 2 || /^\d+$/.test(token)));
}

function tokenMatches(query: string, candidate: string): boolean {
  if (query === candidate) return true;
  if (query.length < 4 || candidate.length < 4) return false;
  if (query.startsWith(candidate) || candidate.startsWith(query)) return true;
  let shared = 0;
  while (shared < query.length && shared < candidate.length && query[shared] === candidate[shared]) shared += 1;
  return shared >= 5 && shared >= Math.min(query.length, candidate.length) - 2;
}

export function hasExplicitUiActionIntent(value: unknown): boolean {
  const text = normalizeNavText(value);
  return /\b(otevri|otevrete|ukaz|ukazte|prejdi|prejdete|doved|dovedte|naviguj|navigujte|proklikni|prokliknete|klikni|kliknete|prepni|prepnete|vyber|vyberte|oznac|oznacte|zobraz|zobrazte|sroluj|srolujte|scrolluj|scrollujte|rozbal|rozbalte)\b/.test(text)
    || /^(?:prosim\s+)?(?:najdi|najdete)\b/.test(text)
    || /\bchci\b.{0,20}\b(videt|otevrit|prejit)\b/.test(text);
}

export interface NavSearchOptions {
  aliases?: Record<string, string>;
  stopWords?: Set<string>;
  normalizer?: (path: string) => string | null;
}

export function findSiteLinkIntent(
  userText: string,
  siteLinks: SiteLink[],
  options?: NavSearchOptions,
): SiteLink | null {
  const queryText = normalizeNavText(userText);
  const aliases = options?.aliases ? { ...DEFAULT_TOKEN_ALIASES, ...options.aliases } : DEFAULT_TOKEN_ALIASES;
  const stopWords = options?.stopWords ?? DEFAULT_STOP_WORDS;
  const queryTokens = meaningfulTokens(userText, aliases, stopWords);
  if (!queryText || queryTokens.length === 0 || !Array.isArray(siteLinks)) return null;

  const normalize = options?.normalizer ?? ((p: string) => normalizeNavTarget(p));

  let best: SiteLink | null = null;
  let bestScore = -1;

  for (const link of siteLinks) {
    const path = normalize(link?.path);
    const label = typeof link?.label === 'string' ? link.label.trim() : '';
    if (!path || !label) continue;
    const labelText = normalizeNavText(label);
    const candidateTokens = meaningfulTokens(`${label} ${path}`, aliases, stopWords);
    const everyTokenMatches = queryTokens.every((query) => candidateTokens.some((candidate) => tokenMatches(query, candidate)));
    if (!everyTokenMatches) continue;

    let score = 50 + queryTokens.length * 10;
    if (labelText && queryText.includes(labelText)) score += 100 + labelText.length;
    if (queryTokens.length === candidateTokens.length) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = { label, path };
    }
  }
  return best;
}

export function findSiteMenuIntent(
  userText: string,
  siteMenus: SiteMenu[],
  options?: NavSearchOptions,
): SiteMenu | null {
  const queryText = normalizeNavText(userText);
  const aliases = options?.aliases ? { ...DEFAULT_TOKEN_ALIASES, ...options.aliases } : DEFAULT_TOKEN_ALIASES;
  const stopWords = options?.stopWords ?? DEFAULT_STOP_WORDS;
  const queryTokens = meaningfulTokens(userText, aliases, stopWords);
  if (!queryText || !Array.isArray(siteMenus)) return null;

  const wantsMenu = /\b(?:menu|nabidk\w*|rozcestnik\w*|polozk\w*|podsekc\w*|sekc\w*)\b/.test(queryText)
    || /\b(?:otevr\w*|ukaz\w*|rozbal\w*|zobraz\w*)\b/.test(queryText);
  if (!wantsMenu) return null;

  if (
    /\b(?:moje|muj|me|vlastni)\s+projekt\w*/.test(queryText)
    && !/\bklub\w*/.test(queryText)
  ) return null;

  let best: SiteMenu | null = null;
  let bestScore = -1;

  for (const menu of siteMenus) {
    const label = typeof menu?.label === 'string' ? menu.label.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    const links = sanitizeNavLinks(menu?.links, 50, options?.normalizer);
    if (!label || links.length === 0) continue;
    const labelText = normalizeNavText(label);
    const labelTokens = meaningfulTokens(label, aliases, stopWords);
    const directLabelMatch = Boolean(labelText && queryText.includes(labelText));
    const everyTokenMatches = queryTokens.length > 0
      && queryTokens.every((query) => labelTokens.some((candidate) => tokenMatches(query, candidate)));

    const menuTokens = labelTokens.concat(links.flatMap((link) => meaningfulTokens(link.label, aliases, stopWords)));
    const uncovered = queryTokens.filter(
      (query) => !menuTokens.some((candidate) => tokenMatches(query, candidate)),
    );
    if (!everyTokenMatches && (!directLabelMatch || uncovered.length > 0)) continue;

    let score = 50 + queryTokens.length * 10;
    if (directLabelMatch) score += 100 + labelText.length;
    if (queryTokens.length === labelTokens.length) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = { label, links };
    }
  }
  return best;
}

export function collectDomSiteLinks(
  rootDoc?: any,
  options?: { normalizer?: (raw: string) => string | null; maxLinks?: number },
): SiteLink[] {
  try {
    const doc = rootDoc ?? (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];

    const seen = new Set<string>();
    const out: SiteLink[] = [];
    const max = options?.maxLinks ?? 160;
    const normalize = options?.normalizer ?? ((p: string) => normalizeNavTarget(p));
    const anchors = Array.from(doc.querySelectorAll('a[href]')) as any[];

    for (const a of anchors) {
      const raw = (a.getAttribute?.('href') || a.href || '').trim();
      const path = normalize(raw);
      if (!path || path === '/' || path.startsWith('/embed') || seen.has(path)) continue;
      const label = (a.textContent || a.getAttribute?.('aria-label') || a.getAttribute?.('title') || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
      if (!label || label.length < 2) continue;
      seen.add(path);
      out.push({ label, path });
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function collectDomSiteMenus(
  rootDoc?: any,
  options?: { normalizer?: (raw: string) => string | null },
): SiteMenu[] {
  try {
    const doc = rootDoc ?? (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];

    const triggers = Array.from(
      doc.querySelectorAll('.nav-item-top, nav span, .nav-item > span, .nav-item > a, [data-menu-trigger]'),
    ) as any[];
    const out: SiteMenu[] = [];
    const seen = new Set<string>();
    const normalize = options?.normalizer ?? ((p: string) => normalizeNavTarget(p));

    for (const trigger of triggers) {
      const label = (trigger.textContent || '')
        .replace(/[>›▼▲]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
      const key = label.toLocaleLowerCase('cs-CZ');
      if (!label || label.length < 2 || seen.has(key)) continue;

      const container = trigger.closest?.('.nav-item, li, div') || trigger.parentElement;
      const anchors = container ? Array.from(container.querySelectorAll('a[href]')) as any[] : [];
      const links: SiteLink[] = [];
      const seenPaths = new Set<string>();

      for (const a of anchors) {
        const raw = (a.getAttribute?.('href') || a.href || '').trim();
        const path = normalize(raw);
        if (!path || path === '/' || seenPaths.has(path)) continue;
        const linkLabel = (a.textContent || a.getAttribute?.('aria-label') || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        if (!linkLabel) continue;
        seenPaths.add(path);
        links.push({ label: linkLabel, path });
      }

      if (links.length > 0) {
        seen.add(key);
        out.push({ label, links });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function collectDomInteractiveTargets(
  rootDoc?: any,
  options?: { maxTargets?: number },
): InteractiveTarget[] {
  try {
    const doc = rootDoc ?? (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];

    const max = options?.maxTargets ?? 120;
    const out: InteractiveTarget[] = [];
    const seen = new Set<string>();

    const pushTarget = (target: InteractiveTarget) => {
      if (out.length >= max) return;
      const cleanLabel = target.label.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!cleanLabel || cleanLabel.length < 2 || !target.selector) return;
      const dedupeKey = `${target.kind}:${target.selector}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push({ ...target, label: cleanLabel });
    };

    // 1. Named sections with headings
    const sections = Array.from(doc.querySelectorAll('section[id], [data-section][id]')) as any[];
    for (const sec of sections) {
      const id = (sec.getAttribute?.('id') || sec.id || '').trim();
      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) continue;
      const heading = sec.querySelector?.('h1, h2, h3, h4');
      const label = (heading?.textContent || sec.getAttribute?.('aria-label') || sec.getAttribute?.('data-section') || id).trim();
      pushTarget({
        id,
        label,
        selector: `#${id}`,
        kind: 'section',
        tool: 'scroll_to',
      });
    }

    // 2. Tabs & category filters
    const tabs = Array.from(doc.querySelectorAll('[role="tab"], [data-tab], [data-filter], [data-service]')) as any[];
    for (const tab of tabs) {
      const id = (tab.getAttribute?.('id') || tab.id || '').trim();
      const dataTab = (tab.getAttribute?.('data-tab') || '').trim();
      const dataFilter = (tab.getAttribute?.('data-filter') || '').trim();
      const dataService = (tab.getAttribute?.('data-service') || '').trim();
      const label = (tab.textContent || tab.getAttribute?.('aria-label') || dataTab || dataFilter || dataService || id).trim();
      let selector = '';
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) selector = `#${id}`;
      else if (dataTab && /^[a-zA-Z0-9_-]+$/.test(dataTab)) selector = `[data-tab="${dataTab}"]`;
      else if (dataFilter && /^[a-zA-Z0-9_-]+$/.test(dataFilter)) selector = `[data-filter="${dataFilter}"]`;
      else if (dataService && /^[a-zA-Z0-9_-]+$/.test(dataService)) selector = `[data-service="${dataService}"]`;
      if (!selector) continue;
      pushTarget({
        id: id || dataTab || dataFilter || dataService || selector,
        label,
        selector,
        kind: 'tab',
        tool: 'switch_tab',
      });
    }

    // 3. Accordions / <details>
    const summaries = Array.from(doc.querySelectorAll('details > summary')) as any[];
    summaries.forEach((summary, idx) => {
      const details = summary.parentElement;
      const id = (details?.getAttribute?.('id') || details?.id || summary.getAttribute?.('id') || summary.id || '').trim();
      const label = (summary.textContent || summary.getAttribute?.('aria-label') || '').trim();
      const selector = id && /^[a-zA-Z0-9_-]+$/.test(id) ? `#${id}` : '';
      if (!selector) return;
      pushTarget({
        id: id || `accordion-${idx}`,
        label,
        selector,
        kind: 'accordion',
        tool: 'open_accordion',
      });
    });

    // 4. Explicit agent action buttons
    const buttons = Array.from(doc.querySelectorAll('[data-fm-action], button[id]')) as any[];
    for (const btn of buttons) {
      const id = (btn.getAttribute?.('id') || btn.id || '').trim();
      const fmAction = (btn.getAttribute?.('data-fm-action') || '').trim();
      const label = (btn.textContent || btn.getAttribute?.('aria-label') || fmAction || id).trim();
      let selector = '';
      if (fmAction && /^[a-zA-Z0-9_-]+$/.test(fmAction)) selector = `[data-fm-action="${fmAction}"]`;
      else if (id && /^[a-zA-Z0-9_-]+$/.test(id)) selector = `#${id}`;
      if (!selector) continue;
      pushTarget({
        id: fmAction || id,
        label,
        selector,
        kind: 'button',
        tool: 'click_element',
      });
    }

    return out;
  } catch {
    return [];
  }
}

export function findInteractiveTargetIntent(
  userText: string,
  targets: InteractiveTarget[],
  options?: NavSearchOptions,
): InteractiveTarget | null {
  const queryText = normalizeNavText(userText);
  const aliases = options?.aliases ? { ...DEFAULT_TOKEN_ALIASES, ...options.aliases } : DEFAULT_TOKEN_ALIASES;
  const stopWords = options?.stopWords ?? DEFAULT_STOP_WORDS;
  const queryTokens = meaningfulTokens(userText, aliases, stopWords).filter(
    (t) => !['klikni', 'kliknete', 'prepni', 'prepnete', 'vyber', 'vyberte', 'oznac', 'oznacte', 'karta', 'kartu', 'zalozka', 'zalozku', 'tab'].includes(t),
  );
  if (!queryText || queryTokens.length === 0 || !Array.isArray(targets)) return null;

  let best: InteractiveTarget | null = null;
  let bestScore = -1;

  for (const target of targets) {
    if (!target || !target.selector || !target.label) continue;
    const labelText = normalizeNavText(target.label);
    const candidateTokens = meaningfulTokens(`${target.label} ${target.id}`, aliases, stopWords);
    if (candidateTokens.length === 0) continue;
    const everyTokenMatches = queryTokens.every((query) =>
      candidateTokens.some((candidate) => tokenMatches(query, candidate)),
    );
    if (!everyTokenMatches) continue;

    let score = 50 + queryTokens.length * 10;
    if (labelText && queryText.includes(labelText)) score += 100 + labelText.length;
    if (queryTokens.length === candidateTokens.length) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }

  return best;
}

export class PendingNavigationManager {
  private pending: ResolvedAction | null = null;
  private timer: any = null;
  private onExecute: ((action: ResolvedAction) => void) | null = null;
  private isVoiceActive: (() => boolean) | null = null;

  schedule(
    action: ResolvedAction,
    onExecute: (action: ResolvedAction) => void,
    isVoiceActive: () => boolean,
    failsafeMs = 4000,
  ): void {
    this.cancel();
    this.pending = action;
    this.onExecute = onExecute;
    this.isVoiceActive = isVoiceActive;

    const armFailsafe = () => {
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.isVoiceActive?.()) {
          armFailsafe();
          return;
        }
        this.flush();
      }, failsafeMs);
    };

    armFailsafe();
  }

  flush(): boolean {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const action = this.pending;
    const execute = this.onExecute;
    this.pending = null;
    this.onExecute = null;
    this.isVoiceActive = null;

    if (action && execute) {
      execute(action);
      return true;
    }
    return false;
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    this.onExecute = null;
    this.isVoiceActive = null;
  }

  isPending(): boolean {
    return this.pending !== null;
  }

  getPending(): ResolvedAction | null {
    return this.pending;
  }
}
