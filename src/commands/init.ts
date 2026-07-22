import { Command } from 'commander';
import {
  configSchemaVersion,
  defaultTools,
  requiredChangeFiles,
  parseTools,
  flowNames,
  integrationNames,
} from '../config/constants';
import { ensureDir, exists, writeFileIfMissing, writeGeneratedFile } from '../utils/file';
import { loadHarnessConfig, saveHarnessConfig } from '../lib/state';
import {
  templateChangeFile,
  setupPackageScript,
  setupGitignore,
  seedProjectTemplates,
  applyToolSkip,
  listTargetFiles,
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
import { isDryRun, isJsonOutput } from '../lib/context';
import { detectProjectInfo } from '../lib/project';
import type { ProjectFramework, BuildTool, PackageManager } from '../types';
import { defaultIntegrationConfig, saveIntegrationConfig } from '../lib/integrations';

export function registerInitCommands(program: Command) {
  program
    .command('init')
    .description('Initialize CodePilot AI harness and integration rules')
    .option('--profile <profile>', 'Profile: lightweight | official | hybrid')
    .option('--tools <tools>', 'Comma-separated list of AI tools')
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
  const previousConfig = exists('harness', 'config.json') ? loadHarnessConfig() : null;
  const tools = options.tools
    ? parseTools(options.tools)
    : ((previousConfig?.tools as string[] | undefined) ?? defaultTools);
  const profile = options.profile || previousConfig?.profile || 'lightweight';
  if (!['lightweight', 'official', 'hybrid'].includes(profile)) {
    throw new Error('Profile must be lightweight, official, or hybrid.');
  }

  if (isDryRun()) {
    console.log(
      JSON.stringify(
        { status: 'dry-run', command: 'init', profile, tools, writes: false },
        null,
        2,
      ),
    );
    return;
  }

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
      ...previousConfig,
      version: configSchemaVersion,
      profile,
      currentChange: previousConfig?.currentChange ?? null,
      tools,
      checks: previousConfig?.checks ?? ['ai:validate', 'ai:report'],
      strictChecks: previousConfig?.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
      project: projectInfo,
    });
    for (const name of integrationNames) {
      if (options.profile || !exists('harness', 'integrations', name, 'config.json')) {
        saveIntegrationConfig({
          ...defaultIntegrationConfig(name),
          mode: profile as 'lightweight' | 'official' | 'hybrid',
        });
      }
    }
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
  const files = buildSyncFiles(tools);
  const skips: Array<{ tool: string; reason: string }> = [];

  if (options.dryRun || isDryRun()) {
    console.log('[DRY-RUN] Would sync:');
    for (const item of files) {
      const marker = require('fs').existsSync(require('path').join(process.cwd(), item.path))
        ? '[UPDATE]'
        : '[CREATE]';
      console.log(`  ${marker} ${item.tool}: ${item.path}`);
    }
    return;
  }

  let failures = 0;
  for (const item of files) {
    const writable = checkWritable(item.path);
    if (writable.status === 'failed') {
      failures += 1;
      console.log(
        isActiveCodexSkillLock(item.path, writable.reason)
          ? `[SKIP] ${item.tool}: ${item.path} (locked by Codex skill)`
          : `[FAIL] ${item.tool}: ${item.path} (${writable.reason})`,
      );
      continue;
    }

    ensureDir(...item.path.split('/').slice(0, -1));
    writeGeneratedFile(item.path, item.content);
    console.log(`  [UPDATE] ${item.tool}: ${item.path}`);
  }

  writeRunEvent('sync', { tools: rawTools, skipped: skips.map((s) => s.tool), failures });
  if (failures > 0) {
    process.exitCode = 1;
    console.log(`\n[WARN] ${failures} file(s) failed to sync`);
  } else {
    console.log('\n[OK] Rules synchronized successfully');
  }
}

export function buildSyncFiles(tools: string[]) {
  const files: Array<{ tool: string; path: string; content: string }> = [];

  for (const tool of tools) {
    for (const targetPath of listTargetFiles(tool)) {
      const flow = flowNames.find(
        (name) =>
          targetPath.includes(`codepilot-${name}`) ||
          targetPath.endsWith(`/ai-${name}.md`) ||
          targetPath.endsWith(`/ai/${name}.md`),
      );
      const isDispatcher =
        targetPath.endsWith('/codepilot/SKILL.md') || targetPath.endsWith('/commands/ai.md');
      const content = flow
        ? buildCommandDocument(flow)
        : isDispatcher
          ? buildDispatcherDocument()
          : buildRulesDocument(tool);
      files.push({
        tool,
        path: targetPath,
        content,
      });
    }
  }
  return files;
}
