import fs from 'fs';
import type { HarnessTaskBoard, HarnessTask, HarnessTaskStatus } from '../../types';
import { resolvePath, writeGeneratedFile, ensureDir } from '../../utils/file';

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
