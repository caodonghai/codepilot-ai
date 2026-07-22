# CodePilot AI 工作流程

使用 `/ai <change>` 进行引导式工作，使用高级 `/ai:*` 流程强制执行特定阶段，或使用 `codepilot` 命令确保 AI 工作在 Codex、Trae、Qoder 和 Cursor 之间保持一致。

## 必需流程

1. 阅读本文件。
2. 从用户的 `/ai <change>` 或 `/ai:* <change>` 命令、`harness/config.json` 或用户请求中解析活动变更名称。
3. 如果 `openspec/changes/<change>` 不存在且当前流程允许创建变更，则创建目录并包含 `proposal.md`、`tasks.md`、`acceptance.md` 和 `notes.md`。
4. 读取 `openspec/changes/<change>` 中的活动变更。
5. 读取 `.ai/core` 下的相关文件。
6. 使用 `superpowers/skills` 下的相关技能。
7. 仅进行活动变更所需的修改。
8. 优先使用单命令形式 `codepilot <command>`。
9. 当流程要求验证/报告命令且工具可用时，运行这些命令。
10. 在有用时，将值得注意的验证细节记录在活动变更的 notes 中。
11. 对于长时间运行的工作，继续之前读取 `harness/state.json`。
12. 当工具可用时，使用 `codepilot step "<note>" --flow <flow>` 记录重要进度。
13. 当工具可用时，使用 `codepilot decision "<decision>"` 记录已确认的产品或技术决策。

## 知识记忆

- 在 `/ai:propose`、`/ai:plan` 和 `/ai:apply` 之前，当工具可用时，使用 `codepilot knowledge search <keywords> --limit 10` 搜索相关项目知识。
- 在正常 AI 工作期间，不要读取完整的 `harness/memory/knowledge/*.jsonl` 文件。
- 仅使用 `knowledge search` 返回的摘要。
- 每个流程最多读取 10 条知识记录，每条记录摘要应保持简短以避免上下文膨胀。
- 在 `/ai:finish` 期间，运行 `codepilot knowledge suggest <change> --write` 生成候选知识。
- 在 `/ai:finish` 之后，仅将已确认的可复用组件、函数、模式、决策或失败记录添加到知识记忆中：`codepilot knowledge add`。
- 每份最终工作报告应包含知识记忆状态：搜索的术语、生成的建议路径（如有）、添加的记录（如有），或跳过的简短原因。
