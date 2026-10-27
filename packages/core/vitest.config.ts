import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'dist/**', 'node_modules/**', '**/*.d.ts'],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
        'src/config/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/templates/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/queue/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/logging/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        'src/orchestrator/**': {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
      },
    },
  },
});
