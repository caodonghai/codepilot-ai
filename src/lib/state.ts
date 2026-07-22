import fs from 'fs';
import { resolvePath, writeGeneratedFile, ensureDir } from '../utils/file';
import { defaultTools } from '../config/constants';
import { withLock } from './lock';
import { logger } from './logger';
import type { HarnessConfig, HarnessState, ProjectInfo } from '../types';

export function loadConfig(): HarnessConfig {
  const configPath = resolvePath('harness', 'config.json');
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    const errors = validateConfig(raw);
    if (errors.length > 0) {
      logger.warn(`Invalid harness/config.json: ${errors.map((e) => e.message).join(', ')}`);
      return getDefaultConfig();
    }
    return {
      version: (raw.version as number) ?? 1,
      profile: (raw.profile as string) ?? 'lightweight',
      currentChange: (raw.currentChange as string) ?? null,
      tools: (raw.tools as string[]) ?? defaultTools,
      checks: (raw.checks as string[]) ?? ['ai:validate', 'ai:report'],
      strictChecks: (raw.strictChecks as string[]) ?? ['eslint', 'ai:validate', 'ai:report'],
      defaultFlow: (raw.defaultFlow as string) ?? 'ai',
      autoSave: (raw.autoSave as boolean) ?? true,
      project: raw.project as ProjectInfo | undefined,
      ai: raw.ai as HarnessConfig['ai'],
      workflow: raw.workflow as HarnessConfig['workflow'],
      knowledge: raw.knowledge as HarnessConfig['knowledge'],
      output: raw.output as HarnessConfig['output'],
    };
  } catch (error) {
    logger.warn(`Invalid harness/config.json: ${(error as Error).message}`);
    return getDefaultConfig();
  }
}

export function saveConfig(config: HarnessConfig): void {
  writeGeneratedFile('harness/config.json', `${JSON.stringify(config, null, 2)}\n`);
}

export function setCurrentChange(change: string): void {
  withLock('state', () => {
    const config = loadConfig();
    saveConfig({
      ...config,
      currentChange: change,
    });
  });
}

export function loadState(): HarnessState {
  const statePath = resolvePath('harness', 'state.json');
  if (!fs.existsSync(statePath)) {
    return getDefaultState();
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as HarnessState;
  } catch (error) {
    logger.warn(`Invalid harness/state.json: ${(error as Error).message}`);
    return getDefaultState();
  }
}

export function saveState(state: HarnessState): void {
  writeGeneratedFile('harness/state.json', `${JSON.stringify(state, null, 2)}\n`);
}

export function updateState(patch: Partial<HarnessState>): void {
  withLock('state', () => {
    const state = loadState();
    saveState({
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
  const config = loadConfig();
  return typeof config.currentChange === 'string' ? config.currentChange : null;
}

export function initHarness(): void {
  ensureDir('harness');
  const config = loadConfig();
  saveConfig(config);
  const state = loadState();
  saveState(state);
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

export function updateConfig(patch: Partial<HarnessConfig>): void {
  withLock('state', () => {
    const config = loadConfig();
    saveConfig({ ...config, ...patch });
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

export function isConfigInitialized(): boolean {
  const configPath = resolvePath('harness', 'config.json');
  const statePath = resolvePath('harness', 'state.json');
  return fs.existsSync(configPath) && fs.existsSync(statePath);
}

export const loadHarnessConfig = loadConfig;
export const saveHarnessConfig = saveConfig;
export const loadHarnessState = loadState;
export const saveHarnessState = saveState;
export const updateHarnessState = updateState;
