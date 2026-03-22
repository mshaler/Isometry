# Project Research Summary

**Project:** Isometry v8.5 — ETL E2E Test Suite
**Domain:** End-to-end dataflow testing for a WASM/Native hybrid ETL pipeline (TypeScript + Swift)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

Isometry's ETL pipeline has two distinct import paths — file-based (6 parsers: JSON, XLSX, CSV, MD, HTML, Apple Notes JSON) and native (3 macOS adapters + AltoIndex) — that converge at a shared DedupEngine + SQLiteWriter + CatalogWriter sink. The existing test suite covers unit-level correctness for each component individually and has 15 Playwright E2E specs for plugin interactions, but has no E2E coverage of the full ETL dataflow from import trigger to verified database state. This milestone fills that gap by adding Vitest seam tests for internal correctness boundaries and Playwright E2E specs for the full file-import and native-import paths.

The recommended approach is a layered strategy that matches assertion type to the cheapest test layer that can express it. Vitest integration tests (using the existing `realDb()` + `makeProviders()` infrastructure) handle dedup classification, FTS indexing, CatalogWriter provenance, and auto-connection synthesis — all in-process with no browser overhead. Playwright tests are reserved for full-pipeline proofs: file upload through the DataExplorer UI panel, native card injection via `window.__isometry.receive()`, database state verification via `bridge.queryAll()`, and TCC permission response paths. The only new dependencies are `better-sqlite3` (dev-only fixture generation scripts) and `tmp` (isolated scratch directories for binary fixture files in CI).

The primary risks are environmental and behavioral: the sql.js WASM runtime cannot coexist with `@vitest-environment jsdom` in the same test file (causing silent hangs); native macOS adapters cannot run in CI without TCC grants (requiring fixture injection at the Swift/JS bridge boundary); and Playwright async import completion must be polled via `expect.poll()` rather than `waitForTimeout` (the Phase 107 discipline). The alto_index adapter's purge-then-replace semantics (which unconditionally deletes ALL cards, not just alto_index ones) is a correctness gap that must be tested explicitly. A "Looks Done But Isn't" checklist covering DedupEngine deletion assertions, FTS bulk-path coverage, NoteStore schema version branching, and protobuf fallback tiers must gate milestone completion.

## Key Findings

### Recommended Stack

The existing infrastructure is nearly complete. Vitest 4.x with `pool: 'forks'` already provides WASM isolation. Playwright 1.58.2 with the 5-job CI pipeline handles E2E. The `realDb()`, `makeProviders()`, `importNativeSource()`, `importFileSource()` factories and 100+ card fixture files are already committed. The only net-new additions are `better-sqlite3 ^11.10.0` (Node.js synchronous SQLite binding for one-time NoteStore.sqlite fixture-generation scripts on developer machines) and `tmp ^0.2.3` (auto-deleting scratch directories for XLSX binary fixtures in CI). No production dependencies change.

**Core technologies:**
- `vitest ^4.0.18` + `pool: 'forks'`: Unit and integration test runner — WASM isolation via process forks; already configured
- `@playwright/test ^1.58.2`: Chromium E2E automation — already installed and CI-verified across 15 specs
- `realDb()` + `makeProviders()` (tests/harness/): In-memory sql.js factory + wired provider stack — primary harness for Vitest ETL seam tests
- `better-sqlite3 ^11.10.0` (dev-only): Node.js SQLite binding for NoteStore.sqlite fixture-extraction scripts — never ships to production
- `tmp ^0.2.3` (dev-only): Auto-deleted temp directories for binary (XLSX) fixture files in CI beforeAll

**What NOT to use:** nock/msw (no HTTP in the ETL path), sqlite3/node-sqlite3 (requires node-gyp; use better-sqlite3 instead), `waitForTimeout` (use `expect.poll()`), `@vitest/browser` mode for ETL data-layer tests, Playwright visual screenshot diffs for ETL correctness assertions.

### Expected Features

The milestone is a test capability build, not a product feature build. Production code is already shipped; the goal is comprehensive E2E coverage of the ETL dataflow.

**Must have (table stakes — milestone incomplete without these):**
- Per-format import correctness — all 6 file-based parsers via Vitest integration (card count, source tag, required fields non-null)
- Native adapter import correctness — all 3 native adapters (Notes, Reminders, Calendar) via fixture-based bridge injection
- Alto-index subdirectory coverage — all 11 subdirectory types via CI-safe fixtures (not live symlink; live symlink is dev-machine-only)
- Dedup idempotency assertion — double-import via ImportOrchestrator, assert zero net-new cards on second run + explicit `deletedIds` count
- TCC permission flow simulation — grant/deny/revoke response via mock bridge hook (no real OS dialogs)
- Catalog provenance recording — every import run creates correct `import_sources`/`import_runs` rows

**Should have (meaningful signal beyond unit tests):**
- Malformed input error recovery — truncated/corrupt file via Playwright, assert ImportToast error state, no crash
- Export round-trip correctness — Markdown/JSON/CSV field fidelity after full import (pure Vitest, no browser)
- FTS5 searchability post-import — CommandBar search finds cards from each source type
- Cross-format dedup collision detection — same-title cards from two sources remain distinct rows

**Defer (v2+/P3 — marginal return given existing unit coverage):**
- SQLiteWriter batch boundary parametric test (99/100/101/199/200/201 card counts)
- Import throughput budget assertion (bench against 49K cards/s floor)
- CAS content-addressable update test (update-then-reimport asserts same id, updated modified_at)
- Native adapter bridge shape validation (per-adapter normalizeNativeCard() schema assertions)

### Architecture Approach

Two Vitest seam tests and six Playwright E2E spec files form the core deliverable. Vitest seams test internal correctness (CatalogWriter provenance rows, auto-connection synthesis for attendee-of:/note-link: patterns) at the cheapest layer that can express them. Playwright specs prove the full pipeline from import trigger to verified database state, using `bridge.queryAll()` for post-import SQL introspection and `expect.poll()` for async import completion. A `resetDatabase()` helper in `beforeEach` is mandatory for all ETL E2E specs to prevent dedup state bleed between tests.

**Major components (existing, under test):**
1. `ImportOrchestrator` — parse -> dedup -> write -> catalog orchestration (file-based path)
2. `etl-import-native.handler` — CanonicalCard[] intake, auto-connections, purge semantics (native path)
3. `DedupEngine` — source+source_id classification, deletedIds tracking, source-scoped deletion
4. `SQLiteWriter` — batched parameterized writes, FTS trigger path (<500 cards) and bulk rebuild path (>=500 cards)
5. `CatalogWriter` — import_sources + import_runs + datasets provenance (required postcondition in every E2E spec)

**New components (to build this milestone):**
1. `e2e/helpers/etl.ts` — `importNativeCards()`, `assertCatalogRow()`, `resetDatabase()` shared helpers
2. `tests/seams/etl/etl-catalog.test.ts` — CatalogWriter provenance assertions (Vitest)
3. `tests/seams/etl/etl-native-handler.test.ts` — auto-connection synthesis (Vitest)
4. `e2e/etl-*.spec.ts` (6 files) — file import, native import, alto-index, dedup, TCC, catalog (Playwright)
5. `WorkerBridge.importNative()` + `bridge.queryAll()` — new bridge methods if not already present

### Critical Pitfalls

1. **WASM/jsdom environment mismatch** — Never annotate `@vitest-environment jsdom` on any test file that calls `realDb()`. The WASM binary cannot load under jsdom and hangs silently with no error. Keep ETL pipeline tests in `environment: 'node'`; use Playwright for any test that needs both DB state and DOM assertions.

2. **Playwright `waitForTimeout` instead of `expect.poll()`** — Zero tolerance for `waitForTimeout` in any E2E spec (Phase 107 discipline). Worker import is async; poll `window.__isometry.getCardCount()` via `expect.poll()` until the expected count is reached. `waitForTimeout` produces 10-15% flakiness under CI load.

3. **DedupEngine deletion assertions skipped** — Every re-import test must assert `deletedIds.length === N` for a known N, not just `result.inserted > 0`. Deletion is a first-class DedupEngine behavior and the most commonly skipped assertion. Requires fixture pairs: one "initial import" file and one "re-import with N deletions" file.

4. **Alto_index purge-then-replace deletes ALL cards** — The `etl-import-native.handler` runs `DELETE FROM cards; DELETE FROM connections` before processing alto_index — not just alto_index rows, ALL rows. E2E tests must seed non-alto_index cards first, then verify they are deleted after an alto_index import. This is the confirmed production behavior and must be explicitly tested.

5. **Native adapter TCC permissions block CI** — Never call real `NotesAdapter`, `RemindersAdapter`, or `CalendarAdapter` in any automated test. The adapters return an empty AsyncStream on permission failure (not an exception), so tests see 0 cards and pass if the assertion is `cards.count >= 0`. Use fixture-based injection at the `native:action` bridge boundary for all native adapter E2E tests.

6. **FTS5 bulk path (>500 cards) gap** — Every source's E2E test suite must include at least one test that generates 501+ cards and uses `isBulkImport=true`, then asserts FTS searchability. Small fixtures (10-50 cards) only exercise the trigger path and miss bulk-path `fts_rebuild()` regressions.

## Implications for Roadmap

Based on combined research, the work naturally organizes into four phases ordered by dependency: infrastructure first, then Vitest seam correctness, then Playwright E2E coverage, then completeness hardening.

### Phase 1: ETL Test Infrastructure Setup
**Rationale:** All subsequent work depends on: (a) the `better-sqlite3`/`tmp` dev dependencies being installed, (b) `e2e/helpers/etl.ts` with `importNativeCards()`, `assertCatalogRow()`, and `resetDatabase()` helpers, (c) `WorkerBridge.importNative()` and `bridge.queryAll()` being exposed on `window.__isometry`, and (d) CI-safe alto-index per-subtype fixtures authored. The WASM/jsdom environment boundary rule must also be documented and enforced before any test files are written.
**Delivers:** Harness extensions, bridge API additions, alto-index fixture set (11 subdirectory types), and environment boundary rule
**Addresses:** Alto-index subdirectory coverage (prerequisite fixture authoring)
**Avoids:** WASM/jsdom environment mismatch (rule established upfront), `waitForTimeout` anti-pattern (import-completion polling API defined in this phase)

### Phase 2: Vitest ETL Seam Tests
**Rationale:** In-process seam tests run in milliseconds and provide the fastest feedback loop. They must come before Playwright specs because they verify the internal correctness properties (CatalogWriter rows, auto-connection synthesis, DedupEngine deletedIds) that E2E specs will implicitly depend on. If these seams are broken, E2E specs produce misleading results.
**Delivers:** `tests/seams/etl/etl-catalog.test.ts` + `tests/seams/etl/etl-native-handler.test.ts` + dedup re-import fixture pairs
**Uses:** `realDb()`, `makeProviders()`, `DedupEngine`, `SQLiteWriter`, `CatalogWriter` (all existing)
**Avoids:** DedupEngine deletion assertions gap, CatalogWriter silent failure, auto-connection synthesis untested

### Phase 3: Playwright ETL E2E Coverage
**Rationale:** With infrastructure and seam correctness established, Playwright specs can be written against a trusted foundation. The 6 spec files cover the full pipeline from UI trigger to database state: file import (6 sources), native import (3 adapters), alto-index (11 subtypes), dedup idempotency, TCC permission response, and catalog provenance. Each spec uses `resetDatabase()` in `beforeEach` and `expect.poll()` for async completion.
**Delivers:** `e2e/etl-file-import.spec.ts`, `e2e/etl-native-import.spec.ts`, `e2e/etl-alto-index.spec.ts`, `e2e/etl-dedup.spec.ts`, `e2e/etl-tcc-permission.spec.ts`, `e2e/etl-catalog-provenance.spec.ts`
**Uses:** `importNativeCards()`, `assertCatalogRow()`, `resetDatabase()` from Phase 1; `expect.poll()` pattern
**Avoids:** Alto_index purge-all behavior (explicitly tested), native adapter TCC pitfall (fixture injection), `waitForTimeout` (banned)

### Phase 4: Completeness Hardening + P2 Coverage
**Rationale:** After P1 features pass, add the P2 features that provide meaningful signal beyond unit tests: malformed input error recovery (Playwright), export round-trip correctness (Vitest), FTS5 searchability post-import (Playwright CommandBar), and cross-format dedup collision detection. Also execute the "Looks Done But Isn't" checklist to gate milestone completion.
**Delivers:** Malformed input Playwright spec, export round-trip Vitest test, FTS searchability per-source assertions, cross-format dedup collision test, completed "Looks Done But Isn't" checklist
**Avoids:** FTS bulk path gap (501+ card test per source), NoteStore schema version branching gap, protobuf fallback tier coverage gap

### Phase Ordering Rationale

- Infrastructure before tests: `bridge.queryAll()` and `resetDatabase()` are required by all E2E specs; if added mid-stream, earlier specs must be retrofitted.
- Vitest seams before Playwright: In-process correctness is cheaper to debug than browser-layer failures. A broken CatalogWriter is easier to diagnose via a failing seam test than a failing Playwright assertion on import_runs count.
- Alto-index fixtures in Phase 1 not Phase 3: The 11 subdirectory fixture set is the highest-effort prerequisite. It blocks all alto-index Playwright tests and should be done once as a batch, not incrementally across phases.
- P2 hardening last: Malformed input, export round-trip, and FTS searchability tests are meaningful but do not block the P1 milestone definition. Defer to avoid blocking the core coverage phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Infrastructure):** `bridge.queryAll()` and `WorkerBridge.importNative()` may already exist under different names — verify exact API surface against current `src/worker/WorkerBridge.ts` before designing new methods.
- **Phase 1 (Infrastructure):** Alto-index 11 subdirectory type fixture authoring requires reviewing `AltoIndexAdapter.swift` for the exact card_type and field mappings per subdir to ensure fixtures are schema-accurate.
- **Phase 3 (TCC permission spec):** The `__mockPermission` bridge hook does not yet exist in HarnessShell — its design (monkey-patch vs. dedicated hook) needs a decision before the spec can be written.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Vitest seams):** Pattern is identical to existing `tests/seams/etl/etl-fts.test.ts`. No new patterns needed.
- **Phase 4 (P2 hardening):** Export round-trip and FTS searchability follow established Vitest/Playwright patterns. No novel infrastructure required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All existing packages verified against package.json and CI config. Only two new deps (better-sqlite3, tmp) are well-known, stable packages with prebuilt binaries for Node 20/22. |
| Features | HIGH | Feature scope derived entirely from direct codebase inspection of existing ETL infrastructure, fixture inventory, and shipped production code. Priority matrix is grounded in existing test patterns, not speculation. |
| Architecture | HIGH | All component boundaries and data flow verified via direct inspection of handler source files, WorkerBridge, and existing E2E helper patterns. The alto_index purge-all behavior is a confirmed production behavior, not inferred. |
| Pitfalls | HIGH | All 8 pitfalls derived from this codebase's own prior phase summaries (Phase 104, 107), production bugs found during v8.3 E2E writing, and direct inspection of the WASM config, Playwright config, and DedupEngine source. |

**Overall confidence:** HIGH

### Gaps to Address

- **`bridge.queryAll()` existence:** The architecture assumes this method will be added to WorkerBridge for test introspection. Verify it does not already exist under a different name before implementing. If it does, Phase 1 scope shrinks.
- **`WorkerBridge.importNative()` existence:** Architecture assumes this is a new method. The existing `bridge.send('etl-import-native', ...)` pattern may be sufficient without a typed wrapper — verify before designing the new method.
- **Alto_index purge-all correctness:** ARCHITECTURE.md flags that `etl-import-native.handler` deletes ALL cards before alto_index processing, not just alto_index ones. Confirm via production code inspection before writing the E2E test, as the expected behavior determines the assertion.
- **NoteStore schema version fixture creation:** Requires developer-machine work (Full Disk Access grant, better-sqlite3 extraction script) and is out of scope for CI. Fixture generation process should be documented as a release checklist item for OS version bumps.

## Sources

### Primary (HIGH confidence)
- `tests/etl-validation/` codebase — existing ETL test patterns, fixture inventory, importNativeSource/importFileSource factories
- `tests/harness/realDb.ts`, `tests/harness/makeProviders.ts` — WASM factory, wired provider stack
- `src/worker/handlers/etl-import.handler.ts`, `etl-import-native.handler.ts` — confirmed data flow and alto_index purge semantics
- `src/etl/ImportOrchestrator.ts`, `DedupEngine.ts`, `SQLiteWriter.ts`, `CatalogWriter.ts` — component boundaries and responsibilities
- `e2e/helpers/isometry.ts`, `e2e/helpers/harness.ts` — bridge injection and monkey-patch patterns
- `playwright.config.ts`, `.github/workflows/ci.yml` — CI topology (ubuntu-latest, 5 jobs, 10-min E2E timeout)
- `native/Isometry/Isometry/NotesAdapter.swift`, `PermissionManager.swift` — TCC gate, schema version branching, three-tier fallback
- `vitest.config.ts` — `environment: 'node'`, `pool: 'forks'`, WASM isolation configuration
- Phase 104 + 107 SUMMARY.md files — production bugs found during E2E writing, `waitForTimeout` ban, `expect.poll()` discipline

### Secondary (MEDIUM confidence)
- better-sqlite3 npm v11.x — stable package, prebuilt binaries for Node 20/22; no Context7 verification performed but well-known ecosystem choice
- tmp npm v0.2.x — stable package, widely used; no Context7 verification performed

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
