import { composeCadence, selectVariant } from './ConversationalCadence.js';
function valueAt(path, values) {
    return path.split('.').reduce((current, key) => {
        if (!current || typeof current !== 'object')
            return undefined;
        return current[key];
    }, values);
}
export class ResponseComposer {
    compose(template, record, context, cadence, seed = '') {
        var _a, _b, _c, _d;
        const base = (template === null || template === void 0 ? void 0 : template.trim()) || (record === null || record === void 0 ? void 0 : record.content.trim()) || '';
        const values = {
            ...context.slots,
            ...((_a = record === null || record === void 0 ? void 0 : record.data) !== null && _a !== void 0 ? _a : {}),
            record: record !== null && record !== void 0 ? record : {},
        };
        const interpolated = base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path) => {
            const value = valueAt(path, values);
            return value === undefined || value === null ? '' : String(value);
        }).replace(/\s+/g, ' ').trim();
        if (!cadence) {
            return interpolated;
        }
        const opener = ((_b = cadence.openers) === null || _b === void 0 ? void 0 : _b.length) ? selectVariant(cadence.openers, seed) : '';
        const detail = ((_c = cadence.details) === null || _c === void 0 ? void 0 : _c.length) ? selectVariant(cadence.details, seed) : '';
        const hook = ((_d = cadence.hooks) === null || _d === void 0 ? void 0 : _d.length) ? selectVariant(cadence.hooks, seed) : '';
        return composeCadence({
            opener,
            core: interpolated,
            detail,
            hook,
        });
    }
}
//# sourceMappingURL=ResponseComposer.js.map