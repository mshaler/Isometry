# Pitfalls Research

**Domain:** ETL E2E Test Suite — WASM/Native hybrid TypeScript+Swift app
**Researched:** 2026-03-22
**Confidence:** HIGH (derived from this codebase's own prior phase summaries, production bugs found, and established patterns)

---

## Critical Pitfalls

### Pitfall 1: WASM Environment Mismatch Between Vitest Configs

**What goes wrong:**
Tests that use sql.js WASM pass under `environment: 'node'` but fail (or hang silently) when any test file uses `@vitest-environment jsdom`. The WASM binary cannot be loaded by jsdom's browser emulation — it requires the Node WASM API. When a test file mixes concerns (e.g., both a sql.js realDb() call and a DOM assertion), the entire file fails at WASM init with an opaque `WebAssembly.instantiate` rejection or a silent hang.

**Why it happens:**
The global vitest.config.ts already pins `environment: 'node'` and `pool: 'forks'` for WASM isolation. Developers adding ETL E2E tests that also need DOM (e.g., testing that imported cards render in a view) try to add `@vitest-environment jsdom` to the same file, breaking WASM. The v6.1 seam test pattern uses `@vitest-environment jsdom` only for pure UI tests — never for database tests.

**How to avoid:**
Never mix sql.js realDb() and DOM operations in the same test file. ETL pipeline tests (parse → dedup → write → FTS) stay in `environment: 'node'` with no jsdom annotation. View-rendering assertions after import must be separate test files with their own environment annotation. If a test genuinely needs both, use the Worker Bridge integration path (Playwright E2E) rather than Vitest.

**Warning signs:**
- Test file has both `import { realDb }` and `document.querySelector` in the same file
- WASM init hangs with no error output
- `WebAssembly is not defined` in test output after adding `@vitest-environment jsdom`

**Phase to address:**
Phase establishing ETL E2E test infrastructure — define the file organization boundary rule before any test files are written.

---

### Pitfall 2: Native Adapter Testing Requires OS-Level Permissions That CI Cannot Grant

**What goes wrong:**
NotesAdapter reads `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`, RemindersAdapter uses EventKit, and CalendarAdapter uses EventKit — all gated by TCC (Transparency, Consent, and Control). On macOS CI (ubuntu-latest in this repo, or even macOS GitHub runners), these paths either do not exist or are read-protected. Tests that call `adapter.fetchCards()` directly will fail with permission errors or empty results, silently making the entire pipeline look like it produced zero cards rather than raising an explicit test failure.

**Why it happens:**
The native adapters' `checkPermission()` method returns `.denied` or `.notDetermined` when the path is unreadable — but tests rarely check the permission status before calling `fetchCards()`. The adapter returns an empty `AsyncStream` on permission failure rather than throwing, so the test sees `0 cards imported` and passes if the assertion is `cards.count >= 0`.

**How to avoid:**
Never call the real `NotesAdapter`, `RemindersAdapter`, or `CalendarAdapter` in any automated test. The correct pattern is already established: `MockAdapter.swift` exists for a reason. Use dependency injection at the `NativeImportCoordinator` level — inject a `MockAdapter` that yields pre-canned `CanonicalCard[]` JSON. Test the adapter contract (AsyncStream batch yielding, 200-card chunk dispatch) using the mock. Test the real SQL schema and body extraction logic in isolation using a copy of a sanitized NoteStore.sqlite fixture.

**Warning signs:**
- Test calls `adapter.fetchCards()` without first asserting `checkPermission() == .granted`
- CI produces `0 cards imported` for all native source tests
- XCTest passes locally but fails on any CI runner that lacks Full Disk Access

**Phase to address:**
Native adapter fixture and mock design phase — establish MockAdapter injection pattern before writing any Swift integration tests.

---

### Pitfall 3: NoteStore.sqlite Schema Version Branching Is Untested

**What goes wrong:**
`NotesAdapter` already has schema version detection (`PRAGMA table_info` branching for `ZTITLE1` vs `ZTITLE2`, `ZCREATIONDATE3` vs `ZCREATIONDATE`). E2E tests that use a single fixture NoteStore.sqlite copy only exercise one schema branch. Tests pass on the developer's macOS version but fail for users on older or newer OS versions where the column names differ. The schema branch that is NOT exercised in tests silently breaks.

**Why it happens:**
Developers capture one copy of NoteStore.sqlite from their own machine for the fixture. This represents exactly one schema version. The `ZTITLE1`/`ZTITLE2` split exists precisely because Apple changed the column name — but there is only one fixture to test against.

**How to avoid:**
Create at minimum two fixture NoteStore.sqlite files — one per known schema variant (macOS 13 schema and macOS 14+ schema). Run the adapter extraction logic against both. The fixtures should be minimal sanitized copies (5-10 notes max, no real personal data) created by hand or by running a schema-creation SQL script that mirrors the known column layouts. Store in `tests/fixtures/native/notestore/` with explicit OS version in the filename.

**Warning signs:**
- Only one `NoteStore.sqlite` fixture file in the test directory
- `PRAGMA table_info` branch logic is unreachable from any test
- Adapter returns empty results on macOS 13 but works on macOS 14

**Phase to address:**
Fixture management phase — define fixture naming convention and multi-schema coverage requirement before implementing NoteStore extraction tests.

---

### Pitfall 4: DedupEngine Source-Scoped Deletion Produces False Positives on Re-Import

**What goes wrong:**
DedupEngine computes `deletedIds` as cards present in the DB for a source type but absent from the incoming batch. When an E2E test imports a partial fixture (e.g., 10 of the 20 notes in the fixture), then re-imports the same partial fixture, the engine correctly identifies 0 deletions. But if the test then imports a different fixture for the same source type (e.g., a "re-import with deletions" fixture that has 8 notes instead of 10), the engine marks 2 cards as deleted — which is correct behavior but tests often fail to assert it, accepting any non-error result as a pass.

**Why it happens:**
E2E tests for the full pipeline (parse → dedup → write) typically assert `result.inserted > 0` and `result.errors === 0`. They do not assert the `deletedIds` field. When a re-import fixture is used, the deletion behavior is the most important correctness guarantee — but it is the most commonly skipped assertion because it requires setting up prior DB state before the test.

**How to avoid:**
Each re-import E2E test must explicitly assert the `deletedIds` count. The test setup must insert the "prior state" cards into the real db (via realDb() + SQLiteWriter) before calling ImportOrchestrator. The fixture pair pattern: one "initial import" fixture and one "re-import with N deletions" fixture — both checked into `tests/fixtures/etl/{source}/` with matching names (e.g., `apple-notes-initial.json` and `apple-notes-reimport-2-deleted.json`).

**Warning signs:**
- DedupEngine tests only assert `toInsert.length` and `toUpdate.length`, never `deletedIds.length`
- No test calls `engine.process()` with pre-seeded database state
- Re-import fixtures are identical to initial import fixtures

**Phase to address:**
DedupEngine E2E coverage phase — add explicit re-import and deletion assertion tests.

---

### Pitfall 5: FTS5 Trigger vs Bulk Import Path Coverage Gap

**What goes wrong:**
SQLiteWriter has two code paths: trigger path (`writeCards(cards, false)` — each INSERT fires `cards_fts_ai` trigger) and bulk path (`writeCards(cards, true)` — disables triggers, rebuilds FTS index). Tests commonly exercise only the trigger path because it is the default and requires fewer cards. The bulk path (>500 cards) is only exercised if the test explicitly generates a large card set. If the bulk path's `fts_rebuild()` call is broken, every import of >500 cards silently produces an FTS index that does not include the bulk-imported cards.

**Why it happens:**
Developers write ETL E2E tests with small fixture sizes (10-50 cards) because they are faster to author and run. The `isBulkImport=true` threshold is 500 cards. No test will naturally hit the bulk path unless it explicitly generates 501+ cards.

**How to avoid:**
Every ETL source's E2E test suite must include at minimum one test that generates exactly 501+ cards and asserts FTS searchability of a card inserted in the bulk batch. The `etl-fts.test.ts` seam test (EFTS-02b) already does this for the generic case — but each source-specific test suite must include a source-typed bulk import test as well. The fixture file for bulk testing can use a generator function rather than a static JSON file.

**Warning signs:**
- Largest fixture file for any source is under 500 cards
- `isBulkImport=true` code path has 0 source-specific test coverage
- FTS tests all use `writeCards(cards, false)` explicitly

**Phase to address:**
Source-specific ETL pipeline tests — add bulk threshold coverage requirement to the test plan.

---

### Pitfall 6: Playwright E2E Tests Use `waitForTimeout` Instead of `expect.poll()`

**What goes wrong:**
ETL E2E tests that drive import through the Playwright harness and then assert that cards appear in the grid use `page.waitForTimeout(2000)` to wait for WASM import to complete. This makes tests slow (fixed wait regardless of actual speed), brittle (if WASM is slow in CI the wait may not be long enough), and violates the E2E-04 discipline established in Phase 107 (`zero waitForTimeout`). Tests that use `waitForTimeout` fail flakily in CI at roughly 10-15% rate when the ubuntu runner is under load.

**Why it happens:**
WASM import is asynchronous and does not produce a synchronous DOM signal when complete. Developers who do not know the `expect.poll()` pattern fall back to `waitForTimeout`. The `expect.poll()` pattern polls a condition function until it passes or times out — it is strictly superior.

**How to avoid:**
All async DOM assertions in Playwright specs use `expect.poll()`. The import completion signal must be surfaced as a DOM attribute or `window.__isometry` state that `expect.poll()` can query. For ETL E2E tests: after triggering an import, poll `window.__isometry.getCardCount()` until it equals the expected count, then assert card content. Never write `waitForTimeout` in any spec file.

**Warning signs:**
- Any occurrence of `waitForTimeout` in `e2e/` directory
- Import completion tested with a fixed delay rather than a condition
- Tests that pass locally but fail intermittently in CI

**Phase to address:**
Playwright ETL E2E harness phase — define the import-completion polling API on `window.__isometry` before writing import specs.

---

### Pitfall 7: Content-Addressable Storage (CAS) Hash Collisions Not Tested

**What goes wrong:**
If the system uses a content-addressable hash (e.g., for deduplication of attachment blobs or for the source_id generation strategy), E2E tests that only use distinct fixture data never exercise hash collision behavior. Two different notes with identical content would produce the same hash and be incorrectly deduplicated. Tests pass because no fixture intentionally creates a collision scenario.

**Why it happens:**
Fixture data is always authored to be meaningfully distinct (different titles, different content). Hash collision scenarios require intentional construction: two cards with identical `content` but different `source_id` (e.g., the same note copy-pasted into two folders). This is not a natural outcome of fixture authoring.

**How to avoid:**
Add at minimum one fixture per source type that contains two cards with identical content fields but different source IDs. Assert that the DedupEngine produces two distinct `toInsert` entries (not one). If the system uses CAS hashing for dedup, also add a test that creates a deliberate hash collision and verifies the tie-breaking behavior (source_id wins over content hash).

**Warning signs:**
- No fixture contains two cards with identical `content` values
- DedupEngine documentation references content hashing but no tests exercise hash-equality cases
- `sourceIdMap` collision behavior is undocumented and untested

**Phase to address:**
DedupEngine correctness phase — add collision and identity-boundary tests before integration tests depend on dedup being correct.

---

### Pitfall 8: Protobuf Extraction Fallback Tiers Untested in Pipeline

**What goes wrong:**
`NotesAdapter` uses a three-tier fallback for note body extraction: (1) gzip+protobuf ZDATA parse, (2) ZSNIPPET plain text, (3) empty string. E2E tests that use a NoteStore fixture with well-formed ZDATA blobs only exercise tier 1. Tier 2 and tier 3 fallback paths — which handle corrupted or missing protobuf data — are never triggered in automated tests. If tier 2 or tier 3 is broken (e.g., ZSNIPPET column name changes), the adapter silently returns empty content for affected notes.

**Why it happens:**
Constructing a minimal NoteStore.sqlite with a deliberately malformed ZDATA blob is nontrivial. Developers skip this because the happy path (well-formed ZDATA) is easy to test with a real fixture copy.

**How to avoid:**
Create fixture NoteStore.sqlite entries with: (a) a valid ZDATA blob (tier 1), (b) a null or malformed ZDATA with a valid ZSNIPPET (tier 2), (c) both null (tier 3). This requires manually constructing SQLite rows in the fixture via the SQLite3 CLI. Assert that cards produced from each tier have the expected `content` field value (or null for tier 3).

**Warning signs:**
- All NoteStore fixture rows have valid ZDATA blobs
- No XCTest asserts `ProtobufToMarkdown` fails gracefully on malformed input
- `content` field is never null in any test-produced card from the native notes adapter

**Phase to address:**
NoteStore extraction correctness phase — require all three fallback tiers to have fixture coverage.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline `makeCard()` factory duplicated across test files | No shared dependency setup | Factory drift — 17+ files define slightly different default shapes; schema changes require 17 updates | Never — use shared factory in `tests/harness/` |
| Real `db.run()` SQL in test setup instead of seeding via `SQLiteWriter` | Full control of initial state | Tests bypass the writer's FTS trigger logic, meaning FTS state may not match what production creates | Only when explicitly testing raw SQL behavior |
| Single NoteStore.sqlite fixture covering one OS version | Easier fixture creation | Silent failure on macOS versions with different column names | Never for schema-version-branched code |
| Asserting only `result.inserted > 0` without checking `deletedIds` | Simpler test authorship | Deletion logic goes untested; silent regressions in re-import correctness | Never — deletion is a first-class DedupEngine behavior |
| `waitForTimeout` for async import completion in Playwright | Quickly written | Flaky CI (10-15% failure rate under load), slow test suite | Never — use `expect.poll()` |
| Using `MockAdapter` without verifying it matches real adapter output shape | Decoupled from OS permissions | Mock drift — MockAdapter and real adapter diverge; tests pass but production fails | Acceptable only if mock is generated from real adapter output at fixture creation time |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| sql.js WASM + Vitest | Adding `@vitest-environment jsdom` to ETL test files that use `realDb()` | Keep ETL tests in `environment: 'node'`; use Playwright for cross-layer (DB + DOM) assertions |
| NativeImportCoordinator + XCTest | Calling `adapter.fetchCards()` without checking permission | Always assert `checkPermission() == .granted` or inject `MockAdapter` |
| DedupEngine + ImportOrchestrator | Testing import without pre-seeding DB state for re-import tests | Use `realDb() + SQLiteWriter.writeCards()` in `beforeEach` to establish prior state |
| FTS5 + bulk import | Writing 501 cards to test FTS but using trigger path (`isBulkImport=false`) | Explicitly pass `isBulkImport=true` when card count exceeds threshold |
| Protobuf extraction + NoteStore fixture | Using a real personal NoteStore.sqlite as a test fixture | Create synthetic NoteStore.sqlite with known schema via SQLite3 CLI; no real personal data |
| CloudKit sync + ETL round-trip | Testing CloudKit sync with the same DB that ran imports | Use isolated DB per test; CloudKit sync state is global to the app, not per-test |
| Playwright + PivotGrid overlay | Using `.click()` on overlay child elements | Use `page.evaluate()` + programmatic `PointerEvent` dispatch (established in Phase 107) |
| Worker bridge + ETL | Asserting card count immediately after sending import message to Worker | Poll `window.__isometry.getCardCount()` via `expect.poll()` — Worker is async |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating large card fixtures inline in test | Slow test suite (10-30s per file) | Pre-generate fixtures as JSON files checked into repo; load with `fs.readFileSync` | Any fixture over 1,000 cards generated inline |
| `realDb()` called in `describe()` block rather than `beforeEach()` | WASM state leaks between tests; later tests see residual data | Always call `realDb()` in `beforeEach()` and `db.close()` in `afterEach()` | Any test that mutates DB state |
| Running 11+ full ETL pipeline tests without `pool: 'forks'` | Tests share WASM heap; one test's write is visible to another | vitest.config.ts already sets `pool: 'forks'` — do not override this in test files | Any test file that manually imports and instantiates sql.js |
| Playwright ETL tests that start a dev server per test file | 5-10s startup per spec file | Use `webServer` config in `playwright.config.ts` to start once; all specs reuse one server | More than 3 Playwright spec files |
| Asserting card count without waiting for FTS index rebuild | Test sees correct card count but FTS search returns 0 results | After bulk import, explicitly await FTS rebuild signal before asserting searchability | Bulk imports (>500 cards) with subsequent FTS assertions |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committing real NoteStore.sqlite as a test fixture | Exposes personal notes, passwords, private data to git history | Create synthetic minimal fixture via SQLite3 CLI; never commit real system database copies |
| Storing real EventKit data in fixture JSON | Exposes calendar events, reminder content | Use synthetic fixture data with generic titles and dates |
| Using real Apple ID or CloudKit container in E2E tests | Pollutes production CloudKit with test data | Inject mock sync layer; never call real CKSyncEngine in automated tests |
| Protobuf fixture contains real encrypted note data | Encrypted note body may contain sensitive content | Fixtures must only contain unencrypted notes; skip password-protected notes in all fixture generation |

---

## "Looks Done But Isn't" Checklist

- [ ] **DedupEngine re-import:** Test asserts `result.inserted` but not `result.deletedIds` — verify deletion count is explicitly asserted for the re-import case
- [ ] **FTS bulk path:** Test uses <500 cards — verify at least one test per source type generates 501+ cards and uses `isBulkImport=true`
- [ ] **NoteStore schema branches:** Only one schema version fixture exists — verify both `ZTITLE1` and `ZTITLE2` column branches are exercised by separate fixture files
- [ ] **MockAdapter fidelity:** MockAdapter output was authored by hand — verify its `CanonicalCard` shape matches what `normalizeNativeCard()` actually produces from real adapter output
- [ ] **Playwright import completion:** Import test uses `waitForTimeout` — verify replaced with `expect.poll()` against a queryable completion signal
- [ ] **Permission flow:** Test calls `fetchCards()` directly — verify it either injects MockAdapter or explicitly asserts `.granted` permission status before calling real adapter
- [ ] **Source type coverage:** ETL E2E tests exist for some sources but not all 11 — verify all 11 data source types have at minimum one pipeline integration test (parse → dedup → write → verify DB row)
- [ ] **CAS collision:** All fixture cards have distinct content — verify at least one fixture exercises two cards with identical content but different source IDs
- [ ] **Export round-trip:** Import tests verify DB row count but not export fidelity — verify at least one test does a full import → export → reimport round-trip and asserts field-level equality
- [ ] **Protobuf fallback tiers:** All NoteStore fixture rows have valid ZDATA — verify tier 2 (ZSNIPPET fallback) and tier 3 (empty content) are both exercised by dedicated fixture rows

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WASM/jsdom mixing in test file | LOW | Split the test file into two files with appropriate environment annotations; move realDb() tests to node environment, DOM tests to jsdom environment |
| Real personal data committed as fixture | HIGH | `git filter-branch` or `git-filter-repo` to remove from history; rotate any credentials if NoteStore contained them; regenerate fixture synthetically |
| `waitForTimeout` spread across 10+ spec files | MEDIUM | grep for `waitForTimeout` in `e2e/` and replace mechanically; define `expect.poll()` wrapper for import completion as shared helper |
| DedupEngine deletion logic untested and silently broken | HIGH | Add deletion fixture pair and re-import tests; manually verify deleted card IDs against production import logs |
| MockAdapter drifted from real adapter output shape | MEDIUM | Capture real adapter output from a sanitized device run; diff against MockAdapter output shape; update MockAdapter to match |
| Single NoteStore schema version missing macOS 13 branch | MEDIUM | Create macOS-13-schema fixture using SQLite3 CLI; run `PRAGMA table_info` against macOS 13 NoteStore to get exact column names; write fixture DDL |
| Protobuf fallback tiers untested and broken in tier 2 | MEDIUM | Construct NoteStore row with null ZDATA via SQLite3 CLI; add XCTest asserting non-empty `content` from ZSNIPPET fallback |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WASM/jsdom environment mismatch | First infrastructure phase — define file organization rules | No test file contains both `realDb()` and `document.querySelector` |
| Native adapter TCC permissions in CI | Native mock design phase — establish MockAdapter injection pattern | All Swift ETL tests use MockAdapter or assert permission status; CI passes on ubuntu-latest |
| NoteStore schema version branching untested | Fixture management phase — define multi-schema fixture requirement | At least 2 NoteStore fixture files with explicit OS version in filename |
| DedupEngine deletion assertions missing | DedupEngine E2E phase — add re-import fixture pairs and deletion count assertions | Every re-import test asserts `deletedIds.length === N` for known N |
| FTS trigger vs bulk path coverage gap | SQLiteWriter E2E phase — require 501+ card bulk test per source type | `tests/etl/` contains at least one test per source with `isBulkImport=true` and FTS assertion |
| Playwright `waitForTimeout` usage | Playwright ETL harness setup phase — define import-completion polling API | Zero occurrences of `waitForTimeout` in `e2e/` directory |
| CAS hash collision untested | DedupEngine correctness phase — add identical-content fixture | Fixture with two cards having identical `content` but different `source_id` exists and is asserted |
| Real personal data in fixtures | Fixture management phase — establish synthetic fixture generation procedure | No fixture file is a direct copy of a real system database |
| Protobuf fallback tiers untested | NoteStore extraction correctness phase | XCTest covers tier 1 (ZDATA), tier 2 (ZSNIPPET), and tier 3 (null content) with dedicated fixture rows |

---

## Sources

- Phase 104 CONTEXT.md and SUMMARY.md: `makePluginHarness` factory decisions, jsdom annotation pattern, anti-patching rule
- Phase 107-01 SUMMARY.md: 4 production bugs found during E2E writing (data-col-start, .pv-toolbar, onSort, SuperSortChain cleanup); `waitForTimeout` ban; `expect.poll()` pattern; overlay `PointerEvent` dispatch
- Phase 107-02 SUMMARY.md: `disableAllNonBase()` reset pattern; screenshot baseline git force-commit
- `tests/seams/etl/etl-fts.test.ts`: Established pattern for trigger vs bulk path FTS coverage (EFTS-01, EFTS-02)
- `tests/harness/realDb.ts`: WASM path resolution via `SQL_WASM_PATH` env, `pool: 'forks'` process isolation
- `vitest.config.ts`: `environment: 'node'`, `pool: 'forks'`, `testTimeout: 10000` for WASM cold start
- `native/Isometry/Isometry/NotesAdapter.swift`: NoteStore path, schema version PRAGMA branching, gzip+protobuf extraction, three-tier fallback
- `native/Isometry/Isometry/PermissionManager.swift`: TCC permission check pattern, security-scoped bookmarks
- `tests/etl/DedupEngine.test.ts`: DedupEngine test patterns; `sourceIdMap` and `deletedIds` fields identified
- `src/etl/DedupEngine.ts`: `deletedIds` computation, source-scoped deletion logic
- `.github/workflows/ci.yml`: `ubuntu-latest` for all jobs — no macOS runner, confirming native adapter CI constraint
- Project MEMORY.md: v8.3 bug list (4 production bugs found via E2E: data-col-start, .pv-toolbar, onSort, SuperSortChain cleanup)

---
*Pitfalls research for: ETL E2E Test Suite — WASM/Native hybrid (TypeScript/Swift)*
*Researched: 2026-03-22*
