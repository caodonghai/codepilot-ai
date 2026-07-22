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

  packageJson.scripts.ai = 'msgfi-ai';
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  return 'Added package.json script: "ai": "msgfi-ai"';
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
      return `# ${change}\n\n## Type\n\nbugfix\n\n## Bug\n\nDescribe the observed incorrect behavior.\n\n## Expected Behavior\n\nDescribe the correct behavior.\n\n## Root Cause\n\nDescribe the suspected or confirmed cause.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected routes, components, APIs, data fields, or user flows.\n`;
    }
    if (type === 'feature') {
      return `# ${change}\n\n## Type\n\nfeature\n\n## Background\n\nDescribe the user need or business goal.\n\n## Goal\n\nDescribe the intended capability.\n\n## User Flow\n\nDescribe the target workflow.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected apps, pages, APIs, permissions, states, or data models.\n`;
    }
    if (type === 'ui-change') {
      return `# ${change}\n\n## Type\n\nui-change\n\n## Background\n\nDescribe the UI problem or requested adjustment.\n\n## Goal\n\nDescribe the desired UI behavior.\n\n## States\n\n- Default:\n- Loading:\n- Empty:\n- Error:\n- Disabled:\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected components, routes, responsive states, and visual risks.\n`;
    }
    if (type === 'refactor') {
      return `# ${change}\n\n## Type\n\nrefactor\n\n## Background\n\nDescribe the maintainability problem.\n\n## Goal\n\nDescribe the intended internal improvement.\n\n## Behavior Contract\n\nDescribe behavior that must remain unchanged.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected modules, exports, tests, and migration risks.\n`;
    }
    return `# ${change}\n\n## Background\n\nDescribe the problem or opportunity.\n\n## Goal\n\nDescribe the intended outcome.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Impact\n\nList affected apps, packages, routes, APIs, or UI states.\n`;
  }
  if (kind === 'tasks.md') {
    if (type === 'bugfix') {
      return `# Tasks\n\n- [ ] Reproduce or inspect the reported bug path.\n- [ ] Locate the smallest affected code path.\n- [ ] Confirm root cause.\n- [ ] Implement the scoped fix.\n- [ ] Verify the expected behavior.\n- [ ] Check related regression paths.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'feature') {
      return `# Tasks\n\n- [ ] Confirm affected app/package scope.\n- [ ] Confirm data, API, permission, and UI contracts.\n- [ ] Implement the requested capability.\n- [ ] Handle loading, empty, error, and disabled states where applicable.\n- [ ] Update or add focused verification.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'ui-change') {
      return `# Tasks\n\n- [ ] Inspect the existing component and design conventions.\n- [ ] Implement the UI adjustment within existing patterns.\n- [ ] Verify responsive layout and text fit.\n- [ ] Verify loading, empty, error, and disabled states where applicable.\n- [ ] Run focused lint or visual checks.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    if (type === 'refactor') {
      return `# Tasks\n\n- [ ] Document current behavior before changing code.\n- [ ] Identify safe refactor boundaries.\n- [ ] Refactor without changing user-visible behavior.\n- [ ] Update imports/usages if needed.\n- [ ] Run focused regression checks.\n- [ ] Run \`pnpm ai check\`.\n`;
    }
    return `# Tasks\n\n- [ ] Confirm affected app/package scope.\n- [ ] Implement the requested behavior.\n- [ ] Update or add verification where appropriate.\n- [ ] Run \`pnpm ai check\`.\n`;
  }
  if (kind === 'acceptance.md') {
    if (type === 'bugfix') {
      return `# Acceptance Criteria\n\n- [ ] The reported incorrect behavior is fixed.\n- [ ] The expected behavior is verified on the affected path.\n- [ ] Related behavior outside the bug scope is not regressed.\n- [ ] The fix is scoped and does not alter shared helpers unless explicitly justified.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'feature') {
      return `# Acceptance Criteria\n\n- [ ] The requested capability works for the primary user flow.\n- [ ] Required UI states are handled where applicable.\n- [ ] Data/API/permission behavior matches the proposal.\n- [ ] Existing related behavior is not regressed.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'ui-change') {
      return `# Acceptance Criteria\n\n- [ ] The UI matches the requested behavior and existing design conventions.\n- [ ] Text, spacing, and controls fit at relevant viewport sizes.\n- [ ] Required states are visually and functionally handled.\n- [ ] Existing interactions are not regressed.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    if (type === 'refactor') {
      return `# Acceptance Criteria\n\n- [ ] User-visible behavior remains unchanged.\n- [ ] Public contracts, routes, APIs, and data formats remain compatible unless explicitly proposed.\n- [ ] The refactor reduces meaningful complexity or duplication.\n- [ ] Focused regression checks pass.\n- [ ] \`pnpm ai check\` passes or unrelated failures are documented.\n`;
    }
    return `# Acceptance Criteria\n\n- [ ] Behavior matches the proposal.\n- [ ] UI states are handled when applicable.\n- [ ] Existing related behavior is not regressed.\n- [ ] \`pnpm ai check\` passes.\n`;
  }
  return `# Notes\n\nChange type: ${type}\n\nRecord implementation and verification notes here.\n`;
}

export function listTargetFiles(tool: string): string[] {
  const targetFiles: Record<string, string[]> = {
    codex: [
      'AGENTS.md',
      '.codex/skills/msgfi-ai/SKILL.md',
      ...flowNames.map((flow) => `.codex/skills/msgfi-ai-${flow}/SKILL.md`),
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
    cursor: ['.cursor/rules/msgfi-ai.mdc', '.cursor/rules/msgfi-frontend.mdc'],
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
