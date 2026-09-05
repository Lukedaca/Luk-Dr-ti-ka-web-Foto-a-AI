export function createAgencySaasProfile(overrides) {
    return {
        id: (overrides === null || overrides === void 0 ? void 0 : overrides.id) || 'framemind-agency-saas',
        name: (overrides === null || overrides === void 0 ? void 0 : overrides.name) || 'FrameMind SaaS & Web Studio',
        domain: 'agency-saas',
        version: (overrides === null || overrides === void 0 ? void 0 : overrides.version) || '1.0.0',
        locale: (overrides === null || overrides === void 0 ? void 0 : overrides.locale) || 'cs-CZ',
        disclosure: (overrides === null || overrides === void 0 ? void 0 : overrides.disclosure) || 'Jsem hybridní agentka FrameMind. Neodpovídám jen textem – provedu vás po webu a ukážu vám naše produkty, ceník i ukázky.',
        privacyNotice: (overrides === null || overrides === void 0 ? void 0 : overrides.privacyNotice) || 'V soukromém režimu se veškeré dotazy a navigace zpracovávají lokálně v prohlížeči.',
        sections: (overrides === null || overrides === void 0 ? void 0 : overrides.sections) || [
            { id: 'weby', label: 'Webové stránky', type: 'page', target: '/weby', aliases: ['tvorba webu', 'landing page', 'one page'], defaultTool: 'navigate' },
            { id: 'cenik', label: 'Ceník služeb a agentů', type: 'page', target: '/cenik', aliases: ['ceny', 'tarify', 'kalkulace'], defaultTool: 'navigate' },
            { id: 'photo', label: 'Foto AI produkty', type: 'page', target: '/photo', aliases: ['culling', 'studio', 'fotografove'], defaultTool: 'navigate' },
            { id: 'sports', label: 'FrameMind Sports', type: 'page', target: '/sports', aliases: ['kluby', 'sportovni agent', 'predikce'], defaultTool: 'navigate' },
            { id: 'technologie', label: 'Technologie', type: 'page', target: '/technologie', aliases: ['tech stack', 'jak to funguje'], defaultTool: 'navigate' },
            { id: 'o-nas', label: 'O nás a kontakt', type: 'page', target: '/o-nas', aliases: ['kontakt', 'spojeni', 'lukas drsticka'], defaultTool: 'navigate' },
            { id: 'ochrana-dat', label: 'Ochrana dat', type: 'page', target: '/ochrana-dat', aliases: ['soukromi', 'gdpr'], defaultTool: 'navigate' },
            { id: 'hybridni-agent', label: 'Hybridní agent', type: 'page', target: '/produkty/hybridni-agent', aliases: ['agent', 'demo'], defaultTool: 'navigate' },
        ],
        capabilities: (overrides === null || overrides === void 0 ? void 0 : overrides.capabilities) || [
            { name: 'navigation', tools: ['navigate', 'open_menu'], description: 'Přechod mezi stránkami ceníku, produktů a technologií' },
            { name: 'interactive-dom', tools: ['scroll_to', 'highlight_element'], description: 'Zvýrazňování částí stránky a plynulý scroll' },
            { name: 'booking', tools: ['propose_slots', 'book_meeting'], description: 'Plánování a rezervace konzultací' },
        ],
        aliases: (overrides === null || overrides === void 0 ? void 0 : overrides.aliases) || {
            cenik: 'cenik',
            ceny: 'cenik',
            tarify: 'cenik',
            weby: 'weby',
            webu: 'weby',
            culling: 'photo',
            predikce: 'sports',
        },
        ...overrides,
    };
}
//# sourceMappingURL=agencySaasProfile.js.map