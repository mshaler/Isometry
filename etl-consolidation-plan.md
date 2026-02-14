# ETL Consolidation Plan: Hybrid TypeScript + Swift Architecture

**Version:** 1.0  
**Date:** February 12, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

Consolidate file-based ETL processing in TypeScript to leverage the npm ecosystem, while keeping Swift-native adapters for system framework access. Both layers output a canonical Node schema to sql.js.

### Key Decisions
1. **File-based ETL → TypeScript**: Markdown, XLSX, DOCX, JSON, HTML, CSV
2. **System framework ETL → Swift**: EventKit, Contacts.framework, Apple Notes live sync
3. **Canonical Schema**: Unified Node type shared between TS and Swift via JSON
4. **Bridge**: Swift delegates file parsing to JS via WKWebView async calls

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISOMETRY ETL ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │   SWIFT LAYER        │    │   JS/TS LAYER        │           │
│  │   (Native Access)    │    │   (File Processing)  │           │
│  ├──────────────────────┤    ├──────────────────────┤           │
│  │ • EventKit adapter   │    │ • Markdown parser    │           │
│  │ • Contacts adapter   │    │ • XLSX parser        │           │
│  │ • Notes live sync    │    │ • DOCX parser        │           │
│  │ • HealthKit adapter  │    │ • JSON mapper        │           │
│  │ • TCC permissions    │    │ • HTML-to-MD         │           │
│  │                      │    │ • CSV/TSV parser     │           │
│  └──────────┬───────────┘    └──────────┬───────────┘           │
│             │                           │                        │
│             │    ┌──────────────────┐   │                        │
│             └───►│  CANONICAL NODE  │◄──┘                        │
│                  │  (JSON Schema)   │                            │
│                  └────────┬─────────┘                            │
│                           │                                      │
│                           ▼                                      │
│                  ┌──────────────────┐                            │
│                  │     sql.js       │                            │
│                  │  (Single Store)  │                            │
│                  └──────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Canonical Node Schema

### 1.1 TypeScript Canonical Types

**File:** `src/etl/types/canonical.ts`

```typescript
/**
 * Canonical Node Schema for Isometry ETL
 * 
 * This is the single source of truth for data entering the system.
 * Both TypeScript and Swift importers MUST output this format.
 * 
 * LATCH Mapping:
 * - L (Location): latitude, longitude, locationName, locationAddress
 * - A (Alphabet): name (primary sort key)
 * - T (Time): createdAt, modifiedAt, dueAt, completedAt, eventStart, eventEnd
 * - C (Category): nodeType, folder, tags, status
 * - H (Hierarchy): priority, importance, sortOrder
 */

import { z } from 'zod';

export const CanonicalNodeSchema = z.object({
  // Core Identity
  id: z.string().uuid(),
  nodeType: z.string().default('note'),
  name: z.string().min(1),
  content: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),

  // LATCH: Location
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  locationName: z.string().nullable().default(null),
  locationAddress: z.string().nullable().default(null),

  // LATCH: Time (ISO 8601 strings for JSON serialization)
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  dueAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
  eventStart: z.string().datetime().nullable().default(null),
  eventEnd: z.string().datetime().nullable().default(null),

  // LATCH: Category
  folder: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  status: z.string().nullable().default(null),

  // LATCH: Hierarchy
  priority: z.number().int().min(0).max(5).default(0),
  importance: z.number().int().min(0).max(5).default(0),
  sortOrder: z.number().int().default(0),

  // Provenance
  source: z.string(),
  sourceId: z.string(),
  sourceUrl: z.string().url().nullable().default(null),

  // Lifecycle
  deletedAt: z.string().datetime().nullable().default(null),
  version: z.number().int().positive().default(1),

  // Extension point for format-specific metadata
  properties: z.record(z.unknown()).default({}),
});

export type CanonicalNode = z.infer<typeof CanonicalNodeSchema>;
```

### 1.2 SQL Column Mapping

```typescript
export const SQL_COLUMN_MAP: Record<keyof CanonicalNode, string> = {
  id: 'id',
  nodeType: 'node_type',
  name: 'name',
  content: 'content',
  summary: 'summary',
  latitude: 'latitude',
  longitude: 'longitude',
  locationName: 'location_name',
  locationAddress: 'location_address',
  createdAt: 'created_at',
  modifiedAt: 'modified_at',
  dueAt: 'due_at',
  completedAt: 'completed_at',
  eventStart: 'event_start',
  eventEnd: 'event_end',
  folder: 'folder',
  tags: 'tags',
  status: 'status',
  priority: 'priority',
  importance: 'importance',
  sortOrder: 'sort_order',
  source: 'source',
  sourceId: 'source_id',
  sourceUrl: 'source_url',
  deletedAt: 'deleted_at',
  version: 'version',
  properties: 'properties',
};
```

---

## Phase 2: Import Coordinator

**File:** `src/etl/coordinator/ImportCoordinator.ts`

Routes files to appropriate importers based on format detection. All importers output `CanonicalNode[]` which flows to sql.js.

### Key Methods:
- `importFile(source)` - Import single file
- `importFiles(sources)` - Batch import
- `getImporter(extension)` - Get importer for format
- `detectFormat(filename)` - Auto-detect format

---

## Phase 3: Individual Importers

| Importer | Extensions | NPM Package | Output |
|----------|------------|-------------|--------|
| MarkdownImporter | .md, .markdown, .mdx | gray-matter | Single node |
| ExcelImporter | .xlsx, .xls | xlsx (SheetJS) | Node per sheet |
| WordImporter | .docx | mammoth | Single node |
| JSONImporter | .json | native | Node per object |
| HTMLImporter | .html, .htm | turndown | Single node |
| CSVImporter | .csv, .tsv | papaparse | Node per row or single |

---

## Phase 4: Swift Bridge

Swift native app delegates file parsing to JS via WKWebView:

```swift
// Swift side - delegate file processing to JS
func importFile(_ url: URL) async throws -> [CanonicalNode] {
    let data = try Data(contentsOf: url)
    let base64 = data.base64EncodedString()
    
    let result = try await webView.callAsyncJavaScript(
        "return window.isometryETL.importFile('\(ext)', '\(base64)')",
        contentWorld: .page
    )
    
    return try JSONDecoder().decode([CanonicalNode].self, from: result)
}
```

---

## Phase 5: Implementation Tasks

### Task Checklist for Claude Code

```
## Phase 1: Canonical Schema (Day 1)
- [ ] Create src/etl/types/canonical.ts with Zod schema
- [ ] Create src/etl/types/canonical-node.schema.json
- [ ] Add zod to package.json dependencies
- [ ] Write unit tests for schema validation
- [ ] Verify schema matches existing Swift Node model

## Phase 2: Import Coordinator (Day 1-2)
- [ ] Create src/etl/coordinator/ImportCoordinator.ts
- [ ] Create src/etl/importers/BaseImporter.ts
- [ ] Write coordinator unit tests
- [ ] Verify format detection works

## Phase 3: Importers (Day 2-3)
- [ ] MarkdownImporter.ts (add gray-matter)
- [ ] ExcelImporter.ts (add xlsx)
- [ ] WordImporter.ts (add mammoth)
- [ ] JSONImporter.ts (native)
- [ ] HTMLImporter.ts (add turndown)
- [ ] CSVImporter.ts (add papaparse)

## Phase 4: Integration (Day 3-4)
- [ ] Create src/etl/bridge/window-export.ts
- [ ] Update src/etl/index.ts exports
- [ ] Migrate alto-importer to use CanonicalNode
- [ ] Verify sql.js insertion works
- [ ] Create integration tests

## Phase 5: Swift Bridge (Day 4-5)
- [ ] Create native/Sources/Isometry/Bridge/ETLBridge.swift
- [ ] Write Swift tests for bridge
- [ ] Verify round-trip: Swift → JS → sql.js → Swift

## Phase 6: Documentation & Cleanup (Day 5)
- [ ] Update CLAUDE.md with ETL architecture
- [ ] Add JSDoc comments to all public functions
- [ ] Update package.json scripts
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "gray-matter": "^4.0.3",
    "xlsx": "^0.18.5",
    "mammoth": "^1.6.0",
    "turndown": "^7.1.3",
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@types/turndown": "^5.0.4",
    "@types/papaparse": "^5.3.14"
  }
}
```

---

## Verification Gates

| Gate | Command | Must Pass |
|------|---------|-----------|
| Schema Validation | `npm test -- --grep "CanonicalNode schema"` | All schema tests |
| Individual Importers | `npm test -- --grep "Importer"` | Each importer parses correctly |
| Coordinator Integration | `npm test -- --grep "ImportCoordinator"` | Multi-format import |
| Database Round-Trip | `npm test -- --grep "ETL integration"` | Import → query returns correct data |
| Swift Bridge | `swift test --filter ETLBridge` | Swift → JS → sql.js round-trip |

---

## Success Criteria

1. **All existing alto-index imports work unchanged**
2. **New formats import correctly**: MD, XLSX, DOCX, JSON, HTML, CSV
3. **Swift bridge successfully delegates to JS**
4. **Schema validated at every import**
5. **Test coverage >80% for ETL module**
6. **No regression in import performance**

---

*Ready for Claude Code implementation via GSD executor pattern.*
