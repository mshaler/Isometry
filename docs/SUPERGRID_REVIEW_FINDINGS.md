# SuperGrid Code Review Findings

Date: 2026-03-05
Scope: Recently completed SuperGrid changes (Phase 27 related behavior and tests)

## Findings

### 1. High → FIXED: Context-menu sort does not update runtime sort state

- Context-menu actions called `provider.setSortOverrides(...)` but did not update `this._sortState`.
- `_fetchAndRender()` sends `sortOverrides: this._sortState.getSorts()`, so query ordering remained stale after context-menu clicks.
- Additionally, sort indicator badges on headers read from `_sortState`, so the UI showed incorrect active-sort state.
- **Fix:** Context-menu sort handlers now construct a new `SortState` with the intended sort before calling `setSortOverrides()`, mirroring the header-click pattern (lines 2157–2163).
- References:
  - `src/views/SuperGrid.ts:2001` (asc handler)
  - `src/views/SuperGrid.ts:2016` (desc handler)

### 2. Medium → FIXED: Spreadsheet-mode rendering used raw `innerHTML` with card IDs

- Spreadsheet rendering interpolated card IDs into HTML strings via template literal.
- In a local-first app the attack surface is limited (user controls their own data), but ETL import could introduce unescaped content.
- **Severity adjusted:** High → Medium. No multi-tenant/server-rendered surface.
- **Fix:** Replaced string interpolation with DOM construction (`document.createElement` + `textContent`), matching the pattern used by adjacent SuperCard rendering.
- Reference:
  - `src/views/SuperGrid.ts:1489–1500`

### 3. ~~High~~ RETRACTED: "Hide column/row" context-menu state is non-functional

- **Original claim:** `_hiddenCols/_hiddenRows` sets are not consumed in query or render filtering.
- **Verdict: Incorrect.** The sets ARE consumed in `_renderCells()` at lines 1164–1173:
  ```ts
  colValues = colValues.filter(cv => !this._hiddenCols.has(cv));
  rowValues = rowValues.filter(rv => !this._hiddenRows.has(rv));
  ```
- Hidden badge count is updated via `_updateHiddenBadge()` (line 1176). Feature works as designed.
- **No action required.**

### 4. ~~Medium~~ MERGED into Finding 1: Active sort indicator in context menu

- The sort indicator reading stale `_sortState` was a symptom of the dual-state desync in Finding 1.
- With Finding 1 fixed, `_sortState` is authoritative at context-menu open time and indicators render correctly.
- The `'✓ '` prefix character renders in the browser context menu. If a different symbol is preferred, that is a cosmetic enhancement, not a bug.
- **No additional action required.**

### 5. Low → FIXED: PLSH-02 perf test describe block overstated scope

- Test description said "GROUP BY on 10K cards" but measured only `buildSuperGridQuery()` compilation (microseconds, not DB execution).
- The test's own inline comments (lines 191–199) already explained this is a sentinel test, with full E2E covered in `performance-assertions.test.ts`.
- **Severity adjusted:** Medium → Low. Not a coverage gap, just misleading naming.
- **Fix:** Renamed comment banner and describe block to `"SuperGridQuery builder compilation < 100ms (sentinel)"`.
- Reference:
  - `tests/views/SuperGrid.perf.test.ts:182–185`

## Resolution Summary

| # | Original Severity | Verdict | Resolution |
|---|-------------------|---------|------------|
| 1 | High | ✅ Confirmed bug | Fixed — `_sortState` updated before `setSortOverrides` in context-menu handlers |
| 2 | High | ⚠️ Overstated | Fixed — DOM construction replaces innerHTML; severity → Medium |
| 3 | High | ❌ Incorrect | Retracted — hidden filtering exists at lines 1164–1173 |
| 4 | Medium | ↗️ Symptom of #1 | Merged — resolved by Finding 1 fix |
| 5 | Medium | ⚠️ Naming only | Fixed — describe block renamed; severity → Low |

## Validation Run

- Command executed: `npx vitest --run tests/views/SuperGrid.test.ts tests/views/SuperGrid.perf.test.ts`
- Result: pass
  - Test files: 2 passed
  - Tests: 307 passed

## Remaining Coverage Gaps

- Consider adding a test proving context-menu sort updates the `superGridQuery` sort config (validates Finding 1 fix).
- Consider adding a test for hide column/row filtering output (validates retraction of Finding 3).
