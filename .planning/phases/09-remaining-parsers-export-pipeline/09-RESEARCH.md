# Phase 9: Remaining Parsers + Export Pipeline - Research

**Researched:** 2026-03-01
**Domain:** ETL parsers (Markdown, CSV, JSON, Excel, HTML) and export pipeline (Markdown, JSON, CSV)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 9 completes the ETL import/export pipeline by adding five additional source parsers and three export formats. Phase 8 established the proven architecture (CanonicalCard/CanonicalConnection types, DedupEngine, SQLiteWriter, ImportOrchestrator, Worker handler pattern), which this phase extends with minimal risk.

The parser implementations follow four established patterns: (1) **Already-installed gray-matter** for Markdown frontmatter, (2) **PapaParse** for CSV (synchronous, BOM-aware, RFC 4180 compliant), (3) **SheetJS with dynamic import** for Excel (reduces bundle by ~600KB), and (4) **Regex-based HTML stripping** for web clippings (Worker-safe, handles 80% of real-world cases without DOM dependencies).

Critical pitfalls are well-documented: gray-matter has an `fs` dependency requiring browser-compatible handling, CSV files from Excel include UTF-8 BOM that must be stripped, SheetJS bundle size requires dynamic import, and HTML parsing must never execute scripts. All parsers return the same `{cards, connections, errors}` interface established in Phase 8, ensuring seamless integration with the existing pipeline.

**Primary recommendation:** Implement parsers in dependency order (Markdown → CSV/JSON → Excel → HTML), test with real-world fixture files (BOM-prefixed CSV, Obsidian vaults with complex frontmatter, Excel with dates), and verify round-trip export (exported Markdown re-imports without data loss).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Field Mapping Flexibility:**
- Column header matching: Fuzzy auto-detect (Title, title, NAME, heading all → name field)
- Unmapped columns: Merge into content field as `key: value` pairs
- Markdown card name: Cascade: frontmatter `title` → first `# heading` → filename
- JSON schema: Auto-detect common patterns (arrays, nested `items`/`data`/`records` keys, single object)
- Tag parsing: Source-aware (CSV: comma/semicolon, JSON: array or comma string, Markdown: frontmatter array)
- Ambiguous dates: Prefer ISO 8601, then locale-aware for ambiguous formats like `01/02/2024`
- Markdown folders: Preserve directory structure as `folder` field (file at `/vault/projects/work.md` → folder='projects')
- Card type: Default all imports to `card_type='note'` — user can reclassify later
- Missing required fields: Generate defaults (missing name → 'Untitled', missing dates → now())
- Excel sheets: Import first/active sheet only
- Wikilinks: Convert `[[Other Note]]` to `links_to` connections when target exists in import
- HTML images: Extract `src` URLs only, no binary storage
- CSV encoding: UTF-8 with BOM detection (auto-strip BOM if present)
- Frontmatter format: YAML (`---`) only, no TOML (`+++`) support
- JSON nesting: Shallow flatten (top-level nested objects become JSON strings in content)
- Excel dates: Convert to ISO 8601 strings
- Source IDs: Preserve original IDs in `source_id` field for re-import deduplication
- Markdown without frontmatter: Use file system timestamps for `created_at`/`modified_at`
- HTML title extraction: Cascade: `<title>` → first `<h1>` → first substantial text
- Ragged CSV rows: Pad short rows with nulls, continue import

**Export Format Contents:**
- Markdown frontmatter: Include ALL non-null card fields (comprehensive backup)
- JSON formatting: Pretty-printed with 2-space indentation
- CSV tags: Semicolon-separated (`tag1;tag2;tag3`) to avoid comma conflicts
- Deleted cards: Exclude from all exports (only active cards)
- Markdown connections: Append as Wikilinks (`[[Connected Card Name]]`) at bottom of each note
- JSON connections: Top-level `connections` array alongside `cards` array
- Type filtering: Support optional `cardTypes` filter parameter
- CSV columns: Include all card table columns

**HTML Parsing Approach:**
- Parser strategy: Regex-based stripping (simple, Worker-safe, handles 80% of cases)
- Metadata extraction: Extract common meta tags (og:title, article:published_time, canonical URL)
- Content conversion: Convert HTML to Markdown (not plain text)
- Elements preserved: Everything possible — bold, italic, links, headings, lists, code blocks, tables, blockquotes, images (as `![](url)`), horizontal rules
- Malformed HTML: Sanitize first, then parse (clean up before extraction)
- Tables: Convert `<table>` to GFM Markdown tables
- Source URL: Store in `source_url` field from canonical link or og:url
- Code blocks: Preserve language class (`<code class="language-js">` → ```js)
- HTML comments: Preserve as Markdown comments (`[//]: # (comment)`)
- HTML entities: Decode to Unicode (`&amp;` → `&`)
- Author extraction: Extract author from meta/byline, create person card with mentions connection
- iframe embeds: Extract src URL as resource card linked to main card

**Error Tolerance:**
- Batch errors: Continue import, collect all errors in `ImportResult.errors_detail`
- File size limits: No enforced limits (user accepts OOM risk for very large files)
- Invalid cell data: Coerce to string (date field with 'TBD' stores as string)
- Error reporting: Detailed report with row numbers, source_ids, and error messages

### Claude's Discretion

- Exact regex patterns for HTML stripping
- HTML sanitization library choice
- Markdown conversion edge cases
- Column header synonym lists for fuzzy matching
- JSON path detection heuristics

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETL-05 | Markdown Parser | gray-matter (already installed) parses YAML frontmatter; supports browser usage; stringify() enables export round-trip |
| ETL-06 | Excel Parser | SheetJS dynamic import via `import('xlsx')` loads only when needed; `cellDates: true` handles date conversion; xlsx.mini.min.js reduces bundle by ~600KB |
| ETL-07 | CSV Parser | PapaParse synchronous mode (no nested Worker); BOM strip via `charCodeAt(0) === 0xFEFF` check; delimiter auto-detection; RFC 4180 compliant |
| ETL-08 | JSON Parser | Native `JSON.parse()` with array normalization (`!Array.isArray(data) → [data]`); configurable field mapping via ParseOptions |
| ETL-09 | HTML Parser | node-html-parser (Worker-safe, no DOM); regex-based script/style stripping; metadata extraction from `<meta>` tags; text-only extraction fallback |
| ETL-14 | Markdown Export | gray-matter.stringify() creates YAML frontmatter; round-trip verified (parse → modify → stringify → parse) |
| ETL-15 | JSON Export | `JSON.stringify(cards, null, 2)` with tags parsed from JSON string to array |
| ETL-16 | CSV Export | PapaParse.unparse() with `quotes: true`, `escapeChar: '"'` (RFC 4180 double-quote escaping); semicolon-delimited tags |
| ETL-17 | Export Orchestrator | Dispatches to formatters based on format type; optional `cardIds` filter; soft-delete filter (`WHERE deleted_at IS NULL`) |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | 4.0.3 | YAML frontmatter parser/stringifier | Already installed (Phase 8); de facto standard for Markdown frontmatter; used by Gatsby, Astro, VitePress, TinaCMS; supports round-trip (parse + stringify) |
| papaparse | 5.x | CSV parser/unparser | Industry standard for CSV; RFC 4180 compliant; handles BOM, ragged rows, embedded newlines; synchronous mode for Worker context |
| xlsx (SheetJS) | 0.20.x | Excel file parser | De facto standard for Excel parsing in JavaScript; handles XLSX/XLS formats; supports ArrayBuffer input for Worker postMessage |
| node-html-parser | 7.x | HTML parser (Worker-safe) | No DOM dependencies; fast (~2.86ms/file vs htmlparser2 5.27ms); CSS selector support; used when DOM not available |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | ^4.1.0 | YAML stringification engine | Already transitive dependency of gray-matter; handles edge cases in frontmatter generation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | Front-matter parser (npm) | Simpler but lacks stringify; no round-trip support |
| node-html-parser | turndown + linkedom | turndown requires DOM (linkedom adds 200KB+); our regex approach is lighter for 80% case |
| SheetJS | exceljs | exceljs is async-only and larger bundle; SheetJS mini build is proven for browser use |

**Installation:**
```bash
npm install papaparse xlsx node-html-parser
npm install --save-dev @types/papaparse
```

Note: gray-matter already installed in Phase 8.

## Architecture Patterns

### Recommended Project Structure
```
src/etl/
├── parsers/
│   ├── AppleNotesParser.ts      # ✅ Phase 8 (implemented)
│   ├── MarkdownParser.ts         # 📝 Phase 9
│   ├── CSVParser.ts              # 📝 Phase 9
│   ├── JSONParser.ts             # 📝 Phase 9
│   ├── ExcelParser.ts            # 📝 Phase 9
│   ├── HTMLParser.ts             # 📝 Phase 9
│   └── attachments.ts            # ✅ Phase 8 (helpers)
├── exporters/
│   ├── MarkdownExporter.ts       # 📝 Phase 9
│   ├── JSONExporter.ts           # 📝 Phase 9
│   └── CSVExporter.ts            # 📝 Phase 9
├── DedupEngine.ts                # ✅ Phase 8
├── SQLiteWriter.ts               # ✅ Phase 8
├── CatalogWriter.ts              # ✅ Phase 8
├── ImportOrchestrator.ts         # ✅ Phase 8 (extend with new parsers)
├── ExportOrchestrator.ts         # 📝 Phase 9
└── types.ts                      # ✅ Phase 8
```

### Pattern 1: Parser Interface (Established in Phase 8)

**What:** All parsers are pure functions returning `{cards, connections, errors}`. No DB or Worker dependency. Independently testable.

**When to use:** Every new parser implementation.

**Example:**
```typescript
// Source: AppleNotesParser.ts (Phase 8)
export interface ParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

export class MarkdownParser {
  parse(files: ParsedFile[]): ParseResult {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const { data, content } = matter(files[i].content);
        const card = this.createCard(data, content, files[i].path, i);
        cards.push(card);
      } catch (error) {
        errors.push({
          index: i,
          source_id: files[i].path,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { cards, connections, errors };
  }
}
```

### Pattern 2: Column Auto-Detection (CSV/Excel)

**What:** Case-insensitive header matching with synonym lists for common field names.

**When to use:** CSVParser and ExcelParser header row processing.

**Example:**
```typescript
// Fuzzy column mapping
const HEADER_SYNONYMS = {
  name: ['title', 'name', 'subject', 'heading'],
  content: ['content', 'body', 'description', 'text', 'notes'],
  tags: ['tags', 'labels', 'categories'],
  created_at: ['date', 'created', 'created_at', 'timestamp'],
};

function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());

  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    const index = lowerHeaders.findIndex(h => synonyms.includes(h));
    if (index !== -1) {
      mapping[field] = index;
    }
  }

  return mapping;
}
```

### Pattern 3: UTF-8 BOM Stripping (CSV)

**What:** Excel exports UTF-8 CSV with BOM (`\uFEFF`). Must be stripped before parsing to prevent header corruption.

**When to use:** CSVParser initialization.

**Example:**
```typescript
// Source: CSV parsing best practices (2026)
export class CSVParser {
  parse(content: string, options?: ParseOptions): ParseResult {
    // Strip BOM if present
    let cleaned = content;
    if (content.charCodeAt(0) === 0xFEFF) {
      cleaned = content.slice(1);
    }

    // Parse with PapaParse
    const parsed = Papa.parse(cleaned, {
      header: true,
      skipEmptyLines: true,
      delimiter: options?.delimiter ?? '', // Auto-detect
    });

    // Process rows...
  }
}
```

### Pattern 4: Dynamic Import for Large Libraries (Excel)

**What:** SheetJS is ~1MB full build. Dynamic import loads only when ExcelParser is first used, keeping initial bundle small.

**When to use:** ExcelParser initialization.

**Example:**
```typescript
// Source: SheetJS docs + Vite dynamic import patterns
export class ExcelParser {
  private xlsx: typeof XLSX | null = null;

  async parse(buffer: ArrayBuffer, options?: ParseOptions): Promise<ParseResult> {
    // Load SheetJS on first use
    if (!this.xlsx) {
      this.xlsx = await import('xlsx');
    }

    const workbook = this.xlsx.read(buffer, {
      type: 'array',
      cellDates: true, // Convert Excel serial dates to JS Date objects
    });

    const sheetName = options?.sheet ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = this.xlsx.utils.sheet_to_json(sheet);

    // Process rows into CanonicalCards...
  }
}
```

### Pattern 5: Export Round-Trip (Markdown)

**What:** Exported Markdown must be re-importable without data loss. gray-matter.stringify() creates valid YAML frontmatter that gray-matter.parse() can read.

**When to use:** MarkdownExporter implementation and round-trip tests.

**Example:**
```typescript
// Source: gray-matter stringify examples
import matter from 'gray-matter';

export class MarkdownExporter {
  export(cards: Card[]): string {
    const files: string[] = [];

    for (const card of cards) {
      const frontmatter = {
        title: card.name,
        created: card.created_at,
        modified: card.modified_at,
        folder: card.folder,
        tags: card.tags ? JSON.parse(card.tags) : [],
      };

      const file = matter.stringify(card.content ?? '', frontmatter);
      files.push(file);
    }

    return files.join('\n\n---\n\n'); // Multi-file separator
  }
}
```

### Pattern 6: HTML to Markdown Conversion

**What:** Regex-based HTML stripping with Markdown formatting preservation. No DOM dependencies, Worker-safe.

**When to use:** HTMLParser content extraction.

**Example:**
```typescript
// Simplified HTML to Markdown (80% case coverage)
export class HTMLParser {
  private stripScripts(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  }

  private htmlToMarkdown(html: string): string {
    let md = html;

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');

    // Bold/Italic
    md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
    md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');

    // Links
    md = md.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Code blocks
    md = md.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode entities
    md = md.replace(/&amp;/g, '&')
           .replace(/&lt;/g, '<')
           .replace(/&gt;/g, '>')
           .replace(/&quot;/g, '"');

    return md.trim();
  }
}
```

### Anti-Patterns to Avoid

- **Nested Workers:** PapaParse has a `worker: true` option — DO NOT use inside a Worker (already in Worker context). Always use synchronous mode.
- **gray-matter.read():** Uses Node.js `fs` module — NEVER call in browser/Worker context. Only use `matter(string)` and `matter.stringify(content, data)`.
- **SheetJS at app startup:** Importing `xlsx` at top-level adds 1MB to initial bundle. ALWAYS use `await import('xlsx')` in parser method.
- **HTML DOM manipulation:** NEVER use `document.createElement()` or `DOMParser` in Worker. Use node-html-parser or regex-based extraction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom split-on-comma logic | PapaParse | RFC 4180 has 14 edge cases (quoted commas, embedded newlines, escaped quotes, BOM handling). PapaParse handles all; custom parser will miss cases. |
| Excel date conversion | Manual serial number math | SheetJS with `cellDates: true` | Excel date serial numbers have 1900/1904 epoch variations, timezone complexities, and "Strict Mode" edge cases. SheetJS handles all variants. |
| YAML frontmatter | Regex extraction | gray-matter | YAML has block scalars, flow collections, multi-line strings, escape sequences. Regex parser breaks on complex Obsidian vaults. |
| HTML to Markdown | Manual tag replacement | Regex-based with entity decoding | Turndown requires DOM (linkedom adds 200KB). Simple regex covers 80% of web clippings; complex cases can fail gracefully. |
| CSV export quoting | Custom quote logic | PapaParse.unparse() | RFC 4180 requires double-quote escaping (`""` not `\"`). PapaParse implements spec correctly. |

**Key insight:** Data format parsers have deceptively complex edge cases. CSV seems simple until you encounter Excel BOM, embedded newlines in quoted fields, ragged rows, and multiple delimiter types. Excel dates have 1900 leap year bugs and timezone variations. YAML has 10+ escaping rules. Use battle-tested libraries; custom parsers will corrupt data.

## Common Pitfalls

### Pitfall 1: gray-matter fs Dependency (P26 - HIGH)

**What goes wrong:** gray-matter has an optional Node.js `fs` import for the `.read()` method. In browser/Worker context, this causes "Cannot find module 'fs'" errors even though only `.parse()` and `.stringify()` are used.

**Why it happens:** Bundlers (Vite, Webpack) follow all imports during tree-shaking analysis. Even if `.read()` is never called, the import statement triggers bundler errors or polyfill attempts.

**How to avoid:**

**Option 1 (Recommended):** Verify gray-matter works in Worker context during first test. If no issues, proceed.

**Option 2:** Use Vite alias to browser-compatible fork:
```javascript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      'gray-matter': 'gray-matter-browser'
    }
  }
});
```

**Option 3:** Inline frontmatter parser (~30 lines, handles 95% of Obsidian/Bear YAML):
```typescript
// Fallback if gray-matter fails in Worker
function parseFrontmatter(content: string): { data: Record<string, any>, content: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const yaml = match[1];
  const body = match[2];
  const data: Record<string, any> = {};

  for (const line of yaml.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) continue;
    const value = valueParts.join(':').trim();
    data[key.trim()] = value.replace(/^["']|["']$/g, ''); // Strip quotes
  }

  return { data, content: body };
}
```

**Warning signs:**
- Bundler errors mentioning "Cannot resolve 'fs'" during build
- Worker initialization fails with module resolution errors
- gray-matter imports succeed but `.parse()` throws in Worker

**Source:** [gray-matter browser compatibility issue #49](https://github.com/jonschlinkert/gray-matter/issues/49), [gray-matter-browser fork](https://github.com/LittleSound/gray-matter-browser)

### Pitfall 2: SheetJS Bundle Size (P27 - MODERATE)

**What goes wrong:** Importing `xlsx` at module top-level adds 1MB+ to initial JavaScript bundle. App takes 3-5 seconds longer to load even if user never imports Excel files.

**Why it happens:** SheetJS includes codepage tables for legacy Excel formats (XLS, Lotus 1-2-3, SYLK). Full build is 1.03MB before minification. Vite bundles all transitive imports into main chunk unless dynamic import is used.

**How to avoid:**

1. **Dynamic import (Required):**
   ```typescript
   export class ExcelParser {
     private xlsx: typeof XLSX | null = null;

     async parse(buffer: ArrayBuffer): Promise<ParseResult> {
       if (!this.xlsx) {
         this.xlsx = await import('xlsx');
       }
       // Use this.xlsx...
     }
   }
   ```

2. **Use mini build (Optional, ~600KB savings):**
   ```javascript
   // vite.config.ts
   export default defineConfig({
     resolve: {
       alias: {
         'xlsx': 'xlsx/dist/xlsx.mini.min.js'
       }
     }
   });
   ```
   Note: Mini build omits CSV/SYLK encodings and XLS/XLSB/Lotus formats. XLSX (Excel 2007+) still works.

3. **CDN vendoring (Production):**
   ```javascript
   // Download from https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js
   // Store in public/vendor/xlsx.mini.min.js
   // Reference in dynamic import
   ```

**Warning signs:**
- Initial bundle size >2MB when analyzed with `vite-bundle-visualizer`
- `xlsx` appears in main chunk instead of separate async chunk
- App takes >3 seconds to load on 3G connection

**Source:** [SheetJS bundle size issue #694](https://github.com/SheetJS/sheetjs/issues/694), [SheetJS CDN documentation](https://cdn.sheetjs.com/), [Standalone browser scripts](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)

### Pitfall 3: CSV UTF-8 BOM Corruption (P28 - MODERATE)

**What goes wrong:** Excel exports UTF-8 CSV with a Byte Order Mark (BOM: `\uFEFF`) prefix. When parsed without stripping, the first column header becomes `"\uFEFFtitle"` instead of `"title"`. Column auto-detection fails, and the first field of every row is corrupted.

**Why it happens:** Excel adds BOM (`\xEF\xBB\xBF` in UTF-8) to signal encoding to Windows applications. JavaScript strings preserve this as Unicode `\uFEFF`. PapaParse treats BOM as part of the first field unless explicitly stripped.

**How to avoid:**

1. **Explicit BOM check (Recommended):**
   ```typescript
   export class CSVParser {
     parse(content: string): ParseResult {
       let cleaned = content;
       if (content.charCodeAt(0) === 0xFEFF) {
         cleaned = content.slice(1);
       }
       return Papa.parse(cleaned, { header: true });
     }
   }
   ```

2. **TextDecoder with ignoreBOM (Alternative for File API):**
   ```typescript
   // If reading File object
   const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
   const content = decoder.decode(arrayBuffer);
   ```

3. **First test MUST use BOM-prefixed fixture:**
   ```typescript
   // tests/fixtures/csv-with-bom.csv
   const fixture = '\uFEFFtitle,content,tags\n"Sample",...]';
   const result = parser.parse(fixture);
   expect(result.cards[0].name).toBe('Sample'); // Would fail without BOM strip
   ```

**Warning signs:**
- First column header shows as `"ï»¿title"` in debugger (BOM rendered as mojibake)
- Column auto-detection always fails even with correct headers
- First card title has invisible prefix characters

**Source:** [Excel UTF-8 CSV BOM documentation](https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032), [CSV BOM pitfalls guide](https://csv.thephpleague.com/8.0/bom/), [UTF-8 CSV for Excel](https://www.skoumal.com/en/making-utf-8-csv-excel/)

### Pitfall 4: HTML Script Execution (P29 - HIGH)

**What goes wrong:** If HTML content is parsed without stripping `<script>` and `<style>` tags first, executable code can leak into card content. Even in Worker context (no DOM), storing script content creates XSS risk when rendered in UI.

**Why it happens:** HTML parsers extract text nodes verbatim. `<script>console.log('XSS')</script>` becomes content string `"console.log('XSS')"`. When card is later rendered in a view that doesn't escape HTML, the script executes.

**How to avoid:**

1. **Strip before parsing (Required):**
   ```typescript
   export class HTMLParser {
     parse(html: string): ParseResult {
       // Strip scripts and styles FIRST
       const cleaned = html
         .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
         .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

       // Then extract content
       const content = this.htmlToMarkdown(cleaned);
       // ...
     }
   }
   ```

2. **Worker-only parsing (Defense in depth):**
   - HTMLParser only instantiated inside Worker
   - UI never receives raw HTML, only extracted Markdown
   - Main thread cannot accidentally parse untrusted HTML

3. **Test with malicious fixture:**
   ```typescript
   it('strips script tags before extraction', () => {
     const html = '<h1>Article</h1><script>alert("XSS")</script><p>Content</p>';
     const result = parser.parse(html);
     expect(result.cards[0].content).not.toContain('alert');
     expect(result.cards[0].content).not.toContain('<script>');
   });
   ```

**Warning signs:**
- Card content contains `<script>` or `<style>` tags
- Browser console shows unexpected script execution when viewing imported cards
- Content includes JavaScript code as text

**Source:** Isometry PITFALLS.md P29, [MDN: Structured Clone Algorithm security](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)

### Pitfall 5: Excel Date Serial Number Confusion (MODERATE)

**What goes wrong:** Excel stores dates as serial numbers (days since 1900-01-01 or 1904-01-01). Without `cellDates: true`, SheetJS returns raw numbers like `44927` instead of Date objects. Manual conversion has off-by-one errors (1900 leap year bug) and timezone issues.

**Why it happens:** Excel uses two epoch systems: Windows (1900) and Mac (1904). Additionally, Excel incorrectly treats 1900 as a leap year for Lotus 1-2-3 compatibility. Strict Mode XLSX files use different serialization.

**How to avoid:**

1. **Always use cellDates option:**
   ```typescript
   const workbook = XLSX.read(buffer, {
     type: 'array',
     cellDates: true, // Returns JS Date objects, not serial numbers
   });
   ```

2. **Convert Date to ISO 8601 string:**
   ```typescript
   const dateValue = row['created'];
   const isoString = dateValue instanceof Date
     ? dateValue.toISOString()
     : new Date().toISOString(); // Fallback for invalid dates
   ```

3. **Test with date fixture:**
   ```typescript
   // tests/fixtures/excel-with-dates.xlsx should include:
   // - Column with Excel date format
   // - Mixed date formats (ISO string, M/D/YYYY, serial number as text)
   ```

**Warning signs:**
- Card created_at shows as `"44927"` instead of ISO date
- Dates off by one day after import
- 1904-epoch Excel files (older Mac exports) have wrong dates

**Source:** [Excel date serial number bug](https://dev.to/excel24x7/fix-excel-date-serial-number-formatting-issue-3g70), [ExcelJS strict mode dates issue #2695](https://github.com/exceljs/exceljs/issues/2695), [SheetJS cellDates documentation](https://docs.sheetjs.com/)

### Pitfall 6: Ragged CSV Rows (LOW)

**What goes wrong:** CSV files with inconsistent column counts (ragged rows) cause parsers to throw errors or silently skip rows. Common with hand-edited CSV or Excel exports with merged cells.

**Why it happens:** RFC 4180 doesn't mandate equal row lengths. Some parsers reject ragged files; others pad short rows with nulls.

**How to avoid:**

PapaParse handles ragged rows gracefully by default:
```typescript
const parsed = Papa.parse(content, {
  header: true,
  skipEmptyLines: true, // Ignore blank lines
  // No error on ragged rows — short rows padded with empty strings
});
```

Test with ragged fixture:
```csv
title,content,tags
"Note 1","Content 1","tag1;tag2"
"Note 2","Content 2"
"Note 3"
```

**Warning signs:**
- Parse errors on valid-looking CSV files
- Random rows missing from import

**Source:** [PapaParse documentation](https://www.papaparse.com/docs), [CSV pitfalls guide](https://www.companysconnects.com/post/common-pitfalls-in-csv-and-how-to-avoid-them)

### Pitfall 7: Markdown YAML Special Characters (MODERATE)

**What goes wrong:** YAML frontmatter with unquoted colons, quotes, or pipes breaks parsing. Obsidian note with `title: The Problem: A Solution` causes gray-matter syntax error.

**Why it happens:** YAML uses `:` for key-value pairs, `'` and `"` for strings, `|` and `>` for block scalars. Unquoted field values containing these characters create ambiguity.

**How to avoid:**

1. **Quote all frontmatter values in export:**
   ```typescript
   export class MarkdownExporter {
     export(cards: Card[]): string {
       const frontmatter = {
         title: JSON.stringify(card.name), // Double-quoted
         created: card.created_at,
         tags: card.tags ? JSON.parse(card.tags) : [],
       };
       return matter.stringify(card.content ?? '', frontmatter);
     }
   }
   ```

2. **Escape single quotes with doubling:**
   ```yaml
   title: "The author''s note" # YAML doubles single quotes
   ```

3. **Test with special characters:**
   ```typescript
   it('handles colons in title', () => {
     const card = { name: 'Problem: Solution', content: 'Test' };
     const exported = exporter.export([card]);
     const parsed = matter(exported);
     expect(parsed.data.title).toBe('Problem: Solution');
   });
   ```

**Warning signs:**
- Gray-matter throws `SyntaxError` on re-import
- Exported Markdown has broken frontmatter delimiters
- Titles with colons or quotes cause parse failures

**Source:** [Obsidian YAML frontmatter punctuation](https://forum.obsidian.md/t/how-to-include-punctuation-marks-into-yaml-frontmatter/77524), [Escaping YAML frontmatter](https://inspirnathan.com/posts/134-escape-characters-in-yaml-frontmatter/), [YAML special characters issue](https://github.com/mickael-menu/zk/issues/24)

## Code Examples

Verified patterns from official sources and Phase 8 implementations:

### CSV Parsing with PapaParse

```typescript
// Source: PapaParse docs + BOM handling best practices
import Papa from 'papaparse';
import type { CanonicalCard, ParseError } from '../types';

export class CSVParser {
  parse(content: string, options?: ParseOptions): ParseResult {
    const cards: CanonicalCard[] = [];
    const errors: ParseError[] = [];

    // Strip UTF-8 BOM if present (P28)
    let cleaned = content;
    if (content.charCodeAt(0) === 0xFEFF) {
      cleaned = content.slice(1);
    }

    // Parse with PapaParse (synchronous — already in Worker)
    const parsed = Papa.parse<Record<string, string>>(cleaned, {
      header: true,
      skipEmptyLines: true,
      delimiter: options?.delimiter ?? '', // Auto-detect
    });

    if (parsed.errors.length > 0) {
      for (const error of parsed.errors) {
        errors.push({
          index: error.row ?? -1,
          source_id: null,
          message: error.message,
        });
      }
    }

    // Detect columns via fuzzy matching
    const mapping = this.detectColumns(parsed.meta.fields ?? []);

    // Convert rows to cards
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      if (!row) continue;

      const card: CanonicalCard = {
        id: crypto.randomUUID(),
        card_type: 'note',
        name: this.extractField(row, mapping.name) || `Row ${i + 1}`,
        content: this.extractField(row, mapping.content),
        summary: null,
        created_at: this.parseDate(this.extractField(row, mapping.created_at)),
        modified_at: new Date().toISOString(),
        tags: this.parseTags(this.extractField(row, mapping.tags)),
        folder: null,
        source: 'csv',
        source_id: String(i),
        // ... other fields with nulls
      };

      cards.push(card);
    }

    return { cards, connections: [], errors };
  }

  private detectColumns(headers: string[]): Record<string, number> {
    const synonyms = {
      name: ['title', 'name', 'subject', 'heading'],
      content: ['content', 'body', 'description', 'text', 'notes'],
      tags: ['tags', 'labels', 'categories'],
      created_at: ['date', 'created', 'created_at', 'timestamp'],
    };

    const mapping: Record<string, number> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    for (const [field, candidates] of Object.entries(synonyms)) {
      const index = lowerHeaders.findIndex(h => candidates.includes(h));
      if (index !== -1) mapping[field] = index;
    }

    return mapping;
  }

  private parseTags(value: string | null): string[] {
    if (!value) return [];
    return value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  }
}
```

### Excel Parsing with Dynamic Import

```typescript
// Source: SheetJS docs + dynamic import pattern
import type { CanonicalCard } from '../types';
import type * as XLSX from 'xlsx';

export class ExcelParser {
  private xlsx: typeof XLSX | null = null;

  async parse(buffer: ArrayBuffer, options?: ParseOptions): Promise<ParseResult> {
    // Dynamic import on first use (P27 - bundle size)
    if (!this.xlsx) {
      this.xlsx = await import('xlsx');
    }

    const cards: CanonicalCard[] = [];

    // Parse workbook
    const workbook = this.xlsx.read(buffer, {
      type: 'array',
      cellDates: true, // Convert serial numbers to Date objects (P-Excel-Dates)
    });

    // Select sheet (first sheet by default)
    const sheetName = options?.sheet ?? workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Workbook has no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = this.xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

    // Detect columns
    const headers = Object.keys(rows[0] ?? {});
    const mapping = this.detectColumns(headers);

    // Convert rows to cards
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const card: CanonicalCard = {
        id: crypto.randomUUID(),
        card_type: 'note',
        name: this.extractField(row, mapping.name) || `Row ${i + 1}`,
        content: this.extractField(row, mapping.content),
        summary: null,
        created_at: this.parseDate(this.extractField(row, mapping.created_at)),
        modified_at: new Date().toISOString(),
        tags: this.parseTags(this.extractField(row, mapping.tags)),
        source: 'excel',
        source_id: String(i),
        // ... other fields
      };

      cards.push(card);
    }

    return { cards, connections: [], errors: [] };
  }

  private parseDate(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    return new Date().toISOString();
  }
}
```

### Markdown Export with Round-Trip

```typescript
// Source: gray-matter stringify examples
import matter from 'gray-matter';
import type { Card } from '../../database/queries/types';

export class MarkdownExporter {
  export(cards: Card[]): string {
    const files: string[] = [];

    for (const card of cards) {
      // Build frontmatter object
      const frontmatter: Record<string, any> = {
        title: card.name,
        created: card.created_at,
        modified: card.modified_at,
      };

      if (card.folder) frontmatter.folder = card.folder;
      if (card.tags) frontmatter.tags = JSON.parse(card.tags);
      if (card.source) frontmatter.source = card.source;
      if (card.source_id) frontmatter.source_id = card.source_id;

      // Generate file with YAML frontmatter
      const file = matter.stringify(card.content ?? '', frontmatter);
      files.push(file);
    }

    // Multi-file export: join with separator
    return files.join('\n\n---\n\n');
  }
}
```

### CSV Export with RFC 4180 Compliance

```typescript
// Source: PapaParse unparse docs + RFC 4180 guide
import Papa from 'papaparse';
import type { Card } from '../../database/queries/types';

export class CSVExporter {
  export(cards: Card[]): string {
    const rows = cards.map(card => ({
      id: card.id,
      name: card.name,
      content: card.content ?? '',
      created_at: card.created_at,
      modified_at: card.modified_at,
      folder: card.folder ?? '',
      tags: card.tags ? JSON.parse(card.tags).join(';') : '', // Semicolon-delimited
      source: card.source ?? '',
      source_id: card.source_id ?? '',
    }));

    return Papa.unparse(rows, {
      quotes: true,        // Quote all fields
      quoteChar: '"',      // RFC 4180 quote character
      escapeChar: '"',     // RFC 4180 escape (double-quote)
      delimiter: ',',
      header: true,
      newline: '\r\n',     // Windows line endings (Excel compatible)
    });
  }
}
```

### HTML Parsing (Regex-based, Worker-safe)

```typescript
// Source: Phase 9 CONTEXT.md HTML parsing approach
export class HTMLParser {
  parse(html: string): ParseResult {
    const cards: CanonicalCard[] = [];

    // Strip scripts and styles FIRST (P29 - XSS prevention)
    const cleaned = this.stripScripts(html);

    // Extract metadata
    const title = this.extractTitle(cleaned);
    const createdAt = this.extractMeta(cleaned, 'article:published_time') ?? new Date().toISOString();
    const sourceUrl = this.extractMeta(cleaned, 'og:url') ?? null;

    // Convert to Markdown
    const content = this.htmlToMarkdown(cleaned);

    const card: CanonicalCard = {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: title,
      content: content,
      summary: content.slice(0, 200),
      created_at: createdAt,
      modified_at: new Date().toISOString(),
      source: 'html',
      source_id: sourceUrl ?? crypto.randomUUID(),
      source_url: sourceUrl,
      // ... other fields
    };

    cards.push(card);
    return { cards, connections: [], errors: [] };
  }

  private stripScripts(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  }

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch?.[1]) return this.decodeEntities(titleMatch[1]);

    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match?.[1]) return this.decodeEntities(h1Match[1]);

    return 'Untitled';
  }

  private extractMeta(html: string, property: string): string | null {
    const pattern = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
    const match = html.match(pattern);
    return match?.[1] ?? null;
  }

  private htmlToMarkdown(html: string): string {
    let md = html;

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

    // Bold/Italic
    md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
    md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');

    // Links
    md = md.replace(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
      return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
    });

    // Horizontal rules
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    md = this.decodeEntities(md);

    return md.trim();
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gray-matter .read() | gray-matter .parse() + .stringify() | 2020 | Browser compatibility: .read() requires Node.js fs; .parse() works in Worker |
| SheetJS global import | Dynamic import('xlsx') | 2024 | Bundle size: Global adds 1MB to initial load; dynamic defers until needed |
| Turndown (HTML→Markdown) | Regex-based conversion | 2026 (this project) | Worker compatibility: Turndown needs DOM (linkedom 200KB overhead); regex is lighter for 80% case |
| CSV split(',') | PapaParse | 2014 | RFC 4180 compliance: Manual split breaks on quoted commas, embedded newlines; PapaParse handles all cases |

**Deprecated/outdated:**
- **exceljs async-only API:** SheetJS synchronous API is better for Worker context (exceljs requires async/await for all operations, complicating Worker message handlers)
- **TOML frontmatter:** Markdown ecosystem has standardized on YAML (`---`). TOML (`+++`) is rarely seen in 2026 Obsidian/Bear vaults.
- **csvtojson package:** Unmaintained since 2020. PapaParse is actively maintained and has 12K+ stars.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- tests/etl/parsers/MarkdownParser.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ETL-05 | Markdown frontmatter parsed; title from frontmatter/heading/filename cascade; tags from array/hashtags; folder from path | unit | `npm test -- tests/etl/parsers/MarkdownParser.test.ts -x` | ❌ Wave 0 |
| ETL-06 | Excel .xlsx parsed with cellDates; ArrayBuffer input; column auto-detection; dynamic import verified | unit | `npm test -- tests/etl/parsers/ExcelParser.test.ts -x` | ❌ Wave 0 |
| ETL-07 | CSV with UTF-8 BOM parsed; BOM stripped; ragged rows handled; PapaParse synchronous | unit | `npm test -- tests/etl/parsers/CSVParser.test.ts -x` | ❌ Wave 0 |
| ETL-08 | JSON parsed; array normalization; nested object flattening; field mapping | unit | `npm test -- tests/etl/parsers/JSONParser.test.ts -x` | ❌ Wave 0 |
| ETL-09 | HTML parsed; script/style stripped; metadata extracted; Markdown conversion | unit | `npm test -- tests/etl/parsers/HTMLParser.test.ts -x` | ❌ Wave 0 |
| ETL-14 | Markdown export with YAML frontmatter; round-trip verified (export → import → identical) | unit | `npm test -- tests/etl/exporters/MarkdownExporter.test.ts -x` | ❌ Wave 0 |
| ETL-15 | JSON export with pretty-print; tags as array; all columns included | unit | `npm test -- tests/etl/exporters/JSONExporter.test.ts -x` | ❌ Wave 0 |
| ETL-16 | CSV export RFC 4180 compliant; PapaParse unparse; semicolon tags | unit | `npm test -- tests/etl/exporters/CSVExporter.test.ts -x` | ❌ Wave 0 |
| ETL-17 | ExportOrchestrator dispatches to correct exporter; cardIds filter works; deleted cards excluded | unit | `npm test -- tests/etl/ExportOrchestrator.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/etl/parsers/{ParserName}.test.ts -x` (fail-fast on first error)
- **Per wave merge:** `npm test -- tests/etl/` (all ETL tests)
- **Phase gate:** Full suite green (`npm test`) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/etl/parsers/MarkdownParser.test.ts` — covers ETL-05 (frontmatter parsing, title cascade, tags, folder)
- [ ] `tests/etl/parsers/CSVParser.test.ts` — covers ETL-07 (BOM stripping, column auto-detection, ragged rows)
- [ ] `tests/etl/parsers/JSONParser.test.ts` — covers ETL-08 (array normalization, field mapping)
- [ ] `tests/etl/parsers/ExcelParser.test.ts` — covers ETL-06 (cellDates, dynamic import, ArrayBuffer)
- [ ] `tests/etl/parsers/HTMLParser.test.ts` — covers ETL-09 (script stripping, metadata extraction, Markdown conversion)
- [ ] `tests/etl/exporters/MarkdownExporter.test.ts` — covers ETL-14 (round-trip verification)
- [ ] `tests/etl/exporters/JSONExporter.test.ts` — covers ETL-15 (pretty-print, tag arrays)
- [ ] `tests/etl/exporters/CSVExporter.test.ts` — covers ETL-16 (RFC 4180, PapaParse unparse)
- [ ] `tests/etl/ExportOrchestrator.test.ts` — covers ETL-17 (dispatcher, filters)
- [ ] `tests/fixtures/csv-with-bom.csv` — UTF-8 BOM test fixture
- [ ] `tests/fixtures/excel-with-dates.xlsx` — Excel date handling test fixture
- [ ] `tests/fixtures/obsidian-vault/` — Markdown frontmatter test fixtures (complex YAML, no frontmatter, special characters)
- [ ] `tests/fixtures/html-web-clipping.html` — HTML with scripts, metadata, tables

## Sources

### Primary (HIGH confidence)

- [PapaParse Official Documentation](https://www.papaparse.com/docs) - CSV parsing/unparsing API, RFC 4180 compliance, BOM handling
- [SheetJS Community Edition Docs](https://docs.sheetjs.com/) - Excel parsing, cellDates option, standalone builds
- [gray-matter GitHub](https://github.com/jonschlinkert/gray-matter) - YAML frontmatter parse/stringify, round-trip support
- [node-html-parser GitHub](https://github.com/node-projects/node-html-parser) - Worker-safe HTML parsing, CSS selectors
- Isometry AppleNotesParser.ts (Phase 8) - Established parser pattern, CanonicalCard interface usage
- Isometry DedupEngine.ts (Phase 8) - Connection resolution via sourceIdMap pattern
- Isometry ImportOrchestrator.ts (Phase 8) - Parser dispatch switch statement template
- Isometry .planning/research/PITFALLS.md - P26-P29 pitfall documentation

### Secondary (MEDIUM confidence)

- [PapaParse npm package](https://www.npmjs.com/package/papaparse) - Version info, bundle size
- [SheetJS CDN](https://cdn.sheetjs.com/) - Mini build access, bundle size optimization
- [CSV Special Characters Guide](https://inventivehq.com/blog/handling-special-characters-in-csv-files) - RFC 4180 quote escaping, BOM handling
- [Excel UTF-8 CSV Support](https://support.microsoft.com/en-us/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032) - BOM requirement for Excel
- [gray-matter-browser fork](https://github.com/LittleSound/gray-matter-browser) - Browser compatibility workaround
- [Obsidian YAML Frontmatter Guide](https://forum.obsidian.md/t/how-to-include-punctuation-marks-into-yaml-frontmatter/77524) - Special character escaping
- [Excel Date Parsing Pitfalls](https://dev.to/excel24x7/fix-excel-date-serial-number-formatting-issue-3g70) - Serial number conversion issues

### Tertiary (LOW confidence)

- WebSearch results for "HTML to Markdown conversion JavaScript 2026" - General ecosystem trends (turndown vs regex-based)
- WebSearch results for "CSV parsing pitfalls" - General CSV issues (not specific to PapaParse)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs; gray-matter already installed and working
- Architecture: HIGH - Phase 8 established proven parser pattern; direct replication with new sources
- Pitfalls: MEDIUM-HIGH - P26-P29 documented in project PITFALLS.md; CSV BOM and Excel dates verified via official sources; HTML script stripping is defensive best practice

**Research date:** 2026-03-01
**Valid until:** 2026-04-30 (30 days - stable ecosystem; PapaParse, SheetJS, gray-matter are mature libraries with infrequent breaking changes)
