import { describe, expect, test, vi } from 'vitest';
import { prepareChangeBranch } from '../src/commands/change';

function createOperations(branchExists = false) {
  return {
    isGitRepo: vi.fn(() => true),
    branchExists: vi.fn(() => branchExists),
    createBranch: vi.fn(),
    checkoutBranch: vi.fn(),
  };
}

describe('new 命令分支控制', () => {
  test('未传入 --branch 时不检查或修改 Git 分支', () => {
    const operations = createOperations();

    expect(prepareChangeBranch('demo-change', 'feature', false, operations)).toBeNull();
    expect(operations.isGitRepo).not.toHaveBeenCalled();
    expect(operations.createBranch).not.toHaveBeenCalled();
    expect(operations.checkoutBranch).not.toHaveBeenCalled();
  });

  test('传入 --branch 时创建不存在的分支', () => {
    const operations = createOperations(false);

    expect(prepareChangeBranch('demo-change', 'feature', true, operations)).toBe(
      'feature/demo-change',
    );
    expect(operations.createBranch).toHaveBeenCalledWith('feature/demo-change');
    expect(operations.checkoutBranch).not.toHaveBeenCalled();
  });

  test('传入 --branch 时切换到已有分支', () => {
    const operations = createOperations(true);

    expect(prepareChangeBranch('demo-change', 'bugfix', true, operations)).toBe(
      'bugfix/demo-change',
    );
    expect(operations.checkoutBranch).toHaveBeenCalledWith('bugfix/demo-change');
    expect(operations.createBranch).not.toHaveBeenCalled();
  });
});
