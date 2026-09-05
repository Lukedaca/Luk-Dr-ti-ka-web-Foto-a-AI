import type { ActionDefinition, ActionTool, IntentDefinition, IntentResponseRule, SiteLink } from './types.js';

export type AgentDomainType = 'sports-club' | 'agency-saas' | 'personal-portfolio' | 'custom';

export interface AgentSection {
  id: string;
  label: string;
  type: 'page' | 'section' | 'external' | 'modal';
  target: string;
  aliases?: string[];
  keywords?: string[];
  description?: string;
  defaultTool?: ActionTool;
}

export interface AgentCapability {
  name: string;
  tools: ActionTool[];
  description: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  domain: AgentDomainType;
  version: string;
  locale?: string;
  disclosure?: string;
  privacyNotice?: string;
  sections: AgentSection[];
  capabilities: AgentCapability[];
  intents?: IntentDefinition[];
  responses?: IntentResponseRule[];
  actions?: ActionDefinition[];
  aliases?: Record<string, string>;
  stopWords?: string[];
}

export function defineAgentProfile(profile: AgentProfile): AgentProfile {
  if (!profile.id || typeof profile.id !== 'string') {
    throw new Error('AgentProfile must have a valid id');
  }
  if (!profile.name || typeof profile.name !== 'string') {
    throw new Error('AgentProfile must have a valid name');
  }
  if (!profile.domain || typeof profile.domain !== 'string') {
    throw new Error('AgentProfile must have a valid domain');
  }
  if (!Array.isArray(profile.sections)) {
    throw new Error('AgentProfile must define sections array');
  }
  if (!Array.isArray(profile.capabilities)) {
    throw new Error('AgentProfile must define capabilities array');
  }
  return profile;
}

export function extractProfileSiteLinks(profile: AgentProfile): SiteLink[] {
  return profile.sections.map((sec) => ({
    label: sec.label,
    path: sec.target,
  }));
}

export function findProfileSection(profile: AgentProfile, query: string): AgentSection | null {
  if (!query || typeof query !== 'string') return null;
  const norm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (const sec of profile.sections) {
    const secId = sec.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const secLabel = sec.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (secId === norm || secLabel === norm) return sec;
    if (sec.aliases?.some((a) => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === norm)) {
      return sec;
    }
  }
  return null;
}

export function validateProfileIntegrity(profile: AgentProfile): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sectionIds = new Set<string>();
  for (const sec of profile.sections) {
    if (!sec.id) errors.push('Section without id found');
    if (sectionIds.has(sec.id)) errors.push(`Duplicate section id: ${sec.id}`);
    sectionIds.add(sec.id);
    if (!sec.target) errors.push(`Section ${sec.id} missing target`);
  }
  return { valid: errors.length === 0, errors };
}
