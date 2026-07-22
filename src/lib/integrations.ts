import fs from 'fs';
import path from 'path';
import type { IntegrationConfig, IntegrationName } from '../types';
import { resolvePath, writeGeneratedFile, exists, readText } from '../utils/file';
import { integrationNames } from '../config/constants';

export function defaultIntegrationConfig(name: IntegrationName): IntegrationConfig {
  return {
    name,
    mode: 'lightweight',
    officialInstalled: false,
    officialPath: `harness/integrations/${name}/official`,
    cachePath: `harness/integrations/${name}/cache`,
    updatedAt: new Date().toISOString(),
  };
}

export function integrationConfigPath(name: IntegrationName) {
  return `harness/integrations/${name}/config.json`;
}

export function loadIntegrationConfig(name: IntegrationName): IntegrationConfig {
  const relativePath = integrationConfigPath(name);
  if (!exists(relativePath)) return defaultIntegrationConfig(name);
  try {
    return {
      ...defaultIntegrationConfig(name),
      ...JSON.parse(readText(relativePath)),
      name,
    };
  } catch (error) {
    console.error(`Invalid ${relativePath}: ${(error as Error).message}`);
    return defaultIntegrationConfig(name);
  }
}

export function saveIntegrationConfig(config: IntegrationConfig) {
  writeGeneratedFile(
    integrationConfigPath(config.name),
    `${JSON.stringify(
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

export function loadIntegrations() {
  return Object.fromEntries(
    integrationNames.map((name) => [name, loadIntegrationConfig(name)]),
  ) as Record<IntegrationName, IntegrationConfig>;
}

export function inspectIntegrationHealth(name: IntegrationName, config?: IntegrationConfig) {
  if (!config) config = loadIntegrationConfig(name);
  const officialPath = resolvePath(config.officialPath);
  if (!config.officialInstalled) {
    return {
      health: 'not_installed' as const,
      usable: false,
      reason: 'officialInstalled is false',
      evidence: [] as string[],
      missing: [] as string[],
    };
  }
  if (!fs.existsSync(officialPath)) {
    return {
      health: 'missing' as const,
      usable: false,
      reason: `Missing ${config.officialPath}`,
      evidence: [] as string[],
      missing: [config.officialPath],
    };
  }

  const evidence: string[] = [];
  const missing: string[] = [];
  const has = (relativePath: string) => {
    const fullPath = path.join(officialPath, relativePath);
    if (fs.existsSync(fullPath)) {
      evidence.push(`${config?.officialPath}/${relativePath}`);
      return true;
    }
    missing.push(`${config?.officialPath}/${relativePath}`);
    return false;
  };

  if (name === 'openspec') {
    has('README.md');
    has('package.json');
  } else {
    has('README.md');
    if (
      fs.existsSync(path.join(officialPath, 'skills')) ||
      fs.existsSync(path.join(officialPath, 'commands')) ||
      fs.existsSync(path.join(officialPath, 'superpowers'))
    ) {
      evidence.push(`${config?.officialPath}/skills|commands|superpowers`);
    } else {
      missing.push(`${config?.officialPath}/skills or commands or superpowers`);
    }
  }

  const usable = evidence.length > 0 && (name === 'superpowers' ? evidence.length >= 2 : true);
  return {
    health: usable ? ('usable' as const) : ('incomplete' as const),
    usable,
    reason: usable
      ? 'Repo-local official resources look usable.'
      : `Repo-local official resources are incomplete: ${missing.join(', ')}`,
    evidence,
    missing,
  };
}

export interface ResolvedIntegration {
  name: IntegrationName;
  mode: IntegrationConfig['mode'];
  source: 'builtin' | 'official';
  root: string | null;
  fallbackReason: string | null;
}

/** Resolve the resources that runtime commands should actually consume. */
export function resolveIntegrationRuntime(
  name: IntegrationName,
  config = loadIntegrationConfig(name),
): ResolvedIntegration {
  if (config.mode === 'lightweight') {
    return { name, mode: config.mode, source: 'builtin', root: null, fallbackReason: null };
  }

  const health = inspectIntegrationHealth(name, config);
  if (health.usable) {
    return {
      name,
      mode: config.mode,
      source: 'official',
      root: assertIntegrationTargetPath(name, config.officialPath),
      fallbackReason: null,
    };
  }
  if (config.mode === 'hybrid') {
    return {
      name,
      mode: config.mode,
      source: 'builtin',
      root: null,
      fallbackReason: health.reason,
    };
  }
  throw new Error(
    `${name} official mode is unavailable: ${health.reason}. Install or repair the repo-local integration first.`,
  );
}

export function resolveIntegrationResource(
  name: IntegrationName,
  candidates: string[],
): string | null {
  const runtime = resolveIntegrationRuntime(name);
  if (runtime.source === 'builtin' || !runtime.root) return null;
  for (const candidate of candidates) {
    const target = path.resolve(runtime.root, candidate);
    if (!target.startsWith(`${path.resolve(runtime.root)}${path.sep}`)) continue;
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  }
  if (runtime.mode === 'official') {
    throw new Error(`${name} official resources do not provide: ${candidates.join(' or ')}`);
  }
  return null;
}

export function integrationSummary() {
  return integrationNames
    .map((name) => {
      const config = loadIntegrationConfig(name);
      const installed = config.officialInstalled ? 'installed' : 'not installed';
      const health = inspectIntegrationHealth(name, config);
      let runtime: string;
      try {
        runtime = resolveIntegrationRuntime(name, config).source;
      } catch {
        runtime = 'unavailable';
      }
      return `- ${name}: ${config.mode} (${installed}, health=${health.health}, runtime=${runtime}, repo-local only: ${config.officialPath})`;
    })
    .join('\n');
}

export function assertIntegrationTargetPath(name: IntegrationName, relativePath: string) {
  const expectedPrefix = path.resolve(resolvePath('.'), 'harness', 'integrations', name);
  const fullPath = path.resolve(resolvePath('.'), relativePath);
  if (fullPath !== expectedPrefix && !fullPath.startsWith(`${expectedPrefix}${path.sep}`)) {
    throw new Error(
      `Refusing integration path outside harness/integrations/${name}: ${relativePath}`,
    );
  }
  const existingParent = findExistingParent(fullPath);
  const realParent = fs.realpathSync(existingParent);
  const expectedRoot = fs.realpathSync(path.resolve(resolvePath('.')));
  if (realParent !== expectedRoot && !realParent.startsWith(`${expectedRoot}${path.sep}`)) {
    throw new Error(
      `Refusing integration path through symlink outside repository: ${relativePath}`,
    );
  }
  return fullPath;
}

function findExistingParent(targetPath: string): string {
  let current = targetPath;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

export function parseIntegrationSource(source?: string) {
  if (!source) return null;
  if (!source.startsWith('local:')) {
    throw new Error(
      'Only local:<path> sources are supported in v0.8. Network and global installs are intentionally unsupported.',
    );
  }
  const sourcePath = source.slice('local:'.length).trim();
  if (!sourcePath) throw new Error('local:<path> source is required.');
  const fullPath = path.resolve(sourcePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Local source does not exist: ${sourcePath}`);
  if (!fs.statSync(fullPath).isDirectory())
    throw new Error(`Local source must be a directory: ${sourcePath}`);
  return fullPath;
}

export function defaultIntegrationDownloadBase() {
  return path.resolve(resolvePath('.'), '..', '_ai-official-sources');
}

export function resolveDownloadTarget(name: IntegrationName, to?: string) {
  const base = to ? path.resolve(to) : defaultIntegrationDownloadBase();
  return path.join(base, name);
}

export function assertDownloadOutsideRepo(target: string, allowInsideRepo?: boolean) {
  const rootPath = path.resolve(resolvePath('.'));
  if (!allowInsideRepo && (target === rootPath || target.startsWith(`${rootPath}${path.sep}`))) {
    throw new Error(
      'Refusing to download official sources inside the repository. Use --allow-inside-repo only if you know what you are doing.',
    );
  }
}

export function clearDirectoryContents(directory: string) {
  fs.mkdirSync(directory, { recursive: true });
  for (const item of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, item), { recursive: true, force: true });
  }
}

export function copyDirectoryRecursive(source: string, target: string) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

export function detectOfficialValidateCommand(name: IntegrationName, officialPath: string) {
  const packageJsonPath = path.join(officialPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson?.scripts?.validate) {
    return {
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'npm run validate'] : ['-lc', 'npm run validate'],
      display: 'npm run validate',
    };
  }
  if (name === 'openspec' && packageJson?.bin) {
    const firstBin =
      typeof packageJson.bin === 'string' ? packageJson.bin : Object.values(packageJson.bin)[0];
    if (typeof firstBin === 'string') {
      return {
        command: process.execPath,
        args: [firstBin, 'validate'],
        display: `node ${firstBin} validate`,
      };
    }
  }
  return null;
}
