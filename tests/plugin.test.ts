import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import { installPlugin, listPlugins, uninstallPlugin } from '../src/lib/plugin';
import { resolvePath } from '../src/utils/file';

const source = resolvePath('plugin-fixture');

afterEach(() => {
  fs.rmSync(source, { recursive: true, force: true });
  fs.rmSync(resolvePath('harness/plugins/demo-plugin'), { recursive: true, force: true });
});

describe('本地插件边界', () => {
  test('安装、加载并卸载有效插件', () => {
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, 'plugin.json'),
      JSON.stringify({ name: 'demo-plugin', version: '1.0.0', description: 'Demo' }),
    );
    fs.writeFileSync(
      path.join(source, 'index.js'),
      'module.exports = { commands: [], hooks: [] };',
    );
    expect(installPlugin(source)).toBe(true);
    expect(listPlugins().map((plugin) => plugin.name)).toContain('demo-plugin');
    expect(uninstallPlugin('demo-plugin')).toBe(true);
  });

  test('拒绝越界 main 和非法名称', () => {
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, 'plugin.json'),
      JSON.stringify({ name: '../bad', version: '1.0.0', description: 'Bad', main: '../x.js' }),
    );
    expect(() => installPlugin(source)).toThrow('Invalid plugin name');
  });
});
