# CodePilot AI OpenSpec 兼容性

此目录存储 AI 辅助开发工作的 OpenSpec 兼容变更记录。

第一个版本不需要官方的 `@fission-ai/openspec` CLI。它保持兼容结构，以便项目日后可以采用官方 CLI。

## 变更布局

每个变更位于：

```text
openspec/changes/<change>/
  proposal.md
  tasks.md
  acceptance.md
  notes.md
```

## 生命周期

1. 探索请求。
2. 提出范围变更。
3. 规划实现。
4. 执行任务。
5. 验证验收标准。
6. 使用 `codepilot check` 和 harness 报告完成。