function validUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
const SHA256_CONSTANTS = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function rotateRight(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
}
/** Browser-safe synchronous SHA-256 used to verify immutable knowledge snapshots. */
export function sha256Hex(value) {
    const input = new TextEncoder().encode(value);
    const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
    const bytes = new Uint8Array(paddedLength);
    bytes.set(input);
    bytes[input.length] = 0x80;
    // Encode the 64-bit bit length without BigInt so browser bundles targeting
    // ES2019 remain valid. JavaScript strings cannot produce a Uint8Array large
    // enough to exceed the exactly representable range used here.
    const bitLengthHigh = Math.floor(input.length / 0x20000000) >>> 0;
    const bitLengthLow = (input.length * 8) >>> 0;
    for (let index = 0; index < 4; index += 1) {
        bytes[paddedLength - 8 + index] = (bitLengthHigh >>> (24 - index * 8)) & 0xff;
        bytes[paddedLength - 4 + index] = (bitLengthLow >>> (24 - index * 8)) & 0xff;
    }
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < bytes.length; offset += 64) {
        for (let index = 0; index < 16; index += 1) {
            const at = offset + index * 4;
            words[index] = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
        }
        for (let index = 16; index < 64; index += 1) {
            const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
            const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
            words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = hash;
        for (let index = 0; index < 64; index += 1) {
            const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choice = (e & f) ^ (~e & g);
            const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
            const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (sum0 + majority) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }
        hash[0] = (hash[0] + a) >>> 0;
        hash[1] = (hash[1] + b) >>> 0;
        hash[2] = (hash[2] + c) >>> 0;
        hash[3] = (hash[3] + d) >>> 0;
        hash[4] = (hash[4] + e) >>> 0;
        hash[5] = (hash[5] + f) >>> 0;
        hash[6] = (hash[6] + g) >>> 0;
        hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((part) => part.toString(16).padStart(8, '0')).join('');
}
export function validateKnowledgeSnapshot(snapshot) {
    var _a, _b;
    const errors = [];
    if ((snapshot === null || snapshot === void 0 ? void 0 : snapshot.schemaVersion) !== 1)
        errors.push('schemaVersion must be 1');
    if (!(snapshot === null || snapshot === void 0 ? void 0 : snapshot.generatedAt) || Number.isNaN(Date.parse(snapshot.generatedAt)))
        errors.push('generatedAt is invalid');
    if (!Array.isArray(snapshot === null || snapshot === void 0 ? void 0 : snapshot.records) || snapshot.records.length === 0)
        errors.push('records must be non-empty');
    const ids = new Set();
    for (const [index, record] of ((_a = snapshot === null || snapshot === void 0 ? void 0 : snapshot.records) !== null && _a !== void 0 ? _a : []).entries()) {
        const at = `records[${index}]`;
        if (!record.id)
            errors.push(`${at}.id is required`);
        else if (ids.has(record.id))
            errors.push(`${at}.id is duplicate`);
        else
            ids.add(record.id);
        if (!record.type)
            errors.push(`${at}.type is required`);
        if (!((_b = record.content) === null || _b === void 0 ? void 0 : _b.trim()))
            errors.push(`${at}.content is required`);
        if (!validUrl(record.sourceUrl))
            errors.push(`${at}.sourceUrl must be https`);
        if (!/^[a-f0-9]{64}$/.test(record.contentHash))
            errors.push(`${at}.contentHash must be sha256`);
        else if (sha256Hex(record.content) !== record.contentHash)
            errors.push(`${at}.contentHash does not match content`);
        if (!record.fetchedAt || Number.isNaN(Date.parse(record.fetchedAt)))
            errors.push(`${at}.fetchedAt is invalid`);
        if (!record.lastVerifiedAt || Number.isNaN(Date.parse(record.lastVerifiedAt)))
            errors.push(`${at}.lastVerifiedAt is invalid`);
        if (record.expiresAt && Number.isNaN(Date.parse(record.expiresAt)))
            errors.push(`${at}.expiresAt is invalid`);
    }
    return errors;
}
export class KnowledgeStore {
    constructor(snapshot) {
        this.byId = new Map();
        const errors = validateKnowledgeSnapshot(snapshot);
        if (errors.length)
            throw new Error(`Invalid knowledge snapshot: ${errors.join('; ')}`);
        this.records = snapshot.records.map((record) => ({
            ...record,
            ...(record.data ? { data: { ...record.data } } : {}),
        }));
        for (const record of this.records)
            this.byId.set(record.id, record);
    }
    get(id) {
        return this.byId.get(id);
    }
    findByData(field, value, type) {
        return this.records.find((record) => {
            var _a;
            if (type && record.type !== type)
                return false;
            const candidate = (_a = record.data) === null || _a === void 0 ? void 0 : _a[field];
            return Array.isArray(candidate) ? candidate.includes(value) : candidate === value;
        });
    }
    forIntent(intentId) {
        return this.records.filter((record) => { var _a; return (_a = record.intents) === null || _a === void 0 ? void 0 : _a.includes(intentId); });
    }
    all() {
        return this.records.slice();
    }
}
//# sourceMappingURL=KnowledgeStore.js.map