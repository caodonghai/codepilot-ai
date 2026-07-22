# 贡献指南

请使用 Node.js 18 或更高版本，并通过 `npm ci` 安装依赖。

提交 Pull Request 前，请运行：

```bash
npm run lint:check
npm run format:check
npm run test:coverage
npm run build
npm run smoke
```

请保持变更范围聚焦，并为行为变化增加测试。面向用户的命令发生变化时，应同时更新 `README.md` 和 `README.en.md`。不要提交 `harness/` 下生成的运行时产物。
