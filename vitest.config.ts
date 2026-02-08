import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/sqljs-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 15000, // 15 seconds for sql.js WASM loading
    hookTimeout: 10000,  // 10 seconds for setup/teardown with database init
    pool: 'forks', // Use forks for better isolation with sql.js
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
      ],
    },
    onConsoleLog: (log: string, type: 'stdout' | 'stderr') => {
      // Filter out expected test console output to reduce noise
      if (log.includes('[Test] WebKit message:') ||
          log.includes('[WebView Bridge] Processing') ||
          log.includes('Migration failed, using plain storage:') ||
          log.includes('[sql.js]') ||
          log.includes('WASM loading') ||
          log.includes('FTS5 initialized') ||
          log.includes('sqlite3 memory')) {
        return false; // Don't show these in console
      }
      return true;
    },
    // Environment variables for sql.js testing
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
      // sql.js WASM file location for tests
      SQLJS_WASM_PATH: '/public/wasm/',
    },
    // Ensure proper WASM loading in test environment
    server: {
      fs: {
        allow: ['..', './public', './node_modules'],
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Optimize for sql.js and WASM in test environment
  optimizeDeps: {
    exclude: ['sql.js', 'sql.js-fts5'],
    include: ['@testing-library/jest-dom', '@testing-library/react'],
  },
});
