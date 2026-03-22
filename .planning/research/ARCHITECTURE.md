# Architecture Research

**Domain:** E2E ETL Dataflow Testing — Isometry v8.5
**Researched:** 2026-03-22
**Confidence:** HIGH (all findings from direct codebase inspection)

## Standard Architecture

### System Overview

The ETL pipeline has two distinct paths that E2E tests must cover. Both converge at the same DedupEngine + SQLiteWriter + CatalogWriter sink.

```
FILE-BASED ETL PATH (6 sources)
┌──────────────────────────────────────────────────────────────────────────────┐
│  UI Layer (main thread)                                                       │
│  ┌─────────────────────────────────────────────┐                              │
│  │  window.__isometry.bridge.importFile()       │  <- E2E entry point         │
│  └──────────────────┬──────────────────────────┘                              │
└─────────────────────┼────────────────────────────────────────────────────────┘
                      │ WorkerRequest {type:'etl:import', correlationId}
                      v
┌──────────────────────────────────────────────────────────────────────────────┐
│  Worker (sql.js thread)                                                       │
│  ┌────────────────────┐                                                       │
│  │  etl-import.handler │                                                       │
│  └────────┬───────────┘                                                       │
│           │                                                                   │
│  ┌────────v───────────────────────────────────────────────┐                   │
│  │  ImportOrchestrator                                      │                   │
│  │   parse() -> CanonicalCard[] + CanonicalConnection[]    │                   │
│  │   DedupEngine.process()                                 │                   │
│  │   SQLiteWriter.writeCards() / updateCards()             │                   │
│  │   SQLiteWriter.writeConnections()                       │                   │
│  │   CatalogWriter.recordImportRun()                       │                   │
│  └────────────────────────────────────────────────────────┘                   │
│                                                                               │
│  WorkerNotification {type:'import_progress'} -> main thread (fire-and-forget)│
└──────────────────────────────────────────────────────────────────────────────┘

NATIVE ETL PATH (3 sources + alto_index)
┌──────────────────────────────────────────────────────────────────────────────┐
│  Swift Layer (WKWebView host)                                                 │
│  ┌───────────────────────────────────────────┐                                │
│  │  NativeImportAdapter (AsyncStream chunks)  │  <- TCC permission gate       │
│  │  BridgeManager.sendChunkedImport()         │                                │
│  └──────────────────┬────────────────────────┘                                │
└─────────────────────┼────────────────────────────────────────────────────────┘
                      │ JS eval: window.__isometry.receive({type:'native:action'})
                      v CanonicalCard[] JSON (pre-parsed, bypasses parser layer)
┌──────────────────────────────────────────────────────────────────────────────┐
│  Worker (sql.js thread)                                                       │
│  ┌──────────────────────────┐                                                 │
│  │  etl-import-native.handler│                                                 │
│  └────────────┬─────────────┘                                                 │
│               │  DedupEngine.process()                                         │
│               │  SQLiteWriter.writeCards() / updateCards()                     │
│               │  SQLiteWriter.writeConnections()                               │
│               │  auto-connections (attendee-of: / note-link: patterns)         │
│               │  CatalogWriter.recordImportRun()                               │
│               v                                                                │
│           ImportResult -> WorkerResponse -> main thread                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Test Layer |
|-----------|----------------|------------|
| `WorkerBridge.importFile()` | Main-thread typed request + await correlation ID | E2E via `bridge.importFile()` on `window.__isometry` |
| `etl-import.handler` | Thin delegation to `ImportOrchestrator` + progress wiring | Vitest integration (worker.test.ts) |
| `ImportOrchestrator` | parse -> dedup -> write -> catalog orchestration | Vitest unit + integration |
| `etl-import-native.handler` | CanonicalCard[] intake, auto-connections, bulk threshold | Vitest seam tests (new) |
| `DedupEngine` | source+source_id classification, deleted-IDs tracking | Vitest unit (DedupEngine.test.ts) |
| `SQLiteWriter` | Batched parameterized writes, FTS trigger/rebuild | Vitest unit (SQLiteWriter.test.ts) |
| `CatalogWriter` | import_sources + import_runs + datasets provenance | Vitest seam tests (new) |
| `PermissionManager` (Swift) | TCC authorization gate — cannot be tested in JS layer | Swift XCTest mocks OR Playwright skip annotation |

## Recommended Project Structure

```
tests/
├── harness/
│   ├── realDb.ts              # existing — in-memory sql.js factory
│   ├── makeProviders.ts       # existing — wired provider stack
│   ├── seedCards.ts           # existing
│   └── seedConnections.ts     # existing
│
├── etl-validation/            # existing — file-based source integration tests
│   ├── helpers.ts             # existing — importFileSource() + importNativeSource()
│   ├── fixtures/              # existing — 100+ card snapshots per source
│   ├── source-import.test.ts  # existing
│   ├── source-dedup.test.ts   # existing
│   └── source-errors.test.ts  # existing
│
├── seams/etl/
│   ├── etl-fts.test.ts        # existing — FTS5 round-trip seam
│   ├── etl-catalog.test.ts    # NEW — CatalogWriter provenance assertions
│   └── etl-native-handler.test.ts  # NEW — auto-connections for native handler
│
e2e/
├── helpers/
│   ├── isometry.ts            # existing — importFixture(), importSnapshot()
│   ├── harness.ts             # existing — HarnessShell helpers
│   └── etl.ts                 # NEW — importNativeCards(), assertCatalogRow()
│
├── etl-file-import.spec.ts         # NEW — all 6 file sources via bridge.importFile()
├── etl-native-import.spec.ts       # NEW — 3 native sources via receive() injection
├── etl-alto-index.spec.ts          # NEW — all 11 alto subdirectory types
├── etl-dedup.spec.ts               # NEW — re-import idempotency E2E proof
├── etl-tcc-permission.spec.ts      # NEW — denied-permission response (no crash)
└── etl-catalog-provenance.spec.ts  # NEW — import_runs rows verified post-import
```

### Structure Rationale

- **`tests/seams/etl/`:** Vitest seam tests hit the Worker handler and below in-process. No Playwright needed. They verify internal correctness of dedup classification, auto-connection synthesis, and catalog writes — behaviors invisible from the E2E layer. Build these first (fastest feedback).
- **`e2e/helpers/etl.ts`:** Centralizes `importNativeCards()` which simulates `native:action` delivery through `window.__isometry.receive()` — the same path the Swift bridge uses. Tests must not inline this pattern.
- **`e2e/etl-*.spec.ts`:** Playwright tests run against the Vite dev server. They call `bridge.importFile()` or inject pre-parsed cards via `receive()`, then assert on database state queried back through `bridge.listCards()` or `bridge.searchCards()`.

## Architectural Patterns

### Pattern 1: Dual-Path ETL Seam Testing (Vitest, not Playwright)

**What:** Cover file-based (parse -> dedup -> write) and native (skip parse -> dedup -> write) paths as separate Vitest tests using `realDb()` + `DedupEngine` + `SQLiteWriter` directly.

**When to use:** Any assertion on dedup classification, FTS indexing, CatalogWriter rows, or auto-connection synthesis. These are internal correctness concerns, not UI behaviors.

**Trade-offs:** Fast (in-process WASM, no browser), accurate to production SQL, but cannot test the Worker message envelope or the Swift-to-JS bridge channel.

**Example:**
```typescript
// tests/seams/etl/etl-native-handler.test.ts
it('attendee-of: source_url produces connection from person to event', async () => {
  const db = await realDb();
  const eventCard = makeCard({ source: 'native_calendar', source_id: 'evt-001', card_type: 'event' });
  const personCard = makeCard({
    source: 'native_calendar', source_id: 'person-001',
    source_url: 'attendee-of:evt-001', card_type: 'person',
  });
  const dedup = new DedupEngine(db);
  const result = dedup.process([eventCard, personCard], [], 'native_calendar');
  const writer = new SQLiteWriter(db);
  await writer.writeCards(result.toInsert, false);
  await writer.writeConnections(result.connections);
  const connCount = db.exec('SELECT count(*) FROM connections')[0]!.values[0]![0];
  expect(connCount).toBe(1);
  db.close();
});
```

### Pattern 2: E2E Bridge Injection for Native Sources

**What:** Native adapter cards cannot be imported via `bridge.importFile()` (which invokes the parser layer). Inject pre-parsed `CanonicalCard[]` via `window.__isometry.receive({ type: 'native:action', ... })` to simulate what Swift sends.

**When to use:** Any E2E test covering native_notes, native_reminders, native_calendar, or alto_index flows.

**Trade-offs:** Exercises the full Worker handler including auto-connection synthesis and CatalogWriter. Does not test Swift adapter logic (EventKit, NoteStore.sqlite) — those require XCTest on a real device.

**Example:**
```typescript
// e2e/helpers/etl.ts
export async function importNativeCards(
  page: Page,
  sourceType: 'native_reminders' | 'native_calendar' | 'native_notes' | 'alto_index',
  cards: CanonicalCard[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  const result = await page.evaluate(
    async ({ sourceType, cards }) => {
      const iso = (window as any).__isometry;
      return iso.bridge.importNative(sourceType, cards);
    },
    { sourceType, cards },
  );
  await page.waitForTimeout(300);
  return result;
}
```

### Pattern 3: CatalogWriter Post-Import Verification

**What:** After every E2E import, query `import_runs` via `bridge.queryAll()` (the `db:query` Worker handler) to assert that provenance was written correctly.

**When to use:** All ETL E2E specs as a mandatory postcondition. Makes the catalog a first-class test concern.

**Trade-offs:** Requires `bridge.queryAll()` to be exposed on `window.__isometry`. If not already present, add it as a minimal test utility in main.ts bootstrap (not a production-facing API).

**Example:**
```typescript
const runRows = await page.evaluate(async () => {
  const iso = (window as any).__isometry;
  return iso.bridge.queryAll(
    'SELECT cards_inserted FROM import_runs ORDER BY completed_at DESC LIMIT 1'
  );
});
expect(runRows[0].cards_inserted).toBe(expectedInsertedCount);
```

### Pattern 4: TCC Permission Lifecycle via Fixture Injection

**What:** Real TCC prompts (EventKit, SQLite bookmark) cannot be automated in CI. Test the denied-permission *response* path — simulate what the Swift bridge sends when permission is denied.

**When to use:** `etl-tcc-permission.spec.ts` — inject an empty-cards `native:action` with a synthetic error flag and assert the UI shows a recoverable error state, not a crash or infinite spinner.

**Trade-offs:** Does not test the system dialog interaction. Document as "requires real device with clean TCC state" for manual verification. This is the correct scope boundary.

## Data Flow

### File-Based Import E2E Flow

```
Playwright test
    v page.evaluate -> window.__isometry.bridge.importFile(source, data, {filename})
WorkerBridge.importFile()
    v postMessage WorkerRequest{type:'etl:import', correlationId}
worker.ts router -> handleETLImport(db, payload)
    v
ImportOrchestrator.import(source, data)
    +-- parser[source].parse(data) -> CanonicalCard[]
    +-- DedupEngine.process(cards, connections, source)
    |     +-- SELECT existing FROM cards WHERE source = ?
    |     +-- classify -> toInsert / toUpdate / toSkip / deletedIds
    +-- SQLiteWriter.writeCards(toInsert, isBulkImport)
    |     +-- FTS5: trigger path (<500) or rebuild path (>=500)
    +-- SQLiteWriter.updateCards(toUpdate)
    +-- SQLiteWriter.writeConnections(connections)
    +-- CatalogWriter.recordImportRun(record)
          +-- upsert import_sources
          +-- insert import_runs
          +-- upsert datasets registry
    v WorkerResponse{correlationId, payload: ImportResult}
WorkerBridge resolves pending promise
    v ImportResult returned to page.evaluate
Playwright: assert { inserted, updated, errors }
    + bridge.listCards() / searchCards() state assertions
    + import_runs catalog row assertion
```

### Native Import E2E Flow

```
Playwright test
    v page.evaluate -> iso.bridge.importNative(sourceType, cards[])
WorkerBridge.importNative()
    v postMessage WorkerRequest{type:'etl:import-native', correlationId}
worker.ts router -> handleETLImportNative(db, payload)
    +-- alto_index: DELETE FROM cards/connections first (purge-then-replace)
    +-- DedupEngine.process(payload.cards, [], payload.sourceType)
    +-- SQLiteWriter.writeCards(toInsert, isBulkImport)
    +-- SQLiteWriter.updateCards(toUpdate)
    +-- SQLiteWriter.writeConnections(dedupResult.connections)
    +-- auto-connection loop:
    |     attendee-of: source_url -> person->event connection
    |     note-link: source_url  -> forward + backlink connections
    +-- SQLiteWriter.writeConnections(autoConnections)
    +-- CatalogWriter.recordImportRun(record)
    v ImportResult
Playwright: assert inserted count + connection rows + catalog row
```

### Key Data Flows

1. **FTS5 dual path:** Trigger path fires `cards_fts_ai` INSERT trigger per card (non-bulk). Bulk path (>=500 cards) disables triggers and calls `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')`. The existing `etl-fts.test.ts` seam covers this. No new seam needed — but E2E tests should call `bridge.searchCards()` post-import to confirm FTS is live.

2. **DedupEngine deleted-IDs:** Cards present in the DB for a source but absent from the incoming batch appear in `deletedIds`. E2E dedup spec must verify: import 10 cards, re-import 8 (omit 2), assert `deletedIds.length === 2` in the ImportResult and those card IDs are soft-deleted in DB.

3. **Auto-connection synthesis:** The `attendee-of:` and `note-link:` auto-connection patterns in `etl-import-native.handler` use `sourceIdMap` from `DedupEngine.process()`. This requires both connected cards to be in the same import batch. Test this in the new Vitest seam (`etl-native-handler.test.ts`), not in E2E.

4. **CatalogWriter datasets row:** Every import upserts the `datasets` table (DEXP-02). The self-reflecting Catalog in DataExplorer renders from this table via PAFV. E2E specs must assert this row exists post-import.

5. **alto_index purge semantics:** The `etl-import-native.handler` runs `DELETE FROM cards; DELETE FROM connections` before processing `alto_index` imports. E2E tests for alto_index must seed other-source cards first to verify those cards survive the purge (only alto_index rows are purged by this DELETE — actually the current code deletes ALL cards, not just alto_index ones). This is a potential correctness gap to verify against production behavior.

## Integration Points

### New vs Modified Components

| Component | Status | What Changes |
|-----------|--------|--------------|
| `e2e/helpers/etl.ts` | NEW | `importNativeCards()`, `assertCatalogRow()`, `resetDatabase()` helpers |
| `e2e/etl-file-import.spec.ts` | NEW | 6 sources x {inserted count, zero errors, FTS searchable, catalog row} |
| `e2e/etl-native-import.spec.ts` | NEW | 3 native sources via `receive()` injection + connection assertions |
| `e2e/etl-alto-index.spec.ts` | NEW | 11 subdirectory types, purge-then-replace semantics |
| `e2e/etl-dedup.spec.ts` | NEW | Re-import idempotency: insert 10, re-import 8, assert 0 duplicates + 2 deletedIds |
| `e2e/etl-tcc-permission.spec.ts` | NEW | Denied-permission response -> error state (no crash) |
| `e2e/etl-catalog-provenance.spec.ts` | NEW | `import_runs` row count and `cards_inserted` match ImportResult |
| `tests/seams/etl/etl-catalog.test.ts` | NEW | CatalogWriter creates correct import_sources + import_runs + datasets rows |
| `tests/seams/etl/etl-native-handler.test.ts` | NEW | Auto-connections for attendee-of: and note-link: patterns |
| `WorkerBridge` | MODIFIED | Add `importNative()` method if not present; add `queryAll()` for test introspection |
| `window.__isometry` bootstrap | MODIFIED | Expose `bridge.importNative()` and `bridge.queryAll()` on the test API surface |
| `e2e/helpers/isometry.ts` | MODIFIED | Add `resetDatabase()` (DELETE all tables) for beforeEach cleanup |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main thread <-> Worker (file import) | `WorkerRequest{type:'etl:import'}` + `WorkerResponse` | `ETL_TIMEOUT` is longer than standard request timeout — fixture data must stay within budget |
| Main thread <-> Worker (native import) | `WorkerRequest{type:'etl:import-native'}` + `WorkerResponse` | Same timeout. Cards arrive pre-parsed. |
| Worker -> Main (progress) | `WorkerNotification{type:'import_progress'}` | Fire-and-forget, no correlation ID. E2E tests must NOT assert on intermediate progress — only on final ImportResult. |
| Swift -> WKWebView (native:action) | `window.__isometry.receive({type:'native:action',...})` | E2E simulates this with `page.evaluate`. The `normalizeNativeCard()` nil-skipping fix (v4.0) is already in production. |
| Playwright -> Vite dev server | HTTP localhost:5173 | Existing CI wiring. New ETL specs add to the sequential pool. No `playwright.config.ts` changes needed for basic specs; add per-spec `test.setTimeout` for alto_index only. |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (28 E2E specs, 10min CI) | Sequential, 1 worker — sufficient |
| After v8.5 (34 E2E specs) | Still within 10min if each ETL spec stays under 20s. Alto-index spec likely needs 45s annotation. |
| Future (100+ E2E specs) | Split into `etl` and `ui` Playwright projects in separate CI jobs with independent timeouts. |

### Scaling Priorities

1. **First bottleneck: alto_index test duration.** Purge-then-replace + 11 subdirectory types = functionally 11 sequential imports. Annotate that spec with `test.setTimeout(60_000)`.

2. **Second bottleneck: database state bleed.** Without per-spec reset, dedup behavior corrupts subsequent tests. `resetDatabase()` in `beforeEach` is mandatory.

## Anti-Patterns

### Anti-Pattern 1: Testing Swift Adapter Logic in Playwright

**What people do:** Write E2E tests asserting on NoteStore.sqlite parsing, EventKit recurrence expansion, or gzip+protobuf extraction.

**Why it's wrong:** These code paths run in Swift. Playwright cannot reach them. The JS-side boundary is `handleETLImportNative(db, {cards: CanonicalCard[]})` — everything before that is Swift's concern.

**Do this instead:** Inject pre-built `CanonicalCard[]` fixtures representing what the Swift adapter would produce. Verify fixture accuracy against real device output separately.

### Anti-Pattern 2: Asserting on WorkerNotification Progress in E2E

**What people do:** Try to intercept `import_progress` notifications in Playwright to verify progress reporting.

**Why it's wrong:** Progress notifications are fire-and-forget with no correlation ID. By the time `bridge.importFile()` resolves, notifications are already consumed by the ImportToast UI. The seam tests in `tests/ui/ImportToast.test.ts` cover this.

**Do this instead:** Assert only on the final `ImportResult` returned from `bridge.importFile()` and on database state queried afterward.

### Anti-Pattern 3: Skipping CatalogWriter Assertions

**What people do:** Import data, assert card counts, stop there.

**Why it's wrong:** `CatalogWriter.recordImportRun()` runs inside the Worker handler. If it silently throws (e.g., schema mismatch), the import succeeds but provenance is lost — breaking the self-reflecting Catalog in DataExplorer.

**Do this instead:** Every ETL E2E spec includes `bridge.queryAll('SELECT cards_inserted FROM import_runs ORDER BY completed_at DESC LIMIT 1')` as a mandatory postcondition.

### Anti-Pattern 4: Testing TCC System Dialogs via Playwright

**What people do:** Attempt to interact with macOS system permission dialogs in Playwright.

**Why it's wrong:** System security dialogs are outside the browser sandbox. Playwright cannot reach them, and CI runs on Ubuntu (no macOS TCC).

**Do this instead:** Test the denied-permission *response* path. Simulate what the Swift bridge sends when permission is denied, verify the UI shows a recoverable error state. Document real-device TCC testing as a manual verification step.

### Anti-Pattern 5: Reusing Database State Between E2E Specs

**What people do:** Import data in one spec and rely on it being present in the next.

**Why it's wrong:** `playwright.config.ts` sets `fullyParallel:false, workers:1`, but each spec still runs in the same browser context. Without explicit reset between specs, dedup behavior is unpredictable — re-imports of the same source skip inserts, making card count assertions unreliable.

**Do this instead:** Call `resetDatabase()` in `beforeEach` for all ETL specs. Pattern:
```typescript
await page.evaluate(() => {
  const iso = (window as any).__isometry;
  return iso.bridge.exec(
    'DELETE FROM connections; DELETE FROM cards; DELETE FROM import_sources; DELETE FROM import_runs;'
  );
});
```

### Anti-Pattern 6: Treating alto_index as a Variant Native Source

**What people do:** Write alto_index E2E tests using the same structure as native_reminders tests.

**Why it's wrong:** `etl-import-native.handler` has special-case logic for `alto_index`: it runs `DELETE FROM cards; DELETE FROM connections` before processing (purge-then-replace semantics). This deletes ALL cards — not just alto_index ones. This is a critical behavioral difference that must be tested explicitly.

**Do this instead:** Seed a non-alto_index card before the alto_index import. Assert after: that card should be deleted (because the purge is unconditional). Document this as a known architectural constraint.

## Sources

- Direct inspection: `src/worker/handlers/etl-import.handler.ts`
- Direct inspection: `src/worker/handlers/etl-import-native.handler.ts`
- Direct inspection: `src/etl/ImportOrchestrator.ts`, `DedupEngine.ts`, `SQLiteWriter.ts`, `CatalogWriter.ts`
- Direct inspection: `tests/harness/realDb.ts`, `tests/harness/makeProviders.ts`
- Direct inspection: `tests/etl-validation/helpers.ts`, `tests/seams/etl/etl-fts.test.ts`
- Direct inspection: `e2e/helpers/isometry.ts`, `e2e/helpers/harness.ts`, `e2e/cold-start.spec.ts`
- Direct inspection: `playwright.config.ts`, `.github/workflows/ci.yml`
- Project memory: v8.3 test patterns, v8.4 current state, v8.5 scope

---
*Architecture research for: E2E ETL dataflow testing (v8.5 milestone)*
*Researched: 2026-03-22*
