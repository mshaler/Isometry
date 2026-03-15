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
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets'
        }
      ]
    })
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // sql.js is CJS — Vite's esbuild pre-bundling converts it to ESM.
    // Do NOT exclude it: workers need the pre-bundled ESM version.
    // The WASM loading uses locateFile callback which esbuild preserves.
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // Never inline WASM (breaks WKWebView + streaming compile)
    lib: {
      // src/index.ts is the library entry point — bundles Database + wasm-compat
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Isometry',
      formats: ['es'],
      fileName: 'isometry',
    },
    rollupOptions: {
      // sql.js is an external dependency — not bundled into the library output
      external: ['sql.js'],
    },
  },
});
