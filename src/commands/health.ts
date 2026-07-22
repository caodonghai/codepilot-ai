import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import type { HarnessResult } from '../types';
import { resolvePath } from '../utils/file';
import { loadHarnessConfig, loadHarnessState } from '../lib/state';
import { getChangeName, setCurrentChange } from '../lib/state';
import { buildChangeContext } from '../lib/state';
import { collectEncodingIssues } from '../utils/encoding';

export function registerHealthCommands(program: Command) {
  program.command('status').description('Show current harness state').action(statusCommand);

  program
    .command('current')
    .description('Show or set current change')
    .argument('[change]', 'Change name')
    .action(currentCommand);

  program.command('resume').description('Resume the active change').action(resumeCommand);

  program
    .command('verify')
    .description('Mark change as verified')
    .argument('[change]', 'Change name')
    .option('--status <status>', 'Verification status')
    .option('--task <task...>', 'Append verification tasks')
    .action(verifyCommand);

  program
    .command('finish-state')
    .description('Evaluate finish state')
    .argument('[change]', 'Change name')
    .action(finishStateCommand);

  program
    .command('step <note>')
    .description('Record a step in the harness')
    .option('--change <change>', 'Change name')
    .option('--flow <flow>', 'Flow name')
    .option('--status <status>', 'Harness status')
    .option('--next <next>', 'Next step')
    .action(stepCommand);

  program
    .command('decision <text>')
    .description('Record a decision')
    .option('--change <change>', 'Change name')
    .option('--flow <flow>', 'Flow name')
    .action(decisionCommand);

  program
    .command('run-log')
    .description('Show recent run events')
    .option('--limit <limit>', 'Number of events', '10')
    .action(runLogCommand);

  program
    .command('doctor')
    .description('Diagnose setup issues')
    .option('--strict', 'Include optional checks')
    .option('--encoding', 'Check encoding')
    .action(doctorCommand);
}

function statusCommand() {
  const state = loadHarnessState();
  console.log(JSON.stringify(state, null, 2));
}

function currentCommand(changeInput?: string) {
  if (changeInput) {
    const change = changeInput.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
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
  console.log(
    JSON.stringify(
      {
        currentChange: config.currentChange ?? null,
        activeChange: state.activeChange ?? null,
        activeFlow: state.activeFlow ?? null,
        status: state.status ?? null,
        phase: state.phase ?? null,
        lastReport: state.lastReport ?? null,
      },
      null,
      2,
    ),
  );
}

function collectUncheckedTasks(change: string) {
  const tasksPath = resolvePath('openspec', 'changes', change, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return [];
  return fs
    .readFileSync(tasksPath, 'utf8')
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
    lines.push(
      '',
      'Unfinished tasks:',
      ...uncheckedTasks.map((task) => `- ${task.replace(/^\s*-\s\[\s\]\s+/, '')}`),
    );
  }
  if (decisions.length) {
    lines.push(
      '',
      'Recorded decisions:',
      ...decisions.map((item: { text: string }) => `- ${item.text ?? String(item)}`),
    );
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

function verifyCommand(
  changeInput?: string,
  options: { status?: string; task?: string | string[] } = {},
) {
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
  writeRunEvent('verify-state', {
    change,
    status,
    appendedTasks: parseTasks(options.task),
    uncheckedTasks,
  });
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
  const status = uncheckedTasks.length ? 'partially_accepted' : 'accepted';
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

function stepCommand(
  note: string,
  options: { change?: string; flow?: string; status?: string; next?: string } = {},
) {
  const change = getChangeName(options.change);
  const flow = options.flow ?? loadHarnessState().activeFlow ?? null;
  updateHarnessState({
    activeChange: change,
    activeFlow: flow,
    status: options.status ?? 'in_progress',
    phase: flow
      ? flow === 'explore'
        ? 'exploration'
        : flow === 'propose'
          ? 'proposal'
          : flow === 'plan'
            ? 'planning'
            : flow === 'apply'
              ? 'implementation'
              : flow === 'verify'
                ? 'verification'
                : flow === 'review'
                  ? 'verification'
                  : flow === 'finish'
                    ? 'finishing'
                    : 'implementation'
      : (loadHarnessState().phase ?? 'implementation'),
    lastStep: note,
    nextStep: options.next ?? loadHarnessState().nextStep ?? null,
    nextSuggestedFlow: flow ?? loadHarnessState().nextSuggestedFlow ?? null,
    context: change ? buildChangeContext(change) : (loadHarnessState().context ?? {}),
  });
  writeRunEvent('step', { change, flow, note, nextStep: options.next ?? null });
  console.log(`Step recorded: ${note}`);
}

function decisionCommand(text: string, options: { change?: string; flow?: string } = {}) {
  const state = loadHarnessState();
  const change = getChangeName(options.change);
  const decision = {
    text,
    createdAt: new Date().toISOString(),
    change: change ?? null,
    flow: options.flow ?? state.activeFlow ?? null,
  };
  const decisions = Array.isArray(state.decisions) ? state.decisions.concat(decision) : [decision];
  updateHarnessState({
    activeChange: change ?? state.activeChange ?? null,
    activeFlow: options.flow ?? state.activeFlow ?? null,
    decisions,
    lastStep: `Decision recorded: ${text}`,
    context: change ? buildChangeContext(change) : (state.context ?? {}),
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
    const event = JSON.parse(fs.readFileSync(resolvePath('harness', 'runs', file), 'utf8'));
    console.log(
      `${event.createdAt} ${event.kind} ${event.activeChange ?? ''} ${event.status ?? ''}`.trim(),
    );
  }
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
  const hasTsNode = fs.existsSync(resolvePath('node_modules/ts-node/register/transpile-only.js'));
  pushCheck(
    'ts-node/register/transpile-only',
    hasTsNode,
    hasTsNode ? undefined : 'Missing local ts-node dependency.',
  );

  const packageJsonPath = resolvePath('package.json');
  pushCheck(
    'package.json',
    fs.existsSync(packageJsonPath),
    fs.existsSync(packageJsonPath) ? undefined : 'Missing package.json.',
  );

  const aiScriptExists = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts?.ai === 'codepilot'
    : false;
  pushCheck(
    'package.json scripts.ai',
    aiScriptExists,
    aiScriptExists ? undefined : 'scripts.ai is not set to "codepilot".',
  );

  const harnessConfigExists = fs.existsSync(resolvePath('harness', 'config.json'));
  pushCheck(
    'harness/config.json',
    harnessConfigExists,
    harnessConfigExists ? undefined : 'Missing harness/config.json.',
  );

  const harnessStateExists = fs.existsSync(resolvePath('harness', 'state.json'));
  pushCheck(
    'harness/state.json',
    harnessStateExists,
    harnessStateExists ? undefined : 'Missing harness/state.json.',
  );

  const openspecExists = fs.existsSync(resolvePath('openspec'));
  pushCheck(
    'openspec/',
    openspecExists,
    openspecExists ? undefined : 'Missing openspec/ directory.',
  );

  const aiCoreExists = fs.existsSync(resolvePath('.ai', 'core'));
  pushCheck('.ai/core/', aiCoreExists, aiCoreExists ? undefined : 'Missing .ai/core/ directory.');

  if (options.strict) {
    const hasEslint = fs.existsSync(resolvePath('node_modules', 'eslint'));
    pushCheck('eslint', hasEslint, hasEslint ? undefined : 'Missing eslint dependency.');

    const hasPrettier = fs.existsSync(resolvePath('node_modules', 'prettier'));
    pushCheck('prettier', hasPrettier, hasPrettier ? undefined : 'Missing prettier dependency.');
  }

  if (options.encoding) {
    const encodingIssues = collectEncodingIssues();
    pushCheck(
      'encoding',
      encodingIssues.length === 0,
      encodingIssues.length === 0 ? undefined : `Found ${encodingIssues.length} encoding issues.`,
    );
  }

  const finalStatus = checks.every((item) => item.status === 'passed') ? 'passed' : 'failed';
  console.log(
    JSON.stringify(
      {
        status: finalStatus,
        checks,
        durationMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
  if (finalStatus === 'failed') process.exitCode = 1;
}

function updateHarnessState(state: Record<string, unknown>) {
  const current = loadHarnessState();
  const merged = { ...current, ...state };
  ensureDir('harness');
  writeGeneratedFile('harness/state.json', `${JSON.stringify(merged, null, 2)}\n`);
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
  writeGeneratedFile(
    `harness/runs/${createdAt.replace(/[:.]/g, '-')}-${kind}.json`,
    `${JSON.stringify(event, null, 2)}\n`,
  );
  return event;
}

function ensureDir(...segments: string[]) {
  fs.mkdirSync(resolvePath(...segments), { recursive: true });
}

function writeGeneratedFile(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
