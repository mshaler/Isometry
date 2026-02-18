---
phase: 114-timeline-preview-integration
plan: 03
subsystem: timeline-preview
tags: [timeline, collision, usePreviewSettings, zoom-restore, gap-closure]
dependency_graph:
  requires:
    - 114-01 (TimelineRenderer baseline)
    - 114-02 (usePreviewSettings hook, PreviewComponent tab persistence)
  provides:
    - collision-aware event positioning within timeline lanes
    - hook-based tab/zoom persistence in PreviewComponent
    - bidirectional zoom memory on tab switch
  affects:
    - src/d3/visualizations/timeline/TimelineRenderer.ts
    - src/components/notebook/PreviewComponent.tsx
    - src/hooks/ui/usePreviewSettings.ts
    - src/components/notebook/__tests__/PreviewComponent.persistence.test.tsx
tech_stack:
  added: []
  patterns:
    - "collision offset Map keyed by event.id computed before D3 data join"
    - "stagger formula: laneMid + [-20%, 0, +20%] * bandwidth"
    - "usePreviewSettings hook replaces inline sessionStorage in PreviewComponent"
    - "legacy 'preview-active-tab' key migration in loadFromStorage()"
    - "zoom restore: getTabConfig(tab).zoomLevel on handleTabSwitch"
key_files:
  modified:
    - src/d3/visualizations/timeline/TimelineRenderer.ts
    - src/components/notebook/PreviewComponent.tsx
    - src/hooks/ui/usePreviewSettings.ts
    - src/components/notebook/__tests__/PreviewComponent.persistence.test.tsx
decisions:
  - "STAGGER-01: 3-slot stagger (0=center, 1=-20%bw, 2=+20%bw) resets to 0 when no pixel collision"
  - "MIGRATE-01: Legacy 'preview-active-tab' key migrated transparently in loadFromStorage()"
  - "ZOOM-RESTORE-01: Only restore zoom for D3 tabs (not web-preview); only if typeof savedZoom === 'number'"
metrics:
  duration: "~5 minutes"
  completed: "2026-02-17"
  tasks_completed: 3
  files_modified: 4
  tests_added: 3
  tests_total_passing: 69
---

# Phase 114 Plan 03: Gap Closure — Collision Handling, Hook Adoption, Zoom Restore

**One-liner:** Timeline collision stagger + PreviewComponent hook refactor with bidirectional zoom memory.

## What Was Built

### Gap 1 — Timeline within-lane collision handling (Task 1)

`TimelineRenderer.ts` now detects pixel-level event overlap within the same track lane and staggers events vertically:

- `computeCollisionOffsets(evts)` groups events by track, sorts by timestamp, and tracks last rendered X position
- Any event within `EVENT_RADIUS * 2.5` pixels of the previous event in the same lane gets a stagger index (0, 1, or 2)
- `eventCy(d)` converts stagger index to Y offset: center, -20% of bandwidth, +20% of bandwidth
- Both `enter` and `update` transitions use `eventCy()` ensuring consistent positioning on re-render
- No change to function signatures or hover/click/tooltip behavior

### Gap 2 — usePreviewSettings hook adoption (Task 2)

`PreviewComponent.tsx` no longer contains inline sessionStorage logic:

- **Removed:** `useState` initializer reading `'preview-active-tab'` (lines 28-39)
- **Removed:** `tabZoomRef` (per-tab in-memory ref, lines 44-48)
- **Removed:** `useEffect` writing to `'preview-active-tab'` (lines 181-187)
- **Added:** `usePreviewSettings()` destructure providing `activeTab`, `setActiveTab`, `getTabConfig`, `setTabZoom`
- **Added:** Legacy migration in `usePreviewSettings.loadFromStorage()` — reads old key, migrates to new JSON structure, removes old key

### Gap 3 — Per-tab zoom restore on tab switch (Task 3)

`handleTabSwitch` now performs bidirectional zoom memory:

1. **Save** current zoom before leaving: `setTabZoom(activeTab, zoom)` (for D3 tabs only)
2. **Switch** active tab: `setActiveTab(tab)`
3. **Restore** saved zoom for new tab: `getTabConfig(tab).zoomLevel` → `setZoom(savedZoom)` if different from current

Only applies to D3 tabs; `web-preview` tab manages its own zoom via `useWebPreview`.

## Verification Results

- Gap 1 (overlapping events): Events within collision threshold in same track stagger vertically — CLOSED
- Gap 2 (orphaned hook): PreviewComponent has zero inline sessionStorage calls — CLOSED (grep confirmed)
- Gap 3 (zoom restore): handleTabSwitch saves on leave, restores on return — CLOSED (3 new tests)
- All 3 must_haves truths observable
- Zero TypeScript errors
- 69/69 tests passing across 3 test files

## Deviations from Plan

None — plan executed exactly as written.

The only structural decision was to stage `getTabConfig` in Task 3's commit rather than Task 2 (where it wasn't yet used), avoiding a TS6133 unused variable error between commits.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `da1566c0` | feat(114-03): add within-lane collision handling to TimelineRenderer |
| Task 2 | `91422a53` | refactor(114-03): replace inline sessionStorage with usePreviewSettings hook |
| Task 3 | `f8e8cf35` | feat(114-03): add zoom restore on tab switch in PreviewComponent |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| TimelineRenderer.ts exists | FOUND |
| PreviewComponent.tsx exists | FOUND |
| usePreviewSettings.ts exists | FOUND |
| Commit da1566c0 (Task 1) | FOUND |
| Commit 91422a53 (Task 2) | FOUND |
| Commit f8e8cf35 (Task 3) | FOUND |
| usePreviewSettings imported in PreviewComponent | FOUND |
| No inline sessionStorage in PreviewComponent | PASS |
