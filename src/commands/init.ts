import { Command } from 'commander';
import { defaultTools, requiredChangeFiles, parseTools } from '../config/constants';
import { ensureDir, writeFileIfMissing, writeGeneratedFile } from '../utils/file';
import { saveHarnessConfig } from '../lib/state';
import {
  templateChangeFile,
  setupPackageScript,
  setupGitignore,
  seedProjectTemplates,
  applyToolSkip,
} from './templates';
import { writeRunEvent } from '../lib/events';
import {
  buildRulesDocument,
  buildDispatcherDocument,
  buildCommandDocument,
} from '../lib/documents';
import { checkWritable, isActiveCodexSkillLock } from '../lib/permissions';
import { Spinner } from './progress';
import { logger } from '../lib/logger';
import { t } from '../lib/i18n';
import { isJsonOutput } from '../lib/context';
import { detectProjectInfo } from '../lib/project';
import type { ProjectFramework, BuildTool, PackageManager } from '../types';

export function registerInitCommands(program: Command) {
  program
    .command('init')
    .description('Initialize CodePilot AI harness and integration rules')
    .option('--profile <profile>', 'Profile: lightweight | official | hybrid', 'lightweight')
    .option('--tools <tools>', 'Comma-separated list of AI tools', defaultTools.join(','))
    .option('--force', 'Overwrite existing files')
    .option('--no-setup-gitignore', 'Do not add CodePilot runtime artifacts to .gitignore')
    .option(
      '--framework <framework>',
      'Project framework (react/vue/angular/svelte/next/nuxt/remix/solid)',
    )
    .option('--build-tool <buildTool>', 'Build tool (webpack/vite/rollup/esbuild/parcel)')
    .option('--pm <packageManager>', 'Package manager (npm/yarn/pnpm/bun)')
    .action(initHarnessCommand);

  program
    .command('sync')
    .description('Synchronize rules and flows across AI tools')
    .option('--tools <tools>', 'Comma-separated list of AI tools', defaultTools.join(','))
    .option('--force', 'Overwrite existing files')
    .option('--dry-run', 'Show what would be synced')
    .action(syncCommand);
}

function initHarnessCommand(options: {
  profile?: string;
  tools?: string;
  force?: boolean;
  framework?: string;
  buildTool?: string;
  pm?: string;
  setupGitignore?: boolean;
}) {
  const tools = parseTools(options.tools);
  const profile = options.profile || 'lightweight';

  const spinner = new Spinner('Initializing CodePilot AI harness...');
  spinner.start();

  try {
    const detected = detectProjectInfo();
    const projectInfo = {
      ...detected,
      framework: (options.framework as ProjectFramework) || detected.framework,
      buildTool: (options.buildTool as BuildTool) || detected.buildTool,
      packageManager: (options.pm as PackageManager) || detected.packageManager,
    };

    logger.info(
      `Detected project: ${projectInfo.framework} + ${projectInfo.buildTool} + ${projectInfo.packageManager}`,
    );

    seedProjectTemplates();
    logger.debug('Seeded project templates');

    setupPackageScript();
    logger.debug('Set up package script');

    setupGitignore({ enabled: options.setupGitignore !== false });
    logger.debug('Set up .gitignore');

    ensureDir('openspec', 'changes');
    ensureDir('harness', 'memory', 'knowledge');
    ensureDir('harness', 'tasks');
    ensureDir('harness', 'runs');
    logger.debug('Created directories');

    for (const file of requiredChangeFiles) {
      writeFileIfMissing(
        `openspec/changes/.template/${file}`,
        templateChangeFile('.template', file),
      );
    }
    logger.debug('Created template files');

    saveHarnessConfig({
      version: 1,
      profile,
      currentChange: null,
      tools,
      checks: ['ai:validate', 'ai:report'],
      strictChecks: ['eslint', 'ai:validate', 'ai:report'],
      project: projectInfo,
    });
    logger.debug('Saved harness config');

    spinner.stop(true);

    if (isJsonOutput()) {
      console.log(
        JSON.stringify({
          status: 'success',
          message: t('init.completed'),
          profile,
          tools,
          project: projectInfo,
        }),
      );
    } else {
      logger.success(`${t('init.completed')} profile=${profile}`);
      logger.info(`Framework: ${projectInfo.framework}`);
      logger.info(`Build Tool: ${projectInfo.buildTool}`);
      logger.info(`Package Manager: ${projectInfo.packageManager}`);
      logger.info(`Tools: ${tools.join(', ')}`);
    }

    syncCommand({ tools: options.tools, force: options.force });
  } catch (error) {
    spinner.stop(false);
    logger.error(`Initialization failed: ${(error as Error).message}`);
    process.exitCode = 1;
  }
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
