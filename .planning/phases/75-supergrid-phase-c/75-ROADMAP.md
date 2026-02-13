# Phase 75 Roadmap: SuperGrid Phase C

**Milestone:** v5.0 SuperGrid MVP (cont.)
**Phase:** 75 of 76
**Status:** READY
**Created:** 2026-02-13
**Goal:** Bring SuperGrid from 80% → 95% MVP readiness with filtering and polish features

## Phase Overview

Phase C implements filtering, enhanced sorting, and visual polish features. Where Phase A established visual structure and Phase B enabled interaction, Phase C completes the essential UX with header filters, multi-sort, and computed value indicators.

## Success Criteria

- [ ] Header filter dropdowns show unique values with checkboxes
- [ ] Multi-sort with visual indicators on sorted columns
- [ ] Header cards visually distinct from data cards
- [ ] Aggregation rows render at density boundaries
- [ ] Computed cells have visual audit indicator

## Plans

| Plan | Feature | Priority | Effort | Dependencies |
|------|---------|----------|--------|--------------|
| 75-01 | SuperFilter — Header Dropdown Filters | P0 | 1 day | 73-04 (click zones) |
| 75-02 | SuperSort — Enhanced Multi-Sort | P1 | 0.5 day | 73-04 (click zones) |
| 75-03 | SuperCards — Generated Header Cards | P1 | 0.5 day | 73-01 (headers) |
| 75-04 | SuperAudit — Computed Value Highlighting | P2 | 0.5 day | None |

## Wave Execution

**Wave 1 (parallel):** 75-01, 75-02
- SuperFilter and SuperSort are independent
- Both build on click zone infrastructure from 73-04

**Wave 2 (parallel):** 75-03, 75-04
- SuperCards and SuperAudit are independent
- Both are visual polish features

## Architecture Impact

```
┌─────────────────────────────────────────────────────────────────┐
│  React Chrome                                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ FilterNav     │  │ SortIndicator │  │ AuditToggle   │       │
│  │ (existing)    │  │ (enhanced)    │  │ (NEW)         │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│  SuperGridEngine (D3.js)                                        │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ FilterManager│ SortManager │ CardRenderer │ AuditRenderer│   │
│  │ (NEW)        │ (ENHANCE)   │ (ENHANCE)   │ (NEW)       │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│  State Providers                                                 │
│  ┌─────────────┬─────────────┬─────────────┐                   │
│  │ FilterProvider│ SortState  │ AuditState  │                   │
│  │ (enhance)    │ (enhance)  │ (NEW)       │                   │
│  └─────────────┴─────────────┴─────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Filter dropdown positioning | Use Popper.js or fixed positioning relative to header |
| Multi-sort performance | Limit to 3 sort levels, use SQL ORDER BY |
| Aggregation row complexity | Start with COUNT only, defer SUM/AVG |
| Audit indicator clutter | Subtle styling, toggle to hide |

## Reference Documents

- `specs/SuperGrid-Specification.md` — Authoritative feature spec (sections 2.10-2.14)
- `.planning/phases/73-supergrid-phase-a/` — Phase A summaries
- `.planning/phases/74-supergrid-phase-b/` — Phase B summaries

## Verification Gate

Before Phase 76:
```bash
npm run test           # All tests pass
npm run typecheck      # No errors
npm run check          # Quality gate passes
```

Manual verification:
- [ ] Click filter icon → dropdown with unique values
- [ ] Select values → grid filters to match
- [ ] Click sort → column sorted, indicator visible
- [ ] Shift+click another column → multi-sort applied
- [ ] Header cells have chrome styling
- [ ] Aggregation row shows count at bottom
- [ ] Toggle audit → computed cells highlighted
