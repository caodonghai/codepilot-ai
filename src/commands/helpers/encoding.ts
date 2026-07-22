import fs from 'fs';
import { textFilesToCheck } from '../../config/constants';
import { resolvePath, exists, readText } from '../../utils/file';
import { hasMojibake } from '../../utils/encoding';

export function collectEncodingIssues(change?: string) {
  const issues: string[] = [];
  const changes = change
    ? [change]
    : fs.existsSync(resolvePath('openspec', 'changes'))
      ? fs.readdirSync(resolvePath('openspec', 'changes')).filter((item) => {
          const fullPath = resolvePath('openspec', 'changes', item);
          return fs.statSync(fullPath).isDirectory();
        })
      : [];
  for (const item of changes) {
    for (const file of textFilesToCheck) {
      const relativePath = `openspec/changes/${item}/${file}`;
      if (exists(relativePath) && hasMojibake(readText(relativePath))) {
        issues.push(relativePath);
      }
    }
  }
  return issues;
}

export function readChangeText(change: string) {
  return textFilesToCheck
    .map((file) => {
      const relativePath = `openspec/changes/${change}/${file}`;
      return exists(relativePath) ? `\n# ${file}\n${readText(relativePath)}` : '';
    })
    .join('\n');
}
