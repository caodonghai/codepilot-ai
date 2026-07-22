import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { archiveChange, restoreChange, deleteArchivedChange, listChanges, listArchivedChanges, validateChangeStructure } from './lib/change';

type ToolName = 'codex' | 'trae' | 'qoder' | 'cursor';
type HarnessStatus = 'not_started' | 'in_progress' | 'accepted' | 'partially_accepted' | 'rejected' | 'blocked';
type HarnessPhase = 'exploration' | 'proposal' | 'planning' | 'implementation' | 'verification' | 'finishing' | 'blocked';

type HarnessResult = {
  command: string;
  status: 'passed' | 'failed';
  exitCode: number;
  durationMs: number;
  reason?: string;
};

type HarnessTaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

type HarnessTask = {
  id: string;
  title: string;
  status: HarnessTaskStatus;
  checked: boolean;
  sourceLine: number;
  owner: string | null;
  blockedBy: string | null;
  updatedAt: string;
};

type HarnessTaskBoard = {
  version: number;
  change: string;
  source: string;
  updatedAt: string;
  tasks: HarnessTask[];
};

type ChangeType = 'default' | 'bugfix' | 'feature' | 'ui-change' | 'refactor';
type KnowledgeType = 'component' | 'function' | 'pattern' | 'decision' | 'failure';
type KnowledgeStatus = 'active' | 'deprecated';
type KnowledgeConfidence = 'confirmed' | 'uncertain';
type IntegrationName = 'openspec' | 'superpowers';
type IntegrationMode = 'lightweight' | 'official' | 'hybrid';

type IntegrationConfig = {
  name: IntegrationName;
  mode: IntegrationMode;
  officialInstalled: boolean;
  officialPath: string;
  cachePath: string;
  source?: string | null;
  installedAt?: string | null;
  removedAt?: string | null;
  lastInstallDryRunAt?: string | null;
  updatedAt: string;
};

type KnowledgeRecord = {
  id: string;
  type: KnowledgeType;
  name: string;
  scope: string;
  source: string;
  summary: string;
  keywords: string[];
  usedIn: string[];
  status: KnowledgeStatus;
  confidence: KnowledgeConfidence;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeIndexRecord = KnowledgeRecord & {
  file: string;
  searchText: string;
};

const root = process.cwd();
const defaultTools: ToolName[] = ['codex', 'trae', 'qoder', 'cursor'];
const coreFiles = ['project.md', 'frontend.md', 'api.md', 'ui.md', 'testing.md', 'review.md', 'workflow.md'];
const dispatcherFlow = 'ai';
const flowNames = ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish'];
const skillFiles = ['planning.md', 'tdd.md', 'debugging.md', 'code-review.md', 'finishing.md'];
const requiredChangeFiles = ['proposal.md', 'tasks.md', 'acceptance.md'];
const mojibakePatterns = [
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
const textFilesToCheck = ['proposal.md', 'tasks.md', 'acceptance.md', 'notes.md', 'conversation-report.txt'];
const changeTypes: ChangeType[] = ['default', 'bugfix', 'feature', 'ui-change', 'refactor'];
const knowledgeTypes: KnowledgeType[] = ['component', 'function', 'pattern', 'decision', 'failure'];
const integrationNames: IntegrationName[] = ['openspec', 'superpowers'];
const integrationModes: IntegrationMode[] = ['lightweight', 'official', 'hybrid'];
const integrationGitSources: Record<IntegrationName, string> = {
  openspec: 'https://github.com/Fission-AI/OpenSpec.git',
  superpowers: 'https://github.com/obra/superpowers.git',
};
const knowledgeFiles: Record<KnowledgeType, string> = {
  component: 'components.jsonl',
  function: 'functions.jsonl',
  pattern: 'patterns.jsonl',
  decision: 'decisions.jsonl',
  failure: 'failures.jsonl',
};
const phaseByFlow: Record<string, HarnessPhase> = {
  explore: 'exploration',
  propose: 'proposal',
  plan: 'planning',
  apply: 'implementation',
  verify: 'verification',
  review: 'verification',
  finish: 'finishing',
};

function resolvePath(...segments: string[]) {
  return path.join(root, ...segments);
}

function exists(...segments: string[]) {
  return fs.existsSync(resolvePath(...segments));
}

function ensureDir(...segments: string[]) {
  fs.mkdirSync(resolvePath(...segments), { recursive: true });
}

function writeFileIfMissing(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function writeGeneratedFile(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function readText(relativePath: string) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

function setupPackageScript(options: { enabled?: boolean } = {}) {
  if (options.enabled === false) return 'Skipped package.json script setup by option.';

  const packagePath = resolvePath('package.json');
  if (!fs.existsSync(packagePath)) {
    return 'Skipped package.json script setup because package.json was not found.';
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8').replace(/^\uFEFF/, ''));
  packageJson.scripts = packageJson.scripts ?? {};
  if (packageJson.scripts.ai) {
    return `Skipped package.json script setup because scripts.ai already exists: ${packageJson.scripts.ai}`;
  }

  packageJson.scripts.ai = 'msgfi-ai';
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return 'Added package.json script: "ai": "msgfi-ai"';
}

function findTemplateRoot() {
  const candidates = [
    resolvePath('packages', 'ai-engineering-kit', 'templates'),
    path.resolve(__dirname, '..', '..', 'packages', 'ai-engineering-kit', 'templates'),
    path.resolve(__dirname, '..', 'templates'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function writeFileIfMissingFromTemplate(templateRoot: string, templateRelativePath: string, targetRelativePath: string) {
  const templatePath = path.join(templateRoot, templateRelativePath);
  if (!fs.existsSync(templatePath)) {
    return false;
  }
  writeFileIfMissing(targetRelativePath, fs.readFileSync(templatePath, 'utf8'));
  return true;
}

function seedProjectTemplates() {
  const templateRoot = findTemplateRoot();
  if (!templateRoot) {
    return ['Package templates not found. Init continued with existing embedded/default behavior.'];
  }

  const missing: string[] = [];
  const copy = (templateRelativePath: string, targetRelativePath: string) => {
    if (!writeFileIfMissingFromTemplate(templateRoot, templateRelativePath, targetRelativePath)) {
      missing.push(templateRelativePath);
    }
  };

  for (const file of coreFiles) {
    copy(path.join('ai', 'core', file), path.join('.ai', 'core', file));
  }
  copy(path.join('ai', 'registry', 'tools.json'), path.join('.ai', 'registry', 'tools.json'));
  copy(path.join('ai', 'flows', `${dispatcherFlow}.md`), path.join('.ai', 'flows', `${dispatcherFlow}.md`));
  for (const flow of flowNames) {
    copy(path.join('ai', 'flows', `${flow}.md`), path.join('.ai', 'flows', `${flow}.md`));
  }
  for (const file of skillFiles) {
    copy(path.join('superpowers', 'skills', file), path.join('superpowers', 'skills', file));
  }
  copy(path.join('openspec', 'project.md'), path.join('openspec', 'project.md'));
  copy(path.join('harness', 'state.json'), path.join('harness', 'state.json'));

  return missing.map((file) => `Missing package template: ${file}`);
}

function parseTools(value?: string): ToolName[] {
  if (!value) return defaultTools;
  const tools = value.split(',').map((item) => item.trim()).filter(Boolean) as ToolName[];
  const unsupported = tools.filter((tool) => !defaultTools.includes(tool));
  if (unsupported.length) {
    throw new Error(`Unsupported tools: ${unsupported.join(', ')}. Supported tools: ${defaultTools.join(', ')}`);
  }
  return Array.from(new Set(tools));
}

function parseToolArgs(args?: string[], optionValue?: string) {
  if (args?.length) return parseTools(args.join(','));
  return parseTools(optionValue);
}

function parseIntegrationName(value?: string): IntegrationName {
  if (!value || !integrationNames.includes(value as IntegrationName)) {
    throw new Error(`Unsupported integration: ${value ?? ''}. Supported integrations: ${integrationNames.join(', ')}`);
  }
  return value as IntegrationName;
}

function parseIntegrationMode(value?: string): IntegrationMode {
  if (!value || !integrationModes.includes(value as IntegrationMode)) {
    throw new Error(`Unsupported integration mode: ${value ?? ''}. Supported modes: ${integrationModes.join(', ')}`);
  }
  return value as IntegrationMode;
}

function defaultIntegrationConfig(name: IntegrationName): IntegrationConfig {
  return {
    name,
    mode: 'lightweight',
    officialInstalled: false,
    officialPath: `harness/integrations/${name}/official`,
    cachePath: `harness/integrations/${name}/cache`,
    updatedAt: new Date().toISOString(),
  };
}

function integrationConfigPath(name: IntegrationName) {
  return `harness/integrations/${name}/config.json`;
}

function loadIntegrationConfig(name: IntegrationName): IntegrationConfig {
  const relativePath = integrationConfigPath(name);
  if (!exists(relativePath)) return defaultIntegrationConfig(name);
  try {
    return {
      ...defaultIntegrationConfig(name),
      ...JSON.parse(readText(relativePath)),
      name,
    };
  } catch (error) {
    console.error(`Invalid ${relativePath}: ${(error as Error).message}`);
    return defaultIntegrationConfig(name);
  }
}

function saveIntegrationConfig(config: IntegrationConfig) {
  writeGeneratedFile(integrationConfigPath(config.name), `${JSON.stringify({
    ...config,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`);
}

function loadIntegrations() {
  return Object.fromEntries(integrationNames.map((name) => [name, loadIntegrationConfig(name)])) as Record<IntegrationName, IntegrationConfig>;
}

function integrationSummary() {
  return integrationNames.map((name) => {
    const config = loadIntegrationConfig(name);
    const installed = config.officialInstalled ? 'installed' : 'not installed';
    const health = inspectIntegrationHealth(name, config);
    return `- ${name}: ${config.mode} (${installed}, health=${health.health}, repo-local only: ${config.officialPath})`;
  }).join('\n');
}

function inspectIntegrationHealth(name: IntegrationName, config = loadIntegrationConfig(name)) {
  const officialPath = resolvePath(config.officialPath);
  if (!config.officialInstalled) {
    return {
      health: 'not_installed' as const,
      usable: false,
      reason: 'officialInstalled is false',
      evidence: [] as string[],
      missing: [] as string[],
    };
  }
  if (!fs.existsSync(officialPath)) {
    return {
      health: 'missing' as const,
      usable: false,
      reason: `Missing ${config.officialPath}`,
      evidence: [] as string[],
      missing: [config.officialPath],
    };
  }

  const evidence: string[] = [];
  const missing: string[] = [];
  const has = (relativePath: string) => {
    const fullPath = path.join(officialPath, relativePath);
    if (fs.existsSync(fullPath)) {
      evidence.push(`${config.officialPath}/${relativePath}`);
      return true;
    }
    missing.push(`${config.officialPath}/${relativePath}`);
    return false;
  };

  if (name === 'openspec') {
    has('README.md');
    has('package.json');
  } else {
    has('README.md');
    if (
      fs.existsSync(path.join(officialPath, 'skills'))
      || fs.existsSync(path.join(officialPath, 'commands'))
      || fs.existsSync(path.join(officialPath, 'superpowers'))
    ) {
      evidence.push(`${config.officialPath}/skills|commands|superpowers`);
    } else {
      missing.push(`${config.officialPath}/skills or commands or superpowers`);
    }
  }

  const usable = evidence.length > 0 && (name === 'superpowers' ? evidence.length >= 2 : true);
  return {
    health: usable ? 'usable' as const : 'incomplete' as const,
    usable,
    reason: usable ? 'Repo-local official resources look usable.' : `Repo-local official resources are incomplete: ${missing.join(', ')}`,
    evidence,
    missing,
  };
}

function resolveInsideRoot(relativePath: string) {
  const fullPath = path.resolve(root, relativePath);
  const rootPath = path.resolve(root);
  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing path outside repository: ${relativePath}`);
  }
  return fullPath;
}

function assertIntegrationTargetPath(name: IntegrationName, relativePath: string) {
  const expectedPrefix = path.resolve(root, 'harness', 'integrations', name);
  const fullPath = resolveInsideRoot(relativePath);
  if (fullPath !== expectedPrefix && !fullPath.startsWith(`${expectedPrefix}${path.sep}`)) {
    throw new Error(`Refusing integration path outside harness/integrations/${name}: ${relativePath}`);
  }
  return fullPath;
}

function parseIntegrationSource(source?: string) {
  if (!source) return null;
  if (!source.startsWith('local:')) {
    throw new Error('Only local:<path> sources are supported in v0.8. Network and global installs are intentionally unsupported.');
  }
  const sourcePath = source.slice('local:'.length).trim();
  if (!sourcePath) throw new Error('local:<path> source is required.');
  const fullPath = path.resolve(sourcePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Local source does not exist: ${sourcePath}`);
  if (!fs.statSync(fullPath).isDirectory()) throw new Error(`Local source must be a directory: ${sourcePath}`);
  return fullPath;
}

function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function defaultIntegrationDownloadBase() {
  return path.resolve(root, '..', '_ai-official-sources');
}

function resolveDownloadTarget(name: IntegrationName, to?: string) {
  const base = to ? path.resolve(to) : defaultIntegrationDownloadBase();
  return path.join(base, name);
}

function assertDownloadOutsideRepo(target: string, allowInsideRepo?: boolean) {
  const rootPath = path.resolve(root);
  if (!allowInsideRepo && (target === rootPath || target.startsWith(`${rootPath}${path.sep}`))) {
    throw new Error('Refusing to download official sources inside the repository. Use --allow-inside-repo only if you know what you are doing.');
  }
}

function clearDirectoryContents(directory: string) {
  fs.mkdirSync(directory, { recursive: true });
  for (const item of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, item), { recursive: true, force: true });
  }
}

function copyDirectoryRecursive(source: string, target: string) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function listTargetFiles(tool: ToolName) {
  const targetFiles: Record<ToolName, string[]> = {
    codex: ['AGENTS.md', '.codex/skills/msgfi-ai/SKILL.md', ...flowNames.map((flow) => `.codex/skills/msgfi-ai-${flow}/SKILL.md`)],
    trae: ['.trae/rules.md', '.trae/commands/ai.md', ...flowNames.map((flow) => `.trae/commands/ai-${flow}.md`)],
    qoder: ['.qoder/rules.md', '.qoder/commands/ai.md', ...flowNames.map((flow) => `.qoder/commands/ai/${flow}.md`)],
    cursor: ['.cursor/rules/msgfi-ai.mdc', '.cursor/rules/msgfi-frontend.mdc'],
  };
  return targetFiles[tool];
}

function applyToolSkip(tools: ToolName[], skipValue?: string) {
  const skipped = parseTools(skipValue);
  if (!skipValue) return tools;
  return tools.filter((tool) => !skipped.includes(tool));
}

function normalizeTools(value: unknown): ToolName[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tool): tool is ToolName => defaultTools.includes(tool as ToolName));
}

function loadHarnessConfig() {
  const configPath = resolvePath('harness', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { currentChange: null, tools: defaultTools };
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Invalid harness/config.json: ${(error as Error).message}`);
    return { currentChange: null, tools: defaultTools };
  }
}

function saveHarnessConfig(config: Record<string, unknown>) {
  writeGeneratedFile('harness/config.json', `${JSON.stringify(config, null, 2)}\n`);
}

function setCurrentChange(change: string) {
  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: change,
    tools: config.tools ?? defaultTools,
    checks: config.checks ?? ['ai:validate', 'ai:report'],
    strictChecks: config.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
  });
}

function loadHarnessState() {
  const statePath = resolvePath('harness', 'state.json');
  if (!fs.existsSync(statePath)) {
    return {
      version: 1,
      activeChange: null,
      activeFlow: null,
      status: 'not_started' as HarnessStatus,
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
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.error(`Invalid harness/state.json: ${(error as Error).message}`);
    return {
      version: 1,
      activeChange: null,
      activeFlow: null,
      status: 'not_started' as HarnessStatus,
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

function saveHarnessState(state: Record<string, unknown>) {
  writeGeneratedFile('harness/state.json', `${JSON.stringify(state, null, 2)}\n`);
}

function updateHarnessState(patch: Record<string, unknown>) {
  const state = loadHarnessState();
  saveHarnessState({
    ...state,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

function buildChangeContext(change: string) {
  return {
    proposal: `openspec/changes/${change}/proposal.md`,
    tasks: `openspec/changes/${change}/tasks.md`,
    acceptance: `openspec/changes/${change}/acceptance.md`,
    notes: `openspec/changes/${change}/notes.md`,
  };
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeRunEvent(kind: string, payload: Record<string, unknown>) {
  const state = loadHarnessState();
  const createdAt = new Date().toISOString();
  const event = {
    createdAt,
    kind,
    activeChange: state.activeChange ?? null,
    activeFlow: state.activeFlow ?? null,
    status: state.status ?? null,
    ...payload,
  };
  ensureDir('harness', 'runs');
  writeGeneratedFile(`harness/runs/${timestampForFile(new Date(createdAt))}-${kind}.json`, `${JSON.stringify(event, null, 2)}\n`);
  return event;
}

function writeTimestampedMarkdown(directory: string, basename: string, content: string) {
  const createdAt = new Date().toISOString();
  const filePath = `${directory}/${timestampForFile(new Date(createdAt))}-${basename}.md`;
  ensureDir(...directory.split('/'));
  writeGeneratedFile(filePath, content);
  return filePath;
}

function taskBoardPath(change: string) {
  return `harness/tasks/${change}.json`;
}

function loadTaskBoard(change: string): HarnessTaskBoard | null {
  const filePath = resolvePath(taskBoardPath(change));
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveTaskBoard(board: HarnessTaskBoard) {
  ensureDir('harness', 'tasks');
  writeGeneratedFile(taskBoardPath(board.change), `${JSON.stringify(board, null, 2)}\n`);
}

function parseMarkdownTasks(change: string) {
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return [];
  return fs
    .readFileSync(tasksPath, 'utf8')
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^\s*-\s\[( |x|X)\]\s+(.+)$/);
      if (!match) return null;
      return {
        title: match[2].trim(),
        checked: match[1].toLowerCase() === 'x',
        sourceLine: index + 1,
      };
    })
    .filter(Boolean) as Array<{ title: string; checked: boolean; sourceLine: number }>;
}

function syncTaskBoard(change: string) {
  const now = new Date().toISOString();
  const previous = loadTaskBoard(change);
  const previousByTitle = new Map((previous?.tasks ?? []).map((task) => [task.title, task]));
  const tasks = parseMarkdownTasks(change).map((task, index) => {
    const existing = previousByTitle.get(task.title);
    return {
      id: existing?.id ?? `T${String(index + 1).padStart(3, '0')}`,
      title: task.title,
      status: task.checked ? 'done' : existing?.status ?? 'todo',
      checked: task.checked,
      sourceLine: task.sourceLine,
      owner: existing?.owner ?? null,
      blockedBy: existing?.blockedBy ?? null,
      updatedAt: existing?.updatedAt ?? now,
    };
  });
  const board: HarnessTaskBoard = {
    version: 1,
    change,
    source: `openspec/changes/${change}/tasks.md`,
    updatedAt: now,
    tasks,
  };
  saveTaskBoard(board);
  return board;
}

function findTask(board: HarnessTaskBoard, taskId: string) {
  const normalized = taskId.trim().toLowerCase();
  return board.tasks.find((task) => task.id.toLowerCase() === normalized)
    ?? board.tasks.find((task) => task.id.toLowerCase() === `t${normalized.padStart(3, '0')}`)
    ?? board.tasks.find((task) => task.title.toLowerCase().includes(normalized));
}

function updateMarkdownTaskCheck(change: string, task: HarnessTask, checked: boolean) {
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return;
  const lines = fs.readFileSync(tasksPath, 'utf8').split(/\r?\n/);
  const index = task.sourceLine - 1;
  if (!lines[index]) return;
  lines[index] = lines[index].replace(/-\s\[( |x|X)\]/, checked ? '- [x]' : '- [ ]');
  fs.writeFileSync(tasksPath, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}

function taskSummary(board: HarnessTaskBoard) {
  const counts = board.tasks.reduce(
    (acc, task) => {
      acc[task.status] += 1;
      return acc;
    },
    { todo: 0, doing: 0, done: 0, blocked: 0 } as Record<HarnessTaskStatus, number>,
  );
  return `todo=${counts.todo} doing=${counts.doing} done=${counts.done} blocked=${counts.blocked}`;
}

function selectNextTask(board: HarnessTaskBoard) {
  return board.tasks.find((item) => item.status === 'doing')
    ?? board.tasks.find((item) => item.status === 'todo')
    ?? board.tasks.find((item) => item.status === 'blocked')
    ?? null;
}

function buildAgentPrompt(change: string, task: HarnessTask | null, mode: string) {
  const state = loadHarnessState();
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
    `- status: ${state.status ?? 'unknown'}`,
    `- phase: ${state.phase ?? 'unknown'}`,
    `- lastStep: ${state.lastStep ?? 'none'}`,
    `- nextStep: ${state.nextStep ?? 'none'}`,
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

function getChangeName(input?: string): string | null {
  if (input) return input;
  const config = loadHarnessConfig();
  return typeof config.currentChange === 'string' ? config.currentChange : null;
}

function kebabName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function parseChangeType(value?: string): ChangeType {
  if (!value) return 'default';
  if (!changeTypes.includes(value as ChangeType)) {
    throw new Error(`Unsupported change type: ${value}. Supported types: ${changeTypes.join(', ')}`);
  }
  return value as ChangeType;
}

function templateChangeFile(change: string, kind: string, type: ChangeType = 'default') {
  if (kind === 'proposal.md') {
    if (type === 'bugfix') {
      return `# ${change}\n\n## Type\n\nbugfix\n\n## Bug\n\nDescribe the observed incorrect behavior.\n\n## Expected Behavior\n\nDescribe the correct behavior.\n\n## Root Cause\n\nDescribe the suspected or confirmed cause.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected routes, components, APIs, data fields, or user flows.\n`;
    }
    if (type === 'feature') {
      return `# ${change}\n\n## Type\n\nfeature\n\n## Background\n\nDescribe the user need or business goal.\n\n## Goal\n\nDescribe the intended capability.\n\n## User Flow\n\nDescribe the target workflow.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected apps, pages, APIs, permissions, states, or data models.\n`;
    }
    if (type === 'ui-change') {
      return `# ${change}\n\n## Type\n\nui-change\n\n## Background\n\nDescribe the UI problem or requested adjustment.\n\n## Goal\n\nDescribe the desired UI behavior.\n\n## States\n\n- Default:\n- Loading:\n- Empty:\n- Error:\n- Disabled:\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected components, routes, responsive states, and visual risks.\n`;
    }
    if (type === 'refactor') {
      return `# ${change}\n\n## Type\n\nrefactor\n\n## Background\n\nDescribe the maintainability problem.\n\n## Goal\n\nDescribe the intended internal improvement.\n\n## Behavior Contract\n\nDescribe behavior that must remain unchanged.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected modules, exports, tests, and migration risks.\n`;
    }
    return `# ${change}\n\n## Background\n\nDescribe the problem or opportunity.\n\n## Goal\n\nDescribe the intended outcome.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected apps, packages, routes, APIs, or UI states.\n`;
  }
  if (kind === 'tasks.md') {
    if (type === 'bugfix') {
      return `# Tasks\n\n- [ ] Reproduce or inspect the reported bug path.\n- [ ] Locate the smallest affected code path.\n- [ ] Confirm root cause.\n- [ ] Implement the scoped fix.\n- [ ] Verify the expected behavior.\n- [ ] Check related regression paths.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'feature') {
      return `# Tasks\n\n- [ ] Confirm affected app/package scope.\n- [ ] Confirm data, API, permission, and UI contracts.\n- [ ] Implement the requested capability.\n- [ ] Handle loading, empty, error, and disabled states where applicable.\n- [ ] Update or add focused verification.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'ui-change') {
      return `# Tasks\n\n- [ ] Inspect the existing component and design conventions.\n- [ ] Implement the UI adjustment within existing patterns.\n- [ ] Verify responsive layout and text fit.\n- [ ] Verify loading, empty, error, and disabled states where applicable.\n- [ ] Run focused lint or visual checks.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'refactor') {
      return `# Tasks\n\n- [ ] Document current behavior before changing code.\n- [ ] Identify safe refactor boundaries.\n- [ ] Refactor without changing user-visible behavior.\n- [ ] Update imports/usages if needed.\n- [ ] Run focused regression checks.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    return `# Tasks\n\n- [ ] Confirm affected app/package scope.\n- [ ] Implement the requested behavior.\n- [ ] Update or add verification where appropriate.\n- [ ] Run \`pnpm ai check\`.\n`;
  }
  if (kind === 'acceptance.md') {
    if (type === 'bugfix') {
      return `# Acceptance Criteria\n\n- [ ] The reported incorrect behavior is fixed.\n- [ ] The expected behavior is verified on the affected path.\n- [ ] Related behavior outside the bug scope is not regressed.\n- [ ] The fix is scoped and does not alter shared helpers unless explicitly justified.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'feature') {
      return `# Acceptance Criteria\n\n- [ ] The requested capability works for the primary user flow.\n- [ ] Required UI states are handled where applicable.\n- [ ] Data/API/permission behavior matches the proposal.\n- [ ] Existing related behavior is not regressed.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'ui-change') {
      return `# Acceptance Criteria\n\n- [ ] The UI matches the requested behavior and existing design conventions.\n- [ ] Text, spacing, and controls fit at relevant viewport sizes.\n- [ ] Required states are visually and functionally handled.\n- [ ] Existing interactions are not regressed.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'refactor') {
      return `# Acceptance Criteria\n\n- [ ] User-visible behavior remains unchanged.\n- [ ] Public contracts, routes, APIs, and data formats remain compatible unless explicitly proposed.\n- [ ] The refactor reduces meaningful complexity or duplication.\n- [ ] Focused regression checks pass.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    return `# Acceptance Criteria\n\n- [ ] Behavior matches the proposal.\n- [ ] UI states are handled when applicable.\n- [ ] Existing related behavior is not regressed.\n- [ ] \`pnpm ai check\` passes.\n`;
  }
  return `# Notes\n\nChange type: ${type}\n\nRecord implementation and verification notes here.\n`;
}

function collectCoreSummary() {
  return coreFiles.map((file) => `- .ai/core/${file}`).join('\n');
}

function collectFlowSummary() {
  return [`- /ai: .ai/flows/${dispatcherFlow}.md`, ...flowNames.map((flow) => `- /ai:${flow}: .ai/flows/${flow}.md`)].join('\n');
}

function collectSkillSummary() {
  return skillFiles.map((file) => `- superpowers/skills/${file}`).join('\n');
}

function buildRulesDocument(tool: ToolName) {
  return `# MsgFi AI Rules for ${tool}\n\n<!-- Generated by pnpm ai sync. Edit .ai/core, .ai/flows, and superpowers/skills instead. -->\n\n## Required Workflow\n\n1. Read .ai/core/workflow.md before starting AI-assisted work.\n2. For normal guided work, accept /ai <change> and dispatch to the next suitable flow.\n3. Read the active change under openspec/changes/<change>.\n4. Use the relevant /ai flow.\n5. Search Knowledge Memory with pnpm ai knowledge:search before propose/plan/apply when relevant.\n6. Keep edits scoped to the active change.\n7. Run pnpm ai check before finishing.\n\n## Integration Modes\n\n${integrationSummary()}\n\n- lightweight: use MsgFi built-in compatible rules.\n- official: prefer repo-local official integration only when installed; never use global installs implicitly.\n- hybrid: combine MsgFi rules with repo-local official integration when installed.\n\n## Knowledge Memory\n\n- Use pnpm ai knowledge:search <keywords> --limit 10.\n- Read only returned summaries, not the full harness/memory/knowledge JSONL files.\n- During finish, run pnpm ai knowledge:suggest <change> --write when tool access is available.\n- Add only confirmed reusable knowledge during finish with pnpm ai knowledge:add.\n- Final reports must say what Knowledge Memory was searched, suggested, added, or why it was skipped.\n\n## Core Rules\n\n${collectCoreSummary()}\n\n## Conversation Flows\n\n${collectFlowSummary()}\n\n## Skills\n\n${collectSkillSummary()}\n`;
}

function buildDispatcherDocument() {
  const flowText = readText(`.ai/flows/${dispatcherFlow}.md`);
  return `# /ai\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${dispatcherFlow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- harness/state.json when present\n- openspec/changes/<change>/proposal.md when present\n- openspec/changes/<change>/tasks.md when present\n- openspec/changes/<change>/acceptance.md when present\n\nUse the specific /ai:* flow selected by the dispatcher.\n`;
}

function buildCommandDocument(flow: string) {
  const flowText = readText(`.ai/flows/${flow}.md`);
  return `# /ai:${flow}\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${flow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- openspec/changes/<change>/proposal.md\n- openspec/changes/<change>/tasks.md\n- openspec/changes/<change>/acceptance.md\n\nFinish with \`pnpm ai check\` when the flow changes code.\n`;
}

function initCommand(options: { tools?: string; toolArgs?: string[]; setupScript?: boolean }) {
  const tools = parseToolArgs(options.toolArgs, options.tools);
  const existingConfigExisted = exists('harness/config.json');
  ensureDir('.ai', 'core');
  ensureDir('.ai', 'flows');
  ensureDir('.ai', 'registry');
  ensureDir('openspec', 'changes');
  ensureDir('openspec', 'specs');
  ensureDir('superpowers', 'skills');
  ensureDir('harness', 'reports');
  ensureDir('harness', 'runs');
  ensureDir('harness', 'tasks');
  ensureDir('harness', 'memory', 'knowledge');
  ensureDir('harness', 'memory', 'index');
  for (const name of integrationNames) {
    ensureDir('harness', 'integrations', name);
    ensureDir('harness', 'integrations', name, 'official');
    ensureDir('harness', 'integrations', name, 'cache');
  }

  const templateWarnings = seedProjectTemplates();

  writeFileIfMissing('openspec/changes/.gitkeep', '\n');
  writeFileIfMissing('openspec/specs/.gitkeep', '\n');
  writeFileIfMissing('harness/reports/.gitkeep', '\n');
  writeFileIfMissing('harness/runs/.gitkeep', '\n');
  writeFileIfMissing('harness/tasks/.gitkeep', '\n');
  writeFileIfMissing('harness/memory/knowledge/.gitkeep', '\n');
  writeFileIfMissing('harness/memory/index/.gitkeep', '\n');
  for (const name of integrationNames) {
    writeFileIfMissing(`harness/integrations/${name}/official/.gitkeep`, '\n');
    writeFileIfMissing(`harness/integrations/${name}/cache/.gitkeep`, '\n');
    if (!exists(integrationConfigPath(name))) saveIntegrationConfig(defaultIntegrationConfig(name));
  }
  for (const file of Object.values(knowledgeFiles)) {
    writeFileIfMissing(`harness/memory/knowledge/${file}`, '');
  }
  buildKnowledgeIndex();

  const config = loadHarnessConfig();
  const configuredTools = existingConfigExisted
    ? Array.from(new Set([...normalizeTools(config.tools), ...tools]))
    : tools;
  saveHarnessConfig({
    version: 1,
    profile: 'lightweight',
    currentChange: existingConfigExisted ? config.currentChange ?? null : null,
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

function syncCommand(options: { tools?: string; skip?: string; toolArgs?: string[] }) {
  const selectedTools = parseToolArgs(options.toolArgs, options.tools ?? (loadHarnessConfig().tools || defaultTools).join(','));
  const tools = applyToolSkip(selectedTools, options.skip);
  const errors: string[] = [];

  const syncTool = (tool: ToolName, action: () => void) => {
    try {
      action();
    } catch (error) {
      errors.push(`${tool}: ${(error as Error).message}`);
    }
  };

  if (tools.includes('codex')) {
    syncTool('codex', () => {
      writeGeneratedFile('AGENTS.md', buildRulesDocument('codex'));
      writeGeneratedFile('.codex/skills/msgfi-ai/SKILL.md', buildDispatcherDocument());
      for (const flow of flowNames) {
        writeGeneratedFile(`.codex/skills/msgfi-ai-${flow}/SKILL.md`, buildCommandDocument(flow));
      }
    });
  }

  if (tools.includes('trae')) {
    syncTool('trae', () => {
      writeGeneratedFile('.trae/rules.md', buildRulesDocument('trae'));
      writeGeneratedFile('.trae/commands/ai.md', buildDispatcherDocument());
      for (const flow of flowNames) {
        writeGeneratedFile(`.trae/commands/ai-${flow}.md`, buildCommandDocument(flow));
      }
    });
  }

  if (tools.includes('qoder')) {
    syncTool('qoder', () => {
      writeGeneratedFile('.qoder/rules.md', buildRulesDocument('qoder'));
      writeGeneratedFile('.qoder/commands/ai.md', buildDispatcherDocument());
      for (const flow of flowNames) {
        writeGeneratedFile(`.qoder/commands/ai/${flow}.md`, buildCommandDocument(flow));
      }
    });
  }

  if (tools.includes('cursor')) {
    syncTool('cursor', () => {
      writeGeneratedFile('.cursor/rules/msgfi-ai.mdc', buildRulesDocument('cursor'));
      writeGeneratedFile('.cursor/rules/msgfi-frontend.mdc', `${readText('.ai/core/frontend.md')}\n\n${readText('.ai/core/ui.md')}`);
    });
  }

  if (errors.length) {
    console.error(`AI target sync partially failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`AI targets synced: ${tools.join(', ') || 'none'}`);
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

async function newCommand(changeInput: string | undefined, options: { type?: string; interactive?: boolean } = {}) {
  let change = changeInput ? kebabName(changeInput) : '';
  let type = parseChangeType(options.type);

  if (options.interactive) {
    change = kebabName(await prompt('Enter change name: '));
    while (!change) {
      change = kebabName(await prompt('Change name is required. Enter change name: '));
    }
    type = parseChangeType(await prompt('Select change type (default/bugfix/feature/ui-change/refactor): ') || 'default');
  }

  if (!change) {
    throw new Error('Change name is required.');
  }

  for (const file of [...requiredChangeFiles, 'notes.md']) {
    writeFileIfMissing(`openspec/changes/${change}/${file}`, templateChangeFile(change, file, type));
  }

  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: change,
    tools: config.tools ?? defaultTools,
    checks: config.checks ?? ['eslint', 'ai:validate', 'ai:report'],
  });
  updateHarnessState({
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

function textCorruptionScore(text: string) {
  const patternScore = mojibakePatterns.reduce((score, pattern) => {
    const matches = text.split(pattern).length - 1;
    return score + matches * 10;
  }, 0);
  const controlScore = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length * 20;
  return patternScore + controlScore;
}

function hasMojibake(text: string) {
  return textCorruptionScore(text) > 0;
}

function collectEncodingIssues(change?: string) {
  const issues: string[] = [];
  const changes = change
    ? [change]
    : fs.existsSync(resolvePath('openspec', 'changes'))
      ? fs.readdirSync(resolvePath('openspec', 'changes')).filter((item) => {
          const fullPath = resolvePath('openspec', 'changes', item);
          return fs.statSync(fullPath).isDirectory();
        })
      : [];
  for (const item of changes) {
    for (const file of textFilesToCheck) {
      const relativePath = `openspec/changes/${item}/${file}`;
      if (exists(relativePath) && hasMojibake(readText(relativePath))) {
        issues.push(relativePath);
      }
    }
  }
  return issues;
}

function fixMojibakeText(text: string) {
  const buffer = Buffer.from(text, 'latin1');
  const decoded = buffer.toString('utf8');
  const beforeScore = textCorruptionScore(text);
  const afterScore = textCorruptionScore(decoded);
  return afterScore < beforeScore ? decoded : text;
}

function encodingCommand(changeInput?: string, options: { fix?: boolean } = {}) {
  const change = getChangeName(changeInput) ?? undefined;
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
  const fixed: string[] = [];
  const unchanged: string[] = [];
  for (const relativePath of issues) {
    const current = readText(relativePath);
    const next = fixMojibakeText(current);
    if (next !== current) {
      writeGeneratedFile(relativePath, next);
      fixed.push(relativePath);
    } else {
      unchanged.push(relativePath);
    }
  }
  if (fixed.length) console.log(`Fixed files:\n${fixed.map((item) => `- ${item}`).join('\n')}`);
  if (unchanged.length) console.log(`Could not safely fix:\n${unchanged.map((item) => `- ${item}`).join('\n')}`);
  if (unchanged.length) process.exitCode = 1;
}

function knowledgeDir() {
  return resolvePath('harness', 'memory', 'knowledge');
}

function knowledgeIndexDir() {
  return resolvePath('harness', 'memory', 'index');
}

function knowledgeFilePath(type: KnowledgeType) {
  return resolvePath('harness', 'memory', 'knowledge', knowledgeFiles[type]);
}

function parseKnowledgeType(value?: string): KnowledgeType {
  if (!value || !knowledgeTypes.includes(value as KnowledgeType)) {
    throw new Error(`Unsupported knowledge type: ${value ?? ''}. Supported types: ${knowledgeTypes.join(', ')}`);
  }
  return value as KnowledgeType;
}

function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function normalizeKnowledgeRecord(record: Partial<KnowledgeRecord>) {
  const now = new Date().toISOString().slice(0, 10);
  const type = parseKnowledgeType(record.type);
  const name = String(record.name ?? '').trim();
  const summary = String(record.summary ?? '').trim();
  if (!name) throw new Error('Knowledge name is required.');
  if (!summary) throw new Error('Knowledge summary is required.');
  const source = String(record.source ?? 'repo').trim();
  const scope = String(record.scope ?? 'global').trim();
  const id = String(record.id ?? `${type}:${kebabName(name)}:${kebabName(source || scope)}`).trim();
  return {
    id,
    type,
    name,
    scope,
    source,
    summary,
    keywords: uniqueValues(record.keywords ?? []),
    usedIn: uniqueValues(record.usedIn ?? []),
    status: (record.status ?? 'active') as KnowledgeStatus,
    confidence: (record.confidence ?? 'confirmed') as KnowledgeConfidence,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  } satisfies KnowledgeRecord;
}

function readKnowledgeFile(type: KnowledgeType) {
  const filePath = knowledgeFilePath(type);
  if (!fs.existsSync(filePath)) return [] as KnowledgeRecord[];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return normalizeKnowledgeRecord(JSON.parse(line));
      } catch (error) {
        throw new Error(`${path.relative(root, filePath)}:${index + 1} ${(error as Error).message}`);
      }
    });
}

function writeKnowledgeFile(type: KnowledgeType, records: KnowledgeRecord[]) {
  ensureDir('harness', 'memory', 'knowledge');
  const lines = records
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) => JSON.stringify(record));
  fs.writeFileSync(knowledgeFilePath(type), `${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
}

function readAllKnowledgeRecords(): KnowledgeIndexRecord[] {
  const records: KnowledgeIndexRecord[] = [];
  for (const type of knowledgeTypes) {
    const file = `harness/memory/knowledge/${knowledgeFiles[type]}`;
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

function mergeKnowledgeRecords(existing: KnowledgeRecord, incoming: KnowledgeRecord): KnowledgeRecord {
  return {
    ...existing,
    ...incoming,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: new Date().toISOString().slice(0, 10),
    keywords: uniqueValues([...existing.keywords, ...incoming.keywords]),
    usedIn: uniqueValues([...existing.usedIn, ...incoming.usedIn]),
  };
}

function dedupeKnowledgeRecords(records: KnowledgeRecord[]) {
  const byId = new Map<string, KnowledgeRecord>();
  for (const record of records) {
    const previous = byId.get(record.id);
    byId.set(record.id, previous ? mergeKnowledgeRecords(previous, record) : record);
  }
  return Array.from(byId.values());
}

function tokenizeKnowledgeText(text: string) {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9_.:/@-]+|[\u4e00-\u9fa5]{2,}/g) ?? [];
  return uniqueValues(tokens);
}

function buildKnowledgeSearchText(record: KnowledgeRecord) {
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

function buildKnowledgeIndex() {
  ensureDir('harness', 'memory', 'index');
  const records = readAllKnowledgeRecords();
  const keywords: Record<string, string[]> = {};
  const indexRecords: Record<string, Omit<KnowledgeIndexRecord, 'searchText'>> = {};
  const stats = {
    updatedAt: new Date().toISOString(),
    total: records.length,
    byType: Object.fromEntries(knowledgeTypes.map((type) => [type, 0])) as Record<KnowledgeType, number>,
    byStatus: { active: 0, deprecated: 0 } as Record<KnowledgeStatus, number>,
    byConfidence: { confirmed: 0, uncertain: 0 } as Record<KnowledgeConfidence, number>,
  };

  for (const record of records) {
    stats.byType[record.type] += 1;
    stats.byStatus[record.status] += 1;
    stats.byConfidence[record.confidence] += 1;
    const { searchText, ...indexRecord } = record;
    indexRecords[record.id] = indexRecord;
    for (const token of tokenizeKnowledgeText(searchText)) {
      keywords[token] = uniqueValues([...(keywords[token] ?? []), record.id]);
    }
  }

  writeGeneratedFile('harness/memory/index/keywords.json', `${JSON.stringify(keywords, null, 2)}\n`);
  writeGeneratedFile('harness/memory/index/records.json', `${JSON.stringify(indexRecords, null, 2)}\n`);
  writeGeneratedFile('harness/memory/index/stats.json', `${JSON.stringify(stats, null, 2)}\n`);
  return stats;
}

function loadKnowledgeIndex() {
  const recordsPath = resolvePath('harness', 'memory', 'index', 'records.json');
  if (!fs.existsSync(recordsPath)) buildKnowledgeIndex();
  const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8')) as Record<string, Omit<KnowledgeIndexRecord, 'searchText'>>;
  return Object.values(records).map((record) => ({
    ...record,
    searchText: buildKnowledgeSearchText(record),
  }));
}

function scoreKnowledgeRecord(record: KnowledgeIndexRecord, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;
    if (record.id.toLowerCase().includes(normalized)) score += 8;
    if (record.name.toLowerCase().includes(normalized)) score += 6;
    if (record.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))) score += 5;
    if (record.summary.toLowerCase().includes(normalized)) score += 3;
    if (record.searchText.includes(normalized)) score += 1;
  }
  if (record.status === 'active') score += 1;
  if (record.confidence === 'confirmed') score += 1;
  return score;
}

function knowledgeAddCommand(options: {
  type?: string;
  id?: string;
  name?: string;
  summary?: string;
  scope?: string;
  source?: string;
  keywords?: string;
  usedIn?: string;
  status?: KnowledgeStatus;
  confidence?: KnowledgeConfidence;
  from?: string;
}) {
  const fromRecord = options.from
    ? JSON.parse(fs.readFileSync(resolvePath(options.from), 'utf8')) as Partial<KnowledgeRecord>
    : {};
  const record = normalizeKnowledgeRecord({
    ...fromRecord,
    id: options.id ?? fromRecord.id,
    type: options.type ? parseKnowledgeType(options.type) : fromRecord.type,
    name: options.name ?? fromRecord.name,
    summary: options.summary ?? fromRecord.summary,
    scope: options.scope ?? fromRecord.scope,
    source: options.source ?? fromRecord.source,
    keywords: options.keywords ? splitList(options.keywords) : fromRecord.keywords,
    usedIn: options.usedIn ? splitList(options.usedIn) : fromRecord.usedIn,
    status: options.status ?? fromRecord.status ?? 'active',
    confidence: options.confidence ?? fromRecord.confidence ?? 'confirmed',
  });
  const records = readKnowledgeFile(record.type);
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = mergeKnowledgeRecords(records[existingIndex], record);
  } else {
    records.push(record);
  }
  writeKnowledgeFile(record.type, dedupeKnowledgeRecords(records));
  const stats = buildKnowledgeIndex();
  writeRunEvent('knowledge-add', { id: record.id, type: record.type });
  console.log(JSON.stringify({ status: existingIndex >= 0 ? 'merged' : 'added', record, stats }, null, 2));
}

function knowledgeSearchCommand(termsInput: string[], options: { limit?: string; all?: boolean; type?: string } = {}) {
  const terms = termsInput.length ? termsInput : [];
  if (!terms.length) throw new Error('At least one search keyword is required.');
  const limit = Number.parseInt(options.limit ?? '10', 10);
  const type = options.type ? parseKnowledgeType(options.type) : null;
  const records = loadKnowledgeIndex()
    .filter((record) => options.all || (record.status === 'active' && record.confidence === 'confirmed'))
    .filter((record) => !type || record.type === type)
    .map((record) => ({ record, score: scoreKnowledgeRecord(record, terms) }))
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

function knowledgeListCommand(options: { type?: string; limit?: string; all?: boolean } = {}) {
  const limit = Number.parseInt(options.limit ?? '50', 10);
  const type = options.type ? parseKnowledgeType(options.type) : null;
  const records = loadKnowledgeIndex()
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
  const stats = buildKnowledgeIndex();
  console.log(JSON.stringify({ status: 'indexed', stats }, null, 2));
}

function knowledgeDedupeCommand() {
  const results: Record<string, { before: number; after: number }> = {};
  for (const type of knowledgeTypes) {
    const before = readKnowledgeFile(type);
    const after = dedupeKnowledgeRecords(before);
    writeKnowledgeFile(type, after);
    results[type] = { before: before.length, after: after.length };
  }
  const stats = buildKnowledgeIndex();
  console.log(JSON.stringify({ status: 'deduped', results, stats }, null, 2));
}

function knowledgeAnalyzeCommand(options: { limit?: string } = {}) {
  const records = readAllKnowledgeRecords();
  const limit = Number.parseInt(options.limit ?? '10', 10);
  const byType = Object.fromEntries(knowledgeTypes.map((type) => [type, records.filter((record) => record.type === type).length]));
  const uncertain = records.filter((record) => record.confidence === 'uncertain');
  const deprecated = records.filter((record) => record.status === 'deprecated');
  const keywordCounts = new Map<string, number>();
  for (const record of records) {
    for (const keyword of record.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)
    .map(([keyword, count]) => ({ keyword, count }));
  const suggestions = [
    records.length < 10 ? 'Knowledge base is still small. Prefer adding confirmed facts from real changes before creating skills.' : null,
    uncertain.length ? `Review ${uncertain.length} uncertain records before treating them as reusable facts.` : null,
    (byType.failure ?? 0) === 0 ? 'No failure records yet. Add repeated pitfalls after finish when confirmed.' : null,
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
  const integrations = loadIntegrations();
  const health = Object.fromEntries(integrationNames.map((name) => [name, inspectIntegrationHealth(name, integrations[name])]));
  console.log(JSON.stringify({
    integrations,
    health,
    note: 'Official integrations are repo-local only. This command does not install global packages or modify PATH.',
  }, null, 2));
}

function integrationUseCommand(nameInput: string, modeInput: string) {
  const name = parseIntegrationName(nameInput);
  const mode = parseIntegrationMode(modeInput);
  const current = loadIntegrationConfig(name);
  const next = {
    ...current,
    mode,
  };
  saveIntegrationConfig(next);
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

function integrationInstallCommand(nameInput: string, options: { source?: string; dryRun?: boolean } = {}) {
  const name = parseIntegrationName(nameInput);
  const current = loadIntegrationConfig(name);
  const officialPath = assertIntegrationTargetPath(name, current.officialPath);
  const cachePath = assertIntegrationTargetPath(name, current.cachePath);
  const sourcePath = options.source ? parseIntegrationSource(options.source) : null;
  const now = new Date().toISOString();

  if (options.dryRun) {
    saveIntegrationConfig({
      ...current,
      lastInstallDryRunAt: now,
    });
    console.log(JSON.stringify({
      status: 'dry-run',
      integration: name,
      source: options.source ?? null,
      officialPath: current.officialPath,
      cachePath: current.cachePath,
      note: 'No files were copied. No global packages were installed. PATH was not modified.',
    }, null, 2));
    return;
  }

  if (!sourcePath || !options.source) {
    throw new Error('v0.8 only supports repo-local install from --source local:<path>. Use --dry-run to preview.');
  }
  if (sourcePath === officialPath || sourcePath.startsWith(`${officialPath}${path.sep}`) || sourcePath === cachePath || sourcePath.startsWith(`${cachePath}${path.sep}`)) {
    throw new Error('Local source cannot be inside the target official/cache directories.');
  }

  clearDirectoryContents(officialPath);
  clearDirectoryContents(cachePath);
  copyDirectoryRecursive(sourcePath, officialPath);
  writeFileIfMissing(`${current.officialPath}/.gitkeep`, '\n');
  saveIntegrationConfig({
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

function integrationRemoveCommand(nameInput: string, options: { dryRun?: boolean } = {}) {
  const name = parseIntegrationName(nameInput);
  const current = loadIntegrationConfig(name);
  const officialPath = assertIntegrationTargetPath(name, current.officialPath);
  const cachePath = assertIntegrationTargetPath(name, current.cachePath);
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

  clearDirectoryContents(officialPath);
  clearDirectoryContents(cachePath);
  writeFileIfMissing(`${current.officialPath}/.gitkeep`, '\n');
  writeFileIfMissing(`${current.cachePath}/.gitkeep`, '\n');
  saveIntegrationConfig({
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

function integrationDownloadCommand(nameInput: string, options: { to?: string; dryRun?: boolean; force?: boolean; allowInsideRepo?: boolean } = {}) {
  const name = parseIntegrationName(nameInput);
  const repo = integrationGitSources[name];
  const target = resolveDownloadTarget(name, options.to);
  assertDownloadOutsideRepo(target, options.allowInsideRepo);
  const parent = path.dirname(target);
  const nextInstallCommand = `node ./scripts/ai/run-ai.cjs integration:install ${name} --source ${quoteShellArg(`local:${target}`)}`;

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

  if (fs.existsSync(target)) {
    if (!options.force) {
      throw new Error(`Download target already exists: ${target}. Use --force to replace it.`);
    }
    assertDownloadOutsideRepo(target, options.allowInsideRepo);
    clearDirectoryContents(target);
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(parent, { recursive: true });
  const startedAt = Date.now();
  const result = spawnSync('git', ['clone', '--depth', '1', repo, target], {
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
  if (exitCode !== 0) process.exitCode = exitCode;
}

function detectOfficialValidateCommand(name: IntegrationName, officialPath: string) {
  const packageJsonPath = path.join(officialPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson?.scripts?.validate) {
    return {
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'npm run validate'] : ['-lc', 'npm run validate'],
      display: 'npm run validate',
    };
  }
  if (name === 'openspec' && packageJson?.bin) {
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

function integrationValidateCommand(nameInput: string, options: { dryRun?: boolean; execute?: boolean } = {}) {
  const name = parseIntegrationName(nameInput);
  const config = loadIntegrationConfig(name);
  const health = inspectIntegrationHealth(name, config);
  const officialPath = assertIntegrationTargetPath(name, config.officialPath);
  const validateCommand = detectOfficialValidateCommand(name, officialPath);
  const base = {
    integration: name,
    mode: config.mode,
    officialInstalled: config.officialInstalled,
    officialPath: config.officialPath,
    health,
    validateCommand: validateCommand?.display ?? null,
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
  const result = spawnSync(validateCommand.command, validateCommand.args, {
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
  if (exitCode !== 0) process.exitCode = exitCode;
}

function readChangeText(change: string) {
  return textFilesToCheck
    .map((file) => {
      const relativePath = `openspec/changes/${change}/${file}`;
      return exists(relativePath) ? `\n# ${file}\n${readText(relativePath)}` : '';
    })
    .join('\n');
}

function collectChangedFilesForKnowledge() {
  const result = spawnSync('git', ['-c', `safe.directory=${root.replace(/\\/g, '/')}`, 'status', '--short', '--', 'apps', 'packages'], {
    cwd: root,
    shell: false,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((file) => file.startsWith('apps/') || file.startsWith('packages/'))
    .filter((file) => /\.(ts|tsx|js|jsx|md|json)$/.test(file))
    .slice(0, 20);
}

function extractKnowledgeNames(text: string) {
  const names = new Set<string>();
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
  const codeNames = text.match(/`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?`/g) ?? [];
  for (const item of codeNames) {
    const name = item.replace(/`/g, '');
    if (!lowValueNames.has(name) && !fileLikePattern.test(name)) names.add(name);
  }
  const dotted = text.match(/\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/g) ?? [];
  for (const item of dotted) {
    if (!fileLikePattern.test(item)) names.add(item);
  }
  const constants = text.match(/\b[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g) ?? [];
  for (const item of constants) names.add(item);
  return Array.from(names)
    .sort((a, b) => {
      const score = (value: string) => (value.includes('.') ? 3 : 0) + (/[A-Z_]/.test(value) ? 2 : 0) + (value.length > 12 ? 1 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    })
    .slice(0, 8);
}

function extractReferencedFiles(text: string) {
  const matches = text.match(/\b(?:apps|packages)\/[^\s)`"'，。；,]+/g) ?? [];
  return uniqueValues(matches.map((item) => item.replace(/[:：]\d+$/, '').replace(/[.,;，。；]+$/, '')));
}

function buildKnowledgeAddCommand(record: Partial<KnowledgeRecord>) {
  const args = [
    'pnpm ai knowledge:add --',
    `--type ${record.type}`,
    `--name ${quoteShellArg(String(record.name ?? ''))}`,
    `--summary ${quoteShellArg(String(record.summary ?? ''))}`,
  ];
  if (record.scope) args.push(`--scope ${quoteShellArg(record.scope)}`);
  if (record.source) args.push(`--source ${quoteShellArg(record.source)}`);
  if (record.keywords?.length) args.push(`--keywords ${quoteShellArg(record.keywords.join(','))}`);
  if (record.usedIn?.length) args.push(`--used-in ${quoteShellArg(record.usedIn.join(','))}`);
  if (record.confidence) args.push(`--confidence ${record.confidence}`);
  return args.join(' ');
}

function knowledgeSuggestCommand(changeInput?: string, options: { limit?: string; write?: boolean } = {}) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  const text = readChangeText(change);
  const board = fs.existsSync(resolvePath('openspec', 'changes', change, 'tasks.md')) ? syncTaskBoard(change) : null;
  const changedFiles = extractReferencedFiles(text).length ? extractReferencedFiles(text) : collectChangedFilesForKnowledge();
  const names = extractKnowledgeNames(text);
  const limit = Number.parseInt(options.limit ?? '8', 10);
  const candidates: Array<Partial<KnowledgeRecord> & { reason: string; command: string }> = [];

  for (const name of names) {
    const isConstant = /^[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(name);
    const record: Partial<KnowledgeRecord> = {
      type: name.includes('.') ? 'function' : isConstant ? 'failure' : 'pattern',
      name,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm reusable usage or behavior for ${name} before adding.`,
      keywords: uniqueValues([change, name, ...tokenizeKnowledgeText(text).slice(0, 5)]),
      usedIn: changedFiles.slice(0, 5),
      status: 'active',
      confidence: 'uncertain',
    };
    candidates.push({ ...record, reason: 'Named symbol found in change documents.', command: buildKnowledgeAddCommand(record) });
  }

  if (/原因|root cause|失败|blocked|风险|regression|bug/i.test(text)) {
    const record: Partial<KnowledgeRecord> = {
      type: 'failure',
      name: `${change} failure/bug lesson`,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm the reusable failure cause, trigger condition, and prevention rule before adding.`,
      keywords: uniqueValues([change, 'failure', 'bug', '风险']),
      usedIn: changedFiles.slice(0, 5),
      status: 'active',
      confidence: 'uncertain',
    };
    candidates.push({ ...record, reason: 'Change text mentions root cause, bug, risk, or failure.', command: buildKnowledgeAddCommand(record) });
  }

  if (/决策|decision|确认|保持|不修改|不影响/i.test(text)) {
    const record: Partial<KnowledgeRecord> = {
      type: 'decision',
      name: `${change} confirmed decision`,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm the final product or technical decision before adding.`,
      keywords: uniqueValues([change, 'decision', '确认']),
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

  let suggestionPath: string | null = null;
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

function collectUncheckedTasks(change: string) {
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return [];
  return fs
    .readFileSync(tasksPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s\[\s\]\s+/.test(line));
}

function collectUncheckedAcceptance(change: string) {
  const acceptancePath = resolvePath('openspec', 'changes', change, 'acceptance.md');
  if (!fs.existsSync(acceptancePath)) return [];
  return fs
    .readFileSync(acceptancePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s\[\s\]\s+/.test(line));
}

function appendUncheckedTasks(change: string, tasks: string[]) {
  if (!tasks.length) return;
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  const existing = fs.existsSync(tasksPath) ? fs.readFileSync(tasksPath, 'utf8') : '# Tasks\n';
  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const additions = tasks
    .map((task) => task.trim())
    .filter(Boolean)
    .map((task) => (task.startsWith('- [ ]') ? task : `- [ ] ${task}`))
    .filter((task) => !existingLines.has(task.trim()));
  if (!additions.length) return;
  fs.writeFileSync(tasksPath, `${existing.trimEnd()}\n${additions.join('\n')}\n`, 'utf8');
}

function validateCommand(changeInput?: string, options: { quiet?: boolean } = {}) {
  const errors: string[] = [];
  const checkFile = (relativePath: string) => {
    if (!exists(relativePath)) errors.push(`Missing ${relativePath}`);
  };

  for (const file of coreFiles) checkFile(`.ai/core/${file}`);
  for (const flow of flowNames) checkFile(`.ai/flows/${flow}.md`);
  for (const file of skillFiles) checkFile(`superpowers/skills/${file}`);
  checkFile('openspec/project.md');
  checkFile('harness/config.json');
  checkFile('harness/state.json');
  checkFile('.ai/registry/tools.json');

  try {
    loadHarnessConfig();
  } catch (error) {
    errors.push(`Invalid harness/config.json: ${(error as Error).message}`);
  }

  const change = getChangeName(changeInput);
  if (changeInput && change) {
    setCurrentChange(change);
  }
  if (change) {
    for (const file of requiredChangeFiles) {
      checkFile(`openspec/changes/${change}/${file}`);
    }
    for (const file of textFilesToCheck) {
      const relativePath = `openspec/changes/${change}/${file}`;
      if (exists(relativePath) && hasMojibake(readText(relativePath))) {
        errors.push(`Possible mojibake detected in ${relativePath}. Ensure UTF-8 output in Windows/Codex/PowerShell.`);
      }
    }
  }

  let tools = defaultTools;
  try {
    const config = loadHarnessConfig();
    tools = (config.tools || defaultTools) as ToolName[];
  } catch {
    tools = defaultTools;
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
    return { status: 'failed' as const, errors };
  }

  if (!options.quiet) {
    console.log(change ? `AI validation passed for change: ${change}` : 'AI validation passed');
  }
  return { status: 'passed' as const, errors };
}

function runCommand(command: string, args: string[]): HarnessResult {
  const startedAt = Date.now();
  const result = spawnSync(command, args, { cwd: root, shell: false, stdio: 'inherit' });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    command: [command, ...args].join(' '),
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
  };
}

function runEslintCommand(): HarnessResult {
  const eslintPath = resolvePath('node_modules', 'eslint', 'bin', 'eslint.js');
  const startedAt = Date.now();
  if (!fs.existsSync(eslintPath)) {
    return {
      command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
      status: 'failed',
      exitCode: 1,
      durationMs: Date.now() - startedAt,
      reason: 'Missing local ESLint binary. Run pnpm install first.',
    };
  }
  const result = spawnSync(process.execPath, [eslintPath, '--ext', '.tsx,.ts', './apps'], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    reason: result.error?.message,
  };
}

function writeReport(changeInput: string | undefined, results: HarnessResult[], status?: 'passed' | 'failed') {
  const config = loadHarnessConfig();
  const change = getChangeName(changeInput);
  if (changeInput && change) {
    setCurrentChange(change);
  }
  const finalStatus = status ?? (results.every((item) => item.status === 'passed') ? 'passed' : 'failed');
  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const report = {
    createdAt: timestamp,
    profile: config.profile ?? 'lightweight',
    scope: change ?? 'root',
    change,
    dryRun: false,
    status: finalStatus,
    tools: config.tools ?? defaultTools,
    results,
  };

  writeGeneratedFile(`harness/reports/${fileTimestamp}.json`, `${JSON.stringify(report, null, 2)}\n`);
  updateHarnessState({
    activeChange: change ?? null,
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

function reportCommand(changeInput?: string) {
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

function checkCommand(changeInput?: string, options: { strict?: boolean; noEslint?: boolean } = {}) {
  const results: HarnessResult[] = [];

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
  const state = loadHarnessState();
  console.log(JSON.stringify(state, null, 2));
}

function currentCommand(changeInput?: string) {
  if (changeInput) {
    const change = kebabName(changeInput);
    if (!change) throw new Error('Change name is required.');
    setCurrentChange(change);
    updateHarnessState({
      activeChange: change,
      context: buildChangeContext(change),
    });
    console.log(`Current change set: ${change}`);
    return;
  }
  const config = loadHarnessConfig();
  const state = loadHarnessState();
  console.log(JSON.stringify({
    currentChange: config.currentChange ?? null,
    activeChange: state.activeChange ?? null,
    activeFlow: state.activeFlow ?? null,
    status: state.status ?? null,
    phase: state.phase ?? null,
    lastReport: state.lastReport ?? null,
  }, null, 2));
}

function resumeCommand() {
  const state = loadHarnessState();
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
    `- status: ${state.status ?? 'unknown'}`,
    `- phase: ${state.phase ?? 'unknown'}`,
    `- activeFlow: ${state.activeFlow ?? 'unknown'}`,
    `- lastStep: ${state.lastStep ?? 'none'}`,
    `- nextStep: ${state.nextStep ?? 'none'}`,
  ];
  if (uncheckedTasks.length) {
    lines.push('', 'Unfinished tasks:', ...uncheckedTasks.map((task) => `- ${task.replace(/^\s*-\s\[\s\]\s+/, '')}`));
  }
  if (decisions.length) {
    lines.push('', 'Recorded decisions:', ...decisions.map((item: any) => `- ${item.text ?? item}`));
  }
  if (blockedBy.length) {
    lines.push('', 'Blocked by:', ...blockedBy.map((item: string) => `- ${item}`));
  }
  lines.push('', 'Instruction: continue only the unfinished scope for this change.');
  console.log(lines.join('\n'));
}

function parseTasks(value?: string | string[]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function verifyCommand(changeInput?: string, options: { status?: HarnessStatus; task?: string | string[] } = {}) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  appendUncheckedTasks(change, parseTasks(options.task));
  const uncheckedTasks = collectUncheckedTasks(change);
  const status = options.status ?? (uncheckedTasks.length ? 'partially_accepted' : 'accepted');
  updateHarnessState({
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

function finishStateCommand(changeInput?: string) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const uncheckedTasks = collectUncheckedTasks(change);
  const status: HarnessStatus = uncheckedTasks.length ? 'partially_accepted' : 'accepted';
  updateHarnessState({
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

function stepCommand(note: string, options: { change?: string; flow?: string; status?: HarnessStatus; next?: string } = {}) {
  const change = getChangeName(options.change);
  const flow = options.flow ?? loadHarnessState().activeFlow ?? null;
  updateHarnessState({
    activeChange: change,
    activeFlow: flow,
    status: options.status ?? 'in_progress',
    phase: flow ? phaseByFlow[flow] ?? 'implementation' : loadHarnessState().phase ?? 'implementation',
    lastStep: note,
    nextStep: options.next ?? loadHarnessState().nextStep ?? null,
    nextSuggestedFlow: flow ?? loadHarnessState().nextSuggestedFlow ?? null,
    context: change ? buildChangeContext(change) : loadHarnessState().context ?? {},
  });
  writeRunEvent('step', { change, flow, note, nextStep: options.next ?? null });
  console.log(`Step recorded: ${note}`);
}

function decisionCommand(text: string, options: { change?: string; flow?: string } = {}) {
  const state = loadHarnessState();
  const change = getChangeName(options.change);
  const decision = { text, createdAt: new Date().toISOString(), change: change ?? null, flow: options.flow ?? state.activeFlow ?? null };
  const decisions = Array.isArray(state.decisions) ? state.decisions.concat(decision) : [decision];
  updateHarnessState({
    activeChange: change ?? state.activeChange ?? null,
    activeFlow: options.flow ?? state.activeFlow ?? null,
    decisions,
    lastStep: `Decision recorded: ${text}`,
    context: change ? buildChangeContext(change) : state.context ?? {},
  });
  writeRunEvent('decision', decision);
  console.log(`Decision recorded: ${text}`);
}

function runLogCommand(options: { limit?: string } = {}) {
  const limit = Number(options.limit ?? 10);
  const runsDir = resolvePath('harness', 'runs');
  if (!fs.existsSync(runsDir)) {
    console.log('No run log directory found.');
    return;
  }
  const files = fs
    .readdirSync(runsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .slice(-limit);
  if (!files.length) {
    console.log('No run events recorded.');
    return;
  }
  for (const file of files) {
    const event = JSON.parse(fs.readFileSync(path.join(runsDir, file), 'utf8'));
    console.log(`${event.createdAt} ${event.kind} ${event.activeChange ?? ''} ${event.status ?? ''}`.trim());
  }
}

function taskBoardCommand(changeInput?: string) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const board = syncTaskBoard(change);
  console.log(`Task board: ${taskBoardPath(change)}`);
  console.log(`Summary: ${taskSummary(board)}`);
  for (const task of board.tasks) {
    const owner = task.owner ? ` owner=${task.owner}` : '';
    const blockedBy = task.blockedBy ? ` blockedBy=${task.blockedBy}` : '';
    console.log(`${task.id} [${task.status}] ${task.title}${owner}${blockedBy}`);
  }
}

function taskNextCommand(changeInput?: string) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  const board = syncTaskBoard(change);
  const task = board.tasks.find((item) => item.status === 'doing')
    ?? board.tasks.find((item) => item.status === 'todo')
    ?? board.tasks.find((item) => item.status === 'blocked');
  if (!task) {
    console.log(`No remaining task for ${change}.`);
    return;
  }
  console.log(`/ai:apply ${change}`);
  console.log(`Next task: ${task.id} [${task.status}] ${task.title}`);
  if (task.blockedBy) console.log(`Blocked by: ${task.blockedBy}`);
}

function updateTaskCommand(
  action: HarnessTaskStatus,
  taskId: string,
  options: { change?: string; owner?: string; reason?: string } = {},
) {
  const change = getChangeName(options.change);
  if (!change) throw new Error('Change name is required.');
  if (options.change) setCurrentChange(change);
  const board = syncTaskBoard(change);
  const task = findTask(board, taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const now = new Date().toISOString();
  task.status = action;
  task.updatedAt = now;
  if (action === 'doing') {
    task.owner = options.owner ?? task.owner ?? 'ai';
    task.blockedBy = null;
    updateMarkdownTaskCheck(change, task, false);
  }
  if (action === 'done') {
    task.owner = options.owner ?? task.owner ?? 'ai';
    task.blockedBy = null;
    task.checked = true;
    updateMarkdownTaskCheck(change, task, true);
  }
  if (action === 'blocked') {
    task.owner = options.owner ?? task.owner ?? 'ai';
    task.blockedBy = options.reason ?? 'No reason provided.';
    updateMarkdownTaskCheck(change, task, false);
  }
  saveTaskBoard(board);
  updateHarnessState({
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

function agentRunCommand(changeInput?: string, options: { claim?: boolean; mode?: string } = {}) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const board = syncTaskBoard(change);
  const task = selectNextTask(board);
  const mode = options.mode ?? (options.claim ? 'claim' : 'prompt');

  if (task && options.claim && task.status === 'todo') {
    task.status = 'doing';
    task.owner = 'ai';
    task.updatedAt = new Date().toISOString();
    saveTaskBoard(board);
  }

  const prompt = buildAgentPrompt(change, task, mode);
  const promptPath = writeTimestampedMarkdown('harness/prompts', `${change}-agent-run`, prompt);
  updateHarnessState({
    activeChange: change,
    activeFlow: 'apply',
    status: task ? 'in_progress' : 'accepted',
    phase: task ? 'implementation' : 'finishing',
    lastStep: task ? `Agent run prepared for ${task.id}: ${task.title}` : 'Agent run found no remaining task',
    nextStep: task?.title ?? null,
    nextSuggestedFlow: task ? 'apply' : 'finish',
    blockedBy: task?.status === 'blocked' && task.blockedBy ? [task.blockedBy] : [],
    context: buildChangeContext(change),
  });
  writeRunEvent('agent-run', {
    change,
    mode,
    promptPath,
    task: task ?? null,
    summary: taskSummary(board),
  });
  console.log(`Agent prompt generated: ${promptPath}`);
  console.log(`Summary: ${taskSummary(board)}`);
  if (task) {
    console.log(`Next task: ${task.id} [${task.status}] ${task.title}`);
    console.log('');
    console.log(prompt);
  } else {
    console.log(`No remaining task for ${change}.`);
  }
}

function agentFinishCommand(changeInput?: string, options: { check?: boolean; strict?: boolean } = {}) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const board = syncTaskBoard(change);
  const remainingTasks = board.tasks.filter((task) => task.status === 'todo' || task.status === 'doing');
  const blockedTasks = board.tasks.filter((task) => task.status === 'blocked');
  const uncheckedAcceptance = collectUncheckedAcceptance(change);

  const results: HarnessResult[] = [];
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

  let status: HarnessStatus = 'accepted';
  const blockedBy: string[] = [];
  if (validation.status === 'failed') {
    status = 'blocked';
    blockedBy.push(...validation.errors);
  }
  if (blockedTasks.length) {
    status = 'blocked';
    blockedBy.push(...blockedTasks.map((task) => `${task.id}: ${task.blockedBy ?? task.title}`));
  }
  if (status !== 'blocked' && (remainingTasks.length || uncheckedAcceptance.length)) {
    status = 'partially_accepted';
  }
  if (status !== 'blocked' && results.some((item) => item.status === 'failed')) {
    status = 'blocked';
    blockedBy.push(...results.filter((item) => item.status === 'failed').map((item) => item.reason ?? item.command));
  }

  const reportStatus = status === 'blocked' ? 'failed' : 'passed';
  writeReport(change, results, reportStatus);
  const stateAfterReport = loadHarnessState();
  const remaining = [
    ...remainingTasks.map((task) => `${task.id}: ${task.title}`),
    ...uncheckedAcceptance.map((item) => `acceptance: ${item.replace(/^\s*-\s\[\s\]\s+/, '')}`),
  ];
  updateHarnessState({
    activeChange: change,
    activeFlow: 'finish',
    status,
    phase: status === 'blocked' ? 'blocked' : 'finishing',
    lastStep: `Agent finish evaluated as ${status}`,
    nextStep: status === 'accepted' ? null : 'Resolve remaining tasks or acceptance items',
    lastReport: stateAfterReport.lastReport ?? null,
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
  if (remaining.length) console.log(`Remaining:\n${remaining.map((item) => `- ${item}`).join('\n')}`);
  if (blockedBy.length) console.log(`Blocked by:\n${blockedBy.map((item) => `- ${item}`).join('\n')}`);
  if (remainingTasks.length) {
    const firstTask = remainingTasks[0];
    console.log('');
    console.log('Next suggested commands:');
    console.log(`pnpm ai agent-run ${change} --claim`);
    console.log(`pnpm ai task-done ${firstTask.id} --change ${change}`);
    console.log(`pnpm ai agent-finish ${change} --check`);
  } else if (uncheckedAcceptance.length) {
    console.log('');
    console.log('Next suggested commands:');
    console.log(`Review openspec/changes/${change}/acceptance.md`);
    console.log(`pnpm ai agent-finish ${change} --check`);
  } else if (status === 'accepted') {
    console.log('');
    console.log('Next suggested command: ready for review.');
  }
  if (status !== 'accepted') process.exitCode = 1;
}

function checkWritable(relativePath: string) {
  const filePath = resolvePath(relativePath);
  try {
    if (fs.existsSync(filePath)) {
      const handle = fs.openSync(filePath, 'r+');
      fs.closeSync(handle);
    } else {
      fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
    }
    return { status: 'passed' as const };
  } catch (error) {
    return { status: 'failed' as const, reason: (error as Error).message };
  }
}

function isActiveCodexSkillLock(relativePath: string, reason?: string) {
  return process.platform === 'win32'
    && relativePath.startsWith('.codex/skills/')
    && relativePath.endsWith('/SKILL.md')
    && Boolean(reason?.includes('EPERM'));
}

function doctorCommand(options: { strict?: boolean; encoding?: boolean } = {}) {
  const checks: HarnessResult[] = [];
  const startedAt = Date.now();

  const pushCheck = (command: string, passed: boolean, reason?: string, started = Date.now()) => {
    checks.push({
      command,
      status: passed ? 'passed' : 'failed',
      exitCode: passed ? 0 : 1,
      durationMs: Date.now() - started,
      reason,
    });
  };

  pushCheck('node', /^v?(\d+)\./.test(process.version), `version ${process.version}`, startedAt);
  const hasTsNode = exists('node_modules/ts-node/register/transpile-only.js');
  pushCheck('ts-node/register/transpile-only', hasTsNode, hasTsNode ? undefined : 'Missing local ts-node dependency.');
  const hasLauncher = exists('scripts/ai/run-ai.cjs');
  pushCheck('scripts/ai/run-ai.cjs', hasLauncher, hasLauncher ? undefined : 'Missing stable AI launcher.');
  const hasConfig = exists('harness/config.json');
  pushCheck('harness/config.json', hasConfig, hasConfig ? undefined : 'Missing harness config.');
  const hasState = exists('harness/state.json');
  pushCheck('harness/state.json', hasState, hasState ? undefined : 'Missing harness state.');

  const configStartedAt = Date.now();
  try {
    loadHarnessConfig();
    pushCheck('parse harness/config.json', true, undefined, configStartedAt);
  } catch (error) {
    pushCheck('parse harness/config.json', false, (error as Error).message, configStartedAt);
  }

  const validationStartedAt = Date.now();
  const validation = validateCommand(undefined, { quiet: true });
  pushCheck('ai validate', validation.status === 'passed', validation.errors.join('; ') || undefined, validationStartedAt);

  const knowledgeStartedAt = Date.now();
  try {
    const stats = buildKnowledgeIndex();
    pushCheck('knowledge index', true, `records ${stats.total}`, knowledgeStartedAt);
  } catch (error) {
    pushCheck('knowledge index', false, (error as Error).message, knowledgeStartedAt);
  }

  for (const name of integrationNames) {
    const integrationStartedAt = Date.now();
    const config = loadIntegrationConfig(name);
    const health = inspectIntegrationHealth(name, config);
    const requiresOfficial = config.mode === 'official' || config.mode === 'hybrid';
    const passed = !requiresOfficial || health.usable;
    const reason = `${config.mode}; health=${health.health}; official ${config.officialInstalled ? 'installed' : 'not installed'}; ${health.reason}`;
    pushCheck(`integration ${name}`, passed, reason, integrationStartedAt);
  }

  const config = loadHarnessConfig();
  const tools = (config.tools || defaultTools) as ToolName[];
  for (const tool of tools) {
    for (const file of listTargetFiles(tool)) {
      const writable = checkWritable(file);
      const codexLock = writable.status === 'failed' && isActiveCodexSkillLock(file, writable.reason);
      pushCheck(
        `writable ${file}`,
        writable.status === 'passed' || codexLock,
        codexLock ? 'Locked by the active Codex session; use pnpm ai sync --skip codex if needed.' : writable.reason,
      );
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

const program = new Command();

program.name('msgfi-ai').description('MsgFi AI Engineering Kit');

program
  .command('init')
  .argument('[tools...]', 'Optional AI tools to initialize, e.g. codex cursor')
  .option('--tools <tools>', 'Comma-separated AI tools', defaultTools.join(','))
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
    if (result.status === 'failed') process.exitCode = 1;
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
  .option('--task <task>', 'Append an unchecked follow-up task', (value, previous: string[] = []) => previous.concat(value), [])
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
      const result = archiveChange(change);
      console.log(JSON.stringify({
        status: 'archived',
        change,
        archivedAt: result.archivedAt,
        target: result.targetDir,
      }, null, 2));
    } catch (error) {
      console.error(JSON.stringify({
        status: 'error',
        change,
        error: (error as Error).message,
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
      const result = restoreChange(change);
      console.log(JSON.stringify({
        status: 'restored',
        change,
        restoredAt: result.restoredAt,
        target: result.targetDir,
      }, null, 2));
    } catch (error) {
      console.error(JSON.stringify({
        status: 'error',
        change,
        error: (error as Error).message,
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
      const result = deleteArchivedChange(change);
      console.log(JSON.stringify({
        status: 'deleted',
        change,
        deletedAt: result.deletedAt,
      }, null, 2));
    } catch (error) {
      console.error(JSON.stringify({
        status: 'error',
        change,
        error: (error as Error).message,
      }, null, 2));
      process.exitCode = 1;
    }
  });

program
  .command('archive:list')
  .description('List all active and archived changes')
  .action(() => {
    const active = listChanges();
    const archived = listArchivedChanges();
    console.log(JSON.stringify({
      active: active.length,
      archived: archived.length,
      changes: [...active, ...archived],
    }, null, 2));
  });

program.parse(process.argv);
