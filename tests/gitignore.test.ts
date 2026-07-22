import fs from 'fs';
import { afterEach, describe, expect, test } from 'vitest';
import { gitignoreMarker, gitignoreRules, setupGitignore } from '../src/commands/templates';
import { resolvePath } from '../src/utils/file';

const gitignorePath = resolvePath('.gitignore');

afterEach(() => {
  if (fs.existsSync(gitignorePath)) fs.rmSync(gitignorePath);
});

describe('init .gitignore 设置', () => {
  test('.gitignore 不存在时创建完整受管区块', () => {
    setupGitignore();

    expect(fs.readFileSync(gitignorePath, 'utf8')).toBe(
      `${[gitignoreMarker, ...gitignoreRules].join('\n')}\n`,
    );
  });

  test('保留用户内容并只追加缺失规则', () => {
    const original = 'node_modules/\n.env\n';
    fs.writeFileSync(
      gitignorePath,
      `${original}\n${gitignoreMarker}\n${gitignoreRules[0]}\n`,
      'utf8',
    );

    setupGitignore();
    const updated = fs.readFileSync(gitignorePath, 'utf8');

    expect(updated.startsWith(original)).toBe(true);
    expect(updated.match(new RegExp(gitignoreMarker, 'g'))).toHaveLength(1);
    for (const rule of gitignoreRules) {
      expect(updated.split(/\r?\n/).filter((line) => line === rule)).toHaveLength(1);
    }
  });

  test('重复执行不产生任何变化', () => {
    setupGitignore();
    const first = fs.readFileSync(gitignorePath, 'utf8');

    setupGitignore();

    expect(fs.readFileSync(gitignorePath, 'utf8')).toBe(first);
  });

  test('保留已有 CRLF 换行风格', () => {
    fs.writeFileSync(gitignorePath, 'node_modules/\r\n', 'utf8');

    setupGitignore();

    const updated = fs.readFileSync(gitignorePath, 'utf8');
    expect(updated).toContain(`\r\n${gitignoreMarker}\r\n`);
    expect(updated.replace(/\r\n/g, '')).not.toContain('\n');
  });

  test('--no-setup-gitignore 对应选项不会创建或修改文件', () => {
    expect(setupGitignore({ enabled: false })).toContain('Skipped');
    expect(fs.existsSync(gitignorePath)).toBe(false);
  });
});
