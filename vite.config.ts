import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
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
