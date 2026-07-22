import { Command } from 'commander';
import fs from 'fs';
import { spawnSync } from 'child_process';
import type { HarnessResult } from '../types';
import {
  defaultTools,
  coreFiles,
  flowNames,
  skillFiles,
  requiredChangeFiles,
  textFilesToCheck,
  root,
  parseChangeType,
} from '../config/constants';
import {
  resolvePath,
  exists,
  writeFileIfMissing,
  writeGeneratedFile,
  readText,
} from '../utils/file';
import { kebabName } from '../utils/string';
import { hasMojibake, fixMojibakeText } from '../utils/encoding';
import { loadHarnessConfig, saveHarnessConfig, updateHarnessState } from '../lib/state';
import { templateChangeFile, listTargetFiles } from './templates';
import { getChangeName, setCurrentChange, writeRunEvent } from './helpers/state';
import { buildChangeContext } from './helpers/common';
import { collectEncodingIssues } from './helpers/encoding';
import { prompt } from './helpers/ui';
import {
  archiveChange,
  restoreChange,
  deleteArchivedChange,
  listChanges,
  listArchivedChanges,
} from '../lib/change';

export function registerChangeCommands(program: Command) {
  program
    .command('new <change>')
    .description('Create a new OpenSpec change')
    .option('--type <type>', 'Change type', 'default')
    .option('--interactive', 'Interactive mode')
    .action(newCommand);

  program
    .command('encoding')
    .description('Check for encoding issues in change documents')
    .argument('[change]', 'Change name')
    .option('--fix', 'Attempt to fix mojibake')
    .action(encodingCommand);

  program
    .command('validate')
    .description('Validate AI harness and change files')
    .argument('[change]', 'Change name')
    .option('--quiet', 'Suppress success output')
    .action((change, options) => {
      const result = validateCommand(change, options);
      if (result.status === 'failed') process.exitCode = 1;
    });

  program
    .command('check')
    .description('Run validation and checks')
    .argument('[change]', 'Change name')
    .option('--strict', 'Include ESLint')
    .option('--no-eslint', 'Skip ESLint')
    .action(checkCommand);

  program
    .command('report')
    .description('Generate a harness report')
    .argument('[change]', 'Change name')
    .action(reportCommand);

  program
    .command('archive <change>')
    .description('Archive a completed change')
    .action(archiveCommand);

  program
    .command('restore <change>')
    .description('Restore an archived change')
    .action(restoreCommand);

  program.command('delete <change>').description('Delete an archived change').action(deleteCommand);

  program
    .command('list')
    .description('List all changes')
    .option('--archived', 'Show archived changes')
    .action(listCommand);
}

export async function newCommand(
  changeInput: string | undefined,
  options: { type?: string; interactive?: boolean } = {},
) {
  let change = changeInput ? kebabName(changeInput) : '';
  let type = parseChangeType(options.type);

  if (options.interactive) {
    change = kebabName(await prompt('Enter change name: '));
    while (!change) {
      change = kebabName(await prompt('Change name is required. Enter change name: '));
    }
    type = parseChangeType(
      (await prompt('Select change type (default/bugfix/feature/ui-change/refactor): ')) ||
        'default',
    );
  }

  if (!change) {
    throw new Error('Change name is required.');
  }

  for (const file of [...requiredChangeFiles, 'notes.md']) {
    writeFileIfMissing(
      `openspec/changes/${change}/${file}`,
      templateChangeFile(change, file, type),
    );
  }

  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: change,
    tools: config.tools ?? defaultTools,
    checks: config.checks ?? ['eslint', 'ai:validate', 'ai:report'],
  });
  updateHarnessState({
    activeChange: change,
    activeFlow: 'propose',
    status: 'in_progress',
    phase: 'proposal',
    lastStep: `Created ${type} change ${change}`,
    nextStep: 'Refine proposal, tasks, and acceptance criteria',
    nextSuggestedFlow: 'propose',
    blockedBy: [],
    context: buildChangeContext(change),
  });
  writeRunEvent('change-created', { change, type });

  console.log(`Created OpenSpec-compatible ${type} change: ${change}`);
}

function encodingCommand(changeInput?: string, options: { fix?: boolean } = {}) {
  const change = getChangeName(changeInput) ?? undefined;
  const issues = collectEncodingIssues(change);
  if (!issues.length) {
    console.log(
      change
        ? `No mojibake detected for change: ${change}`
        : 'No mojibake detected in OpenSpec change documents.',
    );
    return;
  }
  console.log(`Possible mojibake detected:\n${issues.map((item) => `- ${item}`).join('\n')}`);
  if (!options.fix) {
    console.log('Run with --fix to attempt a latin1-to-utf8 repair for detected files.');
    process.exitCode = 1;
    return;
  }
  const fixed: string[] = [];
  const unchanged: string[] = [];
  for (const relativePath of issues) {
    const current = readText(relativePath);
    const next = fixMojibakeText(current);
    if (next !== current) {
      writeGeneratedFile(relativePath, next);
      fixed.push(relativePath);
    } else {
      unchanged.push(relativePath);
    }
  }
  if (fixed.length) console.log(`Fixed files:\n${fixed.map((item) => `- ${item}`).join('\n')}`);
  if (unchanged.length)
    console.log(`Could not safely fix:\n${unchanged.map((item) => `- ${item}`).join('\n')}`);
  if (unchanged.length) process.exitCode = 1;
}

export function validateCommand(changeInput?: string, options: { quiet?: boolean } = {}) {
  const errors: string[] = [];
  const checkFile = (relativePath: string) => {
    if (!exists(relativePath)) errors.push(`Missing ${relativePath}`);
  };

  for (const file of coreFiles) checkFile(`.ai/core/${file}`);
  for (const flow of flowNames) checkFile(`.ai/flows/${flow}.md`);
  for (const file of skillFiles) checkFile(`superpowers/skills/${file}`);
  checkFile('openspec/project.md');
  checkFile('harness/config.json');
  checkFile('harness/state.json');
  checkFile('.ai/registry/tools.json');

  try {
    loadHarnessConfig();
  } catch (error) {
    errors.push(`Invalid harness/config.json: ${(error as Error).message}`);
  }

  const change = getChangeName(changeInput);
  if (changeInput && change) {
    setCurrentChange(change);
  }
  if (change) {
    for (const file of requiredChangeFiles) {
      checkFile(`openspec/changes/${change}/${file}`);
    }
    for (const file of textFilesToCheck) {
      const relativePath = `openspec/changes/${change}/${file}`;
      if (exists(relativePath) && hasMojibake(readText(relativePath))) {
        errors.push(
          `Possible mojibake detected in ${relativePath}. Ensure UTF-8 output in Windows/Codex/PowerShell.`,
        );
      }
    }
  }

  const config = loadHarnessConfig();
  const tools = (config.tools || defaultTools) as string[];
  for (const tool of tools) {
    for (const file of listTargetFiles(tool) || []) {
      checkFile(file);
    }
  }

  if (errors.length) {
    if (!options.quiet) {
      console.error(`AI validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    }
    return { status: 'failed' as const, errors };
  }

  if (!options.quiet) {
    console.log(change ? `AI validation passed for change: ${change}` : 'AI validation passed');
  }
  return { status: 'passed' as const, errors: [] };
}

function runEslintCommand(): HarnessResult {
  const eslintPath = resolvePath('node_modules', 'eslint', 'bin', 'eslint.js');
  const startedAt = Date.now();
  if (!fs.existsSync(eslintPath)) {
    return {
      command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
      status: 'failed',
      exitCode: 1,
      durationMs: Date.now() - startedAt,
      reason: 'Missing local ESLint binary. Run pnpm install first.',
    };
  }
  const result = spawnSync(process.execPath, [eslintPath, '--ext', '.tsx,.ts', './apps'], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    command: 'node node_modules/eslint/bin/eslint.js --ext .tsx,.ts ./apps',
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    durationMs: Date.now() - startedAt,
    reason: result.error?.message,
  };
}

function writeReport(
  changeInput: string | undefined,
  results: HarnessResult[],
  status?: 'passed' | 'failed',
) {
  const config = loadHarnessConfig();
  const change = getChangeName(changeInput);
  if (changeInput && change) {
    setCurrentChange(change);
  }
  const finalStatus =
    status ?? (results.every((item) => item.status === 'passed') ? 'passed' : 'failed');
  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const report = {
    createdAt: timestamp,
    profile: config.profile ?? 'lightweight',
    scope: change ?? 'root',
    change,
    dryRun: false,
    status: finalStatus,
    tools: config.tools ?? defaultTools,
    results,
  };

  writeGeneratedFile(
    `harness/reports/${fileTimestamp}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  updateHarnessState({
    activeChange: change ?? null,
    status: finalStatus === 'passed' ? 'accepted' : 'blocked',
    phase: finalStatus === 'passed' ? 'finishing' : 'blocked',
    lastStep: `Generated report harness/reports/${fileTimestamp}.json`,
    lastReport: `harness/reports/${fileTimestamp}.json`,
    nextSuggestedFlow: finalStatus === 'passed' ? 'finish' : 'verify',
    blockedBy:
      finalStatus === 'passed'
        ? []
        : results.filter((item) => item.status === 'failed').map((item) => item.command),
    context: change ? buildChangeContext(change) : {},
  });
  writeRunEvent('report', {
    change,
    status: finalStatus,
    reportPath: `harness/reports/${fileTimestamp}.json`,
    results,
  });
  console.log(`Harness report generated: harness/reports/${fileTimestamp}.json`);
  return report;
}

function reportCommand(changeInput?: string) {
  writeReport(changeInput, [
    {
      command: 'ai:report',
      status: 'passed',
      exitCode: 0,
      durationMs: 0,
      reason: 'Report generated on demand.',
    },
  ]);
}

function checkCommand(
  changeInput?: string,
  options: { strict?: boolean; noEslint?: boolean } = {},
) {
  const results: HarnessResult[] = [];

  if (!options.noEslint && options.strict) {
    results.push(runEslintCommand());
  }

  const startedAt = Date.now();
  const validation = validateCommand(changeInput, { quiet: true });
  if (validation.status === 'failed') {
    console.error(
      `AI validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`,
    );
  }
  results.push({
    command: changeInput ? `pnpm ai validate ${changeInput}` : 'pnpm ai validate',
    status: validation.status,
    exitCode: validation.status === 'passed' ? 0 : 1,
    durationMs: Date.now() - startedAt,
    reason: validation.errors.join('; ') || undefined,
  });

  const finalStatus = results.every((item) => item.status === 'passed') ? 'passed' : 'failed';
  writeReport(changeInput, results, finalStatus);
  if (finalStatus === 'failed') {
    process.exitCode = 1;
  }
}

function archiveCommand(change: string) {
  try {
    const result = archiveChange(change);
    console.log(`Change archived: ${change}`);
    console.log(`Target: ${result.targetDir}`);
    console.log(`Archived at: ${result.archivedAt}`);
    writeRunEvent('change-archived', { change, ...result });
  } catch (error) {
    console.error(`Error archiving change: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function restoreCommand(change: string) {
  try {
    const result = restoreChange(change);
    console.log(`Change restored: ${change}`);
    console.log(`Target: ${result.targetDir}`);
    console.log(`Restored at: ${result.restoredAt}`);
    writeRunEvent('change-restored', { change, ...result });
  } catch (error) {
    console.error(`Error restoring change: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function deleteCommand(change: string) {
  try {
    const result = deleteArchivedChange(change);
    console.log(`Archived change deleted: ${change}`);
    console.log(`Deleted at: ${result.deletedAt}`);
    writeRunEvent('change-deleted', { change, ...result });
  } catch (error) {
    console.error(`Error deleting archived change: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function listCommand(options: { archived?: boolean }) {
  const changes = options.archived ? listArchivedChanges() : listChanges();
  if (!changes.length) {
    console.log(options.archived ? 'No archived changes found.' : 'No changes found.');
    return;
  }
  console.log(JSON.stringify(changes, null, 2));
}
