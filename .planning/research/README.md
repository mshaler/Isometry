# Polymorphic Views Research Index

**Project:** Isometry v6.9
**Research Date:** 2026-02-16

## Research Files

### 1. ARCHITECTURE.md (PRIMARY)
**Comprehensive architecture patterns for polymorphic view continuum.**

Contents:
- Existing architecture (HIGH confidence)
- Integration architecture (recommendations)
- Component structure (new views to build)
- Data flow scenarios (4 detailed examples)
- SQL hook patterns
- Pitfalls and prevention
- Confidence assessment
- Build order (5 phases)

**Read this if:** You need to understand how views integrate with existing system, what SQL patterns to follow, how to prevent data consistency issues.

### 2. POLYMORPHIC-VIEWS-SUMMARY.md (QUICK START)
**Executive summary of research findings and recommendations.**

Contents:
- Direct answers to 4 questions asked
- The unified pattern (all views follow one template)
- What exists vs what needs building
- SQL query pattern across views
- Three-Canvas coordination (implicit)
- Confidence levels
- Next steps

**Read this if:** You want the 5-minute version before diving into ARCHITECTURE.md.

### 3. POLYMORPHIC-VIEWS-DECISIONS.md (DECISION LOG)
**8 architectural decisions with options considered and rationale.**

Contents:
- Decision 1: React + CSS Grid for tabular views
- Decision 2: Unified useSQLiteQuery hook
- Decision 3: ViewDispatcher as router
- Decision 4: Global SelectionContext
- Decision 5: D3 renderers wrapped in React
- Decision 6: Implicit Three-Canvas coordination
- Decision 7: Grid mode validation
- Decision 8: Enum unification (ViewType)
- Risk assessment per decision
- Non-decisions (what to keep as-is)

**Read this if:** You want to understand WHY we chose each pattern, what was rejected, and risks involved.

## Quick Reference

### Architecture Pattern
```
All views follow this template:

export function AnyView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
  `);
  return <div>{data?.map(card => <Card key={card.id} />)}</div>;
}
```

### View Tech Stack

| View | Tech | Status |
|------|------|--------|
| Gallery | React + CSS Grid + Masonry | To build |
| List | React + CSS Grid | To build |
| Kanban | React + CSS Grid | To build |
| SuperGrid | React + CSS Grid (exists) | No change |
| Network | D3.js (wrapped in React) | Refactor |
| Timeline | D3.js (wrapped in React) | Refactor |

### Components to Build

| Component | File | Size | Priority |
|-----------|------|------|----------|
| ViewDispatcher | `src/components/views/ViewDispatcher.tsx` | ~100 lines | P0 |
| GridContinuumController | `src/d3/GridContinuumController.ts` | ~50 lines | P0 |
| GalleryView | `src/components/views/GalleryView.tsx` | ~150 lines | P1 |
| ListView | `src/components/views/ListView.tsx` | ~100 lines | P1 |
| KanbanView | `src/components/views/KanbanView.tsx` | ~180 lines | P1 |
| NetworkView | `src/components/views/NetworkView.tsx` | ~80 lines | P2 |
| TimelineView | `src/components/views/TimelineView.tsx` | ~80 lines | P2 |

### Build Phases

1. **Phase 1 (Week 1):** Foundation (ViewDispatcher, enums, controller)
2. **Phase 2 (Week 2):** Simple views (Gallery, List, Kanban)
3. **Phase 3 (Week 3):** Complex views (Network, Timeline refactoring)
4. **Phase 4 (Week 4):** Three-Canvas integration (test cross-pane sync)
5. **Phase 5 (Week 5):** Polish (transitions, virtualization, accessibility)

## Key Insights

1. **Query once, project many times:** All views query the same filtered data. Different views just render it differently.

2. **React contexts are the coordination layer:** No explicit message passing between panes. Contexts flow naturally.

3. **Selection is global:** Selecting an item in SuperGrid keeps that selection when switching to Network. This is intentional.

4. **Mode validation prevents crashes:** Gallery requires 0 axes, List requires 1, Grid requires 2. Validate before switching.

5. **D3 is for spatial layout only:** Force graphs, timelines, scatters. Use React + CSS for tabular views (Gallery, List, Kanban).

## Confidence Levels

- **Architecture patterns:** HIGH — reviewed existing code, verified patterns
- **CSS Grid approach:** HIGH — SuperGrid proof of concept works
- **D3 wrapper pattern:** HIGH — inferred from SuperGrid, matches best practices
- **ViewDispatcher design:** MEDIUM — straightforward React routing
- **Three-Canvas coordination:** MEDIUM — contexts proven, actual pane implementation incomplete
- **Performance (10K+ items):** LOW — need virtualization research per view

## Questions Answered

### Q1: Gallery/List/Kanban — CSS Grid or D3?
**A:** CSS Grid. Simpler, faster, consistent with SuperGrid. D3 reserved for force graphs and timelines.

### Q2: Network/Timeline — How to wire SQL hooks?
**A:** Wrap in React component. Call useSQLiteQuery with FilterContext filters. Call D3 renderer in useEffect. Same pattern as SuperGrid.

### Q3: Three-Canvas — How to coordinate?
**A:** Implicitly through contexts. Capture creates card → db.execute → all views re-query via useSQLiteQuery. No explicit messages.

### Q4: Mode switching — How to wire GridContinuumController?
**A:** Validate before switch. GridContinuumController checks axis count. If valid, call setActiveView(). ViewDispatcher routes to correct component.

## Related Documents

- `.planning/phases/109-css-chrome-primitives/` — Related Phase 109 work
- `specs/SuperGrid-Specification.md` — Reference implementation details
- `CLAUDE.md` — Project operating instructions

## Next Steps

1. Review ARCHITECTURE.md for detailed patterns
2. Review POLYMORPHIC-VIEWS-DECISIONS.md for decision rationale
3. Create ViewType enum in src/types/view.ts
4. Plan Phase 1 (foundation week)
5. Begin implementation

---

*Research completed 2026-02-16*
*Overall confidence: HIGH (architecture), MEDIUM (implementation details)*
*Ready for phase planning*
