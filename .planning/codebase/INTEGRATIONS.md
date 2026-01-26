# External Integrations

**Analysis Date:** 2026-01-25

## APIs & External Services

**AI Services:**
- Anthropic Claude API - AI-assisted development commands
  - SDK/Client: @anthropic-ai/sdk 0.71.2
  - Auth: VITE_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY
  - Implementation: `src/hooks/useClaudeAPI.ts`

**Development Tools:**
- Native HTTP API Server - Bridge between React and Swift backend
  - Endpoint: http://localhost:8080
  - Framework: Vapor 4.89.0+
  - Server: `src/server/launch-native-server.js`

## Data Storage

**Databases:**
- SQLite with GRDB.swift
  - Connection: Native file system
  - Client: GRDB.swift 6.24.0+ wrapper
  - Features: FTS5 full-text search, recursive CTEs, WAL mode
  - Location: Application Support directory (native)
  - Config: 64MB cache, foreign keys enabled

**File Storage:**
- Local filesystem only
- Archive support via ZipArchive 2.5.5+ for import/export
- Native Application Support directory for persistence

**Caching:**
- Browser-based caching for React app
- Native SQLite WAL mode for write performance

## Authentication & Identity

**Auth Provider:**
- iCloud Account integration
  - Implementation: CloudKit entitlements
  - Required for sync functionality

## Monitoring & Observability

**Error Tracking:**
- Console-based logging
- Performance monitoring via `src/utils/performance-benchmarks.ts`
- Migration safety checks via `src/db/migration-safety.ts`

**Logs:**
- Browser console for React frontend
- Native Swift logging for backend operations

## CI/CD & Deployment

**Hosting:**
- React: Static site deployment
- Native: iOS App Store / macOS distribution

**CI Pipeline:**
- None detected (manual build process)

## Environment Configuration

**Required env vars:**
- VITE_ANTHROPIC_API_KEY - Claude API access for development features
- REACT_APP_USE_NATIVE_API - Toggle between native and legacy backends

**Secrets location:**
- Environment variables for development
- Native keychain for production credentials

## Webhooks & Callbacks

**Incoming:**
- Native HTTP server at `/api/` endpoints:
  - `/api/execute` - SQL execution via `src/db/NativeAPIClient.ts`
  - `/api/nodes` - Node queries
  - `/api/notebook-cards` - Notebook operations
  - `/api/search` - Full-text search
  - `/health` - Health check endpoint

**Outgoing:**
- CloudKit sync operations (when enabled)
- WebView message passing between React and native components

## Data Synchronization

**CloudKit Integration:**
- Container: `iCloud.com.cardboard.app`
- Zone: `IsometryZone` (private database)
- Bi-directional sync for iOS/macOS
- Files: `native/Sources/Isometry/` CloudKit-related modules
- Conflict resolution strategies (server wins, local wins, latest wins, etc.)
- Status checking via WebView bridge

**WebView Bridge:**
- Message passing between React and native Swift code
- Handles database operations and sync status
- Files: `src/utils/webview-bridge.ts`, `src/db/WebViewClient.ts`

## Import/Export

**Document Processing:**
- Word documents via mammoth 1.7.2
- Excel files via xlsx 0.18.5
- Apple Notes via alto-index import system (`~/Documents/alto-index/Notes/`)
- PDF generation via html2pdf.js 0.10.2

**Map Integration:**
- Leaflet 1.9.4 for interactive maps
- OpenStreetMap tile layers
- Location-based data visualization via react-leaflet 4.2.1

**Apple Notes Import:**
- Format: alto-index markdown with YAML frontmatter
- Importer: `native/Sources/Isometry/Import/AltoIndexImporter.swift`
- Deduplication by sourceId + source name
- Auto-import on first launch

## Terminal Integration

**Terminal Emulation:**
- @xterm/xterm 5.5.0 - Terminal rendering
- @xterm/addon-fit 0.10.0 - Responsive sizing
- @xterm/addon-web-links 0.11.0 - Clickable links
- node-pty 1.1.0 - Pseudo-terminal interface

**Command Processing:**
- Shell command execution via native bridge
- Command history tracking
- Slash command system via `src/hooks/useSlashCommands.ts`

---

*Integration audit: 2026-01-25*