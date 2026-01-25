# Isometry Notebook Sidecar Implementation Roadmap

**Project:** Isometry Notebook Sidecar
**Version:** v2.0 (Extended with Native Integration)
**Target:** Production-ready native iOS/macOS apps with React prototype foundation
**Approach:** Multi-milestone incremental delivery

---

## Milestones

- ✅ **v1.0 React Prototype** - Phases 1-4 (completed YYYY-MM-DD)
- 🚧 **v2.0 Native Integration** - Phases 6.1-6.4 (planned)

## Milestone Overview

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**v1.0 Goal (Completed):** Deliver a working three-component React sidecar that captures notes as Isometry cards, provides embedded terminal with Claude Code integration, and offers universal preview capabilities.

**v2.0 Goal (Current):** Integrate React prototype functionality into native iOS/macOS apps that leverage existing infrastructure while providing superior performance and user experience within App Sandbox constraints.

---

## Phases

<details>
<summary>✅ v1.0 React Prototype (Phases 1-4) - COMPLETED</summary>

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
- [x] 01-01-PLAN.md — Extend SQLite schema and TypeScript definitions
- [x] 01-02-PLAN.md — Create NotebookContext and integrate mode toggle
- [x] 01-03-PLAN.md — Implement three-component layout with shells

### Phase 2: Capture Implementation
**Goal:** Users can create and edit rich markdown cards with properties that seamlessly integrate into Isometry
**Dependencies:** Phase 1 (requires foundation and database)
**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04
**Plans:** 3 plans

**Success Criteria:**
1. User can write markdown with live preview and auto-save functionality ✓
2. User can add and edit card properties through collapsible panel
3. User can trigger slash commands to insert Isometry DSL patterns
4. User can create new cards from templates and save custom templates
5. Created cards appear immediately in main Isometry application queries ✓

Plans:
- [x] 02-01-PLAN.md — Slash commands system for Isometry DSL patterns
- [x] 02-02-PLAN.md — Editable properties panel with multiple field types
- [x] 02-03-PLAN.md — Template system and card creation workflow

### Phase 3: Shell Integration
**Goal:** Users can execute terminal commands and interact with Claude Code API within notebook context
**Dependencies:** Phase 2 (requires capture workflow for context)
**Requirements:** SHELL-01, SHELL-02, SHELL-03, SHELL-04
**Plans:** 4 plans

**Success Criteria:**
1. User can execute system commands in embedded terminal
2. User can interact with Claude Code API through terminal interface
3. Terminal commands can access current notebook card content as context
4. User can distinguish between system commands and AI commands through clear indicators
5. Command history persists and includes both command types

Plans:
- [x] 03-01-PLAN.md — Terminal emulator integration with @xterm/xterm and node-pty
- [x] 03-02-PLAN.md — Claude Code API integration with @anthropic-ai/sdk
- [x] 03-03-PLAN.md — Command routing system and project context awareness
- [x] 03-04-PLAN.md — Command history with persistence and navigation

### Phase 4: Preview & Integration Polish
**Goal:** Users can preview content universally and export in multiple formats while experiencing seamless data flow
**Dependencies:** Phase 3 (requires full workflow for integration testing)
**Requirements:** PREV-01, PREV-02, PREV-03, PREV-04, INT-01, INT-02, INT-03, INT-04
**Plans:** 3 plans

**Success Criteria:**
1. User can view web content, PDFs, and images in preview component
2. User can see D3 visualizations render live as they edit data
3. User can export notebook content in multiple formats (PDF, HTML, data)
4. User experiences consistent theme across all components
5. System maintains 60fps performance with large datasets

Plans:
- [x] 04-01-PLAN.md — Universal content preview and export functionality
- [x] 04-02-PLAN.md — D3 visualization rendering with live data updates
- [x] 04-03-PLAN.md — Integration polish and performance optimization

</details>

### 🚧 v2.0 Native Integration (In Progress)

**Milestone Goal:** Integrate completed React prototype functionality into native iOS/macOS apps for superior performance and user experience while leveraging existing native infrastructure.

#### Phase 6.1: Foundation & Layout
**Goal:** Native app infrastructure supports notebook workflow with three-component layout and database integration
**Dependencies:** None (leverages existing native infrastructure)
**Requirements:** NAT-FOUND-01, NAT-FOUND-02, NAT-FOUND-03, NAT-FOUND-04
**Plans:** 4 plans

**Success Criteria:**
1. User can access notebook mode from main iOS/macOS app navigation
2. Three-component SwiftUI layout renders with responsive sizing
3. Database schema extensions support notebook cards with CloudKit sync
4. Navigation preserves state between main app and notebook modes
5. Performance monitoring tracks notebook operations at 60fps target

Plans:
- [ ] 06.1-01-PLAN.md — SwiftUI three-component layout with responsive design
- [ ] 06.1-02-PLAN.md — Database schema extension and CloudKit integration
- [ ] 06.1-03-PLAN.md — Navigation architecture and state management
- [ ] 06.1-04-PLAN.md — Performance infrastructure and monitoring setup

#### Phase 6.2: Capture Implementation
**Goal:** Users can create and edit rich markdown notebook cards with native text editing and property management
**Dependencies:** Phase 6.1 (requires foundation and database)
**Requirements:** NAT-CAP-01, NAT-CAP-02, NAT-CAP-03, NAT-CAP-04
**Plans:** 4 plans

**Success Criteria:**
1. User can edit markdown with native text views and live preview
2. User can manage card properties through native interface panels
3. User can select and create cards from native template gallery
4. User can trigger slash commands through native text input completion
5. Auto-save preserves work with CloudKit synchronization

Plans:
- [ ] 06.2-01: Native markdown editor with NSTextView/UITextView
- [ ] 06.2-02: Property management interface with CloudKit integration
- [ ] 06.2-03: Template system using native collection views
- [ ] 06.2-04: Slash command system with native completion

#### Phase 6.3: Shell Integration
**Goal:** Users can execute terminal commands and interact with Claude Code API within App Sandbox security constraints
**Dependencies:** Phase 6.2 (requires capture workflow for context)
**Requirements:** NAT-SHELL-01, NAT-SHELL-02, NAT-SHELL-03, NAT-SHELL-04
**Plans:** 4 plans

**Success Criteria:**
1. User can execute sandboxed system commands in native terminal interface
2. User can interact with Claude Code API through direct URLSession integration
3. Terminal commands respect App Sandbox file access restrictions
4. Command history persists across app sessions with native search
5. Process execution continues appropriately when app backgrounds

Plans:
- [ ] 06.3-01: App Sandbox terminal with NSTask/Process security
- [ ] 06.3-02: Claude Code API native integration via URLSession
- [ ] 06.3-03: Secure process execution framework within sandbox
- [ ] 06.3-04: Command history and context management

#### Phase 6.4: Preview & Platform Integration
**Goal:** Users can preview content with native Canvas visualizations and export capabilities while experiencing seamless platform integration
**Dependencies:** Phase 6.3 (requires full workflow for integration testing)
**Requirements:** NAT-PREV-01, NAT-PREV-02, NAT-PREV-03, NAT-PREV-04, NAT-PLAT-01, NAT-PLAT-02, NAT-PLAT-03, NAT-PLAT-04
**Plans:** 4 plans

**Success Criteria:**
1. User can view Canvas-based visualizations that exceed D3.js performance
2. User can preview web content and local files through WKWebView
3. User can export notebook content using native share sheet and multiple formats
4. User experiences iOS/macOS-specific features like split view, multiple windows
5. CloudKit synchronization maintains data consistency across devices

Plans:
- [ ] 06.4-01: Native Canvas visualization using SuperGrid patterns
- [ ] 06.4-02: WKWebView integration and native export system
- [ ] 06.4-03: iOS-specific features (multitasking, touch optimization)
- [ ] 06.4-04: macOS-specific features and App Store compliance

## Dependencies

### v2.0 External Dependencies
- **iOS 16+ / macOS 14+** for latest SwiftUI and performance features
- **Claude Code API** access with native URLSession integration
- **App Store Review** approval for sandbox and API usage
- **CloudKit** account and development team for sync functionality

### v2.0 Internal Dependencies
- **Existing native codebase** with SuperGrid Canvas, database, and CloudKit sync
- **React prototype completion** providing feature specification and UX patterns
- **Database schema compatibility** maintaining existing node/edge relationships
- **Performance infrastructure** including PerformanceMonitor and optimization systems

### Phase Dependencies
```
v1.0: Phase 1 → Phase 2 → Phase 3 → Phase 4 (COMPLETED)
v2.0: Phase 6.1 → Phase 6.2 → Phase 6.3 → Phase 6.4 (PLANNED)
```

## Progress

**Execution Order:**
Phases execute in numeric order: 6.1 → 6.2 → 6.3 → 6.4

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 2. Capture | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 3. Shell | v1.0 | 4/4 | Complete | YYYY-MM-DD |
| 4. Preview | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 6.1. Native Foundation | v2.0 | 0/4 | Not started | - |
| 6.2. Native Capture | v2.0 | 0/4 | Not started | - |
| 6.3. Native Shell | v2.0 | 0/4 | Not started | - |
| 6.4. Native Platform | v2.0 | 0/4 | Not started | - |

## Architecture Integration Summary

### v1.0 React Prototype → v2.0 Native Integration

```
React Components          Native SwiftUI
=================        ===============
Three-pane layout   →    NavigationSplitView
Markdown editor     →    NSTextView/UITextView
Properties panel    →    SwiftUI Forms
D3 visualizations   →    Canvas + SuperGrid patterns
Terminal emulation  →    NSTask/Process
Export functions    →    Native share sheet
```

### Performance Targets (v2.0 vs v1.0)
- **Rendering:** 60fps maintained (vs 30-45fps web)
- **Memory:** 50% reduction compared to React/browser
- **Launch Time:** Under 3 seconds (vs 5-8 seconds web)
- **Battery:** 25% improvement on iOS devices

---

## Requirements Traceability

### v1.0 React Prototype Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | ✓ Complete |
| FOUND-02 | Phase 1 | ✓ Complete |
| FOUND-03 | Phase 1 | ✓ Complete |
| FOUND-04 | Phase 1 | ✓ Complete |
| CAP-01 | Phase 2 | ✓ Complete |
| CAP-02 | Phase 2 | ✓ Complete |
| CAP-03 | Phase 2 | ✓ Complete |
| CAP-04 | Phase 2 | ✓ Complete |
| SHELL-01 | Phase 3 | ✓ Complete |
| SHELL-02 | Phase 3 | ✓ Complete |
| SHELL-03 | Phase 3 | ✓ Complete |
| SHELL-04 | Phase 3 | ✓ Complete |
| PREV-01 | Phase 4 | ✓ Complete |
| PREV-02 | Phase 4 | ✓ Complete |
| PREV-03 | Phase 4 | ✓ Complete |
| PREV-04 | Phase 4 | ✓ Complete |
| INT-01 | Phase 4 | ✓ Complete |
| INT-02 | Phase 4 | ✓ Complete |
| INT-03 | Phase 4 | ✓ Complete |
| INT-04 | Phase 4 | ✓ Complete |

**v1.0 Coverage:** 20/20 requirements complete ✓

### v2.0 Native Integration Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAT-FOUND-01 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-02 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-03 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-04 | Phase 6.1 | ❌ Planned |
| NAT-CAP-01 | Phase 6.2 | ❌ Planned |
| NAT-CAP-02 | Phase 6.2 | ❌ Planned |
| NAT-CAP-03 | Phase 6.2 | ❌ Planned |
| NAT-CAP-04 | Phase 6.2 | ❌ Planned |
| NAT-SHELL-01 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-02 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-03 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-04 | Phase 6.3 | ❌ Planned |
| NAT-PREV-01 | Phase 6.4 | ❌ Planned |
| NAT-PREV-02 | Phase 6.4 | ❌ Planned |
| NAT-PREV-03 | Phase 6.4 | ❌ Planned |
| NAT-PREV-04 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-01 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-02 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-03 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-04 | Phase 6.4 | ❌ Planned |

**v2.0 Coverage:** 20/20 requirements mapped ✓

---

**Next step:** `/gsd:execute-phase 6.1` to begin SwiftUI foundation and database integration for native iOS/macOS implementation.