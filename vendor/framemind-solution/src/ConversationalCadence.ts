export interface CadenceParts {
  opener?: string;
  core?: string;
  detail?: string;
  hook?: string;
}

/**
 * Deterministický výběr varianty podle textového seedu (např. dotaz nebo turn)
 */
export function selectVariant(variants: string[], seed = ''): string {
  if (!variants || !variants.length) return '';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % variants.length;
  return variants[idx] || '';
}

/**
 * Sestaví odpověď s přirozeným 4fázovým rytmem lidské řeči
 */
export function composeCadence({ opener = '', core = '', detail = '', hook = '' }: CadenceParts): string {
  const parts: string[] = [];
  if (opener && opener.trim()) parts.push(opener.trim());
  if (core && core.trim()) parts.push(core.trim());
  if (detail && detail.trim()) parts.push(detail.trim());

  let mainBody = parts.join(' ');
  if (hook && hook.trim()) {
    mainBody = `${mainBody} ${hook.trim()}`;
  }
  return mainBody.replace(/\s+/g, ' ').trim();
}
