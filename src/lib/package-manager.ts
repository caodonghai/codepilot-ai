import { spawnSync } from 'child_process';
import type { PackageManager } from '../types';
import { detectPackageManager } from './project';

export function getPackageManagerCommand(pm: PackageManager): string {
  return pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npm';
}

export function getInstallCommand(pm: PackageManager): string[] {
  if (pm === 'pnpm') return ['pnpm', 'install'];
  if (pm === 'yarn') return ['yarn', 'install'];
  if (pm === 'bun') return ['bun', 'install'];
  return ['npm', 'install'];
}

export function getScriptCommand(pm: PackageManager, script: string): string[] {
  if (pm === 'pnpm') return ['pnpm', script];
  if (pm === 'yarn') return ['yarn', script];
  if (pm === 'bun') return ['bun', 'run', script];
  return ['npm', 'run', script];
}

export interface RunScriptResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runScript(
  script: string,
  options?: { cwd?: string; pm?: PackageManager; args?: string[] },
): RunScriptResult {
  const pm = options?.pm || detectPackageManager();
  const cmd = getScriptCommand(pm, script);
  if (options?.args) cmd.push(...options.args);

  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: options?.cwd || process.cwd(),
    shell: false,
    encoding: 'utf8',
  });

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}
