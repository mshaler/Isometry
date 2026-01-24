---
github_issue: 1
title: "P1.1: SQLite Schema Design"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-1, blocker, sqlite]
phase: phase-1
url: https://github.com/mshaler/Isometry/issues/1
---
# Issue #1: P1.1: SQLite Schema Design

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/1](https://github.com/mshaler/Isometry/issues/1)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-1`, `blocker`, `sqlite`

---

## Overview
Design and implement the SQLite schema optimized for LATCH filtering.

## Requirements
- [ ] Nodes table (cards)
- [ ] Edges table (relationships)
- [ ] FTS5 virtual table for text search
- [ ] Indexes for each LATCH axis:
  - Location: coordinates
  - Alphabet: name collation
  - Time: created, modified, due dates
  - Category: folder, tags
  - Hierarchy: priority, importance

## Schema Draft
```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT,
  folder TEXT,
  tags TEXT,  -- JSON array
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);

CREATE INDEX idx_nodes_folder ON nodes(folder);
CREATE INDEX idx_nodes_created ON nodes(created_at);
CREATE INDEX idx_nodes_modified ON nodes(modified_at);
CREATE INDEX idx_nodes_priority ON nodes(priority);

CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, content, tags,
  content='nodes',
  content_rowid='rowid'
);
```

## Deliverable
- `src/db/schema.sql` with complete DDL
- Documentation of each table/index purpose

## References
- Architecture: docs/cardboard-architecture-truth.md


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)
- [[isometry-evolution-timeline]] - Project timeline
