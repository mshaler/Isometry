# Phase 84 Roadmap: Cards & Connections

**Phase:** 84
**Goal:** Migrate from nodes/edges to cards/connections data model
**Source:** `CARDS-AND-CONNECTIONS.md`

## Milestone Summary

| Plan | Name | Scope | Status |
|------|------|-------|--------|
| 84-01 | Schema Migration | Create cards/connections tables, migrate data | Pending |
| 84-02 | TypeScript Types | Update Card/Connection types, type guards | Pending |
| 84-03 | Query & Service Updates | Update hooks, services, ETL | Pending |
| 84-04 | Test & Cleanup | Verify, drop backups | Pending |

## Success Criteria

- [ ] `cards` table created with 4-type constraint
- [ ] `connections` table created with via_card_id
- [ ] All data migrated from nodes → cards
- [ ] All data migrated from edges → connections
- [ ] TypeScript compiles clean
- [ ] FTS5 search works on cards table
- [ ] SuperGrid renders correctly
- [ ] ETL importers work
- [ ] All tests pass

## Key Changes

### Data Model
```
Before:                    After:
┌─────────┐               ┌─────────┐
│  nodes  │ ────────────> │  cards  │
│ (open)  │               │(4 types)│
└─────────┘               └─────────┘
     │                         │
     │                         │
┌─────────┐               ┌─────────────┐
│  edges  │ ────────────> │ connections │
│(4 types)│               │(via_card_id)│
└─────────┘               └─────────────┘
```

### Card Types (Constrained)
| Type | Role | Key Fields |
|------|------|------------|
| note | Content | content, summary |
| person | Anchor | is_collective |
| event | Anchor | event_start, event_end |
| resource | Content | url, mime_type |

### Connection Model
- No edge_type enum
- User-provided `label` for relationship meaning
- `via_card_id` for rich connections (a Note bridging two People)
- Schema-on-read philosophy

## Dependencies

- Requires: None (foundational change)
- Blocks: All future data layer work
- Parallel: Can run alongside UI work that doesn't touch data

## Estimated Effort

| Plan | Complexity | Estimate |
|------|------------|----------|
| 84-01 | Medium | SQL schema + migration |
| 84-02 | Low | TypeScript types |
| 84-03 | High | Update all data access |
| 84-04 | Low | Testing + cleanup |

Total: 4 plans, significant scope
