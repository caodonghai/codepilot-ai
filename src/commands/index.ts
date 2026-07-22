import { registerInitCommands } from './init';
import { registerChangeCommands } from './change';
import { registerKnowledgeCommands } from './knowledge';
import { registerIntegrationCommands } from './integration';
import { registerFlowCommands } from './flow';
import { registerTaskCommands } from './task';
import { registerAgentCommands } from './agent';
import { registerHealthCommands } from './health';
import { registerConfigCommands } from './config';
import { registerGitCommands } from './git';
import { registerTemplateCommands } from './template';
import { registerBackupCommands } from './backup';
import { registerUpgradeCommands } from './upgrade';
import type { Command } from 'commander';

export function registerAllCommands(program: Command) {
  registerInitCommands(program);
  registerChangeCommands(program);
  registerKnowledgeCommands(program);
  registerIntegrationCommands(program);
  registerFlowCommands(program);
  registerTaskCommands(program);
  registerAgentCommands(program);
  registerHealthCommands(program);
  registerConfigCommands(program);
  registerGitCommands(program);
  registerTemplateCommands(program);
  registerBackupCommands(program);
  registerUpgradeCommands(program);
}
