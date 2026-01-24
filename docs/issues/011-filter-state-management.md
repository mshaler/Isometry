---
github_issue: 11
title: "P3.1: Filter State Management"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-3]
phase: phase-3
url: https://github.com/mshaler/Isometry/issues/11
---
# Issue #11: P3.1: Filter State Management

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/11](https://github.com/mshaler/Isometry/issues/11)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-3`

---

## Overview
Create the filter state system that tracks active filters and triggers queries.

## Requirements
- [ ] FilterContext with all LATCH filters
- [ ] Compose filters with AND logic
- [ ] Sync active filters to URL
- [ ] Clear individual or all filters
- [ ] Filter change triggers useSQLiteQuery re-fetch

## State Shape
```typescript
interface FilterState {
  category: string[] | null;  // Selected folders
  time: TimePreset | DateRange | null;
  hierarchy: { min?: number; max?: number } | null;
  dsl: string | null;  // Raw DSL override
}
```

## Deliverable
- `src/state/FilterContext.tsx`
- Filters affect query results


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 3: Filters)
- [[isometry-evolution-timeline]] - Project timeline
