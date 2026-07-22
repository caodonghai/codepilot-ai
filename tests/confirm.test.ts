import { describe, expect, test } from 'vitest';
import { confirmDestructiveAction } from '../src/lib/confirm';

describe('危险操作确认', () => {
  test('显式 --yes 允许继续', async () => {
    await expect(confirmDestructiveAction('Delete?', true)).resolves.toBe(true);
  });

  test('非交互环境拒绝未确认操作', async () => {
    await expect(confirmDestructiveAction('Delete?')).rejects.toThrow('--yes');
  });
});
