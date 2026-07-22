# /ai

当用户希望使用 AI 工程工作流但不想记住每个阶段命令时，使用此调度器进行正常引导式工作。

## 输入

- 必需：`<change>` 名称。
- 可选：自然语言请求、截图、受影响文件或后续说明。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 从 `/ai <change>` 或 `harness/config.json` 中的活动变更解析 `<change>`。
3. 如果用户未使用 `/ai`，将消息视为普通对话，不要强制此工作流。
4. 如果用户明确使用 `/ai:propose`、`/ai:plan`、`/ai:apply`、`/ai:verify`、`/ai:review` 或 `/ai:finish`，使用该精确流程而非调度。
5. 当存在时读取 `harness/state.json`。
6. 如果用户要求切换或检查集成，在变更调度之前处理该请求：
   - "切到官方模式" / "use official" -> `pnpm ai integration:use <openspec|superpowers> official`
   - "切回轻量版" / "use lightweight" -> `pnpm ai integration:use <openspec|superpowers> lightweight`
   - "混合模式" / "hybrid" -> `pnpm ai integration:use <openspec|superpowers> hybrid`
   - "检查官方资源" / "doctor official" -> `pnpm ai integration:list` 和 `pnpm ai doctor`
   - "验证官方集成" -> `pnpm ai integration:validate <openspec|superpowers> --dry-run`
   - "同步 Codex/Cursor/Trae/Qoder" -> `pnpm ai sync <tools...>`
   - 除非用户明确要求 `--execute`，否则不要安装全局包、使用全局工具、修改 PATH 或执行官方 CLI。
7. 如果用户要求分析知识记忆，运行 `pnpm ai knowledge:analyze` 并总结建议。
8. 如果存在，检查 `openspec/changes/<change>`。
9. 调度：
   - 如果变更不存在，使用 `/ai:propose <change>`。
   - 如果 `proposal.md`、`tasks.md` 或 `acceptance.md` 缺失或明显为空，使用 `/ai:propose <change>`。
   - 如果提案存在但实现方向未完成决策，使用 `/ai:plan <change>`。
   - 如果 `tasks.md` 有未勾选的实现任务，使用 `/ai:apply <change>`。
   - 如果实现任务已勾选但验收未勾选或验证缺失，使用 `/ai:verify <change>`。
   - 如果任务和验收都已满足，使用 `/ai:finish <change>`。
10. 用一句话告诉用户选择了哪个流程以及原因。
11. 遵循所选流程的协议。

## 输出

返回所选流程结果和下一个建议操作。保持面向用户的命令简单：

```text
/ai <change>
```

仅在用户希望强制执行特定阶段时使用高级 `/ai:*` 命令。