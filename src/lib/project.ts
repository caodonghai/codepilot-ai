import fs from 'fs';
import path from 'path';
import type {
  ProjectFramework,
  BuildTool,
  PackageManager,
  ProjectType,
  ProjectInfo,
} from '../types';

function readPackageJson(): Record<string, unknown> {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return {};
  }
}

export function detectPackageManager(): PackageManager {
  if (fs.existsSync(path.resolve(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.resolve(process.cwd(), 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.resolve(process.cwd(), 'bun.lockb'))) return 'bun';
  return 'npm';
}

export function detectFramework(): ProjectFramework {
  const pkg = readPackageJson();
  const deps = {
    ...((pkg.dependencies as Record<string, string>) || {}),
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };

  if (deps['next']) return 'next';
  if (deps['nuxt'] || deps['nuxt3']) return 'nuxt';
  if (deps['remix'] || deps['@remix-run/react']) return 'remix';
  if (deps['solid-js']) return 'solid';
  if (deps['svelte']) return 'svelte';
  if (deps['@angular/core']) return 'angular';
  if (deps['vue'] && deps['@vue/cli-service']) return 'vue';
  if (deps['react'] || deps['react-dom']) return 'react';
  return 'other';
}

export function detectBuildTool(): BuildTool {
  const pkg = readPackageJson();
  const deps = {
    ...((pkg.dependencies as Record<string, string>) || {}),
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };

  if (deps['vite']) return 'vite';
  if (deps['webpack'] || deps['webpack-cli']) return 'webpack';
  if (deps['rollup']) return 'rollup';
  if (deps['esbuild']) return 'esbuild';
  if (deps['parcel']) return 'parcel';
  return 'other';
}

export function detectProjectType(): ProjectType {
  if (
    fs.existsSync(path.resolve(process.cwd(), 'packages')) ||
    fs.existsSync(path.resolve(process.cwd(), 'apps'))
  ) {
    return 'monorepo';
  }
  const pkg = readPackageJson();
  if (pkg.type === 'module' && pkg.main) {
    return 'library';
  }
  return 'spa';
}

export function detectProjectInfo(): ProjectInfo {
  const pkg = readPackageJson();
  return {
    name: (pkg.name as string) || path.basename(process.cwd()),
    framework: detectFramework(),
    buildTool: detectBuildTool(),
    packageManager: detectPackageManager(),
    projectType: detectProjectType(),
    language: fs.existsSync(path.resolve(process.cwd(), 'tsconfig.json'))
      ? 'typescript'
      : 'javascript',
    version: pkg.version as string | undefined,
  };
}
