# /ai:finish

使用此流程结束活动变更。

## 输入

- 必需：`<change>` 名称。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 如果 `openspec/changes/<change>` 不存在，停止并要求用户使用简短请求运行 `/ai:propose <change>`。
3. 读取 `openspec/changes/<change>` 下的所有文件。
4. 阅读 `superpowers/skills/finishing.md`。
5. 同步本地任务板：
   - `pnpm ai task-board <change>`
6. 确认已完成的任务已勾选，未完成的任务保持未勾选。
7. 确认验收标准反映实际实现。
8. 当工具可用时，运行代理完成评估器：
   - 轻量版：`pnpm ai agent-finish <change>`
   - 带本地检查：`pnpm ai agent-finish <change> --check`
   - 严格模式，仅在仓库 ESLint 环境健康或 CI 运行时使用：`pnpm ai agent-finish <change> --check --strict`
9. 如果 `agent-finish` 不可用，回退到：
   - `pnpm ai validate <change>`
   - `pnpm ai report <change>`
   - `pnpm ai check <change>`
   - `pnpm ai finish-state <change>`
10. 在 `notes.md` 中更新最终验证细节和已知风险。
11. 当工具可用时，生成知识记忆建议：
    - `pnpm ai knowledge:suggest <change> --write`
    - 将建议视为候选，而非事实。
    - 如果未找到可复用候选，在最终报告中明确说明。
12. 仅将已确认的可复用知识添加到知识记忆中，当变更揭示未来工作应复用的组件、函数、模式、决策或失败时：
    - `pnpm ai knowledge:add --type <type> --name "<name>" --summary "<short-summary>" --keywords "<keyword1>,<keyword2>" --used-in "<path>"`
    - 不要将不确定的猜测作为已确认事实添加。
13. 如果必需检查因实现原因失败、任务仍为 todo/doing/blocked 或 `agent-finish` 报告 `partially_accepted` 或 `blocked`，不要声称变更已完成。

## 输出

返回：

- 变更内容。
- 验证内容。
- Harness 报告路径。
- 搜索的知识记忆术语、生成的建议路径（如有）、添加的记录（如有）或跳过原因。
- 剩余风险。
- 变更是否准备好审查。