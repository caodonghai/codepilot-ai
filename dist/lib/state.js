"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskBoardPath = exports.writeTimestampedMarkdown = exports.writeRunEvent = exports.initHarness = exports.getChangeName = exports.buildChangeContext = exports.updateHarnessState = exports.saveHarnessState = exports.loadHarnessState = exports.setCurrentChange = exports.saveHarnessConfig = exports.loadHarnessConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
const LOCK_FILE = (0, utils_1.resolvePath)('harness', '.state.lock');
const LOCK_TIMEOUT = 5000;
const LOCK_RETRY_DELAY = 100;
function acquireLock() {
    try {
        if (fs_1.default.existsSync(LOCK_FILE)) {
            const lockContent = fs_1.default.readFileSync(LOCK_FILE, 'utf8');
            const lockTime = parseInt(lockContent, 10);
            if (Date.now() - lockTime < LOCK_TIMEOUT) {
                return false;
            }
            fs_1.default.unlinkSync(LOCK_FILE);
        }
        fs_1.default.writeFileSync(LOCK_FILE, `${Date.now()}`, 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
function releaseLock() {
    try {
        fs_1.default.unlinkSync(LOCK_FILE);
    }
    catch {
    }
}
function withLock(fn) {
    let attempts = 0;
    const maxAttempts = LOCK_TIMEOUT / LOCK_RETRY_DELAY;
    while (!acquireLock()) {
        attempts++;
        if (attempts >= maxAttempts) {
            throw new Error('Timeout waiting for state lock');
        }
        const start = Date.now();
        while (Date.now() - start < LOCK_RETRY_DELAY) {
        }
    }
    try {
        return fn();
    }
    finally {
        releaseLock();
    }
}
function loadHarnessConfig() {
    const configPath = (0, utils_1.resolvePath)('harness', 'config.json');
    if (!fs_1.default.existsSync(configPath)) {
        return { currentChange: null, tools: utils_1.defaultTools };
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
    }
    catch (error) {
        console.error(`Invalid harness/config.json: ${error.message}`);
        return { currentChange: null, tools: utils_1.defaultTools };
    }
}
exports.loadHarnessConfig = loadHarnessConfig;
function saveHarnessConfig(config) {
    (0, utils_1.writeGeneratedFile)('harness/config.json', `${JSON.stringify(config, null, 2)}\n`);
}
exports.saveHarnessConfig = saveHarnessConfig;
function setCurrentChange(change) {
    withLock(() => {
        var _a, _b, _c, _d, _e;
        const config = loadHarnessConfig();
        saveHarnessConfig({
            version: (_a = config.version) !== null && _a !== void 0 ? _a : 1,
            profile: (_b = config.profile) !== null && _b !== void 0 ? _b : 'lightweight',
            currentChange: change,
            tools: (_c = config.tools) !== null && _c !== void 0 ? _c : utils_1.defaultTools,
            checks: (_d = config.checks) !== null && _d !== void 0 ? _d : ['ai:validate', 'ai:report'],
            strictChecks: (_e = config.strictChecks) !== null && _e !== void 0 ? _e : ['eslint', 'ai:validate', 'ai:report'],
        });
    });
}
exports.setCurrentChange = setCurrentChange;
function loadHarnessState() {
    const statePath = (0, utils_1.resolvePath)('harness', 'state.json');
    if (!fs_1.default.existsSync(statePath)) {
        return {
            version: 1,
            activeChange: null,
            activeFlow: null,
            status: 'not_started',
            phase: null,
            lastStep: null,
            nextStep: null,
            lastReport: null,
            nextSuggestedFlow: null,
            blockedBy: [],
            decisions: [],
            context: {},
            updatedAt: null,
        };
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(statePath, 'utf8'));
    }
    catch (error) {
        console.error(`Invalid harness/state.json: ${error.message}`);
        return {
            version: 1,
            activeChange: null,
            activeFlow: null,
            status: 'not_started',
            phase: null,
            lastStep: null,
            nextStep: null,
            lastReport: null,
            nextSuggestedFlow: null,
            blockedBy: [],
            decisions: [],
            context: {},
            updatedAt: null,
        };
    }
}
exports.loadHarnessState = loadHarnessState;
function saveHarnessState(state) {
    (0, utils_1.writeGeneratedFile)('harness/state.json', `${JSON.stringify(state, null, 2)}\n`);
}
exports.saveHarnessState = saveHarnessState;
function updateHarnessState(patch) {
    withLock(() => {
        const state = loadHarnessState();
        saveHarnessState({
            ...state,
            ...patch,
            updatedAt: new Date().toISOString(),
        });
    });
}
exports.updateHarnessState = updateHarnessState;
function buildChangeContext(change) {
    return {
        proposal: `openspec/changes/${change}/proposal.md`,
        tasks: `openspec/changes/${change}/tasks.md`,
        acceptance: `openspec/changes/${change}/acceptance.md`,
        notes: `openspec/changes/${change}/notes.md`,
    };
}
exports.buildChangeContext = buildChangeContext;
function getChangeName(input) {
    if (input)
        return input;
    const config = loadHarnessConfig();
    return typeof config.currentChange === 'string' ? config.currentChange : null;
}
exports.getChangeName = getChangeName;
function initHarness() {
    var _a, _b, _c, _d, _e;
    (0, utils_1.ensureDir)('harness');
    const config = loadHarnessConfig();
    saveHarnessConfig({
        version: (_a = config.version) !== null && _a !== void 0 ? _a : 1,
        profile: (_b = config.profile) !== null && _b !== void 0 ? _b : 'lightweight',
        currentChange: (_c = config.currentChange) !== null && _c !== void 0 ? _c : null,
        tools: (_d = config.tools) !== null && _d !== void 0 ? _d : utils_1.defaultTools,
        checks: (_e = config.checks) !== null && _e !== void 0 ? _e : ['eslint', 'ai:validate', 'ai:report'],
    });
    const state = loadHarnessState();
    saveHarnessState(state);
}
exports.initHarness = initHarness;
function writeRunEvent(kind, payload) {
    var _a, _b, _c;
    const state = loadHarnessState();
    const createdAt = new Date().toISOString();
    const event = {
        createdAt,
        kind,
        activeChange: (_a = state.activeChange) !== null && _a !== void 0 ? _a : null,
        activeFlow: (_b = state.activeFlow) !== null && _b !== void 0 ? _b : null,
        status: (_c = state.status) !== null && _c !== void 0 ? _c : null,
        ...payload,
    };
    (0, utils_1.ensureDir)('harness', 'runs');
    const { timestampForFile } = require('./utils');
    (0, utils_1.writeGeneratedFile)(`harness/runs/${timestampForFile(new Date(createdAt))}-${kind}.json`, `${JSON.stringify(event, null, 2)}\n`);
    return event;
}
exports.writeRunEvent = writeRunEvent;
function writeTimestampedMarkdown(directory, basename, content) {
    const createdAt = new Date().toISOString();
    const { timestampForFile } = require('./utils');
    const filePath = `${directory}/${timestampForFile(new Date(createdAt))}-${basename}.md`;
    (0, utils_1.ensureDir)(...directory.split('/'));
    (0, utils_1.writeGeneratedFile)(filePath, content);
    return filePath;
}
exports.writeTimestampedMarkdown = writeTimestampedMarkdown;
function taskBoardPath(change) {
    return `harness/tasks/${change}.json`;
}
exports.taskBoardPath = taskBoardPath;
