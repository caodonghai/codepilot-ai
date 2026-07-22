import fs from 'fs';
import type { ToolName } from '../types';
import { resolvePath, writeGeneratedFile, ensureDir, defaultTools } from './utils';

export interface ConfigValidationError {
  key: string;
  message: string;
}

export interface HarnessConfig {
  version?: number;
  profile?: string;
  currentChange?: string | null;
  tools?: ToolName[];
  checks?: string[];
  strictChecks?: string[];
  defaultFlow?: string;
  autoSave?: boolean;
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

const CONFIG_PATH = resolvePath('harness', 'config.json');
const STATE_PATH = resolvePath('harness', 'state.json');
const LOCK_FILE = resolvePath('harness', '.config.lock');
const LOCK_TIMEOUT = 5000;
const LOCK_RETRY_DELAY = 100;

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockContent = fs.readFileSync(LOCK_FILE, 'utf8');
      const lockTime = parseInt(lockContent, 10);
      if (Date.now() - lockTime < LOCK_TIMEOUT) {
        return false;
      }
      fs.unlinkSync(LOCK_FILE);
    }
    fs.writeFileSync(LOCK_FILE, `${Date.now()}`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {}
}

function withLock<T>(fn: () => T): T {
  let attempts = 0;
  const maxAttempts = LOCK_TIMEOUT / LOCK_RETRY_DELAY;
  while (!acquireLock()) {
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Timeout waiting for config lock');
    }
    const start = Date.now();
    while (Date.now() - start < LOCK_RETRY_DELAY) {}
  }
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

export function validateConfig(config: Partial<HarnessConfig>): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (config.version !== undefined && typeof config.version !== 'number') {
    errors.push({ key: 'version', message: 'version must be a number' });
  }

  if (
    config.profile !== undefined &&
    !['lightweight', 'official', 'hybrid'].includes(config.profile)
  ) {
    errors.push({
      key: 'profile',
      message: 'profile must be one of: lightweight, official, hybrid',
    });
  }

  if (config.tools !== undefined) {
    if (!Array.isArray(config.tools)) {
      errors.push({ key: 'tools', message: 'tools must be an array' });
    } else {
      for (const tool of config.tools) {
        if (!defaultTools.includes(tool)) {
          errors.push({ key: 'tools', message: `invalid tool: ${tool}` });
        }
      }
    }
  }

  if (config.defaultFlow !== undefined && typeof config.defaultFlow !== 'string') {
    errors.push({ key: 'defaultFlow', message: 'defaultFlow must be a string' });
  }

  if (config.autoSave !== undefined && typeof config.autoSave !== 'boolean') {
    errors.push({ key: 'autoSave', message: 'autoSave must be a boolean' });
  }

  return errors;
}

export function loadConfig(): HarnessConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return getDefaultConfig();
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HarnessConfig>;
    const errors = validateConfig(parsed);
    if (errors.length > 0) {
      console.warn(`Config validation errors: ${errors.map((e) => e.message).join(', ')}`);
    }
    return { ...getDefaultConfig(), ...parsed };
  } catch (error) {
    console.error(`Invalid ${CONFIG_PATH}: ${(error as Error).message}`);
    return getDefaultConfig();
  }
}

export function getDefaultConfig(): HarnessConfig {
  return {
    version: 1,
    profile: 'lightweight',
    currentChange: null,
    tools: [...defaultTools],
    checks: ['eslint', 'ai:validate', 'ai:report'],
    strictChecks: ['eslint', 'ai:validate', 'ai:report'],
    defaultFlow: 'ai',
    autoSave: true,
  };
}

export function saveConfig(config: HarnessConfig) {
  ensureDir('harness');
  writeGeneratedFile('harness/config.json', `${JSON.stringify(config, null, 2)}\n`);
}

export function updateConfig(patch: Partial<HarnessConfig>) {
  withLock(() => {
    const config = loadConfig();
    const updated = { ...config, ...patch };
    const errors = validateConfig(updated);
    if (errors.length > 0) {
      throw new Error(`Config validation failed: ${errors.map((e) => e.message).join(', ')}`);
    }
    saveConfig(updated);
  });
}

export function loadState(): HarnessState {
  if (!fs.existsSync(STATE_PATH)) {
    return getDefaultState();
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (error) {
    console.error(`Invalid ${STATE_PATH}: ${(error as Error).message}`);
    return getDefaultState();
  }
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

export function saveState(state: HarnessState | Record<string, unknown>) {
  ensureDir('harness');
  writeGeneratedFile('harness/state.json', `${JSON.stringify(state, null, 2)}\n`);
}

export function updateState(patch: Record<string, unknown>) {
  withLock(() => {
    const state = loadState();
    saveState({
      ...state,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  });
}

export function initConfig() {
  ensureDir('harness');
  const config = loadConfig();
  saveConfig(config);
  const state = loadState();
  saveState(state);
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getStatePath(): string {
  return STATE_PATH;
}

export function isConfigInitialized(): boolean {
  return fs.existsSync(CONFIG_PATH) && fs.existsSync(STATE_PATH);
}

export function resetConfig() {
  withLock(() => {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
    if (fs.existsSync(STATE_PATH)) {
      fs.unlinkSync(STATE_PATH);
    }
    initConfig();
  });
}
