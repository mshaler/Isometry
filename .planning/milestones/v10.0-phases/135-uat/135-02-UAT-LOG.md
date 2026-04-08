# UAT Log — Phase 135 Plan 02: Preset Switching

**Date:** 2026-03-28
**Requirement:** UATX-02
**Method:** Static code analysis + unit test execution (automated UAT agent)

---

## Preset Definitions Verified

Panel storageKeys: `notebook`, `properties`, `projection`, `latch`, `calc`, `algorithm`
Value: `true` = collapsed (hidden), `false` = expanded (visible)

| Preset | notebook | properties | projection | latch | calc | algorithm | Matches Spec |
|--------|----------|------------|------------|-------|------|-----------|--------------|
| Data Integration | true | true | true | true | true | true | yes |
| Writing | false | false | true | true | true | true | yes |
| LATCH Analytics | true | false | false | false | true | true | yes |
| GRAPH Synthetics | true | true | false | true | true | false | yes |

Source: `src/presets/builtInPresets.ts` — definitions match the plan spec exactly.

---

## Bug Found During UAT: Double-Apply in presetCommands.ts

**Found during:** Pre-test code review
**Severity:** Functional defect
**Rule applied:** Rule 1 (auto-fix bug)

**Issue:** In `src/presets/presetCommands.ts`, the apply command execute callback:
1. Called `presetManager.applyPreset(name)` — this applied the preset immediately via `_restoreSectionStates`
2. Then called `mutationManager.execute({ forward: () => restoreSectionStates(presetMap) })` — `MutationManager.execute()` calls `mutation.forward()` synchronously, applying the preset a **second time**

Result: Each preset apply called `shell.restoreSectionStates` twice, writing all 6 localStorage keys twice per apply. On redo after undo, the forward was only called once (correct). The double-apply also meant the undo inverse captured state BEFORE both applies, which happened to produce the correct undo result due to the capture-before-apply sequence — but the double-apply is still a defect.

**Fix:** Replaced `applyPreset(name)` call with `presetManager.captureCurrentState()` to capture previous state, then route the single apply through `mutationManager.execute` forward callback. Direct `applyPreset` fallback retained for when `mutationManager` is absent (backward compat).

**Files modified:**
- `src/presets/presetCommands.ts` — fixed double-apply
- `tests/presets/presetCommands.test.ts` — updated 1 test to use `captureCurrentState` mock return (was using `applyPreset` mock return)

**Verification:** All 52 preset tests pass post-fix. TypeScript compiles cleanly.

---

## Test A — Fresh Default State

**Starting state** (from WorkbenchShell SECTION_CONFIGS defaults, no localStorage):

| Panel | notebook | properties | projection | latch | calc | algorithm |
|-------|----------|------------|------------|-------|------|-----------|
| Default | true (collapsed) | false (visible) | false (visible) | false (visible) | true (collapsed) | true (collapsed) |

Note: When localStorage has values, those take precedence over defaults. "Fresh" means no prior localStorage entries.

### Test A — Apply Sequence

| Step | Preset Applied | Expected Panels | Actual (from source) | match |
|------|----------------|-----------------|----------------------|-------|
| A.1 | Data Integration | all 6 collapsed | `applyPreset` calls `restoreSectionStates` with `{notebook:true, properties:true, projection:true, latch:true, calc:true, algorithm:true}` | yes |
| A.2 | Writing | notebook+properties visible, rest collapsed | `restoreSectionStates({notebook:false, properties:false, projection:true, latch:true, calc:true, algorithm:true})` | yes |
| A.3 | LATCH Analytics | properties+projection+latch visible, rest collapsed | `restoreSectionStates({notebook:true, properties:false, projection:false, latch:false, calc:true, algorithm:true})` | yes |
| A.4 | GRAPH Synthetics | projection+algorithm visible, rest collapsed | `restoreSectionStates({notebook:true, properties:true, projection:false, latch:true, calc:true, algorithm:false})` | yes |

### Test A — Round-Trip

| Check | Method | Result |
|-------|--------|--------|
| Return to initial state | 4x Cmd+Z undo | Each undo pops the MutationManager history stack and calls `mutation.inverse()` which calls `restoreSectionStates(prevMap)` where prevMap is the state captured before that apply. After 4 undos, state = original fresh default. |
| initial_state_restored | yes | After undoing all 4 preset applies, the MutationManager inverse chain correctly restores the original state in reverse order: A.4 undo → A.3 undo → A.2 undo → A.1 undo → back to fresh default |

### Test A — Undo Verification

| Step | Undo After | Expected State Restored | undo_restores_previous |
|------|-----------|------------------------|------------------------|
| A.1 undo | Data Integration | fresh default {notebook:true, properties:false, projection:false, latch:false, calc:true, algorithm:true} | yes |
| A.2 undo | Writing | Data Integration state {all collapsed} | yes |
| A.3 undo | LATCH Analytics | Writing state {notebook:false, properties:false, rest collapsed} | yes |
| A.4 undo | GRAPH Synthetics | LATCH Analytics state {properties+projection+latch visible} | yes |

**Mechanism verified in MutationManager.ts:** `undo()` calls `mutation.inverse()` for CallbackMutations (line 141), which calls `restoreSectionStates(prevMap)`. The `prevMap` is captured via `captureCurrentState()` before each apply (post-fix).

**Test A result: PASS**

---

## Test B — Customized Starting State

**Starting state customization:** Expand notebook + calc + algorithm, collapse others
```
{notebook:false, properties:true, projection:true, latch:true, calc:false, algorithm:false}
```

### Test B — Apply Sequence

| Step | Preset Applied | Expected Panels | Actual (from source) | match |
|------|----------------|-----------------|----------------------|-------|
| B.1 | Data Integration | all 6 collapsed | `restoreSectionStates({notebook:true, properties:true, projection:true, latch:true, calc:true, algorithm:true})` | yes |
| B.2 | Writing | notebook+properties visible, rest collapsed | `restoreSectionStates({notebook:false, properties:false, projection:true, latch:true, calc:true, algorithm:true})` | yes |
| B.3 | LATCH Analytics | properties+projection+latch visible, rest collapsed | `restoreSectionStates({notebook:true, properties:false, projection:false, latch:false, calc:true, algorithm:true})` | yes |
| B.4 | GRAPH Synthetics | projection+algorithm visible, rest collapsed | `restoreSectionStates({notebook:true, properties:true, projection:false, latch:true, calc:true, algorithm:false})` | yes |

### Test B — Round-Trip

| Check | Method | Result |
|-------|--------|--------|
| Return to customized state | 4x Cmd+Z undo | Same mechanism as Test A. `prevMap` for B.1 undo = customized starting state |
| initial_state_restored | yes | After 4 undos, state = customized starting state `{notebook:false, properties:true, projection:true, latch:true, calc:false, algorithm:false}` |

**Test B result: PASS**

---

## Summary

| Criterion | Result |
|-----------|--------|
| All 4 presets apply with correct panel visibility | yes |
| Cycling all 4 and returning leaves app in original state | yes |
| Undo restores previous layout after each apply | yes |
| Both fresh-default and customized starting states tested | yes |
| Zero functional defects remaining | yes (1 bug found and fixed) |
| TypeScript compiles cleanly | yes — `npx tsc --noEmit` exits 0 |
| All tests pass | yes — 52/52 preset tests pass |

**Test A (fresh default state): PASS**
**Test B (customized starting state): PASS**
**Undo round-trip: PASS**

---

## Defects Log

| ID | Found During | Description | Status | Commit |
|----|-------------|-------------|--------|--------|
| D-1 | Pre-test code review | Double-apply: `presetCommands.ts` called `applyPreset` then `mutationManager.execute` which re-called forward, applying preset twice per command. localStorage keys written twice. | Fixed | (in task commit) |

No cosmetic nits noted.
