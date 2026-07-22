import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { IntegrationName } from '../types';
import { integrationNames, integrationGitSources } from '../config/constants';
import { resolvePath, writeFileIfMissing } from '../utils/file';
import { quoteShellArg } from '../utils/string';
import {
  loadIntegrations,
  inspectIntegrationHealth,
  defaultIntegrationConfig,
  loadIntegrationConfig,
  saveIntegrationConfig,
} from './integrations-core';
import { writeRunEvent } from './helpers/state';

export function registerIntegrationCommands(program: Command) {
  const integration = program.command('integration').description('Integration management');

  integration.command('list').description('List integrations').action(integrationListCommand);

  integration
    .command('use <name> <mode>')
    .description('Set integration mode')
    .action(integrationUseCommand);

  integration
    .command('install <name>')
    .description('Install integration')
    .option('--source <source>', 'Source path')
    .option('--dry-run', 'Preview installation')
    .action(integrationInstallCommand);

  integration
    .command('remove <name>')
    .description('Remove integration')
    .option('--dry-run', 'Preview removal')
    .action(integrationRemoveCommand);

  integration
    .command('download <name>')
    .description('Download integration from git')
    .option('--to <to>', 'Target path')
    .option('--dry-run', 'Preview download')
    .option('--force', 'Overwrite existing')
    .option('--allow-inside-repo', 'Allow download inside repo')
    .action(integrationDownloadCommand);

  integration
    .command('validate <name>')
    .description('Validate integration')
    .option('--dry-run', 'Preview validation')
    .option('--execute', 'Execute validation')
    .action(integrationValidateCommand);
}

function integrationListCommand() {
  const integrations = loadIntegrations();
  const health = Object.fromEntries(
    integrationNames.map((name) => [name, inspectIntegrationHealth(name, integrations[name])]),
  );
  console.log(
    JSON.stringify(
      {
        integrations,
        health,
        note: 'Official integrations are repo-local only. This command does not install global packages or modify PATH.',
      },
      null,
      2,
    ),
  );
}

function integrationUseCommand(nameInput: string, modeInput: string) {
  const name = nameInput as IntegrationName;
  if (!integrationNames.includes(name)) {
    throw new Error(
      `Unsupported integration: ${name}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  const mode = modeInput as 'lightweight' | 'official' | 'hybrid';
  if (!['lightweight', 'official', 'hybrid'].includes(mode)) {
    throw new Error(
      `Unsupported integration mode: ${mode}. Supported modes: lightweight, official, hybrid`,
    );
  }
  const current = loadIntegrationConfig(name);
  const next = {
    ...current,
    mode,
  };
  saveIntegrationConfig(next);
  writeRunEvent('integration-use', {
    integration: name,
    mode,
    officialInstalled: next.officialInstalled,
    officialPath: next.officialPath,
  });
  console.log(
    JSON.stringify(
      {
        status: 'updated',
        integration: name,
        mode,
        officialInstalled: next.officialInstalled,
        officialPath: next.officialPath,
        warning:
          mode !== 'lightweight' && !next.officialInstalled
            ? 'Official integration is selected but not installed in the repo-local official directory. Runtime should fall back or report clearly.'
            : undefined,
      },
      null,
      2,
    ),
  );
}

function assertIntegrationTargetPath(name: IntegrationName, targetPath?: string) {
  if (!targetPath) {
    const config = defaultIntegrationConfig(name);
    return config.officialPath;
  }
  return targetPath;
}

function parseIntegrationSource(value: string) {
  const match = value.match(/^local:(.+)$/);
  if (!match) {
    throw new Error('Unsupported source format. Use local:<path>.');
  }
  return resolvePath(match[1]);
}

function clearDirectoryContents(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  for (const item of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, item);
    if (fs.lstatSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

function copyDirectoryRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function integrationInstallCommand(
  nameInput: string,
  options: { source?: string; dryRun?: boolean } = {},
) {
  const name = nameInput as IntegrationName;
  if (!integrationNames.includes(name)) {
    throw new Error(
      `Unsupported integration: ${name}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  const current = loadIntegrationConfig(name);
  const officialPath = assertIntegrationTargetPath(name, current.officialPath);
  const cachePath = assertIntegrationTargetPath(name, current.cachePath);
  const sourcePath = options.source ? parseIntegrationSource(options.source) : null;
  const now = new Date().toISOString();

  if (options.dryRun) {
    saveIntegrationConfig({
      ...current,
      lastInstallDryRunAt: now,
    });
    console.log(
      JSON.stringify(
        {
          status: 'dry-run',
          integration: name,
          source: options.source ?? null,
          officialPath: current.officialPath,
          cachePath: current.cachePath,
          note: 'No files were copied. No global packages were installed. PATH was not modified.',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!sourcePath || !options.source) {
    throw new Error(
      'v0.8 only supports repo-local install from --source local:<path>. Use --dry-run to preview.',
    );
  }
  if (
    sourcePath === officialPath ||
    sourcePath.startsWith(`${officialPath}${path.sep}`) ||
    sourcePath === cachePath ||
    sourcePath.startsWith(`${cachePath}${path.sep}`)
  ) {
    throw new Error('Local source cannot be inside the target official/cache directories.');
  }

  clearDirectoryContents(officialPath);
  clearDirectoryContents(cachePath);
  copyDirectoryRecursive(sourcePath, officialPath);
  writeFileIfMissing(`${current.officialPath}/.gitkeep`, '\n');
  saveIntegrationConfig({
    ...current,
    officialInstalled: true,
    officialPath: current.officialPath,
    cachePath: current.cachePath,
    source: options.source,
    installedAt: now,
    removedAt: null,
  });
  writeRunEvent('integration-install', {
    integration: name,
    source: options.source,
    officialPath: current.officialPath,
  });
  console.log(
    JSON.stringify(
      {
        status: 'installed',
        integration: name,
        source: options.source,
        officialPath: current.officialPath,
        mode: current.mode,
        note: 'Installed into repo-local official directory only. Mode was not changed automatically.',
      },
      null,
      2,
    ),
  );
}

function integrationRemoveCommand(nameInput: string, options: { dryRun?: boolean } = {}) {
  const name = nameInput as IntegrationName;
  if (!integrationNames.includes(name)) {
    throw new Error(
      `Unsupported integration: ${name}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  const current = loadIntegrationConfig(name);
  const officialPath = assertIntegrationTargetPath(name, current.officialPath);
  const cachePath = assertIntegrationTargetPath(name, current.cachePath);
  const now = new Date().toISOString();

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          status: 'dry-run',
          integration: name,
          wouldClear: [current.officialPath, current.cachePath],
          note: 'No files were removed. Only repo-local integration directories are eligible.',
        },
        null,
        2,
      ),
    );
    return;
  }

  clearDirectoryContents(officialPath);
  clearDirectoryContents(cachePath);
  writeFileIfMissing(`${current.officialPath}/.gitkeep`, '\n');
  writeFileIfMissing(`${current.cachePath}/.gitkeep`, '\n');
  saveIntegrationConfig({
    ...current,
    mode: 'lightweight',
    officialInstalled: false,
    source: null,
    installedAt: null,
    removedAt: now,
  });
  writeRunEvent('integration-remove', {
    integration: name,
    officialPath: current.officialPath,
    cachePath: current.cachePath,
  });
  console.log(
    JSON.stringify(
      {
        status: 'removed',
        integration: name,
        mode: 'lightweight',
        cleared: [current.officialPath, current.cachePath],
        note: 'Repo-local official/cache directories were cleared. Lightweight files were not touched.',
      },
      null,
      2,
    ),
  );
}

function resolveDownloadTarget(name: IntegrationName, to?: string) {
  if (to) return resolvePath(to);
  return path.join(process.cwd(), '..', `msgfi-${name}`);
}

function assertDownloadOutsideRepo(target: string, allowInsideRepo?: boolean) {
  if (!allowInsideRepo && target.startsWith(process.cwd())) {
    throw new Error(
      `Download target must be outside the repo. Use --allow-inside-repo to override, or specify a different --to path.`,
    );
  }
}

function integrationDownloadCommand(
  nameInput: string,
  options: { to?: string; dryRun?: boolean; force?: boolean; allowInsideRepo?: boolean } = {},
) {
  const name = nameInput as IntegrationName;
  if (!integrationNames.includes(name)) {
    throw new Error(
      `Unsupported integration: ${name}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  const repo = integrationGitSources[name];
  const target = resolveDownloadTarget(name, options.to);
  assertDownloadOutsideRepo(target, options.allowInsideRepo);
  const parent = path.dirname(target);
  const nextInstallCommand = `node ./scripts/ai/run-ai.cjs integration:install ${name} --source ${quoteShellArg(`local:${target}`)}`;

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          status: 'dry-run',
          integration: name,
          method: 'git',
          repo,
          target,
          nextInstallCommand,
          note: 'No network request was made. No files were written.',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (fs.existsSync(target)) {
    if (!options.force) {
      throw new Error(`Download target already exists: ${target}. Use --force to replace it.`);
    }
    assertDownloadOutsideRepo(target, options.allowInsideRepo);
    clearDirectoryContents(target);
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(parent, { recursive: true });
  const startedAt = Date.now();
  const result = spawnSync('git', ['clone', '--depth', '1', repo, target], {
    cwd: parent,
    shell: false,
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  writeRunEvent('integration-download', {
    integration: name,
    method: 'git',
    repo,
    target,
    exitCode,
    durationMs: Date.now() - startedAt,
  });
  console.log(
    JSON.stringify(
      {
        status: exitCode === 0 ? 'downloaded' : 'failed',
        integration: name,
        method: 'git',
        repo,
        target,
        exitCode,
        durationMs: Date.now() - startedAt,
        nextInstallCommand: exitCode === 0 ? nextInstallCommand : null,
        note: 'Download only. The current project integration mode was not changed.',
      },
      null,
      2,
    ),
  );
  if (exitCode !== 0) process.exitCode = exitCode;
}

function detectOfficialValidateCommand(name: IntegrationName, officialPath: string) {
  const packageJsonPath = path.join(officialPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson?.scripts?.validate) {
    return {
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'npm run validate'] : ['-lc', 'npm run validate'],
      display: 'npm run validate',
    };
  }
  if (name === 'openspec' && packageJson?.bin) {
    const firstBin =
      typeof packageJson.bin === 'string' ? packageJson.bin : Object.values(packageJson.bin)[0];
    if (typeof firstBin === 'string') {
      return {
        command: process.execPath,
        args: [firstBin, 'validate'],
        display: `node ${firstBin} validate`,
      };
    }
  }
  return null;
}

function integrationValidateCommand(
  nameInput: string,
  options: { dryRun?: boolean; execute?: boolean } = {},
) {
  const name = nameInput as IntegrationName;
  if (!integrationNames.includes(name)) {
    throw new Error(
      `Unsupported integration: ${name}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  const config = loadIntegrationConfig(name);
  const health = inspectIntegrationHealth(name, config);
  const officialPath = assertIntegrationTargetPath(name, config.officialPath);
  const validateCommand = detectOfficialValidateCommand(name, officialPath);
  const base = {
    integration: name,
    mode: config.mode,
    officialInstalled: config.officialInstalled,
    officialPath: config.officialPath,
    health,
    validateCommand: validateCommand?.display ?? null,
  };

  if (!health.usable) {
    console.log(
      JSON.stringify(
        {
          status: 'unusable',
          ...base,
          note: 'Official resources are not usable. Install repo-local official resources or switch back to lightweight.',
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  if (name === 'superpowers') {
    console.log(
      JSON.stringify(
        {
          status: 'validated',
          ...base,
          note: 'Superpowers official validation is structural only in v0.8.2; no official command was executed.',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!validateCommand) {
    console.log(
      JSON.stringify(
        {
          status: 'probe-only',
          ...base,
          note: 'Official resources look usable but no repo-local validate command was detected.',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.dryRun || !options.execute) {
    console.log(
      JSON.stringify(
        {
          status: 'dry-run',
          ...base,
          note: 'Detected repo-local official validate command. Add --execute to run it.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const startedAt = Date.now();
  const result = spawnSync(validateCommand.command, validateCommand.args, {
    cwd: officialPath,
    shell: false,
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  writeRunEvent('integration-validate', {
    integration: name,
    command: validateCommand.display,
    exitCode,
    durationMs: Date.now() - startedAt,
  });
  console.log(
    JSON.stringify(
      {
        status: exitCode === 0 ? 'passed' : 'failed',
        ...base,
        exitCode,
        durationMs: Date.now() - startedAt,
        note: 'Executed repo-local official validate command only.',
      },
      null,
      2,
    ),
  );
  if (exitCode !== 0) process.exitCode = exitCode;
}
