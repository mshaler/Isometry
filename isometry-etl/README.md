# Isometry ETL Module

Direct data ingestion from platform sources to Isometry's canonical format.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Source Adapters                             │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Apple Notes  │  │ Apple        │  │ Obsidian     │   ...        │
│  │ Adapter      │  │ Reminders    │  │ Adapter      │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └────────────────┬┴─────────────────┘                       │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Canonical Format                              │   │
│  │  CanonicalNode { id, source, name, content, LATCH props }    │   │
│  │  CanonicalEdge { id, type, source→target, weight }           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Isometry SQLite                             │   │
│  │  nodes, edges, nodes_fts (via NodeWriter)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Test Apple Notes adapter
npm run apple-notes
```

## Apple Notes Adapter

### Why Direct SQLite Access?

We read directly from `NoteStore.sqlite` rather than using:
- **AppleScript/JXA**: Brittle, slow, caches stale folder paths
- **alto.index**: Third-party tool with sync bugs (see diagnostic below)
- **Shortcuts**: Good for export, but batch-only

Direct SQLite gives us:
- Correct folder hierarchy (validated via diagnostic query)
- Fast incremental sync via modification timestamps
- Full content access including embedded formatting

### Database Location

```
~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite
```

### Schema Highlights

The key insight is that Apple Notes uses a **polymorphic table** 
(`ZICCLOUDSYNCINGOBJECT`) for notes, folders, and attachments:

```sql
-- Notes have ZTITLE1, folders have ZTITLE2
-- ZFOLDER links notes to their containing folder
-- ZPARENT links folders to their parent folder

SELECT 
    n.Z_PK as note_id,
    n.ZTITLE1 as title,
    f.ZTITLE2 as folder_name,
    pf.ZTITLE2 as parent_folder_name
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.ZTITLE1 IS NOT NULL;
```

### Content Extraction

Note content is stored as gzipped protobuf in `ZICNOTEDATA.ZDATA`.
The `content-extractor.ts` module:

1. Decompresses the gzip data
2. Parses the protobuf structure (custom schema, not documented)
3. Extracts plain text and converts to Markdown
4. Finds inline tags, URLs, and @mentions

### Usage

```typescript
import { createAppleNotesAdapter } from '@isometry/etl';

const adapter = createAppleNotesAdapter();

// Check if database is accessible
if (await adapter.isAvailable()) {
  // Full sync (first run)
  const result = await adapter.fullSync();
  
  console.log(`Synced ${result.nodes.length} notes`);
  console.log(`Created ${result.edges.length} folder edges`);
  
  // Incremental sync (subsequent runs)
  const updates = await adapter.incrementalSync(result.syncState);
}
```

### Output Format

Each note becomes a `CanonicalNode`:

```typescript
{
  id: "apple-notes:138083",
  source: "apple-notes",
  sourceId: "138083",
  nodeType: "note",
  name: "Under stress, Stacey channels mean Cindy",
  content: "# Note title\n\nNote content in Markdown...",
  time: {
    created: Date,
    modified: Date,
  },
  category: {
    hierarchy: ["Family", "Stacey"],  // Correct folder path!
    tags: ["stacey"],
  },
  hierarchy: {
    priority: 0,
    importance: 0,
    sortOrder: 0,
  }
}
```

Folder relationships become `CanonicalEdge` with type `NEST`:

```typescript
{
  id: "nest:apple-notes:folder:Family:apple-notes:folder:Family/Stacey",
  edgeType: "NEST",
  sourceId: "apple-notes:folder:Family",
  targetId: "apple-notes:folder:Family/Stacey",
  weight: 1.0,
  directed: true,
}
```

## LATCH Property Mapping

| LATCH Axis | Apple Notes Source |
|------------|-------------------|
| **L**ocation | Not used (notes don't have location) |
| **A**lphabet | ZTITLE1 (note title) |
| **T**ime | ZCREATIONDATE, ZMODIFICATIONDATE |
| **C**ategory | Folder hierarchy, inline #tags |
| **H**ierarchy | Manual sort order (not yet extracted) |

## Diagnostic Script

If you suspect folder mapping issues, run the diagnostic:

```bash
./diagnose-notes-folder.sh
```

This queries NoteStore.sqlite directly to verify folder relationships.

## Roadmap

### Phase 1: Apple Ecosystem (Current)
- [x] Apple Notes
- [ ] Apple Reminders
- [ ] Apple Calendar
- [ ] Apple Contacts

### Phase 2: Cross-Platform Notes
- [ ] Obsidian (local vault)
- [ ] Notion (API)
- [ ] Bear (SQLite)

### Phase 3: Productivity Tools
- [ ] Todoist (API)
- [ ] Linear (API)
- [ ] GitHub Issues (API)

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT
