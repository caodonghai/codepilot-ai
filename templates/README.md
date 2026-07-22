# 模板

此目录包含第一个包拥有的默认模板快照。

当前状态：

- `.ai/core`、`.ai/flows`、`superpowers/skills`、`openspec/project.md` 和 `harness/config.json` 已从当前工作仓库中初始化。
- `manifest.json` 记录哪些路径是包模板、生成的同步输出和项目拥有的状态。
- 工作实现仍在 `scripts/ai/cli.ts` 中嵌入了一些回退模板。
- 项目拥有的生成文件保留在仓库根目录，如 `.ai`、`openspec`、`superpowers`、`harness`、`AGENTS.md`、`.codex`、`.trae`、`.qoder` 和 `.cursor`。
- 下一步迁移是将嵌入的默认内容提取到此目录，而不改变生成的项目行为。

目标结构：

```text
templates/
  ai/
    core/
    flows/
  superpowers/
    skills/
  openspec/
    project.md
  harness/
    config.json
  targets/
    codex/
    trae/
    qoder/
    cursor/
```