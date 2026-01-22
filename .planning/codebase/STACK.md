# Technology Stack

**Analysis Date:** 2026-01-21

## Languages & Runtimes

### React Prototype
- **TypeScript** 5.2.2 - Primary language
- **Node.js/npm** - Runtime & package manager
- **ES2020 Target** - Compilation target with DOM APIs
- **ESNext Module System** - ESM imports/exports

### Native iOS/macOS
- **Swift** 5.9+ - Primary language
- **iOS Minimum** 17.0 - Deployment target
- **macOS Minimum** 14.0 - Deployment target
- **Swift Concurrency** - Async/await with Sendable actors

## Build Tools

### React Prototype

| Tool | Version | File | Purpose |
|------|---------|------|---------|
| Vite | 5.0.0 | `vite.config.ts` | Dev server & bundler |
| TypeScript | 5.2.2 | `tsconfig.json` | Type checking |
| ESLint | 9.39.2 | `eslint.config.js` | Linting (v9 flat config) |
| TypeScript ESLint | 8.53.0 | `eslint.config.js` | TS-specific rules |

### Native Apps

| Tool | Version | File | Purpose |
|------|---------|------|---------|
| Swift Package Manager | 5.9 | `native/Package.swift` | Dependency management |
| Xcode | Latest | `.swiftpm/xcode/` | IDE & build system |

## Frontend Frameworks

### React Prototype

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.2.0 | UI rendering |
| ReactDOM | 18.2.0 | Browser rendering |
| React Router DOM | 6.20.0 | Client-side routing |
| D3.js | 7.8.5 | Data visualization |
| react-dnd | 16.0.1 | Drag-and-drop (PAFV) |
| lucide-react | 0.294.0 | Icon library |

### Native Apps

| Framework | Purpose |
|-----------|---------|
| SwiftUI | UI framework (iOS 17+, macOS 14+) |
| Foundation | Core APIs |

## Styling

| Tool | Version | File |
|------|---------|------|
| Tailwind CSS | 3.3.5 | `tailwind.config.js` |
| PostCSS | 8.4.31 | `postcss.config.js` |
| Autoprefixer | 10.4.16 | CSS vendor prefixing |

**Theme System:**
- NeXTSTEP theme (retro)
- Modern theme (glass)
- CSS variables in `index.css`

## Database

### React Prototype (Development)

| Package | Version | Purpose |
|---------|---------|---------|
| sql.js | 1.9.0 | In-browser SQLite (WASM) |

**Configuration:**
```typescript
// vite.config.ts
optimizeDeps: { exclude: ['sql.js'] }
assetsInclude: ['**/*.sql', '**/*.wasm']
```

### Native Apps (Production)

| Package | Version | Purpose |
|---------|---------|---------|
| GRDB.swift | 6.24.0+ | SQLite ORM with async/await |

**Features:**
- DatabasePool for thread-safe access
- WAL (Write-Ahead Logging) mode
- FTS5 (Full-Text Search)
- Recursive CTEs for graph queries
- 64MB cache configuration

## Testing

### React Prototype

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.0.17 | Test runner |
| JSDOM | 27.4.0 | DOM simulation |
| @testing-library/react | 16.3.1 | Component testing |
| @testing-library/jest-dom | 6.9.1 | DOM matchers |
| v8 | Built-in | Coverage provider |

### Native Apps

| Framework | Purpose |
|-----------|---------|
| Swift Testing | Modern test framework (@Test, #expect) |
| XCTest | Foundation testing |

## Key Dependencies

### React Stack
```
Framework:     React 18.2.0 + TypeScript 5.2.2
Visualization: D3.js 7.8.5
Database:      sql.js 1.9.0 (development)
Routing:       React Router DOM 6.20.0
UI/Icons:      Lucide React 0.294.0 + Tailwind CSS 3.3.5
Drag-Drop:     react-dnd 16.0.1
Testing:       Vitest 4.0.17 + React Testing Library 16.3.1
Build:         Vite 5.0.0
Linting:       ESLint 9.39.2 + TypeScript ESLint 8.53.0
```

### Native Stack
```
Language:      Swift 5.9+
UI:            SwiftUI (iOS 17+, macOS 14+)
Database:      GRDB.swift 6.24.0+ → SQLite
Sync:          CloudKit (iCloud.com.cardboard.app)
Import:        AltoIndexImporter (Apple Notes format)
```

---

*Stack analysis: 2026-01-21*
*Update when dependencies change*
