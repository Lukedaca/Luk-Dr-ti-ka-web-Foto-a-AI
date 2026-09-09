export interface CadenceParts {
    opener?: string;
    core?: string;
    detail?: string;
    hook?: string;
}
/**
 * Deterministický výběr varianty podle textového seedu (např. dotaz nebo turn)
 */
export declare function selectVariant(variants: string[], seed?: string): string;
/**
 * Sestaví odpověď s přirozeným 4fázovým rytmem lidské řeči
 */
export declare function composeCadence({ opener, core, detail, hook }: CadenceParts): string;
//# sourceMappingURL=ConversationalCadence.d.ts.map