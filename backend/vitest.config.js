import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/tests/**/*.test.js'],
    testTimeout: 10000,
    globals: true,
    verbose: true
  }
});