import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Enable instrumentation in test and dev builds; compiles to false in production.
    __PERF_INSTRUMENTATION__: process.env.NODE_ENV !== 'production',
  },
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
