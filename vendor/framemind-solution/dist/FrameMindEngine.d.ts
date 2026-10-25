import { ConversationContext } from './ConversationContext.js';
import { DataPolicy } from './DataPolicy.js';
import { DiscourseContext } from './DiscourseContext.js';
import { KnowledgeReasoner } from './KnowledgeReasoner.js';
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
    readonly reasoner: KnowledgeReasoner;
    constructor(config: FrameMindConfig, snapshot: KnowledgeSnapshot);
    private requestContext;
    /** Both birth years an age can mean, each grounded in a fresh record; otherwise undefined. */
    private resolveAgeRange;
    /**
     * Slot-pivot & mention-pivot ellipsis resolution (2.1.0):
     * When a short follow-up message has no lexical intent of its own ("A béčko?", "A U-11?",
     * "A se Slavonínem?", "A u webů?"), checks whether it supplies a slot or mentioned entity
     * consumed by the active intent's response rule (or its generic pricing sibling).
     */
    private resolvePivotIntent;
    /**
     * Stateless hosts (serverless) create the engine per request, so the dialogue context
     * would be lost between turns. Prior user turns rebuild slots and the active intent.
     * Only a fresh context is rebuilt; unsafe turns are skipped.
     */
    private replayHistory;
    /**
     * Záměr tahu: lexikální detektor, doptávka (aspekt, slot, zmínka), sémantika, odvození.
     * Brána 2.6.0 pak rozhodne, jestli smí jádro odpovědět samo; když ne, vrací `unknown`
     * a záměr jen jako návrh (`deferral.intent`).
     */
    private detectTurn;
    private gateEnabled;
    private gateReason;
    /** Stejná odpověď podruhé za sebou znamená, že první nepomohla — rozhodne model. */
    private repeatsLastReply;
    /**
     * Opt-in semantic decision for messages the lexical detector does not know.
     * Only intents with a response rule are eligible; any resolver failure means
     * "not confident" and the request continues as before.
     */
    private resolveSemanticIntent;
    /**
     * Resolves the second factual clause of a compound question when the message asks two
     * distinct factual intents in a single turn ("Kolik stojí příspěvky a kdy je školička?").
     */
    private resolveSecondaryClause;
    respond(request: FrameMindRequest): Promise<FrameMindResponse>;
    private respondInternal;
    /**
     * Adds or replaces records by id in a running engine, e.g. live club data that arrive
     * after the widget started. Records are validated like a snapshot; invalid ones throw.
     */
    upsertRecords(records: KnowledgeRecord[]): void;
    reset(sessionId?: string): void;
}
//# sourceMappingURL=FrameMindEngine.d.ts.map