import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/routes/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/scripts/**'],
    },
  },
});
