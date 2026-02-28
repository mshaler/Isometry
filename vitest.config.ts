import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',   // NOT jsdom -- WASM runs in Node directly
    pool: 'forks',         // Full process isolation -- prevents WASM state leakage
    isolate: true,         // Each test file gets its own process
    globalSetup: './tests/setup/wasm-init.ts',
    globals: true,
    testTimeout: 10000,    // WASM init can take 1-2 seconds on cold start
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});
