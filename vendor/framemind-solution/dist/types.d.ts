export type FrameMindMode = 'strict' | 'managed';
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
export interface IntentResponseRule {
    intentId: string;
    /** Set to false for non-factual dialogue such as greetings or help. */
    sourceRequired?: boolean;
    recordId?: string;
    requiredAnySlots?: string[];
    missingTemplate?: string;
    missingRecordId?: string;
    selectBy?: {
        slot: string;
        dataField: string;
        recordType?: string;
    };
    template?: string;
    staleTemplate?: string;
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
export interface LearningEvent {
    kind: 'intent-correction' | 'knowledge-update' | 'local-preference';
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
    responses: IntentResponseRule[];
    actions: ActionDefinition[];
    unknownResponse: string;
    staleResponse: string;
    sourceLabel?: string;
    provider?: ProviderConfig;
    learningSink?: LearningSink;
    sessions?: SessionConfig;
    profile?: import('./AgentProfile.js').AgentProfile;
}
export interface FrameMindRequest {
    text: string;
    now?: Date;
    availablePaths?: string[];
    allowManagedProvider?: boolean;
    /** Deliberately prepared/redacted text sent to a managed provider. Raw text is never substituted. */
    providerText?: string;
    sessionId?: string;
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
//# sourceMappingURL=types.d.ts.map