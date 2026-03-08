---
phase: 60-row-index-gutter
verified: 2026-03-08T23:10:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
---

# Phase 60: Row Index Gutter Verification Report

**Phase Goal:** SuperGrid spreadsheet mode displays sequential row numbers in a dedicated left-edge gutter column with a sticky corner cell at the header intersection
**Verified:** 2026-03-08T23:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Spreadsheet mode shows a narrow gutter column at the left edge with sequential row numbers starting at 1 | VERIFIED | `_showRowIndex` derived from `viewMode === 'spreadsheet'` (L1439). Gutter cells created with class `sg-row-index sg-cell`, textContent `String(rowIdx + 1)`, gridColumn `'1'` (L1667-1687). `buildGridTemplateColumns` prepends `28px` track when `showRowIndex=true` (SuperStackHeader.ts L294-295). Test RGUT-01/02 confirms 3 gutter cells with text "1","2","3". |
| 2 | The corner cell at gutter/header intersection is sticky and sits above all other elements | VERIFIED | Gutter corner cell created with className `sg-corner-cell sg-header sg-row-index`, position `sticky`, top `'0'`, left `'0'`, zIndex `'4'` (L1488-1498). Existing corner cells remain at z-index 3. Test RGUT-03 asserts all four sticky/z-index properties. |
| 3 | Matrix mode has no gutter column -- no gutter cells rendered | VERIFIED | `_showRowIndex` is `false` when `viewMode !== 'spreadsheet'` (L1439). All gutter rendering blocks guarded by `if (this._showRowIndex)`. `buildGridTemplateColumns` omits gutter track when `showRowIndex=false` (default). Test RGUT-04 asserts zero `.sg-row-index` elements in matrix mode. |
| 4 | Row numbers update correctly when rows change (filter, reorder, hide-empty) | VERIFIED | Row index uses `visibleLeafRowCells.findIndex()` to compute sequential position (L1671-1674), so re-filtering produces gap-free 1..N numbering. Test RGUT-05 verifies re-sequencing after hide-empty toggle: 4 rows filtered to 2, gutter shows "1","2". |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/views/SuperGrid.ts` | Gutter cell rendering in _renderCells, _showRowIndex flag, corner cell gutter extension | VERIFIED | `_showRowIndex` property at L199, gutterOffset at L1440, gutter corner cells at L1488-1498, gutter row index cells at L1667-1687, row header offset at L3634, col header offset at L3781, data cell offset at L1981 |
| `src/views/supergrid/SuperStackHeader.ts` | 28px gutter column prepended to grid-template-columns | VERIFIED | `showRowIndex` param (default false) and `gutterWidth` param (default 28) at L292-293, gutterPart prepended at L295 |
| `src/styles/supergrid.css` | Gutter cell sizing, font, border, sticky positioning for corner gutter cell | VERIFIED | `.sg-row-index` rule at L62-78 with font-family, font-size, text-align, border, flex centering, z-index 1, background-color. `.sg-corner-cell` rule at L80-83 |
| `tests/views/SuperGrid.test.ts` | RGUT-05 regression tests for gutter presence/absence | VERIFIED | 5 RGUT tests at L11521-11655: RGUT-01/02 (sequential numbers), RGUT-03 (corner z-index 4), RGUT-04 (matrix zero gutter), RGUT-05 (re-sequence after filter), RGUT-01 (sticky left) |
| `tests/views/SuperStackHeader.test.ts` | buildGridTemplateColumns tests with showRowIndex parameter | VERIFIED | 3 tests at L352-365: showRowIndex=true prepends 28px, showRowIndex=true with no leaf cols, showRowIndex=false matches existing |
| `src/views/supergrid/SuperGridSizer.ts` | showRowIndex passthrough for live resize | VERIFIED | `_getShowRowIndex` callback at L85, constructor param at L97, passed to `buildGridTemplateColumns` in `applyWidths` at L342 and `_applyInternal` at L362 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SuperGrid.ts` | `SuperStackHeader.ts` | `buildGridTemplateColumns` call with showRowIndex param | WIRED | Call at L1445-1452 passes `this._showRowIndex` as 6th argument |
| `SuperGrid.ts` | `supergrid.css` | `sg-row-index` class on gutter cells | WIRED | Class applied at L1490 (corner) and L1677 (row index cells), CSS rules at L62-78 |
| `SuperGrid.ts` | `densityProvider.viewMode` | `_showRowIndex` derived from viewMode === 'spreadsheet' | WIRED | L1439: `this._showRowIndex = densityStateForHide.viewMode === 'spreadsheet'` |
| `SuperGrid.ts` | `SuperGridSizer.ts` | `_getShowRowIndex` callback passed to sizer constructor | WIRED | L485: `() => this._showRowIndex` passed as 3rd arg; Sizer uses it at L362 in `_applyInternal()` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RGUT-01 | 60-01-PLAN | 28px sg-row-index gutter column prepended as leftmost CSS Grid track in spreadsheet mode | SATISFIED | `buildGridTemplateColumns` prepends `28px` when `showRowIndex=true`; gutter cells at gridColumn `'1'` with `sg-row-index` class |
| RGUT-02 | 60-01-PLAN | Sequential row numbers (1..N) rendered in non-interactive gutter cells | SATISFIED | `textContent = String(rowIdx + 1)` at L1682; `user-select: none` in CSS; test confirms "1","2","3" |
| RGUT-03 | 60-01-PLAN | sg-corner-cell at gutter/header intersection with sticky positioning (z-index 4) | SATISFIED | Corner cell at L1488-1498 with position sticky, top/left 0, zIndex 4; test RGUT-03 asserts all properties |
| RGUT-04 | 60-01-PLAN | Gutter hidden in matrix mode (_showRowIndex = false) | SATISFIED | `_showRowIndex` false when `viewMode !== 'spreadsheet'`; all gutter blocks guarded; test RGUT-04 confirms zero elements |
| RGUT-05 | 60-01-PLAN | Regression tests: gutter elements present in spreadsheet mode, absent in matrix mode | SATISFIED | 5 RGUT tests + 3 buildGridTemplateColumns tests = 8 new tests, all passing (423 total) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected in Phase 60 modified files |

Note: One historical comment in SuperGrid.ts L3652 references "FIXES TODO at old line 1343" -- this is descriptive, not an active TODO.

### Human Verification Required

### 1. Visual gutter alignment

**Test:** Open SuperGrid in spreadsheet mode with 3+ row axis values. Scroll horizontally -- gutter column should remain stuck at left edge. Scroll vertically -- corner cell should remain stuck at top-left.
**Expected:** Gutter cells stay fixed at left, corner cell stays fixed at top-left intersection, both above all other content.
**Why human:** Sticky positioning and z-index stacking context behavior varies between browsers and cannot be fully verified in jsdom.

### 2. Gutter width visual consistency

**Test:** In spreadsheet mode, verify the 28px gutter column does not clip row numbers for counts up to 999+ rows.
**Expected:** Numbers are centered, readable, and do not overflow the 28px column at reasonable data sizes.
**Why human:** Visual fit of text within fixed-width columns depends on font rendering.

### 3. Mode switching

**Test:** Switch between spreadsheet and matrix modes. Verify gutter appears/disappears cleanly with no layout shift or orphaned elements.
**Expected:** Clean transition: gutter appears instantly in spreadsheet mode, disappears completely in matrix mode.
**Why human:** Layout transition smoothness requires visual inspection.

## Test Results

- **Test suite:** 423 tests passed (2 test files)
- **TypeScript:** Zero errors in modified source files (5 pre-existing errors in unrelated `tests/accessibility/motion.test.ts`)
- **Biome:** Zero diagnostics in modified source files
- **Commits:** Both task commits verified: `ae5ceecc` (feat), `4a34dc31` (test)

## Gaps Summary

No gaps found. All 4 observable truths verified. All 6 artifacts exist, are substantive, and are properly wired. All 5 RGUT requirements satisfied with evidence. All 4 key links verified as connected. 8 new tests pass alongside 415 existing tests with zero regressions.

---

_Verified: 2026-03-08T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
