import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { HarnessTaskBoard, HarnessTask, HarnessTaskStatus, KnowledgeRecord } from '../types';
import {
  root,
  coreFiles,
  dispatcherFlow,
  flowNames,
  skillFiles,
  textFilesToCheck,
  resolvePath,
  exists,
  ensureDir,
  writeGeneratedFile,
  readText,
  quoteShellArg,
  timestampForFile,
  hasMojibake,
  uniqueValues,
} from '../lib/utils';
import { loadHarnessConfig, saveHarnessConfig, loadHarnessState } from '../lib/state';

export function setCurrentChange(change: string) {
  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: change,
    tools: config.tools ?? ['codex', 'trae', 'qoder', 'cursor'],
    checks: config.checks ?? ['ai:validate', 'ai:report'],
    strictChecks: config.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
  });
}

export function buildChangeContext(change: string) {
  return {
    proposal: `openspec/changes/${change}/proposal.md`,
    tasks: `openspec/changes/${change}/tasks.md`,
    acceptance: `openspec/changes/${change}/acceptance.md`,
    notes: `openspec/changes/${change}/notes.md`,
  };
}

export function writeRunEvent(kind: string, payload: Record<string, unknown>) {
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
  writeGeneratedFile(
    `harness/runs/${timestampForFile(new Date(createdAt))}-${kind}.json`,
    `${JSON.stringify(event, null, 2)}\n`,
  );
  return event;
}

export function taskBoardPath(change: string) {
  return `harness/tasks/${change}.json`;
}

export function loadTaskBoard(change: string): HarnessTaskBoard | null {
  const filePath = resolvePath(taskBoardPath(change));
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function saveTaskBoard(board: HarnessTaskBoard) {
  ensureDir('harness', 'tasks');
  writeGeneratedFile(taskBoardPath(board.change), `${JSON.stringify(board, null, 2)}\n`);
}

export function parseMarkdownTasks(change: string) {
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

export function syncTaskBoard(change: string) {
  const now = new Date().toISOString();
  const previous = loadTaskBoard(change);
  const previousByTitle = new Map((previous?.tasks ?? []).map((task) => [task.title, task]));
  const tasks = parseMarkdownTasks(change).map((task, index) => {
    const existing = previousByTitle.get(task.title);
    return {
      id: existing?.id ?? `T${String(index + 1).padStart(3, '0')}`,
      title: task.title,
      status: task.checked ? 'done' : (existing?.status ?? 'todo'),
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

export function findTask(board: HarnessTaskBoard, taskId: string) {
  const normalized = taskId.trim().toLowerCase();
  return (
    board.tasks.find((task) => task.id.toLowerCase() === normalized) ??
    board.tasks.find((task) => task.id.toLowerCase() === `t${normalized.padStart(3, '0')}`) ??
    board.tasks.find((task) => task.title.toLowerCase().includes(normalized))
  );
}

export function updateMarkdownTaskCheck(change: string, task: HarnessTask, checked: boolean) {
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return;
  const lines = fs.readFileSync(tasksPath, 'utf8').split(/\r?\n/);
  const index = task.sourceLine - 1;
  if (!lines[index]) return;
  lines[index] = lines[index].replace(/-\s\[( |x|X)\]/, checked ? '- [x]' : '- [ ]');
  fs.writeFileSync(tasksPath, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}

export function taskSummary(board: HarnessTaskBoard) {
  const counts = board.tasks.reduce(
    (acc, task) => {
      acc[task.status] += 1;
      return acc;
    },
    { todo: 0, doing: 0, done: 0, blocked: 0 } as Record<HarnessTaskStatus, number>,
  );
  return `todo=${counts.todo} doing=${counts.doing} done=${counts.done} blocked=${counts.blocked}`;
}

export function selectNextTask(board: HarnessTaskBoard) {
  return (
    board.tasks.find((item) => item.status === 'doing') ??
    board.tasks.find((item) => item.status === 'todo') ??
    board.tasks.find((item) => item.status === 'blocked') ??
    null
  );
}

export function buildAgentPrompt(change: string, task: HarnessTask | null, mode: string) {
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

export function getChangeName(input?: string): string | null {
  if (input) return input;
  const config = loadHarnessConfig();
  return typeof config.currentChange === 'string' ? config.currentChange : null;
}

export function collectCoreSummary() {
  return coreFiles.map((file) => `- .ai/core/${file}`).join('\n');
}

export function collectFlowSummary() {
  return [
    `- /ai: .ai/flows/${dispatcherFlow}.md`,
    ...flowNames.map((flow) => `- /ai:${flow}: .ai/flows/${flow}.md`),
  ].join('\n');
}

export function collectSkillSummary() {
  return skillFiles.map((file) => `- superpowers/skills/${file}`).join('\n');
}

export function buildRulesDocument(tool: string) {
  return `# MsgFi AI Rules for ${tool}\n\n<!-- Generated by pnpm ai sync. Edit .ai/core, .ai/flows, and superpowers/skills instead. -->\n\n## Required Workflow\n\n1. Read .ai/core/workflow.md before starting AI-assisted work.\n2. For normal guided work, accept /ai <change> and dispatch to the next suitable flow.\n3. Read the active change under openspec/changes/<change>.\n4. Use the relevant /ai flow.\n5. Search Knowledge Memory with pnpm ai knowledge:search before propose/plan/apply when relevant.\n6. Keep edits scoped to the active change.\n7. Run pnpm ai check before finishing.\n\n## Integration Modes\n\n- lightweight: use MsgFi built-in compatible rules.\n- official: prefer repo-local official integration only when installed; never use global installs implicitly.\n- hybrid: combine MsgFi rules with repo-local official integration when installed.\n\n## Knowledge Memory\n\n- Use pnpm ai knowledge:search <keywords> --limit 10.\n- Read only returned summaries, not the full harness/memory/knowledge JSONL files.\n- During finish, run pnpm ai knowledge:suggest <change> --write when tool access is available.\n- Add only confirmed reusable knowledge during finish with pnpm ai knowledge:add.\n- Final reports must say what Knowledge Memory was searched, suggested, added, or why it was skipped.\n\n## Core Rules\n\n${collectCoreSummary()}\n\n## Conversation Flows\n\n${collectFlowSummary()}\n\n## Skills\n\n${collectSkillSummary()}\n`;
}

export function buildDispatcherDocument() {
  const flowText = readText(`.ai/flows/${dispatcherFlow}.md`);
  return `# /ai\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${dispatcherFlow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- harness/state.json when present\n- openspec/changes/<change>/proposal.md when present\n- openspec/changes/<change>/tasks.md when present\n- openspec/changes/<change>/acceptance.md when present\n\nUse the specific /ai:* flow selected by the dispatcher.\n`;
}

export function buildCommandDocument(flow: string) {
  const flowText = readText(`.ai/flows/${flow}.md`);
  return `# /ai:${flow}\n\n<!-- Generated by pnpm ai sync. Edit .ai/flows/${flow}.md instead. -->\n\n${flowText}\n\n## Shared Context\n\nBefore acting, read:\n\n- .ai/core/workflow.md\n- openspec/changes/<change>/proposal.md\n- openspec/changes/<change>/tasks.md\n- openspec/changes/<change>/acceptance.md\n\nFinish with \`pnpm ai check\` when the flow changes code.\n`;
}

export function prompt(question: string): Promise<string> {
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

export function collectEncodingIssues(change?: string) {
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

export function readChangeText(change: string) {
  return textFilesToCheck
    .map((file) => {
      const relativePath = `openspec/changes/${change}/${file}`;
      return exists(relativePath) ? `\n# ${file}\n${readText(relativePath)}` : '';
    })
    .join('\n');
}

export function collectChangedFilesForKnowledge() {
  const result = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${root.replace(/\\/g, '/')}`,
      'status',
      '--short',
      '--',
      'apps',
      'packages',
    ],
    {
      cwd: root,
      shell: false,
      encoding: 'utf8',
    },
  );
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

export function extractKnowledgeNames(text: string) {
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
      const score = (value: string) =>
        (value.includes('.') ? 3 : 0) +
        (/[A-Z_]/.test(value) ? 2 : 0) +
        (value.length > 12 ? 1 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    })
    .slice(0, 8);
}

export function extractReferencedFiles(text: string) {
  const matches = text.match(/\b(?:apps|packages)\/[^\s)`"'，。；,]+/g) ?? [];
  return uniqueValues(
    matches.map((item) => item.replace(/[:：]\d+$/, '').replace(/[.,;，。；]+$/, '')),
  );
}

export function buildKnowledgeAddCommand(record: Partial<KnowledgeRecord>) {
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

export function checkWritable(relativePath: string) {
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

export function isActiveCodexSkillLock(relativePath: string, reason?: string) {
  return (
    process.platform === 'win32' &&
    relativePath.startsWith('.codex/skills/') &&
    relativePath.endsWith('/SKILL.md') &&
    Boolean(reason?.includes('EPERM'))
  );
}
