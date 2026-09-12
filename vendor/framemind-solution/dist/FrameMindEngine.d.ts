import { ConversationContext } from './ConversationContext.js';
import { DataPolicy } from './DataPolicy.js';
import { DiscourseContext } from './DiscourseContext.js';
import { PrivacyGuard } from './PrivacyGuard.js';
import type { FrameMindConfig, FrameMindRequest, FrameMindResponse, KnowledgeSnapshot } from './types.js';
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
    constructor(config: FrameMindConfig, snapshot: KnowledgeSnapshot);
    private requestContext;
    respond(request: FrameMindRequest): Promise<FrameMindResponse>;
    reset(sessionId?: string): void;
}
//# sourceMappingURL=FrameMindEngine.d.ts.map