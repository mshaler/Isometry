import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  define: {
    // Analyze config: production-like build (PerfTrace disabled)
    __PERF_INSTRUMENTATION__: false,
  },
  // No build.lib — app mode so all chunks (including sql.js) are visible in treemap
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets',
        },
      ],
    }),
    visualizer({
      filename: 'stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false, // Don't auto-open in headless/CI environments
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist-analyze',
    target: 'es2022',
    assetsInlineLimit: 0, // Never inline WASM
    // No build.lib — app entry point is index.html
    // No rollupOptions.external — all deps bundled so treemap shows real sizes
  },
  base: './',
});
