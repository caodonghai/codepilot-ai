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

describe('config 模块', () => {
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

  test('getDefaultConfig 返回默认值', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe(1);
    expect(config.profile).toBe('lightweight');
    expect(config.currentChange).toBe(null);
    expect(Array.isArray(config.tools)).toBe(true);
    expect(config.defaultFlow).toBe('ai');
    expect(config.autoSave).toBe(true);
  });

  test('validateConfig 对有效配置不返回错误', () => {
    const config = getDefaultConfig();
    const errors = validateConfig(config as Record<string, unknown>);
    expect(errors).toHaveLength(0);
  });

  test('validateConfig 对无效版本返回错误', () => {
    const errors = validateConfig({ version: 'invalid' as any });
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('version');
  });

  test('validateConfig 对无效配置文件返回错误', () => {
    const errors = validateConfig({ profile: 'invalid' });
    expect(errors).toHaveLength(1);
    expect(errors[0].key).toBe('profile');
  });

  test('validateConfig 对无效工具返回错误', () => {
    const errors = validateConfig({ tools: ['invalid-tool'] as any });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('loadConfig 在文件不存在时返回默认值', () => {
    const config = loadConfig();
    expect(config.version).toBe(1);
    expect(config.profile).toBe('lightweight');
  });

  test('saveConfig 将配置写入文件', () => {
    const config = getDefaultConfig();
    config.currentChange = 'test-change';
    saveConfig(config);

    const loaded = loadConfig();
    expect(loaded.currentChange).toBe('test-change');
  });

  test('updateConfig 将补丁与现有配置合并', () => {
    const config = getDefaultConfig();
    saveConfig(config);

    updateConfig({ currentChange: 'new-change', autoSave: false });

    const loaded = loadConfig();
    expect(loaded.currentChange).toBe('new-change');
    expect(loaded.autoSave).toBe(false);
    expect(loaded.version).toBe(1);
  });

  test('getDefaultState 返回默认值', () => {
    const state = getDefaultState();
    expect(state.version).toBe(1);
    expect(state.activeChange).toBe(null);
    expect(state.activeFlow).toBe(null);
    expect(state.status).toBe('not_started');
  });

  test('loadState 在文件不存在时返回默认值', () => {
    const state = loadState();
    expect(state.status).toBe('not_started');
  });

  test('saveState 将状态写入文件', () => {
    const state = getDefaultState();
    state.activeChange = 'test-change';
    saveState(state);

    const loaded = loadState();
    expect(loaded.activeChange).toBe('test-change');
  });

  test('updateState 将补丁与现有状态合并', () => {
    const state = getDefaultState();
    saveState(state);

    updateState({ activeChange: 'new-change', status: 'in_progress' });

    const loaded = loadState();
    expect(loaded.activeChange).toBe('new-change');
    expect(loaded.status).toBe('in_progress');
    expect(loaded.updatedAt).toBeDefined();
  });

  test('isConfigInitialized 在文件不存在时返回 false', () => {
    expect(isConfigInitialized()).toBe(false);
  });

  test('isConfigInitialized 在保存配置和状态后返回 true', () => {
    saveConfig(getDefaultConfig());
    saveState(getDefaultState());
    expect(isConfigInitialized()).toBe(true);
  });
});