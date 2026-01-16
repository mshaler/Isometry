import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // sql.js needs special handling for WASM
    exclude: ['sql.js'],
  },
  assetsInclude: ['**/*.sql', '**/*.wasm'],
  build: {
    target: 'esnext',
  },
});
