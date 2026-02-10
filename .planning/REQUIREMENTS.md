# Requirements: Isometry v4.2 Three-Canvas Notebook

**Defined:** 2026-02-10
**Core Value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

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

## v4.3 Requirements (Deferred)

Acknowledged but deferred to future milestone.

### Shell AI Integration

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

**Coverage:**
- v4.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
