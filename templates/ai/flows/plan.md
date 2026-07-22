# /ai:plan

使用此流程在编辑代码之前创建决策完成的实现计划。

## 输入

- 必需：`<change>` 名称。

## 协议

1. 阅读 `.ai/core/workflow.md`。
2. 如果 `openspec/changes/<change>` 不存在，停止并要求用户使用简短请求运行 `/ai:propose <change>`。
3. 读取 `openspec/changes/<change>` 下的所有文件。
4. 阅读 `.ai/core/project.md`、`.ai/core/frontend.md`、`.ai/core/api.md`、`.ai/core/ui.md` 和 `.ai/core/testing.md`。
5. 搜索知识记忆中的相关组件、函数、模式和失败：
   - `pnpm ai knowledge:search <change> <module-or-domain-keywords> --limit 10`
   - 仅读取返回的摘要。不要读取完整的记忆 JSONL 文件。
   - 如果未找到记录，明确说明计划在没有先前知识记忆的情况下进行。
6. 阅读 `superpowers/skills/planning.md`。
7. 检查可能受影响的文件和附近的实现模式。
8. 不要编辑代码。
9. 生成实现计划，包括：
   - 受影响的应用/包
   - 要修改的页面/路由/组件/模型/API 模块
   - 数据流和 UI 状态
   - 任务顺序
   - 验证命令
   - 已知风险
10. 如果计划需要产品决策，在实现之前询问。

## 输出

返回简洁的实现计划、知识记忆使用摘要和建议的下一个命令：`/ai:apply <change>`。