import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  archiveChange,
  restoreChange,
  deleteArchivedChange,
  listChanges,
  listArchivedChanges,
  validateChangeStructure,
  changeDirectoryPath,
  archiveDirectoryPath,
  createChange,
} from '../src/lib/change';
import { ensureDir, resolvePath, writeGeneratedFile } from '../src/utils/file';

describe('change 模块', () => {
  const testChange = 'test-change';
  const testChangeDir = changeDirectoryPath(testChange);
  const testArchiveDir = archiveDirectoryPath(testChange);

  beforeEach(() => {
    if (fs.existsSync(testChangeDir)) {
      fs.rmSync(testChangeDir, { recursive: true });
    }
    if (fs.existsSync(testArchiveDir)) {
      fs.rmSync(testArchiveDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testChangeDir)) {
      fs.rmSync(testChangeDir, { recursive: true });
    }
    if (fs.existsSync(testArchiveDir)) {
      fs.rmSync(testArchiveDir, { recursive: true });
    }
  });

  test('changeDirectoryPath 返回正确路径', () => {
    expect(changeDirectoryPath('test')).toBe(resolvePath('openspec', 'changes', 'test'));
  });

  test('archiveDirectoryPath 返回正确路径', () => {
    expect(archiveDirectoryPath('test')).toBe(resolvePath('openspec', 'archive', 'test'));
  });

  test.each(['../outside', '../../outside', '/tmp/outside', 'invalid/name', 'UPPERCASE'])(
    '拒绝不安全的变更名 %s',
    (change) => {
      expect(() => changeDirectoryPath(change)).toThrow('Invalid change name');
      expect(() => archiveDirectoryPath(change)).toThrow('Invalid change name');
    },
  );

  test('中文模板创建后仍能识别变更类型', () => {
    createChange(testChange, 'feature');

    expect(listChanges()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: testChange, type: 'feature' })]),
    );
  });

  test('validateChangeStructure 对不存在的目录返回错误', () => {
    const result = validateChangeStructure('non-existent-change');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Change directory not found');
  });

  test('validateChangeStructure 对不完整的变更返回错误', () => {
    ensureDir('openspec', 'changes', testChange);
    writeGeneratedFile(`openspec/changes/${testChange}/proposal.md`, '# Test');

    const result = validateChangeStructure(testChange);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tasks.md'))).toBe(true);
    expect(result.errors.some((e) => e.includes('acceptance.md'))).toBe(true);
  });

  test('validateChangeStructure 对完整的变更返回有效', () => {
    ensureDir('openspec', 'changes', testChange);
    writeGeneratedFile(`openspec/changes/${testChange}/proposal.md`, '# Test');
    writeGeneratedFile(`openspec/changes/${testChange}/tasks.md`, '# Tasks');
    writeGeneratedFile(`openspec/changes/${testChange}/acceptance.md`, '# Acceptance');

    const result = validateChangeStructure(testChange);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('listChanges 在没有变更时返回空数组', () => {
    const changes = listChanges();
    expect(Array.isArray(changes)).toBe(true);
  });

  test('listArchivedChanges 在没有归档变更时返回空数组', () => {
    const changes = listArchivedChanges();
    expect(Array.isArray(changes)).toBe(true);
  });

  test('archiveChange 将变更移动到归档', () => {
    ensureDir('openspec', 'changes', testChange);
    writeGeneratedFile(`openspec/changes/${testChange}/proposal.md`, '# Test');
    writeGeneratedFile(`openspec/changes/${testChange}/tasks.md`, '# Tasks');
    writeGeneratedFile(`openspec/changes/${testChange}/acceptance.md`, '# Acceptance');

    archiveChange(testChange);

    expect(fs.existsSync(testChangeDir)).toBe(false);
    expect(fs.existsSync(testArchiveDir)).toBe(true);
    expect(fs.existsSync(path.join(testArchiveDir, 'proposal.md'))).toBe(true);
    expect(fs.existsSync(path.join(testArchiveDir, '.archive-info.json'))).toBe(true);
  });

  test('restoreChange 从归档恢复变更', () => {
    ensureDir('openspec', 'archive', testChange);
    writeGeneratedFile(`openspec/archive/${testChange}/proposal.md`, '# Test');
    writeGeneratedFile(`openspec/archive/${testChange}/tasks.md`, '# Tasks');
    writeGeneratedFile(`openspec/archive/${testChange}/acceptance.md`, '# Acceptance');
    writeGeneratedFile(
      `openspec/archive/${testChange}/.archive-info.json`,
      '{"completedAt": "2024-01-01"}',
    );

    restoreChange(testChange);

    expect(fs.existsSync(testChangeDir)).toBe(true);
    expect(fs.existsSync(path.join(testChangeDir, 'proposal.md'))).toBe(true);
    expect(fs.existsSync(path.join(testChangeDir, '.archive-info.json'))).toBe(false);
  });

  test('deleteArchivedChange 删除归档变更', () => {
    ensureDir('openspec', 'archive', testChange);
    writeGeneratedFile(`openspec/archive/${testChange}/proposal.md`, '# Test');

    deleteArchivedChange(testChange);

    expect(fs.existsSync(testArchiveDir)).toBe(false);
  });
});
