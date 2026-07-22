import { spawnSync } from 'child_process';
import { logger } from './logger';

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runGit(args: string[], options: { cwd?: string; silent?: boolean } = {}): GitResult {
  const { cwd = process.cwd(), silent = true } = options;
  logger.debug(`Running git command: git ${args.join(' ')}`);
  const result = spawnSync('git', args, {
    cwd,
    shell: false,
    stdio: silent ? 'pipe' : 'inherit',
  });
  const stdout = result.stdout?.toString('utf8').trim() || '';
  const stderr = result.stderr?.toString('utf8').trim() || '';
  const success = result.status === 0;
  if (!success && !silent) {
    logger.error(`Git command failed: git ${args.join(' ')}`);
    logger.error(stderr);
  }
  return { success, stdout, stderr, exitCode: result.status || 1 };
}

export function isGitRepo(cwd?: string): boolean {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], { cwd });
  return result.success && result.stdout === 'true';
}

export function getCurrentBranch(cwd?: string): string | null {
  const result = runGit(['branch', '--show-current'], { cwd });
  return result.success ? result.stdout : null;
}

export function hasUncommittedChanges(cwd?: string): boolean {
  const result = runGit(['status', '--porcelain'], { cwd });
  return result.success && result.stdout.length > 0;
}

export function createBranch(branchName: string, cwd?: string): GitResult {
  logger.info(`Creating branch: ${branchName}`);
  return runGit(['checkout', '-b', branchName], { cwd, silent: false });
}

export function checkoutBranch(branchName: string, cwd?: string): GitResult {
  logger.info(`Checking out branch: ${branchName}`);
  return runGit(['checkout', branchName], { cwd, silent: false });
}

export function getBranchExists(branchName: string, cwd?: string): boolean {
  const result = runGit(['show-ref', '--verify', `refs/heads/${branchName}`], { cwd });
  return result.success;
}

export function addFiles(files: string[], cwd?: string): GitResult {
  logger.debug(`Adding files: ${files.join(', ')}`);
  return runGit(['add', ...files], { cwd });
}

export function commit(
  message: string,
  options: { cwd?: string; author?: string } = {},
): GitResult {
  const { cwd, author } = options;
  const args = ['commit', '-m', message];
  if (author) {
    args.push('--author', author);
  }
  logger.info(`Committing: ${message}`);
  return runGit(args, { cwd, silent: false });
}

export function getCommitCount(cwd?: string): number {
  const result = runGit(['rev-list', '--count', 'HEAD'], { cwd });
  return result.success ? parseInt(result.stdout, 10) : 0;
}

export function getLastCommitMessage(cwd?: string): string | null {
  const result = runGit(['log', '-1', '--format=%s'], { cwd });
  return result.success ? result.stdout : null;
}

export function generateCommitMessage(
  changeType: string,
  changeName: string,
  tasks: string[] = [],
): string {
  const typePrefix =
    {
      feature: 'feat',
      bugfix: 'fix',
      'ui-change': 'ui',
      refactor: 'refactor',
      default: 'chore',
    }[changeType] || 'chore';

  const taskList = tasks.length > 0 ? `\n\nTasks:\n${tasks.map((t) => `- ${t}`).join('\n')}` : '';

  return `${typePrefix}: ${changeName}${taskList}`;
}

export function initRepo(cwd?: string): GitResult {
  logger.info('Initializing git repository');
  return runGit(['init'], { cwd, silent: false });
}

export function getRepoInfo(cwd?: string) {
  return {
    isRepo: isGitRepo(cwd),
    branch: getCurrentBranch(cwd),
    hasChanges: hasUncommittedChanges(cwd),
    commitCount: getCommitCount(cwd),
    lastCommit: getLastCommitMessage(cwd),
  };
}
