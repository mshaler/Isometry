# Phase 111: Native Apple Adapter E2E - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify Notes, Reminders, and Calendar native adapter imports through fixture injection at the bridge boundary. Covers auto-connection synthesis, CatalogWriter provenance, NoteStore multi-schema branching (macOS 13 vs 14+), and protobuf 3-tier fallback. Test-only phase — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### Test tier
- Vitest seam tests using `realDb()` — in-process, no browser needed
- Matches success criteria wording ("Vitest seam tests confirm...")
- Playwright reserved for UI-observable behavior (covered in Phase 113 for TCC lifecycle)

### Fixture strategy for NoteStore schema branching
- Two separate fixture files: `notestore-v13.json` (ZTITLE1 column) and `notestore-v14.json` (ZTITLE2 column)
- Each test case loads the appropriate fixture — explicit, deterministic
- Matches success criteria: "macOS 13 (ZTITLE1) and macOS 14+ (ZTITLE2) fixture variants both yield correct title extraction"

### Protobuf 3-tier fallback
- 3 separate it() blocks per tier:
  1. "extracts body from ZDATA" — full protobuf body present
  2. "falls back to ZSNIPPET when ZDATA absent" — ZDATA null/missing
  3. "returns empty string when both null" — no crash, graceful empty
- Separate test cases for clear failure messages and red-green-refactor alignment

### Auto-connection assertions
- Full row assertions on connection table content: `connection_type`, `source_card_id`, `target_card_id`, `via_card_id`
- Verifies actual graph topology, not just counts — catches regressions in connection wiring
- Calendar attendee-of person cards: assert person card created + connection row with correct type
- Notes internal links: assert note-to-note connection row with correct source/target IDs

### Claude's Discretion
- Exact fixture card content (field values, card titles, body text)
- Test file organization within tests/seams/ directory structure
- Helper function signatures beyond the named exports
- How to construct the in-process adapter pipeline for seam testing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — NATV-01 through NATV-07 success criteria (v8.5 ETL E2E requirements)

### Phase 109 context (upstream decisions)
- `.planning/phases/109-etl-test-infrastructure/109-CONTEXT.md` — Fixture design decisions, bridge query API, environment boundary enforcement

### Existing test infrastructure
- `e2e/helpers/etl.ts` — `importNativeCards`, `assertCatalogRow`, `resetDatabase` helpers
- `tests/harness/realDb.ts` — In-memory sql.js factory for Vitest seam tests
- `tests/harness/makeProviders.ts` — Wired provider stack factory

### Native adapter implementation
- `src/worker/handlers/etl-import-native.handler.ts` — Native import handler (Notes/Reminders/Calendar routing, auto-connection synthesis, CatalogWriter calls)
- `src/etl/CatalogWriter.ts` — Import provenance tracking (import_sources, import_runs, datasets)

### NoteStore schema
- `Isometry/NativeAdapters/NotesAdapter.swift` — macOS 13 vs 14+ ZTITLE column branching logic (reference for fixture design)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `realDb()`: In-memory sql.js factory — provides the database for seam tests
- `makeProviders()`: Wired provider stack with real SchemaProvider — can construct the full provider chain
- `CatalogWriter`: Already tested in prior phases — seam tests extend coverage to native adapter path
- `DedupEngine`: Dedup logic tested in Phase 110 — reusable for connection dedup assertions

### Established Patterns
- `tests/seams/` domain subdirs for integration tests (filter, coordinator, ui, etl)
- `@vitest-environment` annotation per-file for environment selection
- `realDb()` factory for WASM-based sql.js tests
- INSERT OR REPLACE idempotent writes for catalog tables

### Integration Points
- `tests/seams/etl/` — New test files for native adapter seam tests
- `tests/fixtures/` — New notestore-v13.json, notestore-v14.json, protobuf tier fixtures
- No production code changes — test-only phase

</code_context>

<specifics>
## Specific Ideas

- Success criteria mention "attendee-of person cards" for Calendar — fixture must include Calendar events with attendee fields
- Success criteria mention "note-to-note link connections" for Notes — fixture must include Notes with internal link references
- The 3-tier protobuf fallback is specific to Notes adapter — Reminders and Calendar don't use protobuf

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 111-native-apple-adapter-e2e*
*Context gathered: 2026-03-23*
