# Isometry v3.1 Requirements

**Milestone:** v3.1 Live Database Integration
**Goal:** Connect React frontend to native SQLite backend with real-time data synchronization and performance monitoring
**Last Updated:** 2026-01-31

## v3.1 Requirements for THIS Milestone

### Bridge Optimization
- [x] **BRIDGE-01**: Message batching with configurable intervals (≤16ms for 60fps)
- [x] **BRIDGE-02**: Binary serialization using MessagePack for 40-60% payload reduction
- [x] **BRIDGE-03**: Query result pagination with maximum 50 records per message
- [x] **BRIDGE-04**: Circuit breaker patterns for bridge reliability and failure recovery
- [x] **BRIDGE-05**: Performance monitoring dashboard for bridge operation metrics

### Real-Time Synchronization
- [x] **SYNC-01**: Live query results using GRDB ValueObservation for change detection
- [x] **SYNC-02**: Optimistic updates with rollback capability for failed operations
- [x] **SYNC-03**: Real-time change notifications from native database to React components
- [x] **SYNC-04**: Connection state awareness with offline/online operation modes
- [x] **SYNC-05**: Change event correlation and proper sequencing to prevent race conditions

### Transaction Management
- [x] **TRANS-01**: Bridge-level transaction control with ACID guarantee exposure
- [x] **TRANS-02**: Multi-operation transaction support across bridge boundaries
- [x] **TRANS-03**: Conflict resolution framework for multi-device editing scenarios
- [x] **TRANS-04**: Transaction rollback mechanisms with proper state cleanup
- [x] **TRANS-05**: Operation correlation IDs for tracking and debugging

### Performance & Scalability
- [x] **PERF-01**: Virtual scrolling integration using TanStack Virtual for large datasets
- [x] **PERF-02**: Intelligent query result caching with TTL and invalidation strategies
- [x] **PERF-03**: Memory management patterns preventing cross-bridge reference cycles
- [x] **PERF-04**: Background sync queue with retry logic and exponential backoff
- [x] **PERF-05**: Bandwidth-aware sync optimization based on connection quality

### Application Integration (Gap Closure)
- [ ] **APP-INT-01**: LiveDataProvider installed in main application provider tree
- [ ] **APP-INT-02**: Canvas component migrated from `data` prop to `sql` query API
- [ ] **APP-INT-03**: Main application components connected to live database infrastructure
- [ ] **APP-INT-04**: End-to-end live data flow verified in production application
- [ ] **APP-INT-05**: TypeScript compilation errors resolved and type safety maintained

---

## Future Requirements (Deferred to Later Milestones)

### Advanced Collaboration
- Live collaborative cursors and real-time multi-user editing
- Granular change tracking with field-level conflict resolution
- Multi-user workspace isolation for team environments

### Enterprise Features
- Advanced security audit trails for database operations
- Role-based access control integration with CloudKit
- Enterprise deployment and management tools

---

## Out of Scope (Explicit Exclusions)

### Complex ORM Layer
**Reason:** Research shows query translation complexity explosion - use direct SQL with parameter substitution only

### Real-Time Everything
**Reason:** Not all data needs real-time updates - selective real-time based on user interaction patterns prevents performance degradation

### Automatic Conflict Merging
**Reason:** Knowledge management requires user control over conflict resolution to preserve data integrity and user intent

### Advanced Query Builder UI
**Reason:** Direct SQL provides better performance and control - defer complex query building to future milestones

---

## Traceability

Requirements mapped to phases in ROADMAP.md:

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

**Coverage:** 25/25 requirements mapped (100%)

---

## Acceptance Criteria

Each requirement must pass verification with concrete observable behaviors:

### Infrastructure Requirements (Complete)
All BRIDGE, SYNC, TRANS, and PERF requirements have been verified through dedicated verification plans.

### Application Integration Requirements (Phase 27)

**APP-INT-01 Acceptance:**
- LiveDataProvider is imported and wraps the main application in MVPDemo.tsx or App.tsx
- useLiveQuery hooks execute without "must be used within LiveDataProvider" errors
- Provider initialization completes successfully on app startup

**APP-INT-02 Acceptance:**
- Canvas.tsx no longer uses `data={nodes}` prop pattern
- Canvas.tsx uses SQL query API: `<ListView sql="SELECT * FROM nodes" />`
- TypeScript compilation passes without prop type mismatch errors

**APP-INT-03 Acceptance:**
- Main application components render live data from database
- Real-time database changes appear in UI within 100ms
- Users can interact with live database features through main application

**APP-INT-04 Acceptance:**
- Database changes in native layer propagate to React UI automatically
- End-to-end flow: native change → bridge → React update → UI render
- Live data flow verified with integration test demonstrating change propagation

**APP-INT-05 Acceptance:**
- TypeScript compilation completes without errors
- All component prop types match updated API contracts
- Type safety maintained throughout integration changes

---

*Last updated: 2026-01-31 - Added application integration requirements for gap closure*