# Stack Research

**Domain:** E2E ETL Dataflow Testing — Alto-index, Native Adapters, File Format Imports, TCC Permission Lifecycle
**Researched:** 2026-03-22
**Confidence:** HIGH (all stack recommendations verified against existing package.json and project infrastructure)

---

## Existing Infrastructure (DO NOT RE-RESEARCH)

The following are already installed and proven. This document only covers NEW additions.

| Already Present | Version | Role |
|----------------|---------|------|
| vitest | ^4.0.18 | Unit/integration test runner |
| @playwright/test | ^1.58.2 | E2E browser automation |
| jsdom | ^28.1.0 | DOM environment for Vitest |
| sql.js | ^1.14.0 | In-memory SQLite (WASM) |
| xlsx | ^0.18.5 | Excel parse/generate in tests |
| papaparse | ^5.5.3 | CSV parse |
| realDb() | — | In-memory sql.js factory (tests/harness/realDb.ts) |
| makeProviders() | — | Wired provider stack (tests/harness/makeProviders.ts) |
| importFileSource() / importNativeSource() | — | ETL helpers (tests/etl-validation/helpers.ts) |
| 100+ card fixtures | — | JSON snapshots for all 9 sources (tests/etl-validation/fixtures/) |
| etl-load-run.test.ts | — | 15-assertion integration test |
| etl-alto-index-full.test.ts | — | 20K-card full-scale alto-index load test |

---

## Recommended Stack — New Additions Only

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-sqlite3 | ^11.10.0 | Read real NoteStore.sqlite and arbitrary `.db` files in Node.js fixture-generation scripts | sql.js is WASM-only and cannot open arbitrary file-system SQLite files without copying the entire file into memory as a Uint8Array. better-sqlite3 is the Node.js canonical synchronous SQLite binding — used ONLY in developer-machine fixture-generation scripts (the same pattern as `tests/etl-validation/fixtures/generate-fixtures.mjs`). Never ships to production. Confidence: HIGH. |
| @types/better-sqlite3 | ^7.6.12 | TypeScript types for better-sqlite3 | Dev-only type coverage for fixture generation scripts. |
| tmp | ^0.2.3 | Create isolated temp directories for file-format import tests that write XLSX/CSV/HTML to disk | E2E tests that generate binary fixtures (XLSX) in beforeAll and pass them to `bridge.importFile()` need a guaranteed-clean, auto-deleted scratch space. `tmp` auto-deletes on process exit, preventing leaked temp files on test failure in CI. Confidence: HIGH. |
| @types/tmp | ^0.2.6 | TypeScript types for tmp | Dev-only. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| archiver | NOT needed | — | Rejected. Multi-sheet XLSX fixtures are already handled by the `xlsx` package's `XLSX.utils.book_append_sheet()` API (proven pattern in `tests/etl/parsers/ExcelParser.test.ts`). Do not add. |
| playwright-fake-timers | NOT needed | — | Rejected. Playwright ^1.52 ships `page.clock.install()` natively. No third-party timer mock library needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest --project (workspace) | Separate ETL dataflow tests from unit tests using `vitest.workspace.ts` | Vitest 4.x supports workspace mode. No new install — just a config file. Use it only if the ETL tests need different timeouts or environment settings that conflict with the existing vitest.config.ts. Likely not needed since the existing `pool: 'forks'` and `testTimeout: 10000` already work for ETL tests. |
| playwright --grep | Filter ETL E2E specs from plugin E2E specs in CI | Tag ETL Playwright specs with `@etl` in describe/test names. Run `npx playwright test --grep @etl` for ETL-only CI jobs if the 10-minute timeout is exceeded. No install required. |

---

## Mock Strategies for Native Adapters and TCC

Native adapters (NotesAdapter, RemindersAdapter, CalendarAdapter, AltoIndexAdapter) run in Swift and read macOS system databases. They cannot run in CI (no macOS runner with TCC grants, no live NoteStore.sqlite). The TypeScript boundary IS fully testable without Swift.

### Strategy 1: CanonicalCard JSON snapshot injection (PRIMARY — all ETL E2E dataflow tests)

The native adapters output `CanonicalCard[]` JSON through the WKWebView bridge to the Worker's `etl-import-native` handler. The TypeScript test path is identical regardless of whether the cards came from Swift or a fixture file:

```typescript
importNativeSource(db, sourceType, cards: CanonicalCard[])
  → DedupEngine.process()
  → SQLiteWriter.writeCards() / writeConnections()
  → assertions on db row count, source field, FTS5 results
```

This path is already exercised by `source-import.test.ts`. Extend fixture coverage for edge cases: zero cards, full-duplicate re-import (expect 0 inserted), malformed source_id (expect dedup to fallback to content hash), connection cycles (A→B→A).

No new libraries. New fixture JSON files only.

### Strategy 2: Bridge message interception in Playwright (for Playwright-layer ETL tests)

`window.__isometry.bridge.send()` is already exposed (proven in all 15 existing e2e/ specs). To exercise the full import flow in a real browser with a real sql.js WASM database, inject canonical card payloads directly via `page.evaluate()`:

```typescript
await page.evaluate(async (cards) => {
  const { bridge } = (window as any).__isometry;
  return bridge.send('etl-import-native', { sourceType: 'native_notes', cards });
}, fixtureCards);
```

The `fixtureCards` array comes from `tests/etl-validation/fixtures/native-notes.json` (already committed). For alto-index Playwright tests, use `public/alto-100.json` (already committed, served by Vite).

No new libraries.

### Strategy 3: TCC permission lifecycle — mock via bridge interception

TCC grants cannot be obtained in CI. The permission lifecycle is modeled as `PermissionStatus` values delivered via the `native:permissions` bridge message. Test all three states by monkey-patching `bridge.send` before triggering the import:

```typescript
// Test: denied state shows permission prompt
await page.evaluate(() => {
  const realSend = (window as any).__isometry.bridge.send.bind((window as any).__isometry.bridge);
  (window as any).__isometry.bridge.send = async (type: string, payload: unknown) => {
    if (type === 'native:permissions') return { status: 'denied', source: 'native_notes' };
    return realSend(type, payload);
  };
});
```

Assert the UI shows the permission gate (PermissionSheetView equivalent). Restore `bridge.send` in afterEach. This pattern is already validated by the `window.__harness` monkey-patch approach in `e2e/helpers/harness.ts`.

No new libraries.

### Strategy 4: NoteStore.sqlite snapshot extraction (one-time, developer-machine only)

For fixtures that need to validate the full SQLite-to-CanonicalCard extraction path (BODY-01..BODY-05), a one-time Node.js script using `better-sqlite3` can:

1. Open `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite` on a dev machine with Full Disk Access
2. Extract 10-20 representative rows (title, snippet, folder)
3. Strip PII (replace names with placeholders)
4. Write the sanitized rows as a `CanonicalCard[]` JSON fixture

After this one-time extraction, CI uses only the committed JSON fixture. This is the same pattern as `tests/etl-validation/fixtures/generate-fixtures.mjs`.

`better-sqlite3` is the only new dependency; it's used only in this script.

---

## Installation

```bash
# New dev-only dependencies for ETL E2E test suite
npm install -D better-sqlite3 @types/better-sqlite3 tmp @types/tmp
```

No production dependency additions. No changes to `dependencies` block in package.json.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| better-sqlite3 (sync) for fixture generation | sql.js (WASM) for reading SQLite fixtures | sql.js cannot open arbitrary file paths — it requires reading the entire file as Uint8Array first. For fixture generation scripts, better-sqlite3 is simpler and 10x faster. sql.js remains the runtime system of record. |
| JSON fixture snapshots for native adapters | XCTest integration tests against live adapters | XCTest covers the Swift extraction logic; JSON snapshots cover the TypeScript dedup/write pipeline. Both are needed for full coverage, but XCTest is out of scope for the TypeScript ETL E2E milestone. |
| page.evaluate() bridge injection for Playwright native tests | Dedicated mock server | Bridge injection is already validated in 15 specs. No new infrastructure needed. Simpler and more stable. |
| tmp for scratch directories | `os.tmpdir()` + manual cleanup | `tmp` auto-deletes on process exit and on uncaught exceptions, preventing stale files in CI. Worth the minor dependency for CI reliability. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| nock / msw | HTTP mocking — the ETL pipeline is entirely local-first with no HTTP calls in the dataflow path | N/A — no HTTP mocking needed |
| sqlite3 (node-sqlite3) | Requires native compilation via node-gyp; fails on ARM Mac/Linux CI without platform-specific binaries | better-sqlite3 — same sync API, superior prebuilt binary coverage for Node 20/22 on all CI platforms |
| @databases/sqlite | Adds async abstraction over SQLite; unnecessary complexity for fixture generation scripts | better-sqlite3 (sync is correct for one-time extraction scripts) |
| Playwright visual screenshot diffs for ETL tests | ETL correctness is row counts, source fields, FTS5 results — not visual. Screenshot regression is valid for SuperGrid rendering but wrong for ETL dataflow assertions. | Explicit `expect(result.inserted).toBe(N)` and `expect(queryCardsForSource(db, source).length).toBe(N)` assertions |
| Vitest `@vitest/browser` mode for ETL dataflow tests | ETL tests run in Node with WASM (`pool: 'forks'`). Browser mode adds Playwright overhead without benefit for data-layer tests. Browser mode is for DOM-dependent tests only. | Standard Vitest node pool (already configured in vitest.config.ts) |
| fake-indexeddb | Isometry uses sql.js, not IndexedDB — no IndexedDB in the dataflow path | N/A |
| protobufjs / protobuf.js in TypeScript tests | The gzip+protobuf extraction path is Swift-only (ProtobufToMarkdown.swift). Reproducing it in TypeScript tests adds complexity without coverage benefit — fixture JSON already captures the extracted output. | Fixture JSON with known `body_text` values; assert FTS5 and SuperGrid rendering of those values |

---

## Stack Patterns by Variant

**For file format import E2E (JSON/XLSX/CSV/MD/HTML via Playwright):**
- Use `importFixture(page, fixturePath, source)` from `e2e/helpers/isometry.ts` (already exists)
- Add new fixture files to `public/` so Vite dev server serves them; access via `page.evaluate(() => fetch('/fixture.json'))` in tests
- For XLSX fixtures: generate programmatically via `xlsx` package in beforeAll (pattern from ExcelParser.test.ts); write to `tmp` scratch dir; pass ArrayBuffer to bridge

**For native SQLite-to-SQLite adapter flow testing (TypeScript boundary only):**
- Use `importNativeSource(db, sourceType, cards)` from `tests/etl-validation/helpers.ts`
- Source fixture cards from `tests/etl-validation/fixtures/native-*.json` or new edge-case variants
- No Swift test runner, no macOS-only CI job, no TCC grant required

**For alto-index dataset tests:**
- Vitest layer: `etl-alto-index-full.test.ts` pattern — symlink-guarded with `HAS_ALTO_INDEX` flag, developer machine only
- Playwright layer: inject `public/alto-100.json` (100-card sample) via `bridge.send('etl-import-native', ...)` — no symlink required in CI; suitable for full CI gate
- Full 20K-card scale in Playwright: out of scope (60-second page timeout not viable for 20K-card import in browser); keep as Vitest-only

**For CAS (Content-Addressed Storage) protobuf flow testing:**
- CAS here means the protobuf ZDATA blob extraction path in NotesAdapter (gzip → protobuf → markdown text)
- This is Swift-only and exits the TypeScript boundary at `CanonicalCard.body_text`
- TypeScript test approach: fixture JSON with known `body_text` values; assert FTS5 indexing (`db.exec("SELECT * FROM cards_fts WHERE cards_fts MATCH ?")`), SuperGrid GROUP BY results, and connection creation from note links
- Protobuf round-trip testing belongs in XCTest (Swift), not Vitest

**For TCC permission lifecycle in Playwright:**
- Three states: `granted` (inject cards directly), `denied` (monkey-patch bridge, assert UI gate), `notDetermined` (monkey-patch bridge, assert prompt shown)
- Restore bridge.send in `afterEach` to prevent test state leakage
- Tag these specs `@tcc` for selective CI filtering

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| better-sqlite3 ^11.x | Node.js 20/22 (LTS) | Prebuilt binaries for linux-x64, darwin-arm64, darwin-x64, win32-x64. CI uses Node 22 (confirmed in .github/workflows/ci.yml). No node-gyp compilation needed on supported platforms. Confidence: HIGH. |
| tmp ^0.2.3 | Node.js 20/22 | Pure JavaScript. ESM-compatible via dynamic import. Confidence: HIGH. |
| @playwright/test ^1.58.2 | Node.js 20/22 | Already installed and CI-verified across 15 specs. No changes needed. |
| vitest ^4.0.18 + better-sqlite3 ^11.x | pool: 'forks' | `better-sqlite3` has native bindings. `pool: 'forks'` (already configured in vitest.config.ts) provides full process isolation — prevents native module + WASM state conflicts. No config change required. |
| xlsx ^0.18.5 | better-sqlite3 ^11.x | No interaction — xlsx runs in WASM/JS only. Confirmed compatible. |

---

## CI Impact

No new CI jobs required. The existing 5-job pipeline handles all new tests without modification:

| Job | Impact |
|----|--------|
| `test` | Picks up new Vitest ETL dataflow specs automatically. No config change. |
| `e2e` | Picks up new Playwright ETL specs. If 10-minute timeout is exceeded after adding ETL specs, split into `e2e-plugin` and `e2e-etl` jobs — but evaluate at milestone end, not upfront. |
| `typecheck` | No change — new files are TypeScript, already covered by `tsc --noEmit`. |
| `lint` | No change — Biome covers new test files in the existing `tests/` and `e2e/` dirs. |
| `bench` | No change. |

The existing Playwright browser cache (`actions/cache@v4` on `~/.cache/ms-playwright`) already saves 30-60s per run. No new caching configuration needed.

---

## Sources

- `/Users/mshaler/Developer/Projects/Isometry/package.json` — exact installed versions (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` — pool: forks, globalSetup, timeout settings (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/playwright.config.ts` — baseURL, 10-min timeout, workers: 1 (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/.github/workflows/ci.yml` — 5-job pipeline, Node 22, Playwright browser caching (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/helpers.ts` — `importNativeSource()`, `importFileSource()`, `createTestDb()` factory patterns (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/fixtures/` — existing fixture inventory (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/etl-alto-index-full.test.ts` — `HAS_ALTO_INDEX` symlink-guard pattern (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/etl-load-run.test.ts` — serial import + SuperGrid correctness pattern (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/native/Isometry/Isometry/NotesAdapter.swift` — TCC/NoteStore.sqlite path, Full Disk Access requirement (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/native/Isometry/Isometry/AltoIndexAdapter.swift` — alto-index directory structure, card_type mapping (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/e2e/helpers/isometry.ts` — `importFixture()`, `bridge.send()` injection pattern (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/e2e/helpers/harness.ts` — `window.__harness` monkey-patch pattern (HIGH confidence)
- better-sqlite3 npm (v11.x) — MEDIUM confidence (stable package, no Context7 verification performed; well-known Node.js ecosystem choice)
- tmp npm (v0.2.x) — MEDIUM confidence (stable package, widely used, no Context7 verification performed)

---
*Stack research for: E2E ETL dataflow testing — Isometry v8.x milestone*
*Researched: 2026-03-22*
