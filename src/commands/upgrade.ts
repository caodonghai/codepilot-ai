import { Command } from 'commander';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';

export function registerUpgradeCommands(program: Command) {
  const upgrade = program.command('upgrade').description('Upgrade commands');

  upgrade.command('check').description('Check for updates').action(upgradeCheckCommand);

  upgrade.command('install').description('Install latest version').action(upgradeInstallCommand);

  upgrade.command('version').description('Show current version').action(versionCommand);
}

function getCurrentVersion(): string {
  try {
    const pkg = require('../../package.json');
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const url = 'https://registry.npmjs.org/@msgfi/ai-engineering-kit';
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data['dist-tags']?.latest || null;
  } catch {
    return null;
  }
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (c < l) return -1;
    if (c > l) return 1;
  }
  return 0;
}

async function upgradeCheckCommand() {
  const current = getCurrentVersion();
  const latest = await fetchLatestVersion();

  if (!latest) {
    logger.error('Failed to check for updates');
    process.exitCode = 1;
    return;
  }

  const comparison = compareVersions(current, latest);

  if (isJsonOutput()) {
    console.log(
      JSON.stringify({
        current,
        latest,
        updateAvailable: comparison < 0,
      }),
    );
  } else {
    console.log(`Current version: ${current}`);
    console.log(`Latest version: ${latest}`);

    if (comparison < 0) {
      logger.warn(`Update available! Run 'msgfi-ai upgrade install' to update.`);
    } else if (comparison === 0) {
      logger.success('You are running the latest version.');
    } else {
      logger.info('You are running a prerelease version.');
    }
  }
}

function upgradeInstallCommand() {
  logger.info('Installing latest version...');

  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('npm', ['install', '@msgfi/ai-engineering-kit@latest'], {
      cwd: process.cwd(),
      shell: false,
      stdio: 'inherit',
    });

    if (result.status === 0) {
      logger.success('Upgrade completed successfully!');
      logger.info('Restart your terminal to use the new version.');
    } else {
      logger.error('Upgrade failed');
      process.exitCode = 1;
    }
  } catch (error) {
    logger.error(`Upgrade failed: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function versionCommand() {
  const version = getCurrentVersion();
  if (isJsonOutput()) {
    console.log(JSON.stringify({ version }));
  } else {
    console.log(`MsgFi AI Engineering Kit v${version}`);
  }
}
