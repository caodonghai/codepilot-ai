import type { BuildTool } from '../types';

export function getBuildCommand(tool: BuildTool): string[] {
  switch (tool) {
    case 'vite':
      return ['vite', 'build'];
    case 'webpack':
      return ['webpack', '--mode', 'production'];
    case 'rollup':
      return ['rollup', '-c'];
    case 'esbuild':
      return ['esbuild', '--bundle', '--minify'];
    case 'parcel':
      return ['parcel', 'build'];
    default:
      return ['npm', 'run', 'build'];
  }
}

export function getDevCommand(tool: BuildTool): string[] {
  switch (tool) {
    case 'vite':
      return ['vite'];
    case 'webpack':
      return ['webpack-dev-server'];
    case 'rollup':
      return ['rollup', '-c', '-w'];
    case 'esbuild':
      return ['esbuild', '--watch'];
    case 'parcel':
      return ['parcel', 'serve'];
    default:
      return ['npm', 'run', 'dev'];
  }
}

export function getTestCommand(tool: BuildTool): string[] {
  switch (tool) {
    case 'vite':
      return ['vitest', 'run'];
    case 'webpack':
      return ['jest'];
    case 'rollup':
      return ['vitest', 'run'];
    case 'esbuild':
      return ['vitest', 'run'];
    case 'parcel':
      return ['jest'];
    default:
      return ['npm', 'run', 'test'];
  }
}

export function getLintCommand(): string[] {
  return ['npm', 'run', 'lint'];
}
