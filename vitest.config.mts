import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 22,
        functions: 45,
        statements: 22,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(projectDirectory, './src'),
    },
  },
});
