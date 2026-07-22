import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type {
  KnowledgeRecord,
  KnowledgeIndexRecord,
  KnowledgeType,
  KnowledgeStatus,
  KnowledgeConfidence,
} from '../types';
import { resolvePath, writeGeneratedFile, ensureDir } from '../utils/file';
import { knowledgeFiles, knowledgeTypes, parseKnowledgeType, root } from '../config/constants';
import { kebabName, uniqueValues, quoteShellArg } from '../utils/string';

export function normalizeKnowledgeRecord(record: Partial<KnowledgeRecord>): KnowledgeRecord {
  const now = new Date().toISOString().slice(0, 10);
  const type = parseKnowledgeType(record.type);
  const name = String(record.name ?? '').trim();
  const summary = String(record.summary ?? '').trim();
  if (!name) throw new Error('Knowledge name is required.');
  if (!summary) throw new Error('Knowledge summary is required.');
  const source = String(record.source ?? 'repo').trim();
  const scope = String(record.scope ?? 'global').trim();
  const id = String(record.id ?? `${type}:${kebabName(name)}:${kebabName(source || scope)}`).trim();
  return {
    id,
    type,
    name,
    scope,
    source,
    summary,
    keywords: uniqueValues(record.keywords ?? []),
    usedIn: uniqueValues(record.usedIn ?? []),
    status: (record.status ?? 'active') as KnowledgeStatus,
    confidence: (record.confidence ?? 'confirmed') as KnowledgeConfidence,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  };
}

export function knowledgeFilePath(type: KnowledgeType) {
  return resolvePath('harness', 'memory', 'knowledge', knowledgeFiles[type]);
}

export function readKnowledgeFile(type: KnowledgeType): KnowledgeRecord[] {
  const filePath = knowledgeFilePath(type);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return normalizeKnowledgeRecord(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `${path.relative(resolvePath('.'), filePath)}:${index + 1} ${(error as Error).message}`,
        );
      }
    });
}

export function writeKnowledgeFile(type: KnowledgeType, records: KnowledgeRecord[]) {
  ensureDir('harness', 'memory', 'knowledge');
  const lines = records
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((record) => JSON.stringify(record));
  fs.writeFileSync(
    knowledgeFilePath(type),
    `${lines.join('\n')}${lines.length ? '\n' : ''}`,
    'utf8',
  );
}

export function readAllKnowledgeRecords(): KnowledgeIndexRecord[] {
  const records: KnowledgeIndexRecord[] = [];
  for (const type of knowledgeTypes) {
    const file = `harness/memory/knowledge/${knowledgeFiles[type]}`;
    for (const record of readKnowledgeFile(type)) {
      records.push({
        ...record,
        file,
        searchText: buildKnowledgeSearchText(record),
      });
    }
  }
  return records;
}

export function mergeKnowledgeRecords(
  existing: KnowledgeRecord,
  incoming: KnowledgeRecord,
): KnowledgeRecord {
  return {
    ...existing,
    ...incoming,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: new Date().toISOString().slice(0, 10),
    keywords: uniqueValues([...existing.keywords, ...incoming.keywords]),
    usedIn: uniqueValues([...existing.usedIn, ...incoming.usedIn]),
  };
}

export function dedupeKnowledgeRecords(records: KnowledgeRecord[]): KnowledgeRecord[] {
  const byId = new Map<string, KnowledgeRecord>();
  for (const record of records) {
    const previous = byId.get(record.id);
    byId.set(record.id, previous ? mergeKnowledgeRecords(previous, record) : record);
  }
  return Array.from(byId.values());
}

export function tokenizeKnowledgeText(text: string) {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9_.:/@-]+|[\u4e00-\u9fa5]{2,}/g) ?? [];
  return uniqueValues(tokens);
}

export function buildKnowledgeSearchText(record: KnowledgeRecord) {
  return [
    record.id,
    record.type,
    record.name,
    record.scope,
    record.source,
    record.summary,
    ...record.keywords,
    ...record.usedIn,
  ]
    .join(' ')
    .toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array(a.length + 1)
    .fill(null)
    .map((_, i) =>
      Array(b.length + 1)
        .fill(null)
        .map((_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyMatchScore(searchTerm: string, target: string): number {
  const distance = levenshteinDistance(searchTerm, target);
  const maxLength = Math.max(searchTerm.length, target.length);
  const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
  if (similarity < 0.6) return 0;
  return Math.floor(similarity * 10);
}

export function buildKnowledgeIndex() {
  ensureDir('harness', 'memory', 'index');
  const records = readAllKnowledgeRecords();
  const keywords: Record<string, string[]> = {};
  const indexRecords: Record<string, Omit<KnowledgeIndexRecord, 'searchText'>> = {};
  const stats = {
    updatedAt: new Date().toISOString(),
    total: records.length,
    byType: Object.fromEntries(knowledgeTypes.map((type) => [type, 0])) as Record<
      KnowledgeType,
      number
    >,
    byStatus: { active: 0, deprecated: 0 } as Record<KnowledgeStatus, number>,
    byConfidence: { confirmed: 0, uncertain: 0 } as Record<KnowledgeConfidence, number>,
  };

  for (const record of records) {
    stats.byType[record.type] += 1;
    stats.byStatus[record.status] += 1;
    stats.byConfidence[record.confidence] += 1;
    const { searchText, ...indexRecord } = record;
    indexRecords[record.id] = indexRecord;
    for (const token of tokenizeKnowledgeText(searchText)) {
      keywords[token] = uniqueValues([...(keywords[token] ?? []), record.id]);
    }
  }

  writeGeneratedFile(
    'harness/memory/index/keywords.json',
    `${JSON.stringify(keywords, null, 2)}\n`,
  );
  writeGeneratedFile(
    'harness/memory/index/records.json',
    `${JSON.stringify(indexRecords, null, 2)}\n`,
  );
  writeGeneratedFile('harness/memory/index/stats.json', `${JSON.stringify(stats, null, 2)}\n`);
  return stats;
}

export function loadKnowledgeIndex(): KnowledgeIndexRecord[] {
  const recordsPath = resolvePath('harness', 'memory', 'index', 'records.json');
  if (!fs.existsSync(recordsPath)) buildKnowledgeIndex();
  const records = JSON.parse(fs.readFileSync(recordsPath, 'utf8')) as Record<
    string,
    Omit<KnowledgeIndexRecord, 'searchText'>
  >;
  return Object.values(records).map((record) => ({
    ...record,
    searchText: buildKnowledgeSearchText(record),
  }));
}

export function scoreKnowledgeRecord(
  record: KnowledgeIndexRecord,
  terms: string[],
  options: { fuzzy?: boolean } = {},
) {
  let score = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;

    if (record.id.toLowerCase().includes(normalized)) score += 8;
    if (record.name.toLowerCase().includes(normalized)) score += 6;
    if (record.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))) score += 5;
    if (record.summary.toLowerCase().includes(normalized)) score += 3;
    if (record.searchText.includes(normalized)) score += 1;

    if (options.fuzzy) {
      score += fuzzyMatchScore(normalized, record.name.toLowerCase()) * 2;
      score += fuzzyMatchScore(normalized, record.id.toLowerCase());
      for (const keyword of record.keywords) {
        score += fuzzyMatchScore(normalized, keyword.toLowerCase());
      }
    }
  }
  if (record.status === 'active') score += 1;
  if (record.confidence === 'confirmed') score += 1;
  return score;
}

export function searchKnowledge(
  terms: string[],
  options: { fuzzy?: boolean; limit?: number } = {},
): KnowledgeIndexRecord[] {
  const records = loadKnowledgeIndex();
  const scored = records.map((record) => ({
    record,
    score: scoreKnowledgeRecord(record, terms, { fuzzy: options.fuzzy }),
  }));
  const filtered = scored.filter((item) => item.score > 0);
  filtered.sort((a, b) => b.score - a.score);
  const limit = options.limit ?? 20;
  return filtered.slice(0, limit).map((item) => item.record);
}

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
    'pnpm ai knowledge add',
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
