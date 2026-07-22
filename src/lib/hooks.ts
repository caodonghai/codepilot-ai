import { logger } from './logger';

export type HookName =
  | 'pre-change-create'
  | 'post-change-create'
  | 'pre-change-archive'
  | 'post-change-archive'
  | 'pre-change-restore'
  | 'post-change-restore'
  | 'pre-change-delete'
  | 'post-change-delete'
  | 'pre-task-done'
  | 'post-task-done'
  | 'pre-task-doing'
  | 'post-task-doing'
  | 'pre-task-block'
  | 'post-task-block'
  | 'pre-finish'
  | 'post-finish'
  | 'pre-verify'
  | 'post-verify';

export interface HookContext {
  change?: string;
  taskId?: string;
  taskTitle?: string;
  status?: string;
  [key: string]: unknown;
}

export type HookHandler = (context: HookContext) => void | Promise<void>;

interface HookEntry {
  handler: HookHandler;
  priority: number;
}

const hooks = new Map<HookName, HookEntry[]>();

export function registerHook(name: HookName, handler: HookHandler, priority: number = 100): void {
  if (!hooks.has(name)) {
    hooks.set(name, []);
  }
  hooks.get(name)!.push({ handler, priority });
  hooks.get(name)!.sort((a, b) => a.priority - b.priority);
  logger.debug(`Registered hook: ${name} (priority: ${priority})`);
}

export function unregisterHook(name: HookName, handler?: HookHandler): void {
  const entries = hooks.get(name);
  if (!entries) return;

  if (handler) {
    hooks.set(
      name,
      entries.filter((entry) => entry.handler !== handler),
    );
  } else {
    hooks.delete(name);
  }
  logger.debug(`Unregistered hook: ${name}`);
}

export async function runHooks(name: HookName, context: HookContext = {}): Promise<void> {
  const entries = hooks.get(name);
  if (!entries || entries.length === 0) {
    logger.debug(`No hooks registered for: ${name}`);
    return;
  }

  logger.debug(`Running ${entries.length} hook(s) for: ${name}`);
  for (const { handler } of entries) {
    try {
      await handler(context);
    } catch (error) {
      logger.error(`Hook ${name} failed: ${(error as Error).message}`);
    }
  }
}

export function getRegisteredHooks(name?: HookName): HookName[] {
  if (name) {
    return hooks.has(name) ? [name] : [];
  }
  return Array.from(hooks.keys());
}

export function clearHooks(): void {
  hooks.clear();
  logger.debug('Cleared all hooks');
}

export function hasHook(name: HookName): boolean {
  const entries = hooks.get(name);
  return entries !== undefined && entries.length > 0;
}
