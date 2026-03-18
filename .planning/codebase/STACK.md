# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- TypeScript 5.9.3 - All web runtime code (`src/`, ~36.9K LOC)
- Swift - iOS/macOS native shell (`native/Isometry/`, ~7.4K LOC)

**Build & Configuration:**
- JavaScript - Node.js scripts, configuration files

## Runtime

**Environment:**
- Node.js 22 (per `.github/workflows/ci.yml`)
- Browser: ES2022 (Chrome 85+, Safari 15+, Firefox 78+)
- iOS/macOS: WKWebView with Webkit message handlers

**Package Manager:**
- npm (v10+)
- Lockfile: `package-lock.json` present

## Frameworks

**Core Web:**
- Vite 7.3.1 - Build system and dev server
- TypeScript 5.9.3 - Static type checking

**Data & Visualization:**
- D3.js 7.9.0 - Data visualization and DOM manipulation (core to GRAPH layer)
- sql.js 1.14.0 - SQLite in WASM (system of record)

**File Processing & Parsing:**
- PapaParse 5.5.3 - CSV parsing and generation
- gray-matter 4.0.3 - Front-matter extraction from Markdown/text files
- marked 17.0.4 - Markdown rendering
- xlsx 0.18.5 - Excel file parsing (.xlsx, .xls)

**Security & Sanitization:**
- DOMPurify 3.3.2 - XSS protection for user-generated HTML (notebook charts)

**Testing:**
- Vitest 4.0.18 - Unit/integration test runner
- JSDOM 28.1.0 - DOM environment for seam tests
- Playwright 1.58.2 - E2E visual testing
- @vitest/coverage-v8 4.0.18 - Code coverage reporting
- @vitest/web-worker 4.0.18 - Web Worker testing

**Build & Dev Tools:**
- Vite plugins:
  - vite-plugin-static-copy 3.2.0 - Copy sql-wasm-fts5.wasm to assets
  - rollup-plugin-visualizer 7.0.1 - Bundle size analysis

**Code Quality:**
- Biomejs 2.4.6 - Formatter and linter (125 line width, tab indent, trailing commas)

## Key Dependencies

**Critical:**
- sql.js 1.14.0 - Provides SQLite database engine in WASM format
  - Non-minified build forced via Vite alias (property names like `columns` required)
  - sql-wasm-fts5.wasm with FTS5 extension bundled
  - Compiled with streaming WASM support (assetsInlineLimit: 0)

- D3.js 7.9.0 - Foundation for all visualization and data binding
  - d3-force (force simulation in Worker)
  - d3-selection (DOM manipulation)
  - Required for grid rendering, chart types, histogram scrubbers, category chips

**Infrastructure:**
- @types packages for D3, sql.js, JSDOM, PapaParse, DOMPurify
- buffer 6.0.3 - Node.js Buffer polyfill for browser
- rollup-plugin-visualizer - Bundle analysis (npm run analyze)

## Configuration

**Build Configuration:**
- `tsconfig.json` - Strict mode (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature)
- `vite.config.ts` - Primary browser build + WASM copy plugin
- `vite.config.native.ts` - Native app build (dist-native/, relative asset paths for WKWebView)
- `vite.config.analyze.ts` - Bundle visualization
- `vitest.config.ts` - Test runner with Node environment, forks pool isolation, 10s timeout
- `biome.json` - Linter/formatter rules (tabs, 120 char width, single quotes, semicolons)
- `playwright.config.ts` - E2E visual testing (1 worker, sequential, dark colorScheme)

**Environment:**
- __PERF_INSTRUMENTATION__ compile-time gate (true in dev, false in production)
- SQL_WASM_PATH environment variable set by vitest globalSetup for test WASM loading
- NODE_ENV used to gate Vite define variables

**Data Directories:**
- `src/assets/` - sql-wasm-fts5.wasm (FTS5 SQLite binary)
- `src/assets/` - sql-wasm-fts5.js (pre-generated loader stub, not used directly)
- `.benchmarks/` - Performance baseline snapshots (main.json for regression comparison)

## Platform Requirements

**Development:**
- Node.js 22.x
- npm 10.x
- macOS for native iOS development (Xcode 15+)
- Swift 5.9+

**Browser:**
- Chrome 85+ / Chromium-based
- Safari 15+ (supports content-visibility: auto)
- Firefox 78+

**Production (Native):**
- iOS 16+ (CloudKit, StoreKit 2, CKSyncEngine)
- macOS 13+ (CloudKit, StoreKit 2, CKSyncEngine)

**WKWebView-Specific:**
- Requires __WKWebViewHandler detection for WASM MIME type patching
- Relative asset paths (base: './' in vite.config.native.ts)
- app:// URL scheme instead of file://
- Message handler bridge via window.webkit.messageHandlers.nativeBridge

## Build Targets

**Browser:**
- `npm run dev` - Vite dev server (http://localhost:5173)
- `npm run build` - TypeScript + Vite bundle (dist/, library mode with ESM)
- `npm run preview` - Local preview of production build

**Native:**
- `npm run build:native` - Vite build for WKWebView embedding (dist-native/)

**Analysis:**
- `npm run analyze` - Bundle visualization via rollup-plugin-visualizer

## Scripts

```bash
npm run dev              # Vite dev server
npm run build            # TypeScript check + Vite build
npm run build:native     # Build for native app embedding
npm run typecheck        # tsc --noEmit (strict mode)
npm run test             # Vitest (all tests except profiling)
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest with v8 coverage
npm run test:harness     # Seam test harness only
npm run test:seams       # Integration seams only
npm run lint             # Biomejs check
npm run fix              # Biomejs check --write (auto-format)
npm run e2e              # Playwright tests (headless)
npm run e2e:headed       # Playwright with visible browser
npm run e2e:debug        # Playwright debugger
npm run e2e:report       # Open HTML test report
npm run analyze          # Bundle size visualization
npm run bench:budgets    # Performance budget assertions
```

## CI/CD Pipeline

**GitHub Actions (ci.yml):**

1. **typecheck** - Runs tsc --noEmit on Node 22 (30s, parallel)
2. **lint** - Runs biome ci . (validates formatting/rules, 15s, parallel)
3. **test** - Runs vitest --run on Node 22 (60s, parallel)
4. **bench** - Runs performance budgets on Node 22 (soft gate, continue-on-error, 5min timeout)

All jobs use npm ci (lockfile) for reproducibility.

---

*Stack analysis: 2026-03-17*
