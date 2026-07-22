import { Command } from 'commander';
import { registerAllCommands } from './commands';
import { setGlobalOptions, loadFromEnv } from './lib/context';
import { setLocale } from './lib/i18n';
import { setLogLevel } from './lib/logger';
import { loadPlugins, registerPluginCommands, registerPluginHooks } from './lib/plugin';

const program = new Command();

program
  .name('codepilot')
  .description('CodePilot AI - AI-powered engineering workflow toolkit')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-q, --quiet', 'Suppress output', false)
  .option('--dry-run', 'Preview changes without applying', false)
  .option('--json', 'Output in JSON format', false)
  .option('--locale <locale>', 'Set locale (zh-CN/en-US)', 'zh-CN');

program.on('option:verbose', () => {
  setLogLevel('debug');
});

program.on('option:locale', (locale) => {
  setLocale(locale);
});

loadFromEnv();

registerAllCommands(program);

if (process.env.CODEPILOT_ENABLE_PLUGINS === 'true') {
  const plugins = loadPlugins();
  registerPluginHooks(plugins);
  registerPluginCommands(program, plugins);
}

program.hook('preAction', (command) => {
  const opts = command.optsWithGlobals();
  setGlobalOptions({
    verbose: opts.verbose,
    quiet: opts.quiet,
    dryRun: opts.dryRun,
    json: opts.json,
    locale: opts.locale,
  });
  if (opts.verbose) setLogLevel('debug');
  if (opts.locale) setLocale(opts.locale);
});

program.parse(process.argv);
