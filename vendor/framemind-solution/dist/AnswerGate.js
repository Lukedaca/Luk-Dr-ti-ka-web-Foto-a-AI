import { isAgeToken } from './IntentEngine.js';
import { sameWord, withoutMentions } from './MentionedRecords.js';
import { CZECH_MONTHS, expandCzechSynonyms, isWithinOneEdit, normalizeText } from './text.js';
/**
 * Slova, která neříkají, NA CO se návštěvník ptá: zájmena, předložky, spojky, tázací
 * a pomocná slovesa, pozdravy. Uzavřená gramatická množina, žádná témata.
 */
const FUNCTION_WORDS = new Set([
    // tázací
    'co', 'kdo', 'kdy', 'kde', 'kam', 'kudy', 'jak', 'jaky', 'jaka', 'jake', 'jakou', 'jakem', 'jakych', 'jakym',
    'kolik', 'proc', 'ktery', 'ktera', 'ktere', 'kterou', 'kterem', 'kterych', 'cim', 'ceho', 'cemu', 'koho', 'komu',
    'odkud', 'dokdy', 'odkdy', 'zda', 'jestli', 'li',
    // zájmena
    'ja', 'ty', 'on', 'ona', 'ono', 'my', 'vy', 'oni', 'ony', 'me', 'mi', 'mne', 'mnou', 'te', 'ti', 'tebe', 'tobe',
    'se', 'si', 'sebe', 'sebou', 'sobe', 'nas', 'nam', 'nami', 'vas', 'vam', 'vami', 'jeho', 'jeji', 'jejich', 'ho', 'mu', 'ji',
    'jim', 'nej', 'nem', 'nich', 'nim', 'ni', 'to', 'ten', 'ta', 'tu', 'tim', 'toho', 'tomu', 'tom', 'tech', 'temi',
    'tento', 'tato', 'toto', 'tyto', 'tenhle', 'tahle', 'tohle', 'tyhle', 'tady', 'tam', 'sem', 'tu', 'muj', 'moje',
    'moji', 'meho', 'mem', 'mym', 'svuj', 'sve', 'svoje', 'svou', 'svych', 'svym', 'nasi', 'nase', 'naseho', 'nasem',
    'vasi', 'vase', 'vaseho', 'vasem', 'nejaky', 'nejaka', 'nejake', 'neco', 'nekdo', 'nekde', 'nekdy', 'vsechno',
    'vse', 'vsichni', 'vsechny', 'kazdy', 'kazda', 'kazde', 'sam', 'sama', 'sami',
    // pomocná a modální slovesa + obecná konverzační/stavová slova
    'je', 'jsou', 'jsem', 'jsi', 'jsme', 'jste', 'byt', 'byl', 'byla', 'bylo', 'byli', 'byly', 'bude', 'budou', 'budu',
    'budes', 'budeme', 'budete', 'bych', 'by', 'bys', 'bychom', 'byste', 'mam', 'mas', 'ma', 'mame', 'mate', 'maji',
    'mel', 'mela', 'meli', 'chci', 'chces', 'chce', 'chceme', 'chcete', 'chteji', 'chtel', 'chtela', 'chteli', 'muzu',
    'mohu', 'muzes', 'muze', 'muzeme', 'muzete', 'mohou', 'muzou', 'lze', 'da', 'dalo', 'jde', 'slo', 'rict', 'reknete',
    'reknes', 'rekni', 'rekla', 'rekl', 'poradit', 'poradte', 'poradis', 'vedet', 'vite', 'vis', 'zjistit',
    'potrebuju', 'potrebuji', 'potrebuje', 'potrebujeme', 'potrebujete', 'potrebovat', 'potreboval', 'potrebovala', 'mit', 'prosim', 'prosimvas', 'zajima', 'zajimalo', 'zajimaji',
    'mohla', 'mohl', 'mohli', 'mohlo', 'umite', 'umis', 'funguje', 'funguji', 'fungovat', 'platit', 'plati', 'hradi', 'hradit',
    // předložky, spojky, částice
    'a', 'i', 'ale', 'nebo', 'ani', 'ze', 'aby', 'kdyz', 'pokud', 'protoze', 'tak', 'take', 'taky', 'tedy', 'uz', 'jeste',
    'jen', 'jenom', 'pouze', 'prave', 'vlastne', 'asi', 'treba', 'hlavne', 'v', 've', 'na', 'do', 'z', 's', 'k', 'ke',
    'o', 'u', 'od', 'po', 'pro', 'pri', 'za', 'pred', 'nad', 'pod', 'mezi', 'bez', 'krome', 'okolo', 'kolem', 'vedle',
    'podle', 'behem', 'misto', 'pak', 'potom', 'ted', 'nyni', 'dnes', 'zitra', 'vcera', 'tez', 'jako', 'nez', 'tady',
    'no', 'jo', 'ano', 'ok', 'hm', 'tak', 'teda', 'proste', 'vubec', 'presne', 'kdyztak', 'pls', 'super', 'skvele', 'fajn', 'parada', 'rozumim', 'chapu', 'jasne', 'aha', 'hele',
    // pozdrav a zdvořilost
    'ahoj', 'cau', 'cus', 'nazdar', 'zdravim', 'dobry', 'dobre', 'den', 'rano', 'vecer', 'odpoledne', 'dekuji', 'dekuju',
    'diky', 'pekne', 'hezky',
    // lepidla slotů („je mu 8 let“, „ročník 2015“)
    'let', 'leta', 'rok', 'roku', 'roky', 'rocnik', 'rocniku', 'mesicu', 'mesice',
]);
/** Kolik cizích obsahových slov stačí, aby dotaz s lexikální shodou šel na model. */
const MIN_UNCOVERED_FOR_LEXICAL = 3;
/** Záporné přání nebo oprava („nechci X“, „chtěl jsem Y a ne X“, „to jsem nechtěl“). */
const NEGATION_RE = /(?:^|\s)(?:nechci|nechces|nechce|nechceme|nechcete|nechtel|nechtela|nechteli|nepotrebuj\w*|nezajima\w*|nehledam|nemyslel\w*|nemyslim)(?:\s|$)|(?:^|\s)(?:a|ale)\s+ne(?:\s|$)|^ne(?:\s|$)|(?:^|\s)to\s+ne(?:\s|$)/;
/** Otevřené názorové, poradní a pocitové dotazy, kde by pevná šablona působila strojově. */
const OPEN_ENDED_ADVISORY_RE = /\b(?:co si mysl\w*|jaky mas nazor|jaky je tvuj nazor|myslis ze ma smysl|ma podle tebe smysl|co bys mi doporuc\w*|co byste mi doporuc\w*|jakou mas zkusenost|jaka je nalada|jaka je atmosfera)\b/;
export function isNegatedRequest(text) {
    return NEGATION_RE.test(normalizeText(text));
}
export function isOpenEndedAdvisory(text) {
    return OPEN_ENDED_ADVISORY_RE.test(normalizeText(text));
}
function isSafePattern(pattern) {
    return Boolean(pattern) && pattern.length <= 200 && !/[+*{]/.test(pattern) && !/\\[1-9]|\\k<|\(\?/.test(pattern);
}
function phraseWords(phrase) {
    return normalizeText(phrase).split(' ').filter((word) => word.length >= 2);
}
/** Slova, kterými záměr, jeho aspekty a ověřený záznam mluví o svém tématu. */
export function intentVocabulary(definition, facets = [], recordTerms = []) {
    var _a, _b, _c, _d, _e;
    if (!definition)
        return [];
    const phrases = [
        ...((_a = definition.keywords) !== null && _a !== void 0 ? _a : []),
        ...((_b = definition.keywordGroups) !== null && _b !== void 0 ? _b : []).flat(),
        ...((_c = definition.examples) !== null && _c !== void 0 ? _c : []),
        ...((_d = definition.exactExamples) !== null && _d !== void 0 ? _d : []),
        // Doslovné úseky vzoru („\bskolick\w*“ → „skolick“).
        ...((_e = definition.patterns) !== null && _e !== void 0 ? _e : []).map((pattern) => pattern.replace(/\\[a-z]/gi, ' ').replace(/[^a-z\s]/gi, ' ')),
        ...facets.flatMap((facet) => {
            var _a;
            return [
                ...((_a = facet.keywords) !== null && _a !== void 0 ? _a : []),
                facet.template.replace(/\{\{[^}]+\}\}/g, ' '),
            ];
        }),
        ...recordTerms,
    ];
    return [...new Set(phrases.flatMap(phraseWords))];
}
function coveredBy(token, vocabulary) {
    return vocabulary.some((word) => word === token
        || (token.length >= 4 && word.length >= 4 && sameWord(token, word))
        // Odvozenina celého slova ze slovníku („sponzoring“ ze „sponzor“).
        || (word.length >= 5 && token.startsWith(word))
        || isWithinOneEdit(token, word));
}
function contentTokens(text, options) {
    var _a, _b, _c;
    let normalized = normalizeText(withoutMentions(text, (_a = options.mentionValues) !== null && _a !== void 0 ? _a : []));
    for (const item of (_b = options.slotPatterns) !== null && _b !== void 0 ? _b : []) {
        if (!isSafePattern(item === null || item === void 0 ? void 0 : item.pattern))
            continue;
        try {
            normalized = normalized.replace(new RegExp(item.pattern, 'g'), ' ');
        }
        catch {
            // Neplatný vzor tenantu bránu nerozbije.
        }
    }
    const neutral = ((_c = options.neutralTerms) !== null && _c !== void 0 ? _c : []).flatMap(phraseWords);
    return normalized.split(/\s+/).filter((token) => token.length >= 2
        && !FUNCTION_WORDS.has(token)
        && !/\d/.test(token)
        && !(token in CZECH_MONTHS)
        && !isAgeToken(token)
        && !coveredBy(token, neutral));
}
/**
 * Obsahová slova dotazu, která slovník záměru nepokrývá. Prázdné pole = jádro smí
 * odpovědět samo. Hovorové slovo platí za pokryté, když jeho spisovný ekvivalent je ve slovníku.
 */
export function uncoveredTerms(text, vocabulary, options = {}) {
    return contentTokens(text, options).filter((token) => {
        if (coveredBy(token, vocabulary))
            return false;
        const expanded = expandCzechSynonyms(token);
        if (expanded === token)
            return true;
        const extras = expanded.slice(token.length).trim().split(' ').filter(Boolean);
        return !extras.some((word) => coveredBy(word, vocabulary));
    });
}
/** Důvod, proč jádro nesmí odpovědět samo, nebo `null`, když smí. */
export function deferralReason(input) {
    var _a;
    // Schválený trénovací příklad je rozhodnutí člověka.
    if (input.origin === 'exact')
        return null;
    // Odvození z obsahu záznamu je práce modelu, jádro ho smí jen navrhnout.
    if (input.origin === 'deduced')
        return 'deduced';
    if (isNegatedRequest(input.text))
        return 'negation';
    // Otevřená poradní / názorová otázka nikdy nedostane šablonu.
    if (isOpenEndedAdvisory(input.text))
        return 'uncovered';
    const vocabulary = intentVocabulary(input.definition, input.facets, (_a = input.recordTerms) !== null && _a !== void 0 ? _a : []);
    const uncovered = uncoveredTerms(input.text, vocabulary, input);
    if (!uncovered.length)
        return null;
    // Podobnost nemá v dotazu vlastní doklad: stačí jedno cizí slovo.
    if (input.origin === 'semantic')
        return 'uncovered';
    // Klíčové slovo, aspekt i slot doklad mají. Slovníky záměrů jsou ale schválně úzké
    // („Jak dopadl poslední zápas?“ zná jen „dopadl“), takže rozhoduje, jestli dotaz nese
    // podstatně víc než téma záměru („Jaká je nálada v klubu? Podle článku vidím, že
    // trenér není spokojený“ → článek je jen jedno z deseti slov).
    const covered = contentTokens(input.text, input).length - uncovered.length;
    return uncovered.length >= MIN_UNCOVERED_FOR_LEXICAL && uncovered.length > covered ? 'uncovered' : null;
}
//# sourceMappingURL=AnswerGate.js.map