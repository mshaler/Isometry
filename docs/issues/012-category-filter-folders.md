---
github_issue: 12
title: "P3.2: Category Filter (Folders)"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-3]
phase: phase-3
url: https://github.com/mshaler/Isometry/issues/12
---
# Issue #12: P3.2: Category Filter (Folders)

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/12](https://github.com/mshaler/Isometry/issues/12)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-3`

---

## Overview
Implement the folder/category filter in the Sidebar.

## Requirements
- [ ] Query distinct folders from SQLite
- [ ] Render as checkbox list
- [ ] Multi-select support
- [ ] Update FilterContext on change
- [ ] Show count per folder

## SQL
```sql
-- Get folders with counts
SELECT folder, COUNT(*) as count 
FROM nodes 
GROUP BY folder 
ORDER BY folder;

-- Filter query
SELECT * FROM nodes WHERE folder IN (?, ?, ?);
```

## Deliverable
- `src/filters/CategoryFilter.tsx`
- Folder selection filters cards


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 3: Filters)
- [[isometry-evolution-timeline]] - Project timeline
