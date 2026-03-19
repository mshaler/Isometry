# Requirements: Isometry v7.2 Alto Index + DnD Migration

**Defined:** 2026-03-19
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v7.2 Requirements

Requirements for Alto Index import infrastructure and WKWebView DnD migration.

### Alto Index Infrastructure (Phase 95 — SHIPPED)

- [x] **ALTO-01**: AltoIndexAdapter reads all 11 alto-index subdirectories (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) with correct card_type mapping per subdirectory
- [x] **ALTO-02**: YAML frontmatter parser in Swift extracts title, dates, folder, tags, priority, URL, status from each data type's field names
- [x] **ALTO-03**: Source dedup via file-path-based source_id prevents duplicates on re-import (recurring calendar events with shared event_id are uniquely identified)
- [x] **ALTO-04**: Data purge runs synchronously in Worker handler before alto_index import — eliminates async timing issues with WKWebView evaluateJavaScript
- [x] **ALTO-05**: datasets table created via CREATE TABLE IF NOT EXISTS migration on hydrated database open — fixes "no such table" error for pre-existing checkpoints
- [x] **ALTO-06**: File → Import from... (⇧⌘I) menu item in macOS menu bar provides access to ImportSourcePickerView without requiring native toolbar visibility

### ETL Test Harness (Phase 95 — SHIPPED)

- [x] **TEST-01**: etl-load-run.test.ts serially imports alto-100 + 9 fixture sources into single sql.js DB with 15 correctness assertions (LOAD, GRID, CALC, DEDUP, FTS, CATALOG)
- [x] **TEST-02**: etl-alto-index-full.test.ts imports all 20,826 live alto-index files (conditionally skipped when symlink absent) with SuperGrid GROUP BY coverage verification at 15K+ card scale
- [x] **TEST-03**: SuperGrid GROUP BY decomposition proves sum of CellDatum.count equals total card count for every axis configuration tested
- [x] **TEST-04**: Aggregate footer (supergrid:calc) COUNT and SUM computations match direct SQL baseline — validates D-011 __agg__ prefix convention

### Projection Explorer (Phase 95 — SHIPPED)

- [x] **PROJ-01**: X-plane maps to rowAxes and Y-plane maps to colAxes in Projection Explorer — rendering, drop handling, reorder, and isFieldInWell all use swapped mapping
- [x] **PROJ-02**: Pointer-based DnD (pointerdown/pointermove/pointerup) replaces HTML5 DnD for chip drag between wells — works in Chrome, Safari, AND WKWebView
- [x] **PROJ-03**: Ghost element follows cursor during drag with hit-test well highlighting via getBoundingClientRect
- [x] **PROJ-04**: Available well filtered to axis-eligible fields only (isValidAxisField check) — prevents SQL safety violation from dragging non-GROUP-BY-able fields
- [x] **PROJ-05**: IsometryWebView subclass overrides NSDraggingDestination methods (draggingEntered, draggingUpdated, performDragOperation) to reject native drag ops as defense-in-depth

### DnD Migration (Phase 96 — TO BUILD)

- [x] **DND-01**: SuperGrid axis grip drag-reorder uses pointer events instead of HTML5 DnD — row and column header grips work in WKWebView
- [x] **DND-02**: SuperGrid cross-dimension axis transpose (row↔col) uses pointer events — drag from row header to column drop zone and vice versa works in WKWebView
- [x] **DND-03**: KanbanView card drag between columns uses pointer events — cards can be moved between kanban columns in WKWebView
- [x] **DND-04**: DataExplorerPanel file drop zone uses pointer events or alternative (paste, click-to-browse fallback) — file import drag-and-drop works in WKWebView or has adequate alternative UX
- [x] **DND-05**: All pointer DnD implementations include ghost element, well/zone highlighting, and cursor feedback consistent with ProjectionExplorer pattern

## Future Requirements

### Tags as GROUP BY Axis

- **TAGS-01**: Tags JSON array field unpacked for SuperGrid GROUP BY — each tag value becomes a separate axis value
- **TAGS-02**: Cards with multiple tags appear in multiple cells (one per tag)

### Folder Hierarchy

- **FOLD-01**: Folder paths (e.g., "BairesDev/Operations") decomposable into 2-tier SuperGrid stacking (parent folder + subfolder)

### UI Polish

- **UIPOL-01**: Column resize preserves card title text (currently disappears on resize)
- **UIPOL-02**: Menu bar visual consistency restored after WebBundle rebuild
- **UIPOL-03**: SwiftUI AttributeGraph cycle warnings resolved

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native file drag-to-window drop | unregisterDraggedTypes() + IsometryWebView overrides disable native drag — File menu import is the supported path |
| Within-well chip reorder | Pointer DnD supports between-well moves; within-well reorder deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ALTO-01 | Phase 95 | Complete |
| ALTO-02 | Phase 95 | Complete |
| ALTO-03 | Phase 95 | Complete |
| ALTO-04 | Phase 95 | Complete |
| ALTO-05 | Phase 95 | Complete |
| ALTO-06 | Phase 95 | Complete |
| TEST-01 | Phase 95 | Complete |
| TEST-02 | Phase 95 | Complete |
| TEST-03 | Phase 95 | Complete |
| TEST-04 | Phase 95 | Complete |
| PROJ-01 | Phase 95 | Complete |
| PROJ-02 | Phase 95 | Complete |
| PROJ-03 | Phase 95 | Complete |
| PROJ-04 | Phase 95 | Complete |
| PROJ-05 | Phase 95 | Complete |
| DND-01 | Phase 96 | Complete |
| DND-02 | Phase 96 | Complete |
| DND-03 | Phase 96 | Complete |
| DND-04 | Phase 96 | Complete |
| DND-05 | Phase 96 | Complete |

**Coverage:**
- v7.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after milestone v7.2 initialization*
