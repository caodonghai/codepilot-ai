import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { assertDownloadOutsideRepo, assertIntegrationTargetPath } from '../src/lib/integrations';
import { resolvePath } from '../src/utils/file';

describe('integration 路径边界', () => {
  test('允许集成自己的 official 和 cache 目录', () => {
    expect(assertIntegrationTargetPath('openspec', 'harness/integrations/openspec/official')).toBe(
      resolvePath('harness/integrations/openspec/official'),
    );
    expect(assertIntegrationTargetPath('openspec', 'harness/integrations/openspec/cache')).toBe(
      resolvePath('harness/integrations/openspec/cache'),
    );
  });

  test.each(['.', 'harness', 'harness/integrations', '../outside', '/tmp/outside'])(
    '拒绝集成目录外的目标 %s',
    (target) => {
      expect(() => assertIntegrationTargetPath('openspec', target)).toThrow(
        'Refusing integration path outside',
      );
    },
  );

  test('拒绝通过符号链接写到仓库外', () => {
    const integrationRoot = resolvePath('harness/integrations/openspec');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'codepilot-outside-'));
    fs.mkdirSync(integrationRoot, { recursive: true });
    fs.symlinkSync(outside, path.join(integrationRoot, 'linked'));

    try {
      expect(() =>
        assertIntegrationTargetPath('openspec', 'harness/integrations/openspec/linked/official'),
      ).toThrow('through symlink outside repository');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('仓库边界判断不会把相同前缀目录误判为仓库内部', () => {
    const sibling = `${resolvePath('.')}-backup`;
    expect(() => assertDownloadOutsideRepo(sibling)).not.toThrow();
    expect(() => assertDownloadOutsideRepo(resolvePath('downloads'))).toThrow(
      'inside the repository',
    );
  });
});
