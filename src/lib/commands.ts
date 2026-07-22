import type { Command } from 'commander';
import type { ChangeType, KnowledgeType, IntegrationName, IntegrationMode, ToolName } from '../types';

export interface CommandHandler {
  name: string;
  description: string;
  args?: { name: string; required?: boolean }[];
  options?: {
    name: string;
    description: string;
    type?: 'string' | 'boolean' | 'number';
    defaultValue?: unknown;
  }[];
  action: (args: Record<string, unknown>) => void | Promise<void>;
}

export interface CommandContext {
  change?: string;
  tools?: ToolName[];
  verbose?: boolean;
  dryRun?: boolean;
}

export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();

  register(handler: CommandHandler): void {
    this.commands.set(handler.name, handler);
  }

  get(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandHandler[] {
    return Array.from(this.commands.values());
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  unregister(name: string): void {
    this.commands.delete(name);
  }

  clear(): void {
    this.commands.clear();
  }

  toCommander(program: Command): void {
    for (const handler of this.getAll()) {
      const cmd = program.command(handler.name).description(handler.description);

      if (handler.args) {
        for (const arg of handler.args) {
          const argName = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
          cmd.argument(argName);
        }
      }

      if (handler.options) {
        for (const option of handler.options) {
          const type = option.type === 'boolean' ? '' : ` <${option.type}>`;
          const defaultValue = option.defaultValue !== undefined ? ` (default: ${option.defaultValue})` : '';
          const defaultVal = option.type === 'number' ? undefined : (option.defaultValue as string | boolean | undefined);
          cmd.option(`--${option.name}${type}`, `${option.description}${defaultValue}`, defaultVal);
        }
      }

      cmd.action((...args: unknown[]) => {
        const argValues: Record<string, unknown> = {};
        if (handler.args) {
          for (let i = 0; i < handler.args.length && i < args.length; i++) {
            argValues[handler.args[i].name] = args[i];
          }
        }
        const options = args[args.length - 1] as Record<string, unknown> || {};
        handler.action({ ...argValues, ...options });
      });
    }
  }
}

export interface ChangeCommandOptions {
  type?: ChangeType;
  template?: string;
  skip?: string;
  force?: boolean;
}

export interface KnowledgeCommandOptions {
  type?: KnowledgeType;
  scope?: string;
  source?: string;
  confidence?: string;
  status?: string;
}

export interface IntegrationCommandOptions {
  name?: IntegrationName;
  mode?: IntegrationMode;
  source?: string;
  path?: string;
}

export interface FlowCommandOptions {
  flow?: string;
  change?: string;
  skip?: string;
}

export const createChangeCommand = (registry: CommandRegistry, action: (name: string, options: ChangeCommandOptions) => void) => {
  registry.register({
    name: 'change create <name>',
    description: 'Create a new change proposal',
    args: [
      { name: 'name', required: true },
    ],
    options: [
      { name: 'type', description: 'Change type', type: 'string', defaultValue: 'default' },
      { name: 'template', description: 'Template name', type: 'string' },
      { name: 'skip', description: 'Skip specific tools', type: 'string' },
      { name: 'force', description: 'Force overwrite existing', type: 'boolean' },
    ],
    action: (args) => {
      action(String(args.name), {
        type: args.type as ChangeType,
        template: args.template as string,
        skip: args.skip as string,
        force: args.force as boolean,
      });
    },
  });
};

export const createKnowledgeCommand = (registry: CommandRegistry, action: (args: Record<string, unknown>) => void) => {
  registry.register({
    name: 'knowledge add',
    description: 'Add a new knowledge record',
    options: [
      { name: 'type', description: 'Knowledge type', type: 'string', defaultValue: 'component' },
      { name: 'name', description: 'Knowledge name', type: 'string' },
      { name: 'summary', description: 'Knowledge summary', type: 'string' },
      { name: 'scope', description: 'Scope', type: 'string', defaultValue: 'global' },
      { name: 'source', description: 'Source', type: 'string', defaultValue: 'repo' },
      { name: 'keywords', description: 'Comma-separated keywords', type: 'string' },
      { name: 'confidence', description: 'Confidence level', type: 'string', defaultValue: 'confirmed' },
    ],
    action,
  });

  registry.register({
    name: 'knowledge search <query>',
    description: 'Search knowledge records',
    args: [
      { name: 'query', required: true },
    ],
    options: [
      { name: 'type', description: 'Filter by type', type: 'string' },
      { name: 'limit', description: 'Max results', type: 'number', defaultValue: 10 },
    ],
    action,
  });

  registry.register({
    name: 'knowledge list',
    description: 'List all knowledge records',
    options: [
      { name: 'type', description: 'Filter by type', type: 'string' },
      { name: 'scope', description: 'Filter by scope', type: 'string' },
    ],
    action,
  });

  registry.register({
    name: 'knowledge suggest',
    description: 'Suggest relevant knowledge',
    options: [
      { name: 'change', description: 'Change name', type: 'string' },
      { name: 'limit', description: 'Max suggestions', type: 'number', defaultValue: 5 },
    ],
    action,
  });
};

export const createIntegrationCommand = (registry: CommandRegistry, action: (args: Record<string, unknown>) => void) => {
  registry.register({
    name: 'integration install <name>',
    description: 'Install an integration',
    args: [
      { name: 'name', required: true },
    ],
    options: [
      { name: 'mode', description: 'Integration mode', type: 'string', defaultValue: 'lightweight' },
      { name: 'source', description: 'Git source URL', type: 'string' },
      { name: 'path', description: 'Local path', type: 'string' },
    ],
    action,
  });

  registry.register({
    name: 'integration list',
    description: 'List installed integrations',
    action,
  });

  registry.register({
    name: 'integration status',
    description: 'Check integration health',
    options: [
      { name: 'name', description: 'Integration name', type: 'string' },
    ],
    action,
  });
};

export const createFlowCommand = (registry: CommandRegistry, action: (flow: string, options: FlowCommandOptions) => void) => {
  const flows = ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish'];

  for (const flow of flows) {
    registry.register({
      name: `flow ${flow}`,
      description: `Run ${flow} workflow`,
      options: [
        { name: 'change', description: 'Change name', type: 'string' },
        { name: 'skip', description: 'Skip specific tools', type: 'string' },
      ],
      action: (args) => {
        action(flow, {
          flow,
          change: args.change as string,
          skip: args.skip as string,
        });
      },
    });
  }
};

export const createArchiveCommand = (registry: CommandRegistry, action: (args: Record<string, unknown>) => void) => {
  registry.register({
    name: 'change archive <name>',
    description: 'Archive a completed change',
    args: [
      { name: 'name', required: true },
    ],
    action,
  });

  registry.register({
    name: 'change restore <name>',
    description: 'Restore an archived change',
    args: [
      { name: 'name', required: true },
    ],
    action,
  });

  registry.register({
    name: 'change delete <name>',
    description: 'Delete an archived change',
    args: [
      { name: 'name', required: true },
    ],
    action,
  });

  registry.register({
    name: 'change list',
    description: 'List all changes',
    options: [
      { name: 'archived', description: 'Show archived changes', type: 'boolean' },
    ],
    action,
  });
};
