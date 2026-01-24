---
github_issue: 13
title: "P3.3: Time Filter"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-3]
phase: phase-3
url: https://github.com/mshaler/Isometry/issues/13
---
# Issue #13: P3.3: Time Filter

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/13](https://github.com/mshaler/Isometry/issues/13)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-3`

---

## Overview
Implement time-based filtering with presets and custom ranges.

## Requirements
- [ ] Presets: Today, Yesterday, Last Week, Last Month, This Year
- [ ] Custom date range picker
- [ ] Filter by created_at or modified_at
- [ ] Visual indicator of active time filter

## SQL
```sql
-- Last week
SELECT * FROM nodes 
WHERE modified_at >= date('now', '-7 days');

-- Custom range
SELECT * FROM nodes 
WHERE modified_at BETWEEN ? AND ?;
```

## Deliverable
- `src/filters/TimeFilter.tsx`
- Time presets and custom range work


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 3: Filters)
- [[isometry-evolution-timeline]] - Project timeline
