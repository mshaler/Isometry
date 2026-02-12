# Phase 69: File Importers - Research

**Researched:** 2026-02-12
**Domain:** File format parsing and import (TypeScript, browser + Node.js)
**Confidence:** HIGH

## Summary

Phase 69 implements six format-specific importers (Markdown, Excel, Word, JSON, HTML, CSV) that extend the BaseImporter abstract class from Phase 68. Each importer must parse its format and transform the data into CanonicalNode[] arrays. The parsing libraries are mature, well-documented, and most are already installed in the project. The challenge is not parsing itself but intelligent mapping of diverse document structures to the LATCH-based CanonicalNode schema.

Key architectural insight: The alto-importer.ts already provides a proven pattern for frontmatter-based markdown import with deterministic ID generation and property storage. The six new importers should follow this pattern where applicable.

**Primary recommendation:** Use battle-tested parsing libraries (xlsx, mammoth, papaparse, gray-matter, native JSON.parse, DOMParser), focus implementation effort on smart LATCH mapping and edge case handling.

## Standard Stack

### Core Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xlsx (SheetJS) | ^0.18+ | Excel parsing (.xlsx, .xls) | Industry standard, 60M+ weekly downloads, handles all Excel formats |
| mammoth | ^1.7.2 | Word parsing (.docx) | Semantic HTML extraction, already installed, best DOCX→text |
| papaparse | ^5.4+ | CSV parsing (.csv, .tsv) | RFC 4180 compliant, streaming support, TypeScript-friendly |
| gray-matter | ^4.0.3 | Markdown frontmatter | Already installed, battle-tested, YAML/JSON/TOML support |
| marked | ^17+ | Markdown parsing | Fastest markdown parser, full CommonMark support |
| DOMParser (native) | Browser API | HTML parsing (.html) | Native browser API, zero dependencies, standards-compliant |
| JSON.parse (native) | JavaScript builtin | JSON parsing (.json) | Native, fastest, standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | ^11.0.4 | Node ID generation | Already installed, every importer needs unique IDs |
| zod | ^3.25+ | Schema validation | Already installed, validate CanonicalNode output |
| @types/papaparse | Latest | TypeScript types | Type safety for CSV parsing |
| @types/marked | Latest | TypeScript types | Type safety for markdown parsing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx | exceljs | More features but heavier, slower parsing |
| mammoth | docx (npm) | More control but requires manual HTML conversion |
| papaparse | csv-parser | Node.js only, no browser support |
| marked | markdown-it | More extensible but slower, complex API |
| DOMParser (browser) | jsdom (Node.js) | Needed for Node.js, too heavy for browser |

**Installation:**
```bash
# New dependencies needed
npm install xlsx papaparse marked
npm install -D @types/papaparse @types/marked

# Already installed (verify)
# - mammoth: ^1.7.2
# - gray-matter: ^4.0.3
# - uuid: ^11.0.4
# - zod: ^3.25.76
```

## Architecture Patterns

### Recommended Project Structure
```
src/etl/
├── types/
│   └── canonical.ts              # Phase 67: CanonicalNode schema ✅
├── coordinator/
│   └── ImportCoordinator.ts      # Phase 68: Router ✅
├── importers/
│   ├── BaseImporter.ts           # Phase 68: Abstract base ✅
│   ├── MarkdownImporter.ts       # Phase 69: NEW (IMP-01)
│   ├── ExcelImporter.ts          # Phase 69: NEW (IMP-02)
│   ├── WordImporter.ts           # Phase 69: NEW (IMP-03)
│   ├── JsonImporter.ts           # Phase 69: NEW (IMP-04)
│   ├── HtmlImporter.ts           # Phase 69: NEW (IMP-05)
│   └── CsvImporter.ts            # Phase 69: NEW (IMP-06)
├── id-generation/
│   └── deterministic.ts          # Existing: Reuse for all importers
├── storage/
│   └── property-storage.ts       # Existing: Store extended properties
├── alto-importer.ts              # Existing: REFERENCE PATTERN ⭐
└── __tests__/
    ├── MarkdownImporter.test.ts  # Phase 69: TDD for each importer
    ├── ExcelImporter.test.ts
    ├── WordImporter.test.ts
    ├── JsonImporter.test.ts
    ├── HtmlImporter.test.ts
    └── CsvImporter.test.ts
```

### Pattern 1: Template Method (from BaseImporter)
**What:** All importers follow parse → validate → transform pipeline defined in BaseImporter.

**When to use:** Every format-specific importer in Phase 69.

**Example:**
```typescript
// Source: src/etl/importers/BaseImporter.ts (Phase 68)
class MarkdownImporter extends BaseImporter {
  // Step 1: Parse format-specific content
  protected async parse(source: FileSource): Promise<unknown> {
    const { content } = source;
    const parsed = matter(content); // gray-matter
    const html = marked.parse(parsed.content); // marked
    return { frontmatter: parsed.data, html, raw: parsed.content };
  }

  // Step 2: Validate (optional, override if needed)
  protected async validate(data: unknown): Promise<unknown> {
    // Add markdown-specific validation if needed
    return data;
  }

  // Step 3: Transform to CanonicalNode[]
  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { frontmatter, html, raw } = data as ParsedMarkdown;

    // Map to LATCH schema
    const node: CanonicalNode = {
      id: uuidv4(),
      nodeType: frontmatter.type || 'note',
      name: frontmatter.title || extractFirstHeading(html) || 'Untitled',
      content: html,
      summary: frontmatter.summary || extractSummary(raw),
      // ... LATCH mapping
      createdAt: frontmatter.created || new Date().toISOString(),
      modifiedAt: frontmatter.modified || new Date().toISOString(),
      tags: frontmatter.tags || [],
      folder: frontmatter.folder || null,
      // ... rest of CanonicalNode fields
    };

    return [node];
  }
}
```

### Pattern 2: Deterministic ID Generation
**What:** Use file path + content hash for reproducible source_id (allows reimport without duplicates).

**When to use:** All importers should generate deterministic source_id for deduplication.

**Example:**
```typescript
// Source: Existing src/etl/id-generation/deterministic.ts
import { generateDeterministicSourceId } from '../id-generation/deterministic';

protected async transform(data: unknown): Promise<CanonicalNode[]> {
  const sourceId = generateDeterministicSourceId(
    source.filename,
    { frontmatter: parsed.data },
    'markdown-importer'
  );

  const node: CanonicalNode = {
    id: uuidv4(), // New UUID for internal ID
    sourceId,     // Deterministic for deduplication
    source: 'markdown-importer',
    // ...
  };
}
```

### Pattern 3: Property Storage for Unknown Fields
**What:** Store format-specific metadata in node_properties table via storeNodeProperties().

**When to use:** When parsed files contain fields not in CanonicalNode schema.

**Example:**
```typescript
// Source: Existing src/etl/storage/property-storage.ts
import { storeNodeProperties } from '../storage/property-storage';

protected async transform(data: unknown): Promise<CanonicalNode[]> {
  const node: CanonicalNode = { /* ... */ };

  // Extended properties go to properties field (EAV table)
  node.properties = {
    wordCount: calculateWordCount(data.content),
    language: detectLanguage(data.content),
    originalFormat: 'markdown',
    // Any format-specific metadata
  };

  return [node];
}
```

### Pattern 4: Multi-Node Documents (Excel, CSV)
**What:** Single file can produce multiple CanonicalNodes (one per row, sheet, section).

**When to use:** Excel (rows as cards), CSV (rows as cards), HTML (sections as cards).

**Example:**
```typescript
// Source: Pattern for tabular data
class CsvImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    return new Promise((resolve, reject) => {
      Papa.parse(source.content, {
        header: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    });
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const rows = data as Record<string, string>[];

    // One node per row
    return rows.map((row) => ({
      id: uuidv4(),
      name: row.name || row.title || 'Untitled Row',
      content: JSON.stringify(row), // Preserve full row data
      // Map columns to LATCH fields intelligently
      tags: row.tags ? row.tags.split(',') : [],
      folder: row.folder || row.category || null,
      createdAt: row.created || new Date().toISOString(),
      // ...
    }));
  }
}
```

### Pattern 5: Streaming for Large Files
**What:** Use streaming parsers for files that might exceed memory limits.

**When to use:** Excel (large spreadsheets), CSV (large datasets).

**Example:**
```typescript
// Source: PapaParse streaming API
class CsvImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    const nodes: CanonicalNode[] = [];

    return new Promise((resolve, reject) => {
      Papa.parse(source.content, {
        header: true,
        step: (row) => {
          // Process row immediately, don't accumulate
          const node = this.rowToNode(row.data);
          nodes.push(node);
        },
        complete: () => resolve(nodes),
        error: reject,
      });
    });
  }
}
```

### Anti-Patterns to Avoid
- **Parsing in constructor:** All parsing must happen in parse() method, not in constructor or import().
- **Blocking I/O in browser:** Use async file reading, never synchronous operations.
- **Ignoring encoding:** Handle UTF-8, UTF-16, and base64-encoded content properly.
- **Throwing on empty documents:** Return empty array [] instead of throwing errors for valid-but-empty files.
- **Hardcoded field mappings:** Make LATCH mappings flexible, use heuristics to detect which columns map to which fields.
- **Swallowing parse errors:** Bubble up detailed errors with file context and line numbers when available.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel parsing | Custom ZIP+XML parser | xlsx (SheetJS) | Excel format is complex (100+ XML schemas), edge cases everywhere |
| CSV parsing | String.split(',') | papaparse | Handles quoted commas, multiline fields, RFC 4180 edge cases |
| Markdown parsing | Regex-based parser | marked | CommonMark spec has 624 examples, regex can't handle all cases |
| HTML parsing | Regex HTML parser | DOMParser (browser native) | [You can't parse HTML with regex](https://stackoverflow.com/a/1732454) |
| DOCX parsing | Custom ZIP+XML parser | mammoth | DOCX is Office Open XML (complex), mammoth handles semantic extraction |
| YAML frontmatter | Custom parser | gray-matter | YAML spec is huge, gray-matter battle-tested by millions |
| Streaming CSV | Manual chunking | papaparse streaming | Memory-efficient streaming built-in, handles edge cases |

**Key insight:** File parsing is deceptively complex. Every format has edge cases that take years to handle correctly. Use libraries with millions of downloads and years of battle-testing.

## Common Pitfalls

### Pitfall 1: Assuming One File = One Node
**What goes wrong:** Excel with 1000 rows creates 1000-element array, but importer only returns first row.

**Why it happens:** Thinking of documents as singular entities instead of containers.

**How to avoid:**
- Excel: One node per row (or per sheet if sheets are different types)
- CSV: One node per row
- HTML: One node per semantic section (article, section with heading)
- Markdown: Usually one node, but could split on H1 headers for long documents
- JSON: Depends on structure (array → multiple nodes, object → one node)
- DOCX: Usually one node, but could split on headings

**Warning signs:**
- ExcelImporter always returns single-element array
- Large CSV only imports first row
- Multi-page HTML document creates one massive node

### Pitfall 2: Losing Metadata in Transformation
**What goes wrong:** Excel has cell colors, formulas, comments - all lost in transformation.

**Why it happens:** Focusing only on text content, ignoring rich metadata.

**How to avoid:**
```typescript
// Store extended metadata in properties field
node.properties = {
  // Excel metadata
  cellColors: sheet.colors,
  formulas: sheet.formulas,
  comments: sheet.comments,

  // HTML metadata
  metaTags: doc.querySelector('meta'),
  links: Array.from(doc.querySelectorAll('a')),

  // Preserve original for debugging
  _originalFormat: 'excel',
  _sheetName: sheet.name,
};
```

**Warning signs:**
- Reimporting loses information
- Users complain about "missing data"
- No way to distinguish source format after import

### Pitfall 3: Hardcoding Column-to-Field Mappings
**What goes wrong:** CSV with "Task" column doesn't import because code expects "name" column.

**Why it happens:** Assuming specific column names in source data.

**How to avoid:**
```typescript
// Flexible column detection
function detectNameColumn(row: Record<string, string>): string | null {
  const nameKeys = ['name', 'title', 'task', 'subject', 'description'];
  for (const key of nameKeys) {
    const matched = Object.keys(row).find(
      k => k.toLowerCase() === key.toLowerCase()
    );
    if (matched) return row[matched];
  }
  return Object.values(row)[0]; // Fallback to first column
}
```

**Warning signs:**
- Importer works on test data but fails on real data
- Users must rename columns to match importer expectations
- Error: "Required field 'name' not found"

### Pitfall 4: Not Handling Encoding
**What goes wrong:** Uploaded CSV has UTF-16 encoding, displays as gibberish.

**Why it happens:** Assuming all text is UTF-8.

**How to avoid:**
```typescript
protected async parse(source: FileSource): Promise<unknown> {
  const { content, encoding = 'utf8' } = source;

  // Handle base64 for binary formats
  if (encoding === 'base64') {
    const buffer = Buffer.from(content, 'base64');
    return parseExcel(buffer);
  }

  // Handle text with explicit encoding
  return parseText(content, encoding);
}
```

**Warning signs:**
- Characters display as �
- Non-English text is corrupted
- Binary formats fail to parse

### Pitfall 5: Synchronous Parsing in Browser
**What goes wrong:** Browser freezes when parsing 10MB Excel file.

**Why it happens:** Blocking main thread with synchronous operations.

**How to avoid:**
- All parse() methods are async
- Use streaming parsers for large files
- Consider Web Workers for heavy parsing (future optimization)

**Warning signs:**
- UI freezes during import
- "Page is unresponsive" browser warning
- Can't cancel long-running imports

### Pitfall 6: Not Validating Output with CanonicalNodeSchema
**What goes wrong:** Importer returns nodes with invalid UUIDs, crashes database insertion.

**Why it happens:** Trusting transformation logic without validation.

**How to avoid:**
```typescript
// ImportCoordinator already validates, but double-check in tests
import { CanonicalNodeSchema } from '../types/canonical';

it('should return valid CanonicalNode array', async () => {
  const result = await importer.import(source);

  // Validate every node
  result.forEach(node => {
    expect(() => CanonicalNodeSchema.parse(node)).not.toThrow();
  });
});
```

**Warning signs:**
- Database insertion fails with validation errors
- TypeError: undefined is not a string
- Tests pass but production fails

## Code Examples

Verified patterns from existing codebase and library documentation:

### Markdown Import (Complete Example)
```typescript
// Source: Existing alto-importer.ts pattern + gray-matter + marked
import matter from 'gray-matter';
import { marked } from 'marked';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  html: string;
  raw: string;
}

export class MarkdownImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    const parsed = matter(source.content);
    const html = await marked.parse(parsed.content);

    return {
      frontmatter: parsed.data,
      html,
      raw: parsed.content,
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { frontmatter, html, raw } = data as ParsedMarkdown;

    const sourceId = generateDeterministicSourceId(
      source.filename,
      frontmatter,
      'markdown-importer'
    );

    const now = new Date().toISOString();

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId,
      source: 'markdown-importer',
      nodeType: (frontmatter.type as string) || 'note',
      name: (frontmatter.title as string) || extractTitle(raw) || 'Untitled',
      content: html,
      summary: (frontmatter.summary as string) || null,

      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,

      // LATCH: Time
      createdAt: (frontmatter.created as string) || now,
      modifiedAt: (frontmatter.modified as string) || now,
      dueAt: (frontmatter.due as string) || null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,

      // LATCH: Category
      folder: (frontmatter.folder as string) || null,
      tags: (frontmatter.tags as string[]) || [],
      status: (frontmatter.status as string) || null,

      // LATCH: Hierarchy
      priority: (frontmatter.priority as number) || 0,
      importance: (frontmatter.importance as number) || 0,
      sortOrder: 0,

      gridX: 0,
      gridY: 0,
      sourceUrl: null,
      deletedAt: null,
      version: 1,
      properties: {
        wordCount: raw.split(/\s+/).length,
        originalFormat: 'markdown',
      },
    };

    return [node];
  }
}

function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}
```

### Excel Import (Multi-Node Pattern)
```typescript
// Source: SheetJS documentation + multi-node pattern
import * as XLSX from 'xlsx';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

interface ParsedExcel {
  sheets: Array<{
    name: string;
    rows: Record<string, unknown>[];
  }>;
}

export class ExcelImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    // Handle base64 encoded binary
    const buffer = source.encoding === 'base64'
      ? Buffer.from(source.content, 'base64')
      : Buffer.from(source.content);

    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheets = workbook.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(workbook.Sheets[name]),
    }));

    return { sheets };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { sheets } = data as ParsedExcel;
    const nodes: CanonicalNode[] = [];
    const now = new Date().toISOString();

    for (const sheet of sheets) {
      for (let i = 0; i < sheet.rows.length; i++) {
        const row = sheet.rows[i];

        const node: CanonicalNode = {
          id: uuidv4(),
          sourceId: `${source.filename}:${sheet.name}:${i}`,
          source: 'excel-importer',
          nodeType: 'note',
          name: detectName(row) || `${sheet.name} Row ${i + 1}`,
          content: JSON.stringify(row, null, 2),
          summary: null,

          // LATCH mapping with intelligent column detection
          createdAt: detectDate(row, 'created') || now,
          modifiedAt: detectDate(row, 'modified') || now,
          dueAt: detectDate(row, 'due') || null,
          tags: detectTags(row) || [],
          folder: detectFolder(row) || sheet.name,
          priority: detectPriority(row) || 0,

          // ... rest of CanonicalNode fields
          properties: {
            sheetName: sheet.name,
            rowIndex: i,
            originalData: row,
          },
        };

        nodes.push(node);
      }
    }

    return nodes;
  }
}

function detectName(row: Record<string, unknown>): string | null {
  const nameKeys = ['name', 'title', 'task', 'subject', 'description'];
  for (const key of nameKeys) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

function detectTags(row: Record<string, unknown>): string[] {
  const tagKeys = ['tags', 'labels', 'categories'];
  for (const key of tagKeys) {
    const value = row[key];
    if (typeof value === 'string') {
      return value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
}
```

### CSV Import (Streaming Pattern)
```typescript
// Source: PapaParse documentation + streaming pattern
import Papa from 'papaparse';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

export class CsvImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(source.content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parse errors: ${JSON.stringify(results.errors)}`));
          } else {
            resolve(results.data);
          }
        },
        error: (err) => reject(err),
      });
    });
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const rows = data as Record<string, string>[];
    const now = new Date().toISOString();

    return rows.map((row, index) => ({
      id: uuidv4(),
      sourceId: `${source.filename}:row:${index}`,
      source: 'csv-importer',
      nodeType: 'note',
      name: detectName(row) || `Row ${index + 1}`,
      content: JSON.stringify(row, null, 2),
      summary: null,

      // LATCH mapping
      createdAt: row.created || row.date || now,
      modifiedAt: row.modified || now,
      tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
      folder: row.folder || row.category || null,
      priority: parseInt(row.priority || '0', 10),

      // ... rest of CanonicalNode fields
      properties: {
        rowIndex: index,
        columns: Object.keys(row),
      },
    }));
  }
}
```

### HTML Import (DOMParser Pattern)
```typescript
// Source: MDN DOMParser documentation
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

export class HtmlImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source.content, 'text/html');

    // Extract metadata
    const title = doc.querySelector('title')?.textContent || null;
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || null;

    // Extract main content
    const main = doc.querySelector('main') || doc.querySelector('article') || doc.body;

    return {
      title,
      description,
      html: main?.innerHTML || '',
      text: main?.textContent || '',
      doc,
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { title, description, html, text } = data as {
      title: string | null;
      description: string | null;
      html: string;
      text: string;
    };

    const now = new Date().toISOString();

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId: generateDeterministicSourceId(source.filename, { html }, 'html-importer'),
      source: 'html-importer',
      nodeType: 'note',
      name: title || 'Untitled HTML',
      content: html,
      summary: description || text.substring(0, 200),

      // LATCH mapping
      createdAt: now,
      modifiedAt: now,
      tags: [],
      folder: null,
      priority: 0,

      // ... rest of CanonicalNode fields
      properties: {
        originalFormat: 'html',
        wordCount: text.split(/\s+/).length,
      },
    };

    return [node];
  }
}
```

### Word (DOCX) Import
```typescript
// Source: mammoth.js documentation
import mammoth from 'mammoth';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

export class WordImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    // Convert base64 to buffer
    const buffer = source.encoding === 'base64'
      ? Buffer.from(source.content, 'base64')
      : Buffer.from(source.content);

    const result = await mammoth.convertToHtml({ buffer });

    return {
      html: result.value,
      messages: result.messages, // Warnings/errors
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { html, messages } = data as {
      html: string;
      messages: Array<{ type: string; message: string }>;
    };

    // Extract title from first heading
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1] : 'Untitled Document';

    const now = new Date().toISOString();

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId: generateDeterministicSourceId(source.filename, { html }, 'word-importer'),
      source: 'word-importer',
      nodeType: 'note',
      name: title,
      content: html,
      summary: null,

      // LATCH mapping
      createdAt: now,
      modifiedAt: now,
      tags: [],
      folder: null,
      priority: 0,

      // ... rest of CanonicalNode fields
      properties: {
        originalFormat: 'docx',
        conversionWarnings: messages.filter(m => m.type === 'warning'),
      },
    };

    return [node];
  }
}
```

### JSON Import (Native + Schema Detection)
```typescript
// Source: Native JSON.parse with intelligent schema detection
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

export class JsonImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    try {
      return JSON.parse(source.content);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const now = new Date().toISOString();

    // Array of objects → multiple nodes
    if (Array.isArray(data)) {
      return data.map((item, index) => this.objectToNode(item, index, now));
    }

    // Single object → one node
    if (typeof data === 'object' && data !== null) {
      return [this.objectToNode(data, 0, now)];
    }

    // Primitive → wrap in node
    return [{
      id: uuidv4(),
      sourceId: generateDeterministicSourceId(source.filename, { data }, 'json-importer'),
      source: 'json-importer',
      nodeType: 'note',
      name: String(data),
      content: JSON.stringify(data, null, 2),
      summary: null,
      createdAt: now,
      modifiedAt: now,
      // ... rest of CanonicalNode fields with defaults
    }];
  }

  private objectToNode(obj: unknown, index: number, now: string): CanonicalNode {
    const data = obj as Record<string, unknown>;

    return {
      id: uuidv4(),
      sourceId: `${source.filename}:${index}`,
      source: 'json-importer',
      nodeType: (data.type as string) || 'note',
      name: (data.name || data.title || data.id || `Item ${index + 1}`) as string,
      content: JSON.stringify(data, null, 2),
      summary: (data.summary || data.description) as string | null,

      // LATCH mapping with flexible key detection
      createdAt: (data.created || data.createdAt || data.date || now) as string,
      modifiedAt: (data.modified || data.modifiedAt || now) as string,
      tags: Array.isArray(data.tags) ? data.tags as string[] : [],
      folder: (data.folder || data.category) as string | null,
      priority: (data.priority as number) || 0,

      // ... rest of CanonicalNode fields
      properties: {
        originalKeys: Object.keys(data),
      },
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic importer | Format-specific importers with BaseImporter | Phase 68-69 (Feb 2026) | Easier to test, maintain, extend |
| Synchronous parsing | Async/await everywhere | Phase 68-69 | Browser compatibility, large file support |
| Custom parsers | Battle-tested libraries (xlsx, mammoth, papaparse) | Phase 69 | Robust edge case handling, years of bug fixes |
| Fixed column mappings | Intelligent field detection | Phase 69 | Works with diverse real-world data |
| One file = one node | Multi-node documents (Excel, CSV) | Phase 69 | Natural mapping for tabular data |
| Discard metadata | Store extended properties | Phase 69 | Preserve format-specific information |

**Deprecated/outdated:**
- Custom markdown parsers: Use marked or remark (CommonMark compliant)
- Regex-based CSV parsing: Use RFC 4180 compliant parser
- Synchronous xlsx parsing: Use async API or streaming for large files
- Format auto-detection: Phase 68 coordinator uses extension-based routing (simpler, faster)

## Open Questions

1. **Should importers split long documents into multiple nodes?**
   - What we know: Markdown with multiple H1 headers could be split, Excel rows naturally split
   - What's unclear: Whether splitting helps or hurts user experience, where to draw the line
   - Recommendation: Start with simple 1-to-1 or 1-to-many (rows), defer splitting complex documents to Phase 70 or user request

2. **How should we handle images embedded in Word/HTML?**
   - What we know: mammoth can extract images as base64, HTML img tags have src URLs
   - What's unclear: Whether to store images in database, link to external URLs, or strip them
   - Recommendation: Phase 69 stores image references in properties, actual image handling deferred to Phase 70+

3. **Should Excel formulas be evaluated or preserved?**
   - What we know: xlsx can evaluate formulas or return formula strings
   - What's unclear: Whether users want calculated values or original formulas
   - Recommendation: Store calculated values in content, preserve formulas in properties

4. **How to handle Excel with multiple sheets of different types?**
   - What we know: One workbook might have "Tasks" sheet and "Contacts" sheet
   - What's unclear: Whether to treat all rows uniformly or detect schema per sheet
   - Recommendation: Phase 69 treats all rows uniformly, store sheet name in folder field for filtering

5. **Should CSV/Excel headers influence LATCH mapping?**
   - What we know: Column named "Due Date" clearly maps to dueAt field
   - What's unclear: How aggressive to be with fuzzy matching, when to give up
   - Recommendation: Implement fuzzy column matching with fallback to properties storage

## Sources

### Primary (HIGH confidence)
- [xlsx - SheetJS](https://www.npmjs.com/package/xlsx) - Official npm package, 60M+ weekly downloads
- [SheetJS Documentation](https://docs.sheetjs.com/docs/api/parse-options/) - Official parsing API docs
- [mammoth - npm](https://www.npmjs.com/package/mammoth) - Official npm package, DOCX→HTML converter
- [GitHub - mwilliamson/mammoth.js](https://github.com/mwilliamson/mammoth.js) - Official repository
- [Papa Parse](https://www.papaparse.com/) - Official website
- [papaparse - npm](https://www.npmjs.com/package/papaparse) - Official npm package
- [Papa Parse Documentation](https://www.papaparse.com/docs) - Official API docs
- [marked - npm](https://www.npmjs.com/package/marked) - Official npm package
- [Marked Documentation](https://marked.js.org/) - Official website
- [gray-matter - npm](https://www.npmjs.com/package/gray-matter) - Official npm package
- [GitHub - jonschlinkert/gray-matter](https://github.com/jonschlinkert/gray-matter) - Official repository
- [DOMParser - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) - Web standard documentation
- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/etl/alto-importer.ts` - Proven import pattern
- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/etl/importers/BaseImporter.ts` - Phase 68 foundation
- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/etl/types/canonical.ts` - CanonicalNode schema

### Secondary (MEDIUM confidence)
- [Parsing CSV Files in TypeScript with Papa Parse](https://typescript.tv/hands-on/parsing-csv-files-in-typescript-with-papa-parse/) - TypeScript integration tutorial
- [Using Papaparse with Typescript](https://fireflysemantics.medium.com/using-papaparse-with-typescript-b8dea81bf602) - Medium tutorial
- [Read Excel file in Node.js and Typescript](https://blog.tericcabrel.com/read-excel-file-nodejs-typescript/) - TypeScript examples
- [Mammoth Guide: Convert Word documents](https://generalistprogrammer.com/tutorials/mammoth-npm-package-guide) - Usage guide
- [Marked: Complete Guide](https://generalistprogrammer.com/tutorials/marked-npm-package-guide) - Usage guide

### Tertiary (LOW confidence)
None - All findings verified with official documentation or existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are industry standards with 1M+ weekly downloads, TypeScript support verified
- Architecture: HIGH - BaseImporter pattern exists (Phase 68), alto-importer.ts provides proven template
- Pitfalls: HIGH - Based on existing code review, library documentation, and common file parsing mistakes
- LATCH mapping: MEDIUM - Intelligent field detection requires heuristics, needs testing with real-world data

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - parsing libraries are stable, format specs don't change)

**Key dependencies:**
- Phase 68 must be complete (BaseImporter + ImportCoordinator)
- CanonicalNode schema from Phase 67 must be stable
- No breaking changes to LATCH field mappings during Phase 69

**Estimated effort per importer:**
- Markdown (IMP-01): 4-6 hours (simple, pattern exists in alto-importer)
- JSON (IMP-04): 3-4 hours (native parsing, schema detection)
- CSV (IMP-06): 4-6 hours (streaming, column detection)
- HTML (IMP-05): 5-7 hours (DOMParser, semantic extraction)
- Word (IMP-03): 5-7 hours (binary format, encoding handling)
- Excel (IMP-02): 8-10 hours (complex format, multi-sheet, formulas)

**Total estimated effort:** 29-40 hours (4-5 days) with TDD and comprehensive tests.
