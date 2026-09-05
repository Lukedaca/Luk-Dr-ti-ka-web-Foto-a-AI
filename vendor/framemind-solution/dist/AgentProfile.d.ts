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
export declare function defineAgentProfile(profile: AgentProfile): AgentProfile;
export declare function extractProfileSiteLinks(profile: AgentProfile): SiteLink[];
export declare function findProfileSection(profile: AgentProfile, query: string): AgentSection | null;
export declare function validateProfileIntegrity(profile: AgentProfile): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=AgentProfile.d.ts.map