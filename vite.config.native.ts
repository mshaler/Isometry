import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
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
