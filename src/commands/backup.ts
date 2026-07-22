import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { resolvePath, ensureDir } from '../utils/file';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';

export function registerBackupCommands(program: Command) {
  const backup = program.command('backup').description('Backup management commands');

  backup.command('create').description('Create backup').action(backupCreateCommand);

  backup.command('restore <file>').description('Restore from backup').action(backupRestoreCommand);

  backup.command('list').description('List backups').action(backupListCommand);

  backup.command('delete <file>').description('Delete backup').action(backupDeleteCommand);
}

const backupDir = 'harness/backups';

interface BackupInfo {
  filename: string;
  date: Date;
  size: number;
  path: string;
}

function getBackups(): BackupInfo[] {
  const dirPath = resolvePath(backupDir);
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.tar.gz'))
    .map((filename) => {
      const filePath = resolvePath(backupDir, filename);
      const stats = fs.statSync(filePath);
      const dateStr = filename.replace('.tar.gz', '').replace('backup-', '');
      return {
        filename,
        date: new Date(dateStr),
        size: stats.size,
        path: filePath,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function backupCreateCommand() {
  ensureDir(backupDir);

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `backup-${timestamp}.tar.gz`;
  const backupPath = resolvePath(backupDir, filename);

  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('tar', ['-czf', backupPath, 'harness'], {
      cwd: process.cwd(),
      shell: false,
      stdio: 'pipe',
    });

    if (result.status === 0) {
      const stats = fs.statSync(backupPath);
      if (isJsonOutput()) {
        console.log(
          JSON.stringify({
            status: 'success',
            filename,
            size: stats.size,
            date: new Date().toISOString(),
          }),
        );
      } else {
        logger.success(`Backup created: ${filename}`);
        logger.info(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    } else {
      const error = result.stderr?.toString('utf8') || 'Unknown error';
      logger.error(`Backup failed: ${error}`);
      process.exitCode = 1;
    }
  } catch (error) {
    logger.error(`Backup failed: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function backupRestoreCommand(file: string) {
  let backupPath = file;
  if (!path.isAbsolute(file)) {
    backupPath = resolvePath(backupDir, file);
  }

  if (!fs.existsSync(backupPath)) {
    logger.error(`Backup file not found: ${file}`);
    process.exitCode = 1;
    return;
  }

  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('tar', ['-xzf', backupPath], {
      cwd: process.cwd(),
      shell: false,
      stdio: 'pipe',
    });

    if (result.status === 0) {
      if (isJsonOutput()) {
        console.log(JSON.stringify({ status: 'success', file }));
      } else {
        logger.success(`Backup restored: ${file}`);
      }
    } else {
      const error = result.stderr?.toString('utf8') || 'Unknown error';
      logger.error(`Restore failed: ${error}`);
      process.exitCode = 1;
    }
  } catch (error) {
    logger.error(`Restore failed: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function backupListCommand() {
  const backups = getBackups();
  if (isJsonOutput()) {
    console.log(JSON.stringify(backups, null, 2));
  } else {
    if (!backups.length) {
      logger.info('No backups found');
      return;
    }
    console.log('=== Backups ===');
    for (const backup of backups) {
      console.log(
        `${backup.date.toLocaleString()} | ${(backup.size / 1024).toFixed(2)} KB | ${backup.filename}`,
      );
    }
  }
}

function backupDeleteCommand(file: string) {
  let backupPath = file;
  if (!path.isAbsolute(file)) {
    backupPath = resolvePath(backupDir, file);
  }

  if (!fs.existsSync(backupPath)) {
    logger.error(`Backup file not found: ${file}`);
    process.exitCode = 1;
    return;
  }

  fs.unlinkSync(backupPath);
  logger.success(`Backup deleted: ${file}`);
}
