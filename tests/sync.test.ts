import { beforeAll, describe, expect, test } from 'vitest';
import { buildSyncFiles } from '../src/commands/init';
import { listTargetFiles, seedProjectTemplates } from '../src/commands/templates';

describe('工具同步适配', () => {
  beforeAll(() => seedProjectTemplates());

  test.each(['codex', 'trae', 'qoder', 'cursor'])('%s 的生成目标与验证目标完全一致', (tool) => {
    const generated = buildSyncFiles([tool]).map((item) => item.path);
    expect(generated).toEqual(listTargetFiles(tool));
  });

  test('每个目标文件都有非空内容', () => {
    const files = buildSyncFiles(['codex', 'trae', 'qoder', 'cursor']);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((item) => item.content.trim().length > 0)).toBe(true);
  });
});
