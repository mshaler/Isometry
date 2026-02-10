# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## v5.0 Requirements — Type Safety Restoration

Eliminate all 1,254 TypeScript compilation errors to restore pre-commit hooks and CI quality gates.

### Dead Code & Stale Imports (Phase 52)

Remove unused variables, fix stale exports, and resolve module path errors.

- [ ] **TSFIX-01**: All TS6133 (unused variables) and TS6196 (unused declarations) errors resolved — 121 errors
- [ ] **TSFIX-02**: All TS2305 (no exported member) errors resolved — 94 errors
- [ ] **TSFIX-03**: All TS2307 (cannot find module) errors resolved — 36 errors

### Type Assertions & Annotations (Phase 53)

Add proper type annotations where TypeScript infers `unknown` or implicit `any`.

- [ ] **TSFIX-04**: All TS18046 (type 'unknown') errors resolved with proper type guards — 339 errors
- [ ] **TSFIX-05**: All TS7006 (implicit 'any' parameter) errors resolved with explicit types — 65 errors

### Interface Alignment (Phase 54)

Fix type mismatches between interfaces and actual usage across the codebase.

- [ ] **TSFIX-06**: All TS2339 (property does not exist) errors resolved — 270 errors
- [ ] **TSFIX-07**: All TS2322 (type not assignable) errors resolved — 76 errors

### Function Signatures & Final Cleanup (Phase 55)

Fix argument mismatches, overload resolution, and remaining errors. Verify zero errors.

- [ ] **TSFIX-08**: All TS2345 (argument not assignable) errors resolved — 59 errors
- [ ] **TSFIX-09**: All TS2554 (wrong argument count) errors resolved — 33 errors
- [ ] **TSFIX-10**: All remaining TS errors resolved (TS2353, TS2551, TS2769, TS2304, etc.) — ~161 errors
- [ ] **TSFIX-11**: `tsc --noEmit` passes with zero errors
- [ ] **TSFIX-12**: Pre-commit hook (lefthook) passes without --no-verify

## v4.2 Requirements

Requirements for completing the Three-Canvas Notebook integration. Existing implementation is ~70% complete; these requirements cover remaining functionality.

### Shell Integration

Complete Shell pane from 35% to functional (Claude AI tab deferred to v4.3).

- [ ] **SHELL-01**: User can execute Claude Code commands via real WebSocket connection
- [ ] **SHELL-02**: User can copy/paste text in terminal with Cmd+C/Cmd+V
- [ ] **SHELL-03**: User can access command history with up/down arrows
- [ ] **SHELL-04**: User can see working directory context in terminal
- [ ] **SHELL-05**: User can execute GSD commands from Command Builder UI
- [ ] **SHELL-06**: User can see real-time execution progress in GSD GUI

### Preview Visualization

Complete Preview pane from 50% to fully functional with all visualization tabs.

- [ ] **PREV-01**: User can view GRAPH relationships as D3 force-directed network
- [ ] **PREV-02**: User can interact with network nodes (click to select, drag to rearrange)
- [ ] **PREV-03**: User can query SQLite via Data Inspector with SQL input
- [ ] **PREV-04**: User can view query results in table format with sorting
- [ ] **PREV-05**: User can export query results as JSON/CSV
- [ ] **PREV-06**: User can view cards on Timeline by temporal LATCH facets
- [ ] **PREV-07**: User can filter timeline by date range

### Editor Enhancement

Migrate from MDEditor to TipTap for improved editing experience.

- [ ] **EDIT-01**: User edits content via TipTap editor with slash commands
- [ ] **EDIT-02**: User experiences smooth editing with 10,000+ character documents
- [ ] **EDIT-03**: User can create bidirectional links with [[page]] syntax
- [ ] **EDIT-04**: User sees autocomplete suggestions when typing [[

### Live Sync

Enable cross-canvas data synchronization without manual refresh.

- [ ] **SYNC-01**: User sees Preview auto-refresh when Capture saves a card
- [ ] **SYNC-02**: User clicks card in Preview, Capture scrolls to show it
- [ ] **SYNC-03**: User sees selection highlighted across all three canvases

## v4.3 Requirements

Navigator integration with SuperGrid. Phase 50 (Foundation) complete; Phase 51 connects to UI.

### Navigator UI Integration

Connect property classification to Navigator for dynamic LATCH+GRAPH axis selection.

- [ ] **NAV-01**: Navigator displays LATCH buckets from usePropertyClassification() instead of hardcoded axes
- [ ] **NAV-02**: User can expand each LATCH bucket to see individual facets (e.g., Time → created, modified, due)
- [ ] **NAV-03**: GRAPH bucket appears in Navigator with 4 edge types (LINK, NEST, SEQUENCE, AFFINITY) and 2 metrics (degree, weight)
- [ ] **NAV-04**: Dragging a facet to a PAFV well updates SuperGrid axis mapping
- [ ] **NAV-05**: Facet changes in database reflect in Navigator after refresh() call

### Foundation (Complete)

- [x] **FOUND-01**: classifyProperties(db) returns PropertyClassification with correct LATCH+GRAPH buckets
- [x] **FOUND-02**: GRAPH bucket contains 4 edge types + 2 metrics
- [x] **FOUND-03**: usePropertyClassification hook provides cached, refreshable access
- [x] **FOUND-04**: Disabled facets are excluded from classification
- [x] **FOUND-05**: Sort order is respected within each bucket

### Shell AI Integration (Deferred)

- **SHAI-01**: User can chat with Claude AI in dedicated Shell tab
- **SHAI-02**: User sees streaming responses with typing indicator
- **SHAI-03**: User benefits from rate limit queue preventing API errors
- **SHAI-04**: User can use MCP tools for enhanced context

### Advanced Editor

- **AEDT-01**: User can embed D3 visualizations inline in editor
- **AEDT-02**: User can see version history per block
- **AEDT-03**: User can use formula bar with PAFV-aware functions

## Out of Scope

Explicitly excluded from v4.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Single-user local-first app, not a priority |
| Claude AI streaming tab | Deferred to v4.3 to focus on core workflow |
| D3 viz blocks in editor | High complexity, unclear demand, defer to v4.3+ |
| GSD GUI rich output parsing | Depends on Claude Code patterns stabilizing |
| Version history per block | Complex conflict UI, defer to future |
| Formula bar (SuperCalc) | Already planned for Phase 45 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TSFIX-01 | Phase 52 | Pending |
| TSFIX-02 | Phase 52 | Pending |
| TSFIX-03 | Phase 52 | Pending |
| TSFIX-04 | Phase 53 | Pending |
| TSFIX-05 | Phase 53 | Pending |
| TSFIX-06 | Phase 54 | Pending |
| TSFIX-07 | Phase 54 | Pending |
| TSFIX-08 | Phase 55 | Pending |
| TSFIX-09 | Phase 55 | Pending |
| TSFIX-10 | Phase 55 | Pending |
| TSFIX-11 | Phase 55 | Pending |
| TSFIX-12 | Phase 55 | Pending |
| SHELL-01 | Phase 43 | Pending |
| SHELL-02 | Phase 43 | Pending |
| SHELL-03 | Phase 43 | Pending |
| SHELL-04 | Phase 43 | Pending |
| SHELL-05 | Phase 43 | Pending |
| SHELL-06 | Phase 43 | Pending |
| PREV-01 | Phase 44 | Pending |
| PREV-02 | Phase 44 | Pending |
| PREV-03 | Phase 44 | Pending |
| PREV-04 | Phase 44 | Pending |
| PREV-05 | Phase 44 | Pending |
| PREV-06 | Phase 44 | Pending |
| PREV-07 | Phase 44 | Pending |
| EDIT-01 | Phase 45 | Pending |
| EDIT-02 | Phase 45 | Pending |
| EDIT-03 | Phase 45 | Pending |
| EDIT-04 | Phase 45 | Pending |
| SYNC-01 | Phase 46 | Pending |
| SYNC-02 | Phase 46 | Pending |
| SYNC-03 | Phase 46 | Pending |
| FOUND-01 | Phase 50 | Complete |
| FOUND-02 | Phase 50 | Complete |
| FOUND-03 | Phase 50 | Complete |
| FOUND-04 | Phase 50 | Complete |
| FOUND-05 | Phase 50 | Complete |
| NAV-01 | Phase 51 | Pending |
| NAV-02 | Phase 51 | Pending |
| NAV-03 | Phase 51 | Pending |
| NAV-04 | Phase 51 | Pending |
| NAV-05 | Phase 51 | Pending |

**Coverage:**
- v5.0 requirements: 12 total (mapped to phases 52-55)
- v4.2 requirements: 20 total (mapped to phases 43-46)
- v4.3 requirements: 10 total (5 complete, 5 pending)
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 (added v4.3 Navigator requirements NAV-01 to NAV-05)*
