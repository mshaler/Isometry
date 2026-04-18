---
phase: 158-explorer-accessibility-event-delegation
plan: "01"
subsystem: ui
tags: [accessibility, aria, event-delegation, latch-explorers]
dependency_graph:
  requires: []
  provides: [EXPX-01, EXPX-10]
  affects: [src/ui/LatchExplorers.ts]
tech_stack:
  added: []
  patterns: [event-delegation, aria-listbox-option, delegated-click]
key_files:
  created:
    - tests/seams/ui/latch-explorers-a11y.test.ts
  modified:
    - src/ui/LatchExplorers.ts
decisions:
  - "Event delegation replaces per-chip D3 .on('click') — single addEventListener on chipContainer uses closest('.latch-explorers__chip') for chip resolution"
  - "role=listbox on container, role=option on chips — standard WAI-ARIA multi-select listbox pattern"
  - "_syncChipStates sets aria-selected alongside CSS class in the same pass"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17"
  tasks_completed: 1
  files_modified: 2
---

# Phase 158 Plan 01: LatchExplorers ARIA + Event Delegation Summary

**One-liner:** ARIA-compliant chip listbox with aria-selected state and event delegation replacing per-chip D3 click handlers.

## What Was Built

Added WAI-ARIA accessibility attributes to LatchExplorers category/hierarchy chip pills and migrated per-chip click handlers to event delegation.

### Changes to `src/ui/LatchExplorers.ts`

**`_createChipGroup()` — ARIA attributes + delegated handler:**
- `chipContainer.setAttribute('role', 'listbox')` — marks the chip list as a listbox widget
- `chipContainer.setAttribute('aria-multiselectable', 'true')` — signals multi-select semantics
- `chipContainer.setAttribute('aria-label', '${fieldDisplayName(field)} filter')` — descriptive label for screen readers
- Single `addEventListener('click', ...)` on container using `(e.target as Element).closest('.latch-explorers__chip')` + `chip.dataset['value']` for delegation

**`_renderChips()` — chip ARIA attributes:**
- Added `.attr('role', 'option')` in enter selection
- Added `.attr('data-value', d => d.value)` for delegation targeting
- Added `.attr('aria-selected', d => String(activeValues.includes(d.value)))` in both enter and update selections
- Removed `.on('click', ...)` from enter selection — delegation on container replaces it

**`_syncChipStates()` — aria-selected sync on filter change:**
- After toggling CSS class, also calls `chip.setAttribute('aria-selected', String(isActive))` in the same pass

### New file: `tests/seams/ui/latch-explorers-a11y.test.ts`

13 tests covering:
- `EXPX-01: chip container ARIA attributes` (role, aria-multiselectable, aria-label)
- `EXPX-01: individual chip ARIA attributes` (role=option, data-value, aria-selected)
- `EXPX-01: _syncChipStates updates aria-selected` (reactive update on filter toggle)
- `EXPX-10: event delegation on chip container` (click adds/removes filter, closest() via child span, no-op on container background)

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 20ffce63 | test | Add failing ARIA and event delegation tests for LatchExplorers chips |
| e9082f8b | feat | Add ARIA attributes and event delegation to LatchExplorers chips |

## Verification

- `npx vitest run tests/seams/ui/latch-explorers-a11y.test.ts`: 13/13 passed
- `npx tsc --noEmit`: zero errors
- Full suite failures are isolated to another parallel agent's worktree (agent-ab3b7232), not caused by these changes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all chip ARIA attributes are fully wired with real FilterProvider state.

## Self-Check: PASSED

- `tests/seams/ui/latch-explorers-a11y.test.ts` exists: FOUND
- `src/ui/LatchExplorers.ts` modified: FOUND
- Commit 20ffce63 exists: FOUND
- Commit e9082f8b exists: FOUND
