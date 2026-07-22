import fs from 'fs';
import { mojibakePatterns, textFilesToCheck } from '../config/constants';
import { resolvePath, exists, readText } from './file';

export function textCorruptionScore(text: string) {
  const patternScore = mojibakePatterns.reduce((score, pattern) => {
    const matches = text.split(pattern).length - 1;
    return score + matches * 10;
  }, 0);
  const controlScore = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length * 20;
  return patternScore + controlScore;
}

export function hasMojibake(text: string) {
  return textCorruptionScore(text) > 0;
}

export function fixMojibakeText(text: string) {
  const buffer = Buffer.from(text, 'latin1');
  const decoded = buffer.toString('utf8');
  const beforeScore = textCorruptionScore(text);
  const afterScore = textCorruptionScore(decoded);
  return afterScore < beforeScore ? decoded : text;
}

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
