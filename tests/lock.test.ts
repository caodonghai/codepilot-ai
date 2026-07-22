import fs from 'fs';
import { afterEach, describe, expect, test } from 'vitest';
import { acquireLock, getLockOwner, isLocked, releaseLock } from '../src/lib/lock';
import { resolvePath } from '../src/utils/file';

const lockPath = resolvePath('.harness.lock');

afterEach(() => {
  releaseLock();
  fs.rmSync(lockPath, { force: true });
});

describe('进程锁', () => {
  test('只释放当前进程实际持有的锁', () => {
    expect(acquireLock('first', 100)).toBe(true);
    expect(getLockOwner()).toBe('first');

    fs.rmSync(lockPath);
    fs.writeFileSync(
      lockPath,
      JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        owner: 'replacement',
        token: 'new',
      }),
    );
    releaseLock();

    expect(isLocked()).toBe(true);
    expect(getLockOwner()).toBe('replacement');
  });

  test('可清理已过期的锁并重新取得所有权', () => {
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: 99999999, timestamp: 0, owner: 'stale', token: 'old' }),
    );
    expect(acquireLock('current', 100)).toBe(true);
    expect(getLockOwner()).toBe('current');
  });
});
