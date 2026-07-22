import { Command } from 'commander';
import { registerAllCommands } from './commands';

const program = new Command();

program.name('msgfi-ai').description('MsgFi AI Engineering Kit');

registerAllCommands(program);

program.parse(process.argv);
