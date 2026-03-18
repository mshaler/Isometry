# Structure

## Top-Level Layout

```
Isometry/
├── src/                    # TypeScript source (140 files)
├── tests/                  # Vitest tests (152 files)
├── e2e/                    # Playwright E2E tests
├── native/Isometry/        # Swift/Xcode native shell
├── public/                 # Static assets
├── assets/                 # Additional assets
├── scripts/                # Build/utility scripts
├── docs/                   # Documentation
├── v5/                     # Architecture specs (Modules/)
├── .planning/              # GSD planning artifacts
├── .benchmarks/            # Performance baselines
├── .github/workflows/      # CI (typecheck, lint, test)
├── dist/                   # Vite production build
├── dist-native/            # Native app build (vite.config.native.ts)
├── dist-analyze/           # Bundle analysis build
├── index.html              # Dev server entry
├── package.json            # npm dependencies
├── tsconfig.json           # TypeScript strict config
├── vite.config.ts          # Vitest + Vite config
├── vite.config.native.ts   # Native build config
├── vite.config.analyze.ts  # Bundle analyzer config
├── playwright.config.ts    # E2E test config
├── Makefile                # Build automation (make check, make ci)
└── biome.json              # Biome linter/formatter config
```

## Source Directory (`src/`)

```
src/
├── main.ts                 # App entry point (web + native)
├── index.ts                # Library export
├── vite-env.d.ts           # Vite type declarations
├── accessibility/          # Announcer, contrast, motion, combobox
├── audit/                  # AuditState, AuditOverlay, AuditLegend
├── assets/                 # Embedded assets
├── database/               # Database.ts + queries/ (cards, connections, graph, search)
├── etl/                    # ETL pipeline
│   ├── parsers/            # CSV, JSON, Excel, HTML, Markdown, AppleNotes
│   ├── exporters/          # CSV, JSON, Markdown exporters
│   ├── ImportOrchestrator.ts
│   ├── ExportOrchestrator.ts
│   ├── DedupEngine.ts
│   ├── SQLiteWriter.ts
│   └── CatalogWriter.ts
├── mutations/              # MutationManager, inverses, shortcuts, types
├── native/                 # NativeBridge.ts (JS side of native bridge)
├── palette/                # CommandPalette, CommandRegistry, fuzzy scorer
├── profiling/              # PerfTrace, PerfBudget (tree-shaken in prod)
├── providers/              # All state providers (14 files)
│   ├── FilterProvider.ts
│   ├── PAFVProvider.ts
│   ├── DensityProvider.ts / SuperDensityProvider.ts
│   ├── SelectionProvider.ts
│   ├── SchemaProvider.ts
│   ├── StateCoordinator.ts
│   ├── StateManager.ts
│   ├── AliasProvider.ts
│   ├── ThemeProvider.ts
│   ├── SuperPositionProvider.ts
│   ├── QueryBuilder.ts
│   └── allowlist.ts / latch.ts / types.ts
├── sample/                 # SampleDataManager + dataset SQL files
├── shortcuts/              # ShortcutRegistry, HelpOverlay
├── styles/                 # CSS (design tokens, supergrid, views)
├── ui/                     # UI components (20 files)
│   ├── WorkbenchShell.ts   # Main layout container
│   ├── charts/             # D3 chart renderers (bar, line, pie, scatter)
│   ├── *Explorer.ts        # Workbench explorer panels (6 types)
│   ├── ViewTabBar.ts       # View switching tabs
│   ├── CommandBar.ts       # Top command bar
│   ├── ErrorBanner.ts      # Error categorization + display
│   ├── ActionToast.ts      # Undo/redo feedback
│   └── AppDialog.ts        # <dialog> wrapper
├── views/                  # 9 view implementations
│   ├── ViewManager.ts      # View lifecycle orchestrator
│   ├── supergrid/          # SuperGrid subsystem (10 files)
│   └── transitions.ts      # View transition animations
└── worker/                 # Web Worker
    ├── worker.ts           # Worker entry point
    ├── WorkerBridge.ts     # Main-thread bridge
    ├── protocol.ts         # Message type definitions
    ├── schema-classifier.ts # LATCH heuristic classifier
    └── handlers/           # Per-message-type SQL handlers (14 files)
```

## Test Directory (`tests/`)

```
tests/
├── setup/                  # wasm-init.ts global setup
├── harness/                # Shared factories (realDb, makeProviders, seedCards)
├── database/               # Database + query tests
├── providers/              # Provider unit tests (17 files)
├── views/                  # View rendering tests
├── ui/                     # UI component tests
├── etl/                    # ETL parser + exporter tests
├── etl-validation/         # Cross-source validation matrix (100+ fixtures)
├── mutations/              # Mutation system tests
├── worker/                 # Worker handler tests
├── integration/            # Cross-component integration tests
├── seams/                  # Seam tests (cross-component integration gaps)
│   ├── filter/             # Filter ↔ SQL seams
│   ├── coordinator/        # Coordinator ↔ Density seams
│   ├── ui/                 # UI component seams
│   └── etl/                # ETL ↔ FTS seams
├── profiling/              # Performance benchmarks + budget tests
├── accessibility/          # A11y tests
├── audit/                  # Audit overlay tests
├── palette/                # Command palette tests
├── shortcuts/              # Keyboard shortcut tests
├── sample/                 # Sample data tests
└── styles/                 # CSS design token tests
```

## Native Shell (`native/Isometry/`)

```
native/Isometry/
├── Isometry.xcodeproj
├── Isometry/
│   ├── IsometryApp.swift           # @main entry
│   ├── ContentView.swift           # WKWebView host
│   ├── BridgeManager.swift         # JS ↔ Swift bridge
│   ├── WebViewContainer.swift      # WKWebView config
│   ├── DatabaseManager.swift       # App Support storage
│   ├── NativeImportCoordinator.swift
│   ├── NativeImportAdapter.swift
│   ├── NotesAdapter.swift          # Apple Notes CRDT parser
│   ├── RemindersAdapter.swift
│   ├── CalendarAdapter.swift
│   ├── SyncManager.swift           # CKSyncEngine CloudKit
│   ├── SyncTypes.swift
│   ├── SubscriptionManager.swift   # StoreKit 2
│   ├── FeatureGate.swift           # Tier gating
│   ├── PermissionManager.swift
│   ├── SettingsView.swift
│   ├── PaywallView.swift
│   └── ...
├── IsometryTests/                  # XCTest unit tests
└── IsometryUITests/                # XCUITests
```

## Key Naming Conventions

| Pattern | Example | Meaning |
|---------|---------|---------|
| `*Provider.ts` | `FilterProvider.ts` | State slice with subscribe/notify |
| `*Explorer.ts` | `PropertiesExplorer.ts` | Workbench panel component |
| `*View.ts` | `ListView.ts` | IView implementation (9 views) |
| `*.handler.ts` | `cards.handler.ts` | Worker message handler |
| `*Parser.ts` | `CSVParser.ts` | ETL input parser |
| `*Exporter.ts` | `JSONExporter.ts` | ETL output writer |
| `*.test.ts` | `FilterProvider.test.ts` | Vitest unit test |
| `*.bench.ts` | `performance.bench.ts` | Vitest benchmark |
| `*.perf.test.ts` | `SuperGrid.perf.test.ts` | Performance assertion test |
| `seams/*.test.ts` | `filter-sql.test.ts` | Cross-component seam test |
