import { Command } from 'commander';
import { loadHarnessConfig, saveHarnessConfig, loadHarnessState } from '../lib/state';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';
import { getDefaultConfig } from '../lib/state';

export function registerConfigCommands(program: Command) {
  const config = program.command('config').description('Configuration management');

  config.command('get <key>').description('Get configuration value').action(configGetCommand);

  config
    .command('set <key> <value>')
    .description('Set configuration value')
    .action(configSetCommand);

  config.command('list').description('List all configuration').action(configListCommand);

  config.command('reset').description('Reset configuration to defaults').action(configResetCommand);

  config.command('show').description('Show full configuration').action(configShowCommand);
}

function configGetCommand(key: string) {
  const config = loadHarnessConfig();
  const value = (config as Record<string, unknown>)[key];
  if (value === undefined) {
    logger.error(`Configuration key not found: ${key}`);
    process.exitCode = 1;
    return;
  }
  if (isJsonOutput()) {
    console.log(JSON.stringify({ [key]: value }));
  } else {
    console.log(`${key}: ${JSON.stringify(value)}`);
  }
}

function configSetCommand(key: string, value: string) {
  const config = loadHarnessConfig() as Record<string, unknown>;
  let parsedValue: unknown = value;

  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(parseFloat(value))) parsedValue = parseFloat(value);
  else if (value.startsWith('[') && value.endsWith(']')) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      logger.error('Invalid array format');
      process.exitCode = 1;
      return;
    }
  } else if (value.startsWith('{') && value.endsWith('}')) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      logger.error('Invalid object format');
      process.exitCode = 1;
      return;
    }
  }

  config[key] = parsedValue;
  saveHarnessConfig(config as never);

  if (isJsonOutput()) {
    console.log(JSON.stringify({ status: 'success', key, value: parsedValue }));
  } else {
    logger.success(`Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
  }
}

function configListCommand() {
  const config = loadHarnessConfig();
  const keys = Object.keys(config);
  if (isJsonOutput()) {
    console.log(JSON.stringify(config, null, 2));
  } else {
    for (const key of keys) {
      console.log(`${key}: ${JSON.stringify((config as Record<string, unknown>)[key])}`);
    }
  }
}

function configResetCommand() {
  saveHarnessConfig(getDefaultConfig());
  if (isJsonOutput()) {
    console.log(JSON.stringify({ status: 'success', message: 'Configuration reset' }));
  } else {
    logger.success('Configuration reset to defaults');
  }
}

function configShowCommand() {
  const config = loadHarnessConfig();
  const state = loadHarnessState();
  if (isJsonOutput()) {
    console.log(
      JSON.stringify(
        {
          config,
          state,
        },
        null,
        2,
      ),
    );
  } else {
    console.log('=== Configuration ===');
    console.log(JSON.stringify(config, null, 2));
    console.log('\n=== State ===');
    console.log(JSON.stringify(state, null, 2));
  }
}
