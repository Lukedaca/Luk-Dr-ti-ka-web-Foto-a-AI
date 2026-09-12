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

export type ActionTool =
  | 'navigate'
  | 'open_menu'
  | 'scroll_to'
  | 'highlight_element'
  | 'show_sponsors'
  | 'contact'
  | 'filter_gallery'
  | 'toggle_theme'
  | 'open_lightbox'
  | 'play_showreel'
  | 'show_project_detail'
  | 'compare_before_after'
  | 'prefill_contact_form'
  | 'send_inquiry'
  | 'request_callback'
  | 'show_pricing'
  | 'compare_services'
  | string;

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
  cadence?: CadenceConfig;
  clarification?: ClarificationConfig;
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
