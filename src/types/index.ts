export type ToolName = 'codex' | 'trae' | 'qoder' | 'cursor';
export type HarnessStatus = 'not_started' | 'in_progress' | 'accepted' | 'partially_accepted' | 'rejected' | 'blocked';
export type HarnessPhase = 'exploration' | 'proposal' | 'planning' | 'implementation' | 'verification' | 'finishing' | 'blocked';

export interface HarnessResult {
  command: string;
  status: 'passed' | 'failed';
  exitCode: number;
  durationMs: number;
  reason?: string;
}

export type HarnessTaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

export interface HarnessTask {
  id: string;
  title: string;
  status: HarnessTaskStatus;
  checked: boolean;
  sourceLine: number;
  owner: string | null;
  blockedBy: string | null;
  updatedAt: string;
}

export interface HarnessTaskBoard {
  version: number;
  change: string;
  source: string;
  updatedAt: string;
  tasks: HarnessTask[];
}

export type ChangeType = 'default' | 'bugfix' | 'feature' | 'ui-change' | 'refactor';
export type KnowledgeType = 'component' | 'function' | 'pattern' | 'decision' | 'failure';
export type KnowledgeStatus = 'active' | 'deprecated';
export type KnowledgeConfidence = 'confirmed' | 'uncertain';
export type IntegrationName = 'openspec' | 'superpowers';
export type IntegrationMode = 'lightweight' | 'official' | 'hybrid';

export interface IntegrationConfig {
  name: IntegrationName;
  mode: IntegrationMode;
  officialInstalled: boolean;
  officialPath: string;
  cachePath: string;
  source?: string | null;
  installedAt?: string | null;
  removedAt?: string | null;
  lastInstallDryRunAt?: string | null;
  updatedAt: string;
}

export interface KnowledgeRecord {
  id: string;
  type: KnowledgeType;
  name: string;
  scope: string;
  source: string;
  summary: string;
  keywords: string[];
  usedIn: string[];
  status: KnowledgeStatus;
  confidence: KnowledgeConfidence;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeIndexRecord extends KnowledgeRecord {
  file: string;
  searchText: string;
}
