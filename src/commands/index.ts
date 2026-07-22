import { registerInitCommands } from './init';
import { registerChangeCommands } from './change';
import { registerKnowledgeCommands } from './knowledge';
import { registerIntegrationCommands } from './integration';
import { registerFlowCommands } from './flow';
import type { Command } from 'commander';

export function registerAllCommands(program: Command) {
  registerInitCommands(program);
  registerChangeCommands(program);
  registerKnowledgeCommands(program);
  registerIntegrationCommands(program);
  registerFlowCommands(program);
}

export { registerInitCommands } from './init';
export { registerChangeCommands } from './change';
export { registerKnowledgeCommands } from './knowledge';
export { registerIntegrationCommands } from './integration';
export { registerFlowCommands } from './flow';
