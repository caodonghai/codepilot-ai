import { Command } from 'commander';
import {
  getRegisteredHooks,
  runHooks,
  registerHook,
  unregisterHook,
  hasHook,
  clearHooks,
} from '../lib/hooks';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';

export function registerHookCommands(program: Command) {
  const hook = program.command('hook').description('Hook management commands');

  hook.command('list').description('List registered hooks').action(hookListCommand);

  hook
    .command('register <name>')
    .description('Register a hook')
    .option('--priority <priority>', 'Hook priority', '100')
    .action(hookRegisterCommand);

  hook.command('unregister <name>').description('Unregister a hook').action(hookUnregisterCommand);

  hook
    .command('trigger <name>')
    .description('Trigger a hook manually')
    .option('--change <change>', 'Change name')
    .option('--task <task>', 'Task ID')
    .action(hookTriggerCommand);

  hook.command('clear').description('Clear all hooks').action(hookClearCommand);
}

function hookListCommand() {
  const hooks = getRegisteredHooks();
  if (isJsonOutput()) {
    console.log(JSON.stringify(hooks));
  } else {
    if (!hooks.length) {
      logger.info('No hooks registered');
      return;
    }
    console.log('=== Registered Hooks ===');
    for (const hook of hooks) {
      console.log(`- ${hook}`);
    }
  }
}

function hookRegisterCommand(name: string, options: { priority?: string }) {
  const priority = parseInt(options.priority || '100', 10);
  registerHook(
    name as never,
    () => {
      logger.info(`Hook triggered: ${name}`);
    },
    priority,
  );
  logger.success(`Hook registered: ${name} (priority: ${priority})`);
}

function hookUnregisterCommand(name: string) {
  if (!hasHook(name as never)) {
    logger.error(`Hook not found: ${name}`);
    process.exitCode = 1;
    return;
  }
  unregisterHook(name as never);
  logger.success(`Hook unregistered: ${name}`);
}

async function hookTriggerCommand(name: string, options: { change?: string; task?: string }) {
  const context: Record<string, unknown> = {};
  if (options.change) context.change = options.change;
  if (options.task) context.taskId = options.task;

  await runHooks(name as never, context);
  logger.success(`Hook triggered: ${name}`);
}

function hookClearCommand() {
  clearHooks();
  logger.success('All hooks cleared');
}
