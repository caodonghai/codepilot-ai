# CodePilot AI

CodePilot AI 是一套放在项目仓库里的 AI 工程流程工具。它把 OpenSpec 风格的需求优先、Superpowers 风格的技能流程、本地 Harness 验收状态、Knowledge Memory 知识沉淀，以及 Codex / Trae / Qoder / Cursor 多 AI 编辑器规则同步整合到一个命令里。

第一次使用时，先安装包，然后执行一次初始化：

```bash
pnpm add -D @codepilot/ai
pnpm exec codepilot init
pnpm ai validate
```

为什么第一次是 `pnpm exec codepilot init`？因为此时项目里还没有 `"scripts": { "ai": "codepilot" }`。`init` 会自动把这个脚本加到 `package.json`，以后就可以直接使用：

```bash
pnpm ai init qoder
pnpm ai sync qoder
pnpm ai validate
pnpm ai knowledge:search 关键字
```

如果只想初始化某些 AI 编辑器，可以把名字接在 `init` 后面：

```bash
pnpm exec codepilot init qoder
pnpm exec codepilot init codex cursor
pnpm exec codepilot init codex trae qoder cursor
```

不传工具名时，默认初始化 `codex / trae / qoder / cursor`。

初始化后，项目会得到这些能力：

- `.ai/`：项目 AI 规则和 `/ai` 工作流
- `openspec/`：需求、任务、验收文档目录
- `superpowers/`：项目级 AI skills
- `harness/`：本地状态、任务板、报告、Knowledge Memory
- `AGENTS.md`、`.trae/`、`.qoder/`、`.cursor/`：不同 AI 编辑器可读取的规则和命令

在 AI 对话里，团队可以这样使用：

```text
/ai my-change-name
这里写需求描述
```

如果想强制某个阶段，也可以用：

```text
/ai:propose my-change-name
/ai:plan my-change-name
/ai:apply my-change-name
/ai:verify my-change-name
/ai:finish my-change-name
```

## 推荐使用流程

### 1. 安装包

```bash
pnpm add -D @codepilot/ai
```

### 2. 第一次初始化

```bash
pnpm exec codepilot init
```

这一步会：

- 生成 `.ai / openspec / superpowers / harness`
- 生成 Codex / Trae / Qoder / Cursor 适配文件
- 自动给 `package.json` 加 `"ai": "codepilot"`
- 不覆盖已有 `scripts.ai`

如果不希望自动改 `package.json`：

```bash
pnpm exec codepilot init --no-setup-script
```

### 3. 后续统一使用

初始化完成后，后续都用：

```bash
pnpm ai <command>
```

例如：

```bash
pnpm ai validate
pnpm ai sync qoder
pnpm ai new bank-reconciliation
pnpm ai knowledge:search 银行对账
```

## 命令说明

### `pnpm ai init [tools...]`

初始化 AI 工程目录和编辑器适配文件。

```bash
pnpm ai init
pnpm ai init qoder
pnpm ai init codex cursor
```

不传 `tools` 时默认初始化全部：`codex / trae / qoder / cursor`。

如果重复执行，新的工具会合并到已有配置里。例如先执行 `init codex`，再执行 `init qoder`，最终会同时支持 `codex` 和 `qoder`。

### `pnpm ai sync [tools...]`

从 `.ai/core`、`.ai/flows`、`superpowers/skills` 重新生成不同 AI 编辑器的规则文件。

```bash
pnpm ai sync
pnpm ai sync qoder cursor
pnpm ai sync --skip codex
```

如果 Codex 当前锁住 `.codex/skills`，可以先跳过 Codex：

```bash
pnpm ai sync trae qoder cursor
```

### `pnpm ai new <change>`

创建一个 OpenSpec-compatible 变更目录：

```bash
pnpm ai new bank-reconciliation
pnpm ai new bugfix-139204 --type bugfix
```

会生成：

```text
openspec/changes/<change>/proposal.md
openspec/changes/<change>/tasks.md
openspec/changes/<change>/acceptance.md
openspec/changes/<change>/notes.md
```

### `pnpm ai validate [change]`

检查 AI Kit 必需文件是否完整，检查当前 change 的 proposal/tasks/acceptance 是否存在，并检查 target 文件是否同步。

```bash
pnpm ai validate
pnpm ai validate bank-reconciliation
```

### `pnpm ai check [change]`

执行默认检查链路：

```bash
pnpm ai check
pnpm ai check bank-reconciliation
```

默认偏轻量，主要用于 AI 工作流收口。严格检查可以后续按项目情况扩展。

### `pnpm ai report [change]`

生成 Harness JSON 报告：

```bash
pnpm ai report
pnpm ai report bank-reconciliation
```

报告会写入：

```text
harness/reports/<timestamp>.json
```

### `pnpm ai status`

查看当前 Harness 状态：

```bash
pnpm ai status
```

### `pnpm ai current [change]`

查看或设置当前 active change：

```bash
pnpm ai current
pnpm ai current bank-reconciliation
```

### `pnpm ai resume`

根据当前 Harness 状态提示下一步应该走哪个 `/ai` flow。

```bash
pnpm ai resume
```

### `pnpm ai task-board <change>`

从 `tasks.md` 同步本地任务板。

```bash
pnpm ai task-board bank-reconciliation
```

### `pnpm ai task-next <change>`

查看下一个待处理任务。

```bash
pnpm ai task-next bank-reconciliation
```

### `pnpm ai task-start / task-done / task-block`

标记任务状态。

```bash
pnpm ai task-start T001 --change bank-reconciliation
pnpm ai task-done T001 --change bank-reconciliation
pnpm ai task-block T002 --change bank-reconciliation --reason "缺少运行环境"
```

### `pnpm ai agent-run <change>`

生成下一步 Agent 执行提示，适合长任务或多人接力。

```bash
pnpm ai agent-run bank-reconciliation
pnpm ai agent-run bank-reconciliation --claim
```

### `pnpm ai agent-finish <change>`

根据任务板、验收标准和检查结果评估最终状态。

```bash
pnpm ai agent-finish bank-reconciliation
pnpm ai agent-finish bank-reconciliation --check
```

如果还有运行时验证未完成，结果会是 `partially_accepted`，不会假装完成。

### `pnpm ai knowledge:search <keywords...>`

搜索项目 Knowledge Memory。

```bash
pnpm ai knowledge:search 银行对账
pnpm ai knowledge:search EccApplicationMst detail --limit 10
```

AI 在 `/ai:propose`、`/ai:plan`、`/ai:apply` 前应该先搜索 Knowledge。

### `pnpm ai knowledge:suggest <change> --write`

在 finish 阶段根据本次变更生成可沉淀知识候选。

```bash
pnpm ai knowledge:suggest bank-reconciliation --write
```

候选只是建议，不会自动变成事实。

### `pnpm ai knowledge:add`

人工确认后，把可复用知识写入 Knowledge Memory。

```bash
pnpm ai knowledge:add --type pattern --name "React detail migration" --summary "ExtJS detail 页面迁移到 React detail 页面时，先对齐数据流、保存入口和 grid 列格式化。" --keywords "ExtJS,React,detail" --used-in "apps/web/xxx/detail/index.tsx"
```

### `pnpm ai knowledge:list`

查看已有 Knowledge 记录。

```bash
pnpm ai knowledge:list
pnpm ai knowledge:list --type pattern
```

### `pnpm ai knowledge:index`

重建 Knowledge 索引。

```bash
pnpm ai knowledge:index
```

### `pnpm ai knowledge:dedupe`

按 id 合并重复 Knowledge 记录。

```bash
pnpm ai knowledge:dedupe
```

### `pnpm ai knowledge:analyze`

分析 Knowledge Memory 当前质量，提示后续可沉淀方向。

```bash
pnpm ai knowledge:analyze
```

### `pnpm ai integration:list`

查看 OpenSpec / Superpowers 当前集成模式。

```bash
pnpm ai integration:list
```

默认是 `lightweight`，即使用 CodePilot 内置轻量兼容流程。

### `pnpm ai integration:download <name>`

下载官方 OpenSpec 或 Superpowers 源码到仓库外目录。

```bash
pnpm ai integration:download openspec
pnpm ai integration:download superpowers
```

这个命令只下载，不启用，不全局安装。

### `pnpm ai integration:install <name> --source local:<path>`

把已下载的官方源码导入当前项目的 repo-local official 目录。

```bash
pnpm ai integration:install openspec --source "local:E:\path\to\openspec"
```

路径里有空格时必须加引号。

### `pnpm ai integration:use <name> <mode>`

切换集成模式。

```bash
pnpm ai integration:use openspec lightweight
pnpm ai integration:use openspec official
pnpm ai integration:use superpowers hybrid
```

支持模式：

- `lightweight`：使用 CodePilot 内置轻量版
- `official`：优先使用 repo-local 官方资源
- `hybrid`：轻量规则 + repo-local 官方资源结合

### `pnpm ai integration:validate <name>`

检查 repo-local official 资源是否可用。

```bash
pnpm ai integration:validate openspec
pnpm ai integration:validate openspec --execute
```

默认只 probe，不执行官方 CLI。只有显式 `--execute` 才执行。

### `pnpm ai integration:remove <name>`

移除 repo-local official/cache，并切回 lightweight。

```bash
pnpm ai integration:remove openspec
```

不会卸载全局工具，因为本工具不使用全局安装。

### `pnpm ai doctor`

检查本地 AI Kit 运行环境和 target 文件健康状态。

```bash
pnpm ai doctor
pnpm ai doctor --encoding
```

## AI 对话中的使用方式

推荐让 AI 按下面方式开始一个需求：

```text
/ai bank-reconciliation
银企交易记录查询，增加银行对账功能
```

AI 应该自动分派到合适阶段：

```text
/ai:propose -> /ai:plan -> /ai:apply -> /ai:verify -> /ai:finish
```

如果你想强制某一步：

```text
/ai:propose bank-reconciliation
/ai:apply bank-reconciliation
```

如果你不想走流程，直接正常提问即可，不加 `/ai`。

## 文件和 Git 建议

建议进入 Git：

```text
.ai/
openspec/
superpowers/
harness/config.json
harness/state.json
harness/tasks/
harness/memory/
AGENTS.md
.trae/
.qoder/
.cursor/
```

谨慎进入 Git 或按团队策略决定：

```text
harness/reports/
harness/runs/
```

不建议进入 Git：

```text
harness/integrations/*/official/
harness/integrations/*/cache/
```

## 安全边界

- 默认使用 lightweight，不强依赖官方 OpenSpec / Superpowers。
- 官方资源只允许 repo-local，不做全局安装。
- 不修改 PATH。
- 不默认执行官方 CLI。
- `init` 不覆盖已有 `scripts.ai`。
- package 升级不应该覆盖用户已编辑的 `.ai / openspec / superpowers / harness` 源文件。

## 当前版本状态

当前版本：

```text
1.0.0
```

适合作为团队试用包。正式发布前建议继续验证：

- Windows / macOS / Linux
- Codex / Trae / Qoder / Cursor
- 干净仓库初始化
- 已有仓库重复初始化
- Knowledge Memory 在真实需求中的搜索和沉淀效果
