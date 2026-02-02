# Requirements: Isometry v3.2 Enhanced Apple Integration

**Defined:** 2026-02-01
**Core Value:** Transform Apple Notes into a powerful capture interface that feeds Isometry's organizational capabilities, enabling seamless Notes → Isometry workflow with live synchronization and intelligent conflict handling.

## v3.2 Requirements

Requirements for Enhanced Apple Integration milestone. Each maps to Phase 29.

### Real-Time Integration

- [ ] **NOTES-LIVE-01**: System detects Apple Notes changes in real-time via FSEvents monitoring with <1s latency
- [ ] **NOTES-LIVE-02**: System imports new Notes automatically as Isometry cards with full PAFV+LATCH+GRAPH capabilities
- [ ] **NOTES-LIVE-03**: System handles incremental updates to existing Notes without full re-import
- [ ] **NOTES-LIVE-04**: System scales to monitor 10k+ Notes libraries with efficient background processing
- [ ] **NOTES-LIVE-05**: System provides real-time sync status visibility and error reporting to user

### Permission & Security

- [ ] **TCC-01**: System requests TCC Full Disk Access permissions with clear user education
- [ ] **TCC-02**: System provides graceful degradation when TCC permissions are denied
- [ ] **TCC-03**: System offers fallback to manual batch import via AltoIndexImporter
- [ ] **TCC-04**: System communicates permission scope and data safety clearly to user

### Conflict Resolution

- [ ] **CRDT-01**: System implements CRDT conflict resolution maintaining data integrity during multi-device editing
- [ ] **CRDT-02**: System provides user interface for manual conflict resolution when automatic resolution fails
- [ ] **CRDT-03**: System preserves user changes in Isometry when Notes app rejects or mangles programmatic updates
- [ ] **CRDT-04**: System maintains bidirectional sync ensuring changes don't get lost between applications

### Performance & Reliability

- [ ] **PERF-NOTES-01**: System processes Notes content parsing in <100ms per note via background processing
- [ ] **PERF-NOTES-02**: System handles large Notes libraries (6,891+ notes) without performance degradation
- [ ] **PERF-NOTES-03**: System integrates with existing GRDB database infrastructure seamlessly
- [ ] **PERF-NOTES-04**: System maintains circuit breaker patterns for reliability under load

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Advanced Features

- **NOTES-ADV-01**: Rich media attachment preservation and Content-Addressable Storage
- **NOTES-ADV-02**: Cross-Note reference detection with automatic graph connection creation
- **NOTES-ADV-03**: Intelligent Note categorization into PAFV dimensional structure
- **NOTES-ADV-04**: Selective folder monitoring with user-configurable sync rules

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Bidirectional rich editing | Notes.app resistance to external modifications makes this unreliable |
| Real-time collaborative editing | Apple Notes collaboration is iCloud-only, conflicts with local processing |
| Complete Notes app replacement | Goal is integration, not replacement of proven capture interface |
| Complex attachment handling | Defer to v3.3 with Content-Addressable Storage architecture |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTES-LIVE-01 | Phase 29 | Pending |
| NOTES-LIVE-02 | Phase 29 | Pending |
| NOTES-LIVE-03 | Phase 29 | Pending |
| NOTES-LIVE-04 | Phase 29 | Pending |
| NOTES-LIVE-05 | Phase 29 | Pending |
| TCC-01 | Phase 29 | Pending |
| TCC-02 | Phase 29 | Pending |
| TCC-03 | Phase 29 | Pending |
| TCC-04 | Phase 29 | Pending |
| CRDT-01 | Phase 29 | Pending |
| CRDT-02 | Phase 29 | Pending |
| CRDT-03 | Phase 29 | Pending |
| CRDT-04 | Phase 29 | Pending |
| PERF-NOTES-01 | Phase 29 | Pending |
| PERF-NOTES-02 | Phase 29 | Pending |
| PERF-NOTES-03 | Phase 29 | Pending |
| PERF-NOTES-04 | Phase 29 | Pending |

**Coverage:**
- v3.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after v3.2 milestone definition*