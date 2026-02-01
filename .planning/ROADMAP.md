# Isometry Notebook Sidecar Implementation Roadmap

**Project:** Isometry Notebook Sidecar
**Version:** v3.1 (Live Database Integration)
**Target:** Production-ready native iOS/macOS apps with React prototype bridge
**Approach:** Multi-milestone incremental delivery

---

## Milestones

- ✅ **v1.0 React Prototype** - Phases 1-4 (completed)
- 🚧 **v2.0 Native Integration** - Phases 6.1-6.4 (in progress)
- 🚧 **v2.1 SQL.js Migration** - Phases 7.1-7.3 (planned)
- ✅ **v2.2 Database Versioning & ETL Operations** - Phases 8.1-8.4 (completed)
- 🏗️ **v2.3 Production Readiness Infrastructure** - Phases 9.1-9.4 (App Store submission capability)
- 🚧 **v2.4 Error Elimination** - Phase 10 (absolute zero lint problems - GAP CLOSURE)
- 🚧 **v2.5 Advanced Import Systems** - Phases 11.1-11.4 (comprehensive import verification)
- 🆕 **v2.6 Graph Analytics Engine** - Phases 12.1-12.4 (intelligent connection discovery and query optimization)
- 🚀 **v3.0 Production Deployment** - Phases 13.1-17 (App Store launch and production infrastructure) - ✅ COMPLETED
- 🔄 **v3.1 Live Database Integration** - Phases 18-21, 25-27 (React-native SQLite bridge with real-time synchronization) - 🔧 GAP CLOSURE IN PROGRESS
- 🆕 **v3.2 Enhanced Apple Integration** - Phase 29 (Live Apple Notes sync with CRDT conflict resolution) - 📋 PLANNED

## Milestone Overview

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**v1.0 Goal (Completed):** Deliver a working three-component React sidecar that captures notes as Isometry cards, provides embedded terminal with Claude Code integration, and offers universal preview capabilities.

**v2.0 Goal (Current):** Integrate React prototype functionality into native iOS/macOS apps that leverage existing infrastructure while providing superior performance and user experience within App Sandbox constraints.

**v2.1 Goal (Migration):** Phase out sql.js dependency by implementing native API bridge, maintaining React prototype functionality while connecting to production GRDB/CloudKit backend.

**v2.2 Goal (Retrofitting - COMPLETED):** Integrate existing database versioning and ETL operations system into GSD methodology governance through comprehensive verification and testing phases.

**v2.3 Goal (Production Readiness):** Establish comprehensive App Store submission capability through systematic verification of production readiness infrastructure including compliance validation, CloudKit production deployment, performance benchmarking, and beta testing frameworks.

**v2.4 Goal (Error Elimination):** Achieve absolute zero lint problems (205→139→21→0) through comprehensive type safety, ESLint configuration, and systematic elimination of all remaining errors and warnings.

**v2.5 Goal (Advanced Import Systems):** Integrate existing advanced import systems (Office documents, SQLite databases, Apple ecosystem) into GSD methodology governance with comprehensive verification and enterprise-grade capability validation.

**v2.6 Goal (Graph Analytics Engine):** Integrate sophisticated graph analytics engine with intelligent connection discovery, query optimization, and large-scale graph processing capabilities. Implement CardBoard v1/v2 research-derived algorithms for connection suggestions, cache optimization, and predictive analytics.

**v3.0 Goal (Production Deployment - COMPLETED):** Complete App Store submission and production launch with CloudKit production infrastructure, distribution pipeline, beta testing, marketing systems, and post-launch operations.

**v3.1 Goal (Live Database Integration - GAP CLOSURE):** Connect React frontend to native SQLite backend with real-time data synchronization and performance monitoring, establishing foundational bridge communication infrastructure before advanced real-time features. **Critical:** Infrastructure complete but requires application integration gap closure.

**v3.2 Goal (Enhanced Apple Integration):** Transform Apple Notes integration with live synchronization, real-time change detection, sophisticated conflict resolution, and seamless bidirectional sync. Leverage existing AltoIndexImporter foundation to provide production-ready live Notes integration.

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

<details>
<summary>✅ v3.0 Production Deployment (Phases 13-17) - COMPLETED</summary>

### Phase 15: Production Infrastructure Foundation (COMPLETED)
**Goal:** Establish production-ready infrastructure for App Store submission
**Status:** ✅ COMPLETED
- Production CloudKit environment setup and configuration
- Distribution certificates and automated provisioning management
- Security audit framework and compliance validation
- Legal documentation and privacy policy establishment

### Phase 16: Real-time Visualizations & Performance (COMPLETED)
**Goal:** Optimize visualization performance and implement real-time rendering capabilities
**Status:** ✅ COMPLETED (Phase 16.4 - Production Performance Validation)
- Native rendering optimization engine achieving <16ms frame rendering
- Comprehensive performance monitoring dashboard with real-time metrics
- Advanced memory management with leak detection and prevention
- 60fps performance targets achieved with production-ready validation

### Phase 17: App Store Submission Preparation (COMPLETED)
**Goal:** Finalize App Store submission package and deployment automation
**Status:** ✅ COMPLETED
- Complete App Store metadata and asset package
- Enterprise-grade security audit (96.5% security score)
- GDPR compliance framework (98.5% compliance)
- Production deployment automation and quality assurance

</details>

### 🔧 v3.1 Live Database Integration (GAP CLOSURE REQUIRED)

**Milestone Goal:** Connect React frontend to native SQLite backend with real-time data synchronization and performance monitoring. This milestone establishes foundational bridge communication infrastructure before advanced real-time features, following research-recommended foundation-first approach to prevent technical debt accumulation.

**Current Status:** Infrastructure complete but application integration gaps require closure.

#### Phase 18: Bridge Optimization Foundation
**Goal:** Establish reliable, performant bridge communication infrastructure
**Depends on:** Phase 17 (App Store Submission Preparation)
**Requirements:** BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05
**Success Criteria** (what must be TRUE):
  1. Bridge message latency consistently under 16ms for 60fps UI responsiveness
  2. Message payload sizes reduced by 40-60% through binary serialization vs JSON baseline
  3. Large query results automatically paginate with maximum 50 records per message
  4. Bridge maintains zero communication failures under normal operation with circuit breaker recovery
  5. Performance monitoring dashboard displays real-time bridge operation metrics and alerts
**Plans:** 3 plans

Plans:
- [x] 18-01-PLAN.md — Core Infrastructure (Message batching and binary serialization)
- [x] 18-02-PLAN.md — Advanced Features (Query pagination and circuit breaker patterns)
- [x] 18-03-PLAN.md — Monitoring & Integration (Performance dashboard and seamless integration)

#### Phase 19: Real-Time Change Notifications
**Goal:** Deliver live query results that automatically update React components when database changes
**Depends on:** Phase 18
**Requirements:** SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05
**Success Criteria** (what must be TRUE):
  1. React components receive live updates within 100ms of database changes
  2. UI responds instantly to user actions with optimistic updates and rollback on failure
  3. Application clearly displays connection status and operates fully offline
  4. Database changes from multiple sources appear in correct chronological order
  5. Failed operations automatically rollback with proper state cleanup and user notification
**Plans:** 2 plans

Plans:
- [x] 19-01-PLAN.md — GRDB ValueObservation and React live query infrastructure
- [x] 19-02-PLAN.md — Optimistic updates, connection management, and conflict resolution

#### Phase 20: Transaction and Sync Management
**Goal:** Provide transaction safety across bridge boundaries with multi-device conflict resolution
**Depends on:** Phase 19
**Requirements:** TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05
**Success Criteria** (what must be TRUE):
  1. Multi-step operations complete atomically or rollback entirely with ACID guarantees
  2. React components can group multiple operations into single database transactions
  3. Conflicts from simultaneous editing on multiple devices resolve with user control
  4. Failed transactions rollback completely within 50ms without leaving partial state
  5. Every bridge operation has correlation ID for debugging and transaction tracking
**Plans:** 2 plans

Plans:
- [x] 20-01-PLAN.md — Transaction coordination infrastructure (TRANS-01, TRANS-02, TRANS-05)
- [x] 20-02-PLAN.md — Conflict resolution and rollback management (TRANS-03, TRANS-04)

#### Phase 21: Advanced Query and Caching
**Goal:** Optimize performance for large datasets with intelligent caching and virtual scrolling
**Depends on:** Phase 20
**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. Large lists scroll smoothly with virtual rendering regardless of dataset size
  2. Frequently accessed data loads instantly from intelligent cache with proper invalidation
  3. Memory usage remains stable during extended operation without reference cycle leaks
  4. Database changes sync automatically in background with retry logic for failed operations
  5. Sync behavior adapts to connection quality for optimal bandwidth usage
**Plans:** 5 plans

Plans:
- [x] 21-01-PLAN.md — Virtual scrolling & query caching infrastructure (PERF-01, PERF-02)
- [x] 21-02-PLAN.md — Advanced performance optimization (PERF-03, PERF-04, PERF-05)
- [x] 21-03-PLAN.md — Query provider and cache integration (gap closure)
- [x] 21-04-PLAN.md — Virtual scrolling integration (gap closure)
- [x] 21-05-PLAN.md — Performance utilities integration (gap closure)

#### Phase 25: Live Query Integration (Gap Closure)
**Goal:** Connect useLiveQuery hook to real-time change notifications for automatic React updates
**Depends on:** Phase 21
**Gap Closure:** Closes critical integration gaps from v3.1 milestone audit
**Success Criteria** (what must be TRUE):
  1. useLiveQuery automatically starts ValueObservation when components mount
  2. React components receive live database change notifications within 100ms
  3. Change notifications properly trigger React re-renders with updated data
  4. Live query subscriptions cleanup properly when components unmount
  5. Integration maintains existing useLiveQuery API without breaking changes
**Plans:** 1 plan

Plans:
- [x] 25-01-PLAN.md — Connect useLiveQuery to ChangeNotificationBridge.startObservation()

#### Phase 26: Virtual Scrolling Performance Integration (Gap Closure)
**Goal:** Integrate VirtualizedGrid/List components with useLiveQuery for live data and caching benefits
**Depends on:** Phase 25
**Gap Closure:** Closes virtual scrolling performance flow gaps from v3.1 milestone audit
**Success Criteria** (what must be TRUE):
  1. VirtualizedGrid and VirtualizedList render live data instead of static datasets
  2. Virtual scrolling components benefit from intelligent caching layer
  3. Large datasets (10k+ items) scroll smoothly with real-time updates
  4. Cache invalidation properly updates virtual scrolling rendered items
  5. Performance gains are measurable: cache hits >80%, scroll frame rate 60fps
**Plans:** 2 plans

Plans:
- [x] 26-01-PLAN.md — Replace static data with useLiveQuery integration in virtual components
- [x] 26-02-PLAN.md — Wire performance monitoring integration and large dataset optimization

#### Phase 27: Application Integration Gap Closure (NEW - CRITICAL)
**Goal:** Close critical application integration gaps to enable user access to live database features
**Depends on:** Phase 26
**Gap Closure:** Addresses critical gaps identified in v3.1 milestone audit
**Requirements:** APP-INT-01, APP-INT-02, APP-INT-03, APP-INT-04, APP-INT-05
**Success Criteria** (what must be TRUE):
  1. LiveDataProvider is properly installed in main application provider tree
  2. Canvas component migrated from old `data` props to SQL query API
  3. Main application components successfully connect to live database infrastructure
  4. End-to-end live database functionality verified and accessible to users
  5. TypeScript compilation errors resolved and type safety maintained
**Plans:** 5 plans

**Critical Issue:** Complete infrastructure exists but is disconnected from main application, preventing user access to sophisticated live database functionality.

Plans:
- [ ] 27-01-PLAN.md — Install LiveDataProvider in main application tree and fix provider wiring
- [ ] 27-02-PLAN.md — Migrate Canvas component API and fix component integration
- [ ] 27-03-PLAN.md — End-to-end integration verification and TypeScript error resolution
- [ ] 27-04-PLAN.md — Component usage verification and live query functionality testing
- [ ] 27-05-PLAN.md — Final integration polish and production readiness validation

### 🆕 v3.2 Enhanced Apple Integration

**Milestone Goal:** Transform Apple Notes integration with live synchronization, real-time change detection, sophisticated conflict resolution, and seamless bidirectional sync. Build upon the existing AltoIndexImporter foundation (6,891 notes successfully imported) to provide production-ready live Notes integration with CRDT conflict resolution and comprehensive user experience.

#### Phase 29: Enhanced Apple Notes Live Integration
**Goal:** Implement live Apple Notes synchronization with CRDT conflict resolution and comprehensive user experience
**Depends on:** Phase 27 (Application Integration Gap Closure)
**Success Criteria** (what must be TRUE):
  1. Real-time Notes synchronization with <1s change detection via FSEvents monitoring
  2. TCC permission management with graceful degradation and clear user communication
  3. CRDT conflict resolution maintains data integrity during multi-device collaborative editing
  4. User interface provides intuitive configuration and manual conflict resolution controls
  5. Performance optimized for large Notes libraries (10k+ notes capability) with efficient background processing
**Plans:** 3 plans

**Foundation:** AltoIndexImporter with proven import capability, enhanced with live sync infrastructure, FSEvents monitoring, CRDT conflict resolution, and comprehensive UI integration.

Plans:
- [ ] 29-01-PLAN.md — Enhanced AltoIndexImporter with live sync and TCC permission management
- [ ] 29-02-PLAN.md — FSEvents monitoring and CRDT conflict resolution infrastructure
- [ ] 29-03-PLAN.md — User interface integration and performance optimization for large libraries

## Dependencies

### v3.1 Live Database Integration External Dependencies
- **GRDB.swift 6.24.0** with ValueObservation for real-time change notifications
- **MessagePack binary serialization** for 40-60% payload reduction vs JSON
- **TanStack Virtual 3.2.0** for large dataset virtual scrolling performance
- **WKWebView MessageHandler** API for secure bridge communication
- **Native SQLite with FTS5** for text search performance optimization

### v3.2 Enhanced Apple Integration External Dependencies
- **FSEvents Framework** for real-time file system monitoring
- **EventKit Framework** for Notes access with TCC permission management
- **Notes Framework** for direct Notes app integration (limited by sandbox)
- **Swift-protobuf** for Notes content format parsing
- **Swift Concurrency (Actor)** for background processing and thread safety

### v3.1 Live Database Integration Internal Dependencies
- **Existing React prototype** providing UI patterns and component architecture
- **Native GRDB database** with complete schema and CloudKit sync operations
- **WebView bridge infrastructure** from previous milestone implementations
- **Performance monitoring** systems for bridge optimization validation

### v3.2 Enhanced Apple Integration Internal Dependencies
- **AltoIndexImporter foundation** with proven 6,891 note import capability
- **GRDB database integration** for seamless data persistence
- **WebView bridge infrastructure** for React-native communication
- **Existing conflict resolution patterns** from bridge infrastructure

### Phase Dependencies
```
v3.1: Phase 18 → Phase 19 → Phase 20 → Phase 21 → Phase 25 → Phase 26 → Phase 27 (Gap Closure)
v3.2: Phase 29 (Enhanced Apple Notes Live Integration)
```

**Phase Ordering Rationale (Research-Based):**
- **Foundation-first approach** prevents technical debt accumulation that becomes expensive to fix later
- **Bridge optimization** must precede real-time features to avoid performance bottlenecks under load
- **Transaction management** requires understanding of bridge communication patterns before implementation
- **Advanced features** like virtual scrolling depend on stable real-time and sync infrastructure
- **Application integration** requires complete infrastructure before connecting main app components
- **Enhanced Apple integration** builds upon proven foundation with sophisticated live sync capabilities

---

## Progress

**Execution Order:**
Phases execute in numeric order: 18 → 19 → 20 → 21 → 25 → 26 → 27 → 29

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Bridge Optimization Foundation | 3/3 | ✓ Complete | 2026-01-30 |
| 19. Real-Time Change Notifications | 2/2 | ✓ Complete | 2026-01-30 |
| 20. Transaction and Sync Management | 2/2 | ✓ Complete | 2026-01-31 |
| 21. Advanced Query and Caching | 5/5 | ✓ Complete | 2026-01-31 |
| 25. Live Query Integration | 1/1 | ✓ Complete | 2026-01-31 |
| 26. Virtual Scrolling Performance Integration | 2/2 | ✓ Complete | 2026-01-31 |
| 27. Application Integration Gap Closure | 3/5 | 🔧 In Progress | - |
| 29. Enhanced Apple Notes Live Integration | 0/3 | 📋 Planned | - |

## Architecture Integration Summary

### v3.1 Live Database Integration Data Flow
```
React Components ←→ WebView Bridge ←→ Native GRDB SQLite
├── useLiveQuery hook  ├── MessagePack serialization  ├── IsometryDatabase actor
├── Optimistic updates   ├── Circuit breaker patterns   ├── ValueObservation (GRDB)
├── Virtual scrolling    ├── Performance monitoring     ├── Transaction coordination
└── Cache invalidation   └── Bridge correlation IDs     └── CloudKit sync integration
```

### v3.2 Enhanced Apple Integration Data Flow
```
Apple Notes App ←→ FSEvents/EventKit ←→ AppleNotesLiveImporter ←→ IsometryDatabase ←→ WebView Bridge ←→ React UI
                ↗                    ↗                        ↗
         TCC Permissions      CRDT Conflict Resolution    Performance Optimization
```

### Performance Targets (v3.1 vs Baseline)

| Metric | Baseline (sql.js) | v3.1 Target | Research Basis |
|--------|------------------|-------------|----------------|
| **Bridge Latency** | N/A | <16ms | 60fps UI responsiveness |
| **Payload Size** | JSON baseline | -40-60% | MessagePack compression |
| **Change Notification** | Manual refresh | <100ms | GRDB ValueObservation |
| **Transaction Safety** | Local only | ACID compliant | Bridge transaction control |
| **Query Performance** | 2-5 seconds | <50ms cached | Intelligent caching + pagination |
| **Memory Usage** | Baseline | Stable | Reference cycle prevention |
| **Reliability** | Browser dependent | 99%+ uptime | Circuit breaker patterns |

### Performance Targets (v3.2 Enhanced Apple Integration)

| Metric | Target | Baseline | Approach |
|--------|--------|----------|----------|
| **Change Detection** | <1s | N/A | FSEvents monitoring |
| **Content Parsing** | <100ms/note | N/A | Background processing |
| **Conflict Resolution** | <200ms | N/A | CRDT algorithms |
| **Library Scale** | 10k+ notes | 6,891 notes | Incremental processing |

---

## Requirements Traceability

### v3.1 Live Database Integration Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIDGE-01 | Phase 18 | Complete |
| BRIDGE-02 | Phase 18 | Complete |
| BRIDGE-03 | Phase 18 | Complete |
| BRIDGE-04 | Phase 18 | Complete |
| BRIDGE-05 | Phase 18 | Complete |
| SYNC-01 | Phase 19 | Complete |
| SYNC-02 | Phase 19 | Complete |
| SYNC-03 | Phase 19 | Complete |
| SYNC-04 | Phase 19 | Complete |
| SYNC-05 | Phase 19 | Complete |
| TRANS-01 | Phase 20 | Complete |
| TRANS-02 | Phase 20 | Complete |
| TRANS-03 | Phase 20 | Complete |
| TRANS-04 | Phase 20 | Complete |
| TRANS-05 | Phase 20 | Complete |
| PERF-01 | Phase 21 | Complete |
| PERF-02 | Phase 21 | Complete |
| PERF-03 | Phase 21 | Complete |
| PERF-04 | Phase 21 | Complete |
| PERF-05 | Phase 21 | Complete |
| APP-INT-01 | Phase 27 | Pending |
| APP-INT-02 | Phase 27 | Pending |
| APP-INT-03 | Phase 27 | Pending |
| APP-INT-04 | Phase 27 | Pending |
| APP-INT-05 | Phase 27 | Pending |

**v3.1 Coverage:** 25/25 requirements mapped ✓

### v3.2 Enhanced Apple Integration Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTES-LIVE-01 | Phase 29 | Planned |
| NOTES-LIVE-02 | Phase 29 | Planned |
| NOTES-LIVE-03 | Phase 29 | Planned |
| NOTES-LIVE-04 | Phase 29 | Planned |
| NOTES-LIVE-05 | Phase 29 | Planned |

**v3.2 Coverage:** 5/5 requirements mapped ✓

---

## Migration Strategy

### Foundation-First Approach (Research-Based)
1. **Phase 18**: Establish reliable bridge communication before adding complexity
2. **Phase 19**: Add real-time capabilities on optimized foundation
3. **Phase 20**: Layer transaction safety on proven real-time infrastructure
4. **Phase 21**: Optimize performance once core functionality is stable
5. **Phase 27**: Connect complete infrastructure to main application components
6. **Phase 29**: Enhance proven AltoIndexImporter with sophisticated live sync capabilities

### Data Integrity Protection
- Bridge-level transaction control with ACID guarantees
- Optimistic updates with automatic rollback on failure
- Change event correlation and proper sequencing
- Comprehensive conflict resolution for multi-device scenarios
- CRDT algorithms for Notes collaborative editing

### Performance Validation
- Bridge latency monitoring with 16ms targets for 60fps
- Memory usage tracking to prevent reference cycles
- Query performance optimization through intelligent caching
- Background sync with bandwidth-aware optimization
- Notes library scaling for 10k+ notes with efficient processing

### Gap Closure Strategy
- **Critical Issue:** Infrastructure complete but inaccessible to users
- **Phase 27**: Simple wiring changes, no new components needed
- **Low effort, high impact:** Application-level integration only
- **Success metric:** Users can access live database features through main UI

### Enhanced Apple Integration Strategy
- **Build on proven foundation:** AltoIndexImporter with 6,891 notes imported
- **Hybrid architecture:** FSEvents + EventKit + enhanced alto-index processing
- **Permission-aware design:** TCC authorization with graceful fallbacks
- **User-centric conflict resolution:** Clear UI for manual conflict handling

---

*Last updated: 2026-02-01 after Phase 29 Enhanced Apple Notes Live Integration planning*