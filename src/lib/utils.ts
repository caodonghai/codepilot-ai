import fs from 'fs';
import path from 'path';
import type {
  ToolName,
  HarnessPhase,
  ChangeType,
  KnowledgeType,
  IntegrationName,
  IntegrationMode,
} from '../types';

export const root = process.cwd();
export const defaultTools: ToolName[] = ['codex', 'trae', 'qoder', 'cursor'];
export const coreFiles = ['project.md', 'frontend.md', 'api.md', 'ui.md', 'testing.md', 'review.md', 'workflow.md'];
export const dispatcherFlow = 'ai';
export const flowNames = ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish'];
export const skillFiles = ['planning.md', 'tdd.md', 'debugging.md', 'code-review.md', 'finishing.md'];
export const requiredChangeFiles = ['proposal.md', 'tasks.md', 'acceptance.md'];
export const mojibakePatterns = [
  '\u7ead',
  '\u93c4',
  '\u95be\u6735',
  '\u7035\u7858',
  '\u8dfa\u5ba0',
  '\u7a0b\u5b2a',
  '\u9286?',
  '\u9225?',
  '\u20ac?',
  '\u951f',
  '\ufffd',
];
export const textFilesToCheck = ['proposal.md', 'tasks.md', 'acceptance.md', 'notes.md', 'conversation-report.txt'];
export const changeTypes: ChangeType[] = ['default', 'bugfix', 'feature', 'ui-change', 'refactor'];
export const knowledgeTypes: KnowledgeType[] = ['component', 'function', 'pattern', 'decision', 'failure'];
export const integrationNames: IntegrationName[] = ['openspec', 'superpowers'];
export const integrationModes: IntegrationMode[] = ['lightweight', 'official', 'hybrid'];
export const integrationGitSources: Record<IntegrationName, string> = {
  openspec: 'https://github.com/Fission-AI/OpenSpec.git',
  superpowers: 'https://github.com/obra/superpowers.git',
};
export const knowledgeFiles: Record<KnowledgeType, string> = {
  component: 'components.jsonl',
  function: 'functions.jsonl',
  pattern: 'patterns.jsonl',
  decision: 'decisions.jsonl',
  failure: 'failures.jsonl',
};
export const phaseByFlow: Record<string, HarnessPhase> = {
  explore: 'exploration',
  propose: 'proposal',
  plan: 'planning',
  apply: 'implementation',
  verify: 'verification',
  review: 'verification',
  finish: 'finishing',
};

export function resolvePath(...segments: string[]) {
  return path.join(root, ...segments);
}

export function exists(...segments: string[]) {
  return fs.existsSync(resolvePath(...segments));
}

export function ensureDir(...segments: string[]) {
  fs.mkdirSync(resolvePath(...segments), { recursive: true });
}

export function writeFileIfMissing(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

export function writeGeneratedFile(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function readText(relativePath: string) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

export function parseTools(value?: string): ToolName[] {
  if (!value) return defaultTools;
  const tools = value.split(',').map((item) => item.trim()).filter(Boolean) as ToolName[];
  const unsupported = tools.filter((tool) => !defaultTools.includes(tool));
  if (unsupported.length) {
    throw new Error(`Unsupported tools: ${unsupported.join(', ')}. Supported tools: ${defaultTools.join(', ')}`);
  }
  return Array.from(new Set(tools));
}

export function parseToolArgs(args?: string[], optionValue?: string) {
  if (args?.length) return parseTools(args.join(','));
  return parseTools(optionValue);
}

export function parseIntegrationName(value?: string): IntegrationName {
  if (!value || !integrationNames.includes(value as IntegrationName)) {
    throw new Error(`Unsupported integration: ${value ?? ''}. Supported integrations: ${integrationNames.join(', ')}`);
  }
  return value as IntegrationName;
}

export function parseIntegrationMode(value?: string): IntegrationMode {
  if (!value || !integrationModes.includes(value as IntegrationMode)) {
    throw new Error(`Unsupported integration mode: ${value ?? ''}. Supported modes: ${integrationModes.join(', ')}`);
  }
  return value as IntegrationMode;
}

export function parseChangeType(value?: string): ChangeType {
  if (!value) return 'default';
  if (!changeTypes.includes(value as ChangeType)) {
    throw new Error(`Unsupported change type: ${value}. Supported types: ${changeTypes.join(', ')}`);
  }
  return value as ChangeType;
}

export function parseKnowledgeType(value?: string): KnowledgeType {
  if (!value || !knowledgeTypes.includes(value as KnowledgeType)) {
    throw new Error(`Unsupported knowledge type: ${value ?? ''}. Supported types: ${knowledgeTypes.join(', ')}`);
  }
  return value as KnowledgeType;
}

export function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function kebabName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

export function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

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

export function resolveInsideRoot(relativePath: string) {
  const fullPath = path.resolve(root, relativePath);
  const rootPath = path.resolve(root);
  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing path outside repository: ${relativePath}`);
  }
  return fullPath;
}
