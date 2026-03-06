# Phase 33: Native ETL Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared infrastructure for all native macOS adapters: NativeImportAdapter protocol, PermissionManager, CoreDataTimestampConverter, chunked bridge pipeline, dynamic system DB discovery, security-scoped bookmark caching, and end-to-end MockAdapter validation. No real system databases are read — only the mock adapter ships in this phase.

</domain>

<decisions>
## Implementation Decisions

### Permission flow UX
- Inline SwiftUI sheet slides up when access is needed (not a system alert)
- Sheet copy explains WHY access is needed: "Isometry will read your [source] to create cards you can organize and explore. Nothing is modified or deleted."
- On denial or prior denial: show message with deep-link button to the specific System Settings pane (Privacy & Security → Full Disk Access or Calendars/Reminders)
- Re-import: silently reuse cached security-scoped bookmarks — no file picker, no confirmation, just import

### Adapter protocol design
- Define a Codable `CanonicalCard` struct in Swift that mirrors the TypeScript CanonicalCard type — type-safe on both sides, serialized to JSON for bridge transport
- New distinct source types for native adapters: `native_reminders`, `native_calendar`, `native_notes` — never reuse existing file-based SourceType values
- NativeImportAdapter protocol uses `AsyncSequence<[CanonicalCard]>` for batch yielding — natural backpressure, modern Swift concurrency
- MockAdapter validates the full end-to-end pipeline: Swift adapter → bridge → Worker → ImportOrchestrator → dedup → write to DB → verify cards appear in Isometry

### Chunked bridge transport
- 200-card chunks sent sequentially: Swift sends chunk N, awaits JS acknowledgment, then sends chunk N+1 — guaranteed ordering with backpressure
- Reuse existing ImportToast progress UI — each chunk triggers the existing import_progress Worker notification pipeline (FNDX-01: no additional UI changes)
- Abort on chunk failure — stop import, show error toast with count of cards successfully imported. User can re-trigger to retry.
- New bridge message type `native:import-chunk` with chunk index, total chunks, and cards JSON array. NativeBridge.ts handler accumulates all chunks, then calls ImportOrchestrator once for proper cross-chunk dedup.

### System DB safety & discovery
- Copy-then-read strategy: copy .db + .wal + .shm to a temp directory, then open the copy read-only — zero risk of interfering with running system apps
- Foundation phase includes a basic "Import from..." source picker UI (menu or sheet) — sources for future phases appear greyed out. MockAdapter appears in debug builds only.

### Claude's Discretion
- Dynamic path discovery strategy per adapter (EventKit is API-based vs Notes is file-based — different strategies appropriate)
- CoreData timestamp converter pattern (standalone function vs protocol extension)
- Permission sheet visual design and layout
- Temp directory cleanup timing and strategy
- Error message wording for edge cases
- MockAdapter card content (3 hardcoded cards per FNDX-08)

</decisions>

<specifics>
## Specific Ideas

- The "Import from..." picker should show future sources (Reminders, Calendar, Notes) as greyed-out entries so users know what's coming
- MockAdapter should only appear in debug/development builds, never in production
- The trust-building copy on permission sheets matters — users are granting access to system databases, so transparency is key

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BridgeManager.swift`: Already handles `native:action` → `importFile` dispatch; can be extended with `native:import-chunk` handler
- `NativeBridge.ts`: Already routes `native:action` to WorkerBridge.importFile(); needs new `native:import-chunk` handler that accumulates chunks
- `ImportOrchestrator.ts`: Full ETL pipeline (parse → dedup → write → catalog) with progress reporting via onProgress callback
- `ImportToast.ts`: Progress/success/error toast UI — reusable as-is for native import progress
- `etl-import.handler.ts`: Worker handler that wires progress notifications from Worker → main thread
- `DatabaseManager.swift`: Actor-based checkpoint persistence — existing pattern for async Swift data handling

### Established Patterns
- Base64 JSON transport for all Swift↔JS bridge messages (mandatory through WKScriptMessageHandler)
- 5-message bridge protocol: LaunchPayload, checkpoint, mutated, native:action, sync
- WeakScriptMessageHandler proxy pattern prevents WKUserContentController retain cycle
- `@MainActor` for all evaluateJavaScript calls
- Worker-mediated ETL: main thread → Worker → ImportOrchestrator → DB writes
- SourceType union type in `src/etl/types.ts` — needs extension for native source types

### Integration Points
- `BridgeManager.didReceive()` switch statement: add `native:import-chunk` case
- `NativeBridge.ts initNativeBridge()` receive handler: add `native:import-chunk` case
- `src/etl/types.ts SourceType`: extend union with native source types
- `ContentView.swift`: wire new import source picker UI
- `IsometryApp.swift`: wire PermissionManager lifecycle

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-native-etl-foundation*
*Context gathered: 2026-03-05*
