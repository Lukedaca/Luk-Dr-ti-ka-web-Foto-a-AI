function valueAt(path, values) {
    return path.split('.').reduce((current, key) => {
        if (!current || typeof current !== 'object')
            return undefined;
        return current[key];
    }, values);
}
export class ResponseComposer {
    compose(template, record, context) {
        var _a;
        const base = (template === null || template === void 0 ? void 0 : template.trim()) || (record === null || record === void 0 ? void 0 : record.content.trim()) || '';
        const values = {
            ...context.slots,
            ...((_a = record === null || record === void 0 ? void 0 : record.data) !== null && _a !== void 0 ? _a : {}),
            record: record !== null && record !== void 0 ? record : {},
        };
        return base.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, path) => {
            const value = valueAt(path, values);
            return value === undefined || value === null ? '' : String(value);
        }).replace(/\s+/g, ' ').trim();
    }
}
//# sourceMappingURL=ResponseComposer.js.map