const FORBIDDEN_ACTION_KEYS = new Set(['query', 'text', 'transcript', 'audio', 'history', 'name', 'birthDate', 'health']);
export class PrivacyGuard {
    constructor(mode) {
        this.mode = mode;
    }
    assertProviderAllowed(explicitPermission) {
        if (this.mode !== 'managed' || !explicitPermission) {
            throw new Error('provider access denied by privacy mode');
        }
    }
    validateAction(action) {
        for (const key of Object.keys(action.args)) {
            if (FORBIDDEN_ACTION_KEYS.has(key))
                return false;
        }
        const path = action.args.path;
        if (path) {
            if (!path.startsWith('/') || path.startsWith('//'))
                return false;
            if (/[?#\\\u0000-\u001f]/.test(path))
                return false;
            if (path.split('/').includes('..'))
                return false;
        }
        return true;
    }
    safeEvent(event, fields = {}) {
        const safe = { event: event.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 64) };
        for (const [key, value] of Object.entries(fields)) {
            if (FORBIDDEN_ACTION_KEYS.has(key))
                continue;
            if (typeof value === 'string')
                safe[key] = value.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 80);
            else
                safe[key] = value;
        }
        return safe;
    }
}
//# sourceMappingURL=PrivacyGuard.js.map