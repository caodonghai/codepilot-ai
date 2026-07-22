"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInsideRoot = exports.fixMojibakeText = exports.hasMojibake = exports.textCorruptionScore = exports.timestampForFile = exports.quoteShellArg = exports.kebabName = exports.uniqueValues = exports.splitList = exports.parseKnowledgeType = exports.parseChangeType = exports.parseIntegrationMode = exports.parseIntegrationName = exports.parseToolArgs = exports.parseTools = exports.readText = exports.writeGeneratedFile = exports.writeFileIfMissing = exports.ensureDir = exports.exists = exports.resolvePath = exports.phaseByFlow = exports.knowledgeFiles = exports.integrationGitSources = exports.integrationModes = exports.integrationNames = exports.knowledgeTypes = exports.changeTypes = exports.textFilesToCheck = exports.mojibakePatterns = exports.requiredChangeFiles = exports.skillFiles = exports.flowNames = exports.dispatcherFlow = exports.coreFiles = exports.defaultTools = exports.root = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.root = process.cwd();
exports.defaultTools = ['codex', 'trae', 'qoder', 'cursor'];
exports.coreFiles = ['project.md', 'frontend.md', 'api.md', 'ui.md', 'testing.md', 'review.md', 'workflow.md'];
exports.dispatcherFlow = 'ai';
exports.flowNames = ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish'];
exports.skillFiles = ['planning.md', 'tdd.md', 'debugging.md', 'code-review.md', 'finishing.md'];
exports.requiredChangeFiles = ['proposal.md', 'tasks.md', 'acceptance.md'];
exports.mojibakePatterns = [
    '\u7ead',
    '\u93c4',
    '\u95be\u6735',
    '\u7035\u7858',
    '\u8dfa\u5ba0',
    '\u7a0b\u5b2a',
    '\u9286?',
    '\u9225?',
    '\u20ac?',
    '\u951f',
    '\ufffd',
];
exports.textFilesToCheck = ['proposal.md', 'tasks.md', 'acceptance.md', 'notes.md', 'conversation-report.txt'];
exports.changeTypes = ['default', 'bugfix', 'feature', 'ui-change', 'refactor'];
exports.knowledgeTypes = ['component', 'function', 'pattern', 'decision', 'failure'];
exports.integrationNames = ['openspec', 'superpowers'];
exports.integrationModes = ['lightweight', 'official', 'hybrid'];
exports.integrationGitSources = {
    openspec: 'https://github.com/Fission-AI/OpenSpec.git',
    superpowers: 'https://github.com/obra/superpowers.git',
};
exports.knowledgeFiles = {
    component: 'components.jsonl',
    function: 'functions.jsonl',
    pattern: 'patterns.jsonl',
    decision: 'decisions.jsonl',
    failure: 'failures.jsonl',
};
exports.phaseByFlow = {
    explore: 'exploration',
    propose: 'proposal',
    plan: 'planning',
    apply: 'implementation',
    verify: 'verification',
    review: 'verification',
    finish: 'finishing',
};
function resolvePath(...segments) {
    return path_1.default.join(exports.root, ...segments);
}
exports.resolvePath = resolvePath;
function exists(...segments) {
    return fs_1.default.existsSync(resolvePath(...segments));
}
exports.exists = exists;
function ensureDir(...segments) {
    fs_1.default.mkdirSync(resolvePath(...segments), { recursive: true });
}
exports.ensureDir = ensureDir;
function writeFileIfMissing(relativePath, content) {
    const filePath = resolvePath(relativePath);
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    if (!fs_1.default.existsSync(filePath)) {
        fs_1.default.writeFileSync(filePath, content, 'utf8');
    }
}
exports.writeFileIfMissing = writeFileIfMissing;
function writeGeneratedFile(relativePath, content) {
    const filePath = resolvePath(relativePath);
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    fs_1.default.writeFileSync(filePath, content, 'utf8');
}
exports.writeGeneratedFile = writeGeneratedFile;
function readText(relativePath) {
    return fs_1.default.readFileSync(resolvePath(relativePath), 'utf8');
}
exports.readText = readText;
function parseTools(value) {
    if (!value)
        return exports.defaultTools;
    const tools = value.split(',').map((item) => item.trim()).filter(Boolean);
    const unsupported = tools.filter((tool) => !exports.defaultTools.includes(tool));
    if (unsupported.length) {
        throw new Error(`Unsupported tools: ${unsupported.join(', ')}. Supported tools: ${exports.defaultTools.join(', ')}`);
    }
    return Array.from(new Set(tools));
}
exports.parseTools = parseTools;
function parseToolArgs(args, optionValue) {
    if (args === null || args === void 0 ? void 0 : args.length)
        return parseTools(args.join(','));
    return parseTools(optionValue);
}
exports.parseToolArgs = parseToolArgs;
function parseIntegrationName(value) {
    if (!value || !exports.integrationNames.includes(value)) {
        throw new Error(`Unsupported integration: ${value !== null && value !== void 0 ? value : ''}. Supported integrations: ${exports.integrationNames.join(', ')}`);
    }
    return value;
}
exports.parseIntegrationName = parseIntegrationName;
function parseIntegrationMode(value) {
    if (!value || !exports.integrationModes.includes(value)) {
        throw new Error(`Unsupported integration mode: ${value !== null && value !== void 0 ? value : ''}. Supported modes: ${exports.integrationModes.join(', ')}`);
    }
    return value;
}
exports.parseIntegrationMode = parseIntegrationMode;
function parseChangeType(value) {
    if (!value)
        return 'default';
    if (!exports.changeTypes.includes(value)) {
        throw new Error(`Unsupported change type: ${value}. Supported types: ${exports.changeTypes.join(', ')}`);
    }
    return value;
}
exports.parseChangeType = parseChangeType;
function parseKnowledgeType(value) {
    if (!value || !exports.knowledgeTypes.includes(value)) {
        throw new Error(`Unsupported knowledge type: ${value !== null && value !== void 0 ? value : ''}. Supported types: ${exports.knowledgeTypes.join(', ')}`);
    }
    return value;
}
exports.parseKnowledgeType = parseKnowledgeType;
function splitList(value) {
    if (!value)
        return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
exports.splitList = splitList;
function uniqueValues(values) {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}
exports.uniqueValues = uniqueValues;
function kebabName(value) {
    return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}
exports.kebabName = kebabName;
function quoteShellArg(value) {
    if (/^[A-Za-z0-9_./:@\\-]+$/.test(value))
        return value;
    return `"${value.replace(/"/g, '\\"')}"`;
}
exports.quoteShellArg = quoteShellArg;
function timestampForFile(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}
exports.timestampForFile = timestampForFile;
function textCorruptionScore(text) {
    var _a;
    const patternScore = exports.mojibakePatterns.reduce((score, pattern) => {
        const matches = text.split(pattern).length - 1;
        return score + matches * 10;
    }, 0);
    const controlScore = ((_a = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g)) !== null && _a !== void 0 ? _a : []).length * 20;
    return patternScore + controlScore;
}
exports.textCorruptionScore = textCorruptionScore;
function hasMojibake(text) {
    return textCorruptionScore(text) > 0;
}
exports.hasMojibake = hasMojibake;
function fixMojibakeText(text) {
    const buffer = Buffer.from(text, 'latin1');
    const decoded = buffer.toString('utf8');
    const beforeScore = textCorruptionScore(text);
    const afterScore = textCorruptionScore(decoded);
    return afterScore < beforeScore ? decoded : text;
}
exports.fixMojibakeText = fixMojibakeText;
function resolveInsideRoot(relativePath) {
    const fullPath = path_1.default.resolve(exports.root, relativePath);
    const rootPath = path_1.default.resolve(exports.root);
    if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path_1.default.sep}`)) {
        throw new Error(`Refusing path outside repository: ${relativePath}`);
    }
    return fullPath;
}
exports.resolveInsideRoot = resolveInsideRoot;
