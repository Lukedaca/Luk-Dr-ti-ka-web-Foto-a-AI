import type { ResolvedAction, SiteLink, SiteMenu } from './types.js';
export declare function normalizeNavTarget(value: unknown, baseOrigin?: string, allowedApex?: string): string | null;
export declare function sanitizeNavLinks(raw: unknown, maxLinks?: number, normalizer?: (path: string) => string | null): SiteLink[];
export declare function normalizeNavText(value: unknown): string;
export declare function hasExplicitUiActionIntent(value: unknown): boolean;
export interface NavSearchOptions {
    aliases?: Record<string, string>;
    stopWords?: Set<string>;
    normalizer?: (path: string) => string | null;
}
export declare function findSiteLinkIntent(userText: string, siteLinks: SiteLink[], options?: NavSearchOptions): SiteLink | null;
export declare function findSiteMenuIntent(userText: string, siteMenus: SiteMenu[], options?: NavSearchOptions): SiteMenu | null;
export declare function collectDomSiteLinks(rootDoc?: any, options?: {
    normalizer?: (raw: string) => string | null;
    maxLinks?: number;
}): SiteLink[];
export declare function collectDomSiteMenus(rootDoc?: any, options?: {
    normalizer?: (raw: string) => string | null;
}): SiteMenu[];
export declare class PendingNavigationManager {
    private pending;
    private timer;
    private onExecute;
    private isVoiceActive;
    schedule(action: ResolvedAction, onExecute: (action: ResolvedAction) => void, isVoiceActive: () => boolean, failsafeMs?: number): void;
    flush(): boolean;
    cancel(): void;
    isPending(): boolean;
    getPending(): ResolvedAction | null;
}
//# sourceMappingURL=SiteNavigation.d.ts.map