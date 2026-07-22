# /ai:propose

使用此流程将请求转换为 OpenSpec 兼容的变更。

## 输入

- 必需：`<change>` 名称。
- 如果变更文件仍为空，则必需：简短的自然语言请求。
- 可选：截图、受影响的模块名称、API 名称或预期行为。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 阅读 `.ai/core/project.md`、`.ai/core/frontend.md`、`.ai/core/api.md` 和 `.ai/core/ui.md`。
3. 如果 `openspec/changes/<change>` 不存在，创建它并包含：
   - `proposal.md`
   - `tasks.md`
   - `acceptance.md`
   - `notes.md`
4. 读取 `openspec/changes/<change>` 下的现有文件。
5. 在仓库范围搜索之前，搜索知识记忆中的变更名称和请求关键字：
   - `pnpm ai knowledge search <change> <request-keywords> --limit 5`
   - 仅读取返回的摘要，不要读取原始 `harness/memory/knowledge/*.jsonl` 文件。
   - 如果未找到记录，在响应或 notes 中记录"知识搜索：无相关记录"。
6. 在仓库中搜索请求和变更名称中的术语，以定位可能受影响的页面、路由、模型、API 和组件。
7. 不要编辑业务代码。
8. 创建或完善：
   - `openspec/changes/<change>/proposal.md`
   - `openspec/changes/<change>/tasks.md`
   - `openspec/changes/<change>/acceptance.md`
   - `openspec/changes/<change>/notes.md`
9. 使 `tasks.md` 足够可操作，以便 `/ai:apply <change>` 可以实现而无需猜测。
10. 使 `acceptance.md` 足够可观察，以便 `/ai:verify <change>` 可以检查它。
11. 如果工具可用，运行 `pnpm ai validate <change>`。
12. 如果重要的产品行为不明确，将歧义写入 `notes.md` 并提出简短问题，而不是发明行为。

## 输出

返回：

- 提议变更的摘要。
- 发现的受影响文件或区域。
- 搜索的知识记忆术语以及是否找到记录。
- 未解决的问题（如有）。
- 建议的下一个命令：`/ai:plan <change>`。
