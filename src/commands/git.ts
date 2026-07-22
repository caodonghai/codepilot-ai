import { Command } from 'commander';
import {
  isGitRepo,
  getCurrentBranch,
  hasUncommittedChanges,
  createBranch,
  checkoutBranch,
  getBranchExists,
  addFiles,
  commit,
  generateCommitMessage,
  initRepo,
  getRepoInfo,
} from '../lib/git';
import { logger } from '../lib/logger';
import { getChangeName, loadHarnessState } from '../lib/state';
import { isJsonOutput } from '../lib/context';
import { parseMarkdownTasks } from './helpers/task';
import { t } from '../lib/i18n';

export function registerGitCommands(program: Command) {
  const git = program.command('git').description('Git integration commands');

  git
    .command('branch <change>')
    .description('Create or checkout branch for change')
    .action(gitBranchCommand);

  git
    .command('commit [change]')
    .description('Commit changes with auto-generated message')
    .action(gitCommitCommand);

  git.command('status').description('Show git status').action(gitStatusCommand);

  git.command('init').description('Initialize git repository').action(gitInitCommand);

  git.command('info').description('Show repository information').action(gitInfoCommand);
}

function gitBranchCommand(change: string) {
  if (!isGitRepo()) {
    logger.error(t('git.not_repo'));
    process.exitCode = 1;
    return;
  }

  const branchName = `feature/${change}`;

  if (getBranchExists(branchName)) {
    logger.info(`Branch ${branchName} exists, checking out...`);
    const result = checkoutBranch(branchName);
    if (result.success) {
      logger.success(`Checked out branch: ${branchName}`);
    } else {
      logger.error(`Failed to checkout branch: ${result.stderr}`);
      process.exitCode = 1;
    }
  } else {
    logger.info(`Creating branch: ${branchName}`);
    const result = createBranch(branchName);
    if (result.success) {
      logger.success(`Created and checked out branch: ${branchName}`);
    } else {
      logger.error(`Failed to create branch: ${result.stderr}`);
      process.exitCode = 1;
    }
  }
}

function gitCommitCommand(change?: string) {
  if (!isGitRepo()) {
    logger.error(t('git.not_repo'));
    process.exitCode = 1;
    return;
  }

  const changeName = change || getChangeName();
  if (!changeName) {
    logger.error(t('git.no_change'));
    process.exitCode = 1;
    return;
  }

  const state = loadHarnessState();
  const tasks = parseMarkdownTasks(changeName);
  const completedTasks = tasks.filter((t) => t.checked).map((t) => t.title);

  const message = generateCommitMessage(state.activeFlow || 'default', changeName, completedTasks);

  if (hasUncommittedChanges()) {
    const addResult = addFiles(['.']);
    if (!addResult.success) {
      logger.error(`Failed to add files: ${addResult.stderr}`);
      process.exitCode = 1;
      return;
    }

    const commitResult = commit(message);
    if (commitResult.success) {
      logger.success(`Committed successfully: ${message.split('\n')[0]}`);
    } else {
      logger.error(`Failed to commit: ${commitResult.stderr}`);
      process.exitCode = 1;
    }
  } else {
    logger.info(t('git.no_changes'));
  }
}

function gitStatusCommand() {
  if (!isGitRepo()) {
    logger.error(t('git.not_repo'));
    process.exitCode = 1;
    return;
  }

  const hasChanges = hasUncommittedChanges();
  const currentBranch = getCurrentBranch();

  if (isJsonOutput()) {
    console.log(
      JSON.stringify({
        branch: currentBranch,
        hasChanges,
        message: hasChanges ? t('git.has_changes') : t('git.clean'),
      }),
    );
  } else {
    logger.info(`Current branch: ${currentBranch || 'unknown'}`);
    if (hasChanges) {
      logger.warn(t('git.has_changes'));
    } else {
      logger.success(t('git.clean'));
    }
  }
}

function gitInitCommand() {
  if (isGitRepo()) {
    logger.warn(t('git.already_repo'));
    return;
  }

  const result = initRepo();
  if (result.success) {
    logger.success(t('git.init_success'));
  } else {
    logger.error(`Failed to initialize git repo: ${result.stderr}`);
    process.exitCode = 1;
  }
}

function gitInfoCommand() {
  const info = getRepoInfo();
  if (isJsonOutput()) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log('=== Repository Info ===');
    console.log(`Is Git Repo: ${info.isRepo ? 'Yes' : 'No'}`);
    console.log(`Current Branch: ${info.branch || 'N/A'}`);
    console.log(`Has Uncommitted Changes: ${info.hasChanges ? 'Yes' : 'No'}`);
    console.log(`Commit Count: ${info.commitCount}`);
    console.log(`Last Commit: ${info.lastCommit || 'N/A'}`);
  }
}
