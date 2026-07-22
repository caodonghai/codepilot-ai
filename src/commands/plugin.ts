import type { Command } from 'commander';
import { confirmDestructiveAction } from '../lib/confirm';
import { installPlugin, listPlugins, uninstallPlugin } from '../lib/plugin';
import { isJsonOutput } from '../lib/context';

export function registerPluginManagementCommands(program: Command) {
  const plugin = program.command('plugin').description('Local plugin management');
  plugin
    .command('list')
    .description('List installed plugins')
    .action(() => {
      const plugins = listPlugins().map(({ name, version, description }) => ({
        name,
        version,
        description,
      }));
      console.log(isJsonOutput() ? JSON.stringify(plugins) : JSON.stringify(plugins, null, 2));
    });
  plugin
    .command('install <path>')
    .description('Install a trusted local plugin directory')
    .option('-y, --yes', 'Confirm execution trust')
    .action(async (source, options) => {
      await confirmDestructiveAction(
        `Install and trust executable plugin code from "${source}"?`,
        options.yes,
      );
      if (!installPlugin(source)) process.exitCode = 1;
    });
  plugin
    .command('remove <name>')
    .description('Remove an installed plugin')
    .option('-y, --yes', 'Confirm removal')
    .action(async (name, options) => {
      await confirmDestructiveAction(`Permanently remove plugin "${name}"?`, options.yes);
      if (!uninstallPlugin(name)) process.exitCode = 1;
    });
}
