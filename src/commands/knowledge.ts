import { Command } from 'commander';
import fs from 'fs';
import type { KnowledgeStatus, KnowledgeConfidence, KnowledgeType } from '../types';
import { resolvePath } from '../utils/file';
import { splitList, uniqueValues } from '../utils/string';
import {
  normalizeKnowledgeRecord,
  readKnowledgeFile,
  writeKnowledgeFile,
  readAllKnowledgeRecords,
  mergeKnowledgeRecords,
  dedupeKnowledgeRecords,
  buildKnowledgeIndex,
  loadKnowledgeIndex,
  scoreKnowledgeRecord,
} from '../lib/knowledge';
import { writeRunEvent, getChangeName } from './helpers/state';
import { readChangeText } from './helpers/encoding';
import { syncTaskBoard, taskSummary } from './helpers/task';

export function registerKnowledgeCommands(program: Command) {
  const knowledge = program.command('knowledge').description('Knowledge memory management');

  knowledge
    .command('add')
    .description('Add knowledge record')
    .option('--type <type>', 'Knowledge type')
    .option('--id <id>', 'Record ID')
    .option('--name <name>', 'Knowledge name')
    .option('--summary <summary>', 'Knowledge summary')
    .option('--scope <scope>', 'Scope')
    .option('--source <source>', 'Source')
    .option('--keywords <keywords>', 'Comma-separated keywords')
    .option('--used-in <usedIn>', 'Comma-separated used-in files')
    .option('--status <status>', 'Status')
    .option('--confidence <confidence>', 'Confidence level')
    .option('--from <from>', 'Load from JSON file')
    .action(knowledgeAddCommand);

  knowledge
    .command('search <terms...>')
    .description('Search knowledge')
    .option('--limit <limit>', 'Results limit', '10')
    .option('--all', 'Include inactive records')
    .option('--type <type>', 'Filter by type')
    .action(knowledgeSearchCommand);

  knowledge
    .command('list')
    .description('List knowledge records')
    .option('--type <type>', 'Filter by type')
    .option('--limit <limit>', 'Results limit', '50')
    .option('--all', 'Include inactive records')
    .action(knowledgeListCommand);

  knowledge.command('index').description('Build knowledge index').action(knowledgeIndexCommand);

  knowledge
    .command('dedupe')
    .description('Deduplicate knowledge records')
    .action(knowledgeDedupeCommand);

  knowledge
    .command('analyze')
    .description('Analyze knowledge base')
    .option('--limit <limit>', 'Top keywords limit', '10')
    .action(knowledgeAnalyzeCommand);

  knowledge
    .command('suggest')
    .description('Suggest knowledge from change')
    .argument('[change]', 'Change name')
    .option('--limit <limit>', 'Results limit', '8')
    .option('--write', 'Write suggestions to file')
    .action(knowledgeSuggestCommand);
}

function knowledgeAddCommand(options: {
  type?: string;
  id?: string;
  name?: string;
  summary?: string;
  scope?: string;
  source?: string;
  keywords?: string;
  usedIn?: string;
  status?: KnowledgeStatus;
  confidence?: KnowledgeConfidence;
  from?: string;
}) {
  const fromRecord = options.from
    ? (JSON.parse(fs.readFileSync(resolvePath(options.from), 'utf8')) as Record<string, unknown>)
    : {};
  const record = normalizeKnowledgeRecord({
    id: options.id ?? (fromRecord.id as string | undefined),
    type: (options.type ?? fromRecord.type) as KnowledgeType | undefined,
    name: options.name ?? (fromRecord.name as string | undefined),
    summary: options.summary ?? (fromRecord.summary as string | undefined),
    scope: options.scope ?? (fromRecord.scope as string | undefined),
    source: options.source ?? (fromRecord.source as string | undefined),
    keywords: options.keywords ? splitList(options.keywords) : (fromRecord.keywords as string[]),
    usedIn: options.usedIn ? splitList(options.usedIn) : (fromRecord.usedIn as string[]),
    status: options.status ?? (fromRecord.status as KnowledgeStatus) ?? 'active',
    confidence: options.confidence ?? (fromRecord.confidence as KnowledgeConfidence) ?? 'confirmed',
  });
  const records = readKnowledgeFile(record.type);
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = mergeKnowledgeRecords(records[existingIndex], record);
  } else {
    records.push(record);
  }
  writeKnowledgeFile(record.type, dedupeKnowledgeRecords(records));
  const stats = buildKnowledgeIndex();
  writeRunEvent('knowledge-add', { id: record.id, type: record.type });
  console.log(
    JSON.stringify({ status: existingIndex >= 0 ? 'merged' : 'added', record, stats }, null, 2),
  );
}

function knowledgeSearchCommand(
  termsInput: string[],
  options: { limit?: string; all?: boolean; type?: string } = {},
) {
  const terms = termsInput.length ? termsInput : [];
  if (!terms.length) throw new Error('At least one search keyword is required.');
  const limit = Number.parseInt(options.limit ?? '10', 10);
  const type = options.type ?? null;
  const records = loadKnowledgeIndex()
    .filter(
      (record) => options.all || (record.status === 'active' && record.confidence === 'confirmed'),
    )
    .filter((record) => !type || record.type === type)
    .map((record) => ({ record, score: scoreKnowledgeRecord(record, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);
  console.log(
    JSON.stringify(
      {
        query: terms,
        count: records.length,
        records: records.map(({ record, score }) => ({
          id: record.id,
          type: record.type,
          name: record.name,
          summary: record.summary,
          keywords: record.keywords,
          usedIn: record.usedIn,
          confidence: record.confidence,
          score,
        })),
      },
      null,
      2,
    ),
  );
}

function knowledgeListCommand(options: { type?: string; limit?: string; all?: boolean } = {}) {
  const limit = Number.parseInt(options.limit ?? '50', 10);
  const type = options.type ?? null;
  const records = loadKnowledgeIndex()
    .filter((record) => options.all || record.status === 'active')
    .filter((record) => !type || record.type === type)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 50);
  console.log(
    JSON.stringify(
      {
        count: records.length,
        records: records.map((record) => ({
          id: record.id,
          type: record.type,
          name: record.name,
          summary: record.summary,
          status: record.status,
          confidence: record.confidence,
          updatedAt: record.updatedAt,
        })),
      },
      null,
      2,
    ),
  );
}

function knowledgeIndexCommand() {
  const stats = buildKnowledgeIndex();
  console.log(JSON.stringify({ status: 'indexed', stats }, null, 2));
}

function knowledgeDedupeCommand() {
  const results: Record<string, { before: number; after: number }> = {};
  const types: KnowledgeType[] = ['component', 'function', 'pattern', 'decision', 'failure'];
  for (const type of types) {
    const before = readKnowledgeFile(type);
    const after = dedupeKnowledgeRecords(before);
    writeKnowledgeFile(type, after);
    results[type] = { before: before.length, after: after.length };
  }
  const stats = buildKnowledgeIndex();
  console.log(JSON.stringify({ status: 'deduped', results, stats }, null, 2));
}

function knowledgeAnalyzeCommand(options: { limit?: string } = {}) {
  const records = readAllKnowledgeRecords();
  const limit = Number.parseInt(options.limit ?? '10', 10);
  const byType = Object.fromEntries(
    ['component', 'function', 'pattern', 'decision', 'failure'].map((type) => [
      type,
      records.filter((record) => record.type === type).length,
    ]),
  );
  const uncertain = records.filter((record) => record.confidence === 'uncertain');
  const deprecated = records.filter((record) => record.status === 'deprecated');
  const keywordCounts = new Map<string, number>();
  for (const record of records) {
    for (const keyword of record.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10)
    .map(([keyword, count]) => ({ keyword, count }));
  const suggestions = [
    records.length < 10
      ? 'Knowledge base is still small. Prefer adding confirmed facts from real changes before creating skills.'
      : null,
    uncertain.length
      ? `Review ${uncertain.length} uncertain records before treating them as reusable facts.`
      : null,
    (byType.failure ?? 0) === 0
      ? 'No failure records yet. Add repeated pitfalls after finish when confirmed.'
      : null,
    topKeywords.some((item) => item.count >= 3)
      ? 'Some keywords repeat across records; consider a future skill:suggest pass when there are at least 2-3 related confirmed cases.'
      : null,
  ].filter(Boolean);
  console.log(
    JSON.stringify(
      {
        status: 'analyzed',
        total: records.length,
        byType,
        uncertain: uncertain.map((record) => ({
          id: record.id,
          name: record.name,
          type: record.type,
        })),
        deprecated: deprecated.map((record) => ({
          id: record.id,
          name: record.name,
          type: record.type,
        })),
        topKeywords,
        suggestions,
      },
      null,
      2,
    ),
  );
}

function collectChangedFilesForKnowledge() {
  const { spawnSync } = require('child_process');
  const { root } = require('../lib/utils');
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
    .map((line: string) => line.replace(/\s+$/, ''))
    .filter(Boolean)
    .map((line: string) => line.slice(3).trim())
    .filter((file: string) => file.startsWith('apps/') || file.startsWith('packages/'))
    .filter((file: string) => /\.(ts|tsx|js|jsx|md|json)$/.test(file))
    .slice(0, 20);
}

function extractKnowledgeNames(text: string) {
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

function extractReferencedFiles(text: string) {
  const matches = text.match(/\b(?:apps|packages)\/[^\s)`"'，。；,]+/g) ?? [];
  return uniqueValues(
    matches.map((item) => item.replace(/[:：]\d+$/, '').replace(/[.,;，。；]+$/, '')),
  );
}

function buildKnowledgeAddCommand(record: Record<string, unknown>) {
  const args = [
    'pnpm ai knowledge:add --',
    `--type ${record.type}`,
    `--name "${String(record.name ?? '').replace(/"/g, '\\"')}"`,
    `--summary "${String(record.summary ?? '').replace(/"/g, '\\"')}"`,
  ];
  if (record.scope) args.push(`--scope "${String(record.scope).replace(/"/g, '\\"')}"`);
  if (record.source) args.push(`--source "${String(record.source).replace(/"/g, '\\"')}"`);
  if ((record.keywords as string[])?.length) {
    args.push(`--keywords "${(record.keywords as string[]).join(',').replace(/"/g, '\\"')}"`);
  }
  if ((record.usedIn as string[])?.length) {
    args.push(`--used-in "${(record.usedIn as string[]).join(',').replace(/"/g, '\\"')}"`);
  }
  if (record.confidence) args.push(`--confidence ${record.confidence}`);
  return args.join(' ');
}

function knowledgeSuggestCommand(
  changeInput?: string,
  options: { limit?: string; write?: boolean } = {},
) {
  const change = getChangeName(changeInput);
  if (!change) throw new Error('Change name is required.');
  const text = readChangeText(change);
  const board = fs.existsSync(resolvePath('openspec', 'changes', change, 'tasks.md'))
    ? syncTaskBoard(change)
    : null;
  const changedFiles = extractReferencedFiles(text).length
    ? extractReferencedFiles(text)
    : collectChangedFilesForKnowledge();
  const names = extractKnowledgeNames(text);
  const limit = Number.parseInt(options.limit ?? '8', 10);
  const candidates: Array<Record<string, unknown> & { reason: string; command: string }> = [];

  for (const name of names) {
    const isConstant = /^[A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(name);
    const record: Record<string, unknown> = {
      type: name.includes('.') ? 'function' : isConstant ? 'failure' : 'pattern',
      name,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm reusable usage or behavior for ${name} before adding.`,
      keywords: uniqueValues([change, name]),
      usedIn: changedFiles.slice(0, 5),
      status: 'active',
      confidence: 'uncertain',
    };
    candidates.push({
      ...record,
      reason: 'Named symbol found in change documents.',
      command: buildKnowledgeAddCommand(record),
    });
  }

  if (/原因|root cause|失败|blocked|风险|regression|bug/i.test(text)) {
    const record: Record<string, unknown> = {
      type: 'failure',
      name: `${change} failure/bug lesson`,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm the reusable failure cause, trigger condition, and prevention rule before adding.`,
      keywords: uniqueValues([change, 'failure', 'bug', '风险']),
      usedIn: changedFiles.slice(0, 5),
      status: 'active',
      confidence: 'uncertain',
    };
    candidates.push({
      ...record,
      reason: 'Change text mentions root cause, bug, risk, or failure.',
      command: buildKnowledgeAddCommand(record),
    });
  }

  if (/决策|decision|确认|保持|不修改|不影响/i.test(text)) {
    const record: Record<string, unknown> = {
      type: 'decision',
      name: `${change} confirmed decision`,
      scope: changedFiles[0]?.split('/').slice(0, 4).join('/') ?? 'repo',
      source: change,
      summary: `Candidate from ${change}: confirm the final product or technical decision before adding.`,
      keywords: uniqueValues([change, 'decision', '确认']),
      usedIn: changedFiles.slice(0, 5),
      status: 'active',
      confidence: 'uncertain',
    };
    candidates.push({
      ...record,
      reason: 'Change text mentions confirmed choices or preserved behavior.',
      command: buildKnowledgeAddCommand(record),
    });
  }

  const outputCandidates = candidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 8);
  const markdown = [
    `# Knowledge Suggestions: ${change}`,
    '',
    'These are candidates only. Confirm and edit summaries before adding them as facts.',
    '',
    `GeneratedAt: ${new Date().toISOString()}`,
    '',
    `Changed files considered: ${changedFiles.length ? changedFiles.join(', ') : 'none'}`,
    board ? `Task summary: ${taskSummary(board)}` : '',
    '',
    ...outputCandidates.flatMap((candidate, index) => [
      `## ${index + 1}. ${candidate.type}: ${candidate.name}`,
      '',
      `Reason: ${candidate.reason}`,
      '',
      `Summary: ${candidate.summary}`,
      '',
      'Suggested command:',
      '',
      '```bash',
      candidate.command,
      '```',
      '',
    ]),
    outputCandidates.length ? '' : 'No obvious reusable knowledge candidates found.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  let suggestionPath: string | null = null;
  if (options.write) {
    const createdAt = new Date().toISOString();
    const filePath = `openspec/changes/${change}/${createdAt.replace(/[:.]/g, '-')}-knowledge-suggestions.md`;
    require('../lib/utils').writeGeneratedFile(filePath, `${markdown}\n`);
    suggestionPath = filePath;
    writeRunEvent('knowledge-suggest', { change, suggestionPath, count: outputCandidates.length });
  }
  console.log(
    JSON.stringify(
      {
        change,
        count: outputCandidates.length,
        suggestionPath,
        candidates: outputCandidates.map((candidate) => ({
          type: candidate.type,
          name: candidate.name,
          reason: candidate.reason,
          summary: candidate.summary,
          command: candidate.command,
        })),
      },
      null,
      2,
    ),
  );
}
