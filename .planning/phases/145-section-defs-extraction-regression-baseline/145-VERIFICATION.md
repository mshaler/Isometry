---
phase: 145-section-defs-extraction-regression-baseline
verified: 2026-04-09T10:42:00Z
status: gaps_found
score: 5/6 must-haves verified
re_verification: false
gaps:
  - truth: "TypeScript compile exits 0 (plan acceptance criterion)"
    status: failed
    reason: "tests/shortcuts/shortcut-regression.test.ts introduces 3 TS2348 errors — vi.fn() typed mocks called directly, causing 'Value of type Mock<Procedure | Constructable> is not callable' at lines 264, 265, 267"
    artifacts:
      - path: "tests/shortcuts/shortcut-regression.test.ts"
        issue: "Lines 264-267: mockSetActiveItem, mockGetViewContentEl, mockSwitchTo typed as ReturnType<typeof vi.fn> which resolves to a union type that TS cannot call without narrowing — requires explicit typing as Mock<(...args: unknown[]) => unknown> or use of vi.fn<[], void>() style generics"
    missing:
      - "Fix vi.fn() type annotations in the integration describe block's beforeEach to use callable typed generics so tsc --noEmit exits 0"
human_verification:
  - test: "Verify Cmd+1-9 shortcuts work end-to-end in the running app"
    expected: "Each Cmd+N keystroke activates the corresponding view (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid) without regression"
    why_human: "Integration tests mock the view switch — actual WKWebView/DOM wiring cannot be verified programmatically without running the app"
---

# Phase 145: SECTION_DEFS Extraction + Regression Baseline Verification Report

**Phase Goal:** Shared section/item key constants are extracted and keyboard shortcuts have test coverage before any navigation swap begins
**Verified:** 2026-04-09T10:42:00Z
**Status:** gaps_found — 1 gap blocking clean build (TypeScript errors in test file)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SECTION_DEFS, SidebarItemDef, SidebarSectionDef, viewOrder, and DOCK_DEFS are all exported from src/ui/section-defs.ts | VERIFIED | All 5 exports confirmed present in file (lines 16, 22, 34, 115, 131, 137) |
| 2   | SidebarNav.ts contains zero local const/interface definitions for section/item data — all imported from section-defs.ts | VERIFIED | `const SECTION_DEFS` = 0 occurrences; `interface SidebarItemDef` = 0 occurrences; `interface SidebarSectionDef` = 0 occurrences. Remaining `'visualization'` string literals are lookup comparisons, not data definitions. |
| 3   | main.ts imports viewOrder from section-defs.ts — no local viewOrder array | VERIFIED | `import { viewOrder } from './ui/section-defs'` at line 58; `const viewOrder` = 0 occurrences |
| 4   | All 9 Cmd+1-9 shortcuts have individual unit test cases that pass | VERIFIED | 9 individual `it('Cmd+N...')` blocks in unit describe — all 9 pass green |
| 5   | All 9 Cmd+1-9 shortcuts have individual integration test cases that pass | VERIFIED | 9 individual `it('Cmd+N...')` blocks in integration describe — all 9 pass green |
| 6   | TypeScript compiles clean (`npx tsc --noEmit` exits 0) | FAILED | 3 TS2348 errors in tests/shortcuts/shortcut-regression.test.ts lines 264-267: vi.fn() typed mocks not callable without type narrowing |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/ui/section-defs.ts` | Shared section/item key constants and dock taxonomy | VERIFIED | 179 lines, exports SidebarItemDef, SidebarSectionDef, SECTION_DEFS, viewOrder, DockSectionDef, DOCK_DEFS |
| `tests/shortcuts/shortcut-regression.test.ts` | Cmd+1-9 regression tests (min 150 lines) | VERIFIED (with gap) | 335 lines, 20 tests all pass; 3 TypeScript type errors at lines 264-267 |
| `src/ui/SidebarNav.ts` | Imports from section-defs, no local definitions | VERIFIED | Line 18: `import { SECTION_DEFS, type SidebarItemDef, type SidebarSectionDef } from './section-defs'` |
| `src/main.ts` | Imports viewOrder from section-defs, no local definition | VERIFIED | Line 58: `import { viewOrder } from './ui/section-defs'`; no `const viewOrder` local definition |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/ui/SidebarNav.ts` | `src/ui/section-defs.ts` | `import { SECTION_DEFS, type SidebarItemDef, type SidebarSectionDef }` | WIRED | Line 18, pattern matches exactly |
| `src/main.ts` | `src/ui/section-defs.ts` | `import { viewOrder }` | WIRED | Line 58, viewOrder used in shortcut loop (line 376) and command loop (line 415) |
| `tests/shortcuts/shortcut-regression.test.ts` | `src/ui/section-defs.ts` | `import { viewOrder }` | WIRED | Line 10, viewOrder used in both describe blocks |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces static constant modules (no dynamic data rendering). section-defs.ts contains only exported TypeScript constant arrays and interfaces. No state, no fetch, no DOM rendering.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 20 regression tests pass | `npx vitest run tests/shortcuts/shortcut-regression.test.ts` | 20/20 pass, 169ms | PASS |
| TypeScript compile clean | `npx tsc --noEmit` | 3 errors in shortcut-regression.test.ts lines 264-267 | FAIL |
| SECTION_DEFS removed from SidebarNav | `grep -c 'const SECTION_DEFS' src/ui/SidebarNav.ts` | 0 | PASS |
| viewOrder removed from main.ts | `grep -c 'const viewOrder' src/main.ts` | 0 | PASS |
| All exports present in section-defs.ts | grep exports | 1 each for SECTION_DEFS, viewOrder, DOCK_DEFS, SidebarItemDef, SidebarSectionDef | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DOCK-06 | 145-01-PLAN.md | User can use existing keyboard shortcuts (Cmd+1-9) to activate dock items without regression | SATISFIED (pending TS fix) | 20 regression tests cover all 9 bindings at unit+integration levels; all pass; TypeScript error is in test typing, not in shortcut behavior itself |

No orphaned requirements — REQUIREMENTS.md maps DOCK-06 to Phase 145 only, and the plan claims exactly DOCK-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/shortcuts/shortcut-regression.test.ts` | 264-267 | `vi.fn()` mocks typed as `ReturnType<typeof vi.fn>` not callable by TypeScript (TS2348) | Warning | Causes `tsc --noEmit` to fail (plan acceptance criterion unmet); tests still execute and pass at runtime |

### Human Verification Required

#### 1. Live keyboard shortcut behavior

**Test:** Open the running app, press Cmd+1 through Cmd+9 in sequence
**Expected:** Each keystroke activates the corresponding view: list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid — no visual regressions, no mismatched activations
**Why human:** Integration tests mock the view switch. The real `viewManager.switchTo` and `sidebarNav.setActiveItem` wiring through the DOM cannot be verified without running the app.

### Gaps Summary

One gap blocks the plan's stated acceptance criterion: `npx tsc --noEmit` does not exit 0. Three TypeScript errors (TS2348) appear in `tests/shortcuts/shortcut-regression.test.ts` at lines 264-267. The mocks are declared as `ReturnType<typeof vi.fn>` which Vitest resolves to `Mock<Procedure | Constructable>` — a union type TypeScript cannot invoke without a call signature narrowing.

The fix is straightforward: add explicit type parameters to the `vi.fn()` declarations in the integration describe block's `beforeEach`:

```typescript
// Instead of:
mockSetActiveItem = vi.fn();
mockSwitchTo = vi.fn(() => Promise.resolve());
mockGetViewContentEl = vi.fn(() => ({ style: { opacity: '1' } }));

// Use typed generics:
mockSetActiveItem = vi.fn<[string, string], void>();
mockSwitchTo = vi.fn<[string], Promise<void>>(() => Promise.resolve());
mockGetViewContentEl = vi.fn<[], { style: { opacity: string } }>(() => ({ style: { opacity: '1' } }));
```

All 20 tests pass at runtime. All production code (section-defs.ts, SidebarNav.ts, main.ts) compiles without error. The TypeScript errors are isolated to the test file.

The extraction goal — clean module boundary for Phase 146 DockNav to consume — is fully achieved. The gap is a test file typing issue, not a behavioral regression.

---

_Verified: 2026-04-09T10:42:00Z_
_Verifier: Claude (gsd-verifier)_
