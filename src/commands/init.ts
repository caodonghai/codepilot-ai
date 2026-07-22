import { Command } from 'commander';
import { defaultTools, requiredChangeFiles, parseTools } from '../config/constants';
import { ensureDir, writeFileIfMissing, writeGeneratedFile } from '../utils/file';
import { saveHarnessConfig } from '../lib/state';
import {
  templateChangeFile,
  setupPackageScript,
  seedProjectTemplates,
  applyToolSkip,
} from './templates';
import { writeRunEvent } from './helpers/state';
import {
  buildRulesDocument,
  buildDispatcherDocument,
  buildCommandDocument,
} from './helpers/documents';
import { checkWritable, isActiveCodexSkillLock } from './helpers/permissions';

export function registerInitCommands(program: Command) {
  program
    .command('init')
    .description('Initialize MsgFi AI harness and integration rules')
    .option('--profile <profile>', 'Profile: lightweight | official | hybrid', 'lightweight')
    .option('--tools <tools>', 'Comma-separated list of AI tools', defaultTools.join(','))
    .option('--force', 'Overwrite existing files')
    .action(initHarnessCommand);

  program
    .command('sync')
    .description('Synchronize rules and flows across AI tools')
    .option('--tools <tools>', 'Comma-separated list of AI tools', defaultTools.join(','))
    .option('--force', 'Overwrite existing files')
    .option('--dry-run', 'Show what would be synced')
    .action(syncCommand);
}

function initHarnessCommand(options: { profile?: string; tools?: string; force?: boolean }) {
  const tools = parseTools(options.tools);
  const profile = options.profile || 'lightweight';

  seedProjectTemplates();
  setupPackageScript();

  ensureDir('openspec', 'changes');
  ensureDir('harness', 'memory', 'knowledge');
  ensureDir('harness', 'tasks');
  ensureDir('harness', 'runs');

  for (const file of requiredChangeFiles) {
    writeFileIfMissing(`openspec/changes/.template/${file}`, templateChangeFile('.template', file));
  }

  saveHarnessConfig({
    version: 1,
    profile,
    currentChange: null,
    tools,
    checks: ['ai:validate', 'ai:report'],
    strictChecks: ['eslint', 'ai:validate', 'ai:report'],
  });

  console.log(`[OK] Initialized MsgFi AI harness with profile=${profile}`);
  console.log(`[OK] Tools: ${tools.join(', ')}`);

  syncCommand({ tools: options.tools, force: options.force });
}

function syncCommand(options: { tools?: string; force?: boolean; dryRun?: boolean }) {
  const rawTools = parseTools(options.tools);
  const tools = applyToolSkip(rawTools);

  const files: Array<{ tool: string; path: string; content: string }> = [];
  const skips: Array<{ tool: string; reason: string }> = [];

  for (const tool of tools) {
    const rulesPath = tool === 'codex' ? '.codex/rules.md' : `.${tool}/rules.md`;
    files.push({ tool, path: rulesPath, content: buildRulesDocument(tool) });

    files.push({
      tool,
      path: tool === 'codex' ? '.codex/commands/ai.md' : `.${tool}/commands/ai.md`,
      content: buildDispatcherDocument(),
    });

    for (const flow of ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish']) {
      files.push({
        tool,
        path:
          tool === 'codex' ? `.codex/commands/ai:${flow}.md` : `.${tool}/commands/ai:${flow}.md`,
        content: buildCommandDocument(flow),
      });
    }
  }

  if (options.dryRun) {
    console.log('[DRY-RUN] Would sync:');
    for (const item of files) {
      const marker = require('fs').existsSync(require('path').join(process.cwd(), item.path))
        ? '[UPDATE]'
        : '[CREATE]';
      console.log(`  ${marker} ${item.tool}: ${item.path}`);
    }
    if (skips.length > 0) {
      console.log('\nSkipped:');
      for (const item of skips) {
        console.log(`  ${item.tool}: ${item.reason}`);
      }
    }
    return;
  }

  let failures = 0;
  for (const item of files) {
    const writable = checkWritable(item.path);
    if (writable.status === 'failed') {
      if (isActiveCodexSkillLock(item.path, writable.reason)) {
        failures += 1;
        console.log(`[SKIP] ${item.tool}: ${item.path} (locked by Codex skill)`);
      } else {
        failures += 1;
        console.log(`[FAIL] ${item.tool}: ${item.path} (${writable.reason})`);
      }
      continue;
    }

    ensureDir(...item.path.split('/').slice(0, -1));
    writeGeneratedFile(item.path, item.content);
    const marker = require('fs').existsSync(require('path').join(process.cwd(), item.path))
      ? '[UPDATE]'
      : '[CREATE]';
    console.log(`  ${marker} ${item.tool}: ${item.path}`);
  }

  if (skips.length > 0) {
    console.log('\nSkipped:');
    for (const item of skips) {
      console.log(`  ${item.tool}: ${item.reason}`);
    }
  }

  writeRunEvent('sync', { tools: rawTools, skipped: skips.map((s) => s.tool), failures });

  if (failures > 0) {
    process.exitCode = 1;
    console.log(`\n[WARN] ${failures} file(s) failed to sync`);
  } else {
    console.log('\n[OK] Rules synchronized successfully');
  }
}
