import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, describe, expect, test } from 'vitest';
import { validateBackupArchive } from '../src/commands/backup';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('备份归档安全', () => {
  test('只接受 harness 目录内的条目', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codepilot-archive-'));
    temporaryDirectories.push(directory);
    fs.mkdirSync(path.join(directory, 'harness'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'harness', 'state.json'), '{}');
    const archive = path.join(directory, 'safe.tar.gz');
    execFileSync('tar', ['-czf', archive, 'harness'], { cwd: directory });
    expect(validateBackupArchive(archive)).toContain('harness/state.json');
  });

  test('拒绝 harness 外部条目', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codepilot-archive-'));
    temporaryDirectories.push(directory);
    fs.writeFileSync(path.join(directory, 'outside.txt'), 'unsafe');
    const archive = path.join(directory, 'unsafe.tar.gz');
    execFileSync('tar', ['-czf', archive, 'outside.txt'], { cwd: directory });
    expect(() => validateBackupArchive(archive)).toThrow('outside harness');
  });
});
