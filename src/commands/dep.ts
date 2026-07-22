import { Command } from 'commander';
import {
  loadDependencies,
  addDependency,
  removeDependency,
  checkDependencies,
  getDependencyGraph,
  formatDependencyGraph,
} from '../lib/dependency';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';

export function registerDependencyCommands(program: Command) {
  const dep = program.command('dep').description('Dependency management commands');

  dep
    .command('add <change> <target>')
    .description('Add dependency between changes')
    .option('--type <type>', 'Dependency type (requires/blocks/related)', 'requires')
    .action(depAddCommand);

  dep
    .command('remove <change> <target>')
    .description('Remove dependency')
    .option('--type <type>', 'Dependency type (requires/blocks/related)', 'requires')
    .action(depRemoveCommand);

  dep.command('list <change>').description('List dependencies for change').action(depListCommand);

  dep.command('check <change>').description('Check dependency validity').action(depCheckCommand);

  dep.command('graph [change]').description('Show dependency graph').action(depGraphCommand);
}

function depAddCommand(change: string, target: string, options: { type?: string }) {
  const type = options.type as 'requires' | 'blocks' | 'related';
  addDependency(change, target, type);
}

function depRemoveCommand(change: string, target: string, options: { type?: string }) {
  const type = options.type as 'requires' | 'blocks' | 'related';
  removeDependency(change, target, type);
}

function depListCommand(change: string) {
  const deps = loadDependencies(change);
  if (isJsonOutput()) {
    console.log(JSON.stringify(deps, null, 2));
  } else {
    console.log(`=== Dependencies for ${change} ===`);
    console.log(`Requires: ${deps.requires.length ? deps.requires.join(', ') : 'none'}`);
    console.log(`Blocks: ${deps.blocks.length ? deps.blocks.join(', ') : 'none'}`);
    console.log(`Related: ${deps.related.length ? deps.related.join(', ') : 'none'}`);
  }
}

function depCheckCommand(change: string) {
  const result = checkDependencies(change);
  if (isJsonOutput()) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.valid) {
      logger.success(`All dependencies are valid for ${change}`);
    } else {
      logger.error(`Dependency check failed for ${change}`);
      if (result.missing.length) {
        console.log(`Missing required changes: ${result.missing.join(', ')}`);
      }
      if (result.blocked.length) {
        console.log(`Blocking changes not found: ${result.blocked.join(', ')}`);
      }
      process.exitCode = 1;
    }
  }
}

function depGraphCommand(change?: string) {
  const graph = getDependencyGraph(change);
  if (isJsonOutput()) {
    console.log(JSON.stringify(graph, null, 2));
  } else {
    console.log('=== Dependency Graph ===');
    console.log(formatDependencyGraph(graph));
  }
}
