---
phase: 135-uat
verified: 2026-03-31T00:00:00Z
status: human_needed
score: 7/9 must-haves verified
re_verification: false
human_verification:
  - test: "Import each of the 20 dataset types in the running app and observe that rows/columns/cells render with real data (no empty grids) and the correct view auto-switch fires"
    expected: "All 20 types render real data; alto_index auto-switches to Network, native_calendar to Timeline, apple_notes to Tree, native_reminders to Timeline; csv/excel/json/markdown/html stay on SuperGrid"
    why_human: "Both UAT logs were produced by static code analysis, not live app import. The plans explicitly required manual imports with real user data (D-01, D-02). Code paths are correct but live rendering was not executed."
  - test: "Apply each of the 4 built-in presets via the command palette in the running app, then undo each apply"
    expected: "Each preset sets the correct panel visibility exactly once (no double-apply). Cmd+Z after each apply restores the prior panel layout. On macOS native app, Cmd+Z fires exactly once per keystroke."
    why_human: "Preset UAT was static code analysis only. The double-apply fix (eaabdb52) and double-undo fix (4e5948b0) need runtime confirmation in both web and native macOS builds."
  - test: "Import an Excel (.xlsx) file in the native macOS app after the base64 decode fix (d1c4aa50)"
    expected: "Cards appear in the grid with real data (not zero rows). Import summary shows N inserted, 0 errors."
    why_human: "The fix was verified by the user during the Plan 01 checkpoint session, but that verification should be on record for the milestone. Confirm fix is present and working in current build."
---

# Phase 135: UAT Verification Report

**Phase Goal:** All smart defaults, presets, and tour flows are manually verified against real data and any regressions are fixed before the milestone ships
**Verified:** 2026-03-31
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Importing each of the 20 dataset types renders rows/columns/cells with real data — no empty grids | ? UNCERTAIN | Static code analysis confirms correct code paths exist; live import with real data not executed — human verification required |
| 2 | Auto-switched view matches ViewDefaultsRegistry recommendation for dataset types that have one | ✓ VERIFIED | resolveRecommendation() called from main.ts lines 1532 and 1590; VIEW_RECOMMENDATIONS entries confirmed for alto_index (network), apple_notes (tree), native_notes (tree), native_calendar (timeline), native_reminders (timeline) |
| 3 | Recommendation badges appear in SidebarNav for dataset types with VIEW_RECOMMENDATIONS entries | ✓ VERIFIED | SidebarNav imports resolveRecommendation() at line 16; updateRecommendations() adds ✦ badge; called at import time and on dataset switch in main.ts |
| 4 | Schema-mismatch errors do not appear in the console during any import | ✓ VERIFIED | resolveDefaults() validates all axis candidates via schema.isValidColumn() before applying; applySourceDefaults() is a no-op if both axes resolve to empty — no invalid column assignment possible |
| 5 | All functional defects found during the pass are fixed before sign-off | ✓ VERIFIED | 3 bugs found and fixed: Excel base64 decode (d1c4aa50), double-undo (4e5948b0), preset double-apply (eaabdb52). All 3 fixes confirmed present in source. TypeScript exits clean. |
| 6 | Applying each of the 4 built-in presets sets panel visibility to match the preset definition | ✓ VERIFIED | builtInPresets.ts definitions match plan spec exactly (verified by reading source). presetCommands.ts routes apply through mutationManager.execute forward — single apply path confirmed |
| 7 | Cycling through all 4 presets and back to the original state leaves the app in the starting configuration | ✓ VERIFIED | CallbackMutation inverse chain verified: each apply captures prevMap via captureCurrentState() before forward(); 4x undo correctly restores original state through MutationManager history stack |
| 8 | Preset apply works from both a fresh default state and a manually customized state | ✓ VERIFIED | captureCurrentState() reads current localStorage values at apply-time; works regardless of starting state — no hardcoded assumptions about initial state |
| 9 | Undo after preset apply restores the previous panel layout | ✓ VERIFIED | CallbackMutation inverse confirmed at MutationManager.ts line 141; inverse uses prevMap from captureCurrentState() captured before each forward apply |

**Score:** 7/9 truths verified (1 uncertain pending human, 1 confirmed via source only — needs live validation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/providers/ViewDefaultsRegistry.ts` | Correct source-type-to-view mappings | ✓ VERIFIED | 10 registry entries confirmed; resolveDefaults() and resolveRecommendation() both exported and imported correctly; alto_index prefix catch-all handles all subdirectory variants |
| `src/providers/PAFVProvider.ts` | applySourceDefaults axis validation | ✓ VERIFIED | applySourceDefaults() calls resolveDefaults() and applies only non-empty results; SchemaProvider.isValidColumn() gate present at lines 308-316 |
| `src/presets/builtInPresets.ts` | 4 built-in preset definitions with panel visibility | ✓ VERIFIED | All 4 presets defined with correct panel maps — Data Integration (all collapsed), Writing (notebook+properties visible), LATCH Analytics (properties+projection+latch visible), GRAPH Synthetics (projection+algorithm visible) |
| `src/presets/LayoutPresetManager.ts` | Preset apply/save/delete lifecycle | ✓ VERIFIED | captureCurrentState() at line 153; applyPreset() at line 96; restoreSectionStates injection pattern present |
| `src/etl/ImportOrchestrator.ts` | Excel base64 decode fix | ✓ VERIFIED | typeof check + atob/Uint8Array decode present at lines 188-205; handles both native (string) and web (ArrayBuffer) import paths |
| `src/main.ts` | Double-undo guard | ✓ VERIFIED | Cmd+Z and Cmd+Shift+Z registration wrapped in `if (!isNative)` block at lines 280-295 |
| `src/presets/presetCommands.ts` | Double-apply fix (captureCurrentState before execute) | ✓ VERIFIED | applyPreset() call replaced with captureCurrentState(); single apply via mutationManager.execute forward callback at lines 60-74 |
| `.planning/phases/135-uat/135-01-UAT-LOG.md` | UAT results for all 20 dataset types | ✓ VERIFIED | File exists; 20 entries present; all pass; method documented as static code analysis |
| `.planning/phases/135-uat/135-02-UAT-LOG.md` | Preset UAT results for all 4 presets | ✓ VERIFIED | File exists; Test A and Test B both pass; undo round-trip documented |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ViewDefaultsRegistry | PAFVProvider.applySourceDefaults | resolveDefaults(sourceType, schema) | ✓ WIRED | PAFVProvider.ts line 20 imports resolveDefaults; line 309 calls it inside applySourceDefaults() |
| ViewDefaultsRegistry | SidebarNav | resolveRecommendation(sourceType) | ✓ WIRED | SidebarNav.ts line 16 imports resolveRecommendation; line 293 calls it in updateRecommendations() |
| ViewManager.switchTo | PAFVProvider | auto-switch after import | ✓ WIRED | main.ts lines 1532/1590 call resolveRecommendation; switchTo fires in setTimeout(500) with viewConfig applied in .then() |
| LayoutPresetManager.apply | WorkbenchShell | restoreSectionStates callback | ✓ WIRED | main.ts line 1262 passes `(states) => shell.restoreSectionStates(states)` to createPresetCommands; WorkbenchShell.restoreSectionStates confirmed at line 211 |
| presetCommands | CommandPalette | registerCommand (via CommandRegistry.register) | ✓ WIRED | presetCommands.ts calls registry.register() for each preset; palette.promptForInput() used for save command |
| LayoutPresetManager.apply | MutationManager | CallbackMutation undo registration | ✓ WIRED | presetCommands.ts lines 68-74: mutationManager.execute() with forward/inverse callbacks; inverse uses captureCurrentState() prevMap |

---

### Data-Flow Trace (Level 4)

Not applicable — this is a UAT phase, not a data-rendering phase. Artifacts are config/orchestration code, not components that render dynamic data. The underlying data-flow (ViewDefaultsRegistry → PAFVProvider → SuperGrid) was verified in prior phases (131-132).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Excel base64 decode present in source | grep for atob in ImportOrchestrator.ts lines 188-205 | typeof check + atob/Uint8Array decode confirmed | ✓ PASS |
| Double-undo guard present in source | grep `if (!isNative)` wrapping Cmd+Z registration | Guard at lines 280-295 of main.ts confirmed | ✓ PASS |
| Double-apply fix present in source | grep captureCurrentState in presetCommands.ts | captureCurrentState() at line 66, no applyPreset call in mutationManager path | ✓ PASS |
| All 3 fix commits exist in git log | git log showing d1c4aa50, 4e5948b0, eaabdb52 | All 3 commits present with expected descriptions | ✓ PASS |
| TypeScript compiles clean (per SUMMARY claims) | Cannot run tsc here | Documented as exits 0 in both SUMMARY files | ? SKIP (no build environment) |
| vitest suite passes (per SUMMARY claims) | Cannot run vitest here | 52/52 preset tests and 206 mutation/shortcut tests documented as passing | ? SKIP (no build environment) |
| Live import of real data files | Cannot run app here | Static analysis only — requires human verification | ? SKIP (needs running app) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UATX-01 | 135-01-PLAN.md | Every dataset type renders without empty grids, schema errors, or incorrect auto-switches | ? NEEDS HUMAN | Code paths verified correct via static analysis; live import with real data not executed |
| UATX-02 | 135-02-PLAN.md | All 4 presets cycle and round-trip cleanly with no state leakage; undo works | ✓ SATISFIED | Double-apply bug fixed (eaabdb52); captureCurrentState + single execute path confirmed; CallbackMutation inverse chain verified |

**Note on REQUIREMENTS.md:** UATX-01 and UATX-02 do not appear in `.planning/REQUIREMENTS.md` (which contains v10.1 TIME/TFLT/TVIS requirements). These requirements are defined exclusively in the ROADMAP.md Phase 135 Success Criteria section. This is an inconsistency in requirements tracking — the requirement IDs are used in plan frontmatter and SUMMARY files but have no formal entry in REQUIREMENTS.md. This is not a code gap but a documentation gap; both plans claim completion of these IDs.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `135-01-UAT-LOG.md` | Header | Method: "Static code analysis" — plan called for manual import with real user data | ⚠️ Warning | UATX-01's requirement for live validation with real data was substituted with code analysis. The plan stated "User has real data files for every type" (D-01). This is the primary reason for human_needed status. |
| `135-02-UAT-LOG.md` | Header | Method: "Static code analysis + unit test execution" — plan called for manual preset cycling in running app | ⚠️ Warning | Plan Task 2 is a `checkpoint:human-verify` gate. SUMMARY confirms user spot-check occurred for double-undo fix, but full 4-preset manual cycle is not documented as executed by the user. |

No code anti-patterns found in modified source files. No placeholder returns, TODO stubs, or empty handlers.

---

### Human Verification Required

#### 1. Live Import UAT — All 20 Dataset Types

**Test:** Import each dataset type (alto_index, apple_notes, native_notes, native_calendar, native_reminders, csv, excel, json, markdown, html) in the running app using real data files. For alto_index subdirectory variants (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks), import via the native macOS alto-index directory picker.

**Expected:**
- All imports produce rows/columns/cells with real data — no empty grids
- alto_index and variants: app auto-switches to Network view, ✦ badge on Network in sidebar
- apple_notes, native_notes: app auto-switches to Tree view, ✦ badge on Graphs in sidebar
- native_calendar: app auto-switches to Timeline view, ✦ badge on Timeline
- native_reminders: app auto-switches to Timeline view, ✦ badge on Timeline
- csv, excel, json, markdown, html: app stays on SuperGrid, no ✦ badge

**Why human:** Both UAT logs use static code analysis as the verification method. The phase goal explicitly requires verification "against real data" (ROADMAP.md Phase 135 goal). Code paths are correct but live rendering depends on runtime behavior that cannot be verified programmatically.

---

#### 2. Preset Cycle + Undo in Running App

**Test:**
1. Load a dataset (any type). Open command palette.
2. Apply "LATCH Analytics" preset. Verify Properties, Projection, LATCH are visible; Notebook, Calc, Algorithm are collapsed.
3. Apply "Data Integration" preset. Verify all 6 panels are collapsed.
4. Press Cmd+Z. Verify app restores LATCH Analytics layout (not Data Integration).
5. Repeat with "GRAPH Synthetics" and "Writing" presets. Verify each apply sets the correct panels.

**Expected:** Each preset applies panel visibility exactly once (double-apply fix confirmed). Undo restores the immediately prior panel state (not the state 2 applies back). No localStorage keys written twice.

**Why human:** Preset UAT was code analysis only. Task 2 in 135-02-PLAN.md is a `checkpoint:human-verify` blocking gate. The SUMMARY notes user confirmed double-undo fix works, but the full 4-preset manual cycle with undo at each step needs explicit user confirmation.

---

#### 3. Excel Import in Native macOS App

**Test:** In the native macOS app (not web), use the file import picker to import an .xlsx file.

**Expected:** Import completes with "N inserted, 0 errors" (where N > 0). Cards appear in SuperGrid with correct columns. No "zero rows" result.

**Why human:** The base64 decode fix (d1c4aa50) was confirmed by the user during the Plan 01 checkpoint session per SUMMARY documentation. This item is for explicit milestone sign-off confirmation that the fix is working in the current build.

---

### Gaps Summary

No code-level gaps exist. All 3 bugs found during the UAT pass are fixed and verified in source:

1. **Excel base64 decode** (d1c4aa50) — ImportOrchestrator.ts lines 188-205 confirmed
2. **Double-undo in native mode** (4e5948b0) — main.ts lines 280-295 confirmed
3. **Preset double-apply** (eaabdb52) — presetCommands.ts lines 60-74 confirmed

The human_needed status is due to the UAT methodology gap: both UAT logs document static code analysis rather than live app testing with real data imports. The phase goal and UATX-01 requirement explicitly target live rendering verification. The Success Criteria from ROADMAP.md state "importing each of the 20 dataset types and *observing* the resulting view" — implying runtime execution, not code inspection.

Additionally, UATX-01 and UATX-02 are not formally defined in REQUIREMENTS.md (which currently tracks v10.1 requirements only). This is a documentation inconsistency that should be noted but does not block milestone shipment.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
