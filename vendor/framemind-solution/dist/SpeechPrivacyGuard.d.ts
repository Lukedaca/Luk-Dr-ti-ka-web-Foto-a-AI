import { DataPolicy } from './DataPolicy.js';
import type { EgressAuthorization, TenantDeploymentPolicy } from './types.js';
export type SpeechContentOrigin = 'verified-public-knowledge' | 'visitor' | 'internal';
export declare class SpeechPrivacyGuard {
    private readonly dataPolicy;
    private readonly tenant;
    constructor(dataPolicy: DataPolicy, tenant: TenantDeploymentPolicy);
    authorizeTts(text: string, origin: SpeechContentOrigin, voiceActivated: boolean): EgressAuthorization;
}
//# sourceMappingURL=SpeechPrivacyGuard.d.ts.map