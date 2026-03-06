---
phase: 31-drag-reorder
verified: 2026-03-06T21:47:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 31: Drag Reorder Verification Report

**Phase Goal:** Within-dimension level reorder, N-level cross-dimension transpose, animated transitions, Tier 2 persistence
**Verified:** 2026-03-06T21:47:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | reorderColAxes(from, to) splices axes without resetting colWidths, sortOverrides, or collapseState | VERIFIED | PAFVProvider.ts lines 395-397: _reorderAxes preserves colWidths/sortOverrides, remaps collapseState. Tests pass: "reorderColAxes preserves colWidths", "reorderColAxes preserves sortOverrides" |
| 2 | reorderRowAxes(from, to) splices axes without resetting colWidths, sortOverrides, or collapseState | VERIFIED | PAFVProvider.ts line 403: delegates to shared _reorderAxes. Tests pass: "reorderRowAxes preserves colWidths and sortOverrides" |
| 3 | Collapse keys are remapped atomically when axes are reordered | VERIFIED | PAFVProvider.ts lines 451-493: _remapCollapseKeys does level swap for 2-axis stacks, clears for 3+. Tests pass: "2-axis stack: reorder swaps collapse key levels", "3+ axis stack: reorder clears all collapse state" |
| 4 | toJSON/fromJSON round-trip preserves axis order and collapse state after reorder | VERIFIED | Tests pass: "toJSON after reorderColAxes produces JSON with reordered colAxes array", "collapse state survives round-trip after reorder (2-axis stack)", "rapid-sequence reorder: 3-axis stack, two successive reorders, round-trip preserves final order" |
| 5 | Pre-Phase-31 serialized state (no reorder metadata) deserializes correctly | VERIFIED | Tests pass: "backward-compatibility: pre-Phase-31 state (no collapseState) deserializes to empty collapse". setState() in PAFVProvider.ts lines 567-599 handles missing fields. |
| 6 | Insertion line appears between header cells during dragover at the midpoint-calculated target position | VERIFIED | SuperGrid.ts lines 3358-3370: _calcReorderTargetIndex computes midpoint. Lines 3376-3406: _showInsertionLine creates 2px absolute-positioned element with var(--accent, #4a9eff). Lines 3501-3531: dragover handler calls both. Tests pass: "insertion line is removed on dragend", "insertion line is removed on dragleave" |
| 7 | Source header dims to opacity 0.3 during drag and restores on dragend | VERIFIED | SuperGrid.ts line 3107: row grip dragstart sets opacity='0.3'. Line 3251: col grip dragstart sets opacity='0.3'. Lines 3113-3115/3257-3259: dragend restores opacity=''. |
| 8 | Same-dimension drop calls reorderColAxes/reorderRowAxes (not setColAxes/setRowAxes) | VERIFIED | SuperGrid.ts lines 3583-3587: same-dim branch calls provider.reorderColAxes/reorderRowAxes. Tests pass: "DYNM-03: col axis reorder calls reorderColAxes(0, 2)", "same-dimension drop calls reorderColAxes (not setColAxes)", "same-dimension row drop calls reorderRowAxes (not setRowAxes)" |
| 9 | Cross-dimension transpose continues to use setColAxes/setRowAxes (reset behavior correct) | VERIFIED | SuperGrid.ts lines 3619-3624: cross-dim branch calls setColAxes/setRowAxes. Test passes: "cross-dimension transpose still calls setColAxes/setRowAxes (not reorder)" |
| 10 | FLIP animation moves headers and data cells from old to new positions over 200ms after drop | VERIFIED | SuperGrid.ts lines 3443-3477: _captureFlipSnapshot before mutation, _playFlipAnimation after _renderCells with 200ms ease-out WAAPI. Line 1830: _playFlipAnimation called at end of _renderCells. Lines 3579/3615: snapshot captured before both same-dim and cross-dim mutations. Tests pass: "FLIP snapshot is captured before provider mutation on same-dim drop", "FLIP snapshot is consumed after _playFlipAnimation" |
| 11 | Escape cancels drag and cleans up insertion line + opacity | VERIFIED | HTML5 DnD default cancel fires dragend. dragend handlers at lines 3112-3118 and 3255-3262 restore opacity and call _removeInsertionLine(). |
| 12 | Existing .drag-over background highlight AND new insertion line are layered together | VERIFIED | SuperGrid.ts line 3499: dragover adds classList 'drag-over' before insertion line logic at line 3502. Both co-exist during dragover. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/providers/PAFVProvider.ts` | reorderColAxes, reorderRowAxes, _remapCollapseKeys methods | VERIFIED | Methods at lines 395-493. _reorderAxes shared implementation. Full collapse key remap logic. |
| `src/views/types.ts` | SuperGridProviderLike interface with reorder methods | VERIFIED | Lines 159-162: reorderColAxes and reorderRowAxes in interface with JSDoc. |
| `tests/providers/PAFVProvider.test.ts` | TDD tests for reorder + collapse key remap + persistence round-trip | VERIFIED | 20 new tests in Phase 31 blocks. 157 total tests, all passing. |
| `src/views/SuperGrid.ts` | Midpoint calculation, insertion line, source dimming, FLIP animation, reorder drop handler | VERIFIED | _calcReorderTargetIndex, _showInsertionLine, _removeInsertionLine, _getElementFlipKey, _captureFlipSnapshot, _playFlipAnimation all present. Instance vars _insertionLine, _dragSourceEl, _lastReorderTargetIndex, _flipSnapshot at lines 391-402. Cleanup in destroy() at lines 1037-1041. |
| `tests/views/SuperGrid.test.ts` | Tests for visual DnD UX, midpoint calculation, FLIP snapshot, reorder method wiring | VERIFIED | 14 new tests in Phase 31-02 blocks. 344 total SuperGrid tests, all passing. All 30+ inline SuperGridProviderLike mocks updated with reorderColAxes/reorderRowAxes stubs. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SuperGrid.ts _wireDropZone | PAFVProvider.ts reorderColAxes | Same-dimension drop handler calls provider.reorderColAxes/reorderRowAxes | WIRED | SuperGrid.ts line 3584: `this._provider.reorderColAxes(payload.sourceIndex, targetIndex)`, line 3586: `this._provider.reorderRowAxes(payload.sourceIndex, targetIndex)` |
| SuperGrid.ts _captureFlipSnapshot | SuperGrid.ts _playFlipAnimation | FLIP snapshot captured before provider mutation, played after _renderCells | WIRED | Line 3579: _captureFlipSnapshot() before same-dim mutation. Line 3615: _captureFlipSnapshot() before cross-dim mutation. Line 1830: _playFlipAnimation() at end of _renderCells. Snapshot consumed once (line 3460). |
| PAFVProvider.ts reorderColAxes | types.ts SuperGridProviderLike | Interface contract | WIRED | types.ts lines 159-162 declare both methods. PAFVProvider implements them at lines 395-405. SuperGrid consumes via this._provider. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DRAG-REORDER-BACKEND | 31-01-PLAN.md | PAFVProvider reorder methods + collapse key remapping + persistence round-trip | SATISFIED | reorderColAxes, reorderRowAxes, _remapCollapseKeys implemented. 20 TDD tests pass. Persistence round-trip validated. |
| DRAG-REORDER-VISUAL | 31-02-PLAN.md | SuperGrid visual DnD UX (insertion line, source dimming, midpoint calculation, FLIP animation) | SATISFIED | All visual elements implemented: insertion line, source dimming, midpoint calc, FLIP. 14 TDD tests pass. Drop handler rewired to reorder methods. |

No orphaned requirements found. DRAG-REORDER-BACKEND and DRAG-REORDER-VISUAL are phase-internal IDs not tracked in the global REQUIREMENTS files.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found |

PAFVProvider.ts: No TODO/FIXME/PLACEHOLDER markers. No stub implementations.
SuperGrid.ts: No TODO/FIXME markers related to Phase 31 code. The `return []` in _remapCollapseKeys (lines 457, 460) is intentional documented behavior (pragmatic simplification for 3+ level stacks), not a stub.

### Commit Verification

| Commit | Message | Status |
|--------|---------|--------|
| `0a29ea57` | feat(31-01): add reorderColAxes/reorderRowAxes to PAFVProvider | VERIFIED |
| `27f77596` | test(31-01): add persistence round-trip tests for reorder + collapse | VERIFIED |
| `bf54dcd2` | feat(31-02): wire visual drag UX -- insertion line, source dimming, reorder dispatch | VERIFIED |
| `547cdd55` | test(31-02): add FLIP animation tests for snapshot capture, consumption, and element keying | VERIFIED |

### Test Results

| Test Suite | Total | Passing | Status |
|-----------|-------|---------|--------|
| PAFVProvider.test.ts | 157 | 157 | All passing |
| SuperGrid.test.ts | 344 | 344 | All passing |

### Human Verification Required

### 1. Visual Insertion Line Positioning

**Test:** Drag a column header grip across other column headers in a multi-axis SuperGrid
**Expected:** A 2px accent-colored vertical line appears between headers at the correct midpoint-calculated position, tracking the pointer
**Why human:** Midpoint calculation and CSS positioning require visual confirmation in a real browser layout

### 2. Source Header Dimming

**Test:** Start dragging a header grip handle
**Expected:** The source header cell dims to ~30% opacity immediately. On drop or cancel (Escape), opacity restores to normal.
**Why human:** Opacity visual effect and timing need real-eye verification

### 3. FLIP Animation Smoothness

**Test:** Drop a header at a new position within the same dimension
**Expected:** Headers and data cells animate smoothly from old positions to new positions over ~200ms with ease-out easing. No visual glitches, no flashing.
**Why human:** Animation quality, smoothness, and timing feel cannot be verified programmatically

### 4. Cross-dimension Transpose Animation

**Test:** Drag a column header grip to the row header drop zone
**Expected:** FLIP animation plays for the layout change as axes swap dimensions. Collapse state resets (setColAxes/setRowAxes used). colWidths and sortOverrides reset.
**Why human:** Cross-dimension layout shift is a major visual change requiring eye verification

### Gaps Summary

No gaps found. All 12 observable truths verified. All 5 required artifacts exist, are substantive, and are wired. All key links are connected. Both requirement IDs (DRAG-REORDER-BACKEND, DRAG-REORDER-VISUAL) are satisfied. All 4 commits verified in git log. 501 combined tests pass (157 PAFVProvider + 344 SuperGrid). No anti-patterns detected in Phase 31 code.

---

_Verified: 2026-03-06T21:47:00Z_
_Verifier: Claude (gsd-verifier)_
