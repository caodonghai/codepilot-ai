import fs from 'fs';
import { resolvePath, writeGeneratedFile, ensureDir, resolveInsideRoot } from '../utils/file';
import { configSchemaVersion, defaultTools, supportedTools } from '../config/constants';
import { withLock } from './lock';
import { logger } from './logger';
import type { HarnessConfig, HarnessState, ProjectInfo } from '../types';
import { getConfigPath } from './context';

function configFilePath() {
  const configured = getConfigPath();
  return configured ? resolveInsideRoot(configured) : resolvePath('harness', 'config.json');
}

export function migrateConfig(raw: Record<string, unknown>): HarnessConfig {
  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (version > configSchemaVersion) {
    throw new Error(
      `Config schema ${version} is newer than supported schema ${configSchemaVersion}. Upgrade CodePilot AI.`,
    );
  }
  return {
    ...(raw as HarnessConfig),
    version: configSchemaVersion,
    checks: (raw.checks as string[] | undefined) ?? ['ai:validate', 'ai:report'],
    strictChecks: (raw.strictChecks as string[] | undefined) ?? [
      'eslint',
      'ai:validate',
      'ai:report',
    ],
  };
}

export function loadConfig(): HarnessConfig {
  const configPath = configFilePath();
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    const errors = validateConfig(raw);
    if (errors.length > 0) {
      throw new Error(errors.map((e) => e.message).join(', '));
    }
    const migrated = migrateConfig(raw);
    if ((raw.version as number | undefined) !== configSchemaVersion) {
      fs.copyFileSync(configPath, `${configPath}.v${raw.version ?? 1}.bak`);
      saveConfig(migrated);
    }
    return {
      version: migrated.version,
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
    if ((error as Error).message.includes('newer than supported schema')) throw error;
    throw new Error(`Invalid harness/config.json: ${(error as Error).message}`);
  }
}

export function saveConfig(config: HarnessConfig): void {
  const target = configFilePath();
  const content = `${JSON.stringify({ ...config, version: configSchemaVersion }, null, 2)}\n`;
  if (target === resolvePath('harness', 'config.json')) {
    writeGeneratedFile('harness/config.json', content);
  } else {
    fs.mkdirSync(require('path').dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
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
    version: configSchemaVersion,
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
    !['lightweight', 'official', 'hybrid', 'standard', 'strict'].includes(String(config.profile))
  ) {
    errors.push({
      key: 'profile',
      message: 'profile must be lightweight, official, hybrid, standard, or strict',
    });
  }
  if (config.tools !== undefined && Array.isArray(config.tools)) {
    for (const tool of config.tools) {
      if (!supportedTools.includes(tool as string)) {
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
  const configPath = configFilePath();
  const statePath = resolvePath('harness', 'state.json');
  return fs.existsSync(configPath) && fs.existsSync(statePath);
}

export const loadHarnessConfig = loadConfig;
export const saveHarnessConfig = saveConfig;
export const loadHarnessState = loadState;
export const saveHarnessState = saveState;
export const updateHarnessState = updateState;
