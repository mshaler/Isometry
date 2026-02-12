# Phase 68: Import Coordinator - Research

**Researched:** 2026-02-12
**Domain:** File import routing and format detection (TypeScript)
**Confidence:** HIGH

## Summary

Phase 68 implements a central Import Coordinator that routes files to format-specific importers based on extension detection. This is a well-established pattern (factory + router) with no external research needed. The coordinator acts as the single entry point for all file imports, delegating to specialized importers that output the canonical CanonicalNode schema established in Phase 67.

The architecture follows the Strategy pattern with a Factory method for importer selection. All complexity lives in the individual importers (Phase 69) - the coordinator's job is simple routing and orchestration.

**Primary recommendation:** Implement a thin coordinator layer with extension-based routing, defer all parsing complexity to Phase 69 importers.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.2+ | Type safety | Existing project language, strict mode |
| Zod | 3.25+ | Schema validation | Already installed, used in Phase 67 for CanonicalNode validation |
| uuid | 11.0+ | Node ID generation | Already installed, industry standard for unique IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path (Node.js builtin) | - | Extension extraction | File format detection from filename |

### Alternatives Considered
None - this phase is architecture only, no library decisions needed. Individual importers (Phase 69) will use format-specific parsers.

**Installation:**
No new dependencies required for Phase 68. All needed libraries already present in package.json:
```bash
# Already installed
zod: ^3.25.76
uuid: ^11.0.4
```

## Architecture Patterns

### Recommended Project Structure
```
src/etl/
├── types/
│   └── canonical.ts           # Phase 67: CanonicalNode schema (complete)
├── coordinator/
│   └── ImportCoordinator.ts   # Phase 68: Central router (NEW)
├── importers/
│   ├── BaseImporter.ts        # Phase 68: Abstract base class (NEW)
│   ├── MarkdownImporter.ts    # Phase 69: Deferred
│   ├── ExcelImporter.ts       # Phase 69: Deferred
│   └── ...                    # Phase 69: Other importers
├── alto-importer.ts           # Existing: Pattern to follow
└── index.ts                   # Public API exports
```

### Pattern 1: Factory + Strategy (Coordinator)
**What:** Central router selects importer based on file extension, delegates to strategy implementation.

**When to use:** Multi-format import systems where routing logic is separate from parsing logic.

**Example:**
```typescript
// Source: Standard Gang of Four Factory + Strategy pattern
class ImportCoordinator {
  private importers: Map<string, BaseImporter>;

  constructor() {
    this.importers = new Map([
      ['.md', new MarkdownImporter()],
      ['.xlsx', new ExcelImporter()],
      // ... more importers added in Phase 69
    ]);
  }

  detectFormat(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (this.importers.has(ext)) return ext;
    throw new Error(`Unsupported format: ${ext}`);
  }

  getImporter(extension: string): BaseImporter {
    const importer = this.importers.get(extension);
    if (!importer) throw new Error(`No importer for ${extension}`);
    return importer;
  }

  async importFile(source: FileSource): Promise<CanonicalNode[]> {
    const ext = this.detectFormat(source.filename);
    const importer = this.getImporter(ext);
    return await importer.import(source);
  }

  async importFiles(sources: FileSource[]): Promise<ImportResult> {
    const results = await Promise.allSettled(
      sources.map(s => this.importFile(s))
    );
    // Aggregate results, collect errors
  }
}
```

### Pattern 2: Abstract Base Class (Template Method)
**What:** BaseImporter defines the contract all importers must implement. Uses Template Method to enforce parse → validate → transform flow.

**When to use:** When all importers share common validation/transformation logic but differ in parsing.

**Example:**
```typescript
// Source: Template Method pattern + existing alto-importer.ts pattern
abstract class BaseImporter {
  async import(source: FileSource): Promise<CanonicalNode[]> {
    // Template method orchestrates the flow
    const rawData = await this.parse(source);
    const validated = await this.validate(rawData);
    return await this.transform(validated);
  }

  // Abstract methods implemented by subclasses
  protected abstract parse(source: FileSource): Promise<unknown>;

  protected async validate(data: unknown): Promise<unknown> {
    // Common validation logic (can be overridden)
    return data;
  }

  protected abstract transform(data: unknown): Promise<CanonicalNode[]>;
}
```

### Pattern 3: File Source Type
**What:** Unified interface for file data whether from disk, memory, or Swift bridge.

**When to use:** Browser and native environments both need to import files.

**Example:**
```typescript
// Source: Existing alto-importer.ts pattern (lines 224-227)
interface FileSource {
  filename: string;      // For extension detection
  content: string;       // File content (text or base64)
  encoding?: 'utf8' | 'base64';  // For binary formats
}
```

### Pattern 4: Result Aggregation
**What:** Batch import returns structured result with success/error counts.

**When to use:** Importing multiple files where partial success is acceptable.

**Example:**
```typescript
// Source: Existing alto-importer.ts ImportResult (lines 38-43)
interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
  nodes: CanonicalNode[];
}
```

### Anti-Patterns to Avoid
- **Embedding parsing logic in coordinator:** Keep coordinator thin. All format-specific logic belongs in importers.
- **Synchronous file I/O:** Use async/await everywhere. Browser can't do sync I/O, native might pass large files.
- **Magic byte detection without extension fallback:** Start with extension, only use magic bytes for validation/ambiguity resolution.
- **Swallowing errors:** Bubble up detailed errors with file context for debugging.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extension mapping | Manual if/else chains | Map<string, Importer> | O(1) lookup, easy to extend, TypeScript-safe keys |
| File validation | Custom validators | Zod schema from Phase 67 | Already validated CanonicalNode, consistent errors |
| ID generation | Custom hash functions | uuid v4 + deterministic source_id | Already used in alto-importer.ts, proven collision resistance |
| Error aggregation | Try/catch soup | Promise.allSettled() | Native parallel execution with error collection |

**Key insight:** The coordinator is just routing infrastructure. Don't reinvent format detection, validation, or parallel execution - use proven patterns and native APIs.

## Common Pitfalls

### Pitfall 1: Tightly Coupling to Specific Importers
**What goes wrong:** Coordinator imports concrete classes, making it hard to test or add new formats.

**Why it happens:** Quick implementation skips abstraction layer.

**How to avoid:**
- Use BaseImporter interface
- Inject importers via constructor or registration method
- Test coordinator with mock importers

**Warning signs:**
- Import statements for all format parsers in coordinator file
- Type errors when adding new importer
- Can't test coordinator without real file parsers

### Pitfall 2: Assuming All Files Fit in Memory
**What goes wrong:** 100MB Excel file crashes browser when loaded as string.

**Why it happens:** Design assumes small text files like markdown.

**How to avoid:**
- Accept streaming interfaces in future
- Document memory limits in Phase 68
- Phase 69 importers can implement chunking if needed

**Warning signs:**
- FileSource has no size limit
- No documentation of max file size
- Browser tab crashes during import

### Pitfall 3: Extension Case Sensitivity
**What goes wrong:** ".MD" file not recognized because map only has ".md".

**Why it happens:** Forgetting to normalize extensions.

**How to avoid:**
```typescript
detectFormat(filename: string): string {
  const ext = path.extname(filename).toLowerCase(); // Always normalize
  // ...
}
```

**Warning signs:**
- User reports "file not supported" for valid format
- Works on Mac, fails on Windows (case-sensitive vs case-insensitive filesystems)

### Pitfall 4: Not Validating Importer Output
**What goes wrong:** Importer returns malformed nodes, crashes downstream database insertion.

**Why it happens:** Trusting importers to output valid CanonicalNode without verification.

**How to avoid:**
```typescript
async importFile(source: FileSource): Promise<CanonicalNode[]> {
  const ext = this.detectFormat(source.filename);
  const importer = this.getImporter(ext);
  const nodes = await importer.import(source);

  // Validate every node before returning
  return nodes.map(node => CanonicalNodeSchema.parse(node));
}
```

**Warning signs:**
- Database insertion errors in Phase 70
- No schema validation in coordinator
- Assume importers always return valid data

### Pitfall 5: Swallowing Import Errors in Batch Operations
**What goes wrong:** importFiles() fails silently, user doesn't know which files failed.

**Why it happens:** Using Promise.all() which fails fast, or catching errors without logging.

**How to avoid:**
```typescript
async importFiles(sources: FileSource[]): Promise<ImportResult> {
  const results = await Promise.allSettled(
    sources.map(s => this.importFile(s).catch(err => ({
      file: s.filename,
      error: err.message
    })))
  );

  const imported: CanonicalNode[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      imported.push(...result.value);
    } else {
      errors.push({ file: sources[i].filename, error: result.reason });
    }
  });

  return { imported, errors, /* ... */ };
}
```

**Warning signs:**
- No error array in ImportResult
- Batch import succeeds with 0 imported nodes
- User can't tell which files failed

## Code Examples

Verified patterns from existing codebase:

### Extension Detection
```typescript
// Source: Standard Node.js path module pattern
import path from 'path';

function detectFormat(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const supported = ['.md', '.markdown', '.mdx', '.xlsx', '.xls',
                     '.docx', '.json', '.html', '.htm', '.csv', '.tsv'];

  if (!supported.includes(ext)) {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  return ext;
}
```

### Importer Registration
```typescript
// Source: Factory pattern with type-safe Map
class ImportCoordinator {
  private importers = new Map<string, BaseImporter>();

  registerImporter(extensions: string[], importer: BaseImporter): void {
    extensions.forEach(ext => {
      this.importers.set(ext.toLowerCase(), importer);
    });
  }

  getImporter(extension: string): BaseImporter {
    const importer = this.importers.get(extension.toLowerCase());
    if (!importer) {
      throw new Error(`No importer registered for ${extension}`);
    }
    return importer;
  }
}
```

### FileSource Interface
```typescript
// Source: Existing alto-importer.ts pattern (adapted for coordinator)
interface FileSource {
  filename: string;      // Required for extension detection
  content: string;       // UTF-8 text or base64 binary
  encoding?: 'utf8' | 'base64';  // Defaults to utf8
  metadata?: {
    size?: number;
    mimeType?: string;
    source?: string;     // e.g., 'swift-bridge', 'drag-drop'
  };
}
```

### Schema Validation Integration
```typescript
// Source: Phase 67 canonical.ts (CanonicalNodeSchema)
import { CanonicalNode, CanonicalNodeSchema } from '../types/canonical';

async importFile(source: FileSource): Promise<CanonicalNode[]> {
  const ext = this.detectFormat(source.filename);
  const importer = this.getImporter(ext);
  const rawNodes = await importer.import(source);

  // Validate every node against Phase 67 schema
  return rawNodes.map((node, idx) => {
    try {
      return CanonicalNodeSchema.parse(node);
    } catch (err) {
      throw new Error(
        `Node ${idx} from ${source.filename} failed validation: ${err.message}`
      );
    }
  });
}
```

### Error Handling Pattern
```typescript
// Source: Existing alto-importer.ts error aggregation (lines 369-376)
async importFiles(sources: FileSource[]): Promise<ImportResult> {
  const start = performance.now();
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    nodes: [],
  };

  for (const source of sources) {
    try {
      const nodes = await this.importFile(source);
      result.nodes.push(...nodes);
      result.imported += nodes.length;
    } catch (error) {
      result.errors.push({
        file: source.filename,
        error: (error as Error).message,
      });
      result.skipped++;
    }
  }

  result.duration = performance.now() - start;
  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic parser | Strategy pattern with pluggable importers | Phase 68 (Feb 2026) | Easy to add new formats without touching coordinator |
| Format sniffing only | Extension-first with optional magic byte validation | Phase 68 | Faster, more predictable routing |
| Ad-hoc validation | Zod schema validation at coordinator boundary | Phase 67-68 | Consistent errors, type safety |
| Individual file functions | Unified coordinator with batch support | Phase 68 | Parallel import, error aggregation |

**Deprecated/outdated:**
- Direct database insertion in importers: Now importers return CanonicalNode[], coordinator handles DB (Phase 70)
- Synchronous parsing: All imports are async to support browser and large files
- Format-specific error types: Now use standard Error with file context, caught by coordinator

## Open Questions

1. **Should coordinator support progress callbacks for long-running imports?**
   - What we know: Existing alto-importer.ts has onProgress callback (line 35)
   - What's unclear: Whether Phase 68 needs it or defer to Phase 70 integration
   - Recommendation: Include onProgress in ImportCoordinator for consistency with existing pattern

2. **Should format detection support MIME type override?**
   - What we know: Swift bridge will base64-encode files and provide filename
   - What's unclear: Whether MIME type helps disambiguation (e.g., .txt that's actually CSV)
   - Recommendation: Accept optional mimeType in FileSource.metadata, but don't implement detection in Phase 68 - defer to Phase 69 if needed

3. **Should coordinator handle duplicate detection?**
   - What we know: Existing alto-importer uses deterministic source_id (lines 93-97)
   - What's unclear: Whether coordinator should dedupe across files or leave to database
   - Recommendation: Leave to database (INSERT OR REPLACE) - coordinator is stateless

## Sources

### Primary (HIGH confidence)
- Existing codebase: /Users/mshaler/Developer/Projects/Isometry/src/etl/alto-importer.ts - proven import pattern
- Existing codebase: /Users/mshaler/Developer/Projects/Isometry/src/etl/types/canonical.ts - Phase 67 schema
- Project requirements: .planning/milestones/v4.8-etl-consolidation/REQUIREMENTS.md - COORD-01, COORD-02, COORD-03
- Architecture plan: etl-consolidation-plan.md - coordinator design

### Secondary (MEDIUM confidence)
- Node.js path module documentation - standard library for extension extraction
- Gang of Four Design Patterns - Factory + Strategy pattern canonical implementations

### Tertiary (LOW confidence)
None - no external research needed. All patterns verified in existing codebase or standard CS literature.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, no new dependencies
- Architecture: HIGH - Well-established patterns (Factory, Strategy, Template Method) with direct examples in codebase
- Pitfalls: HIGH - Drawn from existing alto-importer.ts code review and standard routing layer mistakes

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - stable domain, no fast-moving dependencies)
