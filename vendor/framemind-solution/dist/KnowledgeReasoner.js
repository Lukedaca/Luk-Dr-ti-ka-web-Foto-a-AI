import { FreshnessPolicy } from './FreshnessPolicy.js';
import { selectorsOf } from './SourceResolver.js';
import { expandCzechSynonyms, hasExplicitNavigation, isWithinOneEdit, normalizeText, stemCzechWord } from './text.js';
const GRAMMATICAL_STOPWORDS = new Set([
    'a', 'i', 'o', 'u', 'v', 'z', 'k', 's', 'se', 'si', 'na', 'do', 'od', 'po', 'pro', 'za', 've', 'ze', 'ke', 'ku',
    'je', 'jsou', 'jsem', 'jsme', 'jste', 'bude', 'budou', 'byl', 'byla', 'bylo', 'byli', 'by', 'aby', 'kdyby',
    'to', 'ten', 'ta', 'ty', 'tento', 'tato', 'toto', 'tyto', 'tam', 'tady', 'zde', 'tak', 'take', 'taky', 'uz',
    'ale', 'nebo', 'ani', 'jen', 'pouze', 'jeste', 'pak', 'tedy', 'proto', 'jako', 'nez', 'ktery', 'ktera', 'ktere',
    'mi', 'me', 'mu', 'ji', 'nam', 'vam', 'jim', 'vas', 'nas', 'svuj', 'svou', 'sve', 'muj', 'moje', 'tvuj',
    'chci', 'chtel', 'chtela', 'chteli', 'potrebuji', 'potreboval', 'potrebovala', 'potrebujeme', 'rad', 'rada',
    'mate', 'mas', 'mam', 'mame', 'maji', 'mozna', 'lze', 'jde', 'muzu', 'muzeme', 'muze', 'musim', 'musi',
    'prosim', 'dekuji', 'diky', 'dobry', 'dobre', 'den', 'ahoj', 'zdravim', 'cau', 'halo',
    'kolik', 'kdy', 'kde', 'kam', 'kdo', 'komu', 'cim', 'jak', 'jaka', 'jaky', 'jake', 'proc', 'co', 'zda', 'jestli',
    'vede', 'vedou', 'vedl', 'vedla', 'vedlo', 'stoji', 'stalo', 'funguje', 'funguji', 'fungovat', 'dela', 'delaji', 'delat',
    'platit', 'plati', 'zaplatit', 'zaplati', 'hradit', 'hradi', 'da', 'daji', 'dalo',
    'nic', 'moc', 'fakt', 'docela', 'celkem', 'super', 'skvele', 'fajn', 'parada', 'rozumim', 'jasne', 'aha', 'hele',
]);
const FOCUS_PATTERNS = [
    {
        focus: 'cost',
        pattern: /\b(?:kolik|za kolik|cen[a-z]*|rozpocet|stoj[a-z]*|plat[a-z]*|hrad[a-z]*|zaplat[a-z]*|kc|korun[a-z]*|czk|tarif[a-z]*|poplat[a-z]*|prispevk[a-z]*|vstupn[a-z]*|levn[a-z]*|drah[a-z]*|vyjd[a-z]*)\b/,
    },
    {
        focus: 'time',
        pattern: /\b(?:kdy|v kolik|cas[a-z]*|termin[a-z]*|rozpis[a-z]*|do kdy|od kdy|splatnost[a-z]*|ktere dny|jak casto|hodin[a-z]*)\b/,
    },
    {
        focus: 'location',
        pattern: /\b(?:kde|kam|adres[a-z]*|mist[a-z]*|ulic[a-z]*|areal[a-z]*|hrist[a-z]*|stadion[a-z]*|vstup[a-z]*|kudy|sídl[a-z]*|sidl[a-z]*)\b/,
    },
    {
        focus: 'contact',
        pattern: /\b(?:kdo|komu|s kym|kontakt[a-z]*|telefon[a-z]*|email[a-z]*|mail[a-z]*|cisl[a-z]*|spojit|napsat|zavolat|trener[a-z]*|veden[a-z]*|predsed[a-z]*|seftrener[a-z]*)\b/,
    },
    {
        focus: 'age',
        pattern: /\b(?:vek[a-z]*|rocnik[a-z]*|let[a-z]*|od kolika|pro koho|kategori[a-z]*)\b/,
    },
    {
        focus: 'comparison',
        pattern: /\b(?:rozdil[a-z]*|porovn[a-z]*|srovn[a-z]*|vyplat[a-z]*|leps[a-z]*|zvolit|vybrat|variant[a-z]*|mezi nimi)\b/,
    },
    {
        focus: 'process',
        pattern: /\b(?:jak[a-z]*|co umi|co obsahuje|co je v|jak probiha|s sebou|podmink[a-z]*|funguj[a-z]*)\b/,
    },
];
function splitSentences(text) {
    const raw = String(text !== null && text !== void 0 ? text : '').trim();
    if (!raw)
        return [];
    const parts = [];
    const re = /(?:(?<!\b\d+)[.!?]|;)\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(raw)) !== null) {
        const end = match.index + 1;
        const sentence = raw.slice(lastIndex, end).trim();
        if (sentence)
            parts.push(sentence);
        lastIndex = match.index + match[0].length;
    }
    const tail = raw.slice(lastIndex).trim();
    if (tail)
        parts.push(tail);
    return parts;
}
function extractInformativeStems(text) {
    const norm = normalizeText(text);
    if (!norm)
        return [];
    const out = [];
    for (const word of norm.split(/[\s-]+/).filter(Boolean)) {
        if (word.length < 3 || GRAMMATICAL_STOPWORDS.has(word) || /^\d+$/.test(word))
            continue;
        const stem = stemCzechWord(word);
        if (stem.length >= 3 && !GRAMMATICAL_STOPWORDS.has(stem)) {
            out.push(stem);
        }
    }
    return out;
}
function buildCharGrams(stems, minN = 3, maxN = 5) {
    var _a;
    const out = new Map();
    for (const stem of stems) {
        const padded = ` ${stem} `;
        for (let n = minN; n <= maxN; n += 1) {
            for (let i = 0; i + n <= padded.length; i += 1) {
                const gram = padded.slice(i, i + n);
                out.set(gram, ((_a = out.get(gram)) !== null && _a !== void 0 ? _a : 0) + 1);
            }
        }
    }
    return out;
}
export function extractPriceTiers(text) {
    var _a, _b;
    const tiers = [];
    const seen = new Set();
    const clauses = String(text !== null && text !== void 0 ? text : '')
        .split(/(?<=[.!?])\s+|,\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9])|;\s+/)
        .map((c) => c.trim())
        .filter(Boolean);
    const priceRe = /([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž0-9&\s–-]{2,45}?)\s+(?:má\s+implementaci|stojí|je\s+od|je|od|za)?\s*(\d{1,3}(?:\s\d{3})+|\d{3,6})\s*Kč/g;
    for (const clause of clauses) {
        let match;
        priceRe.lastIndex = 0;
        while ((match = priceRe.exec(clause)) !== null) {
            const rawLabel = ((_a = match[1]) !== null && _a !== void 0 ? _a : '')
                .replace(/^(?:Ceník\s+[^:]+:\s*|Tarif\s+|a\s+)/i, '')
                .replace(/\b(?:má|stojí|je|od|za)\s*$/i, '')
                .trim();
            const amountKc = Number(((_b = match[2]) !== null && _b !== void 0 ? _b : '').replace(/\s+/g, ''));
            if (!rawLabel || !Number.isFinite(amountKc) || amountKc <= 0)
                continue;
            // Ignore monthly maintenance fees when extracting primary package tiers unless that's the main label
            if (/^(?:správa|měsíční|technická správa)$/i.test(rawLabel))
                continue;
            const key = `${normalizeText(rawLabel)}:${amountKc}`;
            if (!seen.has(key)) {
                seen.add(key);
                tiers.push({ label: rawLabel, amountKc, sentence: clause });
            }
        }
    }
    return tiers;
}
export function analyzeFactSignature(text, data) {
    const norm = normalizeText(text);
    const dataKeys = Object.keys(data !== null && data !== void 0 ? data : {}).map((k) => k.toLowerCase());
    const dataStr = normalizeText(Object.values(data !== null && data !== void 0 ? data : {}).join(' '));
    const combined = `${norm} ${dataStr}`.trim();
    const tiers = extractPriceTiers(text);
    const hasCurrency = tiers.length > 0
        || /\b\d[\d\s]*\s*(?:kc|korun|czk)\b/.test(combined)
        || /\b(?:zdarma|platb[a-z]*|splatnost|cenik|pololet[a-z]*|hotov[a-z]*)\b/.test(combined)
        || dataKeys.some((k) => /price|fee|cost|amount|cena/.test(k));
    const hasSchedule = /\b\d{1,2}:\d{2}\b/.test(text)
        || /\b\d{1,2}\.\s*(?:\d{1,2}\.|ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)\b/.test(combined)
        || /\b(?:pondel[a-z]*|uter[a-z]*|stred[a-z]*|ctvrt[a-z]*|patek|patk[a-z]*|sobot[a-z]*|nedel[a-z]*|srpn[a-z]*|cervenc[a-z]*|zari|rijn[a-z]*|unor[a-z]*)\b/.test(combined)
        || dataKeys.some((k) => /when|time|days|date|schedule/.test(k));
    const hasLocation = /\b(?:ulic[a-z]*|areal[a-z]*|stadion[a-z]*|hrist[a-z]*|sokolsk[a-z]*|vstup[a-z]*|adresa|misto|kde|github\.com)\b/.test(combined)
        || /https?:\/\//.test(text)
        || dataKeys.some((k) => /venue|address|location|place|entrance|url/.test(k));
    const hasContact = /@/.test(text)
        || /\b(?:\+420\s*)?\d{3}\s*\d{3}\s*\d{3}\b/.test(text)
        || /\b(?:mgr|ing|bc|predseda|seftrener|trener[a-z]*|kontakt[a-z]*|telefon[a-z]*|email[a-z]*)\b/.test(combined)
        || dataKeys.some((k) => /phone|email|contact|coach|person/.test(k));
    const hasAgeOrYear = /\b20\d{2}\b/.test(combined)
        || /\bu-?\d{1,2}\b/.test(combined)
        || /\b\d{1,2}\s*let\b/.test(combined)
        || dataKeys.some((k) => /birthyear|minage|age|category/.test(k));
    const hasComparison = tiers.length >= 2
        || /\b(?:rozdil|zatimco|oproti|nebo|varianta|tarif)\b/.test(combined);
    return {
        hasCurrency,
        hasSchedule,
        hasLocation,
        hasContact,
        hasAgeOrYear,
        hasComparison,
        tiers,
    };
}
export function detectQueryFocuses(text) {
    const norm = normalizeText(text);
    const focuses = new Set();
    for (const { focus, pattern } of FOCUS_PATTERNS) {
        if (pattern.test(norm))
            focuses.add(focus);
    }
    return focuses;
}
function focusMatchesSignature(focuses, sig) {
    if (focuses.size === 0)
        return { matched: false, contradictedTime: false };
    let matched = false;
    if (focuses.has('cost') && sig.hasCurrency)
        matched = true;
    if (focuses.has('time') && sig.hasSchedule)
        matched = true;
    if (focuses.has('location') && sig.hasLocation)
        matched = true;
    if (focuses.has('contact') && sig.hasContact)
        matched = true;
    if (focuses.has('age') && sig.hasAgeOrYear)
        matched = true;
    if (focuses.has('comparison') && sig.hasComparison)
        matched = true;
    // If the visitor asks specifically WHEN ("Kdy je trénink?") and nothing else,
    // but the candidate record has zero schedule/temporal facts, mark as contradicted.
    const onlyTimeFocus = focuses.size === 1 && focuses.has('time');
    const contradictedTime = onlyTimeFocus && !sig.hasSchedule;
    return { matched, contradictedTime };
}
/**
 * Local Deductive Knowledge Reasoner (FrameMind Solution 2.5.0).
 *
 * Self-indexes the verified KnowledgeStore and IntentResponseRules so the agent can:
 * 1. Deduce intents, records, slots, and facets directly from grounded facts without
 *    relying on manually programmed keyword lists.
 * 2. Resolve 1-edit typos against the entire corpus vocabulary of the tenant.
 * 3. Extract targeted follow-up sentences and evaluate numeric/budget constraints
 *    strictly from fresh, verified records without ever fabricating facts.
 */
export class KnowledgeReasoner {
    constructor(config, store, freshnessPolicy = new FreshnessPolicy()) {
        this.config = config;
        this.store = store;
        this.freshnessPolicy = freshnessPolicy;
        this.docs = [];
        this.stemIdf = new Map();
        this.gramIdf = new Map();
        this.corpusVocabulary = new Set();
        this.rebuildIndex();
    }
    /** Rebuilds the deductive index after live records are upserted into KnowledgeStore. */
    rebuildIndex() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const records = this.store.all();
        const byIntent = new Map();
        for (const def of this.config.intents)
            byIntent.set(def.id, def);
        const docs = [];
        const stemDocFreq = new Map();
        const gramDocFreq = new Map();
        const vocab = new Set();
        for (const rule of this.config.responses) {
            const definition = byIntent.get(rule.intentId);
            if (definition === null || definition === void 0 ? void 0 : definition.standalone)
                continue;
            const linkedRecords = this.collectRuleRecords(rule, records);
            // Do not deductively route to source-free rules unless they have explicit examples/templates
            if (rule.sourceRequired === false && linkedRecords.length === 0 && !((_a = definition === null || definition === void 0 ? void 0 : definition.examples) === null || _a === void 0 ? void 0 : _a.length)) {
                continue;
            }
            const textSegments = [];
            const sentences = [];
            for (const rec of linkedRecords) {
                textSegments.push(rec.content);
                if ((_b = rec.tags) === null || _b === void 0 ? void 0 : _b.length)
                    textSegments.push(rec.tags.join(' '));
                if (rec.data) {
                    for (const [k, v] of Object.entries(rec.data)) {
                        textSegments.push(k);
                        if (Array.isArray(v))
                            textSegments.push(v.map(String).join(' '));
                        else if (typeof v === 'string' || typeof v === 'number')
                            textSegments.push(String(v));
                    }
                }
                for (const sent of splitSentences(rec.content)) {
                    const sentStems = new Set(extractInformativeStems(sent));
                    const sentGrams = buildCharGrams(sentStems);
                    sentences.push({
                        recordId: rec.id,
                        raw: sent,
                        stems: sentStems,
                        grams: sentGrams,
                        signature: analyzeFactSignature(sent, rec.data),
                    });
                }
            }
            if (rule.template && !/^\{\{\s*(?:record\.)?content\s*\}\}$/.test(rule.template.trim())) {
                textSegments.push(rule.template.replace(/\{\{[^}]+\}\}/g, ' '));
            }
            for (const facet of (_c = rule.facets) !== null && _c !== void 0 ? _c : []) {
                textSegments.push(facet.template.replace(/\{\{[^}]+\}\}/g, ' '));
                textSegments.push(facet.keywords.join(' '));
            }
            if ((_d = definition === null || definition === void 0 ? void 0 : definition.examples) === null || _d === void 0 ? void 0 : _d.length)
                textSegments.push(definition.examples.join(' '));
            if ((_e = definition === null || definition === void 0 ? void 0 : definition.keywords) === null || _e === void 0 ? void 0 : _e.length)
                textSegments.push(definition.keywords.join(' '));
            const combinedText = textSegments.join(' ');
            const stemsList = extractInformativeStems(combinedText);
            const stems = new Map();
            for (const stem of stemsList) {
                stems.set(stem, ((_f = stems.get(stem)) !== null && _f !== void 0 ? _f : 0) + 1);
                vocab.add(stem);
            }
            for (const stem of stems.keys()) {
                stemDocFreq.set(stem, ((_g = stemDocFreq.get(stem)) !== null && _g !== void 0 ? _g : 0) + 1);
            }
            const grams = buildCharGrams(stems.keys());
            for (const gram of grams.keys()) {
                gramDocFreq.set(gram, ((_h = gramDocFreq.get(gram)) !== null && _h !== void 0 ? _h : 0) + 1);
            }
            const mergedData = {};
            for (const rec of linkedRecords) {
                if (rec.data)
                    Object.assign(mergedData, rec.data);
            }
            docs.push({
                intentId: rule.intentId,
                rule,
                definition,
                records: linkedRecords,
                stems,
                grams,
                signature: analyzeFactSignature(combinedText, mergedData),
                sentences,
            });
        }
        const totalDocs = Math.max(1, docs.length);
        this.stemIdf.clear();
        for (const [stem, df] of stemDocFreq) {
            this.stemIdf.set(stem, Math.log((1 + totalDocs) / (1 + df)) + 1);
        }
        this.gramIdf.clear();
        for (const [gram, df] of gramDocFreq) {
            this.gramIdf.set(gram, Math.log((1 + totalDocs) / (1 + df)) + 1);
        }
        this.corpusVocabulary = vocab;
        this.docs = docs;
    }
    collectRuleRecords(rule, allRecords) {
        var _a;
        const out = new Map();
        const add = (r) => {
            if (r)
                out.set(r.id, r);
        };
        if (rule.recordId)
            add(this.store.get(rule.recordId));
        if (rule.missingRecordId)
            add(this.store.get(rule.missingRecordId));
        for (const rec of this.store.forIntent(rule.intentId))
            add(rec);
        for (const sel of selectorsOf(rule)) {
            for (const rec of allRecords) {
                if (sel.recordType && rec.type === sel.recordType)
                    add(rec);
                else if (!sel.recordType && ((_a = rec.data) === null || _a === void 0 ? void 0 : _a[sel.dataField]) !== undefined)
                    add(rec);
            }
        }
        for (const rec of allRecords) {
            if (rec.id === rule.intentId || rec.type === rule.intentId)
                add(rec);
        }
        return [...out.values()];
    }
    /** Resolves query stems, including 1-edit typo correction against the grounded corpus vocabulary. */
    resolveQueryStems(text) {
        const rawWords = normalizeText(text).split(/[\s-]+/).filter(Boolean);
        const groundedStems = [];
        let ungroundedCount = 0;
        for (const word of rawWords) {
            if (word.length < 3 || GRAMMATICAL_STOPWORDS.has(word) || /^\d+$/.test(word))
                continue;
            const stem = stemCzechWord(word);
            if (!stem || stem.length < 3 || GRAMMATICAL_STOPWORDS.has(stem))
                continue;
            if (this.corpusVocabulary.has(stem)) {
                groundedStems.push(stem);
                continue;
            }
            // Check prefix/stem compatibility or 1-edit typo against corpus vocabulary
            let matchedCorpusStem;
            for (const candidate of this.corpusVocabulary) {
                if (candidate.length >= 4 && stem.length >= 4 && (candidate.startsWith(stem) || stem.startsWith(candidate))) {
                    if (Math.abs(candidate.length - stem.length) <= 2) {
                        matchedCorpusStem = candidate;
                        break;
                    }
                }
                if (candidate.length >= 5 && stem.length >= 5 && isWithinOneEdit(stem, candidate)) {
                    matchedCorpusStem = candidate;
                    break;
                }
            }
            if (matchedCorpusStem) {
                groundedStems.push(matchedCorpusStem);
                continue;
            }
            const expanded = expandCzechSynonyms(word);
            if (expanded !== word) {
                const synWords = expanded.slice(word.length).trim().split(/\s+/).filter(Boolean);
                let synMatched = false;
                for (const synWord of synWords) {
                    const synStem = stemCzechWord(synWord);
                    if (synStem && this.corpusVocabulary.has(synStem)) {
                        groundedStems.push(synStem);
                        synMatched = true;
                    }
                }
                if (synMatched)
                    continue;
            }
            if (word.length >= 5) {
                ungroundedCount += 1;
            }
        }
        return { groundedStems: [...new Set(groundedStems)], ungroundedCount };
    }
    /**
     * Infers slot values directly from KnowledgeStore record `data` fields referenced by `selectBy`
     * when no explicit `slotPatterns` matched.
     */
    deduceSlots(queryText, currentSlots) {
        var _a, _b, _c;
        const inferred = {};
        const { groundedStems } = this.resolveQueryStems(queryText);
        if (groundedStems.length === 0)
            return inferred;
        const normQuery = normalizeText(queryText);
        for (const rule of this.config.responses) {
            for (const sel of selectorsOf(rule)) {
                if (!sel.slot || sel.mentioned || currentSlots[sel.slot] !== undefined || inferred[sel.slot] !== undefined) {
                    continue;
                }
                let bestValue;
                let bestScore = 0;
                for (const rec of this.store.all()) {
                    if (sel.recordType && rec.type !== sel.recordType)
                        continue;
                    const val = (_a = rec.data) === null || _a === void 0 ? void 0 : _a[sel.dataField];
                    if (val === undefined || Array.isArray(val))
                        continue;
                    const valStr = normalizeText(String(val));
                    if (valStr && valStr.length >= 3 && normQuery.includes(valStr)) {
                        bestValue = val;
                        bestScore = 100;
                        break;
                    }
                    // Match distinctive stems of a record that uniquely represents this slot value
                    const recStems = new Set(extractInformativeStems(`${rec.content} ${((_b = rec.tags) !== null && _b !== void 0 ? _b : []).join(' ')}`));
                    let score = 0;
                    for (const qStem of groundedStems) {
                        if (recStems.has(qStem)) {
                            score += (_c = this.stemIdf.get(qStem)) !== null && _c !== void 0 ? _c : 1;
                        }
                    }
                    if (score > bestScore && score >= 2.2) {
                        bestScore = score;
                        bestValue = val;
                    }
                }
                if (bestValue !== undefined) {
                    inferred[sel.slot] = bestValue;
                }
            }
        }
        return inferred;
    }
    /**
     * Deductively resolves the intent and optional facet from the KnowledgeStore and
     * active dialogue state when lexical/exact matching returned `unknown`.
     */
    deduceIntent(queryText, context, discourse, now = new Date()) {
        var _a, _b, _c, _d, _e, _f, _g;
        const { groundedStems, ungroundedCount } = this.resolveQueryStems(queryText);
        const focuses = detectQueryFocuses(queryText);
        const inferredSlots = this.deduceSlots(queryText, context.slots);
        // 1. Multi-turn Contextual Deduction on Active Intent's Record:
        // If the visitor is in an active topic and asks about a specific fact or aspect present
        // inside the active intent's grounded record (e.g. "A dá se platit hotově?", "A kdy je splatnost?"),
        // keep the active intent if the active record actually contains the grounded evidence.
        if (context.activeIntent && ungroundedCount === 0) {
            const activeDoc = this.docs.find((d) => d.intentId === context.activeIntent);
            if (activeDoc && activeDoc.records.some((r) => this.freshnessPolicy.evaluate(r, now) === 'fresh')) {
                const matchingStems = groundedStems.filter((s) => activeDoc.stems.has(s));
                const { matched: focusMatched, contradictedTime } = focusMatchesSignature(focuses, activeDoc.signature);
                if (!contradictedTime && (matchingStems.length >= 1 || (groundedStems.length === 0 && focusMatched))) {
                    // Verify no other intent has a much stronger direct stem match (topic switch)
                    let strongerOther = false;
                    for (const other of this.docs) {
                        if (other.intentId === activeDoc.intentId)
                            continue;
                        const otherMatches = groundedStems.filter((s) => other.stems.has(s) && !activeDoc.stems.has(s));
                        if (otherMatches.length >= 1 && matchingStems.length === 0) {
                            strongerOther = true;
                            break;
                        }
                    }
                    if (!strongerOther) {
                        const freshRec = activeDoc.records.find((r) => this.freshnessPolicy.evaluate(r, now) === 'fresh');
                        const facet = freshRec ? this.deduceFacet(activeDoc.rule, freshRec, queryText, true) : undefined;
                        return {
                            intentId: activeDoc.intentId,
                            confidence: 0.78,
                            recordId: freshRec === null || freshRec === void 0 ? void 0 : freshRec.id,
                            ...(facet ? { facet } : {}),
                            isFollowUp: true,
                            inferredSlots,
                        };
                    }
                }
            }
        }
        // 2. Corpus-wide Deductive Scoring across all answerable rules & records:
        if (groundedStems.length === 0)
            return null;
        const isNavigationQuery = hasExplicitNavigation(normalizeText(queryText));
        const queryGrams = buildCharGrams(groundedStems);
        const scored = [];
        for (const doc of this.docs) {
            if (doc.intentId === 'contact_capture' || doc.intentId === 'recruitment_contact')
                continue;
            if (isNavigationQuery) {
                const queryTargetStems = groundedStems.filter((s) => !['otevr', 'prejd', 'ukaz', 'zobraz', 'rozbal', 'naviguj'].includes(s));
                const hasMatchingAction = this.config.actions.some((a) => {
                    var _a, _b;
                    if (!a.intentIds.includes(doc.intentId))
                        return false;
                    const actionText = `${(_a = a.args.label) !== null && _a !== void 0 ? _a : ''} ${(_b = a.args.path) !== null && _b !== void 0 ? _b : ''}`;
                    const actionStems = new Set(extractInformativeStems(actionText));
                    return queryTargetStems.length > 0 && queryTargetStems.every((s) => actionStems.has(s));
                });
                if (!hasMatchingAction)
                    continue;
            }
            // Ensure the rule has at least one fresh record if sourceRequired !== false
            if (doc.rule.sourceRequired !== false && doc.records.length > 0) {
                const hasFresh = doc.records.some((r) => this.freshnessPolicy.evaluate(r, now) === 'fresh');
                if (!hasFresh)
                    continue;
            }
            const { matched: focusMatched, contradictedTime } = focusMatchesSignature(focuses, doc.signature);
            if (contradictedTime)
                continue;
            let stemScore = 0;
            let matchedStems = 0;
            for (const stem of groundedStems) {
                const tf = (_a = doc.stems.get(stem)) !== null && _a !== void 0 ? _a : 0;
                if (tf > 0) {
                    matchedStems += 1;
                    const idf = (_b = this.stemIdf.get(stem)) !== null && _b !== void 0 ? _b : 1;
                    stemScore += (1 + Math.log(tf)) * idf;
                }
            }
            if (matchedStems === 0)
                continue;
            // Require either >= 2 grounded stems OR 1 distinctive stem (high IDF) + structural/sentence confirmation
            const coverage = matchedStems / Math.max(1, groundedStems.length + ungroundedCount);
            if (matchedStems === 1 && groundedStems.length === 1 && !focusMatched && stemScore < 2.1) {
                continue;
            }
            // Compute best sentence-level match inside the record
            let bestSentenceBonus = 0;
            for (const sent of doc.sentences) {
                let sentHits = 0;
                for (const stem of groundedStems) {
                    if (sent.stems.has(stem))
                        sentHits += 1;
                }
                if (sentHits > 0) {
                    const sentFocus = focusMatchesSignature(focuses, sent.signature).matched ? 0.35 : 0;
                    const sScore = sentHits / Math.max(1, groundedStems.length) + sentFocus;
                    if (sScore > bestSentenceBonus)
                        bestSentenceBonus = sScore;
                }
            }
            // N-gram similarity bonus
            let gramDot = 0;
            let qNorm = 0;
            let dNorm = 0;
            for (const [g, qTf] of queryGrams) {
                const w = (1 + Math.log(qTf)) * ((_c = this.gramIdf.get(g)) !== null && _c !== void 0 ? _c : 1);
                qNorm += w * w;
                const dTf = doc.grams.get(g);
                if (dTf) {
                    const dw = (1 + Math.log(dTf)) * ((_d = this.gramIdf.get(g)) !== null && _d !== void 0 ? _d : 1);
                    gramDot += w * dw;
                }
            }
            for (const [g, dTf] of doc.grams) {
                const dw = (1 + Math.log(dTf)) * ((_e = this.gramIdf.get(g)) !== null && _e !== void 0 ? _e : 1);
                dNorm += dw * dw;
            }
            const gramSim = qNorm > 0 && dNorm > 0 ? gramDot / (Math.sqrt(qNorm) * Math.sqrt(dNorm)) : 0;
            const focusBonus = focusMatched ? 0.85 : 0;
            const ungroundedPenalty = ungroundedCount * 1.65;
            const totalScore = stemScore * coverage + bestSentenceBonus * 0.9 + gramSim * 1.2 + focusBonus - ungroundedPenalty;
            if (totalScore >= 1.85) {
                scored.push({ doc, score: totalScore, matchedStems });
            }
        }
        if (scored.length === 0)
            return null;
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        const second = scored[1];
        if (second && best.score - second.score < 0.22) {
            return null;
        }
        const freshRec = best.doc.records.find((r) => this.freshnessPolicy.evaluate(r, now) === 'fresh');
        const recordAlreadySeen = Boolean(freshRec && context.sourceIds.includes(freshRec.id));
        const facet = freshRec ? this.deduceFacet(best.doc.rule, freshRec, queryText, recordAlreadySeen) : undefined;
        return {
            intentId: best.doc.intentId,
            confidence: Math.min(0.95, Math.max(0.55, best.score / 5)),
            recordId: freshRec === null || freshRec === void 0 ? void 0 : freshRec.id,
            ...(facet ? { facet } : {}),
            isFollowUp: Boolean(context.activeIntent
                && (context.activeIntent === best.doc.intentId || ((_g = (_f = best.doc.definition) === null || _f === void 0 ? void 0 : _f.followUpFor) === null || _g === void 0 ? void 0 : _g.includes(context.activeIntent)))),
            inferredSlots,
        };
    }
    /**
     * Deductively selects a ResponseFacet from `rule.facets` by analyzing the factual content
     * of each facet template, or synthesizes a single-sentence facet from `record.content`
     * when answering a targeted follow-up on a record already seen in the session.
     */
    deduceFacet(rule, record, queryText, recordAlreadySeen = false) {
        var _a, _b;
        if (!rule || !record)
            return undefined;
        const { groundedStems, ungroundedCount } = this.resolveQueryStems(queryText);
        if (ungroundedCount > 0)
            return undefined;
        const focuses = detectQueryFocuses(queryText);
        // 1. Score existing rule.facets by their actual template content & structural signature
        if ((_a = rule.facets) === null || _a === void 0 ? void 0 : _a.length) {
            const recordStems = new Set(extractInformativeStems(record.content));
            const candidates = [];
            for (const facet of rule.facets) {
                const facetSpecificText = facet.template
                    .replace(/^\{\{\s*(?:record\.)?content\s*\}\}\s*/, '')
                    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
                    var _a;
                    const val = (_a = record.data) === null || _a === void 0 ? void 0 : _a[key];
                    return val !== undefined ? String(val) : '';
                });
                const facetStems = new Set(extractInformativeStems(facetSpecificText));
                const sig = analyzeFactSignature(facetSpecificText, record.data);
                let score = 0;
                for (const stem of groundedStems) {
                    if (facetStems.has(stem)) {
                        // Stems unique to this facet (not in the generic record intro) weigh more
                        score += recordStems.has(stem) ? 1.0 : 2.2;
                    }
                }
                if (focusMatchesSignature(focuses, sig).matched && score > 0) {
                    score += 1.0;
                }
                if (score >= 2.0) {
                    candidates.push({ facet, score });
                }
            }
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                if (candidates.length === 1 || candidates[0].score - candidates[1].score >= 0.8) {
                    return candidates[0].facet;
                }
            }
        }
        // 2. Auto-Facet Sentence Deduction from multi-sentence record.content:
        // - On follow-up turns (recordAlreadySeen === true): extracts only the 1-2 sentences that
        //   directly answer the visitor's follow-up ("A do kdy je splatnost?", "A dá se platit hotově?").
        // - On initial turns (recordAlreadySeen === false): when a record has >= 3 sentences and the
        //   visitor asks a targeted detail question matching a non-leading sentence (with stems absent
        //   from the overview sentence), synthesizes a concise 1-2 sentence answer instead of dumping
        //   the entire paragraph wall.
        const sentences = splitSentences(record.content);
        if (sentences.length >= 2) {
            const firstSentStems = new Set(extractInformativeStems(sentences[0]));
            const scoredSentences = [];
            for (let idx = 0; idx < sentences.length; idx += 1) {
                const sentence = sentences[idx];
                const sentStems = new Set(extractInformativeStems(sentence));
                const sig = analyzeFactSignature(sentence, record.data);
                let score = 0;
                let uniqueToBody = false;
                for (const stem of groundedStems) {
                    if (sentStems.has(stem)) {
                        score += (_b = this.stemIdf.get(stem)) !== null && _b !== void 0 ? _b : 1.2;
                        if (idx > 0 && !firstSentStems.has(stem)) {
                            uniqueToBody = true;
                        }
                    }
                }
                if (focusMatchesSignature(focuses, sig).matched) {
                    score += 1.1;
                }
                if (score >= 1.5) {
                    scoredSentences.push({ sentence, score, idx, uniqueToBody });
                }
            }
            if (recordAlreadySeen && scoredSentences.length > 0 && scoredSentences.length < sentences.length) {
                scoredSentences.sort((a, b) => b.score - a.score);
                const topScore = scoredSentences[0].score;
                const selected = scoredSentences
                    .filter((s) => topScore - s.score <= 0.6)
                    .slice(0, 2)
                    .map((s) => s.sentence);
                if (selected.length > 0 && selected.length < sentences.length) {
                    return {
                        id: 'deduced',
                        keywords: [],
                        template: selected.join(' '),
                    };
                }
            }
        }
        return undefined;
    }
    /**
     * Returns grounded content phrases from the verified KnowledgeStore records linked to `intentId`,
     * used by AnswerGate when the intent has configured lexical definitions so visitors can ask about
     * any fact inside the verified record without pre-programmed facet keywords.
     */
    getRuleRecordTerms(intentId, now = new Date()) {
        var _a, _b, _c, _d, _e;
        const doc = this.docs.find((d) => d.intentId === intentId);
        if (!doc)
            return [];
        const def = doc.definition;
        const hasConfiguredAnchors = Boolean(((_a = def === null || def === void 0 ? void 0 : def.keywords) === null || _a === void 0 ? void 0 : _a.length)
            || ((_b = def === null || def === void 0 ? void 0 : def.keywordGroups) === null || _b === void 0 ? void 0 : _b.length)
            || ((_c = def === null || def === void 0 ? void 0 : def.examples) === null || _c === void 0 ? void 0 : _c.length)
            || ((_d = def === null || def === void 0 ? void 0 : def.exactExamples) === null || _d === void 0 ? void 0 : _d.length)
            || ((_e = def === null || def === void 0 ? void 0 : def.patterns) === null || _e === void 0 ? void 0 : _e.length));
        if (!hasConfiguredAnchors)
            return [];
        const freshRecords = doc.records.filter((r) => this.freshnessPolicy.evaluate(r, now) === 'fresh');
        return freshRecords.map((r) => r.content);
    }
    /**
     * Evaluates numeric budget constraints (`context.slots.budgetKc`) against grounded price
     * tiers inside the composed response or record content, returning a verified conclusion.
     */
    deduceBudgetConclusion(composedText, record, budgetKc) {
        var _a;
        if (typeof budgetKc !== 'number' || !Number.isFinite(budgetKc) || budgetKc <= 0)
            return undefined;
        const tiers = extractPriceTiers(`${composedText}. ${(_a = record === null || record === void 0 ? void 0 : record.content) !== null && _a !== void 0 ? _a : ''}`);
        if (tiers.length < 2)
            return undefined;
        const fitting = tiers.filter((t) => t.amountKc <= budgetKc);
        const formattedBudget = budgetKc.toLocaleString('cs-CZ').replace(/\u00a0/g, ' ');
        if (fitting.length > 0) {
            const summary = fitting
                .map((t) => `${t.label} (${t.amountKc.toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč)`)
                .join(', ');
            return `Do rozpočtu ${formattedBudget} Kč se vejde: ${summary}.`;
        }
        const lowest = tiers.slice().sort((a, b) => a.amountKc - b.amountKc)[0];
        if (lowest) {
            const lowestFormatted = lowest.amountKc.toLocaleString('cs-CZ').replace(/\u00a0/g, ' ');
            return `Rozpočet ${formattedBudget} Kč je pod nejnižším uvedeným tarifem (${lowest.label} od ${lowestFormatted} Kč).`;
        }
        return undefined;
    }
}
//# sourceMappingURL=KnowledgeReasoner.js.map