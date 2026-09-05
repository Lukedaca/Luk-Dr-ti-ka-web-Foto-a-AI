export function createPersonalPortfolioProfile(overrides) {
    return {
        id: (overrides === null || overrides === void 0 ? void 0 : overrides.id) || 'lukas-portfolio-agent',
        name: (overrides === null || overrides === void 0 ? void 0 : overrides.name) || 'Lukáš Drštička – Foto & AI',
        domain: 'personal-portfolio',
        version: (overrides === null || overrides === void 0 ? void 0 : overrides.version) || '1.0.0',
        locale: (overrides === null || overrides === void 0 ? void 0 : overrides.locale) || 'cs-CZ',
        disclosure: (overrides === null || overrides === void 0 ? void 0 : overrides.disclosure) || 'Ahoj, jsem Lukáš AI. Umím si s tebou povídat, provést tě portfoliem a ovládat web: vyfiltrovat fotky, ukázat ceník, přetočit showreel i přepnout vzhled.',
        privacyNotice: (overrides === null || overrides === void 0 ? void 0 : overrides.privacyNotice) || 'V soukromém režimu se vaše konverzace vyhodnocuje přímo v prohlížeči.',
        sections: (overrides === null || overrides === void 0 ? void 0 : overrides.sections) || [
            { id: 'portfolio', label: 'Portfolio a fotogalerie', type: 'section', target: '#portfolio', aliases: ['fotky', 'galerie', 'fotografie', 'ukazky'], defaultTool: 'scroll_to' },
            { id: 'skills', label: 'Dovednosti a technologie', type: 'section', target: '#skills', aliases: ['schopnosti', 'co umim', 'tech'], defaultTool: 'scroll_to' },
            { id: 'o-mne', label: 'O mně', type: 'section', target: '#o-mne', aliases: ['kdo je lukas', 'o mne', 'pribeh'], defaultTool: 'scroll_to' },
            { id: 'spoluprace', label: 'Spolupráce a služby', type: 'section', target: '#spoluprace', aliases: ['sluzby', 'nabidka', 'jak spolupracovat'], defaultTool: 'scroll_to' },
            { id: 'pricing', label: 'Ceník focení a služeb', type: 'section', target: '#pricing', aliases: ['cenik', 'ceny', 'kolik to stoji'], defaultTool: 'scroll_to' },
            { id: 'kontakt', label: 'Kontakt a poptávka', type: 'section', target: '#kontakt', aliases: ['napiste mi', 'formular', 'spojeni', 'email'], defaultTool: 'scroll_to' },
            { id: 'hybridni-agent', label: 'Hybridní agent na webu', type: 'section', target: '#hybridni-agent', aliases: ['agent', 'chatbot', 'ai asistent'], defaultTool: 'scroll_to' },
        ],
        capabilities: (overrides === null || overrides === void 0 ? void 0 : overrides.capabilities) || [
            { name: 'navigation', tools: ['scroll_to', 'navigate'], description: 'Plynulý přechod na sekce i otevření podstránek fotogalerií' },
            { name: 'gallery_filter', tools: ['filter_gallery'], description: 'Filtrování portfolia na fotky, AI díla nebo vše' },
            { name: 'theme_control', tools: ['toggle_theme'], description: 'Přepínání světlého a tmavého režimu webu' },
            { name: 'media', tools: ['open_lightbox', 'play_showreel', 'show_project_detail'], description: 'Otevření fotky ve zvětšení, přehrání showreelu, detail projektu' },
            { name: 'lead_inquiry', tools: ['prefill_contact_form', 'send_inquiry'], description: 'Předvyplnění nebo odeslání kontaktního formuláře' },
        ],
        aliases: (overrides === null || overrides === void 0 ? void 0 : overrides.aliases) || {
            foceni: 'spoluprace',
            atelier: 'spoluprace',
            portret: 'spoluprace',
            fotky: 'portfolio',
            galerie: 'portfolio',
            cenik: 'pricing',
            ceny: 'pricing',
            spojeni: 'kontakt',
        },
        ...overrides,
    };
}
//# sourceMappingURL=personalPortfolioProfile.js.map