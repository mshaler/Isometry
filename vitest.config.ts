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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',                           // Playwright E2E tests — run separately
      'tests/profiling/budget.test.ts',    // Phase 75 intentional red tests (perf budgets)
      'tests/profiling/budget-render.test.ts', // Phase 76 render budget (environment-dependent)
      'tests/database/performance-assertions.test.ts', // Phase 74 perf assertions (environment-dependent)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});
