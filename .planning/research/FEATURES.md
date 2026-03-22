# Feature Research

**Domain:** E2E ETL Test Suite — Data import pipelines with multiple source formats, native macOS database adapters, and OS permission flows
**Researched:** 2026-03-22
**Confidence:** HIGH (grounded in existing codebase, established Vitest + Playwright infrastructure, and ETL validation patterns already shipped in v4.2/v6.1/v7.2)

---

## Context: What "E2E" Means Here

This is not a product feature set — it is a *test milestone* feature set. "Features" are the testing capabilities and coverage categories this milestone must deliver. The consumer of this research is the roadmap phases that decide what to build.

The production code under test is already shipped:
- 6 file-based parsers (Apple Notes JSON, Markdown, Excel, CSV, JSON, HTML)
- 3 native macOS adapters (Apple Notes NoteStore.sqlite, Reminders EventKit, Calendar EventKit)
- AltoIndexAdapter (11 subdirectory types, YAML frontmatter)
- DedupEngine, SQLiteWriter, ImportOrchestrator, ExportOrchestrator, CatalogWriter
- PermissionManager actor with TCC deep links

The test infrastructure that already exists:
- Vitest unit tests for ImportOrchestrator, DedupEngine, SQLiteWriter, CatalogWriter, parsers
- `tests/etl-validation/` with 100+ card fixtures for all 9 sources and 81-combo source x view rendering matrix (v4.2)
- `tests/etl-validation/etl-alto-index-full.test.ts` for live alto-index bulk load (v7.2)
- `tests/harness/realDb()` + `makeProviders()` for integration testing (v6.1)
- Playwright `e2e/` with 15 specs covering SuperGrid plugin interactions (v8.3)
- Playwright `playwright.config.ts` targeting `http://localhost:5173` with Chromium

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the coverage categories any serious ETL E2E test suite must include. Missing any of them means the milestone is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Per-format import correctness** — assert card count, field mapping, source tag, non-empty name for every file format (JSON, XLSX, CSV, MD, HTML, Apple Notes JSON) | Any ETL test suite validates each source independently; unit tests exist but don't cover the full pipeline end-to-end through the UI/Worker bridge | MEDIUM | Fixtures already exist in `tests/etl-validation/fixtures/`. Need Playwright specs that upload files through the DataExplorer panel and query the resulting SQLite state. |
| **Native adapter import correctness** — assert card count, field mapping, source tag for Notes, Reminders, Calendar | Native adapters bypass ImportOrchestrator (direct JSON bridge) — existing unit tests use synthetic JSON fixtures, not real bridge dispatch | HIGH | Cannot test real NoteStore.sqlite in CI (macOS sandbox). Must use fixture-based mocks of the native:batch-import bridge message with actual CanonicalCard shapes. |
| **Alto-index subdirectory coverage** — each of the 11 subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) imports with correct parser routing and field preservation | AltoIndexAdapter routes subdirs to specific parsers — wrong routing silently produces malformed cards | HIGH | `etl-alto-index-full.test.ts` tests live symlink only. Need fixtures for each subtype for deterministic CI. |
| **Dedup idempotency assertion** — re-importing the same source twice produces zero inserted rows on second import, same total card count | DedupEngine is the central correctness guarantee — without an E2E assertion it can regress silently | MEDIUM | `DedupEngine.test.ts` unit test exists but doesn't exercise the full pipeline. Need an integration test that calls ImportOrchestrator twice and checks `import_runs` catalog. |
| **Catalog provenance recording** — every import run creates an `import_sources` + `import_runs` row with correct source_type, card_count, run_id | Data Catalog is a first-class feature; missing provenance breaks the Data Explorer "Datasets" panel | LOW | CatalogWriter has unit tests. Need an E2E assertion that queries `import_sources`/`import_runs` after a full import flow. |
| **FTS5 searchability post-import** — cards imported from each source are discoverable via FTS5 full-text search | FTS5 trigger path + bulk rebuild are in production. If a parser strips content, search silently fails. | MEDIUM | `tests/seams/` covers FTS ETL seam. Need per-source search assertion in the E2E layer (type in CommandBar, expect result). |
| **Export round-trip correctness** — cards imported then exported to Markdown/JSON/CSV preserve field fidelity | ExportOrchestrator is tested in isolation; import→export round-trip is untested end-to-end | MEDIUM | Pure Vitest integration test: import fixture → export via ExportOrchestrator → compare output shape. No Playwright needed. |
| **Progress reporting** — ImportOrchestrator emits progress notifications during a large import | ImportToast relies on WorkerNotification protocol. Silent progress regression breaks UX. | LOW | Vitest spy test: import 1000+ cards, assert `onProgress` called N times with ascending percentages. |

### Differentiators (Competitive Advantage)

These distinguish a thorough test suite from a minimal one. They are not required to call the milestone complete, but they provide signal that no other test layer provides.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **TCC permission flow simulation** — test grant/deny/revoke lifecycle for Notes, Reminders, Calendar without real OS prompts | Permission bugs are invisible until a user revokes access mid-session; no existing test covers this path | HIGH | Cannot automate real TCC dialogs. Strategy: mock PermissionManager at the Swift boundary; inject a JS-visible `__mockPermission(source, status)` hook via HarnessShell; write Playwright tests that trigger import, inject denial, assert error state in DataExplorer panel. Requires a debug bridge hook not yet built. |
| **Malformed input error recovery** — each parser tested with intentionally corrupt/partial/empty inputs; assert ImportToast shows error, no crash, no zombie state | Corruption handling is partially tested in `tests/etl-validation/errors/` but not through the full UI stack | MEDIUM | Playwright test: upload a truncated XLSX, assert ImportToast reaches `error` state and DataExplorer shows unchanged card count. |
| **Cross-format dedup collision detection** — assert that cards from two sources with the same logical entity are NOT deduped (source+source_id keying) | DedupEngine intentionally scopes dedup per-source; a regression that deduped across sources would be invisible | MEDIUM | Integration test: import same note title from `apple_notes` and `markdown` sources; assert two distinct cards exist with different source tags. |
| **SQLiteWriter batch boundary correctness** — assert card count is correct when import size is exactly N, N+1, 2N-1, 2N, 2N+1 where N=100 (batchSize) | Off-by-one errors at batch boundaries are a classic ETL bug; 49K-card throughput test doesn't catch them | MEDIUM | Vitest parametric test across [99, 100, 101, 199, 200, 201] card counts. |
| **CAS content-addressable storage update** — cards from same source with same source_id but updated content get updated fields, not a duplicate row | Content-addressable storage update invariant; dedup regression here silently drops updates | MEDIUM | Integration test: import fixture, mutate one card's content field in fixture, re-import, assert same card row has updated content and modified_at. |
| **Import throughput budget assertion** — ETL pipeline maintains >=49K cards/s for 1000+ card imports; regression fails CI | v6.0 established 49K cards/s with batchSize=1000; this must not regress silently | LOW | Vitest bench file (pattern established in `src/bench/`). New bench: time ImportOrchestrator on 1000-card fixture, assert <20ms total write time. |
| **Native adapter bridge message shape validation** — assert CanonicalCard JSON from each native adapter conforms to schema before SQLiteWriter receives it | normalizeNativeCard() was a production bug (v4.0); schema drift is a recurring risk | MEDIUM | Vitest schema-shape test per adapter: load fixture, call normalizeNativeCard(), assert all required fields non-null. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real TCC automation** — actually trigger macOS permission dialogs and click through them with accessibility APIs | Seems like the only way to truly test permission flows | macOS sandboxing makes TCC non-automatable in CI; XCUITest can automate but only on physical device, not GitHub Actions runners; flaky in every environment | Mock PermissionManager at the Swift/JS bridge boundary with an injectable test double. Test the application's response to permission outcomes, not the OS dialog itself. |
| **Live NoteStore.sqlite access in CI** — run tests against real `/private/var/mobile/Library/NoteStore/NoteStore.sqlite` | Seems like the only way to test the real adapter | Path is protected by TCC even with entitlements; CI runners have no Notes data; protobuf schema changes between OS versions silently break tests | Use carefully crafted binary fixtures that capture real NoteStore.sqlite row shapes. Update fixtures on OS version bumps as part of the release checklist. |
| **100% Playwright UI coverage for all ETL flows** — drive every import through the browser UI | Playwright proves integration works; seems thorough | Playwright tests are slow (60s timeout per spec), flaky on native OS file picker dialogs, and duplicate signal already provided by Vitest integration tests | Use Playwright for DataExplorer UI panel (file upload CTA, ImportToast states, Catalog panel update). Use Vitest for correctness: field mapping, dedup, batch boundaries, schema validation. |
| **Snapshot testing all parser output** — serialize CanonicalCard[] output and compare to stored JSON snapshot | Easy to implement with Vitest `toMatchSnapshot()` | Snapshot tests become maintenance burdens; any field addition triggers snapshot update churn without actually catching regressions | Assert specific invariants: card count, source tag, required fields non-null, known field values from fixture inputs. Exact shape snapshots cause false positives. |
| **Excel streaming test** — test XLSX import of multi-megabyte files | Large file import is a real user scenario | Streaming XLSX reads are architecturally impossible — ZIP central directory is at EOF (noted explicitly in PROJECT.md Out of Scope). Tests would prove a false capability. | Test XLSX correctness at the 100-500 row scale where ArrayBuffer fits in memory. Document the size limit explicitly in test comments. |
| **Import undo via MutationManager** — test Cmd+Z undoing an import | Seems like a standard undo feature | Import undo is explicitly out of scope in PROJECT.md ("use DELETE by import_run_id instead"). Writing tests for this would test a non-feature. | Test the delete-by-import_run_id path instead. Assert that deleting an import_sources row cascades correctly. |

---

## Feature Dependencies

```
[Vitest integration layer (realDb + ImportOrchestrator)]
    └──required by──> [Per-format import correctness tests]
    └──required by──> [Dedup idempotency tests]
    └──required by──> [Export round-trip tests]
    └──required by──> [SQLiteWriter batch boundary tests]
    └──required by──> [CAS content-addressable update tests]
    └──required by──> [Cross-format dedup collision tests]

[Alto-index per-subtype CI-safe fixtures (new)]
    └──required by──> [Alto-index subdirectory coverage tests]
                          (existing live-symlink test does not run in CI)

[CanonicalCard fixture JSON per native adapter (already exists)]
    └──required by──> [Native adapter bridge shape validation]
    └──required by──> [Native adapter import correctness]

[Playwright DataExplorer UI wiring]
    └──required by──> [TCC permission flow simulation (UI assertion path)]
    └──required by──> [Malformed input error recovery (UI path)]
    └──enhances──> [Per-format import correctness (UI smoke layer)]

[Debug bridge hook (__mockPermission, new)]
    └──required by──> [TCC permission flow simulation]
    └──requires──> [HarnessShell ?harness=1 entry point (already exists)]

[Vitest bench infrastructure (already exists in src/bench/)]
    └──required by──> [Import throughput budget assertion]

[FTS5 searchability post-import]
    └──requires──> [Per-format import correctness] (cards must exist before search)
```

### Dependency Notes

- **Alto-index fixture creation blocks subdirectory coverage**: The live-symlink approach in `etl-alto-index-full.test.ts` only runs locally. CI-safe fixtures per subdirectory type must be authored before those tests can be written. This is the highest-effort prerequisite in the milestone.
- **TCC simulation requires debug bridge hook**: The `__mockPermission` injection point does not yet exist. It must be added to the HarnessShell (`?harness=1` mode) as a JS-visible hook before any permission flow tests can be written. This is an infrastructure task, not a test task.
- **Native adapter tests can reuse existing fixtures**: `tests/etl-validation/fixtures/native-notes.json`, `native-reminders.json`, `native-calendar.json` already exist as CanonicalCard arrays from v4.2. The shape validation and bridge correctness tests can use these directly without authoring new fixtures.
- **Export round-trip has no UI dependency**: Pure Vitest integration test — import fixture, export via ExportOrchestrator, assert output shape. No Playwright involvement needed.
- **Progress reporting can reuse any large fixture**: Use the 100+ card apple-notes-snapshot.json fixture. No special setup required.

---

## MVP Definition

### Launch With (v1 — the milestone is complete when these pass)

- [ ] Per-format import correctness — all 6 file-based parsers via Vitest integration (card count, source tag, required fields non-null)
- [ ] Native adapter import correctness — all 3 native adapters via Vitest shape validation + integration (fixture-based, no real NoteStore)
- [ ] Alto-index subdirectory coverage — all 11 subdirectory types via CI-safe fixtures (not live symlink)
- [ ] Dedup idempotency assertion — double-import via ImportOrchestrator, assert zero net-new cards on second run
- [ ] Catalog provenance recording — import run creates correct `import_sources`/`import_runs` rows
- [ ] TCC permission flow simulation — grant/deny/revoke via mock bridge hook for Notes, Reminders, Calendar

### Add After Validation (v1.x)

- [ ] Malformed input error recovery — Playwright UI path for truncated/corrupt file, assert ImportToast error state
- [ ] Export round-trip correctness — Markdown/JSON/CSV fidelity after full import
- [ ] FTS5 searchability post-import — CommandBar search finds cards from each source type
- [ ] Cross-format dedup collision detection — same-title cards from two sources remain distinct rows

### Future Consideration (v2+)

- [ ] SQLiteWriter batch boundary parametric test — [99,100,101,199,200,201] card counts
- [ ] Import throughput budget assertion — bench against 49K cards/s floor
- [ ] CAS content-addressable update test — update-then-reimport asserts same id, updated modified_at
- [ ] Native adapter bridge shape validation — per-adapter normalizeNativeCard() schema assertions

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-format import correctness (6 formats) | HIGH — validates the core ETL promise | LOW — fixtures exist, pattern is established | P1 |
| Native adapter import correctness (3 adapters) | HIGH — native adapters are the hardest path | MEDIUM — fixtures exist, bridge mock needed | P1 |
| Alto-index subdirectory coverage (11 types) | HIGH — AltoIndexAdapter is the newest ETL component | HIGH — CI-safe fixtures must be authored | P1 |
| Dedup idempotency assertion | HIGH — DedupEngine is a correctness guarantee | LOW — realDb + ImportOrchestrator already wired | P1 |
| TCC permission flow simulation | HIGH — permission bugs are user-visible and silent | HIGH — debug bridge hook must be built first | P1 |
| Catalog provenance recording | MEDIUM — Data Explorer depends on it | LOW — add assertion after existing import flow | P2 |
| Malformed input error recovery | MEDIUM — prevents silent failure zombie states | MEDIUM — Playwright + file upload interaction | P2 |
| Export round-trip correctness | MEDIUM — ExportOrchestrator is tested in isolation only | LOW — pure Vitest, no UI | P2 |
| FTS5 searchability post-import | MEDIUM — search is a primary UX surface | MEDIUM — Playwright CommandBar interaction | P2 |
| Cross-format dedup collision detection | LOW — edge case, DedupEngine is keyed correctly by design | LOW — two-import Vitest integration test | P3 |
| SQLiteWriter batch boundary tests | LOW — off-by-one risk, but 49K cards/s bench exists | LOW — parametric Vitest test | P3 |
| Import throughput budget assertion | LOW — regression guard, bench already covers general case | LOW — new bench entry | P3 |
| CAS content-addressable update test | LOW — dedup covers the common case | MEDIUM — update-then-reimport fixture needed | P3 |
| Native adapter bridge shape validation | LOW — normalizeNativeCard() already fixed in v4.0 | LOW — schema assertion per existing fixture | P3 |

**Priority key:**
- P1: Must have for milestone completion
- P2: Should have — adds meaningful signal beyond existing unit tests
- P3: Nice to have — marginal return given existing coverage

---

## Existing Infrastructure Inventory

These capabilities exist and can be leveraged directly without new investment:

| Infrastructure | Location | What It Provides |
|---------------|----------|-----------------|
| `realDb()` factory | `tests/harness/realDb.ts` | In-memory sql.js instance with real PRAGMA schema, usable in any Vitest test |
| `makeProviders()` factory | `tests/harness/makeProviders.ts` | Wired provider stack (Filter, PAFV, Schema) for integration tests |
| ETL fixtures (all 9 sources) | `tests/etl-validation/fixtures/` | 100+ card JSON fixtures per source, including native adapter shapes |
| `source-import.test.ts` | `tests/etl-validation/` | Field-mapping assertions per source — extend rather than duplicate |
| `etl-alto-index-full.test.ts` | `tests/etl-validation/` | Live alto-index test (conditional on symlink — CI-safe version needed) |
| Error fixtures | `tests/etl-validation/fixtures/errors/` | Malformed/corrupt input fixtures for error recovery tests |
| Playwright config | `playwright.config.ts` | Chromium, `localhost:5173`, `e2e/` testDir, 60s timeout, screenshot on failure |
| E2E `fixtures.ts` | `e2e/fixtures.ts` | Playwright fixture setup (extend for ETL flows) |
| HarnessShell `?harness=1` | URL query param | Debug entry point for plugin testing — extend for ETL/permission mocking |
| CI pipeline | `.github/workflows/` | 5 jobs: typecheck, lint, test, bench, e2e — ETL E2E specs fit under `test` (Vitest) or `e2e` (Playwright) jobs |

---

## Sources

- Isometry `PROJECT.md` — validated requirement history and current active scope (HIGH confidence — direct code inspection)
- `tests/etl-validation/` codebase — existing ETL test patterns and fixture inventory (HIGH confidence — direct code inspection)
- `tests/harness/` codebase — existing integration test infrastructure (HIGH confidence — direct code inspection)
- `playwright.config.ts` and `e2e/` — existing E2E infrastructure (HIGH confidence — direct code inspection)
- `tests/etl-validation/etl-alto-index-full.test.ts` — alto-index test approach and subdirectory inventory (HIGH confidence — direct code inspection)
- ETL testing domain patterns: fixture-based testing for non-automatable external systems; parametric boundary tests; layer-appropriate test placement (MEDIUM confidence — established industry patterns verified against existing codebase choices)

---

*Feature research for: ETL E2E Test Suite (Isometry v8.5)*
*Researched: 2026-03-22*
