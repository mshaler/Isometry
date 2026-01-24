---
github_issue: 9
title: "P2.4: PAFV State Management"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-2]
phase: phase-2
url: https://github.com/mshaler/Isometry/issues/9
---
# Issue #9: P2.4: PAFV State Management

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/9](https://github.com/mshaler/Isometry/issues/9)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-2`

---

## Overview
Connect PAFVNavigator drag-drop to actual view state changes.

## Requirements
- [ ] Create PAFVContext
- [ ] Track axis assignments (x, y, z, available)
- [ ] Trigger view re-render on changes
- [ ] Sync to URL params
- [ ] Restore from URL on load

## State Shape
```typescript
interface PAFVState {
  xAxis: string | null;  // Facet name
  yAxis: string | null;
  zAxis: string | null;
  available: string[];   // Unassigned facets
}
```

## Deliverable
- `src/state/PAFVContext.tsx`
- PAFVNavigator updates context on drop
- View re-renders on context change


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 2: Views)
- [[isometry-evolution-timeline]] - Project timeline
