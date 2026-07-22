# CodePilot AI

[English](README.en.md) | [中文](README.md)

CodePilot AI 是一个面向项目仓库的 AI 工程流程 CLI。它把需求与验收文档、阶段化 AI 工作流、本地任务状态、Knowledge Memory，以及 Codex、Trae、Qoder、Cursor 的规则同步集中到 `codepilot` 命令中。

## 核心能力

- OpenSpec-compatible 变更：管理 proposal、tasks、acceptance 和 notes。
- `/ai` 工作流：覆盖 explore、propose、plan、apply、verify、review、finish。
- Harness 状态：记录当前变更、任务、步骤、决策、验证和运行报告。
- Knowledge Memory：搜索、录入、索引、去重、分析和生成知识候选。
- 多编辑器同步：默认支持 Codex、Trae、Qoder、Cursor。
- Repo-local 集成：可导入 OpenSpec 或 Superpowers 官方资源，不修改全局 PATH。
- 工程辅助：提供 Git、备份、依赖关系、Hook、模板和升级命令。

## 环境要求

- Node.js 18 或更高版本
- npm、pnpm、yarn 或 bun

本文使用 pnpm 展示命令；使用其他包管理器时，将 `pnpm exec codepilot` 替换为对应执行方式即可。

## 快速开始

### 1. 安装

```bash
pnpm add -D codepilot-ai
```

### 2. 初始化

首次初始化时，项目里还没有 `scripts.ai`，因此使用：

```bash
pnpm exec codepilot init
```

`init` 会检测项目框架、构建工具和包管理器，创建流程文件，并在 `package.json` 中补充：

```json
{
  "scripts": {
    "ai": "codepilot"
  }
}
```

如果已有 `scripts.ai`，CodePilot 不会覆盖它。

### 3. 验证

```bash
pnpm ai validate
pnpm ai doctor
```

初始化后，后续命令统一使用：

```bash
pnpm ai <command>
```

## 初始化结果

默认初始化 `codex,trae,qoder,cursor`，并生成或维护：

```text
.ai/                         核心规则、流程和工具注册表
openspec/                    项目说明、活动变更和归档变更
superpowers/                 项目级技能文档
harness/                     配置、状态、任务、运行记录和知识库
.codex/                      Codex 规则与命令
.trae/                       Trae 规则与命令
.qoder/                      Qoder 规则与命令
.cursor/                     Cursor 规则与命令
```

只初始化部分工具：

```bash
pnpm exec codepilot init --tools codex,qoder
```

显式指定检测结果：

```bash
pnpm exec codepilot init \
  --framework react \
  --build-tool vite \
  --pm pnpm
```

支持的初始化参数：

- `--profile <profile>`：`lightweight`、`official` 或 `hybrid`。
- `--tools <tools>`：逗号分隔的工具列表。
- `--force`：请求覆盖生成目标。
- `--no-setup-gitignore`：不向业务项目的 `.gitignore` 追加 CodePilot 运行产物规则。
- `--framework <framework>`：React、Vue、Angular、Svelte、Next、Nuxt、Remix 或 Solid。
- `--build-tool <buildTool>`：webpack、vite、rollup、esbuild 或 parcel。
- `--pm <packageManager>`：npm、yarn、pnpm 或 bun。

## 集成模型

CodePilot 采用“包内模板 + 项目内状态”的集成方式，不依赖后台服务或数据库：

```text
codepilot-ai 包
  ├─ templates/  ──init/sync──> 业务项目的规则、流程和变更模板
  ├─ dist/cli.cjs ──命令操作──> openspec/、harness/ 和编辑器目录
  └─ bin/codepilot.cjs ───────> codepilot CLI
```

各部分职责如下：

- `.ai` 和 `superpowers` 保存 AI 可读取的规则、流程与技能说明。
- `openspec/changes/<change>` 是需求、任务、验收标准和实现笔记的事实来源。
- `harness/tasks` 将 Markdown checkbox 同步为带 ID、owner 和阻塞信息的 JSON 任务板。
- `harness/state.json` 保存当前变更、阶段、下一步、决策和阻塞状态。
- `harness/prompts`、`reports` 和 `runs` 保存 Agent 提示、检查报告和操作事件。
- `harness/memory` 保存可搜索、索引和去重的 Knowledge Memory。
- `harness/integrations` 保存导入到当前仓库的 OpenSpec 或 Superpowers 官方资源。

初始化默认以幂等方式维护 `.gitignore`：文件不存在时创建；文件已存在时保留全部用户内容，只在 `# CodePilot AI runtime artifacts` 标记下追加缺失规则。重复执行不会产生重复项。自动忽略报告、运行事件、Agent prompts、备份、Knowledge 派生索引以及 Integration official/cache 目录。

完整需求生命周期是：

```text
init/sync
  → new
  → proposal + tasks + acceptance
  → task-board / agent-run
  → apply
  → validate / check / verify
  → agent-finish
  → archive
  → knowledge suggest/add
```

## 推荐工作流

创建变更：

```bash
pnpm ai new bank-reconciliation --type feature
```

支持的类型为 `default`、`bugfix`、`feature`、`ui-change` 和 `refactor`。变更名只允许小写字母、数字、中文和单个连字符。

默认情况下，`new` 只创建变更文件，不修改当前 Git 分支。需要同时创建或切换到 `<type>/<change>` 分支时，显式传入 `--branch`：

```bash
pnpm ai new bank-reconciliation --type feature --branch
```

如果 `feature/bank-reconciliation` 已存在，命令会切换到该分支；否则创建新分支。非 Git 仓库中传入 `--branch` 不会执行分支操作。

生成目录：

```text
openspec/changes/bank-reconciliation/
├── proposal.md
├── tasks.md
├── acceptance.md
└── notes.md
```

随后可以执行：

```bash
pnpm ai task-board bank-reconciliation
pnpm ai agent-run bank-reconciliation --claim
pnpm ai check bank-reconciliation
pnpm ai verify bank-reconciliation --status passed
pnpm ai agent-finish bank-reconciliation --check
pnpm ai archive bank-reconciliation
```

在支持生成命令文件的 AI 编辑器中，也可以使用：

```text
/ai bank-reconciliation
/ai:explore bank-reconciliation
/ai:propose bank-reconciliation
/ai:plan bank-reconciliation
/ai:apply bank-reconciliation
/ai:verify bank-reconciliation
/ai:review bank-reconciliation
/ai:finish bank-reconciliation
```

普通问答不需要使用 `/ai`。

## 命令参考

### 初始化与同步

```bash
pnpm ai init [options]
pnpm ai sync [options]
```

`sync` 从 `.ai/core`、`.ai/flows` 和 `superpowers/skills` 重新生成编辑器规则：

```bash
pnpm ai sync --tools codex,qoder
pnpm ai sync --dry-run
pnpm ai sync --force
```

### 变更管理

```bash
pnpm ai new <change> [--type <type>] [--interactive] [--branch]
pnpm ai list [--archived]
pnpm ai validate [change] [--quiet]
pnpm ai check [change] [--strict] [--no-eslint]
pnpm ai report [change]
pnpm ai encoding [change] [--fix]
pnpm ai archive <change>
pnpm ai restore <change>
pnpm ai delete <change> --yes
```

`delete` 只删除 `openspec/archive/<change>` 下已归档的变更。所有变更路径都会经过名称和目录边界检查；交互终端要求输入确认，自动化环境必须传入 `--yes`。

### Harness 状态与任务

```bash
pnpm ai status
pnpm ai current [change]
pnpm ai resume
pnpm ai task-board [change]
pnpm ai task-next [change]
pnpm ai task-doing <task> [--change <change>] [--owner <owner>]
pnpm ai task-done <task> [--change <change>] [--owner <owner>]
pnpm ai task-block <task> [--change <change>] [--owner <owner>] [--reason <reason>]
```

记录验证、步骤和决策：

```bash
pnpm ai verify [change] --status passed --task "运行页面验收"
pnpm ai finish-state [change]
pnpm ai step "完成列表页实现" --change bank-reconciliation --flow apply
pnpm ai decision "继续沿用现有 API" --change bank-reconciliation
pnpm ai run-log --limit 20
```

### Agent 接力

```bash
pnpm ai agent-run [change] [--claim] [--mode prompt]
pnpm ai agent-finish [change] [--check] [--strict]
```

`agent-run --claim` 会领取下一个任务；`agent-finish` 根据任务板、验收项和检查结果评估是否完成。

### Knowledge Memory

Knowledge 是 `knowledge` 下的子命令，命令之间使用空格：

```bash
pnpm ai knowledge search 银行 对账 --limit 10
pnpm ai knowledge list --type pattern
pnpm ai knowledge index
pnpm ai knowledge dedupe
pnpm ai knowledge analyze --limit 10
pnpm ai knowledge suggest bank-reconciliation --write
```

人工确认后录入知识：

```bash
pnpm ai knowledge add \
  --type pattern \
  --name "React detail migration" \
  --summary "详情页迁移时先对齐数据流、保存入口和表格列格式。" \
  --keywords "React,detail,migration" \
  --used-in "apps/web/example/detail/index.tsx"
```

也可以通过 `--from <json-file>` 从 JSON 文件录入。

### OpenSpec / Superpowers 集成

集成命令同样使用空格分隔：

```bash
pnpm ai integration list
pnpm ai integration download openspec --dry-run
pnpm ai integration download openspec --to ../official-openspec
pnpm ai integration install openspec --source "local:../official-openspec"
pnpm ai integration use openspec official
pnpm ai integration validate openspec
pnpm ai integration validate openspec --execute
pnpm ai integration remove openspec --yes
```

支持的集成为 `openspec` 和 `superpowers`；模式为：

- `lightweight`：使用 CodePilot 内置轻量流程。
- `official`：使用导入到当前仓库的官方资源。
- `hybrid`：结合轻量规则和 repo-local 官方资源。

`download` 默认要求目标位于当前仓库外；`install` 和 `remove` 只允许操作 `harness/integrations/<name>` 内的目录，并拒绝通过符号链接越界。

当前集成模式和安装状态保存在各集成的 `config.json` 中；这些命令负责官方资源的下载、导入、健康检查和模式声明，不会全局安装工具或替换系统命令。

`official` 模式会从 repo-local OpenSpec 模板和 Superpowers 技能中解析资源；缺失时失败。`hybrid` 模式会自动回退到内置资源。

### 配置、诊断和流程

```bash
pnpm ai doctor [--strict] [--encoding]
pnpm ai config get <key>
pnpm ai config set <key> <value>
pnpm ai config list
pnpm ai config show
pnpm ai config reset
pnpm ai flow list
pnpm ai flow show <flow>
pnpm ai flow sync
```

配置 Schema 当前为 v2。读取 v1 配置时会保留现有字段、生成 `.v1.bak` 并迁移；高于当前版本的配置会被拒绝。`checks` 和 `strictChecks` 支持 `eslint`、`ai:validate`、`ai:report` 与 `script:<package-script>`。

### Git、依赖、Hook、模板和备份

```bash
pnpm ai git status
pnpm ai git info
pnpm ai git branch <change>
pnpm ai git commit [change]

pnpm ai dep add <change> <target> --type requires
pnpm ai dep remove <change> <target>
pnpm ai dep list <change>
pnpm ai dep check <change>
pnpm ai dep graph [change]

pnpm ai hook list
pnpm ai hook register <name> --priority 100
pnpm ai hook trigger <name> --change <change> --task <task>
pnpm ai hook unregister <name>
pnpm ai hook clear

pnpm ai template list
pnpm ai template add <name>
pnpm ai template show <name>
pnpm ai template edit <name>
pnpm ai template remove <name> --yes

pnpm ai backup create
pnpm ai backup list
pnpm ai backup restore <file>
pnpm ai backup delete <file> --yes

pnpm ai plugin list
pnpm ai plugin install <local-directory> --yes
pnpm ai plugin remove <name> --yes

pnpm ai upgrade version
pnpm ai upgrade check
pnpm ai upgrade install
```

插件仅从本地目录安装。设置 `CODEPILOT_ENABLE_PLUGINS=true` 才会加载并执行已安装插件。全局环境变量使用 `CODEPILOT_*` 前缀，例如 `CODEPILOT_DRY_RUN`、`CODEPILOT_LOCALE` 和 `CODEPILOT_SKIP_GIT`；旧的 `MSGFI_AI_*` 暂时兼容。

## 全局选项

全局选项放在子命令前：

```bash
pnpm ai --verbose doctor
pnpm ai --json status
pnpm ai --locale en-US doctor
```

- `-v, --verbose`：输出调试日志。
- `-q, --quiet`：抑制普通输出。
- `--dry-run`：预览操作。
- `--json`：使用 JSON 输出。
- `--locale zh-CN|en-US`：设置输出语言，默认 `zh-CN`。

## Git 建议

建议提交：

```text
.ai/
openspec/
superpowers/
harness/config.json
harness/state.json
harness/tasks/
harness/memory/
.codex/
.trae/
.qoder/
.cursor/
```

根据团队策略决定是否提交：

```text
harness/reports/
harness/runs/
```

通常不提交：

```text
harness/integrations/*/official/
harness/integrations/*/cache/
```

## 安全边界

- 不全局安装 OpenSpec 或 Superpowers，也不修改 PATH。
- 官方校验命令只有显式传入 `integration validate --execute` 才会运行。
- Integration 的安装、缓存和删除路径限制在对应 repo-local 目录内。
- 变更归档、恢复和删除拒绝路径穿越及符号链接目录。
- `init` 会保留已有项目模板和已有的 `scripts.ai`；`sync` 会重新生成所选编辑器的规则和命令文件。
- 包升级不会主动覆盖项目中的 `.ai`、`openspec`、`superpowers` 或 `harness` 文件。

## 本项目开发

### 本地质量链路

```bash
npm ci
npm run lint:check
npm run format:check
npm run test:coverage
npm run build
npm run smoke
```

构建脚本先使用本地 TypeScript 执行类型检查，再清理并编译 `dist/`，最后生成带 Node shebang 的 `dist/cli.cjs`。测试在独立临时项目根目录运行，不会修改当前仓库的真实 Harness 数据。

当前覆盖率门禁为：行和语句 10%、函数 25%、分支 20%。测试重点覆盖变更生命周期、路径边界、Harness 状态、Knowledge 搜索、日志和工具函数。

### CI 与发布

CI 在 Node.js 18 和 20 上依次执行依赖安装、lint、格式检查、构建、覆盖率测试和 CLI smoke test。

推送 `v*` Tag 后，发布工作流使用 Node.js 20 完成构建、覆盖率测试和 smoke test，然后执行带 provenance 的 npm 发布并创建 GitHub Release。发布需要配置 `NPM_TOKEN`。

npm 包通过 `prepack` 再次构建，发布内容限制为：

```text
bin/
dist/
templates/
README.md
README.en.md
package.json
```

## License

MIT
