import { Command } from 'commander';
import { registerAllCommands } from './commands';
import { setGlobalOptions } from './lib/context';
import { setLocale } from './lib/i18n';
import { setLogLevel } from './lib/logger';

const program = new Command();

program
  .name('msgfi-ai')
  .description('MsgFi AI Engineering Kit')
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

registerAllCommands(program);

program.parse(process.argv);

const opts = program.opts();
setGlobalOptions({
  verbose: opts.verbose,
  quiet: opts.quiet,
  dryRun: opts.dryRun,
  json: opts.json,
  locale: opts.locale,
});
