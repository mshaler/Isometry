# Phase 117 Requirements: Apple Notes SQLite Direct Sync

## Overview

**Goal**: Integrate the existing `isometry-etl` package to replace alto-index.json with direct Apple Notes SQLite sync.

**Key Discovery**: The `isometry-etl.tar.gz` package already contains a complete Apple Notes adapter with:
- Direct SQLite access to `NoteStore.sqlite`
- Correct folder hierarchy extraction
- Protobuf content decompression
- Incremental sync support

This phase focuses on **integration**, not implementation from scratch.

## Verified: Folder Hierarchy is Correct

```sql
-- Query executed on NoteStore.sqlite
SELECT n.ZTITLE1, f.ZTITLE2, pf.ZTITLE2
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.ZTITLE1 LIKE '%Stacey channels%Cindy%'

-- Result:
-- Under stress, Stacey channels mean Cindy | Stacey | Family
-- → Folder path: Family/Stacey ✓
```

## Functional Requirements

### INT-01: ETL Module Integration
**Priority**: P0
**Description**: Integrate isometry-etl into Isometry codebase.

**Acceptance Criteria**:
1. `isometry-etl/` contents copied to `src/etl/apple-notes-direct/`
2. `better-sqlite3` added to dependencies
3. TypeScript compiles without errors
4. Existing Isometry types aligned with CanonicalNode/CanonicalEdge

### INT-02: NodeWriter Service
**Priority**: P0
**Description**: Map CanonicalNode/CanonicalEdge to Isometry sql.js schema.

**Acceptance Criteria**:
1. `NodeWriter.upsertNodes(nodes: CanonicalNode[])` inserts/updates Isometry nodes
2. `NodeWriter.upsertEdges(edges: CanonicalEdge[])` inserts/updates Isometry edges
3. Deduplication via `source` + `source_id` composite key
4. FTS5 index updated on node changes
5. Returns counts: inserted, updated, unchanged

### INT-03: Sync Orchestration
**Priority**: P0
**Description**: Coordinate full and incremental sync operations.

**Acceptance Criteria**:
1. `AppleNotesSyncService.fullSync()` performs complete re-import
2. `AppleNotesSyncService.incrementalSync()` imports only changes
3. Sync state persisted in Isometry settings table
4. Progress callback for UI feedback
5. Error handling with rollback on failure

### INT-04: UI Sync Trigger
**Priority**: P1
**Description**: Add sync controls to Isometry UI.

**Acceptance Criteria**:
1. "Sync Apple Notes" button in toolbar or menu
2. Sync progress indicator (spinner or progress bar)
3. Toast notification on sync complete
4. Settings toggle for auto-sync on startup

### INT-05: Migration from alto-index
**Priority**: P2
**Description**: Deprecate alto-index.json pipeline.

**Acceptance Criteria**:
1. New installs don't load alto-index.json
2. Migration prompt for existing users with alto-index data
3. alto-parser.ts and alto-importer.ts marked deprecated
4. Documentation updated

## Non-Functional Requirements

### PERF-01: Sync Performance
**Priority**: P0
**Description**: Sync completes in reasonable time.

**Acceptance Criteria**:
1. Full sync of 2000 notes < 60 seconds
2. Incremental sync of 100 notes < 5 seconds
3. UI remains responsive during sync

### DATA-01: Data Integrity
**Priority**: P0
**Description**: Synced data matches Apple Notes exactly.

**Acceptance Criteria**:
1. Note "Under stress, Stacey channels mean Cindy" has folder `Family/Stacey`
2. All folder hierarchies match Apple Notes UI
3. Tags match inline #hashtags in note content
4. Timestamps match (±1 second tolerance for Core Data conversion)

### SEC-01: Database Safety
**Priority**: P0
**Description**: No corruption risk to Apple Notes database.

**Acceptance Criteria**:
1. NoteStore.sqlite opened in **read-only** mode
2. No write operations to Apple Notes database
3. Connection closed properly on errors

## Technical Mapping

### CanonicalNode → Isometry nodes

| CanonicalNode | Isometry nodes | Notes |
|---------------|----------------|-------|
| `id` | `source_id` | "apple-notes:138083" |
| `source` | `source` | "apple-notes" |
| `name` | `name` | Note title |
| `content` | `content` | Markdown content |
| `time.created` | `created_at` | ISO 8601 |
| `time.modified` | `modified_at` | ISO 8601 |
| `category.hierarchy` | `folder` | "Family/Stacey" (joined) |
| `category.tags` | `tags` | JSON array |
| `nodeType` | `node_type` | "note" |

### CanonicalEdge → Isometry edges

| CanonicalEdge | Isometry edges | Notes |
|---------------|----------------|-------|
| `id` | `id` | Generated |
| `edgeType` | `edge_type` | "NEST" for folders |
| `sourceId` | `source_id` | Folder node ID |
| `targetId` | `target_id` | Note node ID |
| `weight` | `weight` | 1.0 for containment |

## Files to Create/Modify

### New Files
- `src/etl/apple-notes-direct/` — Copy of isometry-etl adapters
- `src/etl/apple-notes-direct/NodeWriter.ts` — sql.js writer
- `src/services/AppleNotesSyncService.ts` — Sync orchestration
- `src/hooks/useAppleNotesSync.ts` — React hook for sync

### Modified Files
- `package.json` — Add better-sqlite3
- `src/components/toolbar/` — Add sync button
- `src/db/settings.ts` — Add sync state keys
- `CLAUDE.md` — Update ETL documentation

## Plan Structure

| Plan | Focus | Deliverables |
|------|-------|--------------|
| 117-01 | ETL Integration | Copy isometry-etl, add dependencies, align types |
| 117-02 | NodeWriter | CanonicalNode → sql.js mapping with deduplication |
| 117-03 | Sync Service | Full/incremental sync with progress |
| 117-04 | UI + Migration | Sync button, auto-sync setting, deprecate alto-index |

## Success Criteria (Primary)

1. ✅ "Under stress, Stacey channels mean Cindy" appears in `Family/Stacey`
2. ✅ Full sync completes without errors
3. ✅ Incremental sync only processes changed notes
4. ✅ All notes visible in SuperGrid after sync

---
*Requirements updated: 2026-02-17*
*Approach: Integrate existing isometry-etl package*
