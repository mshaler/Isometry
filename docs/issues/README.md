# GitHub Issues

**Purpose:** Track implementation progress via GitHub Issues integration

---

## Overview

**Total Issues:** 14
**Open:** 14
**Closed:** 0

These issues track the Isometry MVP implementation across three phases:
- **Phase 1:** Foundation (SQLite, schema, hooks)
- **Phase 2:** Views (Grid, List, PAFV)
- **Phase 3:** Filters (State, SQL compilation)

---

## Sync

Issues are synced from GitHub using:
```bash
python3 scripts/sync-github-issues.py
```

This creates/updates markdown files in `docs/issues/` with frontmatter linking to GitHub.

**Last synced:** 2026-01-23 20:18

---

## Phase 1: Foundation

🔲 **Issue #1:** [[001-p1.1-sqlite-schema-design|P1.1: SQLite Schema Design]]  
🔲 **Issue #2:** [[002-p1.2-sql.js-initialization|P1.2: sql.js Initialization]]  
🔲 **Issue #3:** [[003-p1.3-sample-data-generation|P1.3: Sample Data Generation]]  
🔲 **Issue #4:** [[004-p1.4-usesqlitequery-hook|P1.4: useSQLiteQuery Hook]]  
🔲 **Issue #5:** [[005-p1.5-d3-canvas-proof-of-concept|P1.5: D3 Canvas Proof of Concept]]  

## Phase 2: Views

🔲 **Issue #6:** [[006-p2.1-viewrenderer-interface|P2.1: ViewRenderer Interface]]  
🔲 **Issue #7:** [[007-p2.2-grid-view-implementation|P2.2: Grid View Implementation]]  
🔲 **Issue #8:** [[008-p2.3-list-view-implementation|P2.3: List View Implementation]]  
🔲 **Issue #9:** [[009-p2.4-pafv-state-management|P2.4: PAFV State Management]]  
🔲 **Issue #10:** [[010-p2.5-card-template-system|P2.5: Card Template System]]  

## Phase 3: Filters

🔲 **Issue #11:** [[011-p3.1-filter-state-management|P3.1: Filter State Management]]  
🔲 **Issue #12:** [[012-p3.2-category-filter-(folders)|P3.2: Category Filter (Folders)]]  
🔲 **Issue #13:** [[013-p3.3-time-filter|P3.3: Time Filter]]  
🔲 **Issue #14:** [[014-p3.4-filter-→-sql-compiler|P3.4: Filter → SQL Compiler]]  

---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - Full MVP roadmap
- [[isometry-evolution-timeline]] - Project timeline
- [[Excavating CardBoard for Isometry]] - Historical context

---

## Adding New Issues

1. Create issue on GitHub: https://github.com/mshaler/Isometry/issues/new
2. Run sync script: `python3 scripts/sync-github-issues.py`
3. Commit changes: `git add docs/issues/ && git commit -m "docs: sync GitHub issues"`

---

## Issue Template

When creating new issues on GitHub, use this structure:

```markdown
## Overview
[Brief description of what needs to be implemented]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Implementation
[Code snippets, approach details]

## Deliverable
- File/component to create
- Acceptance criteria
```
