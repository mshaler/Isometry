import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // CRITICAL: sql.js exports a minified browser build (sql-wasm-browser.js) that
      // renames properties (e.g. `columns` → `lc` in exec() results). Force the
      // non-minified build so our code can access result.columns reliably.
      'sql.js': resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'),
    },
  },
  define: {
    // Phase 74: PerfTrace compile-time gate. True in dev; false (no-op) in production.
    __PERF_INSTRUMENTATION__: process.env.NODE_ENV !== 'production',
  },
  // No build.lib — app mode uses index.html as entry point
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets',
        },
      ],
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist-native',
    target: 'es2022',
    assetsInlineLimit: 0, // Never inline WASM (breaks WKWebView + streaming compile)
    // No build.lib — entry point is index.html at project root
    // No rollupOptions.external — sql.js must be bundled (no CDN or require() in WKWebView)
  },
  base: './', // Relative asset paths so app://localhost/ mapping works in WKWebView
});
