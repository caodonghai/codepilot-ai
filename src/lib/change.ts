import fs from 'fs';
import path from 'path';
import { resolvePath, ensureDir, writeGeneratedFile, requiredChangeFiles, changeTypes, kebabName } from './utils';

export interface ChangeInfo {
  name: string;
  type: string;
  createdAt: string;
  completedAt?: string;
  status: 'active' | 'completed' | 'archived';
}

export function changeDirectoryPath(change: string) {
  return resolvePath('openspec', 'changes', change);
}

export function archiveDirectoryPath(change: string) {
  return resolvePath('openspec', 'archive', change);
}

export function validateChangeStructure(change: string) {
  const changeDir = changeDirectoryPath(change);
  if (!fs.existsSync(changeDir)) {
    return { valid: false, errors: [`Change directory not found: openspec/changes/${change}`] };
  }

  const errors: string[] = [];
  const missingFiles = requiredChangeFiles.filter((file) => !fs.existsSync(path.join(changeDir, file)));
  if (missingFiles.length) {
    errors.push(`Missing required files: ${missingFiles.join(', ')}`);
  }

  for (const file of requiredChangeFiles) {
    const filePath = path.join(changeDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.trim()) {
        errors.push(`Empty file: openspec/changes/${change}/${file}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function listChanges(): ChangeInfo[] {
  const changesDir = resolvePath('openspec', 'changes');
  if (!fs.existsSync(changesDir)) return [];

  const changes: ChangeInfo[] = [];
  for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const changeDir = path.join(changesDir, entry.name);
    const proposalPath = path.join(changeDir, 'proposal.md');
    let type = 'default';
    let createdAt = '';

    if (fs.existsSync(proposalPath)) {
      const content = fs.readFileSync(proposalPath, 'utf8');
      const typeMatch = content.match(/^## Type\s*\n\s*(\w+)/m);
      if (typeMatch) type = typeMatch[1];

      const stats = fs.statSync(proposalPath);
      createdAt = stats.birthtime.toISOString().slice(0, 10);
    }

    changes.push({
      name: entry.name,
      type: changeTypes.includes(type) ? type : 'default',
      createdAt,
      status: 'active',
    });
  }

  return changes;
}

export function listArchivedChanges(): ChangeInfo[] {
  const archiveDir = resolvePath('openspec', 'archive');
  if (!fs.existsSync(archiveDir)) return [];

  const changes: ChangeInfo[] = [];
  for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const changeDir = path.join(archiveDir, entry.name);
    const proposalPath = path.join(changeDir, 'proposal.md');
    let type = 'default';
    let createdAt = '';

    if (fs.existsSync(proposalPath)) {
      const content = fs.readFileSync(proposalPath, 'utf8');
      const typeMatch = content.match(/^## Type\s*\n\s*(\w+)/m);
      if (typeMatch) type = typeMatch[1];

      const stats = fs.statSync(proposalPath);
      createdAt = stats.birthtime.toISOString().slice(0, 10);
    }

    const archiveInfoPath = path.join(changeDir, '.archive-info.json');
    let completedAt: string | undefined;
    if (fs.existsSync(archiveInfoPath)) {
      try {
        const archiveInfo = JSON.parse(fs.readFileSync(archiveInfoPath, 'utf8'));
        completedAt = archiveInfo.completedAt;
      } catch {
      }
    }

    changes.push({
      name: entry.name,
      type: changeTypes.includes(type) ? type : 'default',
      createdAt,
      completedAt,
      status: 'archived',
    });
  }

  return changes;
}

export function archiveChange(change: string) {
  const sourceDir = changeDirectoryPath(change);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Change not found: ${change}`);
  }

  const validation = validateChangeStructure(change);
  if (!validation.valid) {
    throw new Error(`Cannot archive incomplete change: ${validation.errors.join('; ')}`);
  }

  const targetDir = archiveDirectoryPath(change);
  ensureDir('openspec', 'archive');

  if (fs.existsSync(targetDir)) {
    throw new Error(`Change already archived: ${change}`);
  }

  copyDirectoryRecursive(sourceDir, targetDir);

  const archiveInfo = {
    archivedAt: new Date().toISOString(),
    completedAt: new Date().toISOString().slice(0, 10),
    change,
  };
  writeGeneratedFile(path.join('openspec', 'archive', change, '.archive-info.json'), `${JSON.stringify(archiveInfo, null, 2)}\n`);

  fs.rmSync(sourceDir, { recursive: true, force: true });

  return { archivedAt: archiveInfo.archivedAt, targetDir: path.relative(resolvePath('.'), targetDir) };
}

export function restoreChange(change: string) {
  const sourceDir = archiveDirectoryPath(change);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Archived change not found: ${change}`);
  }

  const targetDir = changeDirectoryPath(change);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Change already exists: ${change}`);
  }

  copyDirectoryRecursive(sourceDir, targetDir);

  const archiveInfoPath = path.join(targetDir, '.archive-info.json');
  if (fs.existsSync(archiveInfoPath)) {
    fs.unlinkSync(archiveInfoPath);
  }

  return { restoredAt: new Date().toISOString(), targetDir: path.relative(resolvePath('.'), targetDir) };
}

export function deleteArchivedChange(change: string) {
  const archiveDir = archiveDirectoryPath(change);
  if (!fs.existsSync(archiveDir)) {
    throw new Error(`Archived change not found: ${change}`);
  }

  fs.rmSync(archiveDir, { recursive: true, force: true });
  return { deletedAt: new Date().toISOString() };
}

function copyDirectoryRecursive(source: string, target: string) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

export function createChange(change: string, type: string = 'default') {
  const changeDir = changeDirectoryPath(change);
  if (fs.existsSync(changeDir)) {
    throw new Error(`Change already exists: ${change}`);
  }

  ensureDir('openspec', 'changes', change);

  const { templateChangeFile } = require('./templates');
  for (const file of requiredChangeFiles) {
    writeGeneratedFile(path.join('openspec', 'changes', change, file), templateChangeFile(change, file, type));
  }

  const notesPath = path.join('openspec', 'changes', change, 'notes.md');
  if (!fs.existsSync(notesPath)) {
    writeGeneratedFile(notesPath, templateChangeFile(change, 'notes.md', type));
  }

  return { createdAt: new Date().toISOString(), changeDir: path.relative(resolvePath('.'), changeDir) };
}
