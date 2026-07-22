"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchKnowledge = exports.scoreKnowledgeRecord = exports.loadKnowledgeIndex = exports.buildKnowledgeIndex = exports.buildKnowledgeSearchText = exports.tokenizeKnowledgeText = exports.dedupeKnowledgeRecords = exports.mergeKnowledgeRecords = exports.readAllKnowledgeRecords = exports.writeKnowledgeFile = exports.readKnowledgeFile = exports.knowledgeFilePath = exports.parseKnowledgeType = exports.normalizeKnowledgeRecord = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
function normalizeKnowledgeRecord(record) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const now = new Date().toISOString().slice(0, 10);
    const type = parseKnowledgeType(record.type);
    const name = String((_a = record.name) !== null && _a !== void 0 ? _a : '').trim();
    const summary = String((_b = record.summary) !== null && _b !== void 0 ? _b : '').trim();
    if (!name)
        throw new Error('Knowledge name is required.');
    if (!summary)
        throw new Error('Knowledge summary is required.');
    const source = String((_c = record.source) !== null && _c !== void 0 ? _c : 'repo').trim();
    const scope = String((_d = record.scope) !== null && _d !== void 0 ? _d : 'global').trim();
    const id = String((_e = record.id) !== null && _e !== void 0 ? _e : `${type}:${(0, utils_1.kebabName)(name)}:${(0, utils_1.kebabName)(source || scope)}`).trim();
    return {
        id,
        type,
        name,
        scope,
        source,
        summary,
        keywords: (0, utils_1.uniqueValues)((_f = record.keywords) !== null && _f !== void 0 ? _f : []),
        usedIn: (0, utils_1.uniqueValues)((_g = record.usedIn) !== null && _g !== void 0 ? _g : []),
        status: ((_h = record.status) !== null && _h !== void 0 ? _h : 'active'),
        confidence: ((_j = record.confidence) !== null && _j !== void 0 ? _j : 'confirmed'),
        createdAt: (_k = record.createdAt) !== null && _k !== void 0 ? _k : now,
        updatedAt: now,
    };
}
exports.normalizeKnowledgeRecord = normalizeKnowledgeRecord;
function parseKnowledgeType(value) {
    if (!value || !utils_1.knowledgeTypes.includes(value)) {
        throw new Error(`Unsupported knowledge type: ${value !== null && value !== void 0 ? value : ''}. Supported types: ${utils_1.knowledgeTypes.join(', ')}`);
    }
    return value;
}
exports.parseKnowledgeType = parseKnowledgeType;
function knowledgeFilePath(type) {
    return (0, utils_1.resolvePath)('harness', 'memory', 'knowledge', utils_1.knowledgeFiles[type]);
}
exports.knowledgeFilePath = knowledgeFilePath;
function readKnowledgeFile(type) {
    const filePath = knowledgeFilePath(type);
    if (!fs_1.default.existsSync(filePath))
        return [];
    return fs_1.default
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
        try {
            return normalizeKnowledgeRecord(JSON.parse(line));
        }
        catch (error) {
            throw new Error(`${path_1.default.relative((0, utils_1.resolvePath)('.'), filePath)}:${index + 1} ${error.message}`);
        }
    });
}
exports.readKnowledgeFile = readKnowledgeFile;
function writeKnowledgeFile(type, records) {
    (0, utils_1.ensureDir)('harness', 'memory', 'knowledge');
    const lines = records
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((record) => JSON.stringify(record));
    fs_1.default.writeFileSync(knowledgeFilePath(type), `${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
}
exports.writeKnowledgeFile = writeKnowledgeFile;
function readAllKnowledgeRecords() {
    const records = [];
    for (const type of utils_1.knowledgeTypes) {
        const file = `harness/memory/knowledge/${utils_1.knowledgeFiles[type]}`;
        for (const record of readKnowledgeFile(type)) {
            records.push({
                ...record,
                file,
                searchText: buildKnowledgeSearchText(record),
            });
        }
    }
    return records;
}
exports.readAllKnowledgeRecords = readAllKnowledgeRecords;
function mergeKnowledgeRecords(existing, incoming) {
    return {
        ...existing,
        ...incoming,
        createdAt: existing.createdAt || incoming.createdAt,
        updatedAt: new Date().toISOString().slice(0, 10),
        keywords: (0, utils_1.uniqueValues)([...existing.keywords, ...incoming.keywords]),
        usedIn: (0, utils_1.uniqueValues)([...existing.usedIn, ...incoming.usedIn]),
    };
}
exports.mergeKnowledgeRecords = mergeKnowledgeRecords;
function dedupeKnowledgeRecords(records) {
    const byId = new Map();
    for (const record of records) {
        const previous = byId.get(record.id);
        byId.set(record.id, previous ? mergeKnowledgeRecords(previous, record) : record);
    }
    return Array.from(byId.values());
}
exports.dedupeKnowledgeRecords = dedupeKnowledgeRecords;
function tokenizeKnowledgeText(text) {
    var _a;
    const normalized = text.toLowerCase();
    const tokens = (_a = normalized.match(/[a-z0-9_.:/@-]+|[\u4e00-\u9fa5]{2,}/g)) !== null && _a !== void 0 ? _a : [];
    return (0, utils_1.uniqueValues)(tokens);
}
exports.tokenizeKnowledgeText = tokenizeKnowledgeText;
function buildKnowledgeSearchText(record) {
    return [
        record.id,
        record.type,
        record.name,
        record.scope,
        record.source,
        record.summary,
        ...record.keywords,
        ...record.usedIn,
    ].join(' ').toLowerCase();
}
exports.buildKnowledgeSearchText = buildKnowledgeSearchText;
function levenshteinDistance(a, b) {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = Array(a.length + 1)
        .fill(null)
        .map((_, i) => Array(b.length + 1).fill(null).map((_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[a.length][b.length];
}
function fuzzyMatchScore(searchTerm, target) {
    const distance = levenshteinDistance(searchTerm, target);
    const maxLength = Math.max(searchTerm.length, target.length);
    const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
    if (similarity < 0.6)
        return 0;
    return Math.floor(similarity * 10);
}
function buildKnowledgeIndex() {
    var _a;
    (0, utils_1.ensureDir)('harness', 'memory', 'index');
    const records = readAllKnowledgeRecords();
    const keywords = {};
    const indexRecords = {};
    const stats = {
        updatedAt: new Date().toISOString(),
        total: records.length,
        byType: Object.fromEntries(utils_1.knowledgeTypes.map((type) => [type, 0])),
        byStatus: { active: 0, deprecated: 0 },
        byConfidence: { confirmed: 0, uncertain: 0 },
    };
    for (const record of records) {
        stats.byType[record.type] += 1;
        stats.byStatus[record.status] += 1;
        stats.byConfidence[record.confidence] += 1;
        const { searchText, ...indexRecord } = record;
        indexRecords[record.id] = indexRecord;
        for (const token of tokenizeKnowledgeText(searchText)) {
            keywords[token] = (0, utils_1.uniqueValues)([...((_a = keywords[token]) !== null && _a !== void 0 ? _a : []), record.id]);
        }
    }
    (0, utils_1.writeGeneratedFile)('harness/memory/index/keywords.json', `${JSON.stringify(keywords, null, 2)}\n`);
    (0, utils_1.writeGeneratedFile)('harness/memory/index/records.json', `${JSON.stringify(indexRecords, null, 2)}\n`);
    (0, utils_1.writeGeneratedFile)('harness/memory/index/stats.json', `${JSON.stringify(stats, null, 2)}\n`);
    return stats;
}
exports.buildKnowledgeIndex = buildKnowledgeIndex;
function loadKnowledgeIndex() {
    const recordsPath = (0, utils_1.resolvePath)('harness', 'memory', 'index', 'records.json');
    if (!fs_1.default.existsSync(recordsPath))
        buildKnowledgeIndex();
    const records = JSON.parse(fs_1.default.readFileSync(recordsPath, 'utf8'));
    return Object.values(records).map((record) => ({
        ...record,
        searchText: buildKnowledgeSearchText(record),
    }));
}
exports.loadKnowledgeIndex = loadKnowledgeIndex;
function scoreKnowledgeRecord(record, terms, options = {}) {
    let score = 0;
    for (const term of terms) {
        const normalized = term.toLowerCase();
        if (!normalized)
            continue;
        if (record.id.toLowerCase().includes(normalized))
            score += 8;
        if (record.name.toLowerCase().includes(normalized))
            score += 6;
        if (record.keywords.some((keyword) => keyword.toLowerCase().includes(normalized)))
            score += 5;
        if (record.summary.toLowerCase().includes(normalized))
            score += 3;
        if (record.searchText.includes(normalized))
            score += 1;
        if (options.fuzzy) {
            score += fuzzyMatchScore(normalized, record.name.toLowerCase()) * 2;
            score += fuzzyMatchScore(normalized, record.id.toLowerCase());
            for (const keyword of record.keywords) {
                score += fuzzyMatchScore(normalized, keyword.toLowerCase());
            }
        }
    }
    if (record.status === 'active')
        score += 1;
    if (record.confidence === 'confirmed')
        score += 1;
    return score;
}
exports.scoreKnowledgeRecord = scoreKnowledgeRecord;
function searchKnowledge(terms, options = {}) {
    var _a;
    const records = loadKnowledgeIndex();
    const scored = records.map((record) => ({
        record,
        score: scoreKnowledgeRecord(record, terms, { fuzzy: options.fuzzy }),
    }));
    const filtered = scored.filter((item) => item.score > 0);
    filtered.sort((a, b) => b.score - a.score);
    const limit = (_a = options.limit) !== null && _a !== void 0 ? _a : 20;
    return filtered.slice(0, limit).map((item) => item.record);
}
exports.searchKnowledge = searchKnowledge;
