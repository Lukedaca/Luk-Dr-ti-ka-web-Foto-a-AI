import { composeCadence, selectVariant } from './ConversationalCadence.js';
function formatItem(item) {
    var _a, _b;
    if (item === undefined || item === null)
        return '';
    if (typeof item === 'object') {
        const rec = item;
        const label = (_b = (_a = rec.name) !== null && _a !== void 0 ? _a : rec.title) !== null && _b !== void 0 ? _b : rec.label;
        if (typeof label === 'string' || typeof label === 'number')
            return String(label);
    }
    return String(item);
}
function valueAt(path, values) {
    return path.split('.').reduce((current, key) => {
        if (!current || typeof current !== 'object')
            return undefined;
        if (Array.isArray(current) && !/^\d+$/.test(key)) {
            return current
                .map((item) => (item && typeof item === 'object' ? item[key] : undefined))
                .filter((v) => v !== undefined && v !== null && v !== '');
        }
        return current[key];
    }, values);
}
export class ResponseComposer {
    compose(template, record, context, cadence, seed = '', listConjunction) {
        var _a, _b, _c, _d;
        const base = (template === null || template === void 0 ? void 0 : template.trim()) || (record === null || record === void 0 ? void 0 : record.content.trim()) || '';
        const values = {
            ...context.slots,
            ...((_a = record === null || record === void 0 ? void 0 : record.data) !== null && _a !== void 0 ? _a : {}),
            record: record !== null && record !== void 0 ? record : {},
        };
        const interpolated = base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path) => {
            const value = valueAt(path, values);
            if (value === undefined || value === null)
                return '';
            if (Array.isArray(value)) {
                const items = value.map(formatItem).filter(Boolean);
                if (listConjunction) {
                    return items.length < 2
                        ? items.join('')
                        : `${items.slice(0, -1).join(', ')} ${listConjunction} ${items[items.length - 1]}`;
                }
                return items.join(',');
            }
            return formatItem(value);
        }).replace(/(?<!\.)\.\.(?!\.)/g, '.').replace(/\s+/g, ' ').trim();
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