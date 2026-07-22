"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const commander_1 = require("commander");
const change_1 = require("./lib/change");
const state_1 = require("./lib/state");
const knowledge_1 = require("./lib/knowledge");
const templates_1 = require("./lib/templates");
const utils_1 = require("./lib/utils");
const integrations_1 = require("./lib/integrations");
function setupPackageScript(options = {}) {
    var _a;
    if (options.enabled === false)
        return 'Skipped package.json script setup by option.';
    const packagePath = (0, utils_1.resolvePath)('package.json');
    if (!fs_1.default.existsSync(packagePath)) {
        return 'Skipped package.json script setup because package.json was not found.';
    }
    const packageJson = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8').replace(/^\uFEFF/, ''));
    packageJson.scripts = (_a = packageJson.scripts) !== null && _a !== void 0 ? _a : {};
    if (packageJson.scripts.ai) {
        return `Skipped package.json script setup because scripts.ai already exists: ${packageJson.scripts.ai}`;
    }
    packageJson.scripts.ai = 'msgfi-ai';
    fs_1.default.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    return 'Added package.json script: "ai": "msgfi-ai"';
}
function findTemplateRoot() {
    var _a;
    const candidates = [
        (0, utils_1.resolvePath)('packages', 'ai-engineering-kit', 'templates'),
        path_1.default.resolve(__dirname, '..', '..', 'packages', 'ai-engineering-kit', 'templates'),
        path_1.default.resolve(__dirname, '..', 'templates'),
    ];
    return (_a = candidates.find((candidate) => fs_1.default.existsSync(candidate))) !== null && _a !== void 0 ? _a : null;
}
function writeFileIfMissingFromTemplate(templateRoot, templateRelativePath, targetRelativePath) {
    const templatePath = path_1.default.join(templateRoot, templateRelativePath);
    if (!fs_1.default.existsSync(templatePath)) {
        return false;
    }
    (0, utils_1.writeFileIfMissing)(targetRelativePath, fs_1.default.readFileSync(templatePath, 'utf8'));
    return true;
}
function seedProjectTemplates() {
    const templateRoot = findTemplateRoot();
    if (!templateRoot) {
        return ['Package templates not found. Init continued with existing embedded/default behavior.'];
    }
    const missing = [];
    const copy = (templateRelativePath, targetRelativePath) => {
        if (!writeFileIfMissingFromTemplate(templateRoot, templateRelativePath, targetRelativePath)) {
            missing.push(templateRelativePath);
        }
    };
    for (const file of utils_1.coreFiles) {
        copy(path_1.default.join('ai', 'core', file), path_1.default.join('.ai', 'core', file));
    }
    copy(path_1.default.join('ai', 'registry', 'tools.json'), path_1.default.join('.ai', 'registry', 'tools.json'));
    copy(path_1.default.join('ai', 'flows', `${utils_1.dispatcherFlow}.md`), path_1.default.join('.ai', 'flows', `${utils_1.dispatcherFlow}.md`));
    for (const flow of utils_1.flowNames) {
        copy(path_1.default.join('ai', 'flows', `${flow}.md`), path_1.default.join('.ai', 'flows', `${flow}.md`));
    }
    for (const file of utils_1.skillFiles) {
        copy(path_1.default.join('superpowers', 'skills', file), path_1.default.join('superpowers', 'skills', file));
    }
    copy(path_1.default.join('openspec', 'project.md'), path_1.default.join('openspec', 'project.md'));
    copy(path_1.default.join('harness', 'state.json'), path_1.default.join('harness', 'state.json'));
    return missing.map((file) => `Missing package template: ${file}`);
}
function listTargetFiles(tool) {
    const targetFiles = {
        codex: ['AGENTS.md', '.codex/skills/msgfi-ai/SKILL.md', ...utils_1.flowNames.map((flow) => `.codex/skills/msgfi-ai-${flow}/SKILL.md`)],
        trae: ['.trae/rules.md', '.trae/commands/ai.md', ...utils_1.flowNames.map((flow) => `.trae/commands/ai-${flow}.md`)],
        qoder: ['.qoder/rules.md', '.qoder/commands/ai.md', ...utils_1.flowNames.map((flow) => `.qoder/commands/ai/${flow}.md`)],
        cursor: ['.cursor/rules/msgfi-ai.mdc', '.cursor/rules/msgfi-frontend.mdc'],
    };
    return targetFiles[tool];
}
function applyToolSkip(tools, skipValue) {
    const skipped = (0, utils_1.parseTools)(skipValue);
    if (!skipValue)
        return tools;
    return tools.filter((tool) => !skipped.includes(tool));
}
function normalizeTools(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((tool) => utils_1.defaultTools.includes(tool));
}
function setCurrentChange(change) {
    var _a, _b, _c, _d, _e;
    const config = (0, state_1.loadHarnessConfig)();
    (0, state_1.saveHarnessConfig)({
        version: (_a = config.version) !== null && _a !== void 0 ? _a : 1,
        profile: (_b = config.profile) !== null && _b !== void 0 ? _b : 'lightweight',
        currentChange: change,
        tools: (_c = config.tools) !== null && _c !== void 0 ? _c : utils_1.defaultTools,
        checks: (_d = config.checks) !== null && _d !== void 0 ? _d : ['ai:validate', 'ai:report'],
        strictChecks: (_e = config.strictChecks) !== null && _e !== void 0 ? _e : ['eslint', 'ai:validate', 'ai:report'],
    });
}
function buildChangeContext(change) {
    return {
        proposal: `openspec/changes/${change}/proposal.md`,
        tasks: `openspec/changes/${change}/tasks.md`,
        acceptance: `openspec/changes/${change}/acceptance.md`,
        notes: `openspec/changes/${change}/notes.md`,
    };
}
function writeRunEvent(kind, payload) {
    var _a, _b, _c;
    const state = (0, state_1.loadHarnessState)();
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
    (0, utils_1.writeGeneratedFile)(`harness/runs/${(0, utils_1.timestampForFile)(new Date(createdAt))}-${kind}.json`, `${JSON.stringify(event, null, 2)}\n`);
    return event;
}
function writeTimestampedMarkdown(directory, basename, content) {
    const createdAt = new Date().toISOString();
    const filePath = `${directory}/${(0, utils_1.timestampForFile)(new Date(createdAt))}-${basename}.md`;
    (0, utils_1.ensureDir)(...directory.split('/'));
    (0, utils_1.writeGeneratedFile)(filePath, content);
    return filePath;
}
function taskBoardPath(change) {
    return `harness/tasks/${change}.json`;
}
function loadTaskBoard(change) {
    const filePath = (0, utils_1.resolvePath)(taskBoardPath(change));
    if (!fs_1.default.existsSync(filePath))
        return null;
    return JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
}
function saveTaskBoard(board) {
    (0, utils_1.ensureDir)('harness', 'tasks');
    (0, utils_1.writeGeneratedFile)(taskBoardPath(board.change), `${JSON.stringify(board, null, 2)}\n`);
}
function parseMarkdownTasks(change) {
    const tasksPath = (0, utils_1.resolvePath)('openspec', 'changes', change, 'tasks.md');
    if (!fs_1.default.existsSync(tasksPath))
        return [];
    return fs_1.default
        .readFileSync(tasksPath, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => {
        const match = line.match(/^\s*-\s\[( |x|X)\]\s+(.+)$/);
        if (!match)
            return null;
        return {
            title: match[2].trim(),
            checked: match[1].toLowerCase() === 'x',
            sourceLine: index + 1,
        };
    })
        .filter(Boolean);
}
function syncTaskBoard(change) {
    var _a;
    const now = new Date().toISOString();
    const previous = loadTaskBoard(change);
    const previousByTitle = new Map(((_a = previous === null || previous === void 0 ? void 0 : previous.tasks) !== null && _a !== void 0 ? _a : []).map((task) => [task.title, task]));
    const tasks = parseMarkdownTasks(change).map((task, index) => {
        var _a, _b, _c, _d, _e;
        const existing = previousByTitle.get(task.title);
        return {
            id: (_a = existing === null || existing === void 0 ? void 0 : existing.id) !== null && _a !== void 0 ? _a : `T${String(index + 1).padStart(3, '0')}`,
            title: task.title,
            status: task.checked ? 'done' : (_b = existing === null || existing === void 0 ? void 0 : existing.status) !== null && _b !== void 0 ? _b : 'todo',
            checked: task.checked,
            sourceLine: task.sourceLine,
            owner: (_c = existing === null || existing === void 0 ? void 0 : existing.owner) !== null && _c !== void 0 ? _c : null,
            blockedBy: (_d = existing === null || existing === void 0 ? void 0 : existing.blockedBy) !== null && _d !== void 0 ? _d : null,
            updatedAt: (_e = existing === null || existing === void 0 ? void 0 : existing.updatedAt) !== null && _e !== void 0 ? _e : now,
        };
    });
    const board = {
        version: 1,
        change,
        source: `openspec/changes/${change}/tasks.md`,
        updatedAt: now,
        tasks,
    };
    saveTaskBoard(board);
    return board;
}
function findTask(board, taskId) {
    var _a, _b;
    const normalized = taskId.trim().toLowerCase();
    return (_b = (_a = board.tasks.find((task) => task.id.toLowerCase() === normalized)) !== null && _a !== void 0 ? _a : board.tasks.find((task) => task.id.toLowerCase() === `t${normalized.padStart(3, '0')}`)) !== null && _b !== void 0 ? _b : board.tasks.find((task) => task.title.toLowerCase().includes(normalized));
}
function updateMarkdownTaskCheck(change, task, checked) {
    const tasksPath = (0, utils_1.resolvePath)('openspec', 'changes', change, 'tasks.md');
    if (!fs_1.default.existsSync(tasksPath))
        return;
    const lines = fs_1.default.readFileSync(tasksPath, 'utf8').split(/\r?\n/);
    const index = task.sourceLine - 1;
    if (!lines[index])
        return;
    lines[index] = lines[index].replace(/-\s\[( |x|X)\]/, checked ? '- [x]' : '- [ ]');
    fs_1.default.writeFileSync(tasksPath, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}
function taskSummary(board) {
    const counts = board.tasks.reduce((acc, task) => {
        acc[task.status] += 1;
        return acc;
    }, { todo: 0, doing: 0, done: 0, blocked: 0 });
    return `todo=${counts.todo} doing=${counts.doing} done=${counts.done} blocked=${counts.blocked}`;
}
function selectNextTask(board) {
    var _a, _b, _c;
    return (_c = (_b = (_a = board.tasks.find((item) => item.status === 'doing')) !== null && _a !== void 0 ? _a : board.tasks.find((item) => item.status === 'todo')) !== null && _b !== void 0 ? _b : board.tasks.find((item) => item.status === 'blocked')) !== null && _c !== void 0 ? _c : null;
}
function buildAgentPrompt(change, task, mode) {
    var _a, _b, _c, _d;
    const state = (0, state_1.loadHarnessState)();
    const context = buildChangeContext(change);
    const taskLine = task
        ? `${task.id} [${task.status}] ${task.title}${task.blockedBy ? `\nBlocked by: ${task.blockedBy}` : ''}`
        : 'No remaining task.';
    return [
        `# Agent Run: ${change}`,
        '',
        `Mode: ${mode}`,
        `GeneratedAt: ${new Date().toISOString()}`,
        '',
        '## Required Reading',
        '',
        '- .ai/core/workflow.md',
        `- ${context.proposal}`,
        `- ${context.tasks}`,
        `- ${context.acceptance}`,
        '- superpowers/skills/planning.md',
        '- superpowers/skills/tdd.md',
        '- superpowers/skills/finishing.md',
        '',
        '## Current Harness State',
        '',
        `- status: ${(_a = state.status) !== null && _a !== void 0 ? _a : 'unknown'}`,
        `- phase: ${(_b = state.phase) !== null && _b !== void 0 ? _b : 'unknown'}`,
        `- lastStep: ${(_c = state.lastStep) !== null && _c !== void 0 ? _c : 'none'}`,
        `- nextStep: ${(_d = state.nextStep) !== null && _d !== void 0 ? _d : 'none'}`,
        '',
        '## Next Task',
        '',
        taskLine,
        '',
        '## Execution Rules',
        '',
        '- Stay inside the active change scope.',
        '- If the task needs code changes, inspect the affected files before editing.',
        '- Prefer focused tests or local validation that match the task risk.',
        '- When done, mark the task with `pnpm ai task-done <task> --change <change>`.',
        '- If blocked, use `pnpm ai task-block <task> --change <change> --reason "<reason>"`.',
        '- Before handoff, run `pnpm ai check <change>` when tool access is available.',
        '',
    ].join('\n');
}
function getChangeName(input) {
    if (input)
        return input;
    const config = (0, state_1.loadHarnessConfig)();
    return typeof config.currentChange === 'string' ? config.currentChange : null;
}
function collectCoreSummary() {
    return utils_1.coreFiles.map((file) => `- .ai/core/${file}`).join('\n');
}
function collectFlowSummary() {
    return [`- /ai: .ai/flows/${utils_1.dispatcherFlow}.md`, ...utils_1.flowNames.map((flow) => `- /ai:${flow}: .ai/flows/${flow}.md`)].join('\n');
}
function collectSkillSummary() {
    return utils_1.skillFiles.map((file) => `- superpowers/skills/${file}`).join('\n');
}
function buildRulesDocument(tool) {
    return `# MsgFi AI Rules for ${tool}\n\n<!-- Generated by pnpm ai sync. Edit .ai/core, .ai/flows, and superpowers/skills instead. -->\n\n## Required Workflow\n\n1. Read .ai/core/workflow.md before starting AI-assisted work.\n2. For normal guided work, accept /ai <change> and dispatch to the next suitable flow.\n3. Read the active change under openspec/changes/<change>.\n4. Use the relevant /ai flow.\n5. Search Knowledge Memory with pnpm ai knowledge:search before propose/plan/apply when relevant.\n6. Keep edits scoped to the active change.\n7. Run pnpm ai check before finishing.\n\n## Integration Modes\n\n${(0, integrations_1.integrationSummary)()}\n\n- lightweight: use MsgFi built-in compatible rules.\n- official: prefer repo-local official integration only when installed; never use global installs implicitly.\n- hybrid: combine MsgFi rules with repo-local official integration when installed.\n\n## Knowledge Memory\n\n- Use pnpm ai knowledge:search <keywords> --limit 10.\n- Read only returned summaries, not the full harness/memory/knowledge JSONL files.\n- During finish, run pnpm ai knowledge:suggest <change> --write when tool access is available.\n- Add only confirmed reusable knowledge during finish with pnpm ai knowledge:add.\n- Final reports must say what Knowledge Memory was searched, suggested, added, or why it was skipped.\n\n## Core Rules\n\n${collectCoreSummary()}\n\n## Conversation Flows\n\n${collectFlowSummary()}\n\n## Skills\n\n${collectSkillSummary()}\n`;
}
function buildDispatcherDocument() {
    const flowText = (0, utils_1.readText)(`.ai/flows/${utils_1.dispatcherFlow}.md`);
    return `# /ai\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${utils_1.dispatcherFlow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- harness/state.json when present\n- openspec/changes/<change>/proposal.md when present\n- openspec/changes/<change>/tasks.md when present\n- openspec/changes/<change>/acceptance.md when present\n\nUse the specific /ai:* flow selected by the dispatcher.\n`;
}
function buildCommandDocument(flow) {
    const flowText = (0, utils_1.readText)(`.ai/flows/${flow}.md`);
    return `# /ai:${flow}\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${flow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- openspec/changes/<change>/proposal.md\n- openspec/changes/<change>/tasks.md\n- openspec/changes/<change>/acceptance.md\n\nFinish with \`pnpm ai check\` when the flow changes code.\n`;
}
function initCommand(options) {
    var _a;
    const tools = (0, utils_1.parseToolArgs)(options.toolArgs, options.tools);
    const existingConfigExisted = (0, utils_1.exists)('harness/config.json');
    (0, utils_1.ensureDir)('.ai', 'core');
    (0, utils_1.ensureDir)('.ai', 'flows');
    (0, utils_1.ensureDir)('.ai', 'registry');
    (0, utils_1.ensureDir)('openspec', 'changes');
    (0, utils_1.ensureDir)('openspec', 'specs');
    (0, utils_1.ensureDir)('superpowers', 'skills');
    (0, utils_1.ensureDir)('harness', 'reports');
    (0, utils_1.ensureDir)('harness', 'runs');
    (0, utils_1.ensureDir)('harness', 'tasks');
    (0, utils_1.ensureDir)('harness', 'memory', 'knowledge');
    (0, utils_1.ensureDir)('harness', 'memory', 'index');
    for (const name of utils_1.integrationNames) {
        (0, utils_1.ensureDir)('harness', 'integrations', name);
        (0, utils_1.ensureDir)('harness', 'integrations', name, 'official');
        (0, utils_1.ensureDir)('harness', 'integrations', name, 'cache');
    }
    const templateWarnings = seedProjectTemplates();
    (0, utils_1.writeFileIfMissing)('openspec/changes/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('openspec/specs/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('harness/reports/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('harness/runs/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('harness/tasks/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('harness/memory/knowledge/.gitkeep', '\n');
    (0, utils_1.writeFileIfMissing)('harness/memory/index/.gitkeep', '\n');
    for (const name of utils_1.integrationNames) {
        (0, utils_1.writeFileIfMissing)(`harness/integrations/${name}/official/.gitkeep`, '\n');
        (0, utils_1.writeFileIfMissing)(`harness/integrations/${name}/cache/.gitkeep`, '\n');
        if (!(0, utils_1.exists)((0, integrations_1.integrationConfigPath)(name)))
            (0, integrations_1.saveIntegrationConfig)((0, integrations_1.defaultIntegrationConfig)(name));
    }
    for (const file of Object.values(utils_1.knowledgeFiles)) {
        (0, utils_1.writeFileIfMissing)(`harness/memory/knowledge/${file}`, '');
    }
    (0, knowledge_1.buildKnowledgeIndex)();
    const config = (0, state_1.loadHarnessConfig)();
    const configuredTools = existingConfigExisted
        ? Array.from(new Set([...normalizeTools(config.tools), ...tools]))
        : tools;
    (0, state_1.saveHarnessConfig)({
        version: 1,
        profile: 'lightweight',
        currentChange: existingConfigExisted ? (_a = config.currentChange) !== null && _a !== void 0 ? _a : null : null,
        tools: configuredTools,
        checks: ['ai:validate', 'ai:report'],
        strictChecks: ['eslint', 'ai:validate', 'ai:report'],
    });
    const setupMessage = setupPackageScript({ enabled: options.setupScript });
    syncCommand({ tools: configuredTools.join(',') });
    for (const warning of templateWarnings) {
        console.warn(warning);
    }
    console.log(setupMessage);
    console.log(`AI kit initialized for tools: ${configuredTools.join(', ')}`);
}
function syncCommand(options) {
    var _a;
    const selectedTools = (0, utils_1.parseToolArgs)(options.toolArgs, (_a = options.tools) !== null && _a !== void 0 ? _a : ((0, state_1.loadHarnessConfig)().tools || utils_1.defaultTools).join(','));
    const tools = applyToolSkip(selectedTools, options.skip);
    const errors = [];
    const syncTool = (tool, action) => {
        try {
            action();
        }
        catch (error) {
            errors.push(`${tool}: ${error.message}`);
        }
    };
    if (tools.includes('codex')) {
        syncTool('codex', () => {
            (0, utils_1.writeGeneratedFile)('AGENTS.md', buildRulesDocument('codex'));
            (0, utils_1.writeGeneratedFile)('.codex/skills/msgfi-ai/SKILL.md', buildDispatcherDocument());
            for (const flow of utils_1.flowNames) {
                (0, utils_1.writeGeneratedFile)(`.codex/skills/msgfi-ai-${flow}/SKILL.md`, buildCommandDocument(flow));
            }
        });
    }
    if (tools.includes('trae')) {
        syncTool('trae', () => {
            (0, utils_1.writeGeneratedFile)('.trae/rules.md', buildRulesDocument('trae'));
            (0, utils_1.writeGeneratedFile)('.trae/commands/ai.md', buildDispatcherDocument());
            for (const flow of utils_1.flowNames) {
                (0, utils_1.writeGeneratedFile)(`.trae/commands/ai-${flow}.md`, buildCommandDocument(flow));
            }
        });
    }
    if (tools.includes('qoder')) {
        syncTool('qoder', () => {
            (0, utils_1.writeGeneratedFile)('.qoder/rules.md', buildRulesDocument('qoder'));
            (0, utils_1.writeGeneratedFile)('.qoder/commands/ai.md', buildDispatcherDocument());
            for (const flow of utils_1.flowNames) {
                (0, utils_1.writeGeneratedFile)(`.qoder/commands/ai/${flow}.md`, buildCommandDocument(flow));
            }
        });
    }
    if (tools.includes('cursor')) {
        syncTool('cursor', () => {
            (0, utils_1.writeGeneratedFile)('.cursor/rules/msgfi-ai.mdc', buildRulesDocument('cursor'));
            (0, utils_1.writeGeneratedFile)('.cursor/rules/msgfi-frontend.mdc', `${(0, utils_1.readText)('.ai/core/frontend.md')}\n\n${(0, utils_1.readText)('.ai/core/ui.md')}`);
        });
    }
    if (errors.length) {
        console.error(`AI target sync partially failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
        process.exitCode = 1;
        return;
    }
    console.log(`AI targets synced: ${tools.join(', ') || 'none'}`);
}
function prompt(question) {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer.trim());
        });
    });
}
async function newCommand(changeInput, options = {}) {
    var _a, _b, _c, _d;
    let change = changeInput ? (0, utils_1.kebabName)(changeInput) : '';
    let type = (0, utils_1.parseChangeType)(options.type);
    if (options.interactive) {
        change = (0, utils_1.kebabName)(await prompt('Enter change name: '));
        while (!change) {
            change = (0, utils_1.kebabName)(await prompt('Change name is required. Enter change name: '));
        }
        type = (0, utils_1.parseChangeType)(await prompt('Select change type (default/bugfix/feature/ui-change/refactor): ') || 'default');
    }
    if (!change) {
        throw new Error('Change name is required.');
    }
    for (const file of [...utils_1.requiredChangeFiles, 'notes.md']) {
        (0, utils_1.writeFileIfMissing)(`openspec/changes/${change}/${file}`, (0, templates_1.templateChangeFile)(change, file, type));
    }
    const config = (0, state_1.loadHarnessConfig)();
    (0, state_1.saveHarnessConfig)({
        version: (_a = config.version) !== null && _a !== void 0 ? _a : 1,
        profile: (_b = config.profile) !== null && _b !== void 0 ? _b : 'lightweight',
        currentChange: change,
        tools: (_c = config.tools) !== null && _c !== void 0 ? _c : utils_1.defaultTools,
        checks: (_d = config.checks) !== null && _d !== void 0 ? _d : ['eslint', 'ai:validate', 'ai:report'],
    });
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: 'propose',
        status: 'in_progress',
        phase: 'proposal',
        lastStep: `Created ${type} change ${change}`,
        nextStep: 'Refine proposal, tasks, and acceptance criteria',
        nextSuggestedFlow: 'propose',
        blockedBy: [],
        context: buildChangeContext(change),
    });
    writeRunEvent('change-created', { change, type });
    console.log(`Created OpenSpec-compatible ${type} change: ${change}`);
}
function collectEncodingIssues(change) {
    const issues = [];
    const changes = change
        ? [change]
        : fs_1.default.existsSync((0, utils_1.resolvePath)('openspec', 'changes'))
            ? fs_1.default.readdirSync((0, utils_1.resolvePath)('openspec', 'changes')).filter((item) => {
                const fullPath = (0, utils_1.resolvePath)('openspec', 'changes', item);
                return fs_1.default.statSync(fullPath).isDirectory();
            })
            : [];
    for (const item of changes) {
        for (const file of utils_1.textFilesToCheck) {
            const relativePath = `openspec/changes/${item}/${file}`;
            if ((0, utils_1.exists)(relativePath) && (0, utils_1.hasMojibake)((0, utils_1.readText)(relativePath))) {
                issues.push(relativePath);
            }
        }
    }
    return issues;
}
function encodingCommand(changeInput, options = {}) {
    var _a;
    const change = (_a = getChangeName(changeInput)) !== null && _a !== void 0 ? _a : undefined;
    const issues = collectEncodingIssues(change);
    if (!issues.length) {
        console.log(change ? `No mojibake detected for change: ${change}` : 'No mojibake detected in OpenSpec change documents.');
        return;
    }
    console.log(`Possible mojibake detected:\n${issues.map((item) => `- ${item}`).join('\n')}`);
    if (!options.fix) {
        console.log('Run with --fix to attempt a latin1-to-utf8 repair for detected files.');
        process.exitCode = 1;
        return;
    }
    const fixed = [];
    const unchanged = [];
    for (const relativePath of issues) {
        const current = (0, utils_1.readText)(relativePath);
        const next = (0, utils_1.fixMojibakeText)(current);
        if (next !== current) {
            (0, utils_1.writeGeneratedFile)(relativePath, next);
            fixed.push(relativePath);
        }
        else {
            unchanged.push(relativePath);
        }
    }
    if (fixed.length)
        console.log(`Fixed files:\n${fixed.map((item) => `- ${item}`).join('\n')}`);
    if (unchanged.length)
        console.log(`Could not safely fix:\n${unchanged.map((item) => `- ${item}`).join('\n')}`);
    if (unchanged.length)
        process.exitCode = 1;
}
function knowledgeDir() {
    return (0, utils_1.resolvePath)('harness', 'memory', 'knowledge');
}
function knowledgeIndexDir() {
    return (0, utils_1.resolvePath)('harness', 'memory', 'index');
}
function knowledgeAddCommand(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fromRecord = options.from
        ? JSON.parse(fs_1.default.readFileSync((0, utils_1.resolvePath)(options.from), 'utf8'))
        : {};
    const record = (0, knowledge_1.normalizeKnowledgeRecord)({
        ...fromRecord,
        id: (_a = options.id) !== null && _a !== void 0 ? _a : fromRecord.id,
        type: options.type ? (0, utils_1.parseKnowledgeType)(options.type) : fromRecord.type,
        name: (_b = options.name) !== null && _b !== void 0 ? _b : fromRecord.name,
        summary: (_c = options.summary) !== null && _c !== void 0 ? _c : fromRecord.summary,
        scope: (_d = options.scope) !== null && _d !== void 0 ? _d : fromRecord.scope,
        source: (_e = options.source) !== null && _e !== void 0 ? _e : fromRecord.source,
        keywords: options.keywords ? (0, utils_1.splitList)(options.keywords) : fromRecord.keywords,
        usedIn: options.usedIn ? (0, utils_1.splitList)(options.usedIn) : fromRecord.usedIn,
        status: (_g = (_f = options.status) !== null && _f !== void 0 ? _f : fromRecord.status) !== null && _g !== void 0 ? _g : 'active',
        confidence: (_j = (_h = options.confidence) !== null && _h !== void 0 ? _h : fromRecord.confidence) !== null && _j !== void 0 ? _j : 'confirmed',
    });
    const records = (0, knowledge_1.readKnowledgeFile)(record.type);
    const existingIndex = records.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
        records[existingIndex] = (0, knowledge_1.mergeKnowledgeRecords)(records[existingIndex], record);
    }
    else {
        records.push(record);
    }
    (0, knowledge_1.writeKnowledgeFile)(record.type, (0, knowledge_1.dedupeKnowledgeRecords)(records));
    const stats = (0, knowledge_1.buildKnowledgeIndex)();
    writeRunEvent('knowledge-add', { id: record.id, type: record.type });
    console.log(JSON.stringify({ status: existingIndex >= 0 ? 'merged' : 'added', record, stats }, null, 2));
}
function knowledgeSearchCommand(termsInput, options = {}) {
    var _a;
    const terms = termsInput.length ? termsInput : [];
    if (!terms.length)
        throw new Error('At least one search keyword is required.');
    const limit = Number.parseInt((_a = options.limit) !== null && _a !== void 0 ? _a : '10', 10);
    const type = options.type ? (0, utils_1.parseKnowledgeType)(options.type) : null;
    const records = (0, knowledge_1.loadKnowledgeIndex)()
        .filter((record) => options.all || (record.status === 'active' && record.confidence === 'confirmed'))
        .filter((record) => !type || record.type === type)
        .map((record) => ({ record, score: (0, knowledge_1.scoreKnowledgeRecord)(record, terms) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);
    console.log(JSON.stringify({
        query: terms,
        count: records.length,
        records: records.map(({ record, score }) => ({
            id: record.id,
            type: record.type,
            name: record.name,
            summary: record.summary,
            keywords: record.keywords,
            usedIn: record.usedIn,
            confidence: record.confidence,
            score,
        })),
    }, null, 2));
}
function knowledgeListCommand(options = {}) {
    var _a;
    const limit = Number.parseInt((_a = options.limit) !== null && _a !== void 0 ? _a : '50', 10);
    const type = options.type ? (0, utils_1.parseKnowledgeType)(options.type) : null;
    const records = (0, knowledge_1.loadKnowledgeIndex)()
        .filter((record) => options.all || record.status === 'active')
        .filter((record) => !type || record.type === type)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50);
    console.log(JSON.stringify({
        count: records.length,
        records: records.map((record) => ({
            id: record.id,
            type: record.type,
            name: record.name,
            summary: record.summary,
            status: record.status,
            confidence: record.confidence,
            updatedAt: record.updatedAt,
        })),
    }, null, 2));
}
function knowledgeIndexCommand() {
    const stats = (0, knowledge_1.buildKnowledgeIndex)();
    console.log(JSON.stringify({ status: 'indexed', stats }, null, 2));
}
function knowledgeDedupeCommand() {
    const results = {};
    for (const type of utils_1.knowledgeTypes) {
        const before = (0, knowledge_1.readKnowledgeFile)(type);
        const after = (0, knowledge_1.dedupeKnowledgeRecords)(before);
        (0, knowledge_1.writeKnowledgeFile)(type, after);
        results[type] = { before: before.length, after: after.length };
    }
    const stats = (0, knowledge_1.buildKnowledgeIndex)();
    console.log(JSON.stringify({ status: 'deduped', results, stats }, null, 2));
}
function knowledgeAnalyzeCommand(options = {}) {
    var _a, _b, _c;
    const records = (0, knowledge_1.readAllKnowledgeRecords)();
    const limit = Number.parseInt((_a = options.limit) !== null && _a !== void 0 ? _a : '10', 10);
    const byType = Object.fromEntries(utils_1.knowledgeTypes.map((type) => [type, records.filter((record) => record.type === type).length]));
    const uncertain = records.filter((record) => record.confidence === 'uncertain');
    const deprecated = records.filter((record) => record.status === 'deprecated');
    const keywordCounts = new Map();
    for (const record of records) {
        for (const keyword of record.keywords) {
            keywordCounts.set(keyword, ((_b = keywordCounts.get(keyword)) !== null && _b !== void 0 ? _b : 0) + 1);
        }
    }
    const topKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)
        .map(([keyword, count]) => ({ keyword, count }));
    const suggestions = [
        records.length < 10 ? 'Knowledge base is still small. Prefer adding confirmed facts from real changes before creating skills.' : null,
        uncertain.length ? `Review ${uncertain.length} uncertain records before treating them as reusable facts.` : null,
        ((_c = byType.failure) !== null && _c !== void 0 ? _c : 0) === 0 ? 'No failure records yet. Add repeated pitfalls after finish when confirmed.' : null,
        topKeywords.some((item) => item.count >= 3) ? 'Some keywords repeat across records; consider a future skill:suggest pass when there are at least 2-3 related confirmed cases.' : null,
    ].filter(Boolean);
    console.log(JSON.stringify({
        status: 'analyzed',
        total: records.length,
        byType,
        uncertain: uncertain.map((record) => ({ id: record.id, name: record.name, type: record.type })),
        deprecated: deprecated.map((record) => ({ id: record.id, name: record.name, type: record.type })),
        topKeywords,
        suggestions,
    }, null, 2));
}
function integrationListCommand() {
    const integrations = (0, integrations_1.loadIntegrations)();
    const health = Object.fromEntries(utils_1.integrationNames.map((name) => [name, (0, integrations_1.inspectIntegrationHealth)(name, integrations[name])]));
    console.log(JSON.stringify({
        integrations,
        health,
        note: 'Official integrations are repo-local only. This command does not install global packages or modify PATH.',
    }, null, 2));
}
function integrationUseCommand(nameInput, modeInput) {
    const name = (0, utils_1.parseIntegrationName)(nameInput);
    const mode = (0, utils_1.parseIntegrationMode)(modeInput);
    const current = (0, integrations_1.loadIntegrationConfig)(name);
    const next = {
        ...current,
        mode,
    };
    (0, integrations_1.saveIntegrationConfig)(next);
    writeRunEvent('integration-use', {
        integration: name,
        mode,
        officialInstalled: next.officialInstalled,
        officialPath: next.officialPath,
    });
    console.log(JSON.stringify({
        status: 'updated',
        integration: name,
        mode,
        officialInstalled: next.officialInstalled,
        officialPath: next.officialPath,
        warning: mode !== 'lightweight' && !next.officialInstalled
            ? 'Official integration is selected but not installed in the repo-local official directory. Runtime should fall back or report clearly.'
            : undefined,
    }, null, 2));
}
function integrationInstallCommand(nameInput, options = {}) {
    var _a;
    const name = (0, utils_1.parseIntegrationName)(nameInput);
    const current = (0, integrations_1.loadIntegrationConfig)(name);
    const officialPath = (0, integrations_1.assertIntegrationTargetPath)(name, current.officialPath);
    const cachePath = (0, integrations_1.assertIntegrationTargetPath)(name, current.cachePath);
    const sourcePath = options.source ? (0, integrations_1.parseIntegrationSource)(options.source) : null;
    const now = new Date().toISOString();
    if (options.dryRun) {
        (0, integrations_1.saveIntegrationConfig)({
            ...current,
            lastInstallDryRunAt: now,
        });
        console.log(JSON.stringify({
            status: 'dry-run',
            integration: name,
            source: (_a = options.source) !== null && _a !== void 0 ? _a : null,
            officialPath: current.officialPath,
            cachePath: current.cachePath,
            note: 'No files were copied. No global packages were installed. PATH was not modified.',
        }, null, 2));
        return;
    }
    if (!sourcePath || !options.source) {
        throw new Error('v0.8 only supports repo-local install from --source local:<path>. Use --dry-run to preview.');
    }
    if (sourcePath === officialPath || sourcePath.startsWith(`${officialPath}${path_1.default.sep}`) || sourcePath === cachePath || sourcePath.startsWith(`${cachePath}${path_1.default.sep}`)) {
        throw new Error('Local source cannot be inside the target official/cache directories.');
    }
    (0, integrations_1.clearDirectoryContents)(officialPath);
    (0, integrations_1.clearDirectoryContents)(cachePath);
    (0, integrations_1.copyDirectoryRecursive)(sourcePath, officialPath);
    (0, utils_1.writeFileIfMissing)(`${current.officialPath}/.gitkeep`, '\n');
    (0, integrations_1.saveIntegrationConfig)({
        ...current,
        officialInstalled: true,
        officialPath: current.officialPath,
        cachePath: current.cachePath,
        source: options.source,
        installedAt: now,
        removedAt: null,
    });
    writeRunEvent('integration-install', {
        integration: name,
        source: options.source,
        officialPath: current.officialPath,
    });
    console.log(JSON.stringify({
        status: 'installed',
        integration: name,
        source: options.source,
        officialPath: current.officialPath,
        mode: current.mode,
        note: 'Installed into repo-local official directory only. Mode was not changed automatically.',
    }, null, 2));
}
function integrationRemoveCommand(nameInput, options = {}) {
    const name = (0, utils_1.parseIntegrationName)(nameInput);
    const current = (0, integrations_1.loadIntegrationConfig)(name);
    const officialPath = (0, integrations_1.assertIntegrationTargetPath)(name, current.officialPath);
    const cachePath = (0, integrations_1.assertIntegrationTargetPath)(name, current.cachePath);
    const now = new Date().toISOString();
    if (options.dryRun) {
        console.log(JSON.stringify({
            status: 'dry-run',
            integration: name,
            wouldClear: [current.officialPath, current.cachePath],
            note: 'No files were removed. Only repo-local integration directories are eligible.',
        }, null, 2));
        return;
    }
    (0, integrations_1.clearDirectoryContents)(officialPath);
    (0, integrations_1.clearDirectoryContents)(cachePath);
    (0, utils_1.writeFileIfMissing)(`${current.officialPath}/.gitkeep`, '\n');
    (0, utils_1.writeFileIfMissing)(`${current.cachePath}/.gitkeep`, '\n');
    (0, integrations_1.saveIntegrationConfig)({
        ...current,
        mode: 'lightweight',
        officialInstalled: false,
        source: null,
        installedAt: null,
        removedAt: now,
    });
    writeRunEvent('integration-remove', {
        integration: name,
        officialPath: current.officialPath,
        cachePath: current.cachePath,
    });
    console.log(JSON.stringify({
        status: 'removed',
        integration: name,
        mode: 'lightweight',
        cleared: [current.officialPath, current.cachePath],
        note: 'Repo-local official/cache directories were cleared. Lightweight files were not touched.',
    }, null, 2));
}
function integrationDownloadCommand(nameInput, options = {}) {
    const name = (0, utils_1.parseIntegrationName)(nameInput);
    const repo = utils_1.integrationGitSources[name];
    const target = (0, integrations_1.resolveDownloadTarget)(name, options.to);
    (0, integrations_1.assertDownloadOutsideRepo)(target, options.allowInsideRepo);
    const parent = path_1.default.dirname(target);
    const nextInstallCommand = `node ./scripts/ai/run-ai.cjs integration:install ${name} --source ${(0, utils_1.quoteShellArg)(`local:${target}`)}`;
    if (options.dryRun) {
        console.log(JSON.stringify({
            status: 'dry-run',
            integration: name,
            method: 'git',
            repo,
            target,
            nextInstallCommand,
            note: 'No network request was made. No files were written.',
        }, null, 2));
        return;
    }
    if (fs_1.default.existsSync(target)) {
        if (!options.force) {
            throw new Error(`Download target already exists: ${target}. Use --force to replace it.`);
        }
        (0, integrations_1.assertDownloadOutsideRepo)(target, options.allowInsideRepo);
        (0, integrations_1.clearDirectoryContents)(target);
        fs_1.default.rmSync(target, { recursive: true, force: true });
    }
    fs_1.default.mkdirSync(parent, { recursive: true });
    const startedAt = Date.now();
    const result = (0, child_process_1.spawnSync)('git', ['clone', '--depth', '1', repo, target], {
        cwd: parent,
        shell: false,
        stdio: 'inherit',
    });
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    writeRunEvent('integration-download', {
        integration: name,
        method: 'git',
        repo,
        target,
        exitCode,
        durationMs: Date.now() - startedAt,
    });
    console.log(JSON.stringify({
        status: exitCode === 0 ? 'downloaded' : 'failed',
        integration: name,
        method: 'git',
        repo,
        target,
        exitCode,
        durationMs: Date.now() - startedAt,
        nextInstallCommand: exitCode === 0 ? nextInstallCommand : null,
        note: 'Download only. The current project integration mode was not changed.',
    }, null, 2));
    if (exitCode !== 0)
        process.exitCode = exitCode;
}
function detectOfficialValidateCommand(name, officialPath) {
    var _a;
    const packageJsonPath = path_1.default.join(officialPath, 'package.json');
    if (!fs_1.default.existsSync(packageJsonPath))
        return null;
    const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
    if ((_a = packageJson === null || packageJson === void 0 ? void 0 : packageJson.scripts) === null || _a === void 0 ? void 0 : _a.validate) {
        return {
            command: process.platform === 'win32' ? 'cmd' : 'sh',
            args: process.platform === 'win32' ? ['/c', 'npm run validate'] : ['-lc', 'npm run validate'],
            display: 'npm run validate',
        };
    }
    if (name === 'openspec' && (packageJson === null || packageJson === void 0 ? void 0 : packageJson.bin)) {
        const firstBin = typeof packageJson.bin === 'string' ? packageJson.bin : Object.values(packageJson.bin)[0];
        if (typeof firstBin === 'string') {
            return {
                command: process.execPath,
                args: [firstBin, 'validate'],
                display: `node ${firstBin} validate`,
            };
        }
    }
    return null;
}
function integrationValidateCommand(nameInput, options = {}) {
    var _a;
    const name = (0, utils_1.parseIntegrationName)(nameInput);
    const config = (0, integrations_1.loadIntegrationConfig)(name);
    const health = (0, integrations_1.inspectIntegrationHealth)(name, config);
    const officialPath = (0, integrations_1.assertIntegrationTargetPath)(name, config.officialPath);
    const validateCommand = detectOfficialValidateCommand(name, officialPath);
    const base = {
        integration: name,
        mode: config.mode,
        officialInstalled: config.officialInstalled,
        officialPath: config.officialPath,
        health,
        validateCommand: (_a = validateCommand === null || validateCommand === void 0 ? void 0 : validateCommand.display) !== null && _a !== void 0 ? _a : null,
    };
    if (!health.usable) {
        console.log(JSON.stringify({
            status: 'unusable',
            ...base,
            note: 'Official resources are not usable. Install repo-local official resources or switch back to lightweight.',
        }, null, 2));
        process.exitCode = 1;
        return;
    }
    if (name === 'superpowers') {
        console.log(JSON.stringify({
            status: 'validated',
            ...base,
            note: 'Superpowers official validation is structural only in v0.8.2; no official command was executed.',
        }, null, 2));
        return;
    }
    if (!validateCommand) {
        console.log(JSON.stringify({
            status: 'probe-only',
            ...base,
            note: 'Official resources look usable but no repo-local validate command was detected.',
        }, null, 2));
        return;
    }
    if (options.dryRun || !options.execute) {
        console.log(JSON.stringify({
            status: 'dry-run',
            ...base,
            note: 'Detected repo-local official validate command. Add --execute to run it.',
        }, null, 2));
        return;
    }
    const startedAt = Date.now();
    const result = (0, child_process_1.spawnSync)(validateCommand.command, validateCommand.args, {
        cwd: officialPath,
        shell: false,
        stdio: 'inherit',
    });
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    writeRunEvent('integration-validate', {
        integration: name,
        command: validateCommand.display,
        exitCode,
        durationMs: Date.now() - startedAt,
    });
    console.log(JSON.stringify({
        status: exitCode === 0 ? 'passed' : 'failed',
        ...base,
        exitCode,
        durationMs: Date.now() - startedAt,
        note: 'Executed repo-local official validate command only.',
    }, null, 2));
    if (exitCode !== 0)
        process.exitCode = exitCode;
}
function readChangeText(change) {
    return utils_1.textFilesToCheck
        .map((file) => {
        const relativePath = `openspec/changes/${change}/${file}`;
        return (0, utils_1.exists)(relativePath) ? `\n# ${file}\n${(0, utils_1.readText)(relativePath)}` : '';
    })
        .join('\n');
}
function collectChangedFilesForKnowledge() {
    const result = (0, child_process_1.spawnSync)('git', ['-c', `safe.directory=${utils_1.root.replace(/\\/g, '/')}`, 'status', '--short', '--', 'apps', 'packages'], {
        cwd: utils_1.root,
        shell: false,
        encoding: 'utf8',
    });
    if (result.status !== 0 || !result.stdout)
        return [];
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+$/, ''))
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter((file) => file.startsWith('apps/') || file.startsWith('packages/'))
        .filter((file) => /\.(ts|tsx|js|jsx|md|json)$/.test(file))
        .slice(0, 20);
}
function extractKnowledgeNames(text) {
    var _a, _b, _c;
    const names = new Set();
    const fileLikePattern = /\.(md|json|ts|tsx|js|jsx|less|css)$/i;
    const lowValueNames = new Set([
        'category',
        'displayField',
        'helpId',
        'valueField',
        'dataSource',
        'children',
        'props',
        'state',
    ]);
    const codeNames = (_a = text.match(/`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?`/g)) !== null && _a !== void 0 ? _a : [];
    for (const item of codeNames) {
        const name = item.replace(/`/g, '');
        if (!lowValueNames.has(name) && !fileLikePattern.test(name))
            names.add(name);
    }
    const dotted = (_b = text.match(/\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/g)) !== null && _b !== void 0 ? _b : [];
    for (const item of dotted) {
        if (!fileLikePattern.test(item))
            names.add(item);
    }
    const constants = (_c = text.match(/\b[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g)) !== null && _c !== void 0 ? _c : [];
    for (const item of constants)
        names.add(item);
    return Array.from(names)
        .sort((a, b) => {
        const score = (value) => (value.includes('.') ? 3 : 0) + (/[A-Z_]/.test(value) ? 2 : 0) + (value.length > 12 ? 1 : 0);
        return score(b) - score(a) || a.localeCompare(b);
    })
        .slice(0, 8);
}
function extractReferencedFiles(text) {
    var _a;
    const matches = (_a = text.match(/\b(?:apps|packages)\/[^\s)`"'，。；,]+/g)) !== null && _a !== void 0 ? _a : [];
    return (0, utils_1.uniqueValues)(matches.map((item) => item.replace(/[:：]\d+$/, '').replace(/[.,;，。；]+$/, '')));
}
function buildKnowledgeAddCommand(record) {
    var _a, _b, _c, _d;
    const args = [
        'pnpm ai knowledge:add --',
        `--type ${record.type}`,
        `--name ${(0, utils_1.quoteShellArg)(String((_a = record.name) !== null && _a !== void 0 ? _a : ''))}`,
        `--summary ${(0, utils_1.quoteShellArg)(String((_b = record.summary) !== null && _b !== void 0 ? _b : ''))}`,
    ];
    if (record.scope)
        args.push(`--scope ${(0, utils_1.quoteShellArg)(record.scope)}`);
    if (record.source)
        args.push(`--source ${(0, utils_1.quoteShellArg)(record.source)}`);
    if ((_c = record.keywords) === null || _c === void 0 ? void 0 : _c.length)
        args.push(`--keywords ${(0, utils_1.quoteShellArg)(record.keywords.join(','))}`);
    if ((_d = record.usedIn) === null || _d === void 0 ? void 0 : _d.length)
        args.push(`--used-in ${(0, utils_1.quoteShellArg)(record.usedIn.join(','))}`);
    if (record.confidence)
        args.push(`--confidence ${record.confidence}`);
    return args.join(' ');
}
function knowledgeSuggestCommand(changeInput, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    const text = readChangeText(change);
    const board = fs_1.default.existsSync((0, utils_1.resolvePath)('openspec', 'changes', change, 'tasks.md')) ? syncTaskBoard(change) : null;
    const changedFiles = extractReferencedFiles(text).length ? extractReferencedFiles(text) : collectChangedFilesForKnowledge();
    const names = extractKnowledgeNames(text);
    const limit = Number.parseInt((_a = options.limit) !== null && _a !== void 0 ? _a : '8', 10);
    const candidates = [];
    for (const name of names) {
        const isConstant = /^[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(name);
        const record = {
            type: name.includes('.') ? 'function' : isConstant ? 'failure' : 'pattern',
            name,
            scope: (_c = (_b = changedFiles[0]) === null || _b === void 0 ? void 0 : _b.split('/').slice(0, 4).join('/')) !== null && _c !== void 0 ? _c : 'repo',
            source: change,
            summary: `Candidate from ${change}: confirm reusable usage or behavior for ${name} before adding.`,
            keywords: (0, utils_1.uniqueValues)([change, name, ...(0, knowledge_1.tokenizeKnowledgeText)(text).slice(0, 5)]),
            usedIn: changedFiles.slice(0, 5),
            status: 'active',
            confidence: 'uncertain',
        };
        candidates.push({ ...record, reason: 'Named symbol found in change documents.', command: buildKnowledgeAddCommand(record) });
    }
    if (/原因|root cause|失败|blocked|风险|regression|bug/i.test(text)) {
        const record = {
            type: 'failure',
            name: `${change} failure/bug lesson`,
            scope: (_e = (_d = changedFiles[0]) === null || _d === void 0 ? void 0 : _d.split('/').slice(0, 4).join('/')) !== null && _e !== void 0 ? _e : 'repo',
            source: change,
            summary: `Candidate from ${change}: confirm the reusable failure cause, trigger condition, and prevention rule before adding.`,
            keywords: (0, utils_1.uniqueValues)([change, 'failure', 'bug', '风险']),
            usedIn: changedFiles.slice(0, 5),
            status: 'active',
            confidence: 'uncertain',
        };
        candidates.push({ ...record, reason: 'Change text mentions root cause, bug, risk, or failure.', command: buildKnowledgeAddCommand(record) });
    }
    if (/决策|decision|确认|保持|不修改|不影响/i.test(text)) {
        const record = {
            type: 'decision',
            name: `${change} confirmed decision`,
            scope: (_g = (_f = changedFiles[0]) === null || _f === void 0 ? void 0 : _f.split('/').slice(0, 4).join('/')) !== null && _g !== void 0 ? _g : 'repo',
            source: change,
            summary: `Candidate from ${change}: confirm the final product or technical decision before adding.`,
            keywords: (0, utils_1.uniqueValues)([change, 'decision', '确认']),
            usedIn: changedFiles.slice(0, 5),
            status: 'active',
            confidence: 'uncertain',
        };
        candidates.push({ ...record, reason: 'Change text mentions confirmed choices or preserved behavior.', command: buildKnowledgeAddCommand(record) });
    }
    const outputCandidates = candidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 8);
    const markdown = [
        `# Knowledge Suggestions: ${change}`,
        '',
        'These are candidates only. Confirm and edit summaries before adding them as facts.',
        '',
        `GeneratedAt: ${new Date().toISOString()}`,
        '',
        `Changed files considered: ${changedFiles.length ? changedFiles.join(', ') : 'none'}`,
        board ? `Task summary: ${taskSummary(board)}` : '',
        '',
        ...outputCandidates.flatMap((candidate, index) => [
            `## ${index + 1}. ${candidate.type}: ${candidate.name}`,
            '',
            `Reason: ${candidate.reason}`,
            '',
            `Summary: ${candidate.summary}`,
            '',
            'Suggested command:',
            '',
            '```bash',
            candidate.command,
            '```',
            '',
        ]),
        outputCandidates.length ? '' : 'No obvious reusable knowledge candidates found.',
    ].filter((line) => line !== '').join('\n');
    let suggestionPath = null;
    if (options.write) {
        suggestionPath = writeTimestampedMarkdown(`openspec/changes/${change}`, 'knowledge-suggestions', `${markdown}\n`);
        writeRunEvent('knowledge-suggest', { change, suggestionPath, count: outputCandidates.length });
    }
    console.log(JSON.stringify({
        change,
        count: outputCandidates.length,
        suggestionPath,
        candidates: outputCandidates.map((candidate) => ({
            type: candidate.type,
            name: candidate.name,
            reason: candidate.reason,
            summary: candidate.summary,
            command: candidate.command,
        })),
    }, null, 2));
}
function collectUncheckedTasks(change) {
    const tasksPath = (0, utils_1.resolvePath)('openspec', 'changes', change, 'tasks.md');
    if (!fs_1.default.existsSync(tasksPath))
        return [];
    return fs_1.default
        .readFileSync(tasksPath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^\s*-\s\[\s\]\s+/.test(line));
}
function collectUncheckedAcceptance(change) {
    const acceptancePath = (0, utils_1.resolvePath)('openspec', 'changes', change, 'acceptance.md');
    if (!fs_1.default.existsSync(acceptancePath))
        return [];
    return fs_1.default
        .readFileSync(acceptancePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^\s*-\s\[\s\]\s+/.test(line));
}
function appendUncheckedTasks(change, tasks) {
    if (!tasks.length)
        return;
    const tasksPath = (0, utils_1.resolvePath)('openspec', 'changes', change, 'tasks.md');
    const existing = fs_1.default.existsSync(tasksPath) ? fs_1.default.readFileSync(tasksPath, 'utf8') : '# Tasks\n';
    const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
    const additions = tasks
        .map((task) => task.trim())
        .filter(Boolean)
        .map((task) => (task.startsWith('- [ ]') ? task : `- [ ] ${task}`))
        .filter((task) => !existingLines.has(task.trim()));
    if (!additions.length)
        return;
    fs_1.default.writeFileSync(tasksPath, `${existing.trimEnd()}\n${additions.join('\n')}\n`, 'utf8');
}
function validateCommand(changeInput, options = {}) {
    const errors = [];
    const checkFile = (relativePath) => {
        if (!(0, utils_1.exists)(relativePath))
            errors.push(`Missing ${relativePath}`);
    };
    for (const file of utils_1.coreFiles)
        checkFile(`.ai/core/${file}`);
    for (const flow of utils_1.flowNames)
        checkFile(`.ai/flows/${flow}.md`);
    for (const file of utils_1.skillFiles)
        checkFile(`superpowers/skills/${file}`);
    checkFile('openspec/project.md');
    checkFile('harness/config.json');
    checkFile('harness/state.json');
    checkFile('.ai/registry/tools.json');
    try {
        (0, state_1.loadHarnessConfig)();
    }
    catch (error) {
        errors.push(`Invalid harness/config.json: ${error.message}`);
    }
    const change = getChangeName(changeInput);
    if (changeInput && change) {
        setCurrentChange(change);
    }
    if (change) {
        for (const file of utils_1.requiredChangeFiles) {
            checkFile(`openspec/changes/${change}/${file}`);
        }
        for (const file of utils_1.textFilesToCheck) {
            const relativePath = `openspec/changes/${change}/${file}`;
            if ((0, utils_1.exists)(relativePath) && (0, utils_1.hasMojibake)((0, utils_1.readText)(relativePath))) {
                errors.push(`Possible mojibake detected in ${relativePath}. Ensure UTF-8 output in Windows/Codex/PowerShell.`);
            }
        }
    }
    let tools = utils_1.defaultTools;
    try {
        const config = (0, state_1.loadHarnessConfig)();
        tools = (config.tools || utils_1.defaultTools);
    }
    catch {
        tools = utils_1.defaultTools;
    }
    for (const tool of tools) {
        for (const file of listTargetFiles(tool) || []) {
            checkFile(file);
        }
    }
    if (errors.length) {
        if (!options.quiet) {
            console.error(`AI validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
        }
        return { status: 'failed', errors };
    }
    if (!options.quiet) {
        console.log(change ? `AI validation passed for change: ${change}` : 'AI validation passed');
    }
    return { status: 'passed', errors };
}
function runCommand(command, args) {
    const startedAt = Date.now();
    const result = (0, child_process_1.spawnSync)(command, args, { cwd: utils_1.root, shell: false, stdio: 'inherit' });
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    return {
        command: [command, ...args].join(' '),
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        durationMs: Date.now() - startedAt,
    };
}
function runEslintCommand() {
    var _a;
    const eslintPath = (0, utils_1.resolvePath)('node_modules', 'eslint', 'bin', 'eslint.js');
    const startedAt = Date.now();
    if (!fs_1.default.existsSync(eslintPath)) {
        return {
            command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
            status: 'failed',
            exitCode: 1,
            durationMs: Date.now() - startedAt,
            reason: 'Missing local ESLint binary. Run pnpm install first.',
        };
    }
    const result = (0, child_process_1.spawnSync)(process.execPath, [eslintPath, '--ext', '.tsx,.ts', './apps'], {
        cwd: utils_1.root,
        shell: false,
        stdio: 'inherit',
    });
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    return {
        command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        durationMs: Date.now() - startedAt,
        reason: (_a = result.error) === null || _a === void 0 ? void 0 : _a.message,
    };
}
function writeReport(changeInput, results, status) {
    var _a, _b;
    const config = (0, state_1.loadHarnessConfig)();
    const change = getChangeName(changeInput);
    if (changeInput && change) {
        setCurrentChange(change);
    }
    const finalStatus = status !== null && status !== void 0 ? status : (results.every((item) => item.status === 'passed') ? 'passed' : 'failed');
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, '-');
    const report = {
        createdAt: timestamp,
        profile: (_a = config.profile) !== null && _a !== void 0 ? _a : 'lightweight',
        scope: change !== null && change !== void 0 ? change : 'root',
        change,
        dryRun: false,
        status: finalStatus,
        tools: (_b = config.tools) !== null && _b !== void 0 ? _b : utils_1.defaultTools,
        results,
    };
    (0, utils_1.writeGeneratedFile)(`harness/reports/${fileTimestamp}.json`, `${JSON.stringify(report, null, 2)}\n`);
    (0, state_1.updateHarnessState)({
        activeChange: change !== null && change !== void 0 ? change : null,
        status: finalStatus === 'passed' ? 'accepted' : 'blocked',
        phase: finalStatus === 'passed' ? 'finishing' : 'blocked',
        lastStep: `Generated report harness/reports/${fileTimestamp}.json`,
        lastReport: `harness/reports/${fileTimestamp}.json`,
        nextSuggestedFlow: finalStatus === 'passed' ? 'finish' : 'verify',
        blockedBy: finalStatus === 'passed' ? [] : results.filter((item) => item.status === 'failed').map((item) => item.command),
        context: change ? buildChangeContext(change) : {},
    });
    writeRunEvent('report', { change, status: finalStatus, reportPath: `harness/reports/${fileTimestamp}.json`, results });
    console.log(`Harness report generated: harness/reports/${fileTimestamp}.json`);
    return report;
}
function reportCommand(changeInput) {
    writeReport(changeInput, [
        {
            command: 'ai:report',
            status: 'passed',
            exitCode: 0,
            durationMs: 0,
            reason: 'Report generated on demand.',
        },
    ]);
}
function checkCommand(changeInput, options = {}) {
    const results = [];
    if (!options.noEslint && options.strict) {
        results.push(runEslintCommand());
    }
    const startedAt = Date.now();
    const validation = validateCommand(changeInput, { quiet: true });
    if (validation.status === 'failed') {
        console.error(`AI validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`);
    }
    results.push({
        command: changeInput ? `pnpm ai validate ${changeInput}` : 'pnpm ai validate',
        status: validation.status,
        exitCode: validation.status === 'passed' ? 0 : 1,
        durationMs: Date.now() - startedAt,
        reason: validation.errors.join('; ') || undefined,
    });
    const finalStatus = results.every((item) => item.status === 'passed') ? 'passed' : 'failed';
    writeReport(changeInput, results, finalStatus);
    if (finalStatus === 'failed') {
        process.exitCode = 1;
    }
}
function statusCommand() {
    const state = (0, state_1.loadHarnessState)();
    console.log(JSON.stringify(state, null, 2));
}
function currentCommand(changeInput) {
    var _a, _b, _c, _d, _e, _f;
    if (changeInput) {
        const change = (0, utils_1.kebabName)(changeInput);
        if (!change)
            throw new Error('Change name is required.');
        setCurrentChange(change);
        (0, state_1.updateHarnessState)({
            activeChange: change,
            context: buildChangeContext(change),
        });
        console.log(`Current change set: ${change}`);
        return;
    }
    const config = (0, state_1.loadHarnessConfig)();
    const state = (0, state_1.loadHarnessState)();
    console.log(JSON.stringify({
        currentChange: (_a = config.currentChange) !== null && _a !== void 0 ? _a : null,
        activeChange: (_b = state.activeChange) !== null && _b !== void 0 ? _b : null,
        activeFlow: (_c = state.activeFlow) !== null && _c !== void 0 ? _c : null,
        status: (_d = state.status) !== null && _d !== void 0 ? _d : null,
        phase: (_e = state.phase) !== null && _e !== void 0 ? _e : null,
        lastReport: (_f = state.lastReport) !== null && _f !== void 0 ? _f : null,
    }, null, 2));
}
function resumeCommand() {
    var _a, _b, _c, _d, _e;
    const state = (0, state_1.loadHarnessState)();
    const change = state.activeChange;
    const nextFlow = state.nextSuggestedFlow || 'propose';
    if (!change) {
        console.log('No active change. Start with /ai:propose <change> or pnpm ai new <change>.');
        return;
    }
    const uncheckedTasks = collectUncheckedTasks(change);
    const decisions = Array.isArray(state.decisions) ? state.decisions : [];
    const blockedBy = Array.isArray(state.blockedBy) ? state.blockedBy : [];
    const lines = [
        `/ai:${nextFlow} ${change}`,
        '',
        'Resume context:',
        `- status: ${(_a = state.status) !== null && _a !== void 0 ? _a : 'unknown'}`,
        `- phase: ${(_b = state.phase) !== null && _b !== void 0 ? _b : 'unknown'}`,
        `- activeFlow: ${(_c = state.activeFlow) !== null && _c !== void 0 ? _c : 'unknown'}`,
        `- lastStep: ${(_d = state.lastStep) !== null && _d !== void 0 ? _d : 'none'}`,
        `- nextStep: ${(_e = state.nextStep) !== null && _e !== void 0 ? _e : 'none'}`,
    ];
    if (uncheckedTasks.length) {
        lines.push('', 'Unfinished tasks:', ...uncheckedTasks.map((task) => `- ${task.replace(/^\s*-\s\[\s\]\s+/, '')}`));
    }
    if (decisions.length) {
        lines.push('', 'Recorded decisions:', ...decisions.map((item) => { var _a; return `- ${(_a = item.text) !== null && _a !== void 0 ? _a : item}`; }));
    }
    if (blockedBy.length) {
        lines.push('', 'Blocked by:', ...blockedBy.map((item) => `- ${item}`));
    }
    lines.push('', 'Instruction: continue only the unfinished scope for this change.');
    console.log(lines.join('\n'));
}
function parseTasks(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
function verifyCommand(changeInput, options = {}) {
    var _a;
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    if (changeInput)
        setCurrentChange(change);
    appendUncheckedTasks(change, parseTasks(options.task));
    const uncheckedTasks = collectUncheckedTasks(change);
    const status = (_a = options.status) !== null && _a !== void 0 ? _a : (uncheckedTasks.length ? 'partially_accepted' : 'accepted');
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: 'verify',
        status,
        phase: 'verification',
        lastStep: `Verification marked ${status}`,
        nextStep: status === 'accepted' ? 'Finish the change' : 'Resolve unfinished verification tasks',
        nextSuggestedFlow: status === 'accepted' ? 'finish' : 'apply',
        blockedBy: uncheckedTasks,
        context: buildChangeContext(change),
    });
    writeRunEvent('verify-state', { change, status, appendedTasks: parseTasks(options.task), uncheckedTasks });
    console.log(`Harness state updated: ${status}`);
    if (uncheckedTasks.length) {
        console.log(`Unchecked tasks:\n${uncheckedTasks.join('\n')}`);
    }
}
function finishStateCommand(changeInput) {
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    if (changeInput)
        setCurrentChange(change);
    const uncheckedTasks = collectUncheckedTasks(change);
    const status = uncheckedTasks.length ? 'partially_accepted' : 'accepted';
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: 'finish',
        status,
        phase: 'finishing',
        lastStep: `Finish state evaluated as ${status}`,
        nextStep: status === 'accepted' ? null : 'Resolve unfinished tasks before finishing',
        nextSuggestedFlow: status === 'accepted' ? null : 'apply',
        blockedBy: uncheckedTasks,
        context: buildChangeContext(change),
    });
    writeRunEvent('finish-state', { change, status, uncheckedTasks });
    console.log(`Finish state: ${status}`);
    if (uncheckedTasks.length) {
        console.log(`Unfinished tasks:\n${uncheckedTasks.join('\n')}`);
        process.exitCode = 1;
    }
}
function stepCommand(note, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const change = getChangeName(options.change);
    const flow = (_b = (_a = options.flow) !== null && _a !== void 0 ? _a : (0, state_1.loadHarnessState)().activeFlow) !== null && _b !== void 0 ? _b : null;
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: flow,
        status: (_c = options.status) !== null && _c !== void 0 ? _c : 'in_progress',
        phase: flow ? (_d = utils_1.phaseByFlow[flow]) !== null && _d !== void 0 ? _d : 'implementation' : (_e = (0, state_1.loadHarnessState)().phase) !== null && _e !== void 0 ? _e : 'implementation',
        lastStep: note,
        nextStep: (_g = (_f = options.next) !== null && _f !== void 0 ? _f : (0, state_1.loadHarnessState)().nextStep) !== null && _g !== void 0 ? _g : null,
        nextSuggestedFlow: (_h = flow !== null && flow !== void 0 ? flow : (0, state_1.loadHarnessState)().nextSuggestedFlow) !== null && _h !== void 0 ? _h : null,
        context: change ? buildChangeContext(change) : (_j = (0, state_1.loadHarnessState)().context) !== null && _j !== void 0 ? _j : {},
    });
    writeRunEvent('step', { change, flow, note, nextStep: (_k = options.next) !== null && _k !== void 0 ? _k : null });
    console.log(`Step recorded: ${note}`);
}
function decisionCommand(text, options = {}) {
    var _a, _b, _c, _d, _e, _f;
    const state = (0, state_1.loadHarnessState)();
    const change = getChangeName(options.change);
    const decision = { text, createdAt: new Date().toISOString(), change: change !== null && change !== void 0 ? change : null, flow: (_b = (_a = options.flow) !== null && _a !== void 0 ? _a : state.activeFlow) !== null && _b !== void 0 ? _b : null };
    const decisions = Array.isArray(state.decisions) ? state.decisions.concat(decision) : [decision];
    (0, state_1.updateHarnessState)({
        activeChange: (_c = change !== null && change !== void 0 ? change : state.activeChange) !== null && _c !== void 0 ? _c : null,
        activeFlow: (_e = (_d = options.flow) !== null && _d !== void 0 ? _d : state.activeFlow) !== null && _e !== void 0 ? _e : null,
        decisions,
        lastStep: `Decision recorded: ${text}`,
        context: change ? buildChangeContext(change) : (_f = state.context) !== null && _f !== void 0 ? _f : {},
    });
    writeRunEvent('decision', decision);
    console.log(`Decision recorded: ${text}`);
}
function runLogCommand(options = {}) {
    var _a, _b, _c;
    const limit = Number((_a = options.limit) !== null && _a !== void 0 ? _a : 10);
    const runsDir = (0, utils_1.resolvePath)('harness', 'runs');
    if (!fs_1.default.existsSync(runsDir)) {
        console.log('No run log directory found.');
        return;
    }
    const files = fs_1.default
        .readdirSync(runsDir)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .slice(-limit);
    if (!files.length) {
        console.log('No run events recorded.');
        return;
    }
    for (const file of files) {
        const event = JSON.parse(fs_1.default.readFileSync(path_1.default.join(runsDir, file), 'utf8'));
        console.log(`${event.createdAt} ${event.kind} ${(_b = event.activeChange) !== null && _b !== void 0 ? _b : ''} ${(_c = event.status) !== null && _c !== void 0 ? _c : ''}`.trim());
    }
}
function taskBoardCommand(changeInput) {
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    if (changeInput)
        setCurrentChange(change);
    const board = syncTaskBoard(change);
    console.log(`Task board: ${taskBoardPath(change)}`);
    console.log(`Summary: ${taskSummary(board)}`);
    for (const task of board.tasks) {
        const owner = task.owner ? ` owner=${task.owner}` : '';
        const blockedBy = task.blockedBy ? ` blockedBy=${task.blockedBy}` : '';
        console.log(`${task.id} [${task.status}] ${task.title}${owner}${blockedBy}`);
    }
}
function taskNextCommand(changeInput) {
    var _a, _b;
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    const board = syncTaskBoard(change);
    const task = (_b = (_a = board.tasks.find((item) => item.status === 'doing')) !== null && _a !== void 0 ? _a : board.tasks.find((item) => item.status === 'todo')) !== null && _b !== void 0 ? _b : board.tasks.find((item) => item.status === 'blocked');
    if (!task) {
        console.log(`No remaining task for ${change}.`);
        return;
    }
    console.log(`/ai:apply ${change}`);
    console.log(`Next task: ${task.id} [${task.status}] ${task.title}`);
    if (task.blockedBy)
        console.log(`Blocked by: ${task.blockedBy}`);
}
function updateTaskCommand(action, taskId, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const change = getChangeName(options.change);
    if (!change)
        throw new Error('Change name is required.');
    if (options.change)
        setCurrentChange(change);
    const board = syncTaskBoard(change);
    const task = findTask(board, taskId);
    if (!task)
        throw new Error(`Task not found: ${taskId}`);
    const now = new Date().toISOString();
    task.status = action;
    task.updatedAt = now;
    if (action === 'doing') {
        task.owner = (_b = (_a = options.owner) !== null && _a !== void 0 ? _a : task.owner) !== null && _b !== void 0 ? _b : 'ai';
        task.blockedBy = null;
        updateMarkdownTaskCheck(change, task, false);
    }
    if (action === 'done') {
        task.owner = (_d = (_c = options.owner) !== null && _c !== void 0 ? _c : task.owner) !== null && _d !== void 0 ? _d : 'ai';
        task.blockedBy = null;
        task.checked = true;
        updateMarkdownTaskCheck(change, task, true);
    }
    if (action === 'blocked') {
        task.owner = (_f = (_e = options.owner) !== null && _e !== void 0 ? _e : task.owner) !== null && _f !== void 0 ? _f : 'ai';
        task.blockedBy = (_g = options.reason) !== null && _g !== void 0 ? _g : 'No reason provided.';
        updateMarkdownTaskCheck(change, task, false);
    }
    saveTaskBoard(board);
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: action === 'done' ? 'verify' : 'apply',
        status: action === 'blocked' ? 'blocked' : 'in_progress',
        phase: action === 'done' ? 'verification' : action === 'blocked' ? 'blocked' : 'implementation',
        lastStep: `Task ${task.id} marked ${action}: ${task.title}`,
        nextStep: action === 'done' ? 'Continue the next task or verify acceptance criteria' : task.title,
        nextSuggestedFlow: action === 'done' ? 'verify' : 'apply',
        blockedBy: action === 'blocked' ? [task.blockedBy] : [],
        context: buildChangeContext(change),
    });
    writeRunEvent(`task-${action}`, { change, task });
    console.log(`Task ${task.id} marked ${action}: ${task.title}`);
}
function agentRunCommand(changeInput, options = {}) {
    var _a, _b;
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    if (changeInput)
        setCurrentChange(change);
    const board = syncTaskBoard(change);
    const task = selectNextTask(board);
    const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : (options.claim ? 'claim' : 'prompt');
    if (task && options.claim && task.status === 'todo') {
        task.status = 'doing';
        task.owner = 'ai';
        task.updatedAt = new Date().toISOString();
        saveTaskBoard(board);
    }
    const prompt = buildAgentPrompt(change, task, mode);
    const promptPath = writeTimestampedMarkdown('harness/prompts', `${change}-agent-run`, prompt);
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: 'apply',
        status: task ? 'in_progress' : 'accepted',
        phase: task ? 'implementation' : 'finishing',
        lastStep: task ? `Agent run prepared for ${task.id}: ${task.title}` : 'Agent run found no remaining task',
        nextStep: (_b = task === null || task === void 0 ? void 0 : task.title) !== null && _b !== void 0 ? _b : null,
        nextSuggestedFlow: task ? 'apply' : 'finish',
        blockedBy: (task === null || task === void 0 ? void 0 : task.status) === 'blocked' && task.blockedBy ? [task.blockedBy] : [],
        context: buildChangeContext(change),
    });
    writeRunEvent('agent-run', {
        change,
        mode,
        promptPath,
        task: task !== null && task !== void 0 ? task : null,
        summary: taskSummary(board),
    });
    console.log(`Agent prompt generated: ${promptPath}`);
    console.log(`Summary: ${taskSummary(board)}`);
    if (task) {
        console.log(`Next task: ${task.id} [${task.status}] ${task.title}`);
        console.log('');
        console.log(prompt);
    }
    else {
        console.log(`No remaining task for ${change}.`);
    }
}
function agentFinishCommand(changeInput, options = {}) {
    var _a;
    const change = getChangeName(changeInput);
    if (!change)
        throw new Error('Change name is required.');
    if (changeInput)
        setCurrentChange(change);
    const board = syncTaskBoard(change);
    const remainingTasks = board.tasks.filter((task) => task.status === 'todo' || task.status === 'doing');
    const blockedTasks = board.tasks.filter((task) => task.status === 'blocked');
    const uncheckedAcceptance = collectUncheckedAcceptance(change);
    const results = [];
    const validationStartedAt = Date.now();
    const validation = validateCommand(change, { quiet: true });
    results.push({
        command: `pnpm ai validate ${change}`,
        status: validation.status,
        exitCode: validation.status === 'passed' ? 0 : 1,
        durationMs: Date.now() - validationStartedAt,
        reason: validation.errors.join('; ') || undefined,
    });
    if (options.check) {
        if (options.strict) {
            results.push(runEslintCommand());
        }
        const checkValidationStartedAt = Date.now();
        const checkValidation = validateCommand(change, { quiet: true });
        results.push({
            command: `pnpm ai check ${change}${options.strict ? ' --strict' : ''}`,
            status: checkValidation.status,
            exitCode: checkValidation.status === 'passed' ? 0 : 1,
            durationMs: Date.now() - checkValidationStartedAt,
            reason: checkValidation.errors.join('; ') || undefined,
        });
    }
    let status = 'accepted';
    const blockedBy = [];
    if (validation.status === 'failed') {
        status = 'blocked';
        blockedBy.push(...validation.errors);
    }
    if (blockedTasks.length) {
        status = 'blocked';
        blockedBy.push(...blockedTasks.map((task) => { var _a; return `${task.id}: ${(_a = task.blockedBy) !== null && _a !== void 0 ? _a : task.title}`; }));
    }
    if (status !== 'blocked' && (remainingTasks.length || uncheckedAcceptance.length)) {
        status = 'partially_accepted';
    }
    if (status !== 'blocked' && results.some((item) => item.status === 'failed')) {
        status = 'blocked';
        blockedBy.push(...results.filter((item) => item.status === 'failed').map((item) => { var _a; return (_a = item.reason) !== null && _a !== void 0 ? _a : item.command; }));
    }
    const reportStatus = status === 'blocked' ? 'failed' : 'passed';
    writeReport(change, results, reportStatus);
    const stateAfterReport = (0, state_1.loadHarnessState)();
    const remaining = [
        ...remainingTasks.map((task) => `${task.id}: ${task.title}`),
        ...uncheckedAcceptance.map((item) => `acceptance: ${item.replace(/^\s*-\s\[\s\]\s+/, '')}`),
    ];
    (0, state_1.updateHarnessState)({
        activeChange: change,
        activeFlow: 'finish',
        status,
        phase: status === 'blocked' ? 'blocked' : 'finishing',
        lastStep: `Agent finish evaluated as ${status}`,
        nextStep: status === 'accepted' ? null : 'Resolve remaining tasks or acceptance items',
        lastReport: (_a = stateAfterReport.lastReport) !== null && _a !== void 0 ? _a : null,
        nextSuggestedFlow: status === 'accepted' ? null : 'apply',
        blockedBy: status === 'blocked' ? blockedBy : remaining,
        context: buildChangeContext(change),
    });
    writeRunEvent('agent-finish', {
        change,
        status,
        summary: taskSummary(board),
        remainingTasks,
        blockedTasks,
        uncheckedAcceptance,
        results,
    });
    console.log(`Agent finish: ${status}`);
    console.log(`Summary: ${taskSummary(board)}`);
    if (remaining.length)
        console.log(`Remaining:\n${remaining.map((item) => `- ${item}`).join('\n')}`);
    if (blockedBy.length)
        console.log(`Blocked by:\n${blockedBy.map((item) => `- ${item}`).join('\n')}`);
    if (remainingTasks.length) {
        const firstTask = remainingTasks[0];
        console.log('');
        console.log('Next suggested commands:');
        console.log(`pnpm ai agent-run ${change} --claim`);
        console.log(`pnpm ai task-done ${firstTask.id} --change ${change}`);
        console.log(`pnpm ai agent-finish ${change} --check`);
    }
    else if (uncheckedAcceptance.length) {
        console.log('');
        console.log('Next suggested commands:');
        console.log(`Review openspec/changes/${change}/acceptance.md`);
        console.log(`pnpm ai agent-finish ${change} --check`);
    }
    else if (status === 'accepted') {
        console.log('');
        console.log('Next suggested command: ready for review.');
    }
    if (status !== 'accepted')
        process.exitCode = 1;
}
function checkWritable(relativePath) {
    const filePath = (0, utils_1.resolvePath)(relativePath);
    try {
        if (fs_1.default.existsSync(filePath)) {
            const handle = fs_1.default.openSync(filePath, 'r+');
            fs_1.default.closeSync(handle);
        }
        else {
            fs_1.default.accessSync(path_1.default.dirname(filePath), fs_1.default.constants.W_OK);
        }
        return { status: 'passed' };
    }
    catch (error) {
        return { status: 'failed', reason: error.message };
    }
}
function isActiveCodexSkillLock(relativePath, reason) {
    return process.platform === 'win32'
        && relativePath.startsWith('.codex/skills/')
        && relativePath.endsWith('/SKILL.md')
        && Boolean(reason === null || reason === void 0 ? void 0 : reason.includes('EPERM'));
}
function doctorCommand(options = {}) {
    const checks = [];
    const startedAt = Date.now();
    const pushCheck = (command, passed, reason, started = Date.now()) => {
        checks.push({
            command,
            status: passed ? 'passed' : 'failed',
            exitCode: passed ? 0 : 1,
            durationMs: Date.now() - started,
            reason,
        });
    };
    pushCheck('node', /^v?(\d+)\./.test(process.version), `version ${process.version}`, startedAt);
    const hasTsNode = (0, utils_1.exists)('node_modules/ts-node/register/transpile-only.js');
    pushCheck('ts-node/register/transpile-only', hasTsNode, hasTsNode ? undefined : 'Missing local ts-node dependency.');
    const hasLauncher = (0, utils_1.exists)('scripts/ai/run-ai.cjs');
    pushCheck('scripts/ai/run-ai.cjs', hasLauncher, hasLauncher ? undefined : 'Missing stable AI launcher.');
    const hasConfig = (0, utils_1.exists)('harness/config.json');
    pushCheck('harness/config.json', hasConfig, hasConfig ? undefined : 'Missing harness config.');
    const hasState = (0, utils_1.exists)('harness/state.json');
    pushCheck('harness/state.json', hasState, hasState ? undefined : 'Missing harness state.');
    const configStartedAt = Date.now();
    try {
        (0, state_1.loadHarnessConfig)();
        pushCheck('parse harness/config.json', true, undefined, configStartedAt);
    }
    catch (error) {
        pushCheck('parse harness/config.json', false, error.message, configStartedAt);
    }
    const validationStartedAt = Date.now();
    const validation = validateCommand(undefined, { quiet: true });
    pushCheck('ai validate', validation.status === 'passed', validation.errors.join('; ') || undefined, validationStartedAt);
    const knowledgeStartedAt = Date.now();
    try {
        const stats = (0, knowledge_1.buildKnowledgeIndex)();
        pushCheck('knowledge index', true, `records ${stats.total}`, knowledgeStartedAt);
    }
    catch (error) {
        pushCheck('knowledge index', false, error.message, knowledgeStartedAt);
    }
    for (const name of utils_1.integrationNames) {
        const integrationStartedAt = Date.now();
        const config = (0, integrations_1.loadIntegrationConfig)(name);
        const health = (0, integrations_1.inspectIntegrationHealth)(name, config);
        const requiresOfficial = config.mode === 'official' || config.mode === 'hybrid';
        const passed = !requiresOfficial || health.usable;
        const reason = `${config.mode}; health=${health.health}; official ${config.officialInstalled ? 'installed' : 'not installed'}; ${health.reason}`;
        pushCheck(`integration ${name}`, passed, reason, integrationStartedAt);
    }
    const config = (0, state_1.loadHarnessConfig)();
    const tools = (config.tools || utils_1.defaultTools);
    for (const tool of tools) {
        for (const file of listTargetFiles(tool)) {
            const writable = checkWritable(file);
            const codexLock = writable.status === 'failed' && isActiveCodexSkillLock(file, writable.reason);
            pushCheck(`writable ${file}`, writable.status === 'passed' || codexLock, codexLock ? 'Locked by the active Codex session; use pnpm ai sync --skip codex if needed.' : writable.reason);
        }
    }
    if (options.strict) {
        checks.push(runEslintCommand());
    }
    if (options.encoding) {
        const encodingStartedAt = Date.now();
        const issues = collectEncodingIssues();
        checks.push({
            command: 'ai encoding',
            status: issues.length ? 'failed' : 'passed',
            exitCode: issues.length ? 1 : 0,
            durationMs: Date.now() - encodingStartedAt,
            reason: issues.length ? `Possible mojibake: ${issues.join(', ')}` : undefined,
        });
    }
    const failed = checks.filter((item) => item.status === 'failed');
    console.log(JSON.stringify({
        status: failed.length ? 'failed' : 'passed',
        node: process.version,
        platform: process.platform,
        shell: process.env.ComSpec || process.env.SHELL || null,
        checks,
    }, null, 2));
    if (failed.length) {
        process.exitCode = 1;
    }
}
const program = new commander_1.Command();
program.name('msgfi-ai').description('MsgFi AI Engineering Kit');
program
    .command('init')
    .argument('[tools...]', 'Optional AI tools to initialize, e.g. codex cursor')
    .option('--tools <tools>', 'Comma-separated AI tools', utils_1.defaultTools.join(','))
    .option('--no-setup-script', 'Do not add scripts.ai to package.json')
    .action((toolArgs, options) => initCommand({ ...options, toolArgs }));
program
    .command('sync')
    .argument('[tools...]', 'Optional AI tools to sync, e.g. codex cursor')
    .option('--tools <tools>', 'Comma-separated AI tools')
    .option('--skip <tools>', 'Comma-separated AI tools to skip')
    .action((toolArgs, options) => syncCommand({ ...options, toolArgs }));
program
    .command('new')
    .argument('[change]', 'Change name')
    .option('--type <type>', 'default, bugfix, feature, ui-change, or refactor', 'default')
    .option('--interactive', 'Interactive mode with prompts')
    .action((change, options) => newCommand(change, options));
program
    .command('validate')
    .argument('[change]', 'Change name')
    .action((change) => {
    const result = validateCommand(change);
    if (result.status === 'failed')
        process.exitCode = 1;
});
program
    .command('check')
    .argument('[change]', 'Change name')
    .option('--strict', 'Run stricter checks such as eslint')
    .option('--no-eslint', 'Skip eslint even in strict mode')
    .action((change, options) => checkCommand(change, options));
program
    .command('report')
    .argument('[change]', 'Change name')
    .action((change) => reportCommand(change));
program
    .command('encoding')
    .argument('[change]', 'Change name')
    .option('--fix', 'Attempt to repair detected mojibake files')
    .description('Detect or repair likely mojibake in OpenSpec change documents')
    .action((change, options) => encodingCommand(change, options));
program
    .command('knowledge:add')
    .option('--from <json>', 'Read one UTF-8 JSON record from a file')
    .option('--type <type>', 'component, function, pattern, decision, or failure')
    .option('--name <name>', 'Knowledge name')
    .option('--summary <summary>', 'Short summary, ideally <= 300 Chinese chars')
    .option('--id <id>', 'Stable record id')
    .option('--scope <scope>', 'Scope label')
    .option('--source <source>', 'Source package, module, file, or change')
    .option('--keywords <keywords>', 'Comma-separated keywords')
    .option('--used-in <paths>', 'Comma-separated usage paths')
    .option('--status <status>', 'active or deprecated', 'active')
    .option('--confidence <confidence>', 'confirmed or uncertain', 'confirmed')
    .description('Add or merge one Knowledge Memory record')
    .action((options) => knowledgeAddCommand(options));
program
    .command('knowledge:search')
    .argument('<terms...>', 'Search keywords')
    .option('--limit <limit>', 'Maximum records to return', '10')
    .option('--type <type>', 'Filter by knowledge type')
    .option('--all', 'Include deprecated or uncertain records')
    .description('Search Knowledge Memory summaries through the local index')
    .action((terms, options) => knowledgeSearchCommand(terms, options));
program
    .command('knowledge:list')
    .option('--type <type>', 'Filter by knowledge type')
    .option('--limit <limit>', 'Maximum records to return', '50')
    .option('--all', 'Include deprecated records')
    .description('List Knowledge Memory records from the local index')
    .action((options) => knowledgeListCommand(options));
program
    .command('knowledge:index')
    .description('Rebuild Knowledge Memory keyword and record indexes')
    .action(() => knowledgeIndexCommand());
program
    .command('knowledge:dedupe')
    .description('Merge duplicate Knowledge Memory records by id')
    .action(() => knowledgeDedupeCommand());
program
    .command('knowledge:suggest')
    .argument('[change]', 'Change name')
    .option('--limit <limit>', 'Maximum candidates to return', '8')
    .option('--write', 'Write a markdown suggestion file under the change directory')
    .description('Suggest reusable Knowledge Memory candidates for a finished change')
    .action((change, options) => knowledgeSuggestCommand(change, options));
program
    .command('knowledge:analyze')
    .option('--limit <limit>', 'Maximum keyword suggestions to return', '10')
    .description('Analyze Knowledge Memory quality and suggest next curation actions')
    .action((options) => knowledgeAnalyzeCommand(options));
program
    .command('integration:list')
    .description('List OpenSpec and Superpowers integration modes')
    .action(() => integrationListCommand());
program
    .command('integration:use')
    .argument('<integration>', 'openspec or superpowers')
    .argument('<mode>', 'lightweight, official, or hybrid')
    .description('Switch an integration mode without installing or modifying global tools')
    .action((integration, mode) => integrationUseCommand(integration, mode));
program
    .command('integration:install')
    .argument('<integration>', 'openspec or superpowers')
    .option('--source <source>', 'Only local:<path> is supported in v0.8')
    .option('--dry-run', 'Preview install without copying files')
    .description('Install official integration resources into repo-local harness/integrations only')
    .allowExcessArguments(false)
    .action((integration, options) => integrationInstallCommand(integration, options));
program
    .command('integration:remove')
    .argument('<integration>', 'openspec or superpowers')
    .option('--dry-run', 'Preview removal without deleting files')
    .description('Remove repo-local official integration resources and switch back to lightweight')
    .action((integration, options) => integrationRemoveCommand(integration, options));
program
    .command('integration:download')
    .argument('<integration>', 'openspec or superpowers')
    .option('--to <directory>', 'Base directory outside the repository; defaults to ../_ai-official-sources')
    .option('--dry-run', 'Preview download target and next install command without network')
    .option('--force', 'Replace an existing download target')
    .option('--allow-inside-repo', 'Allow downloading inside the current repository')
    .description('Download official sources outside the repository without installing or enabling them')
    .action((integration, options) => integrationDownloadCommand(integration, options));
program
    .command('integration:validate')
    .argument('<integration>', 'openspec or superpowers')
    .option('--dry-run', 'Probe official validate command without executing it')
    .option('--execute', 'Execute detected repo-local official validate command')
    .description('Validate repo-local official integration resources without using global tools')
    .action((integration, options) => integrationValidateCommand(integration, options));
program
    .command('status')
    .description('Print current harness state')
    .action(() => statusCommand());
program
    .command('current')
    .argument('[change]', 'Change name to set as current')
    .description('Print or set the current active change')
    .action((change) => currentCommand(change));
program
    .command('resume')
    .description('Print the next suggested /ai flow')
    .action(() => resumeCommand());
program
    .command('verify-state')
    .argument('[change]', 'Change name')
    .option('--status <status>', 'accepted, partially_accepted, rejected, or blocked')
    .option('--task <task>', 'Append an unchecked follow-up task', (value, previous = []) => previous.concat(value), [])
    .action((change, options) => verifyCommand(change, options));
program
    .command('finish-state')
    .argument('[change]', 'Change name')
    .description('Mark finish state from unchecked tasks')
    .action((change) => finishStateCommand(change));
program
    .command('step')
    .argument('<note>', 'Step note')
    .option('--change <change>', 'Change name')
    .option('--flow <flow>', 'Current flow')
    .option('--status <status>', 'Harness status')
    .option('--next <next>', 'Next step')
    .action((note, options) => stepCommand(note, options));
program
    .command('decision')
    .argument('<text>', 'Decision text')
    .option('--change <change>', 'Change name')
    .option('--flow <flow>', 'Current flow')
    .action((text, options) => decisionCommand(text, options));
program
    .command('run-log')
    .option('--limit <limit>', 'Number of events to show', '10')
    .action((options) => runLogCommand(options));
program
    .command('task-board')
    .argument('[change]', 'Change name')
    .description('Sync and print the local harness task board')
    .action((change) => taskBoardCommand(change));
program
    .command('task-next')
    .argument('[change]', 'Change name')
    .description('Print the next task from the local harness task board')
    .action((change) => taskNextCommand(change));
program
    .command('task-start')
    .argument('<task>', 'Task id, number, or title fragment')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner', 'ai')
    .description('Mark a task as doing')
    .action((task, options) => updateTaskCommand('doing', task, options));
program
    .command('task-done')
    .argument('<task>', 'Task id, number, or title fragment')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner', 'ai')
    .description('Mark a task as done and check it in tasks.md')
    .action((task, options) => updateTaskCommand('done', task, options));
program
    .command('task-block')
    .argument('<task>', 'Task id, number, or title fragment')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner', 'ai')
    .option('--reason <reason>', 'Block reason')
    .description('Mark a task as blocked')
    .action((task, options) => updateTaskCommand('blocked', task, options));
program
    .command('agent-run')
    .argument('[change]', 'Change name')
    .option('--claim', 'Claim the next todo task as doing')
    .option('--mode <mode>', 'Run mode label')
    .description('Prepare the next resumable local agent run prompt')
    .action((change, options) => agentRunCommand(change, options));
program
    .command('agent-finish')
    .argument('[change]', 'Change name')
    .option('--check', 'Also run lightweight check validation before finishing')
    .option('--strict', 'Run strict repository checks when used with --check')
    .description('Evaluate task board, acceptance, validation, and final Harness status')
    .action((change, options) => agentFinishCommand(change, options));
program
    .command('doctor')
    .description('Diagnose local AI kit runtime and target file health')
    .option('--strict', 'Also run strict repository checks such as eslint')
    .option('--encoding', 'Also scan OpenSpec change documents for likely mojibake')
    .action((options) => doctorCommand(options));
program
    .command('archive')
    .argument('<change>', 'Change name to archive')
    .description('Archive a completed change to openspec/archive')
    .action((change) => {
    try {
        const result = (0, change_1.archiveChange)(change);
        console.log(JSON.stringify({
            status: 'archived',
            change,
            archivedAt: result.archivedAt,
            target: result.targetDir,
        }, null, 2));
    }
    catch (error) {
        console.error(JSON.stringify({
            status: 'error',
            change,
            error: error.message,
        }, null, 2));
        process.exitCode = 1;
    }
});
program
    .command('archive:restore')
    .argument('<change>', 'Change name to restore')
    .description('Restore an archived change back to openspec/changes')
    .action((change) => {
    try {
        const result = (0, change_1.restoreChange)(change);
        console.log(JSON.stringify({
            status: 'restored',
            change,
            restoredAt: result.restoredAt,
            target: result.targetDir,
        }, null, 2));
    }
    catch (error) {
        console.error(JSON.stringify({
            status: 'error',
            change,
            error: error.message,
        }, null, 2));
        process.exitCode = 1;
    }
});
program
    .command('archive:delete')
    .argument('<change>', 'Change name to delete from archive')
    .description('Permanently delete an archived change')
    .action((change) => {
    try {
        const result = (0, change_1.deleteArchivedChange)(change);
        console.log(JSON.stringify({
            status: 'deleted',
            change,
            deletedAt: result.deletedAt,
        }, null, 2));
    }
    catch (error) {
        console.error(JSON.stringify({
            status: 'error',
            change,
            error: error.message,
        }, null, 2));
        process.exitCode = 1;
    }
});
program
    .command('archive:list')
    .description('List all active and archived changes')
    .action(() => {
    const active = (0, change_1.listChanges)();
    const archived = (0, change_1.listArchivedChanges)();
    console.log(JSON.stringify({
        active: active.length,
        archived: archived.length,
        changes: [...active, ...archived],
    }, null, 2));
});
program.parse(process.argv);
