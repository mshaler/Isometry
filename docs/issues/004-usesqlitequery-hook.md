---
github_issue: 4
title: "P1.4: useSQLiteQuery Hook"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-1, blocker, sqlite]
phase: phase-1
url: https://github.com/mshaler/Isometry/issues/4
---
# Issue #4: P1.4: useSQLiteQuery Hook

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/4](https://github.com/mshaler/Isometry/issues/4)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-1`, `blocker`, `sqlite`

---

## Overview
Implement the core data fetching hook that queries SQLite and provides React state.

## Requirements
- [ ] Accept SQL query string and params
- [ ] Return { data, loading, error } state
- [ ] Re-fetch when query/params change
- [ ] Memoize results
- [ ] Handle cancellation on unmount

## API Design
```typescript
interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useSQLiteQuery<T>(
  sql: string,
  params?: any[],
  options?: { enabled?: boolean }
): QueryState<T>;

// Usage
const { data: notes, loading } = useSQLiteQuery<Note>(
  'SELECT * FROM nodes WHERE folder = ? ORDER BY modified_at DESC',
  [selectedFolder]
);
```

## Deliverable
- Complete `src/hooks/useSQLiteQuery.ts`
- Unit tests for the hook


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)
- [[isometry-evolution-timeline]] - Project timeline
