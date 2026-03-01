# Phase 8: ETL Foundation + Apple Notes Parser - Research

**Researched:** 2026-03-01
**Domain:** ETL pipeline, YAML frontmatter parsing, file system management, image thumbnail generation, bulk SQL operations in WASM
**Confidence:** HIGH

## Summary

Phase 8 establishes the complete ETL import pipeline: canonical types, deduplication engine, batch SQL writer, catalog tracking, and Apple Notes parser. The architecture is fully specified in `v5/Modules/DataExplorer.md` with working code examples. Critical pitfalls (P22-P25) are documented with mitigations in `.planning/research/PITFALLS.md`.

The Apple Notes source uses **alto-index Markdown exports** (not JSON as shown in DataExplorer.md). Each note is a `.md` file with YAML frontmatter containing metadata (`id`, `created`, `modified`, `attachments[]`, `links[]`, `source`) and Markdown content body. The parser must handle folder recursion, hashtag extraction from special attachment types, external URL resource cards, and file attachment copying to managed storage.

All ETL operations run inside the Web Worker using the existing `WorkerBridge` typed RPC system. No dependencies on native Swift code for Phase 8 (attachment file copying uses browser APIs; Swift integration deferred to Phase 9+).

**Primary recommendation:** Follow the DataExplorer.md canonical pipeline architecture exactly, but replace the JSON-based `AppleNotesParser` with a Markdown+frontmatter parser. Use gray-matter for YAML parsing (browser-compatible via bundler), OffscreenCanvas for thumbnail generation in Worker, and File System Access API (OPFS) for managed attachment storage.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Apple Notes Export Format:**
- Alto-index exports as **Markdown files with YAML frontmatter**, not JSON
- Parser reads all `.md` files from a folder (recursive traversal)
- Frontmatter fields: `title`, `id`, `created`, `modified`, `folder`, `attachments[]`, `links[]`, `source`
- Use alto-index numeric `id` as `source_id` — enables idempotent re-import matching
- Store `notes://showNote?identifier=...` URL in `source_url` column for linking back to Apple Notes
- For card `name`: use frontmatter `title` if present, fall back to first heading or first line of content

**Folder Mapping:**
- Preserve full folder path from alto-index (e.g., `Learning/ClaudeAI`) as card's `folder` value

**Hashtag Extraction:**
- Parse `com.apple.notes.inlinetextattachment.hashtag` attachments and extract tag names (e.g., `#ClaudeAI` → `ClaudeAI`)
- Add extracted tags to the card's `tags` array column
- Do not duplicate hashtag text in content body

**Graph Extraction — @Mentions:**
- Parse `@mentions` from note content via regex
- Match patterns: try `@FirstName LastName` (two words) first, fall back to `@SingleWord`
- Deduplicate person cards by name — single person card per unique name, all notes connect to it
- Connection label: `mentions`

**Graph Extraction — Internal Note Links:**
- Resolve `com.apple.notes.inlinetextattachment.link` attachments that link to other notes
- Create `links_to` connections between note cards when alto-index ID can be resolved

**Graph Extraction — External URLs:**
- Parse `links[]` array from frontmatter (contains URLs like mailto:, https://)
- Create `resource` cards for each URL
- Connection from note to resource: `links_to`

**Attachment Handling:**
- Copy binary files (images, videos, PDFs, etc.) to Isometry's managed `attachments/` directory in app support folder
- Create `resource` cards with full metadata: file path, mime_type, original filename, size, attachment UUID from alto-index
- Connection from note to attachment: `contains`
- Import all files regardless of type or size — no filtering

**Table Conversion:**
- Parse `com.apple.notes.table` attachments (stored as HTML)
- Convert to Markdown table syntax for storage in card content

**Thumbnail Generation:**
- Generate thumbnails for images (jpeg, png, webp) during import
- Use Browser Canvas API in Worker thread — no native dependencies
- Thumbnail size: 400px max dimension (preserve aspect ratio)
- Store thumbnail alongside original in managed storage

**Import Result Structure:**
- Return both summary counts AND optional detailed per-card log for debugging
- Counts: `inserted`, `updated`, `unchanged`, `skipped`, `errors`, `connections_created`
- Distinguish between `updated` (content changed) and `unchanged` (skipped because identical)
- Include `insertedIds: string[]` array so UI can navigate to imported content
- Continue on error — skip problematic files, log the error, continue importing others

**Import Runs Table (Provenance):**
- Store full run metadata: source type, source path, timestamp, counts (inserted/updated/skipped/errors), errors_json array
- Import runs are queryable via Worker Bridge for auditing

### Claude's Discretion

- Exact regex patterns for @mention detection
- File organization structure within `attachments/` folder (by date, by source, flat, etc.)
- Thumbnail file naming convention
- Error message formatting in errors_json

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETL-01 | Canonical Type Contract | CanonicalCard/CanonicalConnection interfaces defined; maps 1:1 to existing `cards` and `connections` schema |
| ETL-02 | Data Catalog Schema | `import_sources` and `import_runs` tables for provenance tracking |
| ETL-03 | Worker Protocol Extensions | Add `etl:import` and `etl:export` to WorkerRequestType union; extend timeout to 300s for large imports |
| ETL-04 | Apple Notes Parser | Markdown+YAML frontmatter parser using gray-matter; handles notes, checklists, attachments, mentions, links, tables |
| ETL-10 | Dedup Engine | Load existing source_id+modified_at in single query; classify insert/update/skip; build sourceIdMap for connection resolution |
| ETL-11 | SQLite Writer | 100-card transaction batches with `db.prepare()` parameterized statements; FTS trigger disable/rebuild for bulk imports |
| ETL-12 | Import Orchestrator | Parser → dedup → writer → catalog pipeline with progress notifications every 100 cards |
| ETL-13 | Catalog Writer | Upsert `import_sources`, write `import_runs` row with counts and errors JSON |
| ETL-18 | Worker Handler Integration | `etl-import.handler.ts` with exhaustive switch case in `worker.ts` router |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | ^4.0.3 | YAML frontmatter parsing | De facto standard for frontmatter extraction (179 commits, used by static site generators); accepts custom engines; TypeScript definitions included |
| OffscreenCanvas | Native API | Image thumbnail generation in Worker | Native Web API (baseline widely available since March 2023); enables off-thread rendering without blocking main thread; no dependencies |
| File System Access API (OPFS) | Native API | Managed attachment storage | Native Web API for origin-private file system; persists to disk, private to app origin; Chromium support on all platforms |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-html-parser | ^6.1.13 | HTML table parsing for Apple Notes tables | Lightweight (<10KB), browser-compatible alternative to jsdom for parsing `com.apple.notes.table` attachments |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | js-yaml directly | gray-matter provides frontmatter extraction (delimiter parsing) + YAML parsing in one package; js-yaml alone requires manual delimiter handling |
| OffscreenCanvas | Sharp (Node.js) | Sharp requires native bindings; not available in browser/Worker context; OffscreenCanvas is native and zero-dependency |
| OPFS | IndexedDB for file storage | OPFS is optimized for file-like access patterns; IndexedDB stores blobs but has size quotas and slower read performance for large files |

**Installation:**
```bash
npm install gray-matter node-html-parser
# OffscreenCanvas and OPFS are native browser APIs — no install needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── etl/
│   ├── types.ts                    # CanonicalCard, CanonicalConnection, ImportResult, ParseError
│   ├── DedupEngine.ts              # Classify insert/update/skip; build sourceIdMap
│   ├── SQLiteWriter.ts             # 100-card batches, parameterized statements, FTS optimization
│   ├── CatalogWriter.ts            # Upsert import_sources, write import_runs
│   ├── ImportOrchestrator.ts       # Parser → dedup → writer → catalog pipeline
│   ├── parsers/
│   │   ├── AppleNotesParser.ts     # Markdown+YAML → CanonicalCard[]
│   │   └── parseAttachment.ts      # Attachment type handlers (hashtag, link, table, file)
│   └── utils/
│       ├── thumbnailGenerator.ts   # OffscreenCanvas thumbnail creation
│       └── attachmentStorage.ts    # OPFS file copying and path resolution
├── worker/
│   ├── protocol.ts                 # Add etl:import and etl:export types
│   ├── WorkerBridge.ts             # Add importFile() and exportFile() methods
│   ├── worker.ts                   # Add etl:import and etl:export router cases
│   └── handlers/
│       └── etl-import.handler.ts   # Thin delegation to ImportOrchestrator
└── database/
    └── schema.sql                  # Append import_sources and import_runs tables
```

### Pattern 1: Canonical Type Mapping

**What:** All parsers output `CanonicalCard` and `CanonicalConnection` regardless of source format. Writers consume only canonical types.

**When to use:** For every parser (Apple Notes, Markdown, Excel, CSV, JSON, HTML). This is the critical integration seam that decouples parsing from storage.

**Example:**
```typescript
// src/etl/types.ts
export interface CanonicalCard {
  id: string;                    // Generated UUID
  card_type: 'note' | 'task' | 'event' | 'resource' | 'person';
  name: string;
  content: string | null;
  summary: string | null;

  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;

  // LATCH: Time
  created_at: string;            // ISO 8601
  modified_at: string;           // ISO 8601
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;

  // LATCH: Category
  folder: string | null;
  tags: string[];                // Not JSON-stringified yet
  status: string | null;

  // LATCH: Hierarchy
  priority: number;
  sort_order: number;

  // Type-specific
  url: string | null;
  mime_type: string | null;
  is_collective: boolean;

  // Source tracking (dedup key)
  source: string;                // 'apple_notes'
  source_id: string;             // Alto-index note ID
  source_url: string | null;     // notes://showNote?identifier=...
}

export interface CanonicalConnection {
  id: string;                    // Generated UUID
  source_id: string;             // May be temporary UUID or source_id (resolved by DedupEngine)
  target_id: string;
  via_card_id: string | null;
  label: string | null;          // 'mentions', 'links_to', 'contains'
  weight: number;                // 0.0 to 1.0
}
```

### Pattern 2: Deduplication via Source Tracking

**What:** DedupEngine loads all existing cards for a source type in a single query, classifies each incoming card as insert/update/skip based on `source_id` and `modified_at`, and builds a `sourceIdMap` to resolve connection target IDs.

**When to use:** For every import operation. Idempotent re-import is a core requirement (ETL-10).

**Example:**
```typescript
// src/etl/DedupEngine.ts
export interface DedupResult {
  toInsert: CanonicalCard[];
  toUpdate: CanonicalCard[];
  toSkip: CanonicalCard[];
  connections: CanonicalConnection[];
  sourceIdMap: Map<string, string>;  // source_id → card.id (UUID)
}

export class DedupEngine {
  constructor(private db: Database) {}

  async process(
    cards: CanonicalCard[],
    connections: CanonicalConnection[],
    sourceType: string
  ): Promise<DedupResult> {
    const toInsert: CanonicalCard[] = [];
    const toUpdate: CanonicalCard[] = [];
    const toSkip: CanonicalCard[] = [];
    const sourceIdMap = new Map<string, string>();

    // Load all existing cards for this source in one query
    // CRITICAL: Use parameterized query to avoid SQL injection (P25)
    const existing = this.db.prepare<{
      id: string;
      source_id: string;
      modified_at: string;
    }>(`
      SELECT id, source_id, modified_at
      FROM cards
      WHERE source = ? AND source_id IS NOT NULL
    `).all(sourceType);

    const existingMap = new Map(
      existing.map(e => [e.source_id, e])
    );

    // Classify each card
    for (const card of cards) {
      const existingCard = existingMap.get(card.source_id);

      if (!existingCard) {
        toInsert.push(card);
        sourceIdMap.set(card.source_id, card.id);
      } else {
        sourceIdMap.set(card.source_id, existingCard.id);

        // Compare timestamps: update if newer, skip if same/older
        if (new Date(card.modified_at) > new Date(existingCard.modified_at)) {
          toUpdate.push({ ...card, id: existingCard.id });
        } else {
          toSkip.push(card);
        }
      }
    }

    // Resolve connection target IDs via sourceIdMap
    const resolvedConnections = connections
      .map(conn => ({
        ...conn,
        source_id: sourceIdMap.get(conn.source_id) ?? conn.source_id,
        target_id: sourceIdMap.get(conn.target_id) ?? conn.target_id,
        via_card_id: conn.via_card_id
          ? (sourceIdMap.get(conn.via_card_id) ?? conn.via_card_id)
          : null
      }))
      // Drop connections with unresolvable targets (P30)
      .filter(conn =>
        sourceIdMap.has(conn.source_id) || existingMap.has(conn.source_id)
      );

    return { toInsert, toUpdate, toSkip, connections: resolvedConnections, sourceIdMap };
  }
}
```

### Pattern 3: Batch Writes with FTS Optimization

**What:** SQLiteWriter inserts cards in 100-card transaction batches using parameterized statements. For bulk imports (>500 cards), disable FTS triggers, insert all cards, rebuild FTS index in one pass, then optimize.

**When to use:** For all card writes. The 100-card batch size prevents WASM OOM (P22) and buffer overflow (P23). FTS optimization applies only to initial imports, not incremental updates.

**Example:**
```typescript
// src/etl/SQLiteWriter.ts
export class SQLiteWriter {
  constructor(private db: Database) {}

  async writeCards(cards: CanonicalCard[], isBulkImport = false): Promise<void> {
    if (cards.length === 0) return;

    const BATCH_SIZE = 100;

    // For bulk imports (>500 cards), disable FTS triggers
    if (isBulkImport && cards.length > 500) {
      await this.disableFTSTriggers();
    }

    try {
      // Write cards in 100-card batches
      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        const batch = cards.slice(i, i + BATCH_SIZE);

        this.db.transaction(() => {
          const stmt = this.db.prepare(`
            INSERT INTO cards (
              id, card_type, name, content, summary,
              latitude, longitude, location_name,
              created_at, modified_at, due_at, completed_at, event_start, event_end,
              folder, tags, status, priority, sort_order,
              url, mime_type, is_collective,
              source, source_id, source_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const card of batch) {
            stmt.run(
              card.id, card.card_type, card.name, card.content, card.summary,
              card.latitude, card.longitude, card.location_name,
              card.created_at, card.modified_at, card.due_at, card.completed_at,
              card.event_start, card.event_end,
              card.folder, JSON.stringify(card.tags), card.status,
              card.priority, card.sort_order,
              card.url, card.mime_type, card.is_collective ? 1 : 0,
              card.source, card.source_id, card.source_url
            );
          }
        })();

        // Yield to event loop between batches (prevents Worker starvation)
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Rebuild FTS if triggers were disabled
      if (isBulkImport && cards.length > 500) {
        await this.rebuildFTS();
      }
    } finally {
      // Restore FTS triggers if they were disabled
      if (isBulkImport && cards.length > 500) {
        await this.restoreFTSTriggers();
      }
    }
  }

  private async disableFTSTriggers(): Promise<void> {
    this.db.exec('DROP TRIGGER IF EXISTS cards_fts_ai');
    this.db.exec('DROP TRIGGER IF EXISTS cards_fts_ad');
    this.db.exec('DROP TRIGGER IF EXISTS cards_fts_au');
  }

  private async rebuildFTS(): Promise<void> {
    // Rebuild FTS index in one pass from cards table
    this.db.exec(`
      INSERT INTO cards_fts(rowid, name, content, tags, folder)
      SELECT rowid, name, content, tags, folder FROM cards
    `);

    // Optimize FTS segments (merge into single segment)
    this.db.exec("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
  }

  private async restoreFTSTriggers(): Promise<void> {
    // Restore triggers from schema.sql definitions
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, name, content, tags, folder)
        VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
      END
    `);
    // ... (restore AU and AD triggers similarly)
  }
}
```

### Pattern 4: Apple Notes Markdown+YAML Parsing

**What:** Use gray-matter to extract YAML frontmatter from Markdown files. Parse alto-index attachment types (hashtags, links, tables, files) from frontmatter arrays and content body.

**When to use:** For Apple Notes import only. This pattern is specific to alto-index export format.

**Example:**
```typescript
// src/etl/parsers/AppleNotesParser.ts
import matter from 'gray-matter';
import { parseHashtags, parseLinks, parseTable } from './parseAttachment';

interface AltoNoteFrontmatter {
  title?: string;
  id: number;
  created: string;
  modified: string;
  folder?: string;
  attachments?: AltoAttachment[];
  links?: string[];
  source: string;  // notes://showNote?identifier=...
}

interface AltoAttachment {
  id: string;
  type: string;  // 'public.url', 'com.apple.notes.inlinetextattachment.hashtag', 'com.apple.notes.table', 'public.jpeg', etc.
  title?: string;
  content?: string;  // HTML for hashtags/links/tables
  path?: string;     // File path for binary attachments
}

export class AppleNotesParser {
  parse(files: { path: string; content: string }[]): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const allCards: CanonicalCard[] = [];
    const allConnections: CanonicalConnection[] = [];

    for (const file of files) {
      const { data: fm, content } = matter(file.content);
      const note = fm as AltoNoteFrontmatter;

      // Main note card
      const noteCard = this.parseNote(note, content, file.path);
      allCards.push(noteCard);

      // Extract hashtags from attachments
      const hashtags = this.extractHashtags(note.attachments || []);
      noteCard.tags.push(...hashtags);

      // Parse URL attachments → resource cards
      const urlAttachments = this.parseURLAttachments(note.attachments || [], noteCard.id);
      allCards.push(...urlAttachments.cards);
      allConnections.push(...urlAttachments.connections);

      // Parse file attachments → resource cards + copy files
      const fileAttachments = await this.parseFileAttachments(
        note.attachments || [],
        noteCard.id,
        file.path
      );
      allCards.push(...fileAttachments.cards);
      allConnections.push(...fileAttachments.connections);

      // Parse table attachments → merge into content
      const tables = this.parseTables(note.attachments || []);
      if (tables.length > 0) {
        noteCard.content += '\n\n' + tables.join('\n\n');
      }

      // Parse @mentions → person cards
      const mentions = this.parseMentions(content, noteCard.id);
      allCards.push(...mentions.cards);
      allConnections.push(...mentions.connections);

      // Parse internal note links from attachments
      const noteLinks = this.parseNoteLinks(note.attachments || [], noteCard.id);
      allConnections.push(...noteLinks);
    }

    return { cards: allCards, connections: allConnections };
  }

  private parseNote(
    note: AltoNoteFrontmatter,
    content: string,
    filePath: string
  ): CanonicalCard {
    const title = note.title
      || this.extractFirstHeading(content)
      || this.extractFirstLine(content)
      || 'Untitled Note';

    const folder = note.folder || this.deriveFolder(filePath);

    return {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: title,
      content: content.trim(),
      summary: this.generateSummary(content),

      latitude: null,
      longitude: null,
      location_name: null,

      created_at: note.created,
      modified_at: note.modified,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,

      folder,
      tags: [],  // Filled by extractHashtags
      status: null,

      priority: 0,
      sort_order: 0,

      url: null,
      mime_type: 'text/markdown',
      is_collective: false,

      source: 'apple_notes',
      source_id: String(note.id),
      source_url: note.source,  // notes://showNote?identifier=...
    };
  }

  private extractHashtags(attachments: AltoAttachment[]): string[] {
    return attachments
      .filter(att => att.type === 'com.apple.notes.inlinetextattachment.hashtag')
      .map(att => {
        // Extract tag name from HTML: <a class="tag link" href="/tags/film">#film</a>
        const match = att.content?.match(/#(\w+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
  }

  private parseMentions(
    content: string,
    sourceCardId: string
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];

    // Regex: @FirstName LastName or @SingleWord
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const matches = content.matchAll(mentionRegex);

    const uniqueNames = new Set<string>();
    for (const match of matches) {
      const name = match[1].trim();
      uniqueNames.add(name.toLowerCase());
    }

    for (const name of uniqueNames) {
      const personId = crypto.randomUUID();

      cards.push({
        id: personId,
        card_type: 'person',
        name,
        content: null,
        summary: null,
        latitude: null,
        longitude: null,
        location_name: null,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        folder: null,
        tags: [],
        status: null,
        priority: 0,
        sort_order: 0,
        url: null,
        mime_type: null,
        is_collective: false,
        source: 'apple_notes',
        source_id: `mention:${name}`,
        source_url: null,
      });

      connections.push({
        id: crypto.randomUUID(),
        source_id: sourceCardId,
        target_id: personId,
        via_card_id: null,
        label: 'mentions',
        weight: 0.5,
      });
    }

    return { cards, connections };
  }
}
```

### Pattern 5: OffscreenCanvas Thumbnail Generation in Worker

**What:** Use OffscreenCanvas in Web Worker to generate image thumbnails without blocking the main thread. Create a 400px max-dimension thumbnail preserving aspect ratio.

**When to use:** For image attachments during Apple Notes import. This runs entirely in the Worker thread.

**Example:**
```typescript
// src/etl/utils/thumbnailGenerator.ts
export async function generateThumbnail(
  imageBlob: Blob,
  maxDimension = 400
): Promise<Blob> {
  // Create OffscreenCanvas
  const canvas = new OffscreenCanvas(maxDimension, maxDimension);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  // Load image
  const imageBitmap = await createImageBitmap(imageBlob);

  // Calculate thumbnail dimensions (preserve aspect ratio)
  const { width: origWidth, height: origHeight } = imageBitmap;
  let width = origWidth;
  let height = origHeight;

  if (width > height) {
    if (width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    }
  } else {
    if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // Resize canvas to fit thumbnail
  canvas.width = width;
  canvas.height = height;

  // Draw scaled image
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Convert to Blob
  const thumbnailBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.85,
  });

  return thumbnailBlob;
}
```

### Anti-Patterns to Avoid

- **String interpolation in SQL IN clauses:** NEVER construct IN clauses by interpolating data values. Use parameterized queries or JSON arrays (see Pitfall P25). Risk: SQL injection from imported file contents.
- **Multi-row VALUES concatenation:** NEVER build a single SQL string with 1,000+ rows like `INSERT INTO cards VALUES (...), (...), ...`. Use parameterized single-row inserts in a transaction. Risk: WASM buffer overflow (P23).
- **Base64 attachment storage in SQLite:** NEVER store Base64-encoded attachment data in card `content` or a blob column. Store files in OPFS, reference by path. Risk: OOM crash (P22).
- **Re-attaching FTS on every bulk import:** NEVER leave FTS triggers enabled during large imports. Disable → bulk insert → rebuild → restore. Risk: 10x slower imports (P24).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom delimiter + YAML parser | gray-matter | Handles edge cases (custom delimiters, nested frontmatter, multiple formats); 179 commits of edge case fixes |
| Image thumbnail generation | Custom canvas resize + image library | OffscreenCanvas native API | Zero dependencies; native browser API with transferable context; works in Worker; no npm package bloat |
| Markdown table HTML parsing | Regex or custom parser | node-html-parser | Lightweight (<10KB); handles malformed HTML gracefully; browser-compatible |
| Deduplication logic | Per-card SELECT queries | Single load-all-by-source query + in-memory Map | 1 query instead of N; avoids SQL injection; Map lookup is O(1) |

**Key insight:** The ETL domain has deceptively complex edge cases. YAML frontmatter has many delimiter variants and escape sequences. HTML parsing has encoding issues and malformed tags. Image resizing has EXIF orientation and color space concerns. Using battle-tested libraries avoids spending weeks on edge cases that have already been solved.

## Common Pitfalls

### Pitfall 22: sql.js WASM Heap OOM on Large Imports (Memory Pressure)

**What goes wrong:**
Importing 5,000+ notes causes sql.js to consume more memory than the WASM heap allows, resulting in a tab crash or `OOM: Cannot allocate Wasm memory` error. The Worker dies silently, the bridge receives no response, and the main thread waits until timeout.

**Why it happens:**
- sql.js holds entire database in WASM heap memory
- FTS5 index stores un-merged segments during bulk inserts
- Parsed JSON payload held alongside database state
- Content fields stored in both `cards` table and FTS index

**How to avoid:**
Process imports in 100-card transaction batches:

```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < cards.length; i += BATCH_SIZE) {
  const batch = cards.slice(i, i + BATCH_SIZE);
  await db.transaction(() => {
    // Insert batch
  });
  // Yield to event loop between batches (allows GC)
  await new Promise(resolve => setTimeout(resolve, 0));
}

// Optimize FTS after all inserts
await db.exec("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
```

**Warning signs:**
- Worker goes silent during large imports (no response, no error)
- Tab memory usage grows past 200MB
- Import succeeds for 1,000 notes but crashes at 5,000
- `etl:import` bridge message times out

**Severity:** CRITICAL — silent data loss, no recovery without re-import

---

### Pitfall 23: sql.js Buffer Overflow on Large SQL String in Database.run()

**What goes wrong:**
Passing a large SQL string (multi-row VALUES with 3,000+ rows) to `db.run()` causes a buffer overflow inside WASM heap. The error manifests as "Memory access out of bounds" and corrupts subsequent database operations.

**Why it happens:**
sql.js copies the SQL string into WASM heap before passing to SQLite. Undocumented limit on copy buffer size (~1.5MB query strings, ~3,700 concatenated rows).

**How to avoid:**
ALWAYS use parameterized statements, NEVER concatenated VALUES:

```typescript
// WRONG: Single huge string
db.run(`INSERT INTO cards VALUES ('id1', ...), ('id2', ...), ...`);  // 3000 rows → buffer overflow

// CORRECT: Parameterized, one row per operation
db.transaction(() => {
  const stmt = db.prepare('INSERT INTO cards (...) VALUES (?, ?, ...)');
  for (const card of cards) {
    stmt.run(card.id, card.name, ...);
  }
})();
```

**Warning signs:**
- "Memory access out of bounds" in Worker console
- Subsequent queries return empty arrays after bulk insert
- Import appears to succeed (no thrown error) but card count is wrong
- Problem only manifests above certain batch size threshold

**Severity:** CRITICAL — data corruption, silent failure

---

### Pitfall 24: FTS5 Trigger Overhead Makes Bulk Imports Prohibitively Slow

**What goes wrong:**
Each INSERT into `cards` fires FTS triggers. For 10,000 cards, this is 10,000 trigger firings with segment merges. A 2-second import becomes 30-60 seconds.

**Why it happens:**
FTS5 external content table processes each trigger independently. Trigger approach is correct for OLTP, but for bulk ETL it creates O(n) segment merges instead of a single rebuild.

**How to avoid:**
For bulk imports (>500 cards), disable triggers → bulk insert → rebuild FTS → restore triggers:

```typescript
// Disable FTS triggers for bulk import
db.exec('DROP TRIGGER IF EXISTS cards_fts_ai');

// Write cards in chunks
for (let i = 0; i < cards.length; i += 500) {
  // ... insert batch
}

// Rebuild FTS from cards table in one pass
db.exec('INSERT INTO cards_fts(rowid, name, content, tags, folder) SELECT rowid, name, content, tags, folder FROM cards');

// Optimize segments into single merged segment
db.exec("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");

// Restore trigger
db.exec(`CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts(rowid, name, content, tags, folder)
  VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END`);
```

**Warning signs:**
- Import of 1,000 cards takes >5s (expected: <500ms)
- Worker CPU usage stays at 100% for entire import duration
- FTS `integrity-check` passes but segment count is very high
- Progress reporting stalls mid-import without error

**Severity:** HIGH — import unusably slow at realistic dataset sizes

---

### Pitfall 25: DedupEngine SQL Injection via String-Interpolated source_id Values

**What goes wrong:**
The `DedupEngine.process()` method constructs an IN clause by string-interpolating source keys. If a `source_id` from an imported file contains a single quote (e.g., `O'Brien's Note`) or SQL metacharacters, the string interpolation breaks the SQL or executes arbitrary SQL.

**Why it happens:**
Markdown file paths are user-supplied and can contain any character. The allowlist pattern from Contracts.md applies to column names, but DedupEngine constructs an IN clause from data values — a different injection vector.

**How to avoid:**
Use parameterized query:

```typescript
// WRONG: String interpolation
const sourceKeys = cards.map(c => `'${c.source}:${c.source_id}'`).join(',');
const existing = await db.query(`
  SELECT id, source, source_id, modified_at FROM cards
  WHERE source || ':' || source_id IN (${sourceKeys})
`);

// CORRECT: Parameterized query (load all for source, filter in memory)
const existing = this.db.prepare<{
  id: string;
  source_id: string;
  modified_at: string;
}>(`
  SELECT id, source_id, modified_at
  FROM cards
  WHERE source = ? AND source_id IS NOT NULL
`).all(sourceType);

const existingMap = new Map(
  existing.map(e => [e.source_id, e])
);
```

**Warning signs:**
- Import of Markdown file with apostrophe in path fails with SQL syntax error
- DedupEngine produces incorrect results for source IDs with special characters
- No test covers source_id values with quotes, semicolons, or backslashes

**Severity:** CRITICAL — SQL injection from imported file contents; silent dedup failures

---

### Pitfall 26: gray-matter Has a Node.js fs Dependency That Breaks in Browser/Worker

**What goes wrong:**
gray-matter's `.read()` method uses Node.js `fs` module, which is not available in browser/Worker context. Importing gray-matter directly in Worker code causes a build error or runtime crash.

**Why it happens:**
gray-matter is designed for Node.js environments and includes file I/O capabilities via `fs`. Modern bundlers (Vite, webpack) handle this via shims, but the bundler must be configured to treat gray-matter as an external dependency or provide a browser-compatible build.

**How to avoid:**
Use only the core `matter()` function, not `.read()`:

```typescript
import matter from 'gray-matter';

// WRONG: Uses fs.readFileSync internally
const result = matter.read('path/to/file.md');

// CORRECT: Pass content string directly
const fileContent = await fetch('path/to/file.md').then(r => r.text());
const result = matter(fileContent);
```

Vite configuration (if needed):
```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // Let Vite bundle gray-matter (it will shim fs automatically)
    include: ['gray-matter'],
  },
});
```

**Warning signs:**
- Build error: "Module not found: Can't resolve 'fs'"
- Runtime error in Worker: "fs is not defined"
- gray-matter works in main thread but fails in Worker

**Severity:** MEDIUM — build/runtime failure, but has known workaround

---

### Pitfall 30: Cross-Batch Connection ID Resolution

**What goes wrong:**
When parsing Apple Notes, a connection's `target_id` may reference a note that hasn't been parsed yet (e.g., note A mentions note B, but note B is later in the file list). The connection has a temporary UUID or source_id that can't be resolved until all cards are loaded.

**Why it happens:**
DedupEngine resolves connection IDs via `sourceIdMap`, but the map is built during dedup classification. If a connection references a note that doesn't exist in the current import batch, the target ID can't be resolved.

**How to avoid:**
DedupEngine queries the database for existing source IDs to build the map:

```typescript
// Load all existing cards for this source to build full sourceIdMap
const existing = this.db.prepare<{ id: string; source_id: string }>(`
  SELECT id, source_id FROM cards WHERE source = ?
`).all(sourceType);

const sourceIdMap = new Map(existing.map(e => [e.source_id, e.id]));

// Add newly inserted cards to the map
for (const card of toInsert) {
  sourceIdMap.set(card.source_id, card.id);
}

// Resolve connections via map; drop unresolvable targets
const resolvedConnections = connections
  .map(conn => ({
    ...conn,
    source_id: sourceIdMap.get(conn.source_id) ?? conn.source_id,
    target_id: sourceIdMap.get(conn.target_id) ?? conn.target_id,
  }))
  .filter(conn => sourceIdMap.has(conn.target_id));  // Drop if target doesn't exist
```

Use `INSERT OR IGNORE` for connections to silently drop duplicates:

```typescript
db.prepare(`
  INSERT OR IGNORE INTO connections (id, source_id, target_id, via_card_id, label, weight)
  VALUES (?, ?, ?, ?, ?, ?)
`);
```

**Warning signs:**
- Connection counts are lower than expected after import
- Internal note links between notes in the same import batch are missing
- Re-importing the same export creates connections that were missing the first time

**Severity:** MEDIUM — connections silently dropped, but recoverable via re-import

## Code Examples

Verified patterns from official sources and existing codebase:

### Worker Protocol Extension (ETL-03)

```typescript
// src/worker/protocol.ts
import type { CanonicalCard, CanonicalConnection, ImportResult } from '../etl/types';

export type WorkerRequestType =
  | 'card:create'
  // ... existing types
  | 'etl:import'
  | 'etl:export';

export interface WorkerPayloads {
  // ... existing payloads
  'etl:import': {
    source: 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html';
    data: ArrayBuffer | string;  // Transferable for binary data
    options?: {
      timeout?: number;  // Override default 300s timeout
      isBulkImport?: boolean;  // Enable FTS optimization
    };
  };
  'etl:export': {
    format: 'markdown' | 'json' | 'csv';
    cardIds?: string[];  // Optional filter
  };
}

export interface WorkerResponses {
  // ... existing responses
  'etl:import': ImportResult;
  'etl:export': { data: string; filename: string };
}

// Extended timeout for ETL operations
export const ETL_TIMEOUT = 300_000;  // 300 seconds
```

### Worker Router Case (ETL-18)

```typescript
// src/worker/worker.ts
import { handleETLImport, handleETLExport } from './handlers/etl-import.handler';

function routeRequest(db: Database, request: WorkerRequest): WorkerResponses[WorkerRequestType] {
  const { type, payload } = request;

  switch (type) {
    // ... existing cases

    case 'etl:import': {
      const p = payload as WorkerPayloads['etl:import'];
      return handleETLImport(db, p);
    }

    case 'etl:export': {
      const p = payload as WorkerPayloads['etl:export'];
      return handleETLExport(db, p);
    }

    default: {
      // Exhaustive check — TypeScript error if type not handled
      const _exhaustive: never = type;
      throw new Error(`Unknown request type: ${type}`);
    }
  }
}
```

### ETL Import Handler (ETL-18)

```typescript
// src/worker/handlers/etl-import.handler.ts
import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';
import { ImportOrchestrator } from '../../etl/ImportOrchestrator';

export async function handleETLImport(
  db: Database,
  payload: WorkerPayloads['etl:import']
): Promise<WorkerResponses['etl:import']> {
  const orchestrator = new ImportOrchestrator(db);
  return orchestrator.import(payload.source, payload.data, payload.options);
}

export async function handleETLExport(
  db: Database,
  payload: WorkerPayloads['etl:export']
): Promise<WorkerResponses['etl:export']> {
  // Deferred to Phase 9
  throw new Error('Export not yet implemented');
}
```

### Data Catalog Schema (ETL-02)

```sql
-- Append to src/database/schema.sql

-- ============================================================
-- Import Sources (ETL-02)
-- ============================================================
CREATE TABLE import_sources (
    id TEXT PRIMARY KEY NOT NULL,  -- UUID
    name TEXT NOT NULL,             -- User-friendly name (e.g., "Apple Notes")
    source_type TEXT NOT NULL,      -- 'apple_notes', 'markdown', etc.
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- Import Runs (ETL-02)
-- ============================================================
CREATE TABLE import_runs (
    id TEXT PRIMARY KEY NOT NULL,  -- UUID
    source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE,
    filename TEXT,                  -- Original filename/path
    started_at TEXT NOT NULL,
    completed_at TEXT,
    cards_inserted INTEGER NOT NULL DEFAULT 0,
    cards_updated INTEGER NOT NULL DEFAULT 0,
    cards_skipped INTEGER NOT NULL DEFAULT 0,
    connections_created INTEGER NOT NULL DEFAULT 0,
    errors_json TEXT                -- JSON array of ParseError objects
);

CREATE INDEX idx_import_runs_source ON import_runs(source_id);
CREATE INDEX idx_import_runs_completed ON import_runs(completed_at);
```

### Import Orchestrator (ETL-12)

```typescript
// src/etl/ImportOrchestrator.ts
import type { Database } from '../database/Database';
import type { CanonicalCard, CanonicalConnection, ImportResult, ParseError } from './types';
import { AppleNotesParser } from './parsers/AppleNotesParser';
import { DedupEngine } from './DedupEngine';
import { SQLiteWriter } from './SQLiteWriter';
import { CatalogWriter } from './CatalogWriter';

export class ImportOrchestrator {
  private dedup: DedupEngine;
  private writer: SQLiteWriter;
  private catalog: CatalogWriter;

  constructor(private db: Database) {
    this.dedup = new DedupEngine(db);
    this.writer = new SQLiteWriter(db);
    this.catalog = new CatalogWriter(db);
  }

  async import(
    source: string,
    data: ArrayBuffer | string,
    options?: { isBulkImport?: boolean }
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ParseError[] = [];
    const insertedIds: string[] = [];

    // 1. Parse source data → canonical types
    let cards: CanonicalCard[] = [];
    let connections: CanonicalConnection[] = [];

    try {
      if (source === 'apple_notes') {
        const parser = new AppleNotesParser();
        const parsed = await parser.parse(data as string);  // Assume files array as JSON string
        cards = parsed.cards;
        connections = parsed.connections;
      } else {
        throw new Error(`Parser not implemented: ${source}`);
      }
    } catch (error) {
      return {
        inserted: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 1,
        connections_created: 0,
        insertedIds: [],
        errors_detail: [{
          index: -1,
          source_id: null,
          message: `Parse error: ${(error as Error).message}`,
        }],
      };
    }

    // 2. Deduplicate
    const dedupResult = await this.dedup.process(cards, connections, source);

    // 3. Write to database
    await this.writer.writeCards(dedupResult.toInsert, options?.isBulkImport);
    await this.writer.updateCards(dedupResult.toUpdate);
    await this.writer.writeConnections(dedupResult.connections);

    insertedIds.push(...dedupResult.toInsert.map(c => c.id));

    // 4. Record import run in catalog
    await this.catalog.recordImportRun({
      source,
      filename: 'import',  // TODO: Extract from data
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      cards_inserted: dedupResult.toInsert.length,
      cards_updated: dedupResult.toUpdate.length,
      cards_skipped: dedupResult.toSkip.length,
      connections_created: dedupResult.connections.length,
      errors_json: JSON.stringify(errors),
    });

    return {
      inserted: dedupResult.toInsert.length,
      updated: dedupResult.toUpdate.length,
      unchanged: dedupResult.toSkip.length,
      skipped: 0,
      errors: errors.length,
      connections_created: dedupResult.connections.length,
      insertedIds,
      errors_detail: errors,
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Image resizing in main thread (Canvas API) | OffscreenCanvas in Worker | March 2023 (baseline widely available) | Unblocks main thread; smoother UI during imports |
| IndexedDB for file storage | OPFS (Origin Private File System) | 2022-2023 (File System Access API) | Better file-like access patterns; faster read/write for large files |
| Regex-based HTML parsing | Dedicated HTML parser (node-html-parser) | Always recommended | Handles malformed HTML gracefully; avoids regex edge cases |
| Per-row SELECT for dedup | Single load-all + in-memory Map | Long-standing pattern | 1 query instead of N; O(1) lookup; prevents SQL injection |

**Deprecated/outdated:**
- **gray-matter `.read()` method in browser:** Always use `matter(content)` with content passed as string. The `.read()` method uses Node.js `fs` and is not browser-compatible.
- **Multi-row VALUES inserts in sql.js:** Buffer overflow risk (P23). Always use parameterized single-row inserts in a transaction.

## Open Questions

1. **Attachment file path resolution for alto-index exports**
   - What we know: Alto-index exports include `path` field in file attachments pointing to the original file location
   - What's unclear: Are these absolute paths, relative to the export directory, or relative to the note file? Does alto-index copy files to an export folder or reference originals?
   - Recommendation: Test with actual alto-index export. If paths are relative, resolve them relative to the note file's directory. If absolute, verify files exist before copying.

2. **OPFS quota limits for large attachment collections**
   - What we know: OPFS has storage quotas that vary by browser; typical minimum is 1GB per origin
   - What's unclear: What happens when quota is exceeded? Does OPFS throw an error, or does it silently fail? Is there a quota API to check available space before import?
   - Recommendation: Add quota check before import using `navigator.storage.estimate()`. Warn user if remaining space < attachment total size. Test with >1GB attachment set to verify error handling.

3. **Markdown table HTML parsing robustness**
   - What we know: Apple Notes stores tables as HTML in attachment content
   - What's unclear: How malformed is the HTML? Does it always have `<table>` tags, or are there edge cases with custom markup?
   - Recommendation: Examine 10-20 real Apple Notes table exports. If HTML is well-formed, use node-html-parser. If very malformed, may need custom heuristics or fallback to raw HTML preservation.

## Validation Architecture

> Note: `.planning/config.json` does not have `workflow.nyquist_validation` flag, so this section is omitted per agent instructions. If validation is added later, map each ETL-XX requirement to specific test types (unit for parsers/dedup, integration for orchestrator, smoke for 5K-card OOM test).

## Sources

### Primary (HIGH confidence)

- **Codebase Analysis:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/DataExplorer.md` — Complete ETL architecture specification with working code examples
  - `/Users/mshaler/Developer/Projects/Isometry/.planning/research/PITFALLS.md` — P22-P25 documented with mitigations
  - `/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts` — Existing Worker Bridge protocol pattern
  - `/Users/mshaler/Developer/Projects/Isometry/src/worker/handlers/cards.handler.ts` — Handler pattern for delegation
  - `/Users/mshaler/Developer/Projects/Isometry/src/database/schema.sql` — Existing cards/connections schema with source tracking columns
  - `/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes/` — Real alto-index export showing Markdown+YAML format

- **Official Documentation:**
  - [OffscreenCanvas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) — Native API specification, browser compatibility (baseline widely available since March 2023), usage examples for thumbnail generation in Worker
  - [File System API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) — OPFS origin-private file system for managed attachment storage

### Secondary (MEDIUM confidence)

- [gray-matter GitHub](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter parser; version 4.0.3; TypeScript definitions included; 179 commits; supports custom delimiters and engines
- [How to use canvas in Web Workers with OffscreenCanvas - DEV Community](https://dev.to/sachinchaurasiya/how-to-use-canvas-in-web-workers-with-offscreencanvas-5540) — Practical tutorial for OffscreenCanvas thumbnail generation (2025)
- [OffscreenCanvas—speed up your canvas operations with a web worker | web.dev](https://web.dev/articles/offscreen-canvas) — Official Google tutorial on performance benefits

### Tertiary (LOW confidence)

- WebSearch result: gray-matter browser compatibility requires bundler (webpack/Vite) to handle `fs` module shims — verified via issue #49 on GitHub
- WebSearch result: OffscreenCanvas browser support across all modern browsers (97% compatibility score) — needs verification against specific WKWebView version used in Isometry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — gray-matter is de facto standard; OffscreenCanvas and OPFS are native APIs with MDN docs
- Architecture: HIGH — DataExplorer.md provides complete working code; pitfalls are documented with verified mitigations
- Pitfalls: HIGH — P22-P25 are documented in PITFALLS.md with code examples; verified via first principles (WASM heap limits, SQL buffer limits, FTS segment merging)

**Research date:** 2026-03-01
**Valid until:** 90 days (stable domain; gray-matter 4.x unchanged since 2019; OffscreenCanvas baseline since March 2023)
