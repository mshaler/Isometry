# Grid Continuum Research Index

**Project:** Isometry v6.9 — Polymorphic Views & Foundation
**Researched:** 2026-02-16
**Research Status:** COMPLETE

---

## Research Documents

### 1. GRID-CONTINUUM-SUMMARY.md (START HERE)
**Purpose:** Executive summary with roadmap implications
**Length:** 19 KB
**Key Sections:**
- Executive Summary (7 key findings)
- Findings by domain (Features, Architecture, Pitfalls)
- Phase structure recommendation
- Success criteria
- Risk assessment
- Timeline estimate

**Use For:** Understanding overall v6.9 roadmap, phase sequencing, high-level architecture

### 2. GRID-CONTINUUM-FEATURES.md
**Purpose:** Feature landscape (table stakes, differentiators, anti-features)
**Length:** 34 KB
**Key Sections:**
- Gallery, List, Kanban, Grid, SuperGrid features
- Network Graph and Timeline views
- Three-Canvas Layout container
- Table stakes vs differentiators vs anti-features
- MVP scope for v6.9
- Complexity tiers
- Feature dependencies

**Use For:** Defining Phase 1 (Gallery/List/Kanban) and Phase 2 (Network/Timeline/Three-Canvas) deliverables

### 3. GRID-CONTINUUM-ARCHITECTURE.md
**Purpose:** System architecture, component structure, data flow patterns
**Length:** 28 KB
**Key Sections:**
- Five-layer architecture diagram
- GridContinuumController (PAFV hub)
- View renderers (7 pluggable implementations)
- Data flow examples (mode switch, drag-drop, selection sync)
- SQL query patterns per view mode
- Component interaction diagram
- File structure
- Technology rationale
- Testing strategy

**Use For:** Implementation planning, component API definitions, data flow design, file organization

### 4. GRID-CONTINUUM-PITFALLS.md
**Purpose:** Common mistakes and how to avoid them
**Length:** 26 KB
**Key Sections:**
- 4 Critical pitfalls (rewrite risk)
  - Data desynchronization
  - View state lost on switch
  - Drag-drop without persistence
  - PAFV axis confusion
- 4 Major pitfalls (architectural debt)
  - View-specific SQL
  - Selection state split
  - Performance cliff
  - D3+React chaos
- 4 Minor pitfalls (UX polish)
  - Scroll position lost
  - No touch support
  - No loading state
  - Animation timing
- Phase-specific warnings
- Mitigation checklist

**Use For:** Risk management during Phase 1-2, code review guidance, test planning

---

## Quick Navigation by Role

### Product Manager / Roadmap Owner
**Read:** SUMMARY → skim FEATURES
**Decision points:**
- Phase 1 includes Gallery, List, Kanban (or just Gallery + List?)
- Track A+B parallelizable? Yes
- Phase 2 after Phase 1? Yes, depends on working views
- 4-week estimate realistic? See timeline in SUMMARY

### Engineering Lead (Architecture)
**Read:** SUMMARY → ARCHITECTURE (detailed) → PITFALLS (critical section)
**Decision points:**
- GridContinuumController → ViewQueryBuilder → useSQLiteQuery → Renderer (is this order right?)
- All views query live sql.js, no caches (why? data desync pitfall)
- SelectionContext wires all views (why? critical for multi-view)
- D3 isolation via React ref (why? D3+React chaos pitfall)

### Frontend Dev (Phase 1 — Views)
**Read:** FEATURES (table stakes) → ARCHITECTURE (renderers section) → PITFALLS (Tier 2+3)
**Implementation checklist:**
- [ ] Implement GridContinuumController.allocateAxes()
- [ ] Implement ViewQueryBuilder.buildQuery()
- [ ] Implement useSQLiteQuery hook
- [ ] Implement GalleryRenderer with TanStack Virtual
- [ ] Implement ListRenderer with expand/collapse
- [ ] Implement KanbanRenderer with dnd-kit
- [ ] Wire SelectionContext to all renderers
- [ ] Test at 10K scale before shipping

### Frontend Dev (Phase 2 — D3 Views)
**Read:** FEATURES (Network/Timeline) → ARCHITECTURE (D3 integration section) → PITFALLS (D3+React chaos)
**Implementation checklist:**
- [ ] Implement NetworkRenderer with D3 force (isolation via ref)
- [ ] Implement TimelineRenderer with D3 time scale
- [ ] Add zoom/pan behavior
- [ ] Wire SelectionContext (Context drives D3 color/opacity)
- [ ] Test selection sync across views
- [ ] Profile at 1000+ scale

### QA / Test Engineer
**Read:** FEATURES (MVP success criteria) → PITFALLS (detection section)
**Test cases:**
- Gallery 60 FPS at 10K items (virtual scroll proof)
- List expand/collapse works, keyboard nav works
- Kanban drag-drop persists to SQL (refresh shows change)
- Mode switch preserves scroll/zoom/selection (ViewStateStore)
- Data sync: edit in one view, all views show update (sql.js proof)
- Selection sync: select in Gallery, highlight in List/Kanban/Network
- No typescript errors, >80% test coverage

---

## Research Confidence Levels

| Topic | Confidence | Notes |
|-------|-----------|-------|
| **Table Stakes Features** | HIGH | Verified with MDN, D3 docs, production apps (Figma, Airtable, Obsidian) |
| **PAFV Axis Controller** | HIGH | Straightforward logic, Isometry-specific but well-researched |
| **SQL Query Patterns** | HIGH | Standard SQL, verified with existing codebase |
| **Virtual Scrolling** | HIGH | TanStack Virtual proven, already used in SuperGrid |
| **Drag-Drop (dnd-kit)** | HIGH | Current standard library, production-tested |
| **Three-Canvas Layout** | HIGH | react-resizable-panels mature, Context-based sync standard |
| **D3 Force Network** | MEDIUM-HIGH | Well-documented, but tuning requires experimentation |
| **Timeline Zoom** | MEDIUM-HIGH | D3 time scales reliable, sparse event layout needs exploration |
| **Cross-View Selection** | MEDIUM-HIGH | Architecture sound, complexity of syncing 7 views untested |
| **Performance at Scale** | MEDIUM | Theory solid, actual optimization needs benchmarking |

---

## Key Decision Points for Roadmap

### Phase 1 vs Phase 2 Split

**Phase 1 (Weeks 1-3):** Gallery, List, Kanban, Mode Switcher + Tech Debt
- Reason: Foundation for Three-Canvas Preview pane
- Risk: Medium (drag-drop persistence, virtual scrolling tuning)
- Dependencies: None (builds on existing PAFV logic)

**Phase 2 (Weeks 3-4):** Network, Timeline, Three-Canvas Integration
- Reason: Depends on Phase 1 views working (PAFV proven)
- Risk: Medium (D3 integration, event layout algorithm)
- Dependencies: Phase 1 complete

### Track Parallelization

**Track A (Views) + Track B (Debt) parallel:**
- Independent concerns, no dependencies
- Saves ~1 week
- Requires 2 developers or split focus

**Track C (Specialized Views) after A:**
- Depends on PAFV controller proven working
- Depends on SelectionContext working
- No way to parallelize (architectural dependency)

**Track D (Three-Canvas) after C:**
- Depends on working views (can't integrate broken views)
- Integration layer, fast once views exist
- 1-week work

### Risk Ranking (Highest First)

1. **Drag-Drop Without Persistence** (Tier 1 catch, Tier 2 fix) — Test immediately in Phase 1
2. **Data Desynchronization** (Silent, catastrophic) — Integration test with 3+ views
3. **D3+React Chaos** (Subtle, hard to debug) — Isolate early, test selection toggling
4. **Performance Cliff** (Invisible until scale) — 10K item tests from day 1
5. **View State Loss** (Annoying, fixable) — ViewStateStore before UI polish

---

## Testing Strategy Overview

### Unit Tests (Phase 1)
- GridContinuumController.allocateAxes() for each mode
- ViewQueryBuilder.buildQuery() for each mode
- Each renderer's basic render (mount/unmount/cleanup)

### Integration Tests (Phase 1)
- Gallery + List: same filtered data, counts match
- Kanban: drag-drop updates SQL, re-render shows change
- Mode switch: scroll/zoom/selection preserved
- SelectionContext: select in Gallery, highlight in List

### Performance Tests (Ongoing)
- Gallery 10K items: 60 FPS scroll (TanStack Virtual)
- List 5K items: expand/collapse < 200ms
- Kanban 200 cards/5 columns: drag < 100ms latency
- Network 500 nodes: force simulation converges < 2 seconds
- Timeline 1000 events: zoom/pan 60 FPS

### Visual Regression Tests
- Gallery masonry layout (3-4 columns responsive)
- List tree indentation + expand/collapse animation
- Kanban card layout in columns
- Sticky headers on scroll

---

## File Organization for Implementation

```
src/
├── d3/renderers/
│   ├── GalleryRenderer.tsx          (PHASE 1, Week 1)
│   ├── ListRenderer.tsx             (PHASE 1, Week 1)
│   ├── KanbanRenderer.tsx           (PHASE 1, Week 2)
│   ├── NetworkRenderer.ts           (PHASE 2, Week 1)
│   └── TimelineRenderer.ts          (PHASE 2, Week 2)
├── services/grid-continuum/
│   ├── GridContinuumController.ts   (PHASE 1, Week 1 — CRITICAL)
│   └── ViewQueryBuilder.ts          (PHASE 1, Week 1 — CRITICAL)
├── hooks/
│   ├── useSQLiteQuery.ts            (PHASE 1, Week 1 — CRITICAL)
│   └── useGridContinuum.ts          (PHASE 1, Week 1-2)
├── components/
│   ├── GridContinuumSwitcher.tsx    (PHASE 1, Week 2)
│   └── ThreeCanvasLayout.tsx        (PHASE 2, Week 3)
└── contexts/
    ├── SelectionContext.ts          (PHASE 1, Week 1 — CRITICAL)
    └── ViewStateStore.ts            (PHASE 1, Week 2)
```

---

## How to Use These Documents

1. **Before creating roadmap:** Read SUMMARY, especially "Phase Structure" section
2. **Before starting Phase 1 Task 1:** Read ARCHITECTURE (GridContinuumController section)
3. **Before implementing each renderer:** Read FEATURES (specific view) + PITFALLS (prevention strategies)
4. **During code review:** Cross-check against ARCHITECTURE (component boundaries) and PITFALLS (detection criteria)
5. **During performance tuning:** Reference "Performance Targets" in FEATURES and PITFALLS (performance cliff section)
6. **During debugging:** PITFALLS "Detection" sections help diagnose issues
7. **Before Phase 2:** Re-read SUMMARY "Phase Ordering Rationale" to confirm dependencies

---

## Open Questions (For Phase Planning)

1. **Should Track A+B truly parallelize, or is it too risky?**
   - Research says yes (independent concerns)
   - Recommend: Parallelize if 2 developers available

2. **Is 4 weeks realistic for all 4 tracks?**
   - Timeline in SUMMARY assumes focused work
   - Risk factors: Unknown D3 tuning time, unknown virtual scroll issues
   - Recommend: 5-week buffer for Phase 2

3. **Should we skip Network/Timeline in v6.9 if time tight?**
   - Research says Phase 2 is lower priority than Phase 1
   - Gallery/List/Kanban alone is MVP (satisfies 90% of use cases)
   - Timeline: Phase 1 + Phase 2 early combined still faster than shipping incomplete Phase 2

4. **Is SelectionContext wiring realistic before Phase 1 complete?**
   - Research says implement immediately (Week 1 as part of foundations)
   - It's just React Context, very low complexity
   - Early implementation proves multi-view architecture

5. **Do we need formal ArchitectureReview or can Phase 1 start immediately?**
   - Research recommends: Start Phase 1 once GridContinuumController + ViewQueryBuilder + useSQLiteQuery unit tests pass
   - This is <1 week of foundational work
   - Review can happen in parallel with UI implementation

---

## Research Completeness Checklist

- [x] Feature landscape complete (table stakes, differentiators, anti-features)
- [x] Architecture patterns documented (PAFV controller, query builder, renderers)
- [x] Data flow examples provided (mode switch, drag-drop, selection sync)
- [x] Critical pitfalls identified and prevention strategies defined
- [x] Performance targets set (FPS, memory, scale)
- [x] Test strategy outlined (unit, integration, performance)
- [x] Technology choices justified (React, D3, dnd-kit, TanStack Virtual)
- [x] Timeline estimated (4 weeks)
- [x] Risk ranked (5 critical, 4 major, 4 minor)
- [x] Confidence levels assigned (HIGH for architecture, MEDIUM for D3 specifics)
- [x] Open questions documented
- [x] File organization for implementation provided

**Research Status: COMPLETE ✓**

---

## Next Action: Roadmap Creation

Once these research documents are reviewed, proceed to:

1. `.planning/ROADMAP.md` — Multi-phase plan with phase-specific goals
2. `.planning/phases/*/PLAN.md` — Task-level breakdown per phase
3. `.planning/REQUIREMENTS.md` — REQ-ID mapping for each feature

---

*Grid Continuum Research Index*
*Researched: 2026-02-16*
*Status: Complete*
*Confidence: HIGH*
