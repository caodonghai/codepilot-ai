import fs from 'fs';
import path from 'path';
import { resolvePath, writeFileIfMissing } from '../utils/file';
import {
  defaultTools,
  coreFiles,
  dispatcherFlow,
  flowNames,
  skillFiles,
} from '../config/constants';

export function setupPackageScript(options: { enabled?: boolean } = {}) {
  if (options.enabled === false) return 'Skipped package.json script setup by option.';

  const packagePath = resolvePath('package.json');
  if (!fs.existsSync(packagePath)) {
    return 'Skipped package.json script setup because package.json was not found.';
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8').replace(/^\uFEFF/, ''));
  packageJson.scripts = packageJson.scripts ?? {};
  if (packageJson.scripts.ai) {
    return `Skipped package.json script setup because scripts.ai already exists: ${packageJson.scripts.ai}`;
  }

  packageJson.scripts.ai = 'codepilot';
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return 'Added package.json script: "ai": "codepilot"';
}

export function findTemplateRoot() {
  const candidates = [
    resolvePath('packages', 'ai-engineering-kit', 'templates'),
    path.resolve(__dirname, '..', '..', 'packages', 'ai-engineering-kit', 'templates'),
    path.resolve(__dirname, '..', 'templates'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function writeFileIfMissingFromTemplate(
  templateRoot: string,
  templateRelativePath: string,
  targetRelativePath: string,
) {
  const templatePath = path.join(templateRoot, templateRelativePath);
  if (!fs.existsSync(templatePath)) {
    return false;
  }
  writeFileIfMissing(targetRelativePath, fs.readFileSync(templatePath, 'utf8'));
  return true;
}

export function seedProjectTemplates() {
  const templateRoot = findTemplateRoot();
  if (!templateRoot) {
    return ['Package templates not found. Init continued with existing embedded/default behavior.'];
  }

  const missing: string[] = [];
  const copy = (templateRelativePath: string, targetRelativePath: string) => {
    if (!writeFileIfMissingFromTemplate(templateRoot, templateRelativePath, targetRelativePath)) {
      missing.push(templateRelativePath);
    }
  };

  for (const file of coreFiles) {
    copy(path.join('ai', 'core', file), path.join('.ai', 'core', file));
  }
  copy(path.join('ai', 'registry', 'tools.json'), path.join('.ai', 'registry', 'tools.json'));
  copy(
    path.join('ai', 'flows', `${dispatcherFlow}.md`),
    path.join('.ai', 'flows', `${dispatcherFlow}.md`),
  );
  for (const flow of flowNames) {
    copy(path.join('ai', 'flows', `${flow}.md`), path.join('.ai', 'flows', `${flow}.md`));
  }
  for (const file of skillFiles) {
    copy(path.join('superpowers', 'skills', file), path.join('superpowers', 'skills', file));
  }
  copy(path.join('openspec', 'project.md'), path.join('openspec', 'project.md'));
  copy(path.join('harness', 'state.json'), path.join('harness', 'state.json'));

  return missing.map((file) => `Missing package template: ${file}`);
}

function renderTemplate(content: string, data: Record<string, string>) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? key);
}

export function templateChangeFile(change: string, kind: string, type: string = 'default') {
  const templateRoot = findTemplateRoot();
  if (templateRoot) {
    const templatePath = path.join(templateRoot, 'changes', type, kind);
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf8');
      return renderTemplate(content, { change, type });
    }

    const fallbackPath = path.join(templateRoot, 'changes', 'default', kind);
    if (fs.existsSync(fallbackPath)) {
      const content = fs.readFileSync(fallbackPath, 'utf8');
      return renderTemplate(content, { change, type });
    }
  }

  if (kind === 'proposal.md') {
    if (type === 'bugfix') {
      return `# ${change}\n\n## 类型\n\nbugfix\n\n## Bug\n\n描述观察到的不正确行为。\n\n## 预期行为\n\n描述正确的行为。\n\n## 根本原因\n\n描述疑似或已确认的原因。\n\n## 范围\n\n- 在范围内：\n- 在范围外：\n\n## 影响\n\n列出受影响的路由、组件、API、数据字段或用户流程。\n`;
    }
    if (type === 'feature') {
      return `# ${change}\n\n## 类型\n\nfeature\n\n## 背景\n\n描述用户需求或业务目标。\n\n## 目标\n\n描述预期的能力。\n\n## 用户流程\n\n描述目标工作流程。\n\n## 范围\n\n- 在范围内：\n- 在范围外：\n\n## 影响\n\n列出受影响的应用、页面、API、权限、状态或数据模型。\n`;
    }
    if (type === 'ui-change') {
      return `# ${change}\n\n## 类型\n\nui-change\n\n## 背景\n\n描述 UI 问题或请求的调整。\n\n## 目标\n\n描述期望的 UI 行为。\n\n## 状态\n\n- 默认：\n- 加载：\n- 空状态：\n- 错误：\n- 禁用：\n\n## 范围\n\n- 在范围内：\n- 在范围外：\n\n## 影响\n\n列出受影响的组件、路由、响应状态和视觉风险。\n`;
    }
    if (type === 'refactor') {
      return `# ${change}\n\n## 类型\n\nrefactor\n\n## 背景\n\n描述可维护性问题。\n\n## 目标\n\n描述预期的内部改进。\n\n## 行为契约\n\n描述必须保持不变的行为。\n\n## 范围\n\n- 在范围内：\n- 在范围外：\n\n## 影响\n\n列出受影响的模块、导出、测试和迁移风险。\n`;
    }
    return `# ${change}\n\n## 背景\n\n描述问题或机会。\n\n## 目标\n\n描述预期结果。\n\n## 范围\n\n- 在范围内：\n- 在范围外：\n\n## 影响\n\n列出受影响的应用、包、路由、API 或 UI 状态。\n`;
  }
  if (kind === 'tasks.md') {
    if (type === 'bugfix') {
      return `# 任务\n\n- [ ] 重现或检查报告的 bug 路径。\n- [ ] 定位最小受影响的代码路径。\n- [ ] 确认根本原因。\n- [ ] 实现范围修复。\n- [ ] 验证预期行为。\n- [ ] 检查相关回归路径。\n- [ ] 运行 \`pnpm ai check\`。\n`;
    }
    if (type === 'feature') {
      return `# 任务\n\n- [ ] 确认受影响的应用/包范围。\n- [ ] 确认数据、API、权限和 UI 契约。\n- [ ] 实现请求的能力。\n- [ ] 在适用的地方处理加载、空状态、错误和禁用状态。\n- [ ] 更新或添加聚焦验证。\n- [ ] 运行 \`pnpm ai check\`。\n`;
    }
    if (type === 'ui-change') {
      return `# 任务\n\n- [ ] 检查现有组件和设计约定。\n- [ ] 在现有模式内实现 UI 调整。\n- [ ] 验证响应式布局和文本适配。\n- [ ] 在适用的地方验证加载、空状态、错误和禁用状态。\n- [ ] 运行聚焦 lint 或视觉检查。\n- [ ] 运行 \`pnpm ai check\`。\n`;
    }
    if (type === 'refactor') {
      return `# 任务\n\n- [ ] 在修改代码之前记录当前行为。\n- [ ] 识别安全的重构边界。\n- [ ] 在不改变用户可见行为的情况下进行重构。\n- [ ] 如果需要，更新导入/用法。\n- [ ] 运行聚焦回归检查。\n- [ ] 运行 \`pnpm ai check\`。\n`;
    }
    return `# 任务\n\n- [ ] 确认受影响的应用/包范围。\n- [ ] 实现请求的行为。\n- [ ] 在适当的地方更新或添加验证。\n- [ ] 运行 \`pnpm ai check\`。\n`;
  }
  if (kind === 'acceptance.md') {
    if (type === 'bugfix') {
      return `# 验收标准\n\n- [ ] 报告的不正确行为已修复。\n- [ ] 在受影响路径上验证了预期行为。\n- [ ] bug 范围外的相关行为未回归。\n- [ ] 修复是有范围的，除非明确说明理由，否则不改变共享助手。\n- [ ] \`pnpm ai check\` 通过或记录了无关的失败。\n`;
    }
    if (type === 'feature') {
      return `# 验收标准\n\n- [ ] 请求的能力对主要用户流程有效。\n- [ ] 在适用的地方处理了必需的 UI 状态。\n- [ ] 数据/API/权限行为符合提案。\n- [ ] 现有相关行为未回归。\n- [ ] \`pnpm ai check\` 通过或记录了无关的失败。\n`;
    }
    if (type === 'ui-change') {
      return `# 验收标准\n\n- [ ] UI 符合请求的行为和现有设计约定。\n- [ ] 文本、间距和控件在相关视口尺寸下适配。\n- [ ] 必需状态在视觉和功能上得到处理。\n- [ ] 现有交互未回归。\n- [ ] \`pnpm ai check\` 通过或记录了无关的失败。\n`;
    }
    if (type === 'refactor') {
      return `# 验收标准\n\n- [ ] 用户可见行为保持不变。\n- [ ] 公共契约、路由、API 和数据格式保持兼容，除非明确提议更改。\n- [ ] 重构减少了有意义的复杂性或重复。\n- [ ] 聚焦回归检查通过。\n- [ ] \`pnpm ai check\` 通过或记录了无关的失败。\n`;
    }
    return `# 验收标准\n\n- [ ] 行为符合提案。\n- [ ] 在适用时处理 UI 状态。\n- [ ] 现有相关行为未回归。\n- [ ] \`pnpm ai check\` 通过。\n`;
  }
  return `# 笔记\n\n变更类型：${type}\n\n在此记录实现和验证笔记。\n`;
}

export function listTargetFiles(tool: string): string[] {
  const targetFiles: Record<string, string[]> = {
    codex: [
      'AGENTS.md',
      '.codex/skills/codepilot/SKILL.md',
      ...flowNames.map((flow) => `.codex/skills/codepilot-${flow}/SKILL.md`),
    ],
    trae: [
      '.trae/rules.md',
      '.trae/commands/ai.md',
      ...flowNames.map((flow) => `.trae/commands/ai-${flow}.md`),
    ],
    qoder: [
      '.qoder/rules.md',
      '.qoder/commands/ai.md',
      ...flowNames.map((flow) => `.qoder/commands/ai/${flow}.md`),
    ],
    cursor: ['.cursor/rules/codepilot.mdc', '.cursor/rules/codepilot-frontend.mdc'],
  };
  return targetFiles[tool] || [];
}

export function applyToolSkip(tools: string[], skipValue?: string) {
  if (!skipValue) return tools;
  const skipped = skipValue
    .split(',')
    .map((item) => item.trim())
    .filter((tool) => (defaultTools as string[]).includes(tool));
  return tools.filter((tool) => !skipped.includes(tool));
}

export function normalizeTools(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tool): tool is string => defaultTools.includes(tool));
}

export function collectCoreSummary() {
  return coreFiles.map((file) => `- .ai/core/${file}`).join('\n');
}

export function collectFlowSummary() {
  return [
    `- /ai: .ai/flows/${dispatcherFlow}.md`,
    ...flowNames.map((flow) => `- /ai:${flow}: .ai/flows/${flow}.md`),
  ].join('\n');
}

export function collectSkillSummary() {
  return skillFiles.map((file) => `- superpowers/skills/${file}`).join('\n');
}
