# Requirements: Isometry v9.2 Alto Index Import

**Defined:** 2026-03-25
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v9.2 Requirements

Requirements for importing alto-index datasets from local filesystem directories, with per-directory dataset partitioning, full lifecycle management, and binary attachment exclusion.

### Directory Discovery

- [x] **DISC-01**: User can pick an alto-index root directory via native file picker (macOS NSOpenPanel / iOS fileImporter)
- [x] **DISC-02**: System auto-discovers known subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) within the selected root
- [x] **DISC-03**: User sees a list of discovered subdirectories with type labels before importing

### Selective Import

- [x] **IMPT-01**: User can select which subdirectories to import (checkbox per directory)
- [x] **IMPT-02**: Each imported subdirectory creates a distinct dataset partition in the catalog (import_sources row with directory path as source identifier)
- [x] **IMPT-03**: Cards from each directory are tagged with their source directory for partition-level operations
- [x] **IMPT-04**: Import progress reports per-directory status during multi-directory imports

### Dataset Management

- [x] **DSET-01**: Data Explorer catalog displays each imported directory as a distinct dataset row
- [x] **DSET-02**: User can delete all cards belonging to a single directory dataset without affecting other datasets
- [x] **DSET-03**: User can re-import a directory to refresh its cards (DedupEngine handles updates via source+source_id)
- [x] **DSET-04**: Before committing a re-import, user sees a diff preview showing new, modified, and deleted cards

### Binary Exclusion

- [x] **BEXL-01**: Attachment metadata (path, filename, size, MIME type) is stored in card content/metadata fields
- [x] **BEXL-02**: No binary attachment content is read from disk or stored in the sql.js database

## Future Requirements

### Alto Index Enhancements

- **ALTO-01**: Remember last-used alto-index root path for quick re-access
- **ALTO-02**: Show estimated card count per subdirectory before importing
- **ALTO-03**: Scheduled background re-import for watched directories

### Graph Algorithms Phase 3

- **GALG-05**: Community boundary edges highlighted with dashed stroke
- **GALG-06**: Algorithm result export to CSV/JSON via ExportOrchestrator
- **GALG-07**: Algorithm comparison mode (side-by-side PageRank vs centrality)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Binary attachment CAS storage | OOM risk — metadata only, explicitly excluded by design |
| Streaming reads for large directories | AltoIndexAdapter already handles 11 types with YAML frontmatter; batch import sufficient |
| Cross-directory dedup | Each directory is its own partition; cross-source fuzzy entity resolution deferred |
| Real-time filesystem watching | Manual re-import covers use case; FSEvents integration is future |
| App Store submission | Carried from v9.1 — TestFlight validation only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-01 | Phase 123 | Complete |
| DISC-02 | Phase 123 | Complete |
| DISC-03 | Phase 123 | Complete |
| IMPT-01 | Phase 124 | Complete |
| IMPT-02 | Phase 124 | Complete |
| IMPT-03 | Phase 124 | Complete |
| IMPT-04 | Phase 124 | Complete |
| BEXL-01 | Phase 124 | Complete |
| BEXL-02 | Phase 124 | Complete |
| DSET-01 | Phase 125 | Complete |
| DSET-02 | Phase 125 | Complete |
| DSET-03 | Phase 126 | Complete |
| DSET-04 | Phase 126 | Complete |

**Coverage:**
- v9.2 requirements: 13 total
- Satisfied: 11
- Pending (gap closure): 2 (DSET-03, DSET-04 → Phase 126)
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 — Phase assignments added (Phases 123-125)*
