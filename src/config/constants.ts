import type {
  ToolName,
  HarnessPhase,
  ChangeType,
  KnowledgeType,
  IntegrationName,
  IntegrationMode,
} from '../types';
import { getDefaultToolIds, getAllTools, getToolConfig } from './tools';

export const root = process.cwd();

export const defaultTools: ToolName[] = getDefaultToolIds();

export const supportedTools: ToolName[] = getAllTools().map((t) => t.id as ToolName);

export function getToolInfo(toolName: string) {
  return getToolConfig(toolName);
}

export const coreFiles = [
  'project.md',
  'frontend.md',
  'api.md',
  'ui.md',
  'testing.md',
  'review.md',
  'workflow.md',
];

export const dispatcherFlow = 'ai';

export const flowNames = ['explore', 'propose', 'plan', 'apply', 'verify', 'review', 'finish'];

export const skillFiles = [
  'planning.md',
  'tdd.md',
  'debugging.md',
  'code-review.md',
  'finishing.md',
];

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

export const textFilesToCheck = [
  'proposal.md',
  'tasks.md',
  'acceptance.md',
  'notes.md',
  'conversation-report.txt',
];

export const changeTypes: ChangeType[] = ['default', 'bugfix', 'feature', 'ui-change', 'refactor'];

export const knowledgeTypes: KnowledgeType[] = [
  'component',
  'function',
  'pattern',
  'decision',
  'failure',
];

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

export function parseTools(value?: string): ToolName[] {
  if (!value) return defaultTools;
  const tools = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as ToolName[];
  const unsupported = tools.filter((tool) => !supportedTools.includes(tool));
  if (unsupported.length) {
    throw new Error(
      `Unsupported tools: ${unsupported.join(', ')}. Supported tools: ${supportedTools.join(', ')}`,
    );
  }
  return Array.from(new Set(tools));
}

export function parseToolArgs(args?: string[], optionValue?: string): ToolName[] {
  if (args?.length) return parseTools(args.join(','));
  return parseTools(optionValue);
}

export function parseIntegrationName(value?: string): IntegrationName {
  if (!value || !integrationNames.includes(value as IntegrationName)) {
    throw new Error(
      `Unsupported integration: ${value ?? ''}. Supported integrations: ${integrationNames.join(', ')}`,
    );
  }
  return value as IntegrationName;
}

export function parseIntegrationMode(value?: string): IntegrationMode {
  if (!value || !integrationModes.includes(value as IntegrationMode)) {
    throw new Error(
      `Unsupported integration mode: ${value ?? ''}. Supported modes: ${integrationModes.join(', ')}`,
    );
  }
  return value as IntegrationMode;
}

export function parseChangeType(value?: string): ChangeType {
  if (!value) return 'default';
  if (!changeTypes.includes(value as ChangeType)) {
    throw new Error(
      `Unsupported change type: ${value}. Supported types: ${changeTypes.join(', ')}`,
    );
  }
  return value as ChangeType;
}

export function parseKnowledgeType(value?: string): KnowledgeType {
  if (!value || !knowledgeTypes.includes(value as KnowledgeType)) {
    throw new Error(
      `Unsupported knowledge type: ${value ?? ''}. Supported types: ${knowledgeTypes.join(', ')}`,
    );
  }
  return value as KnowledgeType;
}
