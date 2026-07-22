import fs from 'fs';
import { resolvePath, writeGeneratedFile, ensureDir } from '../utils/file';
import { defaultTools } from '../config/constants';
import { withLock } from './lock';
import type { ProjectInfo } from '../types';

export interface HarnessConfig {
  version?: number;
  profile?: string;
  currentChange?: string | null;
  tools?: string[];
  checks?: string[];
  strictChecks?: string[];
  project?: ProjectInfo;
}

export interface HarnessState {
  version: number;
  activeChange: string | null;
  activeFlow: string | null;
  status: string;
  phase: string | null;
  lastStep: string | null;
  nextStep: string | null;
  lastReport: string | null;
  nextSuggestedFlow: string | null;
  blockedBy: string[];
  decisions: Array<{
    text: string;
    createdAt: string;
    change?: string | null;
    flow?: string | null;
  }>;
  context: Record<string, unknown>;
  updatedAt: string | null;
}

export function loadHarnessConfig(): HarnessConfig {
  const configPath = resolvePath('harness', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { currentChange: null, tools: defaultTools };
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Invalid harness/config.json: ${(error as Error).message}`);
    return { currentChange: null, tools: defaultTools };
  }
}

export function saveHarnessConfig(config: Record<string, unknown>) {
  writeGeneratedFile('harness/config.json', `${JSON.stringify(config, null, 2)}\n`);
}

export function setCurrentChange(change: string) {
  withLock('state', () => {
    const config = loadHarnessConfig();
    saveHarnessConfig({
      version: config.version ?? 1,
      profile: config.profile ?? 'lightweight',
      currentChange: change,
      tools: config.tools ?? defaultTools,
      checks: config.checks ?? ['ai:validate', 'ai:report'],
      strictChecks: config.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
      project: config.project,
    });
  });
}

export function loadHarnessState(): HarnessState {
  const statePath = resolvePath('harness', 'state.json');
  if (!fs.existsSync(statePath)) {
    return {
      version: 1,
      activeChange: null,
      activeFlow: null,
      status: 'not_started',
      phase: null,
      lastStep: null,
      nextStep: null,
      lastReport: null,
      nextSuggestedFlow: null,
      blockedBy: [],
      decisions: [],
      context: {},
      updatedAt: null,
    };
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.error(`Invalid harness/state.json: ${(error as Error).message}`);
    return {
      version: 1,
      activeChange: null,
      activeFlow: null,
      status: 'not_started',
      phase: null,
      lastStep: null,
      nextStep: null,
      lastReport: null,
      nextSuggestedFlow: null,
      blockedBy: [],
      decisions: [],
      context: {},
      updatedAt: null,
    };
  }
}

export function saveHarnessState(state: HarnessState | Record<string, unknown>) {
  writeGeneratedFile('harness/state.json', `${JSON.stringify(state, null, 2)}\n`);
}

export function updateHarnessState(patch: Record<string, unknown>) {
  withLock('state', () => {
    const state = loadHarnessState();
    saveHarnessState({
      ...state,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  });
}

export function buildChangeContext(change: string) {
  return {
    proposal: `openspec/changes/${change}/proposal.md`,
    tasks: `openspec/changes/${change}/tasks.md`,
    acceptance: `openspec/changes/${change}/acceptance.md`,
    notes: `openspec/changes/${change}/notes.md`,
  };
}

export function getChangeName(input?: string): string | null {
  if (input) return input;
  const config = loadHarnessConfig();
  return typeof config.currentChange === 'string' ? config.currentChange : null;
}

export function initHarness() {
  ensureDir('harness');
  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: config.currentChange ?? null,
    tools: config.tools ?? defaultTools,
    checks: config.checks ?? ['eslint', 'ai:validate', 'ai:report'],
    project: config.project,
  });
  const state = loadHarnessState();
  saveHarnessState(state);
}

export function writeRunEvent(kind: string, payload: Record<string, unknown>) {
  const state = loadHarnessState();
  const createdAt = new Date().toISOString();
  const event = {
    createdAt,
    kind,
    activeChange: state.activeChange ?? null,
    activeFlow: state.activeFlow ?? null,
    status: state.status ?? null,
    ...payload,
  };
  ensureDir('harness', 'runs');
  const { timestampForFile } = require('./utils');
  writeGeneratedFile(
    `harness/runs/${timestampForFile(new Date(createdAt))}-${kind}.json`,
    `${JSON.stringify(event, null, 2)}\n`,
  );
  return event;
}

export function writeTimestampedMarkdown(directory: string, basename: string, content: string) {
  const createdAt = new Date().toISOString();
  const { timestampForFile } = require('./utils');
  const filePath = `${directory}/${timestampForFile(new Date(createdAt))}-${basename}.md`;
  ensureDir(...directory.split('/'));
  writeGeneratedFile(filePath, content);
  return filePath;
}

export function taskBoardPath(change: string) {
  return `harness/tasks/${change}.json`;
}
