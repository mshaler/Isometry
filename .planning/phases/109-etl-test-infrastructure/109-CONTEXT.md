# Phase 109: ETL Test Infrastructure - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared harness extensions, bridge API additions, alto-index fixture set, and WASM/jsdom boundary enforcement. All subsequent ETL test phases (110-113) depend on this infrastructure. No production code changes — test scaffolding only.

</domain>

<decisions>
## Implementation Decisions

### Fixture design
- **20+ cards per fixture** for each of the 11 alto-index subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos)
- Clean, representative data in each per-type fixture — no edge cases mixed in
- **Separate shared edge-cases.json** file for nulls, Unicode, emoji, very long content — tested across types in one place
- Fixtures generated via a `generate-alto-fixtures.mjs` script (matching existing `tests/etl-validation/fixtures/generate-fixtures.mjs` pattern), with committed JSON as source of truth (script is for regeneration only)
- Fixture location: `tests/fixtures/alto-index/` with one JSON file per subdirectory type

### Bridge query API
- `queryAll(sql, params?)` returns simplified `{columns: string[], rows: Record<string, unknown>[]}` — easy to destructure in Playwright assertions
- `exec(sql)` returns void — for DDL/DML statements
- Both methods always available on `window.__isometry` (no extra debug flag gating) — the entire `__isometry` namespace is already dev/debug-only and not exposed in production native builds
- Wired through the existing Worker bridge `db:query` handler internally

### Environment boundary enforcement
- **Grep-based CI script** checks for test files that import both `realDb()` and contain `@vitest-environment jsdom` annotation — fails CI if any mixing detected
- No custom ESLint/Biome rule — grep is simpler, no dependencies, matches project philosophy
- `tests/ENVIRONMENT.md` is **comprehensive** (rationale for WASM/jsdom split, when to use each environment, correct/incorrect examples, CI enforcement mechanism, troubleshooting section)

### Claude's Discretion
- Exact grep script implementation (bash, node, or CI step)
- Internal wiring of queryAll/exec through Worker bridge
- Fixture content details (which fields, card titles, body content)
- better-sqlite3 + tmp installation approach
- etl.ts helper function signatures beyond the three named exports (importNativeCards, assertCatalogRow, resetDatabase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — INFR-01 through INFR-05 define exact success criteria for this phase

### Existing E2E infrastructure
- `e2e/helpers/isometry.ts` — Current E2E helpers (importFixture, importAltoNotes, getCardCount, waitForAppReady) — new ETL helpers extend this pattern
- `e2e/helpers/harness.ts` — HarnessShell programmatic API pattern (waitForHarnessReady, togglePlugin) — model for API style
- `e2e/fixtures.ts` — Baseline fixture setup (loadBaselineDataset) — shared fixture pattern

### Existing test harness
- `tests/harness/realDb.ts` — In-memory sql.js factory for Vitest seam tests — the "WASM side" of the boundary
- `tests/harness/makeProviders.ts` — Wired provider stack factory with real PRAGMA-derived SchemaProvider

### Existing ETL fixtures
- `tests/etl-validation/fixtures/generate-fixtures.mjs` — Existing fixture generation script to match pattern
- `tests/etl-validation/fixtures/` — 9 existing snapshot fixtures (apple-notes, csv, json, markdown, html, excel-rows, native-notes, native-reminders, native-calendar)

### App entry point
- `src/main.ts` — Where `window.__isometry` is exposed (line ~1187) — queryAll/exec additions go here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/helpers/isometry.ts`: Rich helper library with import, view switching, axis config, filter, sort, zoom, selection, density, search, audit — new ETL helpers extend this file or sit alongside it
- `e2e/helpers/harness.ts`: Plugin control via `window.__harness` — established pattern for programmatic E2E APIs
- `tests/harness/realDb.ts`: In-memory sql.js factory — defines the "WASM-only" side of the boundary
- `tests/etl-validation/fixtures/generate-fixtures.mjs`: Fixture generation script — pattern to follow for alto-index fixture generation

### Established Patterns
- `window.__isometry` namespace for all E2E programmatic APIs (bridge, viewManager, coordinator, providers, sampleManager)
- `window.__harness` namespace for harness-mode APIs (plugin toggle, enable/disable)
- Playwright `page.evaluate()` for all bridge interactions (never DOM scraping for data assertions)
- `@vitest-environment jsdom` annotation per-file for DOM-dependent tests
- `realDb()` for WASM-based sql.js tests (incompatible with jsdom)

### Integration Points
- `src/main.ts` line ~1190: `window.__isometry` object construction — add `queryAll` and `exec` here
- `e2e/helpers/`: New `etl.ts` file alongside existing `isometry.ts` and `harness.ts`
- `tests/fixtures/alto-index/`: New directory (does not exist yet)
- `package.json` devDependencies: `better-sqlite3` and `tmp` need installation
- CI workflow (GitHub Actions): New environment boundary check step

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User selected recommended defaults for most areas, with two notable preferences:
- Realistic fixture size (20+ cards) over minimal — wants thorough coverage per subdirectory type
- Comprehensive ENVIRONMENT.md over concise — wants full rationale and troubleshooting, not just the rule

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 109-etl-test-infrastructure*
*Context gathered: 2026-03-22*
