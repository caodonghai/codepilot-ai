import { Command } from 'commander';
import fs from 'fs';
import { resolvePath, ensureDir } from '../utils/file';
import { logger } from '../lib/logger';
import { isJsonOutput } from '../lib/context';
import { t } from '../lib/i18n';

export function registerTemplateCommands(program: Command) {
  const template = program.command('template').description('Template management commands');

  template.command('list').description('List available templates').action(templateListCommand);

  template.command('add <name>').description('Add custom template').action(templateAddCommand);

  template.command('remove <name>').description('Remove template').action(templateRemoveCommand);

  template.command('edit <name>').description('Edit template content').action(templateEditCommand);

  template.command('show <name>').description('Show template content').action(templateShowCommand);
}

const templateDir = 'openspec/changes';

interface TemplateInfo {
  name: string;
  files: string[];
  path: string;
}

function getTemplates(): TemplateInfo[] {
  const dirPath = resolvePath(templateDir);
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '.template')
    .map((entry) => {
      const templatePath = resolvePath(templateDir, entry.name);
      const files = fs.readdirSync(templatePath).filter((f) => f.endsWith('.md'));
      return {
        name: entry.name,
        files,
        path: templatePath,
      };
    });
}

function templateListCommand() {
  const templates = getTemplates();
  if (isJsonOutput()) {
    console.log(JSON.stringify(templates, null, 2));
  } else {
    if (!templates.length) {
      logger.info(t('template.no_templates'));
      return;
    }
    console.log('=== Available Templates ===');
    for (const template of templates) {
      console.log(`\n${template.name}`);
      console.log(`  Path: ${template.path}`);
      console.log(`  Files: ${template.files.join(', ')}`);
    }
  }
}

function templateAddCommand(name: string) {
  const templatePath = resolvePath(templateDir, name);
  if (fs.existsSync(templatePath)) {
    logger.error(`Template already exists: ${name}`);
    process.exitCode = 1;
    return;
  }

  ensureDir(templateDir, name);

  const defaultFiles = ['proposal.md', 'tasks.md', 'acceptance.md', 'notes.md'];
  for (const file of defaultFiles) {
    const filePath = resolvePath(templateDir, name, file);
    fs.writeFileSync(
      filePath,
      `# ${file.replace('.md', '').toUpperCase()}\n\n<!-- Template content -->\n`,
    );
  }

  logger.success(`Template created: ${name}`);
  logger.info(`Files created: ${defaultFiles.join(', ')}`);
}

function templateRemoveCommand(name: string) {
  const templatePath = resolvePath(templateDir, name);
  if (!fs.existsSync(templatePath)) {
    logger.error(`Template not found: ${name}`);
    process.exitCode = 1;
    return;
  }

  fs.rmSync(templatePath, { recursive: true, force: true });
  logger.success(`Template removed: ${name}`);
}

function templateEditCommand(name: string) {
  const templatePath = resolvePath(templateDir, name);
  if (!fs.existsSync(templatePath)) {
    logger.error(`Template not found: ${name}`);
    process.exitCode = 1;
    return;
  }

  const editor = process.env.EDITOR || 'vi';
  logger.info(`Opening template in ${editor}...`);

  const { spawnSync } = require('child_process');
  const result = spawnSync(editor, [templatePath], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    logger.error(`Editor exited with code: ${result.status}`);
    process.exitCode = 1;
  } else {
    logger.success(`Template edited: ${name}`);
  }
}

function templateShowCommand(name: string) {
  const templatePath = resolvePath(templateDir, name);
  if (!fs.existsSync(templatePath)) {
    logger.error(`Template not found: ${name}`);
    process.exitCode = 1;
    return;
  }

  const files = fs.readdirSync(templatePath).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const filePath = resolvePath(templatePath, file);
    console.log(`=== ${file} ===`);
    console.log(fs.readFileSync(filePath, 'utf8'));
    console.log();
  }
}
