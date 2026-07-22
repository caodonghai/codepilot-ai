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
} from '../src/lib/change';
import { resolvePath, ensureDir, writeGeneratedFile } from '../src/utils/file';

describe('change module', () => {
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

  test('changeDirectoryPath returns correct path', () => {
    expect(changeDirectoryPath('test')).toContain('openspec/changes/test');
  });

  test('archiveDirectoryPath returns correct path', () => {
    expect(archiveDirectoryPath('test')).toContain('openspec/archive/test');
  });

  test('validateChangeStructure returns error for missing directory', () => {
    const result = validateChangeStructure('non-existent-change');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Change directory not found');
  });

  test('validateChangeStructure returns error for incomplete change', () => {
    ensureDir('openspec', 'changes', testChange);
    writeGeneratedFile(`openspec/changes/${testChange}/proposal.md`, '# Test');

    const result = validateChangeStructure(testChange);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('tasks.md'))).toBe(true);
    expect(result.errors.some((e) => e.includes('acceptance.md'))).toBe(true);
  });

  test('validateChangeStructure returns valid for complete change', () => {
    ensureDir('openspec', 'changes', testChange);
    writeGeneratedFile(`openspec/changes/${testChange}/proposal.md`, '# Test');
    writeGeneratedFile(`openspec/changes/${testChange}/tasks.md`, '# Tasks');
    writeGeneratedFile(`openspec/changes/${testChange}/acceptance.md`, '# Acceptance');

    const result = validateChangeStructure(testChange);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('listChanges returns empty array when no changes exist', () => {
    const changes = listChanges();
    expect(Array.isArray(changes)).toBe(true);
  });

  test('listArchivedChanges returns empty array when no archived changes exist', () => {
    const changes = listArchivedChanges();
    expect(Array.isArray(changes)).toBe(true);
  });

  test('archiveChange moves change to archive', () => {
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

  test('restoreChange restores change from archive', () => {
    ensureDir('openspec', 'archive', testChange);
    writeGeneratedFile(`openspec/archive/${testChange}/proposal.md`, '# Test');
    writeGeneratedFile(`openspec/archive/${testChange}/tasks.md`, '# Tasks');
    writeGeneratedFile(`openspec/archive/${testChange}/acceptance.md`, '# Acceptance');
    writeGeneratedFile(`openspec/archive/${testChange}/.archive-info.json`, '{"completedAt": "2024-01-01"}');

    restoreChange(testChange);

    expect(fs.existsSync(testChangeDir)).toBe(true);
    expect(fs.existsSync(path.join(testChangeDir, 'proposal.md'))).toBe(true);
    expect(fs.existsSync(path.join(testChangeDir, '.archive-info.json'))).toBe(false);
  });

  test('deleteArchivedChange removes archived change', () => {
    ensureDir('openspec', 'archive', testChange);
    writeGeneratedFile(`openspec/archive/${testChange}/proposal.md`, '# Test');

    deleteArchivedChange(testChange);

    expect(fs.existsSync(testArchiveDir)).toBe(false);
  });
});
