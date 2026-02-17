# Phase 117 Research: Apple Notes SQLite Direct Sync

## Problem Statement

The current ETL pipeline uses `alto-index.json` as an intermediary format:
```
Apple Notes → alto-index tool → alto-index.json → Isometry ETL → sql.js
```

This introduces data integrity issues:
1. **Folder mapping bug**: Note "Under stress, Stacey channels mean Cindy" appears in `BairesDev/Operations` in alto-index.json but is actually in `Family/Stacey` in Apple Notes
2. **Stale data**: alto-index.json (85MB) is a point-in-time export that doesn't reflect current Apple Notes state
3. **Duplicate entries**: Same note ID (138083) appears twice with different titles/modification dates

**Goal**: Eliminate the intermediary by syncing directly from Apple Notes SQLite to Isometry sql.js.

## Key Discovery: isometry-etl Package

User provided `isometry-etl.tar.gz` containing a **complete Apple Notes ETL adapter** with direct SQLite access.

### Database Location (Verified)

```
~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite
```

Size: 638MB on this system (contains iCloud-synced notes)

### Verification Query

```sql
SELECT
    n.Z_PK as id,
    n.ZTITLE1 as title,
    f.ZTITLE2 as folder_name,
    pf.ZTITLE2 as parent_folder_name
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.ZTITLE1 LIKE '%Stacey channels%Cindy%'
```

**Result:**
```
138083|Under stress, Stacey channels mean Cindy|Stacey|Family
```

**Folder path: `Family/Stacey`** — exactly as user reported!

### Schema (ZICCLOUDSYNCINGOBJECT - Polymorphic)

Apple Notes uses a **polymorphic table** for notes, folders, and attachments:

| Column | Notes | Folders |
|--------|-------|---------|
| ZTITLE1 | Note title | NULL |
| ZTITLE2 | NULL | Folder name |
| ZFOLDER | FK to folder | NULL |
| ZPARENT | NULL | FK to parent folder |
| ZCREATIONDATE | Created (Core Data) | Created |
| ZMODIFICATIONDATE | Modified (Core Data) | Modified |
| ZMARKEDFORDELETION | Soft delete flag | Soft delete flag |

Content stored in `ZICNOTEDATA.ZDATA` as gzipped protobuf.

### Existing isometry-etl Implementation

**Location**: `isometry-etl/` (extracted from tar.gz)

**Files**:
- `src/adapters/apple-notes/adapter.ts` — Main adapter with full/incremental sync
- `src/adapters/apple-notes/schema.ts` — SQL queries and type definitions
- `src/adapters/apple-notes/content-extractor.ts` — Protobuf decompression and parsing
- `src/core/types.ts` — Canonical format (CanonicalNode, CanonicalEdge, LATCH types)

**Features**:
1. ✅ Direct SQLite read (better-sqlite3, read-only)
2. ✅ Correct folder hierarchy via ZFOLDER + ZPARENT joins
3. ✅ Full sync and incremental sync (via modification timestamps)
4. ✅ Content extraction from gzipped protobuf
5. ✅ Inline tag extraction from text (#hashtags)
6. ✅ NEST edges for folder relationships
7. ✅ Core Data timestamp conversion

## Revised Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NoteStore.sqlite                              │
│        ~/Library/Group Containers/group.com.apple.notes/         │
│                           ↓                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              AppleNotesAdapter                           │   │
│   │   (from isometry-etl/src/adapters/apple-notes/)         │   │
│   │   - fullSync(): SyncResult                               │   │
│   │   - incrementalSync(state): SyncResult                   │   │
│   │   - Content extraction via protobuf parser               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              CanonicalNode / CanonicalEdge               │   │
│   │   (LATCH-mapped intermediate format)                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              NodeWriter (NEW)                            │   │
│   │   - Maps CanonicalNode → Isometry nodes table            │   │
│   │   - Maps CanonicalEdge → Isometry edges table            │   │
│   │   - Handles upsert with source_id deduplication          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ↓                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    sql.js (Isometry)                     │   │
│   │   nodes, edges, nodes_fts                                │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 117-01: ETL Module Integration
1. Copy `isometry-etl/` contents to `src/etl/apple-notes/`
2. Add `better-sqlite3` dependency for Node.js SQLite access
3. Create `NodeWriter` to map CanonicalNode → Isometry nodes

### Phase 117-02: Sync Service
1. Create `AppleNotesSyncService` wrapper for React integration
2. Add sync state persistence to Isometry settings table
3. Implement progress callback for UI feedback

### Phase 117-03: UI Integration
1. Add "Sync from Apple Notes" button to toolbar
2. Show sync progress indicator
3. Add settings for auto-sync on startup

### Phase 117-04: Migration & Cleanup
1. Mark alto-index.json as deprecated
2. Remove alto-parser.ts and alto-importer.ts
3. Update documentation

## Comparison: alto-index vs isometry-etl

| Aspect | alto-index.json | isometry-etl |
|--------|-----------------|--------------|
| Data source | Third-party export | Direct SQLite |
| Folder accuracy | **BUGGY** | Correct |
| Data freshness | Point-in-time | Live |
| Incremental sync | Manual re-export | Built-in |
| Content format | HTML + YAML | Protobuf → Markdown |
| Tag extraction | From attachments | From text content |
| Dependencies | Node.js only | better-sqlite3 |

## Next Steps

1. Run `npm install` in `isometry-etl/` to verify it builds
2. Test `npm run apple-notes` to verify full sync works
3. Integrate into Isometry `src/etl/` directory
4. Wire up to UI

---
*Research completed: 2026-02-17*
*Key finding: isometry-etl package already implements direct Apple Notes SQLite access with correct folder hierarchy*
