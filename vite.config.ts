import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/Isometry/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Optimize commonly used dependencies for faster dev server startup
    include: [
      'react',
      'react-dom',
      'd3',
      'uuid',
      'clsx',
      'lucide-react',
      '@radix-ui/react-select',
      '@radix-ui/react-slider'
    ],
    // Enable aggressive dependency pre-bundling
    force: false,
  },
  assetsInclude: ['**/*.sql'],
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: process.env.NODE_ENV === 'development',
    cssCodeSplit: true,
    rollupOptions: {
      // Optimize tree-shaking
      treeshake: {
        moduleSideEffects: false,
      },
      output: {
        // Optimize chunk splitting for better caching and loading
        manualChunks: {
          vendor: ['react', 'react-dom'],
          d3: ['d3'],
          ui: [
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-toggle'
          ],
          icons: ['lucide-react'],
          utils: ['uuid', 'clsx', 'tailwind-merge'],
          editor: ['@uiw/react-md-editor', 'mammoth'],
          terminal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          office: ['xlsx', 'html2pdf.js', 'jszip'],
          dnd: ['react-dnd', 'react-dnd-html5-backend']
        },
        // Optimize asset naming for caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Performance optimizations
    chunkSizeWarningLimit: 800, // 800KB limit (reduced from 1MB)
    cssMinify: true,
    // Report bundle size for monitoring
    reportCompressedSize: true,
    // Enable build analysis
    emptyOutDir: true,
  },
  // Development server optimization
  server: {
    fs: {
      strict: true,
      // Deny access to Swift build files to prevent performance issues
      deny: [
        '**/native/build/**',
        '**/native/.build/**',
        '**/SourcePackages/**',
        '**/.swiftpm/**'
      ],
    },
    hmr: {
      overlay: true,
    },
  },
  // Preview server configuration for production testing
  preview: {
    port: 4173,
    host: true,
  },
  // Enable bundle analysis in development
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
  },
});
