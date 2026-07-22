import fs from 'fs';
import { resolvePath } from '../utils/file';
import { listChanges } from './change';
import { logger } from './logger';

export interface Dependency {
  name: string;
  type: 'requires' | 'blocks' | 'related';
  status?: string;
}

export interface ChangeDependencies {
  change: string;
  requires: string[];
  blocks: string[];
  related: string[];
}

const DEPENDENCY_FILE = 'dependencies.json';

export function loadDependencies(change: string): ChangeDependencies {
  const filePath = resolvePath('openspec', 'changes', change, DEPENDENCY_FILE);
  if (!fs.existsSync(filePath)) {
    return {
      change,
      requires: [],
      blocks: [],
      related: [],
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { ...JSON.parse(content), change };
  } catch {
    return {
      change,
      requires: [],
      blocks: [],
      related: [],
    };
  }
}

export function saveDependencies(change: string, deps: ChangeDependencies): void {
  const filePath = resolvePath('openspec', 'changes', change, DEPENDENCY_FILE);
  fs.writeFileSync(filePath, JSON.stringify(deps, null, 2));
}

export function addDependency(
  change: string,
  dependency: string,
  type: 'requires' | 'blocks' | 'related',
): void {
  const deps = loadDependencies(change);
  if (!deps[type].includes(dependency)) {
    deps[type].push(dependency);
    saveDependencies(change, deps);
    logger.info(`Added ${type} dependency: ${change} -> ${dependency}`);
  }
}

export function removeDependency(
  change: string,
  dependency: string,
  type: 'requires' | 'blocks' | 'related',
): void {
  const deps = loadDependencies(change);
  deps[type] = deps[type].filter((d) => d !== dependency);
  saveDependencies(change, deps);
  logger.info(`Removed ${type} dependency: ${change} -> ${dependency}`);
}

export function checkDependencies(change: string): {
  valid: boolean;
  missing: string[];
  blocked: string[];
} {
  const deps = loadDependencies(change);
  const allChanges = listChanges();
  const validChanges = new Set(allChanges.map((c) => c.name));

  const missing: string[] = [];
  const blocked: string[] = [];

  for (const req of deps.requires) {
    if (!validChanges.has(req)) {
      missing.push(req);
    }
  }

  for (const block of deps.blocks) {
    if (!validChanges.has(block)) {
      blocked.push(block);
    }
  }

  return {
    valid: missing.length === 0 && blocked.length === 0,
    missing,
    blocked,
  };
}

export function getDependencyGraph(change?: string): Record<string, Dependency[]> {
  const graph: Record<string, Dependency[]> = {};
  const allChanges = listChanges();

  for (const c of allChanges) {
    const deps = loadDependencies(c.name);
    const dependencies: Dependency[] = [];

    deps.requires.forEach((d) => dependencies.push({ name: d, type: 'requires' }));
    deps.blocks.forEach((d) => dependencies.push({ name: d, type: 'blocks' }));
    deps.related.forEach((d) => dependencies.push({ name: d, type: 'related' }));

    graph[c.name] = dependencies;
  }

  if (change) {
    const filtered: Record<string, Dependency[]> = {};
    const visited = new Set<string>();
    const queue = [change];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (graph[current]) {
        filtered[current] = graph[current];
        for (const dep of graph[current]) {
          if (!visited.has(dep.name)) {
            queue.push(dep.name);
          }
        }
      }
    }

    return filtered;
  }

  return graph;
}

export function formatDependencyGraph(graph: Record<string, Dependency[]>): string {
  const lines: string[] = [];
  for (const [change, deps] of Object.entries(graph)) {
    lines.push(`[${change}]`);
    if (deps.length === 0) {
      lines.push('  (no dependencies)');
    } else {
      for (const dep of deps) {
        const typeSymbol = {
          requires: '->',
          blocks: '!>',
          related: '--',
        }[dep.type];
        lines.push(`  ${typeSymbol} ${dep.name}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}
