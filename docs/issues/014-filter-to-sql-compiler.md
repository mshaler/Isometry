---
github_issue: 14
title: "P3.4: Filter → SQL Compiler"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-3, sqlite]
phase: phase-3
url: https://github.com/mshaler/Isometry/issues/14
---
# Issue #14: P3.4: Filter → SQL Compiler

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/14](https://github.com/mshaler/Isometry/issues/14)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-3`, `sqlite`

---

## Overview
Compile FilterState into SQL WHERE clause.

## Requirements
- [ ] Handle each filter type
- [ ] Combine with AND
- [ ] Parameterize values (prevent SQL injection)
- [ ] Handle empty/null filters

## Implementation
```typescript
function compileFilters(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters.category?.length) {
    const placeholders = filters.category.map(() => '?').join(',');
    conditions.push(\`folder IN (\${placeholders})\`);
    params.push(...filters.category);
  }
  
  if (filters.time) {
    const timeSQL = compileTimeFilter(filters.time);
    conditions.push(timeSQL.sql);
    params.push(...timeSQL.params);
  }
  
  return {
    sql: conditions.length 
      ? conditions.join(' AND ')
      : '1=1',
    params
  };
}
```

## Deliverable
- `src/filters/compiler.ts`
- All MVP filters compile to valid SQL


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 3: Filters)
- [[isometry-evolution-timeline]] - Project timeline
