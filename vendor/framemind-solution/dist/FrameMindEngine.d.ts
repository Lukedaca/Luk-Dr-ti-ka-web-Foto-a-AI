import { ConversationContext } from './ConversationContext.js';
import { DataPolicy } from './DataPolicy.js';
import { DiscourseContext } from './DiscourseContext.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import type { FrameMindConfig, FrameMindRequest, FrameMindResponse, KnowledgeRecord, KnowledgeSnapshot } from './types.js';
export declare class FrameMindEngine {
    private readonly config;
    readonly context: ConversationContext;
    readonly discourse: DiscourseContext;
    private readonly sessionContexts;
    readonly privacyGuard: PrivacyGuard;
    readonly dataPolicy: DataPolicy;
    readonly learningSink: import("./types.js").LearningSink;
    private readonly intentEngine;
    private readonly composer;
    private readonly sourceResolver;
    private readonly actionResolver;
    private readonly providerRouter;
    private readonly store;
    constructor(config: FrameMindConfig, snapshot: KnowledgeSnapshot);
    private requestContext;
    /** Both birth years an age can mean, each grounded in a fresh record; otherwise undefined. */
    private resolveAgeRange;
    /**
     * Stateless hosts (serverless) create the engine per request, so the dialogue context
     * would be lost between turns. Prior user turns rebuild slots and the active intent.
     * Only a fresh context is rebuilt; unsafe turns are skipped.
     */
    private replayHistory;
    respond(request: FrameMindRequest): Promise<FrameMindResponse>;
    /**
     * Adds or replaces records by id in a running engine, e.g. live club data that arrive
     * after the widget started. Records are validated like a snapshot; invalid ones throw.
     */
    upsertRecords(records: KnowledgeRecord[]): void;
    reset(sessionId?: string): void;
}
//# sourceMappingURL=FrameMindEngine.d.ts.map