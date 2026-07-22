# /ai:verify

使用此流程验证实现是否符合活动变更。

## 输入

- 必需：`<change>` 名称。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 如果 `openspec/changes/<change>` 不存在，停止并要求用户使用简短请求运行 `/ai:propose <change>`。
3. 读取 `openspec/changes/<change>` 下的所有文件。
4. 检查当前 diff 和相关的周围代码。
5. 当工具可用时，同步并审查任务板：
   - `pnpm ai task-board <change>`
6. 将实现与 `acceptance.md` 中的每个项目进行比较。
7. 对照 `proposal.md` 检查范围蔓延。
8. 当工具可用时，运行 `pnpm ai validate <change>`。
9. 当变更区域需要时，运行聚焦测试、lint 或构建。
10. 在 `notes.md` 中添加验证笔记，包括运行的命令和结果。
11. 如果验收未满足，将确切的后续任务写回 `tasks.md` 作为未勾选项目，而不是标记变更完成。
12. 对于每个已验证的当前任务，明确标记：
    - 完成：`pnpm ai task-done <task-id> --change <change>`
    - 阻塞：`pnpm ai task-block <task-id> --change <change> --reason "<reason>"`
13. 当工具可用时，更新 Harness 状态：
    - `pnpm ai verify-state <change> --status accepted`
    - `pnpm ai verify-state <change> --status partially_accepted`
    - `pnpm ai verify-state <change> --status rejected`
    - `pnpm ai verify-state <change> --status blocked`
14. 当从验证添加后续任务时，优先使用 CLI 形式：
    - `pnpm ai verify-state <change> --status partially_accepted --task "描述缺失的验收项"`

## 输出

返回：

- 验收状态。
- 验证命令和结果。
- 发现的问题。
- Harness 状态。
- 建议的下一个命令：如果一切可接受则 `/ai:finish <change>`，否则 `/ai:apply <change>`。