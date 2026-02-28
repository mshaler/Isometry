import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
    exclude: ['sql.js'], // CRITICAL: prevents esbuild from stripping WASM loading code
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // Never inline WASM (breaks WKWebView + streaming compile)
  },
});
