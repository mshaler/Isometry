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
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      // Ensure tree-shaking of unused sql.js references
      external: ['sql.js'],
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          d3: ['d3'],
          radix: ['@radix-ui/react-select', '@radix-ui/react-slider'],
          icons: ['lucide-react']
        }
      }
    },
    // Performance optimizations
    chunkSizeWarningLimit: 1000, // 1MB limit
    cssMinify: true,
  },
  // Preview server configuration for production testing
  preview: {
    port: 4173,
    host: true,
  }
});
