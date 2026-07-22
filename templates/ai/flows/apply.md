# /ai:apply

使用此流程为活动变更实现未完成的任务。

## 输入

- 必需：`<change>` 名称。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 如果 `openspec/changes/<change>` 不存在，停止并要求用户使用简短请求运行 `/ai:propose <change>`。
3. 读取 `openspec/changes/<change>` 下的所有文件。
4. 阅读 `.ai/core/project.md`、`.ai/core/frontend.md`、`.ai/core/api.md`、`.ai/core/ui.md` 和 `.ai/core/testing.md`。
5. 搜索知识记忆中的相关用法示例和已知失败：
   - `pnpm ai knowledge search <change> <module-or-domain-keywords> --limit 10`
   - 仅使用返回的摘要。不要直接读取 `harness/memory/knowledge`。
   - 如果未找到记录，在编辑前说明没有可用的可复用知识。
6. 阅读 `superpowers/skills/planning.md`；在相关时阅读 `tdd.md`、`debugging.md` 或 `code-review.md`。
7. 当工具可用时，同步本地任务板：
   - `pnpm ai task-board <change>`
8. 在编辑之前准备或认领下一个任务：
   - 仅提示：`pnpm ai agent-run <change>`
   - 认领下一个任务：`pnpm ai agent-run <change> --claim`
9. 在编辑之前检查受影响的文件。
10. 如果 `tasks.md` 仍然通用或规格不足，在编辑代码之前从 `proposal.md` 完善它。
11. 仅实现 `openspec/changes/<change>/tasks.md` 中的当前任务或未勾选任务。
12. 保持编辑在提案范围内。如果实现需要范围扩展，停止并先更新提案。
13. 在添加新模式之前，先复用现有组件、请求助手、模型、权限、路由和样式。
14. 当工具可用时，明确标记任务状态：
    - 完成：`pnpm ai task-done <task-id> --change <change>`
    - 阻塞：`pnpm ai task-block <task-id> --change <change> --reason "<reason>"`
15. 仅为实际完成的任务更新 `tasks.md` 复选框。
16. 向 `notes.md` 添加有用的实现笔记。
17. 当工具可用时，运行 `pnpm ai validate <change>`。
18. 如果验证失败，修复问题并重跑验证。
19. 仅在变更风险需要或用户要求时运行聚焦测试或构建。

## 输出

返回：

- 已完成的任务。
- 已更改的文件。
- 验证结果。
- 使用的知识记忆记录或"未找到"。
- 剩余风险或阻塞项。
- 建议的下一个命令：`/ai:verify <change>`。
