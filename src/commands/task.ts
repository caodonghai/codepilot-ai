import { Command } from 'commander';
import fs from 'fs';
import type { HarnessTaskStatus } from '../types';
import { resolvePath } from '../utils/file';
import { updateHarnessState } from '../lib/state';
import { getChangeName, setCurrentChange, writeRunEvent } from './helpers/state';
import { buildChangeContext } from './helpers/common';
import {
  syncTaskBoard,
  findTask,
  updateMarkdownTaskCheck,
  taskSummary,
  selectNextTask,
} from './helpers/task';
import { runHooks } from '../lib/hooks';
import { logger } from '../lib/logger';

export function registerTaskCommands(program: Command) {
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
  const task = selectNextTask(board);
  if (!task) {
    console.log(`No remaining task for ${change}.`);
    return;
  }
  console.log(`/ai:apply ${change}`);
  console.log(`Next task: ${task.id} [${task.status}] ${task.title}`);
  if (task.blockedBy) console.log(`Blocked by: ${task.blockedBy}`);
}

async function updateTaskCommand(
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

  const hookAction = action === 'blocked' ? 'block' : action;
  const hookName = `pre-task-${hookAction}` as const;
  await runHooks(hookName, { change, taskId: task.id, taskTitle: task.title });

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

  const postHookAction = action === 'blocked' ? 'block' : action;
  const postHookName = `post-task-${postHookAction}` as const;
  await runHooks(postHookName, { change, taskId: task.id, taskTitle: task.title, status: action });

  logger.success(`Task ${task.id} marked ${action}: ${task.title}`);
}
