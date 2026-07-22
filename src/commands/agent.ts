import { Command } from 'commander';
import fs from 'fs';
import type { HarnessResult, HarnessStatus } from '../types';
import { resolvePath, ensureDir, writeGeneratedFile } from '../utils/file';
import { loadHarnessConfig, loadHarnessState, updateHarnessState } from '../lib/state';
import { getChangeName, setCurrentChange } from '../lib/state';
import { writeRunEvent } from '../lib/events';
import { buildChangeContext } from '../lib/state';
import { syncTaskBoard, taskSummary, selectNextTask } from '../lib/task';
import { buildAgentPrompt } from '../lib/documents';
import { validateCommand } from './change';

export function registerAgentCommands(program: Command) {
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

function collectUncheckedAcceptance(change: string) {
  const acceptancePath = resolvePath('openspec', 'changes', change, 'acceptance.md');
  if (!fs.existsSync(acceptancePath)) return [];
  return fs
    .readFileSync(acceptancePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s\[\s\]\s+/.test(line));
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
      const eslintPath = resolvePath('node_modules', 'eslint', 'bin', 'eslint.js');
      if (fs.existsSync(eslintPath)) {
        const { spawnSync } = require('child_process');
        const eslintResult = spawnSync(
          process.execPath,
          [eslintPath, '--ext', '.tsx,.ts', './apps'],
          {
            cwd: resolvePath('.'),
            shell: false,
            stdio: 'inherit',
          },
        );
        results.push({
          command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
          status:
            typeof eslintResult.status === 'number' && eslintResult.status === 0
              ? 'passed'
              : 'failed',
          exitCode: typeof eslintResult.status === 'number' ? eslintResult.status : 1,
          durationMs: 0,
          reason: eslintResult.error?.message,
        });
      }
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
  const config = loadHarnessConfig();
  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const report = {
    createdAt: timestamp,
    profile: config.profile ?? 'lightweight',
    scope: change ?? 'root',
    change,
    dryRun: false,
    status: reportStatus,
    tools: config.tools ?? ['codex', 'trae', 'qoder', 'cursor'],
    results,
  };

  writeGeneratedFile(
    `harness/reports/${fileTimestamp}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
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
