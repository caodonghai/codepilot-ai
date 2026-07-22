import { Command } from 'commander';
import { flowNames, dispatcherFlow } from '../config/constants';
import { readText, writeGeneratedFile } from '../utils/file';
import { buildSyncFiles } from './init';

export function registerFlowCommands(program: Command) {
  const flow = program.command('flow').description('Workflow management');

  flow.command('list').description('List available flows').action(flowListCommand);

  flow.command('show <flow>').description('Show flow definition').action(flowShowCommand);

  flow.command('sync').description('Sync flow documents').action(flowSyncCommand);
}

function flowListCommand() {
  console.log(
    JSON.stringify(
      {
        dispatcher: dispatcherFlow,
        flows: flowNames,
      },
      null,
      2,
    ),
  );
}

function flowShowCommand(flowName: string) {
  const flowPath = `.ai/flows/${flowName}.md`;
  try {
    const content = readText(flowPath);
    console.log(content);
  } catch {
    console.error(`Flow not found: ${flowName}`);
    process.exitCode = 1;
  }
}

function flowSyncCommand() {
  const tools = ['codex', 'trae', 'qoder', 'cursor'];
  for (const file of buildSyncFiles(tools)) {
    writeGeneratedFile(file.path, file.content);
  }
  console.log(`Flows synced for tools: codex, trae, qoder, cursor`);
}
