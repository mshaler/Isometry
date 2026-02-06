# Isometry

**Domain:** Native knowledge management with hybrid PAFV+LATCH+GRAPH visualization
**Type:** Native iOS/macOS applications with React prototype bridge
**Timeline:** Production-ready native implementation

## Current State: v3.1 Live Database Integration (SHIPPED)

**Successfully delivered:** React frontend connected to native SQLite backend with real-time data synchronization and performance monitoring

**Infrastructure achievements:**
- ✅ High-performance bridge communication with <16ms latency for 60fps UI responsiveness
- ✅ Real-time database synchronization using GRDB ValueObservation with <100ms change notifications
- ✅ ACID transaction safety across React-native bridge boundaries with automatic rollback
- ✅ Virtual scrolling optimization with intelligent caching for large datasets (10k+ items)
- ✅ End-to-end application integration with full user access to live database features

## Current Milestone: v4.1 SuperGrid Foundation

**Goal:** Implement the core SuperGrid polymorphic data projection system with nested PAFV headers, direct sql.js integration, dynamic axis assignment, grid continuum views, and Janus density controls.

**Target features:**
- SuperGrid Nested PAFV Headers with dimensional spanning across hierarchy levels
- Direct sql.js Integration for D3.js data binding with synchronous SQLite queries and zero serialization
- Dynamic Axis Assignment with drag-and-drop LATCH dimensions to different planes
- Basic Grid Continuum with view transitions (gallery → list → kanban → 2D grid → nD SuperGrid)
- Janus Density Model with orthogonal zoom (value) and pan (extent) controls

**Core capability enablement:**
1. Users can visualize the same dataset through multiple projection modes (grid/kanban/network/timeline)
2. Users can drag LATCH dimensions between spatial planes for real-time view transformation
3. Users can navigate data density through independent zoom/pan controls
4. D3.js queries SQLite directly in same memory space with zero bridge overhead
5. Nested headers provide hierarchical context across all PAFV dimensions

## Core Value

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## Problem Statement

Developers need a unified workspace that combines:
- Rapid note capture with structured card properties
- Terminal access with AI assistance (Claude Code)
- Universal content preview including visualizations
- Seamless data flow into existing knowledge graph systems

Current tools force context switching between separate applications, breaking flow state and fragmenting information.

## Solution Approach

Three-component React sidecar application:

1. **Capture**: Notion-style markdown editor with Isometry card properties, slash commands, and auto-save
2. **Shell**: Embedded terminal with Claude Code API integration and project context awareness
3. **Preview**: WKWebView browser with D3.js visualization support and universal content rendering

**Integration Strategy**: Extend existing Isometry React prototype architecture, sharing SQLite database, context providers, and TypeScript interfaces while maintaining component boundaries.

## Success Criteria

**Core Workflow Success:**
- User captures ideas as Isometry cards with zero friction
- Cards automatically appear in main Isometry application
- Terminal commands execute with full project context
- Visualizations render live during content creation
- Export workflows handle markdown, PDF, and data formats

**Integration Success:**
- Notebook cards participate in existing PAFV projections
- LATCH filters work across notebook and main application data
- GRAPH connections link notebook cards to existing knowledge
- Provider hierarchy remains consistent and performant
- TypeScript interfaces maintain type safety across components

**User Experience Success:**
- Single-window workflow without context switching
- Responsive layout adapts to different screen sizes
- Theme consistency with existing Isometry applications
- Performance maintains 60fps with 1000+ cards
- Data persistence survives application restarts

## Technical Constraints

**Architecture Constraints:**
- Must extend existing React prototype patterns
- Cannot break existing SQLite schema compatibility
- Must maintain provider hierarchy and hook patterns
- TypeScript strict mode compliance required

**Platform Constraints:**
- React 18+ for concurrent features
- Modern browsers (Safari 14+, Chrome 90+)
- macOS/iOS compatibility for WKWebView integration
- Node.js 18+ for development environment

**Integration Constraints:**
- SQLite database shared with main application
- Existing context providers must remain functional
- D3.js visualization engine compatibility required
- Claude Code API integration within usage limits

**Performance Constraints:**
- Component rendering under 16ms (60fps)
- SQLite queries under 100ms for real-time features
- Memory usage under 500MB for typical workloads
- Bundle size under 10MB compressed

## Non-Goals

- Complete IDE replacement (use existing tools)
- Real-time collaboration (single-user focused)
- Custom markdown parser (use proven libraries)
- Full browser engine (platform WKWebView only)
- Complex plugin architecture (fixed three-component design)
- Advanced terminal features (delegate to system terminal)

## Risk Assessment

**High Risk:**
- Claude Code API integration complexity and usage costs
- Terminal embedding security with project file access
- Three-component state synchronization without race conditions

**Medium Risk:**
- WKWebView integration across macOS/iOS platforms
- Performance optimization with large notebook collections
- SQLite schema evolution without breaking changes

**Low Risk:**
- Markdown editor integration (mature libraries available)
- React component architecture (established patterns)
- Theme and styling consistency (existing CSS variables)

## Requirements

### Validated

- ✓ Bridge message batching with <16ms latency for 60fps responsiveness — v3.1
- ✓ Binary serialization with 40-60% payload reduction via MessagePack — v3.1
- ✓ Query result pagination with maximum 50 records per message — v3.1
- ✓ Circuit breaker patterns for bridge reliability and failure recovery — v3.1
- ✓ Performance monitoring dashboard for real-time bridge operation metrics — v3.1
- ✓ Live query results using GRDB ValueObservation with <100ms change detection — v3.1
- ✓ Optimistic updates with rollback capability for failed operations — v3.1
- ✓ Real-time change notifications from native database to React components — v3.1
- ✓ Connection state awareness with offline/online operation modes — v3.1
- ✓ Change event correlation and sequencing to prevent race conditions — v3.1
- ✓ Bridge-level transaction control with ACID guarantees — v3.1
- ✓ Multi-operation transaction support across bridge boundaries — v3.1
- ✓ Conflict resolution framework for multi-device editing scenarios — v3.1
- ✓ Transaction rollback mechanisms with <50ms state cleanup — v3.1
- ✓ Operation correlation IDs for tracking and debugging — v3.1
- ✓ Virtual scrolling integration using TanStack Virtual for large datasets — v3.1
- ✓ Intelligent query result caching with TTL and invalidation strategies — v3.1
- ✓ Memory management patterns preventing cross-bridge reference cycles — v3.1
- ✓ Background sync queue with retry logic and exponential backoff — v3.1
- ✓ Bandwidth-aware sync optimization based on connection quality — v3.1
- ✓ LiveDataProvider installed in main application provider tree — v3.1
- ✓ Canvas component migrated from data props to SQL query API — v3.1
- ✓ Main application components connected to live database infrastructure — v3.1
- ✓ End-to-end live data flow verified and accessible to users — v3.1
- ✓ TypeScript compilation succeeding with live database integration — v3.1

### Active

- [ ] SuperGrid Nested PAFV Headers with dimensional spanning across hierarchy levels
- [ ] Direct sql.js Integration for D3.js data binding with synchronous SQLite queries and zero serialization
- [ ] Dynamic Axis Assignment with drag-and-drop LATCH dimensions to different planes
- [ ] Basic Grid Continuum with view transitions (gallery → list → kanban → 2D grid → nD SuperGrid)
- [ ] Janus Density Model with orthogonal zoom (value) and pan (extent) controls

### Out of Scope

- Complex ORM layer — Direct SQL provides better performance and control
- Real-time everything — Selective real-time based on user interaction patterns prevents performance degradation
- Automatic conflict merging — Knowledge management requires user control over conflict resolution to preserve data integrity
- Advanced query builder UI — Defer complex query building to future milestones

## Dependencies

**External:**
- Claude Code API access and usage quotas
- React ecosystem stability (18.2+)
- SQLite compatibility with browser environment

**Internal:**
- Existing Isometry React prototype codebase
- Established provider hierarchy and context patterns
- SQLite schema and TypeScript interface definitions
- D3.js visualization components and themes

---
*Last updated: 2026-02-05 after v4.1 SuperGrid Foundation milestone definition*
