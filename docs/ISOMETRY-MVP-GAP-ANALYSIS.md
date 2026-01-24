# Isometry MVP Integration Gap Analysis

*January 2026*

---

## Executive Summary

Isometry has strong architectural foundations (PAFV + LATCH + GRAPH) and promising UI designs (Figma export), but significant integration work remains before these pieces form a cohesive application. This document analyzes the gaps between our backend capabilities, frontend designs, and user experience requirements to chart a path to MVP.

**Current State**: Architecture defined, UI designed, implementation fragmented
**Target State**: Working MVP that demonstrates polymorphic data visualization

---

## 1. Inventory: What We Have

### 1.1 Architecture (✅ Strong)

| Asset | Status | Location |
|-------|--------|----------|
| PAFV Framework | ✅ Defined | [[cardboard-architecture-truth]] |
| LATCH Taxonomy | ✅ Defined | [[cardboard-architecture-truth]] |
| GRAPH Operations | ✅ Defined | [[cardboard-architecture-truth]] |
| LPG Data Model | ✅ Defined | Edges as Cards concept |
| Boring Stack Decision | ✅ Committed | SQLite + D3.js |

### 1.2 Backend Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| SQLite Schema | 🟡 Partial | Basic tables exist, need LATCH-optimized schema |
| ETL Pipeline | 🟡 Partial | Apple Notes/Reminders/Calendars importers |
| LATCH SQL Patterns | 🔴 Missing | Need query patterns for each axis |
| GRAPH SQL Patterns | 🔴 Missing | Recursive CTEs for traversal |
| SpatiaLite | 🔴 Missing | Needed for Location axis |
| FTS5 | 🔴 Missing | Full-text search for Alphabet axis |

### 1.3 Frontend Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| Component Library | 🟡 Shells | 9 Figma components, no data binding |
| Theme System | ✅ Complete | NeXTSTEP + Modern dual themes |
| PAFVNavigator | 🟡 UI Only | Drag-drop works, no state effect |
| Sidebar Filters | 🟡 UI Only | Accordion UI, no filter execution |
| Canvas | 🔴 Stub | Renders single Card, not D3 |
| D3 Integration | 🔴 Missing | No D3 code yet |
| View Types | 🔴 Missing | Grid, Kanban, Timeline, Network |

### 1.4 DSL & Query System

| Capability | Status | Notes |
|------------|--------|-------|
| DSL Grammar | ✅ Defined | PEG.js grammar exists |
| Parser | 🟡 Stub | Basic implementation |
| Compiler | 🟡 Stub | SQL generation started |
| Autocomplete | 🟡 Stub | Suggestion logic started |
| CommandBar Integration | 🔴 Missing | UI exists, not wired |

### 1.5 Data Pipeline

| Capability | Status | Notes |
|------------|--------|-------|
| SQLite → JSON | 🔴 Missing | Query execution layer |
| JSON → D3 | 🔴 Missing | Data binding layer |
| Filter → SQL | 🔴 Missing | LATCH compilation |
| URL → Filter State | 🔴 Missing | Shareable views |

---

## 2. Gap Analysis: What's Missing

### 2.1 Critical Path Gaps (Blockers)

These must be resolved for any functionality:

```
┌─────────────────────────────────────────────────────────────────┐
│  GAP 1: No Data Flow                                            │
│                                                                 │
│  SQLite ──?──> ??? ──?──> D3 ──?──> Screen                     │
│                                                                 │
│  Missing: Query execution, JSON transport, D3 bindings          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GAP 2: No Filter Effect                                        │
│                                                                 │
│  Sidebar Click ──?──> ??? ──?──> SQLite WHERE                   │
│                                                                 │
│  Missing: Filter state, LATCH→SQL compiler, re-render trigger   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GAP 3: No View Rendering                                       │
│                                                                 │
│  View Selection ──?──> ??? ──?──> D3 Layout                     │
│                                                                 │
│  Missing: View implementations, PAFV→D3 mapping                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Feature Gaps by LATCH Axis

| Axis | UI Component | Backend Support | Integration |
|------|--------------|-----------------|-------------|
| **L**ocation | NavigatorFooter map | 🔴 No SpatiaLite | 🔴 Not connected |
| **A**lphabet | Sidebar filter | 🔴 No FTS5 | 🔴 Not connected |
| **T**ime | NavigatorFooter slider | 🔴 No date indexes | 🔴 Not connected |
| **C**ategory | Sidebar filter | 🟡 Basic schema | 🔴 Not connected |
| **H**ierarchy | Sidebar filter | 🟡 Priority column | 🔴 Not connected |

### 2.3 Feature Gaps by View Type

| View | D3 Layout | PAFV Mapping | Data Requirements |
|------|-----------|--------------|-------------------|
| **Grid** | 🔴 Missing | X=Category, Y=Time | Grouped aggregates |
| **List** | 🔴 Missing | Y=Any sort axis | Simple array |
| **Kanban** | 🔴 Missing | X=Status columns | Grouped by status |
| **Calendar** | 🔴 Missing | X=DayOfWeek, Y=Week | Date-indexed |
| **Timeline** | 🔴 Missing | X=Time continuous | Time-series |
| **Tree** | 🔴 Missing | Hierarchy edges | Parent-child |
| **Network** | 🔴 Missing | Force simulation | Nodes + edges |

### 2.4 UX Gaps (Beyond UI)

| Gap | Impact | Resolution |
|-----|--------|------------|
| No loading states | User confusion | Add skeletons |
| No empty states | Dead ends | Add helpful messages |
| No error handling | Crashes | Add error boundaries |
| No onboarding | Steep learning curve | Add first-run wizard |
| No keyboard shortcuts | Power user friction | Add hotkey system |
| No undo/redo | Data loss fear | Add command history |
| No data persistence | Lost work | Implement save/load |

---

## 3. Integration Architecture

### 3.1 The Missing Middle Layer

We have backend (SQLite) and frontend (React/D3), but no middle layer:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   React     │  │    D3.js    │  │   Theme     │              │
│  │  (Chrome)   │  │  (Canvas)   │  │  (Context)  │              │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘              │
│         │                │                                       │
│         ▼                ▼                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │          🔴 MISSING: State Bridge 🔴           │             │
│  │                                                 │             │
│  │  • Filter state (LATCH selections)             │             │
│  │  • View state (active view type)               │             │
│  │  • PAFV state (axis → plane mappings)          │             │
│  │  • Selection state (selected cards)            │             │
│  │  • Navigation state (URL sync)                 │             │
│  └────────────────────────────────────────────────┘             │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                          ▼                                       │
│  ┌────────────────────────────────────────────────┐             │
│  │          🔴 MISSING: Query Layer 🔴            │             │
│  │                                                 │             │
│  │  • LATCH → SQL compiler                        │             │
│  │  • Query execution (sql.js)                    │             │
│  │  • Result transformation (→ D3 format)         │             │
│  │  • Caching / memoization                       │             │
│  └────────────────────────────────────────────────┘             │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   SQLite    │  │  SpatiaLite │  │    FTS5     │              │
│  │   (Data)    │  │ (Location)  │  │  (Search)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                        BACKEND                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Proposed State Architecture

```typescript
// URL-driven state (shareable, bookmarkable)
interface ViewState {
  app: string;           // "inbox" | "projects" | ...
  view: string;          // "grid" | "kanban" | "timeline" | ...
  dataset: string;       // "notes" | "tasks" | ...
}

// PAFV state (axis assignments)
interface PAFVState {
  xAxis: Facet | null;   // What's on X plane
  yAxis: Facet | null;   // What's on Y plane
  zAxis: Facet | null;   // What's on Z plane (layers)
  available: Facet[];    // Unassigned facets
}

// LATCH filter state
interface FilterState {
  location: LocationFilter | null;
  alphabet: AlphabetFilter | null;
  time: TimeFilter | null;
  category: CategoryFilter | null;
  hierarchy: HierarchyFilter | null;
  dsl: string;           // Raw DSL string
}

// Combined app state
interface IsometryState {
  view: ViewState;
  pafv: PAFVState;
  filters: FilterState;
  selection: Set<CardId>;
  ui: {
    theme: 'NeXTSTEP' | 'Modern';
    sidebarCollapsed: boolean;
    rightSidebarCollapsed: boolean;
    footerExpanded: boolean;
  };
}
```

### 3.3 Data Flow Design

```
User Action
    │
    ▼
┌─────────────────┐
│  Event Handler  │  (React onClick, D3 drag, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  State Update   │  (URL params + Context)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Filter Compile │  (LATCH → SQL WHERE)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Query Execute  │  (sql.js)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Transform      │  (SQL rows → D3 format)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  D3 Render      │  (.data().join())
└─────────────────┘
```

---

## 4. MVP Scope Definition

### 4.1 What IS in MVP

| Feature | Rationale |
|---------|-----------|
| **Grid View** | Most versatile, proves PAFV concept |
| **List View** | Simplest, good fallback |
| **Category Filter** | Most common use case |
| **Time Filter** | Essential for productivity |
| **DSL Query** | Differentiator, proves architecture |
| **Dual Themes** | Signature feature, already built |
| **Notes Dataset** | We have ETL, familiar data |
| **Save/Load** | Can't demo without persistence |

### 4.2 What is NOT in MVP

| Feature | Defer To | Rationale |
|---------|----------|-----------|
| Location Filter | v3.1 | Requires SpatiaLite, MapLibre |
| Network View | v3.2 | Complex, needs GRAPH queries |
| Timeline View | v3.1 | Needs SuperTimeSlider |
| Calendar View | v3.1 | Needs date-specific layouts |
| Tree View | v3.2 | Needs hierarchy traversal |
| CloudKit Sync | v4.0 | Complexity, can use file export |
| Multiple Datasets | v3.1 | Focus on Notes first |
| Custom Apps | v4.0 | Framework not defined |

### 4.3 MVP User Stories

```gherkin
Feature: Basic Data Viewing
  As a user
  I want to see my Notes in a grid
  So that I can find information quickly

  Scenario: Load Notes
    Given I have imported Notes from Apple Notes
    When I open Isometry
    Then I see my notes displayed in a grid

Feature: Category Filtering
  As a user
  I want to filter notes by folder
  So that I can focus on one topic

  Scenario: Filter by folder
    Given I am viewing all notes
    When I select "Work" folder in the Category filter
    Then I only see notes from the Work folder

Feature: Time Filtering
  As a user
  I want to filter notes by date
  So that I can find recent items

  Scenario: Filter to last week
    Given I am viewing all notes
    When I select "Last Week" in the Time filter
    Then I only see notes modified in the last 7 days

Feature: DSL Query
  As a power user
  I want to type a query
  So that I can create complex filters

  Scenario: DSL query execution
    Given I am viewing all notes
    When I type "folder:Work AND modified:last-week" in CommandBar
    And I press Enter
    Then I see notes matching both criteria

Feature: View Switching
  As a user
  I want to switch between Grid and List views
  So that I can see my data differently

  Scenario: Switch to List
    Given I am viewing notes in Grid
    When I select "List" from the Views dropdown
    Then my notes display as a vertical list

Feature: PAFV Configuration
  As a user
  I want to drag facets to different axes
  So that I can reorganize my view

  Scenario: Change X axis
    Given Grid view with Folder on X axis
    When I drag "Tags" to the X Rows well
    Then the grid reorganizes with Tags as columns
```

---

## 5. Implementation Roadmap

### Phase 1: Data Pipeline (Week 1-2)
*Goal: Data flows from SQLite to screen*

```
┌────────────────────────────────────────────────────────────┐
│  1.1 SQLite Setup                                          │
│      • Initialize sql.js in browser                        │
│      • Create schema with LATCH-friendly indexes           │
│      • Import sample Notes data                            │
│                                                            │
│  1.2 Query Layer                                           │
│      • Create useSQLiteQuery hook                          │
│      • Implement basic SELECT queries                      │
│      • Add query result caching                            │
│                                                            │
│  1.3 D3 Data Binding                                       │
│      • Create useD3 hook for Canvas ref                    │
│      • Implement basic .data().join() pattern              │
│      • Render cards as rectangles (proof of concept)       │
└────────────────────────────────────────────────────────────┘
```

**Deliverable**: Cards render on Canvas from SQLite data

### Phase 2: View Engine (Week 3-4)
*Goal: Grid and List views working*

```
┌────────────────────────────────────────────────────────────┐
│  2.1 View Abstraction                                      │
│      • Define ViewRenderer interface                       │
│      • Create GridView layout algorithm                    │
│      • Create ListView layout algorithm                    │
│                                                            │
│  2.2 PAFV Integration                                      │
│      • Connect PAFVNavigator to view state                 │
│      • Map axis assignments to D3 scales                   │
│      • Implement view transitions (animated)               │
│                                                            │
│  2.3 Card Rendering                                        │
│      • Design card template system                         │
│      • Render card content (title, preview, metadata)      │
│      • Handle card selection                               │
└────────────────────────────────────────────────────────────┘
```

**Deliverable**: Switch between Grid/List, drag facets to axes

### Phase 3: Filter System (Week 5-6)
*Goal: LATCH filters affect data*

```
┌────────────────────────────────────────────────────────────┐
│  3.1 Filter State Management                               │
│      • Create FilterContext                                │
│      • Sync filters to URL params                          │
│      • Implement filter composition (AND logic)            │
│                                                            │
│  3.2 Category Filter                                       │
│      • Query distinct categories from SQLite               │
│      • Render category picker in Sidebar                   │
│      • Compile selection to SQL WHERE                      │
│                                                            │
│  3.3 Time Filter                                           │
│      • Implement time presets (today, last week, etc.)     │
│      • Create date range picker UI                         │
│      • Compile to SQL date comparisons                     │
│                                                            │
│  3.4 Hierarchy Filter                                      │
│      • Implement priority/ranking filter                   │
│      • Create slider or dropdown UI                        │
│      • Compile to SQL ORDER BY + LIMIT                     │
└────────────────────────────────────────────────────────────┘
```

**Deliverable**: Filter sidebar changes what's displayed

### Phase 4: DSL Integration (Week 7-8)
*Goal: CommandBar executes queries*

```
┌────────────────────────────────────────────────────────────┐
│  4.1 Parser Completion                                     │
│      • Generate parser from PEG.js grammar                 │
│      • Handle all MVP syntax (field:value, AND/OR, etc.)   │
│      • Implement error recovery                            │
│                                                            │
│  4.2 Compiler Completion                                   │
│      • Compile all filter types to SQL                     │
│      • Handle time presets                                 │
│      • Validate against schema                             │
│                                                            │
│  4.3 CommandBar UX                                         │
│      • Wire input to parser                                │
│      • Show syntax errors inline                           │
│      • Implement autocomplete dropdown                     │
│      • Add command history (up/down arrows)                │
└────────────────────────────────────────────────────────────┘
```

**Deliverable**: Type queries, see results

### Phase 5: Polish & Persistence (Week 9-10)
*Goal: Feels like a real app*

```
┌────────────────────────────────────────────────────────────┐
│  5.1 Loading & Error States                                │
│      • Add Skeleton components during load                 │
│      • Add EmptyState for no results                       │
│      • Add ErrorBoundary for crashes                       │
│                                                            │
│  5.2 Persistence                                           │
│      • Save database to IndexedDB                          │
│      • Export/import database file                         │
│      • Remember UI preferences                             │
│                                                            │
│  5.3 Performance                                           │
│      • Virtualize large card sets                          │
│      • Debounce filter updates                             │
│      • Optimize D3 transitions                             │
│                                                            │
│  5.4 Polish                                                │
│      • Keyboard shortcuts                                  │
│      • Tooltips                                            │
│      • Responsive layout adjustments                       │
│      • Theme refinements                                   │
└────────────────────────────────────────────────────────────┘
```

**Deliverable**: MVP ready for demo

---

## 6. Technical Specifications Needed

### 6.1 Documents to Create

| Document | Purpose | Priority |
|----------|---------|----------|
| `SQLite Schema Spec` | Define tables, indexes, relationships | 🔴 Critical |
| `Query Layer API` | useSQLiteQuery interface | 🔴 Critical |
| `View Renderer Interface` | How views are implemented | 🔴 Critical |
| `Filter State Spec` | How filters compose | 🟡 High |
| `Card Template Spec` | How cards render content | 🟡 High |
| `URL State Spec` | What's in URL params | 🟡 High |
| `Keyboard Shortcuts` | Hotkey mappings | 🟢 Medium |

### 6.2 Key Technical Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **sql.js loading** | Bundled vs CDN | CDN (smaller bundle) |
| **State location** | Context vs URL vs both | URL for filters, Context for UI |
| **D3 in React** | useRef vs portal vs iframe | useRef with useEffect |
| **Card virtualization** | react-window vs custom | Custom with D3 quadtree |
| **Persistence** | IndexedDB vs File API | IndexedDB primary, File export |

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| sql.js performance | Medium | High | Test with 10k+ records early |
| D3 + React conflicts | Medium | Medium | Clear ownership boundaries |
| PEG.js bundle size | Low | Low | Lazy load parser |
| Browser storage limits | Low | Medium | Warn at 50MB, offer export |

### 7.2 Scope Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Feature creep | High | High | Strict MVP definition |
| Perfectionism | High | Medium | "Working > Perfect" mantra |
| Architecture churn | Medium | High | Lock architecture decisions |

### 7.3 Timeline Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Underestimated complexity | High | Medium | Add 30% buffer |
| Blocked on decisions | Medium | Medium | Timebox decisions to 1 day |
| Rework from integration issues | Medium | High | Integration tests early |

---

## 8. Success Criteria

### 8.1 MVP Definition of Done

- [ ] Can import Notes from Apple Notes
- [ ] Notes display in Grid view
- [ ] Notes display in List view
- [ ] Can filter by folder (Category)
- [ ] Can filter by time (last week, etc.)
- [ ] Can type DSL query and see results
- [ ] Can drag facets in PAFVNavigator
- [ ] Axis changes affect Grid layout
- [ ] Both themes work throughout
- [ ] Data persists across sessions
- [ ] No crashes on empty/error states
- [ ] Works in Safari (for future iOS)

### 8.2 Demo Script

```
1. Open Isometry (shows NeXTSTEP theme)
2. See Notes in Grid view
3. Click folder in Sidebar → Grid filters
4. Click "Last Week" in Time filter → Further filters
5. Type "title:~meeting" in CommandBar → DSL works
6. Switch to List view → View changes
7. Drag "Tags" to X axis → PAFV works
8. Toggle to Modern theme → Themes work
9. Refresh page → Data persists
10. Close and reopen → Still there
```

---

## 9. Immediate Next Steps

### This Week

1. **Create SQLite Schema Spec** - Define exact tables and indexes
2. **Implement sql.js initialization** - Get database running in browser
3. **Create sample data** - 100 realistic Notes for testing
4. **Build useSQLiteQuery hook** - Data fetching foundation
5. **Render basic cards in Canvas** - D3 proof of concept

### Decisions to Make

1. **How do we handle the Notes ETL?** 
   - Option A: Run separately, import .sqlite file
   - Option B: Build into app, parse JSON export
   - Recommendation: Option A for MVP

2. **Where does sql.js wasm file live?**
   - Option A: Public folder, load on demand
   - Option B: Bundled (larger initial load)
   - Recommendation: Option A

3. **How granular is filter state in URL?**
   - Option A: Full DSL string only
   - Option B: Structured params per filter
   - Recommendation: Option B (more debuggable)

---

## 10. Appendix: File Checklist

### Files to Create (Priority Order)

```
src/
├── db/
│   ├── schema.sql              # 🔴 Table definitions
│   ├── init.ts                 # 🔴 sql.js initialization
│   ├── queries.ts              # 🔴 Query constants
│   └── sample-data.ts          # 🔴 Test data
│
├── hooks/
│   ├── useSQLiteQuery.ts       # 🔴 Exists (stub) → implement
│   ├── useD3.ts                # 🔴 D3 container management
│   ├── useFilters.ts           # 🟡 Filter state management
│   └── useURLState.ts          # 🟡 URL sync
│
├── views/
│   ├── types.ts                # 🔴 ViewRenderer interface
│   ├── GridView.ts             # 🔴 Grid layout
│   ├── ListView.ts             # 🔴 List layout
│   └── index.ts                # Registry
│
├── filters/
│   ├── types.ts                # 🟡 Filter type definitions
│   ├── CategoryFilter.tsx      # 🟡 Category UI + logic
│   ├── TimeFilter.tsx          # 🟡 Time UI + logic
│   ├── HierarchyFilter.tsx     # 🟡 Priority UI + logic
│   └── compiler.ts             # 🟡 Filter → SQL
│
├── state/
│   ├── FilterContext.tsx       # 🟡 Filter state provider
│   ├── PAFVContext.tsx         # 🟡 PAFV state provider
│   └── SelectionContext.tsx    # 🟢 Selection state
│
└── components/
    ├── Canvas.tsx              # 🔴 Rewrite for D3
    └── Card.tsx                # 🟡 Template system
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Author: Claude + Michael*
