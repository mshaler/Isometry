---
version: 1.0
last_updated: 2026-01-28
---

# Codebase Structure

**Analysis Date:** 2026-01-28

## Directory Layout

```
Isometry/
├── .planning/            # GSD planning artifacts and docs
├── src/                  # React web application
├── native/               # Swift core + API server + shared native code
├── ios/                  # iOS SwiftPM/Xcode wrapper
├── macos/                # macOS app project
├── docs/                 # Documentation and design notes
├── scripts/              # Dev and automation scripts
├── public/               # Static assets
├── assets/               # Images and misc assets
├── dist/                 # Web build output
├── specs/                # Feature/spec documents
├── tests/                # Misc test assets (root-level)
├── package.json          # Web package manifest
├── vite.config.ts        # Vite config
└── tsconfig.json         # TypeScript config
```

## Directory Purposes

**src/**
- Purpose: Web UI, data layer, and client-side logic
- Contains: React components, hooks, contexts, db access, services
- Key files: `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Subdirectories: `components/`, `hooks/`, `db/`, `state/`, `pages/`, `services/`, `utils/`, `types/`

**native/**
- Purpose: Swift core logic + API server + app targets
- Contains: Swift Package targets, server code, resources, tests
- Key files: `native/Package.swift`, `native/Sources/IsometryAPIServer/main.swift`
- Subdirectories: `Sources/Isometry/`, `Sources/IsometryAPI/`, `Sources/IsometryAPIServer/`, `Tests/`

**ios/**
- Purpose: iOS app wrapper
- Contains: SwiftPM target and Xcode project
- Key files: `ios/Package.swift`, `ios/Isometry.xcodeproj/`

**macos/**
- Purpose: macOS app project
- Contains: Xcode project and app resources
- Key files: `macos/Isometry/`, `macos/Isometry.xcodeproj/`

**docs/**
- Purpose: Product and engineering documentation
- Contains: Implementation notes and guides

**scripts/**
- Purpose: Development and automation helpers
- Contains: Shell scripts and utilities

## Key File Locations

**Entry Points:**
- `src/main.tsx` - Web app entry
- `native/Sources/IsometryAPIServer/main.swift` - Native API server entry
- `src/server/launch-native-server.js` - Node launcher for native server

**Configuration:**
- `vite.config.ts` - Vite build/dev config
- `tsconfig.json`, `tsconfig.build.json`, `tsconfig.node.json` - TS config
- `tailwind.config.js`, `postcss.config.js` - CSS pipeline
- `eslint.config.js` - Lint rules
- `.env.production` - Production env defaults
- `netlify.toml`, `vercel.json` - Hosting configs

**Core Logic:**
- `src/db/` - Database contexts and native API client
- `src/hooks/` - App hooks and command routing
- `native/Sources/Isometry/` - Core Swift models/services
- `native/Sources/IsometryAPI/` - Vapor API layer

**Testing:**
- `src/**/__tests__/` and `src/**/*.test.tsx` - Web tests
- `native/Tests/` - Swift tests

**Documentation:**
- `docs/` - Docs and notes
- `README.md`, `DEPLOYMENT.md`, `QUICK-SETUP-GUIDE.md`

## Naming Conventions

**Files:**
- PascalCase `.tsx` for React components (e.g., `LocationMapWidget.tsx`)
- camelCase `.ts` for hooks/utilities (e.g., `useClaudeAPI.ts`)
- `*.test.ts(x)` and `__tests__/` for tests
- Swift files use PascalCase type names, file name matches type

**Directories:**
- lower-case for broad areas (`components/`, `hooks/`, `services/`)
- plural names for collections

**Special Patterns:**
- `index.ts` for exports (limited use)
- `__tests__/` used for colocated tests

## Where to Add New Code

**New Feature:**
- Primary code: `src/features/` or `src/components/`
- Tests: `src/**/__tests__/` or `src/**/*.test.tsx`
- Types: `src/types/`

**New Component/Module:**
- Implementation: `src/components/`
- Types: `src/types/`
- Tests: `src/components/__tests__/`

**New Route/Command:**
- Web routing: `src/pages/` and `src/App.tsx`
- Native API routes: `native/Sources/IsometryAPI/routes.swift`

**Utilities:**
- Shared helpers: `src/utils/`
- Hooks: `src/hooks/`

## Special Directories

**dist/**
- Purpose: Web build output
- Source: `vite build`
- Committed: No (generated)

**node_modules/**
- Purpose: npm dependencies
- Committed: No

**.planning/**
- Purpose: GSD planning artifacts
- Committed: Often yes (depends on project workflow)

---

*Structure analysis: 2026-01-28*
*Update when directory structure changes*
