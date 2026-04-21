# Phase 169: Status Slot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 169-status-slot
**Areas discussed:** Display Layout, Timestamp Format, Empty / Zero State

---

## Display Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline bar | Single horizontal row: '42 cards · 18 connections · Imported 2 min ago' — compact, fits narrow status slot | ✓ |
| Labeled pairs | Key-value pairs: 'Cards: 42 | Connections: 18 | Last import: 2 min ago' — more explicit | |
| Minimal counts only | Numbers with abbreviations: '42c · 18n · 2m ago' — maximum density | |

**User's choice:** Inline bar (Recommended)
**Notes:** None — user accepted recommended option.

---

## Timestamp Format

| Option | Description | Selected |
|--------|-------------|----------|
| Relative time | '2 min ago', '1 hour ago', 'yesterday' — updates on each refresh | ✓ |
| Absolute time | 'Today at 3:45 PM', 'Apr 20, 2:12 PM' — precise but more space | |
| Hybrid | Relative when recent (< 24h), absolute when older — best of both | |

**User's choice:** Relative time (Recommended)
**Notes:** None — user accepted recommended option.

---

## Empty / Zero State

| Option | Description | Selected |
|--------|-------------|----------|
| Zero counts shown | '0 cards · 0 connections · No imports yet' — always visible, no layout shift | ✓ |
| Hidden until first import | Slot collapses to zero height, appears on first import | |
| Placeholder message | 'Import data to see stats' — guides user but different structure | |

**User's choice:** Zero counts shown (Recommended)
**Notes:** None — user accepted recommended option.

---

## Claude's Discretion

- Status slot render ownership (ExplorerCanvas method vs standalone class)
- Refresh path (extend refreshDataExplorer vs parallel)
- DOM structure, class names, separators
- Relative time formatter implementation
- SQL query strategy for counts + timestamp

## Deferred Ideas

None — discussion stayed within phase scope.
