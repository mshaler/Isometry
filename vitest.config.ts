import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000, // 10 seconds default timeout
    hookTimeout: 5000,  // 5 seconds for setup/teardown
    pool: 'threads',
    poolOptions: {
      singleThread: true, // Avoid race conditions in WebView bridge tests
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
    onConsoleLog: (log: string, type: 'stdout' | 'stderr') => {
      // Filter out expected test console output to reduce noise
      if (log.includes('[Test] WebKit message:') ||
          log.includes('[WebView Bridge] Processing') ||
          log.includes('Migration failed, using plain storage:')) {
        return false; // Don't show these in console
      }
      return true;
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
