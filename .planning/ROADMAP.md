# Roadmap: Isometry

## Milestones

- **v3.1 Live Database Integration** - Phases 18-27 (shipped 2026-02-01)
- **v4.1 SuperGrid Foundation** - Phases 34-42 (shipped 2026-02-10)
- **v4.2 Three-Canvas Notebook** - Phases 43-46 (shipped 2026-02-10)
- **v4.3 Navigator Integration** - Phases 50-51 (shipped 2026-02-10)
- **v5.0 Type Safety Restoration** - Phases 52-55 (shipped 2026-02-10)
- **v4.4 SuperGrid PAFV Projection** - Phases 56-59 (shipped 2026-02-11)
- **v4.5 Stacked/Nested Headers** - Phase 60 (shipped 2026-02-11)
- **v4.6 SuperGrid Polish** - Phases 61-62 (shipped 2026-02-12)
- **v4.7 Schema-on-Read** - Phases 63-65 (shipped 2026-02-12)
- **v4.8 ETL Consolidation** - Phases 67-72 (shipped 2026-02-12)
- **v5.0 SuperGrid MVP** - Phases 73-76 (shipped 2026-02-13)
- **v4.9 Data Layer Completion** - Phases 77-79 (shipped 2026-02-13)
- **v5.1 Notebook Integration** - Phase 80 (shipped 2026-02-14)
- **v5.2 Cards & Connections** - Phase 84 (shipped 2026-02-13)
- 📋 **v6.0 Interactive Shell** - Phases 85-88 (deferred)
- 🚧 **v6.1 SuperStack Enhancement** - Phases 89-93 (in progress)
- 🚧 **v6.2 Capture Writing Surface** - Phases 94-98 (planning)

## Phases

<details>
<summary>v3.1 Live Database Integration (Phases 18-27) - SHIPPED 2026-02-01</summary>

**Milestone Goal:** Connected React frontend to native SQLite backend with real-time data synchronization and performance monitoring

**Key Accomplishments:**
- High-performance bridge infrastructure with MessagePack binary serialization achieving <16ms latency for 60fps UI responsiveness
- Real-time database synchronization using GRDB ValueObservation providing <100ms change notifications with event sequencing
- ACID transaction safety across React-native bridge boundaries with correlation IDs and automatic rollback capability
- Virtual scrolling optimization with TanStack Virtual integration and intelligent caching for large datasets
- Live query integration connecting useLiveQuery React hook to real-time database changes
- End-to-end application access with LiveDataProvider installed in main app providing full user access to live database features

**Stats:** 173 files created/modified (48,306 insertions, 890 deletions), 84,694 lines of TypeScript + Swift + Python, 7 phases, 18 plans, ~150 tasks, 3 days from start to completion

</details>

<details>
<summary>v4.1 SuperGrid Foundation (Phases 34-42) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Core SuperGrid polymorphic data projection system with bridge elimination, Janus density controls, and unified ViewEngine architecture

**Key Accomplishments:**
- Bridge Elimination Architecture achieving sql.js direct D3.js data binding with zero serialization overhead (eliminated 40KB MessageBridge)
- Janus Density Controls with orthogonal zoom (value density) and pan (extent density) and 300ms smooth animations
- Grid Continuum Views enabling seamless transitions between Grid, List, and Kanban projections with preserved selection state
- ViewEngine Architecture unifying "D3 renders, React controls" pattern with GridRenderer, ListRenderer, KanbanRenderer
- IndexedDB Persistence supporting large datasets (50MB+) with auto-save, quota monitoring, and pre-save checks
- PAFV Axis Switching enabling dynamic axis-to-plane remapping with real-time grid reorganization

**Stats:** 859 files modified (172,092 insertions, 36,956 deletions), 156,240 lines of TypeScript, 9 phases, 27 plans, 5 days from start to ship

</details>

<details>
<summary>v4.2 Three-Canvas Notebook (Phases 43-46) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Build a unified capture-shell-preview workspace where notebook cards participate fully in PAFV projections

#### Phase 43: Shell Integration Completion
**Goal**: Complete Shell pane from 35% to functional with real Claude Code integration and interactive terminal
**Depends on**: Phase 42 (v4.1 complete)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Success Criteria** (what must be TRUE):
  1. User can execute Claude Code commands via WebSocket connection and see real-time output
  2. User can copy/paste text in terminal with standard keyboard shortcuts (Cmd+C/Cmd+V)
  3. User can navigate command history with up/down arrows and see current working directory
  4. User can execute GSD commands from Command Builder and see execution progress in GSD GUI
**Plans**: 3 plans in 2 waves

Plans:
- [x] 43-01-PLAN.md — WebSocket connection with heartbeat, reconnection, and working directory display
- [x] 43-02-PLAN.md — Terminal copy/paste and command history with reverse search
- [x] 43-03-PLAN.md — GSD command execution with live progress and completion notifications

#### Phase 44: Preview Visualization Expansion
**Goal**: Complete Preview pane from 50% to fully functional with all visualization tabs operational
**Depends on**: Phase 43
**Requirements**: PREV-01, PREV-02, PREV-03, PREV-04, PREV-05, PREV-06, PREV-07
**Success Criteria** (what must be TRUE):
  1. User can view GRAPH relationships as D3 force-directed network with interactive node selection
  2. User can interact with network nodes (click to select, drag to rearrange) and see connections
  3. User can query SQLite via Data Inspector with SQL input and view results in sortable table
  4. User can export query results as JSON/CSV and view cards on Timeline by temporal LATCH facets
  5. User can filter timeline by date range and see smooth transitions between visualization types
**Plans**: 3 plans in 2 waves

Plans:
- [x] 44-01-PLAN.md — Network graph with force-directed layout, drag/click interactions
- [x] 44-02-PLAN.md — Data Inspector with SQL input, sortable table, CSV/JSON export
- [x] 44-03-PLAN.md — Timeline visualization with temporal facets and date filtering

#### Phase 45: TipTap Editor Migration
**Goal**: Migrate from MDEditor to TipTap for improved editing experience with slash commands and bidirectional links
**Depends on**: Phase 43
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04
**Success Criteria** (what must be TRUE):
  1. User edits content via TipTap editor with smooth performance on 10,000+ character documents
  2. User can invoke slash commands for card operations (/save-card, /send-to-shell, /insert-viz)
  3. User can create bidirectional links with [[page]] syntax and see autocomplete suggestions
  4. User experiences no lag during typing with shouldRerenderOnTransaction optimization applied
**Plans**: 3 plans in 2 waves

Plans:
- [x] 45-01-PLAN.md — TipTap foundation with performance config and Markdown persistence
- [x] 45-02-PLAN.md — Slash commands extension with @tiptap/suggestion
- [x] 45-03-PLAN.md — Wiki links extension with [[page]] syntax and sql.js autocomplete

#### Phase 46: Live Data Synchronization
**Goal**: Enable cross-canvas data synchronization without manual refresh using React's dataVersion reactivity
**Depends on**: Phases 44, 45
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User sees Preview auto-refresh when Capture saves a card (no manual refresh required)
  2. User clicks card in Preview and Capture scrolls to show it (bidirectional navigation)
  3. User sees selection highlighted across all three canvases simultaneously
**Plans**: 3 plans in 2 waves

Plans:
- [x] 46-01-PLAN.md — Verify dataVersion propagation chain for auto-refresh (SYNC-01)
- [x] 46-02-PLAN.md — Connect Preview tabs to SelectionContext for cross-canvas selection (SYNC-03)
- [x] 46-03-PLAN.md — Bidirectional navigation from Preview to Capture (SYNC-02)

</details>

<details>
<summary>v4.3 Navigator Integration (Phases 50-51) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Connect property classification to Navigator UI for dynamic LATCH+GRAPH axis selection with SuperGrid

[Collapsed for brevity - full details in original ROADMAP.md]

</details>

<details>
<summary>v5.0 Type Safety Restoration (Phases 52-55) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Eliminate all TypeScript compilation errors to restore pre-commit hooks and CI quality gates

**Approach:** Instead of executing the planned 4-phase sequential approach (Phases 52-55, 12 plans), used a 3-wave parallel agent strategy that eliminated all 1,347 errors in a single session:
- Wave 1 (8 agents by directory): 1,347 → 853 errors (37% reduction)
- Wave 2 (6 agents targeting clusters): 853 → 339 errors (60% of remaining)
- Wave 3 (4 agents final cleanup): 339 → 0 errors

**Key accomplishments:**
- Zero TypeScript compilation errors (`tsc --noEmit` passes clean)
- Pre-commit hook fully restored (all 5 checks passing)
- knip baseline ratchet set at `--max-issues 1000` for pre-existing unused exports
- Local interface extension pattern established for competing type definitions

**Stats:** 140 files changed (2,938 insertions, 1,544 deletions), single commit `23de1fa5`

</details>

<details>
<summary>v4.4 through v5.2 - SHIPPED</summary>

[Additional milestones collapsed for brevity]

</details>

## 🚧 v6.1 SuperStack Enhancement (In Progress)

**Milestone Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Reference:** `superstack-implementation-plan.md` contains complete implementation specification.

### Phase 89: Static Headers Foundation
**Goal**: Create type definitions and render static nested headers with correct spans
**Depends on**: Phase 84 (Cards & Connections)
**Requirements**: SSTACK-01, SSTACK-02, SSTACK-03, SSTACK-04, SSTACK-05, SSTACK-06
**Success Criteria** (what must be TRUE):
  1. HeaderNode, HeaderTree, FacetConfig, SuperStackState types defined
  2. Tree builder transforms flat rows into hierarchical header structure
  3. Column headers span correctly (Year spans 12 months)
  4. Row headers span correctly (Folder spans all tags)
  5. Visual appearance matches ASCII mockups in implementation plan
**Plans**: TBD

Plans:
- [ ] 89-01: TBD (use /gsd:plan-phase)

### Phase 90: SQL Integration
**Goal**: Build headers from live SQLite queries
**Depends on**: Phase 89 (Static headers render)
**Requirements**: SQL-01, SQL-02, SQL-03, SQL-04, SQL-05
**Success Criteria** (what must be TRUE):
  1. Header discovery query builds GROUP BY with COUNT
  2. Time facets extract via strftime (year, quarter, month)
  3. Multi-select facets (tags) explode via json_each
  4. Query completes in <100ms for 10K cards
  5. Empty datasets show graceful empty state
**Plans**: 2 plans in 2 waves

Plans:
- [x] 90-01-PLAN.md - Query generator with facet type dispatch (SQL-01, SQL-02, SQL-03)
- [x] 90-02-PLAN.md - Service layer, React hook, and GridRenderingEngine integration (SQL-04, SQL-05)

### Phase 91: Interactions
**Goal**: Collapse/expand, click-to-filter, keyboard navigation
**Depends on**: Phase 90 (SQL integration)
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05
**Success Criteria** (what must be TRUE):
  1. Click collapse icon toggles children visibility
  2. Spans recalculate correctly when headers collapse
  3. Click header filters data to that path subset
  4. Selected header highlighted visually
  5. Arrow keys navigate between headers
**Plans**: 2 plans in 2 waves

Plans:
- [x] 91-01-PLAN.md — Collapse/expand toggle, click-to-filter, visual highlight (INT-01, INT-02, INT-03, INT-04)
- [x] 91-02-PLAN.md — Keyboard navigation with ARIA accessibility (INT-05)

### Phase 92: Data Cell Integration
**Goal**: Connect headers to data cells with coordinated scroll
**Depends on**: Phase 91 (Interactions)
**Requirements**: CELL-01, CELL-02, CELL-03, CELL-04
**Success Criteria** (what must be TRUE):
  1. Data cells render at correct positions relative to leaf headers
  2. Headers stay fixed while data area scrolls
  3. Density level affects cell rendering (counts vs chips)
  4. Selection syncs between headers and data cells
**Plans**: TBD

Plans:
- [ ] 92-01: TBD (use /gsd:plan-phase)

### Phase 93: Polish & Performance
**Goal**: Virtual scrolling, accessibility, animations
**Depends on**: Phase 92 (Data cell integration)
**Requirements**: PERF-01, PERF-02, A11Y-01, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. 10K cells render at 30+ fps via virtual scrolling
  2. Headers remain sticky during scroll
  3. ARIA labels present for screen readers
  4. Empty state displays informative message
  5. Collapse/expand transitions animate smoothly
**Plans**: TBD

Plans:
- [ ] 93-01: TBD (use /gsd:plan-phase)

## 🚧 v6.2 Capture Writing Surface (Planning)

**Milestone Goal:** Transform Capture into a world-class writing surface combining Apple Notes fluency, Notion flexibility, and Obsidian power — with Isometry-native view embeds.

**Reference:** `.planning/CAPTURE-REQUIREMENTS.md` contains complete requirements specification.

### Phase 94: Foundation & Critical Fixes
**Goal**: Fix existing data loss bugs (Markdown serialization), add security hardening (paste sanitization), and deliver Apple Notes keyboard fluency before building advanced features on lossy foundation.
**Depends on**: Phase 93 (v6.1 SuperStack Polish)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, KEYS-01, KEYS-02, KEYS-03, KEYS-04, KEYS-05, KEYS-06, POLISH-01, POLISH-02
**Success Criteria** (what must be TRUE):
  1. User can save card, close editor, reopen, and all formatting (bold, lists, links) persists without loss
  2. User can paste HTML from external sources and malicious scripts are sanitized (no XSS execution)
  3. User can switch between cards 20+ times without memory growth (Tippy.js instances cleaned up)
  4. User can toggle checklist with Cmd+Shift+L, set headings with Cmd+1-6, indent with Tab, insert rule with Cmd+Shift+H, strikethrough with Cmd+Shift+X
  5. User can type `- ` and get bullet list, `1. ` and get numbered list, `[ ]` and get checkbox without manual formatting
**Plans**: 4 plans in 2 waves

Plans:
- [x] 94-01-PLAN.md — Markdown serialization fix via @tiptap/markdown (FOUND-01)
- [x] 94-02-PLAN.md — Paste sanitization + Tippy.js cleanup (FOUND-02, FOUND-03)
- [x] 94-03-PLAN.md — Apple Notes keyboard shortcuts (KEYS-01 through KEYS-06)
- [x] 94-04-PLAN.md — Word count + Undo/Redo polish (POLISH-01, POLISH-02)

### Phase 95: Data Layer & Backlinks
**Goal**: Templates system with sql.js storage and backlinks panel for Obsidian-style graph navigation
**Depends on**: Phase 94 (Foundation complete)
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, BACK-01, BACK-02, BACK-03, BACK-04
**Success Criteria** (what must be TRUE):
  1. User can insert template via /template command and see template preview
  2. Templates persist in sql.js database with proper schema
  3. User can see backlinks panel showing all cards linking to current card
  4. Clicking backlink navigates to that card
**Plans**: TBD

Plans:
- [ ] 95-01: TBD (use /gsd:plan-phase)

### Phase 96: Block Types & Slash Commands
**Goal**: Rich block types (callout, toggle, divider, bookmark) and expanded slash commands
**Depends on**: Phase 95 (Data layer complete)
**Requirements**: SLASH-01 through SLASH-10, BLOCK-01 through BLOCK-04
**Success Criteria** (what must be TRUE):
  1. User can insert callout with /callout and see styled block with icon
  2. User can insert collapsible toggle with /toggle
  3. Slash commands cover all heading levels, media, and references
  4. Bookmark shows URL preview with metadata
**Plans**: TBD

Plans:
- [ ] 96-01: TBD (use /gsd:plan-phase)

### Phase 97: Inline Properties
**Goal**: Inline property syntax (@key: value, #tag) with PropertyEditor sync
**Depends on**: Phase 96 (Block types complete)
**Requirements**: PROP-01, PROP-02, PROP-03, PROP-04
**Success Criteria** (what must be TRUE):
  1. User can type @key: value and see inline property mark
  2. Properties sync to PropertyEditor panel
  3. User can type #tag with autocomplete
**Plans**: TBD

Plans:
- [ ] 97-01: TBD (use /gsd:plan-phase)

### Phase 98: Isometry Embeds & Polish
**Goal**: Live D3.js visualization embeds (/supergrid, /network, /timeline) and final polish
**Depends on**: Phase 97 (Properties complete)
**Requirements**: EMBED-01 through EMBED-06, POLISH-03
**Success Criteria** (what must be TRUE):
  1. User can embed live SuperGrid with /supergrid command
  2. Embedded views respect LATCH filters from parameters
  3. Embeds update when underlying data changes
  4. Editor maintains 60fps with 10K+ character documents
**Plans**: TBD

Plans:
- [ ] 98-01: TBD (use /gsd:plan-phase)

## 📋 v6.0 Interactive Shell (Deferred)

**Milestone Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.
**Status:** Plans created for Phase 85. Resume with `/gsd:execute-phase 85`

### Phase 85: Backend Infrastructure & Terminal Execution
**Goal**: User can execute shell commands and see real-time output
**Depends on**: Phase 84 (Cards & Connections)
**Requirements**: BACK-01, BACK-02, BACK-05, TERM-01, TERM-02, TERM-03, TERM-04, TERM-05
**Success Criteria** (what must be TRUE):
  1. User can type commands in terminal and see stdout/stderr streamed in real-time
  2. User can toggle between Claude Code and native shell modes without losing session
  3. Terminal reconnects automatically with output buffer replay after connection loss
  4. System safely spawns/terminates subprocess without command injection vulnerabilities
  5. WebSocket server routes terminal messages to correct handlers
**Plans**: 5 plans in 4 waves

Plans:
- [ ] 85-01-PLAN.md — PTY backend with node-pty, types, and output buffer
- [ ] 85-02-PLAN.md — WebSocket message routing for terminal integration
- [ ] 85-03-PLAN.md — Frontend terminal WebSocket protocol
- [ ] 85-04-PLAN.md — Mode switching (shell/claude-code)
- [ ] 85-05-PLAN.md — UI integration, reconnection, and verification

### Phase 86: Claude AI MCP Integration
**Goal**: User can chat with Claude AI and approve tool executions
**Depends on**: Phase 85 (Backend infrastructure operational)
**Requirements**: BACK-04, CLAI-01, CLAI-02, CLAI-03, CLAI-04, CLAI-05, CLAI-06
**Success Criteria** (what must be TRUE):
  1. User can send messages and see streaming responses with typing indicator
  2. User must approve tool calls via modal before execution
  3. AI can access MCP resources (file system, database) with user consent
  4. System manages context lifecycle without memory leaks
**Plans**: TBD

Plans:
- [ ] 86-01: TBD (use /gsd:plan-phase)

### Phase 87: GSD File Synchronization
**Goal**: User sees live GSD state and can update task status bidirectionally
**Depends on**: Phase 85 (Backend infrastructure operational)
**Requirements**: BACK-03, GSD-01, GSD-02, GSD-03, GSD-04, GSD-05, GSD-06
**Success Criteria** (what must be TRUE):
  1. User sees phase progress display auto-updated when files change
  2. User can toggle task status (pending/in_progress/complete) and changes write to files
  3. File watcher detects `.planning/` changes with <500ms debounced update
  4. System shows conflict resolution UI when concurrent edits detected
**Plans**: TBD

Plans:
- [ ] 87-01: TBD (use /gsd:plan-phase)

### Phase 88: Integration & Polish
**Goal**: All three Shell tabs work together seamlessly
**Depends on**: Phase 86 (Claude AI), Phase 87 (GSD sync)
**Requirements**: None (integration verification)
**Success Criteria** (what must be TRUE):
  1. User can switch between Terminal/Claude AI/GSD tabs without state loss
  2. Terminal output can be saved as cards via Claude AI chat
  3. GSD phase execution triggers correctly in Terminal tab
**Plans**: TBD

Plans:
- [ ] 88-01: TBD (use /gsd:plan-phase)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 18-27 | v3.1 | All | Complete | 2026-02-01 |
| 34-42 | v4.1 | All | Complete | 2026-02-10 |
| 43-46 | v4.2 | 12/12 | Complete | 2026-02-10 |
| 50-51 | v4.3 | 4/4 | Complete | 2026-02-10 |
| 52-55 | v5.0 | N/A (wave) | Complete | 2026-02-10 |
| 56-59 | v4.4 | 9/9 | Complete | 2026-02-11 |
| 60 | v4.5 | 3/3 | Complete | 2026-02-11 |
| 61-62 | v4.6 | 2/2 | Complete | 2026-02-12 |
| 63-65 | v4.7 | 5/5 | Complete | 2026-02-12 |
| 67-72 | v4.8 | 13/13 | Complete | 2026-02-12 |
| 73-76 | v5.0 MVP | 12/12 | Complete | 2026-02-13 |
| 77-79 | v4.9 | 6/6 | Complete | 2026-02-13 |
| 80 | v5.1 | 2/2 | Complete | 2026-02-14 |
| 84 | v5.2 | 4/4 | Complete | 2026-02-13 |
| 85. Backend Terminal | v6.0 | 0/5 | Planned | - |
| 86-88 | v6.0 | 0/0 | Deferred | - |
| 89. Static Headers | v6.1 | 1/1 | Complete | 2026-02-13 |
| 90. SQL Integration | v6.1 | 2/2 | Complete | 2026-02-14 |
| 91. Interactions | v6.1 | 2/2 | Complete | 2026-02-14 |
| 92. Data Cell Integration | v6.1 | 0/0 | Not started | - |
| 93. Polish & Performance | v6.1 | 0/0 | Not started | - |
| 94. Foundation & Critical Fixes | v6.2 | 4/4 | Complete | 2026-02-14 |
| 95. Data Layer & Backlinks | v6.2 | 0/0 | Not started | - |
| 96. Block Types & Slash Commands | v6.2 | 0/0 | Not started | - |
| 97. Inline Properties | v6.2 | 0/0 | Not started | - |
| 98. Isometry Embeds & Polish | v6.2 | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-10*
*Last updated: 2026-02-14 (Phase 91 complete)*
