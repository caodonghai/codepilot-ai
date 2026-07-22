import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import type { Command } from 'commander';
import { resolvePath } from '../utils/file';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  commands?: Array<{
    name: string;
    description: string;
    action: (args: string[], options: Record<string, unknown>) => void | Promise<void>;
  }>;
  hooks?: Array<{
    name: string;
    handler: (context: Record<string, unknown>) => void | Promise<void>;
  }>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main?: string;
}

const PLUGIN_DIR = 'harness/plugins';
const pluginNamePattern = /^[a-z0-9][a-z0-9-]*$/;

function assertPluginName(name: string) {
  if (!pluginNamePattern.test(name)) throw new Error(`Invalid plugin name: ${name}`);
  return name;
}

export function loadPlugins(): Plugin[] {
  const plugins: Plugin[] = [];
  const pluginDir = resolvePath(PLUGIN_DIR);

  if (!fs.existsSync(pluginDir)) {
    return plugins;
  }

  const entries = fs.readdirSync(pluginDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginPath = path.join(pluginDir, entry.name);
    const manifestPath = path.join(pluginPath, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      logger.warn(`Plugin ${entry.name} missing plugin.json`);
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PluginManifest;
      assertPluginName(manifest.name);
      const mainPath = path.resolve(pluginPath, manifest.main || 'index.js');
      if (!mainPath.startsWith(`${path.resolve(pluginPath)}${path.sep}`)) {
        throw new Error('Plugin main must stay inside its plugin directory.');
      }

      if (!fs.existsSync(mainPath)) {
        logger.warn(`Plugin ${manifest.name} missing main file`);
        continue;
      }

      const plugin = require(mainPath) as Plugin;
      plugins.push({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        commands: plugin.commands || [],
        hooks: plugin.hooks || [],
      });

      logger.debug(`Loaded plugin: ${manifest.name}@${manifest.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin ${entry.name}: ${(error as Error).message}`);
    }
  }

  return plugins;
}

export function registerPluginCommands(program: Command, plugins: Plugin[]): void {
  for (const plugin of plugins) {
    if (!plugin.commands) continue;

    for (const cmd of plugin.commands) {
      const command = program.command(cmd.name).description(cmd.description);
      command.action((...args) => {
        const options = args.pop() as Record<string, unknown>;
        const cmdArgs = args as string[];
        return cmd.action(cmdArgs, options);
      });

      logger.debug(`Registered plugin command: ${cmd.name}`);
    }
  }
}

export function registerPluginHooks(plugins: Plugin[]): void {
  const { registerHook } = require('./hooks');

  for (const plugin of plugins) {
    if (!plugin.hooks) continue;

    for (const hook of plugin.hooks) {
      registerHook(hook.name as never, hook.handler);
      logger.debug(`Registered plugin hook: ${hook.name}`);
    }
  }
}

export function listPlugins(): Plugin[] {
  return loadPlugins();
}

export function installPlugin(pluginPath: string): boolean {
  pluginPath = path.resolve(pluginPath);
  if (!fs.existsSync(pluginPath) || !fs.statSync(pluginPath).isDirectory()) {
    throw new Error(`Plugin source must be a local directory: ${pluginPath}`);
  }
  const manifestPath = path.join(pluginPath, 'plugin.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Plugin source is missing plugin.json.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PluginManifest;
  assertPluginName(manifest.name);
  const pluginDir = resolvePath(PLUGIN_DIR);
  const destPath = path.join(pluginDir, manifest.name);

  try {
    fs.mkdirSync(pluginDir, { recursive: true });
    if (fs.existsSync(destPath)) throw new Error(`Plugin already installed: ${manifest.name}`);
    fs.cpSync(pluginPath, destPath, { recursive: true, errorOnExist: true });
    logger.success(`Plugin installed: ${manifest.name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to install plugin: ${(error as Error).message}`);
    return false;
  }
}

export function uninstallPlugin(pluginName: string): boolean {
  assertPluginName(pluginName);
  const pluginDir = resolvePath(PLUGIN_DIR);
  const pluginPath = path.join(pluginDir, pluginName);

  if (!fs.existsSync(pluginPath)) {
    logger.error(`Plugin not found: ${pluginName}`);
    return false;
  }

  try {
    fs.rmSync(pluginPath, { recursive: true });
    logger.success(`Plugin uninstalled: ${pluginName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to uninstall plugin: ${(error as Error).message}`);
    return false;
  }
}
