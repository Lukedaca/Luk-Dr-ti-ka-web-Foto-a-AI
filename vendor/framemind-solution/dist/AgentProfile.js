export function defineAgentProfile(profile) {
    if (!profile.id || typeof profile.id !== 'string') {
        throw new Error('AgentProfile must have a valid id');
    }
    if (!profile.name || typeof profile.name !== 'string') {
        throw new Error('AgentProfile must have a valid name');
    }
    if (!profile.domain || typeof profile.domain !== 'string') {
        throw new Error('AgentProfile must have a valid domain');
    }
    if (!Array.isArray(profile.sections)) {
        throw new Error('AgentProfile must define sections array');
    }
    if (!Array.isArray(profile.capabilities)) {
        throw new Error('AgentProfile must define capabilities array');
    }
    return profile;
}
export function extractProfileSiteLinks(profile) {
    return profile.sections.map((sec) => ({
        label: sec.label,
        path: sec.target,
    }));
}
export function findProfileSection(profile, query) {
    var _a;
    if (!query || typeof query !== 'string')
        return null;
    const norm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const sec of profile.sections) {
        const secId = sec.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const secLabel = sec.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (secId === norm || secLabel === norm)
            return sec;
        if ((_a = sec.aliases) === null || _a === void 0 ? void 0 : _a.some((a) => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === norm)) {
            return sec;
        }
    }
    return null;
}
export function validateProfileIntegrity(profile) {
    const errors = [];
    const sectionIds = new Set();
    for (const sec of profile.sections) {
        if (!sec.id)
            errors.push('Section without id found');
        if (sectionIds.has(sec.id))
            errors.push(`Duplicate section id: ${sec.id}`);
        sectionIds.add(sec.id);
        if (!sec.target)
            errors.push(`Section ${sec.id} missing target`);
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=AgentProfile.js.map