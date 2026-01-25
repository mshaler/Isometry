# Isometry Notebook Sidecar Implementation Roadmap

**Project:** Isometry Notebook Sidecar
**Version:** v1.0
**Target:** Production-ready three-component React application
**Approach:** Four-phase incremental delivery

---

## Milestone Overview

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

### Goal
Deliver a working three-component React sidecar that captures notes as Isometry cards, provides embedded terminal with Claude Code integration, and offers universal preview capabilities—all while maintaining seamless bidirectional data flow with the main application.

## Phase Breakdown

### Phase 1: Foundation & Layout
**Goal:** Users can access the notebook interface with working component shells and data persistence
**Dependencies:** None (starting phase)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Plans:** 3 plans

**Success Criteria:**
1. User can navigate to notebook sidecar from main Isometry application
2. Three-component layout renders properly on desktop screens
3. Basic SQLite schema extension allows notebook card creation
4. NotebookContext provides shared state across all components
5. Layout state persists across browser sessions

Plans:
- [ ] 01-01-PLAN.md — Extend SQLite schema and TypeScript definitions
- [ ] 01-02-PLAN.md — Create NotebookContext and integrate mode toggle
- [ ] 01-03-PLAN.md — Implement three-component layout with shells

### Phase 2: Capture Implementation
**Goal:** Users can create and edit rich markdown cards with properties that seamlessly integrate into Isometry
**Dependencies:** Phase 1 (requires foundation and database)
**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04

**Success Criteria:**
1. User can write markdown with live preview and auto-save functionality
2. User can add and edit card properties through collapsible panel
3. User can trigger slash commands to insert Isometry DSL patterns
4. User can create new cards from templates and save custom templates
5. Created cards appear immediately in main Isometry application queries

### Phase 3: Shell Integration
**Goal:** Users can execute terminal commands and interact with Claude Code API within notebook context
**Dependencies:** Phase 2 (requires capture workflow for context)
**Requirements:** SHELL-01, SHELL-02, SHELL-03, SHELL-04

**Success Criteria:**
1. User can execute system commands in embedded terminal
2. User can interact with Claude Code API through terminal interface
3. Terminal commands can access current notebook card content as context
4. User can distinguish between system commands and AI commands through clear indicators
5. Command history persists and includes both command types

### Phase 4: Preview & Integration Polish
**Goal:** Users can preview content universally and export in multiple formats while experiencing seamless data flow
**Dependencies:** Phase 3 (requires full workflow for integration testing)
**Requirements:** PREV-01, PREV-02, PREV-03, PREV-04, INT-01, INT-02, INT-03, INT-04

**Success Criteria:**
1. User can view web content, PDFs, and images in preview component
2. User can see D3 visualizations render live as they edit data
3. User can export notebook content in multiple formats (PDF, HTML, data)
4. User experiences consistent theme across all components
5. System maintains 60fps performance with large datasets

## Dependencies

### External Dependencies
- Claude Code API access and quota management
- React 18.2+ ecosystem stability
- WKWebView availability for native preview
- Node.js 18+ development environment

### Internal Dependencies
- Existing Isometry React prototype codebase
- SQLite schema compatibility requirements
- Provider hierarchy patterns and TypeScript interfaces
- D3.js visualization engine and theme system

### Phase Dependencies
```
Phase 1 (Foundation) → Phase 2 (Capture) → Phase 3 (Shell) → Phase 4 (Preview/Polish)
       ↓                      ↓                    ↓                    ↓
   Data layer         Capture workflow     AI integration      Universal preview
```

## Risk Assessment & Mitigation

### High Risk Items

**Risk:** Claude Code API integration complexity and usage costs
- **Impact:** Shell component may not deliver AI assistance value
- **Mitigation:** Start with basic API integration in Phase 3, defer advanced features
- **Contingency:** Focus on terminal embedding, make AI optional enhancement

**Risk:** Three-component state synchronization race conditions
- **Impact:** Data loss or inconsistent state across components
- **Mitigation:** Use React Context with careful update batching, extensive testing
- **Contingency:** Simplify to hub-and-spoke pattern with NotebookContext coordination

**Risk:** SQLite schema evolution breaking main application
- **Impact:** Main Isometry app becomes unusable
- **Mitigation:** Additive-only schema changes, comprehensive migration testing
- **Contingency:** Separate database with export/import bridge to main app

### Medium Risk Items

**Risk:** WKWebView integration across macOS/iOS platforms
- **Impact:** Preview component limited to basic HTML rendering
- **Mitigation:** Start with browser component, add native features incrementally
- **Contingency:** Web-only preview using iframe with security restrictions

**Risk:** Performance degradation with large notebook collections
- **Impact:** Poor user experience, 60fps target missed
- **Mitigation:** Implement virtualization and lazy loading from Phase 1
- **Contingency:** Add pagination and reduce real-time features

### Low Risk Items

**Risk:** Markdown editor integration difficulties
- **Impact:** Basic text editing instead of rich markdown
- **Mitigation:** @uiw/react-md-editor is mature and well-documented
- **Contingency:** Multiple fallback editor libraries available

## Timeline Estimation

### Phase 1: Foundation & Layout (6-8 hours)
- Component structure setup: 2 hours
- SQLite schema extension: 2 hours
- Context integration: 2-3 hours
- Layout implementation: 1-2 hours

### Phase 2: Capture Implementation (8-10 hours)
- Markdown editor integration: 3-4 hours
- Properties panel: 2-3 hours
- Slash command system: 3 hours
- Template system: 2 hours

### Phase 3: Shell Integration (10-12 hours)
- Terminal embedding: 4-5 hours
- Claude Code API setup: 3-4 hours
- Context awareness: 2-3 hours
- Command routing: 2 hours

### Phase 4: Preview & Integration Polish (8-10 hours)
- Browser component: 3-4 hours
- D3 visualization: 2-3 hours
- Export functionality: 2 hours
- Performance optimization: 2-3 hours

**Total Estimated Development Time:** 32-40 hours
**With Testing and Iteration:** 40-50 hours
**Calendar Time (part-time):** 2-3 weeks

## Success Metrics

### Functional Success
- **Capture Flow:** User creates card in under 30 seconds
- **Integration:** Notebook cards appear in main app within 1 second
- **Shell Interaction:** Claude Code responses display within 10 seconds
- **Preview Rendering:** Content updates reflect within 2 seconds
- **Export Generation:** PDF export completes within 30 seconds

### Performance Targets
- **Rendering:** 60fps maintained with 1000+ cards
- **Memory Usage:** Under 500MB with typical workloads
- **Bundle Size:** Under 10MB compressed
- **SQLite Queries:** Under 100ms for real-time features
- **Component Updates:** Under 16ms per render cycle

### Quality Gates
- **Type Safety:** 100% TypeScript coverage with strict mode
- **Integration:** Zero breaking changes to main application
- **Accessibility:** Basic keyboard navigation and screen reader support
- **Browser Support:** Safari 14+, Chrome 90+, Firefox 90+
- **Error Handling:** Graceful degradation for API and network failures

## Technical Architecture Summary

### Component Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    ISOMETRY NOTEBOOK SIDECAR                   │
├─────────────────┬─────────────────┬─────────────────────────────┤
│     CAPTURE     │      SHELL      │           PREVIEW           │
│ (@uiw/react-md  │ (react-xtermjs) │      (WKWebView +           │
│  + Properties)  │ (Claude API)    │       D3.js)                │
└─────────────────┴─────────────────┴─────────────────────────────┘
│                     SHARED CONTEXT LAYER                       │
│    NotebookCtx + FilterCtx + PAFVCtx + ThemeCtx (existing)     │
│                                                                 │
│                       SQLITE DATABASE                          │
│  notebook_cards (new) + nodes/edges/facets (existing)          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Pattern
1. **Capture** → SQLite notebook_cards → **Main App** (seamless integration)
2. **Shell** → Claude API → **Capture** (AI-assisted content creation)
3. **Preview** → Live rendering → **Export** (visualization and output)

### Integration Points
- **Provider Hierarchy:** Extends existing React Context pattern
- **Database:** Additive SQLite schema maintaining backward compatibility
- **Styling:** Leverages existing Tailwind CSS variables and theme system
- **TypeScript:** Extends existing interfaces and type definitions

---

## Requirements Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Planned |
| FOUND-02 | Phase 1 | Planned |
| FOUND-03 | Phase 1 | Planned |
| FOUND-04 | Phase 1 | Planned |
| CAP-01 | Phase 2 | Pending |
| CAP-02 | Phase 2 | Pending |
| CAP-03 | Phase 2 | Pending |
| CAP-04 | Phase 2 | Pending |
| SHELL-01 | Phase 3 | Pending |
| SHELL-02 | Phase 3 | Pending |
| SHELL-03 | Phase 3 | Pending |
| SHELL-04 | Phase 3 | Pending |
| PREV-01 | Phase 4 | Pending |
| PREV-02 | Phase 4 | Pending |
| PREV-03 | Phase 4 | Pending |
| PREV-04 | Phase 4 | Pending |
| INT-01 | Phase 4 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |

**Coverage:** 20/20 requirements mapped ✓

---

**Phase 1 planned.** Next step: `/gsd:execute-phase 01-notebook-foundation` to begin implementation.