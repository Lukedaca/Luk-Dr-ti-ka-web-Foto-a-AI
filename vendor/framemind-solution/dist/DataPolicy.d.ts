import type { DataMode, EgressAuthorization, EgressAuthorizationRequest, ProviderComplianceProfile, TenantDeploymentPolicy } from './types.js';
export declare const DATA_MODES: readonly ["minimal", "support", "lead"];
export declare const PROCESSING_MODES: readonly ["strict", "managed"];
export declare const VOICE_MODES: readonly ["off", "local", "managed"];
export declare const AUDIENCE_PROFILES: readonly ["general", "may-include-minors"];
export declare const DATA_CLASSES: readonly ["public-data", "visitor-content", "visitor-personal-data", "sensitive-data", "internal-data", "operational-metadata"];
export declare const EGRESS_PURPOSES: readonly ["managed-llm", "speech-to-text", "text-to-speech", "telemetry", "lead-delivery", "support-workflow", "visitor-memory"];
export declare const DEFAULT_TRANSCRIPT_RETENTION_DAYS = 30;
export declare function normalizeDataMode(value: unknown): DataMode;
export declare function parseFlag(value: unknown, fallback?: boolean): boolean;
export declare function parseTranscriptRetentionDays(value: unknown, fallback?: number): number;
export declare function parseRecipientList(...values: unknown[]): string[];
export interface ResolvedRetentionPolicy {
    mode: DataMode;
    transcriptStorageEnabled: boolean;
    transcriptEmailEnabled: boolean;
    sheetsEnabled: boolean;
    leadBriefEnabled: boolean;
    supportAccessEnabled: boolean;
    anonymousTelemetryEnabled: boolean;
    transcriptRetentionDays: number | null;
}
/** Backwards-compatible retention contract. Processing and voice stay separate. */
export declare function resolveDataPolicy(readEnv?: (name: string) => unknown): ResolvedRetentionPolicy;
export declare function planTranscriptPipeline(policy: Pick<ResolvedRetentionPolicy, 'transcriptStorageEnabled' | 'transcriptEmailEnabled' | 'sheetsEnabled' | 'leadBriefEnabled'>): Readonly<{
    storage: boolean;
    email: boolean;
    sheets: boolean;
    leadBrief: boolean;
}>;
export declare class DataPolicy {
    private readonly tenants;
    private readonly providers;
    constructor(tenants?: TenantDeploymentPolicy[], providers?: ProviderComplianceProfile[]);
    authorizeEgress(request: EgressAuthorizationRequest): EgressAuthorization;
    cacheScope(tenantId: string, provider: string, voice: string, locale: string, staticPhraseId: string): string | null;
}
export declare function safeOperationalTelemetry(fields: Record<string, unknown>): Record<string, string | number | boolean>;
//# sourceMappingURL=DataPolicy.d.ts.map