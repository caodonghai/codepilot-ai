import fs from 'fs';
import path from 'path';
import { resolvePath } from '../../utils/file';

export function checkWritable(relativePath: string) {
  const filePath = resolvePath(relativePath);
  try {
    if (fs.existsSync(filePath)) {
      const handle = fs.openSync(filePath, 'r+');
      fs.closeSync(handle);
    } else {
      fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
    }
    return { status: 'passed' as const };
  } catch (error) {
    return { status: 'failed' as const, reason: (error as Error).message };
  }
}

export function isActiveCodexSkillLock(relativePath: string, reason?: string) {
  return (
    process.platform === 'win32' &&
    relativePath.startsWith('.codex/skills/') &&
    relativePath.endsWith('/SKILL.md') &&
    Boolean(reason?.includes('EPERM'))
  );
}
