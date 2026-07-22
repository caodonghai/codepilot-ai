import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { HarnessResult, HarnessStatus, HarnessTaskStatus } from '../types';
import {
  defaultTools,
  coreFiles,
  flowNames,
  skillFiles,
  requiredChangeFiles,
  textFilesToCheck,
  root,
  resolvePath,
  exists,
  ensureDir,
  writeFileIfMissing,
  writeGeneratedFile,
  readText,
  kebabName,
  parseChangeType,
  hasMojibake,
  fixMojibakeText,
} from '../lib/utils';
import {
  loadHarnessConfig,
  saveHarnessConfig,
  loadHarnessState,
  updateHarnessState,
} from '../lib/state';
import { templateChangeFile, listTargetFiles } from './templates';
import {
  setCurrentChange,
  buildChangeContext,
  writeRunEvent,
  syncTaskBoard,
  findTask,
  updateMarkdownTaskCheck,
  taskSummary,
  selectNextTask,
  buildAgentPrompt,
  getChangeName,
  prompt,
  collectEncodingIssues,
} from './helpers';

export function registerChangeCommands(program: Command) {
  program
    .command('new <change>')
    .description('Create a new OpenSpec change')
    .option('--type <type>', 'Change type', 'default')
    .option('--interactive', 'Interactive mode')
    .action(newCommand);

  program
    .command('encoding')
    .description('Check for encoding issues in change documents')
    .argument('[change]', 'Change name')
    .option('--fix', 'Attempt to fix mojibake')
    .action(encodingCommand);

  program
    .command('validate')
    .description('Validate AI harness and change files')
    .argument('[change]', 'Change name')
    .option('--quiet', 'Suppress success output')
    .action((change, options) => {
      const result = validateCommand(change, options);
      if (result.status === 'failed') process.exitCode = 1;
    });

  program
    .command('check')
    .description('Run validation and checks')
    .argument('[change]', 'Change name')
    .option('--strict', 'Include ESLint')
    .option('--no-eslint', 'Skip ESLint')
    .action(checkCommand);

  program
    .command('report')
    .description('Generate a harness report')
    .argument('[change]', 'Change name')
    .action(reportCommand);

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
    .command('task-board')
    .description('Show task board')
    .argument('[change]', 'Change name')
    .action(taskBoardCommand);

  program
    .command('task-next')
    .description('Show next task')
    .argument('[change]', 'Change name')
    .action(taskNextCommand);

  program
    .command('task-done <task>')
    .description('Mark task as done')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner')
    .action((task, options) => updateTaskCommand('done', task, options));

  program
    .command('task-doing <task>')
    .description('Mark task as in progress')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner')
    .action((task, options) => updateTaskCommand('doing', task, options));

  program
    .command('task-block <task>')
    .description('Mark task as blocked')
    .option('--change <change>', 'Change name')
    .option('--owner <owner>', 'Task owner')
    .option('--reason <reason>', 'Block reason')
    .action((task, options) => updateTaskCommand('blocked', task, options));

  program
    .command('agent-run')
    .description('Prepare agent run')
    .argument('[change]', 'Change name')
    .option('--claim', 'Claim next task')
    .option('--mode <mode>', 'Run mode', 'prompt')
    .action(agentRunCommand);

  program
    .command('agent-finish')
    .description('Finish agent work')
    .argument('[change]', 'Change name')
    .option('--check', 'Run checks')
    .option('--strict', 'Run strict checks')
    .action(agentFinishCommand);

  program
    .command('doctor')
    .description('Diagnose setup issues')
    .option('--strict', 'Include optional checks')
    .option('--encoding', 'Check encoding')
    .action(doctorCommand);
}

async function newCommand(
  changeInput: string | undefined,
  options: { type?: string; interactive?: boolean } = {},
) {
  let change = changeInput ? kebabName(changeInput) : '';
  let type = parseChangeType(options.type);

  if (options.interactive) {
    change = kebabName(await prompt('Enter change name: '));
    while (!change) {
      change = kebabName(await prompt('Change name is required. Enter change name: '));
    }
    type = parseChangeType(
      (await prompt('Select change type (default/bugfix/feature/ui-change/refactor): ')) ||
        'default',
    );
  }

  if (!change) {
    throw new Error('Change name is required.');
  }

  for (const file of [...requiredChangeFiles, 'notes.md']) {
    writeFileIfMissing(
      `openspec/changes/${change}/${file}`,
      templateChangeFile(change, file, type),
    );
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

function encodingCommand(changeInput?: string, options: { fix?: boolean } = {}) {
  const change = getChangeName(changeInput) ?? undefined;
  const issues = collectEncodingIssues(change);
  if (!issues.length) {
    console.log(
      change
        ? `No mojibake detected for change: ${change}`
        : 'No mojibake detected in OpenSpec change documents.',
    );
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
  if (unchanged.length)
    console.log(`Could not safely fix:\n${unchanged.map((item) => `- ${item}`).join('\n')}`);
  if (unchanged.length) process.exitCode = 1;
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
        errors.push(
          `Possible mojibake detected in ${relativePath}. Ensure UTF-8 output in Windows/Codex/PowerShell.`,
        );
      }
    }
  }

  const config = loadHarnessConfig();
  const tools = (config.tools || defaultTools) as string[];
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

function writeReport(
  changeInput: string | undefined,
  results: HarnessResult[],
  status?: 'passed' | 'failed',
) {
  const config = loadHarnessConfig();
  const change = getChangeName(changeInput);
  if (changeInput && change) {
    setCurrentChange(change);
  }
  const finalStatus =
    status ?? (results.every((item) => item.status === 'passed') ? 'passed' : 'failed');
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

  writeGeneratedFile(
    `harness/reports/${fileTimestamp}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  updateHarnessState({
    activeChange: change ?? null,
    status: finalStatus === 'passed' ? 'accepted' : 'blocked',
    phase: finalStatus === 'passed' ? 'finishing' : 'blocked',
    lastStep: `Generated report harness/reports/${fileTimestamp}.json`,
    lastReport: `harness/reports/${fileTimestamp}.json`,
    nextSuggestedFlow: finalStatus === 'passed' ? 'finish' : 'verify',
    blockedBy:
      finalStatus === 'passed'
        ? []
        : results.filter((item) => item.status === 'failed').map((item) => item.command),
    context: change ? buildChangeContext(change) : {},
  });
  writeRunEvent('report', {
    change,
    status: finalStatus,
    reportPath: `harness/reports/${fileTimestamp}.json`,
    results,
  });
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

function checkCommand(
  changeInput?: string,
  options: { strict?: boolean; noEslint?: boolean } = {},
) {
  const results: HarnessResult[] = [];

  if (!options.noEslint && options.strict) {
    results.push(runEslintCommand());
  }

  const startedAt = Date.now();
  const validation = validateCommand(changeInput, { quiet: true });
  if (validation.status === 'failed') {
    console.error(
      `AI validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`,
    );
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
  options: { status?: HarnessStatus; task?: string | string[] } = {},
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

function stepCommand(
  note: string,
  options: { change?: string; flow?: string; status?: HarnessStatus; next?: string } = {},
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
    const event = JSON.parse(fs.readFileSync(path.join(runsDir, file), 'utf8'));
    console.log(
      `${event.createdAt} ${event.kind} ${event.activeChange ?? ''} ${event.status ?? ''}`.trim(),
    );
  }
}

function taskBoardCommand(changeInput?: string) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const board = syncTaskBoard(change);
  console.log(`Task board: harness/tasks/${change}.json`);
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
  const task =
    board.tasks.find((item) => item.status === 'doing') ??
    board.tasks.find((item) => item.status === 'todo') ??
    board.tasks.find((item) => item.status === 'blocked');
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
  fs.writeFileSync(
    resolvePath(`harness/tasks/${change}.json`),
    `${JSON.stringify(board, null, 2)}\n`,
  );
  updateHarnessState({
    activeChange: change,
    activeFlow: action === 'done' ? 'verify' : 'apply',
    status: action === 'blocked' ? 'blocked' : 'in_progress',
    phase: action === 'done' ? 'verification' : action === 'blocked' ? 'blocked' : 'implementation',
    lastStep: `Task ${task.id} marked ${action}: ${task.title}`,
    nextStep:
      action === 'done' ? 'Continue the next task or verify acceptance criteria' : task.title,
    nextSuggestedFlow: action === 'done' ? 'verify' : 'apply',
    blockedBy: action === 'blocked' ? [task.blockedBy] : [],
    context: buildChangeContext(change),
  });
  writeRunEvent(`task-${action}`, { change, task });
  console.log(`Task ${task.id} marked ${action}: ${task.title}`);
}

function writeTimestampedMarkdown(directory: string, basename: string, content: string) {
  const createdAt = new Date().toISOString();
  const filePath = `${directory}/${createdAt.replace(/[:.]/g, '-')}-${basename}.md`;
  ensureDir(...directory.split('/'));
  writeGeneratedFile(filePath, content);
  return filePath;
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
    fs.writeFileSync(
      resolvePath(`harness/tasks/${change}.json`),
      `${JSON.stringify(board, null, 2)}\n`,
    );
  }

  const agentPrompt = buildAgentPrompt(change, task, mode);
  const promptPath = writeTimestampedMarkdown(
    'harness/prompts',
    `${change}-agent-run`,
    agentPrompt,
  );
  updateHarnessState({
    activeChange: change,
    activeFlow: 'apply',
    status: task ? 'in_progress' : 'accepted',
    phase: task ? 'implementation' : 'finishing',
    lastStep: task
      ? `Agent run prepared for ${task.id}: ${task.title}`
      : 'Agent run found no remaining task',
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
    console.log(agentPrompt);
  } else {
    console.log(`No remaining task for ${change}.`);
  }
}

function agentFinishCommand(
  changeInput?: string,
  options: { check?: boolean; strict?: boolean } = {},
) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  if (changeInput) setCurrentChange(change);
  const board = syncTaskBoard(change);
  const remainingTasks = board.tasks.filter(
    (task) => task.status === 'todo' || task.status === 'doing',
  );
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
    blockedBy.push(
      ...results
        .filter((item) => item.status === 'failed')
        .map((item) => item.reason ?? item.command),
    );
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
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts?.ai === 'msgfi-ai'
    : false;
  pushCheck(
    'package.json scripts.ai',
    aiScriptExists,
    aiScriptExists ? undefined : 'scripts.ai is not set to "msgfi-ai".',
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
