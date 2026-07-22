import type { ToolConfig } from '../types';

export const toolConfigs: Record<string, ToolConfig> = {
  codex: {
    name: 'Codex',
    id: 'codex',
    rulesPath: '.codex/rules.md',
    commandsPath: '.codex/commands/',
    enabled: true,
    description: 'OpenAI Codex VSCode extension',
  },
  trae: {
    name: 'Trae',
    id: 'trae',
    rulesPath: '.trae/rules.md',
    commandsPath: '.trae/commands/',
    enabled: true,
    description: 'Trae AI coding assistant',
  },
  qoder: {
    name: 'Qoder',
    id: 'qoder',
    rulesPath: '.qoder/rules.md',
    commandsPath: '.qoder/commands/',
    enabled: true,
    description: 'Qoder AI assistant',
  },
  cursor: {
    name: 'Cursor',
    id: 'cursor',
    rulesPath: '.cursor/rules.md',
    commandsPath: '.cursor/commands/',
    enabled: true,
    description: 'Cursor AI editor',
  },
  copilot: {
    name: 'GitHub Copilot',
    id: 'copilot',
    rulesPath: '.github/copilot/rules.md',
    commandsPath: '.github/copilot/commands/',
    enabled: false,
    description: 'GitHub Copilot',
  },
  codeium: {
    name: 'Codeium',
    id: 'codeium',
    rulesPath: '.codeium/rules.md',
    commandsPath: '.codeium/commands/',
    enabled: false,
    description: 'Codeium AI',
  },
  codewhisperer: {
    name: 'Amazon CodeWhisperer',
    id: 'codewhisperer',
    rulesPath: '.codewhisperer/rules.md',
    commandsPath: '.codewhisperer/commands/',
    enabled: false,
    description: 'Amazon CodeWhisperer',
  },
  claude: {
    name: 'Claude',
    id: 'claude',
    rulesPath: '.claude/rules.md',
    commandsPath: '.claude/commands/',
    enabled: false,
    description: 'Anthropic Claude',
  },
};

export function getToolConfig(toolName: string): ToolConfig | undefined {
  return toolConfigs[toolName.toLowerCase()];
}

export function getAllTools(): ToolConfig[] {
  return Object.values(toolConfigs);
}

export function getEnabledTools(): ToolConfig[] {
  return Object.values(toolConfigs).filter((t) => t.enabled);
}

export function getDefaultToolIds(): string[] {
  return getEnabledTools().map((t) => t.id);
}
