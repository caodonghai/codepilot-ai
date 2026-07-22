import { afterEach, describe, expect, test } from 'vitest';
import { getGlobalOptions, loadFromEnv, resetGlobalOptions } from '../src/lib/context';

const names = ['VERBOSE', 'DRY_RUN', 'LOCALE', 'SKIP_GIT'];

afterEach(() => {
  for (const name of names) {
    delete process.env[`CODEPILOT_${name}`];
    delete process.env[`MSGFI_AI_${name}`];
  }
  resetGlobalOptions();
});

describe('环境变量兼容', () => {
  test('读取 CODEPILOT 前缀', () => {
    process.env.CODEPILOT_VERBOSE = 'true';
    process.env.CODEPILOT_LOCALE = 'en-US';
    loadFromEnv();
    expect(getGlobalOptions()).toMatchObject({ verbose: true, locale: 'en-US' });
  });

  test('兼容旧前缀但新前缀优先', () => {
    process.env.MSGFI_AI_DRY_RUN = 'true';
    process.env.CODEPILOT_DRY_RUN = 'false';
    process.env.MSGFI_AI_SKIP_GIT = 'true';
    loadFromEnv();
    expect(getGlobalOptions()).toMatchObject({ dryRun: false, skipGit: true });
  });
});
