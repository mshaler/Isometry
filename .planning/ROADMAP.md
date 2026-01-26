# Isometry Notebook Sidecar Implementation Roadmap

**Project:** Isometry Notebook Sidecar
**Version:** v2.0 (Extended with Native Integration + SQL.js Migration)
**Target:** Production-ready native iOS/macOS apps with React prototype foundation and native API bridge
**Approach:** Multi-milestone incremental delivery

---

## Milestones

- ✅ **v1.0 React Prototype** - Phases 1-4 (completed)
- 🚧 **v2.0 Native Integration** - Phases 6.1-6.4 (in progress)
- 🚧 **v2.1 SQL.js Migration** - Phases 7.1-7.3 (planned)

## Milestone Overview

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**v1.0 Goal (Completed):** Deliver a working three-component React sidecar that captures notes as Isometry cards, provides embedded terminal with Claude Code integration, and offers universal preview capabilities.

**v2.0 Goal (Current):** Integrate React prototype functionality into native iOS/macOS apps that leverage existing infrastructure while providing superior performance and user experience within App Sandbox constraints.

**v2.1 Goal (Migration):** Phase out sql.js dependency by implementing native API bridge, maintaining React prototype functionality while connecting to production GRDB/CloudKit backend.

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
- [x] 06.1-01-PLAN.md — SwiftUI three-component layout with responsive design
- [x] 06.1-02-PLAN.md — Database schema extension and CloudKit integration
- [x] 06.1-03-PLAN.md — Navigation architecture and state management
- [x] 06.1-04-PLAN.md — Performance infrastructure and monitoring setup

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
- [ ] 06.2-01-PLAN.md — Native markdown editor with NSTextView/UITextView and live preview
- [ ] 06.2-02-PLAN.md — Property management interface with type-safe validation and CloudKit sync
- [ ] 06.2-03-PLAN.md — Template system using native collection views with built-in library
- [ ] 06.2-04-PLAN.md — Slash command system with native completion and Isometry DSL patterns

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
- [ ] 06.3-01-PLAN.md — App Sandbox terminal with NSTask/Process security
- [ ] 06.3-02-PLAN.md — Claude Code API native integration via URLSession
- [ ] 06.3-03-PLAN.md — Secure process execution framework within sandbox
- [ ] 06.3-04-PLAN.md — Command history and context management

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

### 📋 v2.1 SQL.js Migration (Planned)

**Milestone Goal:** Deprecate sql.js dependency by creating native API bridge while maintaining React prototype functionality for development testing.

#### Phase 7.1: API Bridge Foundation
**Goal:** Replace sql.js database layer with native API calls while maintaining exact same React component interfaces
**Dependencies:** Phase 6.4 (requires complete native implementation)
**Requirements:** MIG-API-01, MIG-API-02, MIG-API-03, MIG-API-04
**Plans:** 3 plans

**Success Criteria:**
1. React DatabaseContext connects to native API instead of sql.js
2. All existing SQL queries work through API translation layer
3. IndexedDB persistence replaced with native app communication
4. Zero breaking changes to React component layer
5. Performance equals or exceeds sql.js implementation

Plans:
- [ ] 07.1-01: Native API server with HTTP endpoints matching database operations
- [ ] 07.1-02: React API client replacing sql.js DatabaseContext
- [ ] 07.1-03: Query translation layer with sql.js compatibility

#### Phase 7.2: WebView Bridge Integration
**Goal:** Implement secure communication channel between React prototype and native app using WebView messaging
**Dependencies:** Phase 7.1 (requires API foundation)
**Requirements:** MIG-WV-01, MIG-WV-02, MIG-WV-03, MIG-WV-04
**Plans:** 4 plans

**Success Criteria:**
1. React prototype runs within native WKWebView with full functionality
2. Database operations route securely through WebView message handlers
3. File system access respects App Sandbox constraints
4. Real-time data sync maintains consistency between views
5. Performance monitoring shows native-equivalent response times

Plans:
- [ ] 07.2-01: WKWebView integration with MessageHandler bridge
- [ ] 07.2-02: Secure API routing through native message handlers
- [ ] 07.2-03: File system abstraction layer for sandbox compliance
- [ ] 07.2-04: Real-time sync and conflict resolution

#### Phase 7.3: Migration Completion & Cleanup
**Goal:** Complete sql.js removal with automated testing, rollback procedures, and clean deprecation path
**Dependencies:** Phase 7.2 (requires bridge integration)
**Requirements:** MIG-COMP-01, MIG-COMP-02, MIG-COMP-03, MIG-COMP-04
**Plans:** 3 plans

**Success Criteria:**
1. Comprehensive test suite validates migration integrity
2. Rollback procedures allow safe reversion to sql.js if needed
3. Build system removes sql.js dependencies and CDN loading
4. Documentation guides future developers on native-first architecture
5. Performance benchmarks demonstrate migration success

Plans:
- [ ] 07.3-01: Comprehensive migration testing and validation
- [ ] 07.3-02: Rollback mechanisms and safety procedures
- [ ] 07.3-03: Final cleanup and documentation

## Dependencies

### v2.1 Migration External Dependencies
- **Native v2.0 completion** with full GRDB/CloudKit functionality
- **WKWebView** support for React prototype hosting
- **MessageHandler** API for secure bridge communication
- **App Sandbox** compliance for file system operations

### v2.1 Migration Internal Dependencies
- **Existing sql.js implementation** providing compatibility reference
- **Native GRDB database** with complete schema and operations
- **React prototype** providing UI patterns and workflows
- **Performance infrastructure** for migration validation

### Phase Dependencies
```
v1.0: Phase 1 → Phase 2 → Phase 3 → Phase 4 (COMPLETED)
v2.0: Phase 6.1 → Phase 6.2 → Phase 6.3 → Phase 6.4 (IN PROGRESS)
v2.1: Phase 7.1 → Phase 7.2 → Phase 7.3 (PLANNED)
```

## Progress

**Execution Order:**
Native: 6.1 → 6.2 → 6.3 → 6.4
Migration: 7.1 → 7.2 → 7.3

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 2. Capture | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 3. Shell | v1.0 | 4/4 | Complete | YYYY-MM-DD |
| 4. Preview | v1.0 | 3/3 | Complete | YYYY-MM-DD |
| 6.1. Native Foundation | v2.0 | 4/4 | Complete | 2026-01-25 |
| 6.2. Native Capture | v2.0 | 0/4 | Planned | - |
| 6.3. Native Shell | v2.0 | 4/4 | Planned | - |
| 6.4. Native Platform | v2.0 | 0/4 | Not started | - |
| 7.1. API Bridge | v2.1 | 0/3 | Not started | - |
| 7.2. WebView Bridge | v2.1 | 0/4 | Not started | - |
| 7.3. Migration Complete | v2.1 | 0/3 | Not started | - |

## Architecture Integration Summary

### v1.0 → v2.0 → v2.1 Evolution

```
v1.0 React Prototype    v2.0 Native Integration    v2.1 Migration Complete
====================    =======================    ========================
sql.js → IndexedDB      GRDB → CloudKit            Native API Bridge
D3.js → Canvas          Canvas + SuperGrid         Canvas + SuperGrid
React Components        SwiftUI Views              React + SwiftUI Hybrid
Browser Environment     Native iOS/macOS           WebView + Native
```

### Migration Data Flow
```
React Components
       ↓
DatabaseContext (React)
       ↓ (API calls)
Native HTTP Server
       ↓ (GRDB operations)
IsometryDatabase (Swift)
       ↓ (CloudKit sync)
Production Backend
```

### Performance Targets (v2.1 vs v1.0 vs v2.0)

| Metric | v1.0 sql.js | v2.0 Native | v2.1 Bridge |
|--------|-------------|-------------|-------------|
| **Rendering** | 30-45fps | 60fps | 55-60fps |
| **Memory** | Baseline | -50% | -40% |
| **Launch Time** | 5-8 seconds | <3 seconds | <4 seconds |
| **Battery** | Baseline | +25% | +20% |
| **Data Integrity** | Local only | CloudKit sync | CloudKit sync |

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
| NAT-FOUND-01 | Phase 6.1 | ✓ Complete |
| NAT-FOUND-02 | Phase 6.1 | ✓ Complete |
| NAT-FOUND-03 | Phase 6.1 | ✓ Complete |
| NAT-FOUND-04 | Phase 6.1 | ✓ Complete |
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

### v2.1 SQL.js Migration Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIG-API-01 | Phase 7.1 | ❌ Planned |
| MIG-API-02 | Phase 7.1 | ❌ Planned |
| MIG-API-03 | Phase 7.1 | ❌ Planned |
| MIG-API-04 | Phase 7.1 | ❌ Planned |
| MIG-WV-01 | Phase 7.2 | ❌ Planned |
| MIG-WV-02 | Phase 7.2 | ❌ Planned |
| MIG-WV-03 | Phase 7.2 | ❌ Planned |
| MIG-WV-04 | Phase 7.2 | ❌ Planned |
| MIG-COMP-01 | Phase 7.3 | ❌ Planned |
| MIG-COMP-02 | Phase 7.3 | ❌ Planned |
| MIG-COMP-03 | Phase 7.3 | ❌ Planned |
| MIG-COMP-04 | Phase 7.3 | ❌ Planned |

**v2.1 Coverage:** 12/12 requirements mapped ✓

---

## Migration Strategy

### Zero-Downtime Approach
1. **Phase 7.1**: Build API compatibility layer alongside existing sql.js
2. **Phase 7.2**: Implement WebView bridge with feature-flag toggles
3. **Phase 7.3**: Complete transition with rollback procedures

### Data Integrity Protection
- Automated backup before each migration phase
- Comprehensive test suite for data validation
- Real-time sync verification with native backend
- Rollback procedures for safe reversion

### Performance Validation
- Benchmark current sql.js performance as baseline
- Continuous monitoring during bridge implementation
- Regression testing for UI responsiveness
- Memory usage and battery consumption tracking

---

**Current step:** Phase 6.3 planning complete - Ready for shell integration execution.

**Next step:** `/gsd:execute-phase 6.3` to implement native shell integration.