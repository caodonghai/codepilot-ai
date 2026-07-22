import fs from 'fs';
import { resolvePath, writeGeneratedFile, ensureDir } from '../utils/file';
import { defaultTools } from '../config/constants';
import { withLock } from './lock';
import type { HarnessConfig, HarnessState, ProjectInfo } from '../types';

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
    project: config.project as ProjectInfo | undefined,
  });
  const state = loadHarnessState();
  saveHarnessState(state);
}

export function getDefaultConfig(): HarnessConfig {
  return {
    version: 1,
    profile: 'lightweight',
    currentChange: null,
    tools: defaultTools,
    checks: ['ai:validate', 'ai:report'],
    strictChecks: ['eslint', 'ai:validate', 'ai:report'],
    defaultFlow: 'ai',
    autoSave: true,
  };
}

export function validateConfig(
  config: Record<string, unknown>,
): Array<{ key: string; message: string }> {
  const errors: Array<{ key: string; message: string }> = [];
  if (config.version !== undefined && typeof config.version !== 'number') {
    errors.push({ key: 'version', message: 'version must be a number' });
  }
  if (
    config.profile !== undefined &&
    !['lightweight', 'standard', 'strict'].includes(String(config.profile))
  ) {
    errors.push({ key: 'profile', message: 'profile must be lightweight, standard, or strict' });
  }
  if (config.tools !== undefined && Array.isArray(config.tools)) {
    for (const tool of config.tools) {
      if (!defaultTools.includes(tool as string)) {
        errors.push({ key: 'tools', message: `invalid tool: ${tool}` });
      }
    }
  }
  return errors;
}

export function loadConfig(): HarnessConfig {
  const config = loadHarnessConfig();
  return {
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: config.currentChange ?? null,
    tools: config.tools ?? defaultTools,
    checks: config.checks ?? ['ai:validate', 'ai:report'],
    strictChecks: config.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
    defaultFlow: config.defaultFlow ?? 'ai',
    autoSave: config.autoSave ?? true,
  };
}

export function saveConfig(config: HarnessConfig) {
  saveHarnessConfig(config as Record<string, unknown>);
}

export function updateConfig(patch: Record<string, unknown>) {
  withLock('state', () => {
    const config = loadHarnessConfig();
    saveHarnessConfig({ ...config, ...patch });
  });
}

export function getDefaultState(): HarnessState {
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

export function loadState(): HarnessState {
  return loadHarnessState();
}

export function saveState(state: HarnessState) {
  saveHarnessState(state);
}

export function updateState(patch: Record<string, unknown>) {
  updateHarnessState(patch);
}

export function isConfigInitialized(): boolean {
  const configPath = resolvePath('harness', 'config.json');
  const statePath = resolvePath('harness', 'state.json');
  return fs.existsSync(configPath) && fs.existsSync(statePath);
}
