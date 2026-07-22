import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import {
  validateConfig,
  loadConfig,
  getDefaultConfig,
  saveConfig,
  updateConfig,
  loadState,
  getDefaultState,
  saveState,
  updateState,
  isConfigInitialized,
} from '../src/lib/state';
import { resolvePath } from '../src/utils/file';

describe('config module', () => {
  beforeEach(() => {
    const configPath = resolvePath('harness', 'config.json');
    const statePath = resolvePath('harness', 'state.json');
    if (fs.existsSync(configPath)) {
      fs.rmSync(configPath);
    }
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath);
    }
  });

  afterEach(() => {
    const configPath = resolvePath('harness', 'config.json');
    const statePath = resolvePath('harness', 'state.json');
    if (fs.existsSync(configPath)) {
      fs.rmSync(configPath);
    }
    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath);
    }
  });

  test('getDefaultConfig returns default values', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe(1);
    expect(config.profile).toBe('lightweight');
    expect(config.currentChange).toBe(null);
    expect(Array.isArray(config.tools)).toBe(true);
    expect(config.defaultFlow).toBe('ai');
    expect(config.autoSave).toBe(true);
  });

  test('validateConfig returns no errors for valid config', () => {
    const config = getDefaultConfig();
    const errors = validateConfig(config as Record<string, unknown>);
    expect(errors).toHaveLength(0);
  });

  test('validateConfig returns errors for invalid version', () => {
    const errors = validateConfig({ version: 'invalid' as any });
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('version');
  });

  test('validateConfig returns errors for invalid profile', () => {
    const errors = validateConfig({ profile: 'invalid' });
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('profile');
  });

  test('validateConfig returns errors for invalid tools', () => {
    const errors = validateConfig({ tools: ['invalid-tool'] as any });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('loadConfig returns default when file does not exist', () => {
    const config = loadConfig();
    expect(config.version).toBe(1);
    expect(config.profile).toBe('lightweight');
  });

  test('saveConfig writes config to file', () => {
    const config = getDefaultConfig();
    config.currentChange = 'test-change';
    saveConfig(config);

    const loaded = loadConfig();
    expect(loaded.currentChange).toBe('test-change');
  });

  test('updateConfig merges patch with existing config', () => {
    const config = getDefaultConfig();
    saveConfig(config);

    updateConfig({ currentChange: 'new-change', autoSave: false });

    const loaded = loadConfig();
    expect(loaded.currentChange).toBe('new-change');
    expect(loaded.autoSave).toBe(false);
    expect(loaded.version).toBe(1);
  });

  test('getDefaultState returns default values', () => {
    const state = getDefaultState();
    expect(state.version).toBe(1);
    expect(state.activeChange).toBe(null);
    expect(state.activeFlow).toBe(null);
    expect(state.status).toBe('not_started');
  });

  test('loadState returns default when file does not exist', () => {
    const state = loadState();
    expect(state.status).toBe('not_started');
  });

  test('saveState writes state to file', () => {
    const state = getDefaultState();
    state.activeChange = 'test-change';
    saveState(state);

    const loaded = loadState();
    expect(loaded.activeChange).toBe('test-change');
  });

  test('updateState merges patch with existing state', () => {
    const state = getDefaultState();
    saveState(state);

    updateState({ activeChange: 'new-change', status: 'in_progress' });

    const loaded = loadState();
    expect(loaded.activeChange).toBe('new-change');
    expect(loaded.status).toBe('in_progress');
    expect(loaded.updatedAt).toBeDefined();
  });

  test('isConfigInitialized returns false when files do not exist', () => {
    expect(isConfigInitialized()).toBe(false);
  });

  test('isConfigInitialized returns true after saving config and state', () => {
    saveConfig(getDefaultConfig());
    saveState(getDefaultState());
    expect(isConfigInitialized()).toBe(true);
  });
});
