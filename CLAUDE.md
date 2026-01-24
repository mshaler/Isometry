# Isometry - Claude Code Context

## Quick Start

### React Prototype (for rapid UI iteration)

```bash
npm install
npm run dev
```

### Native iOS/macOS (production target)

```bash
cd native
open Package.swift  # Opens in Xcode
```

## Architecture
- **PAFV**: Planes → Axes → Facets → Values (spatial projection)
- **LATCH**: Location, Alphabet, Time, Category, Hierarchy (filtering)
- **GRAPH**: Links, Nesting, Sequence (connections)

## Tech Stack

### React Prototype

- React 18 + TypeScript
- D3.js for visualization
- sql.js (SQLite in browser) - dev only
- Tailwind CSS
- Vite

### Native Apps (iOS/macOS)

- Swift 5.9+ / SwiftUI
- GRDB.swift (SQLite wrapper)
- Native SQLite with FTS5, recursive CTEs
- CloudKit for sync

## Key Files

### React Prototype Files

- `src/types/` - All TypeScript interfaces
- `src/db/` - SQLite schema, init, context
- `src/hooks/` - useSQLiteQuery, useD3, etc.
- `src/state/` - FilterContext, PAFVContext, SelectionContext
- `src/views/` - GridView, ListView, ViewRenderer interface
- `src/filters/` - Filter compiler (LATCH → SQL)
- `docs/` - Architecture docs, gap analysis

### Native iOS/macOS Files

- `native/Sources/Isometry/Database/` - IsometryDatabase actor, migrations
- `native/Sources/Isometry/Models/` - Node, Edge, SyncState (Codable, Sendable)
- `native/Sources/Isometry/Sync/` - CloudKitSyncManager actor
- `native/Sources/Isometry/Import/` - AltoIndexImporter actor (Apple Notes import)
- `native/Sources/Isometry/Views/` - SwiftUI views
- `native/Sources/Isometry/App/` - IsometryApp, ContentView, AppState
- `native/Sources/Isometry/Resources/schema.sql` - Full schema with FTS5

## Current Phase

Phase 2: Native Implementation

- [x] SQLite schema (React + Native)
- [x] Type definitions (TypeScript + Swift)
- [x] Database initialization
- [x] Sample data
- [x] Provider hierarchy
- [x] Native iOS project structure
- [x] Swift Actor database layer
- [x] Graph query CTEs
- [x] CloudKit sync manager
- [x] macOS-specific UI adaptations
- [x] Alto-index Notes importer (6,891 notes imported)
- [ ] Canvas D3 rendering (React)
- [ ] View switching (React)
- [ ] Test CloudKit sync with developer account

## Important Docs

1. [[cardboard-architecture-truth]] - Core concepts
2. [[ISOMETRY-MVP-GAP-ANALYSIS]] - Full roadmap
3. [[INTEGRATION-CONTRACT]] - How pieces connect
4. [[FIGMA-HANDOFF]] - UI integration (design folder)

## Coding Patterns
- Use `useSQLiteQuery` for data fetching
- Use `useD3` for D3 container management
- Use contexts for shared state
- Views implement `ViewRenderer` interface
- Filter changes trigger query recompilation

## Theme System
Two themes: NeXTSTEP (retro) and Modern (glass)
Toggle via ThemeContext, CSS variables in index.css

## Documentation Workflow (Foam + Claude Code)

This project uses Foam for documentation with direct Claude Code integration inside VS Code.

### Directory Structure

```
/docs/
├── specs/          # Feature specifications
├── plans/          # Implementation plans
├── decisions/      # Architecture decision records (ADRs)
├── notes/          # Working notes (from Apple Notes)
├── issues/         # GitHub Issues (synced from GitHub API)
├── conversations/  # Planning session transcripts
└── journal/        # Daily notes (Foam feature, Alt+D to create)
```

### Knowledge Base Automation

**Sync all sources:** `./scripts/sync-all.sh` (auto-commits, you push when ready)

Or run individually:
- **GitHub Issues:** `python3 scripts/sync-github-issues.py` - Fetches from GitHub API, auto-commits
- **Apple Notes:** `python3 scripts/import-apple-notes.py` - Re-imports from alto-index, auto-commits

**View synced content:**
- [[issues/README]] - 14 issues across 3 phases
- [[apple-notes/README]] - 155 notes (45 ClaudeAI, 110 CardBoard + 41 images)

### Templates

All directories have `_TEMPLATE.md` files. Copy and rename to start new documents.

### Example Workflow

See the complete workflow example:
1. [[2026-01-23-canvas-pan-zoom-idea]] - Raw idea from Apple Notes
2. [[canvas-pan-zoom-controls]] - Refined spec with Claude Q&A
3. [[2026-01-23-d3-zoom-vs-custom]] - Decision record
4. [[canvas-pan-zoom-controls-plan]] - Implementation plan

### Interacting with Claude Code in Markdown

- **Highlight text** → Right-click → "Add to Chat" - Ask questions about selections
- **Cmd+I** in markdown file - Inline chat without leaving document
- **Edit inline** to answer Claude's questions - No copy-paste needed
- **Cmd+Click** on `[[wiki-links]]` - Jump between related docs

### Daily Notes

Press `Alt+D` in VS Code to create today's journal entry (`docs/journal/YYYY-MM-DD.md`)

Use for:
- Quick captures during development
- Questions that come up during coding
- Links to specs/decisions made today

### When to Create Each Document Type

- **Note** (`/docs/notes/`) - Raw idea from Apple Notes, unstructured thoughts
- **Spec** (`/docs/specs/`) - Structured feature specification with acceptance criteria
- **Decision** (`/docs/decisions/`) - Architecture choice with options considered
- **Plan** (`/docs/plans/`) - Implementation steps from Claude Code plan mode
- **Journal** (`/docs/journal/`) - Daily work log, quick captures
