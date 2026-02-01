# Project Research Summary

**Project:** Isometry - Live Apple Notes Integration
**Domain:** Knowledge Management App Enhancement (Adding Real-Time Apple Notes Sync)
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

Isometry has proven Apple Notes integration foundation through AltoIndexImporter (6,891 notes imported successfully). Adding live sync requires careful security architecture around macOS TCC permissions, robust concurrent database access patterns, and sophisticated protobuf parsing resilience. The research reveals this is a technically mature domain with established patterns, but significant user trust and data safety considerations.

The recommended approach builds incrementally on existing batch import infrastructure, adding FSEvents monitoring, SwiftProtobuf parsing, and enhanced CloudKit conflict resolution. Critical success factors include transparent TCC permission education, read-only Notes access philosophy, and graceful degradation when permissions are denied. Primary risk is database corruption from concurrent access, mitigated through WAL-mode SQLite connections with proper timeout handling.

Key strategic decision: Position live sync as enhancement to existing batch workflow rather than replacement, maintaining backward compatibility and user choice between manual and automatic synchronization modes.

## Key Findings

### Recommended Stack

Building on proven GRDB.swift + CloudKit foundation, live sync adds minimal new dependencies while leveraging native Apple APIs for security compliance. The enhancement preserves existing AltoIndexImporter architecture while adding real-time capabilities.

**Core technologies:**
- **FSEvents API**: Real-time Notes database monitoring — native macOS API with zero dependencies, battle-tested for directory tree changes
- **SwiftProtobuf 2.0.0+**: Direct Notes protobuf parsing — official Apple library, handles complex nested structures safely
- **Foundation Compression**: Gzip decompression for Notes content — native implementation, no external dependencies
- **Enhanced GRDB Actor pattern**: Concurrent database access — proven with existing 6,891 notes, maintains thread safety
- **Extended CloudKitSyncManager**: Bidirectional conflict resolution — builds on existing sync patterns with Notes-specific strategies

### Expected Features

Research identifies clear user expectations around live sync, with emphasis on security transparency and graceful degradation.

**Must have (table stakes):**
- Real-Time Change Detection — users expect Siri → Notes captures to automatically appear in Isometry
- Read-Only Apple Notes Access — users expect safe access without corruption risk
- Graceful TCC Permission Handling — users need clear prompts and fallback options
- Sync Status Visibility — users need monitoring indicators and error states
- Incremental Updates Only — users expect only changed notes to trigger updates

**Should have (competitive):**
- Intelligent Note Categorization — auto-organize Notes into PAFV dimensional structure
- Cross-Note Reference Detection — automatically create graph connections between related Notes
- Selective Folder Monitoring — monitor only specific Notes folders to reduce noise
- Smart Conflict Resolution UI — visual diff interface for programmatic change conflicts

**Defer (v2+):**
- Rich Media Preservation — complex attachment handling conflicts with incremental updates
- Bidirectional Editing — extremely risky for data corruption, read-only approach safer
- Real-Time Collaborative Editing — Apple Notes collaboration is iCloud-only

### Architecture Approach

The architecture extends existing Swift Actor patterns with careful isolation of live sync concerns. FSEvents monitoring feeds into enhanced AltoIndexImporter through debounced change processing, maintaining existing CloudKit sync patterns while adding Notes-specific conflict resolution.

**Major components:**
1. **NotesIntegrationActor** — coordination layer for live sync with FSEvents monitoring and conflict resolution
2. **Enhanced AltoIndexImporter** — adds live protobuf parsing while preserving batch import functionality
3. **Extended CloudKitSyncManager** — adds Notes record types and Notes-specific conflict resolution strategies
4. **ChangeMonitor** — FSEvents wrapper with intelligent debouncing (500ms) and resource management
5. **ConflictResolver** — bidirectional sync conflict handling with user notification and manual resolution UI

### Critical Pitfalls

Research reveals six critical failure modes, with TCC permissions and database corruption representing highest impact risks.

1. **TCC Permission Escalation Without User Understanding** — Full Disk Access required but users don't understand scope; provide clear consent flow and alternative batch import mode
2. **Database Corruption from Concurrent Access** — SQLite contention between app and Notes.app; use read-only WAL mode with timeout/retry logic
3. **Protobuf Version Incompatibility Cascading Failures** — Apple schema changes break parsing loops; implement version detection and supervised actor recovery
4. **File System Event Flood Creating Resource Exhaustion** — hundreds of events per minute during editing; require intelligent debouncing and circuit breaker patterns
5. **Sync State Inconsistency from Failed Transaction Rollbacks** — partial failures across multiple systems; design idempotent operations with saga pattern
6. **Apple Notes App Integration Breaking Existing Workflows** — live sync disrupts proven batch import users; maintain hybrid approach with clear migration path

## Implications for Roadmap

Based on research, suggested phase structure prioritizes security and data safety while building incrementally on proven foundation:

### Phase 1: TCC Permission Strategy & User Consent Design
**Rationale:** Foundation for all live sync features; must establish user trust and security compliance before technical implementation
**Delivers:** Clear permission flow, graceful degradation, user education about Full Disk Access scope
**Addresses:** TCC Permission Escalation pitfall, Graceful TCC Permission Handling feature requirement
**Avoids:** User trust issues and security audit failures by establishing transparent consent patterns

### Phase 2: Database Concurrency & Locking Strategy
**Rationale:** Prevents data corruption risk; must be bulletproof before adding real-time monitoring
**Delivers:** Read-only SQLite access patterns, WAL mode handling, concurrent access protection
**Uses:** Enhanced GRDB Actor patterns with Notes-specific timeout and retry logic
**Implements:** Safe database access foundation for all live sync operations
**Avoids:** Database Corruption from Concurrent Access pitfall

### Phase 3: FSEvents Monitoring & Change Detection
**Rationale:** Core live sync capability; requires robust resource management to avoid performance issues
**Delivers:** Real-time change detection with intelligent debouncing and circuit breaker protection
**Uses:** FSEvents API with Foundation frameworks, ChangeMonitor actor architecture
**Implements:** NotesIntegrationActor coordination layer with resource management
**Avoids:** File System Event Flood pitfall through proper debouncing and rate limiting

### Phase 4: Protobuf Schema Resilience & Version Handling
**Rationale:** Enables direct Notes parsing; must handle Apple's undocumented schema changes gracefully
**Delivers:** SwiftProtobuf parsing with version detection and fallback strategies
**Uses:** SwiftProtobuf 2.0.0+ with Foundation Compression for gzip handling
**Implements:** Enhanced AltoIndexImporter with supervised protobuf parsing actors
**Avoids:** Protobuf Version Incompatibility pitfall through robust error handling and recovery

### Phase 5: Distributed Sync State Management & Consistency
**Rationale:** Ensures data consistency across Notes/Isometry/CloudKit; prevents sync state corruption
**Delivers:** Saga pattern for multi-step sync, event sourcing for state tracking, periodic reconciliation
**Uses:** Enhanced CloudKitSyncManager with Notes-specific conflict resolution
**Implements:** ConflictResolver with user notification and manual resolution UI
**Avoids:** Sync State Inconsistency pitfall through idempotent operations and transaction boundaries

### Phase 6: Import Method Integration & User Migration
**Rationale:** Preserves existing user workflows while adding live sync; maintains backward compatibility
**Delivers:** Hybrid import detection, conflict resolution for batch/live data, user migration path
**Uses:** Enhanced AltoIndexImporter with unified conflict detection across import methods
**Implements:** Smooth transition from batch-only to live sync without workflow disruption
**Avoids:** Apple Notes App Integration Breaking Existing Workflows pitfall

### Phase Ordering Rationale

- **Security-first progression:** TCC permissions and database safety must be established before adding complexity
- **Incremental risk introduction:** Each phase adds one major risk factor while building on proven foundation
- **User-centric validation:** Each phase delivers user-visible value while maintaining existing functionality
- **Architectural isolation:** Live sync concerns are contained in new components without modifying existing patterns

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** User experience design for TCC permission flows requires UX research and A/B testing
- **Phase 4:** Protobuf schema analysis across iOS versions needs reverse engineering research

Phases with standard patterns (skip research-phase):
- **Phase 2:** Database concurrency is well-documented GRDB pattern
- **Phase 3:** FSEvents monitoring follows established Apple documentation
- **Phase 5:** CloudKit conflict resolution extends existing proven patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Building on proven AltoIndexImporter (6,891 notes) with minimal new dependencies, native Apple APIs |
| Features | MEDIUM | User expectations clear from research but TCC permission adoption rates uncertain |
| Architecture | HIGH | Extends existing Swift Actor + GRDB + CloudKit patterns with minimal new complexity |
| Pitfalls | HIGH | Six critical pitfalls identified with clear prevention strategies and phase-specific addressing |

**Overall confidence:** HIGH

### Gaps to Address

Research was comprehensive but some areas need validation during implementation:

- **TCC permission adoption rates:** Real user acceptance of Full Disk Access for Notes sync needs A/B testing during Phase 1
- **Apple Notes protobuf schema stability:** Future iOS releases may change protobuf structure; requires ongoing monitoring and compatibility testing
- **Performance scaling:** Resource consumption patterns for large Notes libraries (>10k notes) need load testing during Phase 3

## Sources

### Primary (HIGH confidence)
- Apple Developer Documentation (FSEvents, TCC, CloudKit) — official APIs and patterns
- Existing Isometry AltoIndexImporter implementation — 6,891 notes successfully imported
- Apple Notes protobuf research: github.com/threeplanetssoftware/apple_cloud_notes_parser — reverse engineering analysis
- GRDB.swift CloudKit sync patterns — established concurrency and conflict resolution approaches

### Secondary (MEDIUM confidence)
- Apple Community developer reports — TCC permission challenges and user adoption patterns
- iOS 18 Notes format analysis — ciofecaforensics.com protobuf structure documentation

### Tertiary (LOW confidence)
- User experience patterns for permission flows — needs validation through user research

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*