---
phase: 108
plan: 01
title: "Remove ViewZipper and consolidate into SidebarNav"
subsystem: ui-navigation
tags: [navigation, sidebar, view-switching, cleanup, crossfade]
dependency_graph:
  requires: []
  provides: [consolidated-view-navigation]
  affects: [src/main.ts, src/ui/SidebarNav.ts]
tech_stack:
  added: []
  patterns: [single-source-of-truth navigation, crossfade opacity transition]
key_files:
  created: []
  modified:
    - src/ui/SidebarNav.ts
    - src/main.ts
    - src/styles/workbench.css
  deleted:
    - src/ui/ViewZipper.ts
    - src/styles/view-zipper.css
decisions:
  - SidebarNav Visualization Explorer section now defaults to expanded (data-state=visible) so view items are immediately visible without user interaction
  - view-crossfade CSS class replaces vzip-transition-frame — rule moved to workbench.css (no more view-zipper.css dependency)
  - All 3 view-switch paths (sidebar click, Cmd+1-9 shortcut, command palette) apply identical crossfade pattern directly
  - ViewZipper autocycle feature removed entirely — no replacement needed (sidebar is persistent navigation, not a carousel)
metrics:
  duration_seconds: 389
  completed_date: "2026-03-21"
  tasks_completed: 5
  files_changed: 5
requirements: [NAV-01, NAV-02, NAV-03, NAV-04, NAV-05]
---

# Phase 108 Plan 01: Remove ViewZipper and consolidate into SidebarNav Summary

**One-liner:** Deleted ViewZipper horizontal tab strip and its CSS; SidebarNav Visualization Explorer is now the sole view-switch UI with crossfade on all three paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Default Visualization section to expanded | 3c4c22cc | src/ui/SidebarNav.ts |
| 2 | Migrate crossfade class to workbench.css | 3e6062f2 | src/main.ts, src/styles/workbench.css |
| 3 | Remove all ViewZipper wiring from main.ts | 84c7f3b3 | src/main.ts |
| 4 | Delete ViewZipper files | 0f6e9e75 | src/ui/ViewZipper.ts (del), src/styles/view-zipper.css (del) |
| 5 | Crossfade on Cmd+1-9 and command palette paths | 84c7f3b3 | src/main.ts (inline with Task 3) |

## Implementation Notes

### Task 1: SidebarNav default expansion

`_buildSection()` now computes `initialState = def.key === 'visualization' ? 'visible' : 'collapsed'` before setting `data-state` and `aria-expanded`. All other sections remain collapsed.

### Task 2: Crossfade migration

`.vzip-transition-frame` renamed to `.view-crossfade` in both `main.ts` and `workbench.css`. The single CSS rule `transition: opacity 300ms ease` is now in `workbench.css`.

### Task 3 + 5: ViewZipper removal and crossfade parity

Eight changes to `main.ts`:
1. Import removed
2. `let viewZipper: ViewZipper` forward declaration removed
3. Cmd+1-9 shortcuts: `viewZipper?.setActive()` → `sidebarNav.setActiveItem()` + full crossfade pattern
4. CommandRegistry view commands: same replacement
5. ViewZipper creation block (Step 9b) removed; `viewContentEl` + `view-crossfade` class wiring kept
6. `onActivateItem`: `viewZipper?.stopCycle()` removed
7. `onViewSwitch`: `viewZipper.setActive()` removed (sidebarNav already called on next line)
8. `window.__isometry`: `viewZipper` property removed

### Task 4: File deletion

Both `src/ui/ViewZipper.ts` and `src/styles/view-zipper.css` deleted. Confirmed zero remaining imports via `grep`.

## Verification Results

- `npx tsc --noEmit` → exit 0 (no errors in src/ or committed tests/)
- `grep -r "ViewZipper|viewZipper|view-zipper|vzip" src/` → 0 results
- `src/ui/ViewZipper.ts` does not exist
- `src/styles/view-zipper.css` does not exist
- `.view-crossfade { transition: opacity 300ms ease; }` in `workbench.css`
- `visualization.*visible` in `SidebarNav.ts` _buildSection()
- All 3 view-switch paths have `viewContentEl.style.opacity = '0'` and `.then(() => { viewContentEl.style.opacity = '1'; })`

## Deviations from Plan

None - plan executed exactly as written. Task 5 (crossfade on Cmd+1-9) was completed inline during Task 3 as they both modified the same sections of main.ts.

## Pre-existing Issues (Out of Scope)

- TypeScript error in `tests/views/pivot/helpers/makePluginHarness.ts` (untracked WIP file from Phase 104 work-in-progress) — not caused by this plan
- 78 failing tests in 9 test files (pre-existing, confirmed by stash test): source-view-matrix, dataset-eviction, NotebookExplorer, ListView, GalleryView, etc. — none reference ViewZipper

## Self-Check: PASSED

- [x] src/ui/SidebarNav.ts modified (visualization defaults to visible)
- [x] src/styles/workbench.css has .view-crossfade rule
- [x] src/main.ts has zero ViewZipper references
- [x] src/ui/ViewZipper.ts deleted
- [x] src/styles/view-zipper.css deleted
- [x] Commits 3c4c22cc, 3e6062f2, 84c7f3b3, 0f6e9e75 exist in git log
