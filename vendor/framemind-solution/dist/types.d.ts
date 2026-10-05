export type FrameMindMode = 'strict' | 'managed';
/** Retention/workflow choice. It never implicitly enables cloud processing. */
export type DataMode = 'minimal' | 'support' | 'lead';
export type ProcessingMode = FrameMindMode;
export type VoiceMode = 'off' | 'local' | 'managed';
export type AudienceProfile = 'general' | 'may-include-minors';
export type DataClass = 'public-data' | 'visitor-content' | 'visitor-personal-data' | 'sensitive-data' | 'internal-data' | 'operational-metadata';
export type EgressPurpose = 'managed-llm' | 'speech-to-text' | 'text-to-speech' | 'telemetry' | 'lead-delivery' | 'support-workflow' | 'visitor-memory';
export interface ProviderComplianceProfile {
    id: string;
    allowedAudiences: AudienceProfile[];
    supportedPurposes: EgressPurpose[];
    allowedRegions: string[];
    /** Configuration evidence, not a legal certification. */
    retention: string;
    training: string;
    verifiedAt: string;
    documentationUrl: string;
}
export interface TenantDeploymentPolicy {
    tenantId: string;
    domain: string;
    audience: AudienceProfile;
    processingMode: ProcessingMode;
    dataMode: DataMode;
    voice: {
        enabled: boolean;
        mode: VoiceMode;
        provider?: string;
        region?: string;
        locales: string[];
        consentRequired: boolean;
    };
    managedProvider?: {
        enabled: boolean;
        provider: string;
        maxInputChars: number;
    };
    retention: {
        transcript: boolean;
        visitorMemory: boolean;
        leads: boolean;
    };
    telemetry: {
        enabled: boolean;
        customerContentAllowed: false;
    };
}
export interface EgressAuthorizationRequest {
    tenantId: string;
    audience: AudienceProfile;
    provider: string;
    purpose: EgressPurpose;
    dataClass: DataClass;
    processingMode: ProcessingMode;
    region?: string;
    voiceActivated?: boolean;
}
export interface EgressAuthorization {
    allowed: boolean;
    reason: string;
}
export type SlotValue = string | number | boolean;
export interface IntentDefinition {
    id: string;
    examples?: string[];
    keywords?: string[];
    keywordGroups?: string[][];
    patterns?: string[];
    followUpFor?: string[];
    priority?: number;
    minScore?: number;
}
export interface IntentMatch {
    id: string;
    confidence: number;
    normalizedText: string;
    slots: Record<string, SlotValue>;
    isFollowUp: boolean;
}
export interface KnowledgeRecord {
    id: string;
    type: string;
    content: string;
    sourceUrl: string;
    contentHash: string;
    fetchedAt: string;
    expiresAt?: string;
    lastVerifiedAt: string;
    critical?: boolean;
    tags?: string[];
    intents?: string[];
    data?: Record<string, SlotValue | SlotValue[]>;
}
export interface KnowledgeSnapshot {
    schemaVersion: 1;
    generatedAt: string;
    records: KnowledgeRecord[];
}
export interface SourceReference {
    id: string;
    label: string;
    url: string;
    lastVerifiedAt: string;
}
export interface ContextSnapshot {
    turn: number;
    activeIntent?: string;
    slots: Record<string, SlotValue>;
    sourceIds: string[];
}
export type ActionTool = 'navigate' | 'open_menu' | 'scroll_to' | 'highlight_element' | 'show_sponsors' | 'contact' | 'filter_gallery' | 'toggle_theme' | 'open_lightbox' | 'play_showreel' | 'show_project_detail' | 'compare_before_after' | 'prefill_contact_form' | 'send_inquiry' | 'request_callback' | 'show_pricing' | 'compare_services' | string;
export interface ActionDefinition {
    id: string;
    tool: ActionTool;
    intentIds: string[];
    args: Record<string, string>;
    requireExplicitNavigation?: boolean;
}
export interface ResolvedAction {
    id: string;
    tool: ActionTool;
    args: Record<string, string>;
}
export interface SiteLink {
    label: string;
    path: string;
}
export interface SiteMenu {
    label: string;
    links: SiteLink[];
}
export interface CadenceConfig {
    openers?: string[];
    details?: string[];
    hooks?: string[];
}
export interface ClarificationConfig {
    question: string;
    options: string[];
    intentMap?: Record<string, string>;
}
/** Part of an answer chosen by what the visitor asks about ("kdy", "kde", "co s sebou"). */
export interface ResponseFacet {
    id: string;
    /** Plain terms, matched as whole words on normalized text, also after Czech stemming. */
    keywords: string[];
    template: string;
}
export interface SelectBy {
    slot: string;
    dataField: string;
    recordType?: string;
}
/**
 * Tenant-defined slot extraction, e.g. a club category typed as "u9" → slot category "U-9".
 * `pattern` runs on normalized text (lowercase, no diacritics) and must use the linear-time
 * subset (no *, +, {}, lookarounds, backreferences); `value` may reference $1.
 */
export interface SlotPattern {
    slot: string;
    pattern: string;
    value: string;
}
export interface IntentResponseRule {
    intentId: string;
    /** Set to false for non-factual dialogue such as greetings or help. */
    sourceRequired?: boolean;
    recordId?: string;
    requiredAnySlots?: string[];
    missingTemplate?: string;
    /**
     * Used instead of missingTemplate when the visitor gave an age (slot childAge) but no
     * birth year. The age maps to two birth years ({{yearA}} = had birthday this year,
     * {{yearB}} = not yet); both records are resolved via selectBy and exposed as {{a.*}}
     * and {{b.*}}. Falls back to missingTemplate unless both records are fresh.
     */
    ageRangeTemplate?: string;
    missingRecordId?: string;
    /**
     * Record selection by slot value. An array is tried in order and the first slot the
     * context holds wins; the first entry also drives `ageRangeTemplate` (birth-year slot).
     */
    selectBy?: SelectBy | SelectBy[];
    template?: string;
    staleTemplate?: string;
    cadence?: CadenceConfig;
    clarification?: ClarificationConfig;
    /**
     * Opt-in. Exactly one matching facet replaces `template`; none or several keep `template`.
     * A short message without its own intent ("A kde?") that matches a facet of the previous
     * intent's rule is answered by that facet.
     */
    facets?: ResponseFacet[];
}
export interface ProviderRequest {
    text: string;
    locale: string;
    context: ContextSnapshot;
}
export interface ProviderResponse {
    text: string;
    providerId: string;
}
export interface ProviderConfig {
    enabled: boolean;
    adapter?: ProviderAdapter;
    /** Context slots explicitly allowed to leave the local boundary. Empty by default. */
    allowedContextSlots?: string[];
    maxInputChars?: number;
}
export interface SessionConfig {
    /** Require callers to identify a session when an engine is shared server-side. */
    requireSessionId?: boolean;
    maxSessions?: number;
    idleTtlMs?: number;
}
export interface ProviderAdapter {
    readonly id: string;
    readonly enabled: boolean;
    generate(request: ProviderRequest): Promise<ProviderResponse>;
}
export interface SafetyCheckResult {
    isSafe: boolean;
    reason?: 'profanity' | 'injection' | 'harassment' | 'hate' | undefined;
    flags?: string[] | undefined;
}
export interface ExtractedLead {
    validLead: boolean;
    type?: 'recruitment' | 'inquiry' | 'quote' | 'general' | undefined;
    name?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    childYear?: number | undefined;
    service?: string | undefined;
    notes?: string | undefined;
}
export interface LeadRecord {
    leadId: string;
    timestamp: Date;
    domain: string;
    type: 'recruitment' | 'inquiry' | 'quote' | 'general';
    contact: {
        name?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
    };
    details: {
        childYear?: number | undefined;
        service?: string | undefined;
        notes?: string | undefined;
    };
}
export interface LeadDispatchResult {
    success: boolean;
    leadId: string;
    recipient?: string | undefined;
    error?: string | undefined;
}
export interface LearningEvent {
    kind: 'intent-correction' | 'knowledge-update' | 'local-preference' | 'conversion' | 'unmatched-topic' | 'safety-dropped';
    payload: Record<string, unknown>;
}
export interface LearningSink {
    readonly id: string;
    record(event: LearningEvent): Promise<void>;
}
export interface FrameMindConfig {
    mode: FrameMindMode;
    locale: string;
    intents: IntentDefinition[];
    /** Tenant slot extraction on top of the built-in age/year slots. */
    slotPatterns?: SlotPattern[];
    responses: IntentResponseRule[];
    actions: ActionDefinition[];
    unknownResponse: string;
    staleResponse: string;
    sourceLabel?: string;
    provider?: ProviderConfig;
    learningSink?: LearningSink;
    sessions?: SessionConfig;
    profile?: import('./AgentProfile.js').AgentProfile;
    /** Required for any managed egress in FrameMind Solution 1.2+. */
    tenantPolicy?: TenantDeploymentPolicy;
    /** Capability evidence for providers used by this deployment. */
    providerCompliance?: ProviderComplianceProfile[];
    /**
     * Opt-in. When a slot changes value, dependent slots are cleared unless the same message
     * sets them, e.g. { child: ['childAge', 'birthYear'] } — one child's age must not carry
     * over to another child.
     */
    slotDependencies?: Record<string, string[]>;
    /** Opt-in. Array data render as a natural list ("pondělí a čtvrtek") instead of "a,b". */
    listConjunction?: string;
}
export interface FrameMindRequest {
    text: string;
    now?: Date;
    availablePaths?: string[];
    allowManagedProvider?: boolean;
    /** Deliberately prepared/redacted text sent to a managed provider. Raw text is never substituted. */
    providerText?: string;
    sessionId?: string;
    /** Prior user turns (oldest first) for stateless hosts; rebuilds a fresh dialogue context. */
    history?: string[];
}
export interface DiscourseEntity {
    type: string;
    name: string;
    data?: Record<string, unknown>;
    turn: number;
    timestamp: number;
}
export interface DiscourseClarification {
    type: string;
    question: string;
    options: string[];
    context?: Record<string, unknown>;
}
export interface DiscourseSnapshot {
    turn: number;
    activeEntity: DiscourseEntity | null;
    recentEntities: DiscourseEntity[];
    lastIntent: string | null;
    lastQuery: string;
    lastReply: string;
    awaitingClarification: DiscourseClarification | null;
}
export interface ProfileEntityDefinition {
    type: string;
    name: string;
    keywords: string[];
    suggestedFollowUps?: string[];
}
export interface FrameMindResponse {
    text: string;
    intent: string;
    confidence: number;
    local: boolean;
    providerUsed: boolean;
    source?: SourceReference;
    actions: ResolvedAction[];
    context: ContextSnapshot;
    reason?: 'known' | 'unknown' | 'stale' | 'missing-slot' | 'provider';
    /** Id of the response facet that answered, when one did. */
    facet?: string;
    suggestions?: string[];
    discourse?: DiscourseSnapshot;
}
export interface LocalSpeechRecognitionCapability {
    available: boolean;
    reason: 'available' | 'api-missing' | 'availability-unknown' | 'language-missing' | 'check-failed';
    create?: () => SpeechRecognitionLike;
}
export interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    processLocally?: boolean;
    start(): void;
    stop(): void;
    abort?(): void;
    onresult?: (event: unknown) => void;
    onerror?: (event: unknown) => void;
    onend?: () => void;
}
export interface LocalVoiceCapability {
    available: boolean;
    reason: 'available' | 'api-missing' | 'voices-pending' | 'local-language-missing';
    voice?: SpeechSynthesisVoiceLike;
}
export interface SpeechSynthesisVoiceLike {
    lang?: string;
    name?: string;
    localService?: boolean;
}
export interface SpeechToTextRequest {
    audio: ArrayBuffer;
    locale: string;
    signal?: AbortSignal;
}
export interface SpeechToTextResponse {
    text: string;
    providerId: string;
    locale: string;
}
export interface TextToSpeechRequest {
    text: string;
    locale: string;
    voice?: string;
    signal?: AbortSignal;
}
export interface TextToSpeechResponse {
    audio: ArrayBuffer;
    contentType: string;
    providerId: string;
    voice: string;
}
/** Provider-neutral contracts. Browser token issuance stays deployment/server code. */
export interface SpeechToTextProvider {
    readonly id: string;
    readonly enabled: boolean;
    transcribe(request: SpeechToTextRequest): Promise<SpeechToTextResponse>;
}
export interface TextToSpeechProvider {
    readonly id: string;
    readonly enabled: boolean;
    synthesize(request: TextToSpeechRequest): Promise<TextToSpeechResponse>;
}
//# sourceMappingURL=types.d.ts.map