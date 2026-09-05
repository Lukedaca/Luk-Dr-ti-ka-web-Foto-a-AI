import type { AgentProfile } from '../AgentProfile.js';

export function createSportsClubProfile(overrides?: Partial<AgentProfile>): AgentProfile {
  return {
    id: overrides?.id || 'sports-club-agent',
    name: overrides?.name || 'Klubová sportovní agentka',
    domain: 'sports-club',
    version: overrides?.version || '1.0.0',
    locale: overrides?.locale || 'cs-CZ',
    disclosure: overrides?.disclosure || 'Jsem klubová AI agentka. Pomohu vám najít ověřené informace o zápasech, trénincích, náborech a týmech.',
    privacyNotice: overrides?.privacyNotice || 'V soukromém režimu se vaše dotazy zpracovávají přímo v prohlížeči.',
    sections: overrides?.sections || [
      { id: 'tymy', label: 'Týmy a soupisky', type: 'page', target: '/tymy', aliases: ['soupiska', 'dorost', 'muzi', 'zaci'], defaultTool: 'navigate' },
      { id: 'nabor', label: 'Nábor a školička', type: 'page', target: '/nabor', aliases: ['deti', 'skolicka', 'prihlaska'], defaultTool: 'navigate' },
      { id: 'treninky', label: 'Tréninkový plán', type: 'page', target: '/rozpis-test', aliases: ['trenink', 'rozvrh', 'casy'], defaultTool: 'navigate' },
      { id: 'zapasy', label: 'Program zápasů', type: 'page', target: '/program-zapasu', aliases: ['vysledky', 'utkani', 'rozlosovani'], defaultTool: 'navigate' },
      { id: 'prispevky', label: 'Členské příspěvky', type: 'page', target: '/clenske-prispevky', aliases: ['poplatky', 'platby', 'clenstvi'], defaultTool: 'navigate' },
      { id: 'kontakty', label: 'Kontakty', type: 'page', target: '/kontakty', aliases: ['vedeni', 'treneri', 'adresa', 'telefon', 'email'], defaultTool: 'navigate' },
      { id: 'galerie', label: 'Fotogalerie', type: 'page', target: '/galerie', aliases: ['fotky', 'foto', 'fotografie'], defaultTool: 'navigate' },
      { id: 'partneri', label: 'Partneři a sponzoři', type: 'page', target: '/partneri', aliases: ['sponzori', 'sponzoring', 'reklama'], defaultTool: 'navigate' },
      { id: 'projekty', label: 'Projekty', type: 'page', target: '/projekty', aliases: ['sigma', 'akce'], defaultTool: 'open_menu' },
    ],
    capabilities: overrides?.capabilities || [
      { name: 'navigation', tools: ['navigate', 'open_menu'], description: 'Přechod na klubové podstránky a rozbalování menu' },
      { name: 'recruitment', tools: ['navigate'], description: 'Navigace na nábor a výpočet ročníků' },
      { name: 'sponsoring', tools: ['navigate', 'show_sponsors'], description: 'Zobrazení partnerů a sponzoringu' },
    ],
    aliases: overrides?.aliases || {
      klub: 'tymy',
      fotbal: 'tymy',
      soupisky: 'tymy',
      skolicka: 'nabor',
      prispevky: 'prispevky',
      zapas: 'zapasy',
    },
    ...overrides,
  };
}
