---
github_issue: 2
title: "P1.2: sql.js Initialization"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-1, blocker, sqlite]
phase: phase-1
url: https://github.com/mshaler/Isometry/issues/2
---
# Issue #2: P1.2: sql.js Initialization

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/2](https://github.com/mshaler/Isometry/issues/2)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-1`, `blocker`, `sqlite`

---

## Overview
Initialize sql.js (SQLite compiled to WebAssembly) in the browser.

## Requirements
- [ ] Load sql.js from CDN
- [ ] Initialize database instance
- [ ] Execute schema DDL
- [ ] Provide database context to app
- [ ] Handle WASM loading states

## Implementation
```typescript
// src/db/init.ts
import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs({
    locateFile: file => \`https://sql.js.org/dist/\${file}\`
  });
  
  db = new SQL.Database();
  
  // Execute schema
  db.run(SCHEMA_SQL);
  
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
```

## Deliverable
- `src/db/init.ts` - Database initialization
- `src/db/DatabaseContext.tsx` - React context provider
- Loading state handling in App.tsx


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)
- [[isometry-evolution-timeline]] - Project timeline
