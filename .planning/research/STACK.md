# Stack Research — v1.1 ETL Importers

**Domain:** ETL import/export pipeline additions to existing TypeScript/sql.js/D3.js app
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH — versions verified via npm registry and official docs; bundle sizes are estimates from community sources (Bundlephobia inaccessible during research); Apple Notes "alto-index" JSON schema is LOW confidence (proprietary format, no public spec found)

---

## Context: What Already Exists (Do Not Re-Research)

The v1.0 Web Runtime is complete. The following are locked and need no new dependencies:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9.x (strict) | Configured |
| sql.js | 1.14.0 (custom FTS5 WASM, 756KB) | Built, tested |
| Vite | 7.3.1 | Configured |
| Vitest | 4.0.18 | Configured |
| d3 | 7.9.0 | Installed |
| @types/d3 | 7.4.3 | Installed |
| @vitest/web-worker | 4.0.18 | Installed |

**This document covers ONLY what must be ADDED for the v1.1 ETL Importers milestone.**

---

## New Dependencies Required

### Core Runtime Additions

| Library | Version | Purpose | Why This Choice | Bundle Size (est.) | Confidence |
|---------|---------|---------|-----------------|-------------------|------------|
| `gray-matter` | 4.0.3 | Parse YAML/JSON frontmatter from Markdown files | Battle-tested, used by Gatsby, Astro, VitePress, TinaCMS. No better alternative for frontmatter parsing. Returns `{ data, content }` — maps directly to card fields. | ~44KB minified, ~12KB gzip | HIGH |
| `xlsx` | 0.20.3 | Parse Excel (.xlsx, .xls, .csv, .ods) files | SheetJS Community Edition is the only serious open-source Excel parser in JS. Supports `XLSX.read(arrayBuffer, {type:'array'})` pattern needed for Worker context. | ~180KB minified, ~60KB gzip | HIGH |
| `papaparse` | 5.5.3 | Parse CSV files with header detection, encoding, delimiter auto-detection | RFC 4180 compliant, zero dependencies, built-in Worker threading support (`worker: true`). The only browser-native multi-threaded CSV parser. @types/papaparse available separately. | ~45KB minified, ~14KB gzip | HIGH |
| `node-html-parser` | 7.0.2 | Parse HTML to extract plain text (Apple Notes HTML body, imported HTML files) | Fast, lightweight DOM-like API with querySelector, `.text` (innerText equivalent), `.textContent`. TypeScript types bundled. Works in Worker context (no DOM dependency). | ~30KB minified, ~10KB gzip | HIGH |

### Dev-Only Additions

None required — existing Vitest/TypeScript setup is sufficient. All parsers are tested with standard Vitest node environment using in-memory string/Buffer fixtures.

---

## Apple Notes Parser: No New Package Needed

**Finding:** The `alto-index` app (altoindex.com) exports Apple Notes to **Markdown files** (not JSON). It is a macOS app that transforms Notes, Messages, Contacts, Calendar, etc. into "AI-ready markdown files." There is no publicly specified JSON schema called "alto-index JSON."

**What this means for the parser:**

The Apple Notes parser in this project will handle **two input formats**:

1. **alto-index Markdown output** — Markdown files with optional YAML frontmatter. Parse with `gray-matter` (already included for the Markdown source parser). Alto-index produces standard Markdown; frontmatter fields are not formally specified but typically include title-derived content.

2. **apple-notes-liberator JSON** — The [Apple Notes Liberator](https://github.com/HamburgChimps/apple-notes-liberator) tool outputs a `notes.json` array with fields: `title`, `folder`, `text` (plain text), `embeddedObjects` (tables/files), `links`. This is a plausible "JSON export from Apple Notes" — parse with built-in `JSON.parse()`.

**No new npm package needed for Apple Notes parsing.** The parser is custom TypeScript that reads either format and maps to `CanonicalCard`. Budget for format auto-detection by inspecting file extension + structure.

**Confidence:** LOW for alto-index specifics (proprietary, no public schema). MEDIUM for apple-notes-liberator format (GitHub README documented).

---

## Markdown Parser: No New Package Needed

**Finding:** A Markdown source parser does not require a full Markdown-to-HTML renderer. The goal is extracting structured metadata and plain-text body from `.md` files — not rendering HTML.

`gray-matter` alone handles this:
```typescript
import matter from 'gray-matter';

const { data, content } = matter(markdownString);
// data = { title, tags, created, folder, ... } from YAML frontmatter
// content = raw Markdown body text (strip MD syntax if needed)
```

If the plain-text body is needed without Markdown syntax, a lightweight regex strip is sufficient (`content.replace(/[#*_`[\]()]/g, '')`) — no full Markdown parser needed. The `content` field is already more useful than rendered HTML for full-text search indexing into FTS5.

**Do NOT add:** `marked`, `remark`, `markdown-it`, `commonmark` — these render HTML, not needed for import. They add 50–200KB for no benefit.

---

## CSV Parser: PapaParse vs Alternatives

**Recommendation: papaparse 5.5.3**

| Library | Downloads | Worker? | Browser? | Notes |
|---------|-----------|---------|----------|-------|
| `papaparse` | ~700K/week | Yes (built-in) | Yes | Zero deps, RFC 4180, auto-delimiter, streaming |
| `csv-parse` | ~1.4M/week | No | Node only | Best for Node streams; no browser support |
| `fast-csv` | ~640K/week | No | Node only | Despite name, slowest in benchmarks |

PapaParse is the only browser/Worker-native choice. Since ETL runs inside the existing Worker Bridge, the import pipeline runs in a Worker context — PapaParse is the only viable option.

**TypeScript types:**
```bash
npm install -D @types/papaparse
```

Types are in DefinitelyTyped (`@types/papaparse` 5.3.15), not bundled. Install separately.

**Important gotcha:** PapaParse's own `worker: true` option spawns a *second* Worker from inside the existing Worker. This creates a nested Worker situation that is not needed. Use PapaParse synchronously inside the existing ImportWorker instead:

```typescript
// Inside Worker — use synchronous parse, not worker:true
import Papa from 'papaparse';

const result = Papa.parse<Record<string, string>>(csvString, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,  // Keep strings; type coercion happens in mapper
});
// result.data = array of row objects
// result.errors = parse errors
// result.meta.fields = column headers
```

---

## Excel Parser: SheetJS 0.20.3

**Critical installation note:** The `xlsx` package on npm is outdated (last published version is 0.18.x from 2023). SheetJS stopped publishing to npm. The current version (0.20.3) must be installed from the SheetJS CDN tarball:

```bash
npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

This adds `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` to `package.json`. Vite handles this correctly.

**Worker context pattern (the right approach for this project):**

SheetJS works in Worker context by receiving an `ArrayBuffer` from the main thread. `XLSX.writeFile` does NOT work in Workers (confirmed in docs), but `XLSX.read()` works fine:

```typescript
// In Worker (ImportWorker.ts)
import { read, utils } from 'xlsx';

function parseXLSX(arrayBuffer: ArrayBuffer): Record<string, unknown>[][] {
  const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,        // Return array of arrays for header-agnostic parsing
      defval: null,     // Use null for empty cells (not undefined)
      blankrows: false, // Skip blank rows
    });
  });
}
```

**Vite binary import gotcha:** Vite's default raw loader interprets binary files as UTF-8 strings, corrupting `.xlsx` files. The correct approach is to receive the `ArrayBuffer` via `postMessage` from the main thread (where the user file input or fetch already provides an ArrayBuffer), not by importing the file statically through Vite.

```typescript
// Main thread: pass ArrayBuffer through WorkerBridge
const response = await fetch('/path/to/file.xlsx');
const buffer = await response.arrayBuffer();
await workerBridge.send('import:xlsx', { buffer }, [buffer]); // Transferable!
```

The `[buffer]` third argument uses the Transferable interface — zero-copy transfer to Worker, no serialization.

**CVE note:** SheetJS 0.20.3 is not affected by CVE-2024-22363 (ReDoS in older xlsx versions). The CDN version is the patched release. Verify: the npm registry `xlsx@0.18.5` is the vulnerable version to avoid.

---

## HTML Parser: node-html-parser 7.0.2

For stripping HTML tags from Apple Notes HTML body content and parsing imported HTML files:

```typescript
import { parse } from 'node-html-parser';

function htmlToPlainText(html: string): string {
  const root = parse(html);
  return root.text;  // Equivalent to innerText — strips tags, decodes entities
}

function extractLinksFromHtml(html: string): Array<{text: string; url: string}> {
  const root = parse(html);
  return root.querySelectorAll('a').map(a => ({
    text: a.text.trim(),
    url: a.getAttribute('href') ?? '',
  }));
}
```

**Why not DOMParser?** `DOMParser` is available in Worker context in modern browsers, but creates a full DOM — heavyweight for bulk import processing. `node-html-parser` generates a simplified DOM, is 10x faster in benchmarks, and has no external dependencies.

**Why not cheerio?** Cheerio depends on `htmlparser2` which pulls in additional dependencies. `node-html-parser` is leaner for the read-only use case needed here (no jQuery-like mutation API required).

---

## JSON Source Parser: No New Package Needed

Plain `JSON.parse()` handles the JSON source format. The parser is custom TypeScript that validates structure and maps fields to `CanonicalCard`. No additional library needed.

For robust validation of imported JSON structure (especially for apple-notes-liberator format), use TypeScript type guards — no runtime validation library needed at this scope.

---

## Progress Reporting: Existing Worker Bridge (No New Dependency)

The ImportOrchestrator reports progress via the existing `WorkerBridge` message protocol. No new library is needed — use the existing `postMessage` pattern with a `progress` message type:

```typescript
// In Worker — emit progress events through existing bridge protocol
self.postMessage({
  type: 'import:progress',
  correlationId: null,  // Broadcast, not a response to a specific request
  payload: {
    source: 'markdown',
    processed: 42,
    total: 200,
    phase: 'parsing',  // 'parsing' | 'dedup' | 'writing'
  }
} satisfies WorkerMessage);
```

The main thread registers a listener for `import:progress` messages outside the correlation ID resolver — this is a fire-and-forget broadcast pattern already supported by the Worker Bridge spec.

---

## DedupEngine and SQLiteWriter: No New Dependencies

Both are pure TypeScript using the existing `sql.js` database:

- **DedupEngine:** Queries `cards` table by `source + source_id` composite index. Returns `existing | null`. Pure sql.js queries.
- **SQLiteWriter:** Uses existing `db.run()` pattern with parameterized INSERT statements. Batch via array reduce + transaction wrapping (`db.run('BEGIN')` / `db.run('COMMIT')`).
- **FTS sync:** After batch insert, run `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` — existing pattern from v0.1 tests.

No new libraries. The existing sql.js WASM already handles this.

---

## Data Catalog Schema: No New Dependencies

The `import_sources` and `import_runs` tables are added via migration SQL in the existing schema initialization. No ORM, no migration library. Pattern from existing schema:

```sql
CREATE TABLE IF NOT EXISTS import_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,  -- 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html'
  source_path TEXT,
  created_at INTEGER NOT NULL,
  last_run_at INTEGER
);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES import_sources(id),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL,       -- 'running' | 'completed' | 'failed'
  cards_created INTEGER DEFAULT 0,
  cards_updated INTEGER DEFAULT 0,
  cards_skipped INTEGER DEFAULT 0,
  error_message TEXT
);
```

---

## Export Orchestrator: No New Dependencies

Three export formats (Markdown, JSON, CSV) use no new libraries:

| Format | Implementation |
|--------|---------------|
| Markdown | String template literals. Frontmatter: `---\ntitle: ${card.name}\n---\n${card.content}` |
| JSON | `JSON.stringify(cards, null, 2)` |
| CSV | PapaParse `Papa.unparse(rows)` — reuse already-installed papaparse for serialization |

PapaParse's `unparse()` handles CSV export (quoting, escaping, headers) correctly. No separate CSV serializer needed.

---

## Installation

```bash
# Markdown frontmatter parsing
npm install gray-matter

# Excel/XLSX parsing (from SheetJS CDN — not npm registry)
npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# CSV parsing
npm install papaparse

# HTML parsing
npm install node-html-parser

# TypeScript types (PapaParse ships without bundled types)
npm install -D @types/papaparse
```

**Total new runtime packages:** 4
**Total new dev packages:** 1 (@types/papaparse)
**No changes to:** Vite config, tsconfig, Vitest config, existing Worker Bridge code

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `gray-matter` | `front-matter` (npm) | `front-matter` is simpler but gray-matter is more widely used, handles JSON/TOML frontmatter too, and returns structured `{ data, content }` with better TypeScript types. |
| `gray-matter` | `vfile` + `remark-frontmatter` | remark ecosystem is correct for full Markdown AST processing — overkill for import (only need frontmatter metadata, not AST). Adds 5+ packages. |
| `xlsx` from CDN | `exceljs` npm 4.4.0 | ExcelJS 4.4.0 was last published 2 years ago (2023), stale. SheetJS 0.20.3 is actively maintained on the CDN and is the standard for browser/Worker Excel parsing. ExcelJS is Stream-based (Node.js oriented) and more complex for the read-only import case. |
| `xlsx` from CDN | npm registry `xlsx@0.18.5` | 0.18.5 is the last npm version — outdated (missing fixes, affected by ReDoS CVE-2024-22363). Must use CDN version 0.20.3. |
| `papaparse` | `csv-parse` | `csv-parse` is Node.js stream-oriented, not browser/Worker native. Not suitable for the Worker context. |
| `papaparse` | `fast-csv` | Despite the name, benchmarks show fast-csv is the slowest of the major CSV parsers. Also Node stream-oriented. |
| `node-html-parser` | `cheerio` | Cheerio pulls in `htmlparser2` + `css-what` + `domhandler` — heavier dependency tree for a read-only use case. |
| `node-html-parser` | `DOMParser` (browser built-in) | DOMParser creates a full DOM — slower for bulk batch processing during import. node-html-parser is 10x faster in benchmarks for text extraction. |
| Custom TypeScript | Runtime JSON schema validator (`zod`, `ajv`) | At this scope, TypeScript type guards cover import validation needs without runtime overhead or additional bundle weight. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `marked` / `remark` / `markdown-it` | Full Markdown renderers — produce HTML, not needed for import. 50–200KB for no benefit. | `gray-matter` for frontmatter, raw content string for FTS indexing |
| `exceljs` | Stale (2 years since last publish), Node stream API doesn't fit Worker context | `xlsx` 0.20.3 from SheetJS CDN |
| `npm install xlsx` (registry version) | Outdated 0.18.5, affected by ReDoS CVE-2024-22363 | `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` |
| `zod` / `ajv` / `yup` | Runtime schema validation adds bundle weight not justified at ETL parser scope | TypeScript type guards + explicit null checks |
| `iconv-lite` / `encoding` | Character encoding conversion — only needed if supporting non-UTF-8 CSV files | PapaParse handles BOM detection; assume UTF-8 for v1.1, add encoding support as v1.2 follow-on |
| `archiver` / `jszip` | ZIP archive creation — not in scope for v1.1 export formats | Not needed |
| `cheerio` | jQuery-like HTML manipulation — overkill for read-only text extraction | `node-html-parser` |
| Nested Worker in PapaParse (`worker: true`) | Creates a second Worker inside the existing ImportWorker — nested Worker complexity for no benefit | Call PapaParse synchronously inside the existing Worker |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `gray-matter@4.0.3` | TypeScript 5.9.x | Types bundled; works with strict mode. Depends on `js-yaml@^3.13.1` — NOTE: uses js-yaml v3 (not v4). Open PR #137 exists but unmerged. The js-yaml v3 `safeLoad` call is safe for trusted Markdown files. |
| `gray-matter@4.0.3` | Vite 7.3.1 | CJS module; Vite handles CJS-to-ESM interop automatically via `optimizeDeps`. May need Vite to add to `optimizeDeps.include` if import fails. |
| `xlsx@0.20.3` | Vite 7.3.1 | Install from CDN tarball. Import via `import { read, utils } from 'xlsx'`. Do NOT use Vite's static asset loader for binary .xlsx files — receive as ArrayBuffer via postMessage. |
| `xlsx@0.20.3` | Worker context | `XLSX.read(uint8Array, {type:'array'})` works in Worker. `XLSX.writeFile()` does NOT work in Worker (confirmed in docs). For export, generate buffer in Worker and transfer to main thread. |
| `papaparse@5.5.3` | TypeScript 5.9.x | Types via `@types/papaparse` (DefinitelyTyped). Use generic: `Papa.parse<MyType>(csv, {header: true})`. |
| `papaparse@5.5.3` | Worker context | Fully Worker-compatible. Do NOT use `worker: true` option inside existing Worker (creates nested Worker). Call synchronously. |
| `node-html-parser@7.0.2` | TypeScript 5.9.x | Types bundled. Minimum TypeScript ^4.1.2 required — satisfied by 5.9.x. |
| `node-html-parser@7.0.2` | Worker context | No DOM dependencies — runs cleanly in Worker. No browser globals needed. |
| `@types/papaparse@5.3.15` | `papaparse@5.5.3` | DefinitelyTyped version aligns with papaparse 5.x API. |

---

## gray-matter Security Note

gray-matter 4.0.3 uses `js-yaml@^3.13.1` (v3, not v4). This dependency has the following implications:

- **js-yaml v3 is safe for trusted input.** The gray-matter repo calls `js-yaml.safeLoad()` specifically (not the unsafe `load()`), which prevents arbitrary code execution.
- **For untrusted input** (user-supplied Markdown files from unknown sources): gray-matter has a known issue where the JS engine (allowing `!!js/function`) can be triggered — but this requires `engines: {js: ...}` in options. The default gray-matter call is safe.
- **Mitigation:** Never pass `{engines: {js: ...}}` in gray-matter options. Use default options only.
- **Open PR #137** (update to js-yaml v4) has been open since 2022, unmerged. The project is maintained but slow-moving. If this is a blocker, use `front-matter` (npm) as a 1:1 API substitute with no js-yaml dependency.

---

## SheetJS CDN Dependency Risk

SheetJS distributes from a self-hosted CDN (`cdn.sheetjs.com`), not npm. Risks:

| Risk | Mitigation |
|------|-----------|
| CDN unavailability | Lock the tarball URL in package.json. The `.tgz` is committed to `node_modules` via npm install; subsequent installs use the npm cache. |
| Version unavailability | Archive the tarball in project (or use a private npm proxy). For v1.1, this risk is acceptable. |
| License change | SheetJS Community Edition is Apache 2.0 for the CDN version. The npm registry version retains Apache 2.0. Monitor if SheetJS changes to commercial-only. |

---

## Sources

- SheetJS official docs — installation, Web Worker support, Vite integration: https://docs.sheetjs.com/docs/getting-started/installation/frameworks/
- SheetJS Web Worker docs — confirmed `XLSX.read()` works in Worker, `XLSX.writeFile()` does not: https://docs.sheetjs.com/docs/demos/bigdata/worker/
- SheetJS CDN — current version 0.20.3: https://cdn.sheetjs.com/
- gray-matter GitHub — package.json shows `js-yaml@^3.13.1` dependency: https://github.com/jonschlinkert/gray-matter/blob/master/package.json
- gray-matter npm — version 4.0.3, last published 5 years ago: https://www.npmjs.com/package/gray-matter
- gray-matter PR #137 — js-yaml v4 update, unmerged: https://github.com/jonschlinkert/gray-matter/pull/137
- papaparse npm — version 5.5.3, last published ~9 months ago: https://www.npmjs.com/package/papaparse
- papaparse docs — Worker support (`worker: true` option): https://www.papaparse.com/docs
- node-html-parser npm — version 7.0.2: https://www.npmjs.com/package/node-html-parser
- JS CSV parsers benchmark — papaparse vs fast-csv vs csv-parse performance: https://leanylabs.com/blog/js-csv-parsers-benchmarks/
- alto-index website — confirms Markdown output (not JSON): https://altoindex.com/
- apple-notes-liberator GitHub — JSON schema: `{title, folder, text, embeddedObjects, links}`: https://github.com/HamburgChimps/apple-notes-liberator
- SheetJS CVE-2024-22363 — ReDoS in xlsx npm package, CDN version unaffected: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9

---

*Stack research for: Isometry v1.1 ETL Importers (Apple Notes, Markdown, Excel, CSV, JSON, HTML parsers)*
*Researched: 2026-03-01*
