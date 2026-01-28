---
version: 1.0
last_updated: 2026-01-28
---

# Technology Stack

**Analysis Date:** 2026-01-28

## Languages

**Primary:**
- TypeScript/TSX - Web client in `src/`
- Swift - Native core, API server, and app targets in `native/`, `ios/`, `macos/`

**Secondary:**
- JavaScript - Tooling and Node scripts (e.g., `vite.config.ts`, `eslint.config.js`, `src/server/launch-native-server.js`)
- SQL - Schema and migration assets (`src/db/schema.sql`, `native/Sources/Isometry/Resources/schema.sql`)

## Runtime

**Environment:**
- Node.js (Vite dev server/build, tooling)
- Swift 5.9 toolchain (SwiftPM, iOS/macOS targets)

**Package Manager:**
- npm - `package-lock.json` present
- Swift Package Manager - `native/Package.swift`, `ios/Package.swift`

## Frameworks

**Core:**
- React 18 - Web UI (`src/`)
- SwiftUI / Swift - Native UI and core (`native/`, `ios/`, `macos/`)

**Testing:**
- Vitest - Web tests (`vitest.config.ts`)
- SwiftPM XCTest - Native tests (`native/Tests/`)

**Build/Dev:**
- Vite 7 - Web build/dev (`vite.config.ts`)
- TypeScript 5.x - Compilation (`tsconfig.json`)
- Tailwind CSS 3.x - Styling (`tailwind.config.js`, `postcss.config.js`)
- ESLint 9 - Linting (`eslint.config.js`)

## Key Dependencies

**Critical:**
- react, react-dom - UI runtime
- react-router-dom - Client routing
- d3 - Data visualization
- leaflet - Map rendering
- @anthropic-ai/sdk - Claude API client (web)
- @xterm/xterm + addons - Terminal emulator UI

**Infrastructure:**
- Vapor 4.x (Swift) - HTTP API server (`native/Sources/IsometryAPI`)
- GRDB 6.x (Swift) - SQLite access (`native/Sources/Isometry`)
- ZipArchive 2.x (Swift) - Archive support

## Configuration

**Environment:**
- `.env.production` and runtime env vars (see `src/config/environment.ts`, `src/config/security.ts`)
- Claude integration via `VITE_ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY`, `VITE_API_PROXY_ENDPOINT`, `CLAUDE_API_ENDPOINT`

**Build:**
- `vite.config.ts`, `tsconfig.json`, `tsconfig.build.json`, `tsconfig.node.json`
- `tailwind.config.js`, `postcss.config.js`
- `eslint.config.js`

## Platform Requirements

**Development:**
- Node.js + npm
- Swift 5.9 toolchain (SwiftPM)
- Xcode for iOS/macOS targets

**Production:**
- Web: static build output (`dist/`) via Vite
- Native: iOS 17+/macOS 14+ via Xcode/SwiftPM
- Deployment configs present for Netlify (`netlify.toml`) and Vercel (`vercel.json`)

---

*Stack analysis: 2026-01-28*
*Update after major dependency changes*
