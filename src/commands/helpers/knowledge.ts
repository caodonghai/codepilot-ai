import { spawnSync } from 'child_process';
import type { KnowledgeRecord } from '../../types';
import { root } from '../../config/constants';
import { quoteShellArg } from '../../utils/string';
import { uniqueValues } from '../../utils/string';

export function collectChangedFilesForKnowledge() {
  const result = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${root.replace(/\\/g, '/')}`,
      'status',
      '--short',
      '--',
      'apps',
      'packages',
    ],
    {
      cwd: root,
      shell: false,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((file) => file.startsWith('apps/') || file.startsWith('packages/'))
    .filter((file) => /\.(ts|tsx|js|jsx|md|json)$/.test(file))
    .slice(0, 20);
}

export function extractKnowledgeNames(text: string) {
  const names = new Set<string>();
  const fileLikePattern = /\.(md|json|ts|tsx|js|jsx|less|css)$/i;
  const lowValueNames = new Set([
    'category',
    'displayField',
    'helpId',
    'valueField',
    'dataSource',
    'children',
    'props',
    'state',
  ]);
  const codeNames = text.match(/`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?`/g) ?? [];
  for (const item of codeNames) {
    const name = item.replace(/`/g, '');
    if (!lowValueNames.has(name) && !fileLikePattern.test(name)) names.add(name);
  }
  const dotted = text.match(/\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/g) ?? [];
  for (const item of dotted) {
    if (!fileLikePattern.test(item)) names.add(item);
  }
  const constants = text.match(/\b[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g) ?? [];
  for (const item of constants) names.add(item);
  return Array.from(names)
    .sort((a, b) => {
      const score = (value: string) =>
        (value.includes('.') ? 3 : 0) +
        (/[A-Z_]/.test(value) ? 2 : 0) +
        (value.length > 12 ? 1 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    })
    .slice(0, 8);
}

export function extractReferencedFiles(text: string) {
  const matches = text.match(/\b(?:apps|packages)\/[^\s)`"'，。；,]+/g) ?? [];
  return uniqueValues(
    matches.map((item) => item.replace(/[:：]\d+$/, '').replace(/[.,;，。；]+$/, '')),
  );
}

export function buildKnowledgeAddCommand(record: Partial<KnowledgeRecord>) {
  const args = [
    'pnpm ai knowledge:add --',
    `--type ${record.type}`,
    `--name ${quoteShellArg(String(record.name ?? ''))}`,
    `--summary ${quoteShellArg(String(record.summary ?? ''))}`,
  ];
  if (record.scope) args.push(`--scope ${quoteShellArg(record.scope)}`);
  if (record.source) args.push(`--source ${quoteShellArg(record.source)}`);
  if (record.keywords?.length) args.push(`--keywords ${quoteShellArg(record.keywords.join(','))}`);
  if (record.usedIn?.length) args.push(`--used-in ${quoteShellArg(record.usedIn.join(','))}`);
  if (record.confidence) args.push(`--confidence ${record.confidence}`);
  return args.join(' ');
}
