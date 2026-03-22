# Requirements: Isometry v8.5 ETL E2E Test Suite

**Defined:** 2026-03-22
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v8.5 Requirements

Requirements for ETL E2E test coverage. Each maps to roadmap phases.

### ETL Test Infrastructure

- [ ] **INFR-01**: E2E helper utilities (importNativeCards, assertCatalogRow, resetDatabase) in e2e/helpers/etl.ts
- [ ] **INFR-02**: WASM/jsdom boundary enforcement rule documented and enforced (no mixing in same test file)
- [ ] **INFR-03**: Bridge query API for test introspection (queryAll/exec accessible from window.__isometry)
- [ ] **INFR-04**: __mockPermission debug hook in HarnessShell for TCC grant/deny/revoke simulation
- [ ] **INFR-05**: better-sqlite3 + tmp devDependencies installed for fixture generation

### Alto-Index E2E Coverage

- [ ] **ALTO-01**: CI-safe JSON fixtures for all 11 subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos)
- [ ] **ALTO-02**: Parse-to-sql.js correctness assertions for each subdirectory type (field mapping, card_type, tags)
- [ ] **ALTO-03**: YAML frontmatter field completeness verification across all fixture types
- [ ] **ALTO-04**: File-path source dedup verification (re-import same fixtures yields zero new cards)
- [ ] **ALTO-05**: 501+ card bulk import with FTS5 searchability assertion

### Native Apple Adapter E2E Coverage

- [ ] **NATV-01**: Notes adapter shape validation via CanonicalCard[] fixture injection through bridge
- [ ] **NATV-02**: Reminders adapter shape validation via CanonicalCard[] fixture injection through bridge
- [ ] **NATV-03**: Calendar adapter shape validation via CanonicalCard[] fixture injection through bridge
- [ ] **NATV-04**: Auto-connection synthesis assertions (attendee person cards, note-to-note links)
- [ ] **NATV-05**: CatalogWriter provenance tracking (import_sources, import_runs, datasets tables verified)
- [ ] **NATV-06**: NoteStore multi-schema fixtures (macOS 13 vs 14+ ZTITLE1/ZTITLE2 branching)
- [ ] **NATV-07**: Protobuf three-tier fallback coverage (ZDATA body, ZSNIPPET fallback, null content)

### File-Based Format E2E Coverage

- [ ] **FILE-01**: JSON parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-02**: XLSX parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-03**: CSV parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-04**: Markdown parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-05**: HTML parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-06**: Apple Notes JSON parser E2E through ImportOrchestrator to sql.js with field completeness
- [ ] **FILE-07**: Malformed input error recovery for each parser (graceful failure, no crash, error reported)
- [ ] **FILE-08**: Export round-trip (import → export → re-import) for Markdown, JSON, CSV formats
- [ ] **FILE-09**: Cross-format dedup collision detection (same card imported from two different formats)

### TCC Permission Lifecycle

- [ ] **TCC-01**: Grant path E2E (permission granted → adapter reads → bridge dispatch → sql.js write)
- [ ] **TCC-02**: Denied permission error handling path (denied → graceful error → user notification)
- [ ] **TCC-03**: Revoke mid-import recovery (permission revoked during active import → partial result handled)
- [ ] **TCC-04**: Permission state change notification handling (state transitions reflected in UI)

## Future Requirements

### Extended ETL Coverage

- **EXTD-01**: NoteStore schema versions beyond macOS 13/14+ (macOS 15+ if schema diverges)
- **EXTD-02**: Live device integration tests for native adapters (requires macOS CI runner)
- **EXTD-03**: Performance regression benchmarks for ETL pipeline at 50K+ card scale

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real TCC dialog automation | macOS system dialogs cannot be automated in CI — mock injection used instead |
| Live NoteStore.sqlite in CI | TCC-protected; synthetic fixtures used |
| Swift adapter unit tests | Covered separately in parallel Swift test gap closure work |
| Production code changes | This is a test-only milestone — no new features |
| Streaming XLSX reads | Architecturally impossible (ZIP central directory at EOF) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 109 | Pending |
| INFR-02 | Phase 109 | Pending |
| INFR-03 | Phase 109 | Pending |
| INFR-04 | Phase 109 | Pending |
| INFR-05 | Phase 109 | Pending |
| ALTO-01 | Phase 110 | Pending |
| ALTO-02 | Phase 110 | Pending |
| ALTO-03 | Phase 110 | Pending |
| ALTO-04 | Phase 110 | Pending |
| ALTO-05 | Phase 110 | Pending |
| NATV-01 | Phase 111 | Pending |
| NATV-02 | Phase 111 | Pending |
| NATV-03 | Phase 111 | Pending |
| NATV-04 | Phase 111 | Pending |
| NATV-05 | Phase 111 | Pending |
| NATV-06 | Phase 111 | Pending |
| NATV-07 | Phase 111 | Pending |
| FILE-01 | Phase 112 | Pending |
| FILE-02 | Phase 112 | Pending |
| FILE-03 | Phase 112 | Pending |
| FILE-04 | Phase 112 | Pending |
| FILE-05 | Phase 112 | Pending |
| FILE-06 | Phase 112 | Pending |
| FILE-07 | Phase 112 | Pending |
| FILE-08 | Phase 112 | Pending |
| FILE-09 | Phase 112 | Pending |
| TCC-01 | Phase 113 | Pending |
| TCC-02 | Phase 113 | Pending |
| TCC-03 | Phase 113 | Pending |
| TCC-04 | Phase 113 | Pending |

**Coverage:**
- v8.5 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — Traceability mapped after roadmap creation*
