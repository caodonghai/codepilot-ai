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
        lines: 10,
        functions: 25,
        statements: 10,
        branches: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(projectDirectory, './src'),
    },
  },
});
