import type { HarnessTask } from '../../types';
import { buildChangeContext } from './common';
import { loadHarnessState } from '../../lib/state';

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
