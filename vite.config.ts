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
    // Optimized for native-only deployment
  },
  assetsInclude: ['**/*.sql'],
  build: {
    target: 'esnext',
    rollupOptions: {
      // Ensure tree-shaking of unused sql.js references
      external: ['sql.js'],
    },
  },
});
