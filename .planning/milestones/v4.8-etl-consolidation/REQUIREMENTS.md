# v4.8 ETL Consolidation Requirements

## Milestone Overview

**Goal:** Consolidate file-based ETL processing in TypeScript with canonical schema validation, while maintaining Swift-native adapters for system framework access.

**Key Outcomes:**
1. Single canonical Node schema with Zod validation
2. Unified Import Coordinator routing files to format-specific importers
3. Six file format importers: MD, XLSX, DOCX, JSON, HTML, CSV
4. Swift bridge for native framework access (EventKit, Contacts, Notes)
5. Test coverage >80% for ETL module

## Requirements

### Schema Requirements (SCHEMA)

**SCHEMA-01: Canonical Node Type**
Create Zod-validated canonical schema matching LATCH model.
- File: `src/etl/types/canonical.ts`
- Includes: id, nodeType, name, content, summary
- LATCH-L: latitude, longitude, locationName, locationAddress
- LATCH-A: name (primary sort key)
- LATCH-T: createdAt, modifiedAt, dueAt, completedAt, eventStart, eventEnd
- LATCH-C: nodeType, folder, tags, status
- LATCH-H: priority, importance, sortOrder
- Provenance: source, sourceId, sourceUrl
- Lifecycle: deletedAt, version
- Extension: properties (unknown key storage)

**SCHEMA-02: JSON Schema Export**
Generate JSON Schema from Zod for Swift interop.
- File: `src/etl/types/canonical-node.schema.json`
- Used by Swift for validation

**SCHEMA-03: SQL Column Mapping**
Map camelCase TypeScript to snake_case SQL columns.
- File: `src/etl/types/canonical.ts` (SQL_COLUMN_MAP)
- Matches existing nodes table schema

### Coordinator Requirements (COORD)

**COORD-01: Import Coordinator**
Central router for file imports.
- File: `src/etl/coordinator/ImportCoordinator.ts`
- Methods: importFile(), importFiles(), getImporter(), detectFormat()
- Returns: CanonicalNode[]

**COORD-02: Base Importer Interface**
Abstract base class for all importers.
- File: `src/etl/importers/BaseImporter.ts`
- Methods: import(source): Promise<CanonicalNode[]>
- Abstract: parse(), validate(), transform()

**COORD-03: Format Detection**
Auto-detect file format from extension and magic bytes.
- Supported: .md, .markdown, .mdx, .xlsx, .xls, .docx, .json, .html, .htm, .csv, .tsv

### Importer Requirements (IMP)

**IMP-01: Markdown Importer**
Parse markdown with frontmatter.
- Extensions: .md, .markdown, .mdx
- Package: gray-matter (already installed)
- Output: Single node per file

**IMP-02: Excel Importer**
Parse Excel spreadsheets.
- Extensions: .xlsx, .xls
- Package: xlsx (SheetJS)
- Output: Node per sheet or configurable

**IMP-03: Word Importer**
Parse Word documents.
- Extensions: .docx
- Package: mammoth
- Output: Single node per file

**IMP-04: JSON Importer**
Parse JSON files with array/object detection.
- Extensions: .json
- Package: native JSON
- Output: Node per object or single node for object

**IMP-05: HTML Importer**
Parse HTML with conversion to markdown.
- Extensions: .html, .htm
- Package: turndown
- Output: Single node per file

**IMP-06: CSV Importer**
Parse CSV/TSV files.
- Extensions: .csv, .tsv
- Package: papaparse
- Output: Node per row or single node with array

### Integration Requirements (INT)

**INT-01: Window Export**
Expose ETL API on window for Swift bridge.
- File: `src/etl/bridge/window-export.ts`
- API: window.isometryETL.importFile(ext, base64)

**INT-02: Alto Importer Migration**
Migrate existing alto-importer to use CanonicalNode.
- Preserve backward compatibility
- Use new schema validation

**INT-03: Database Insertion**
Insert CanonicalNode[] into sql.js.
- Use existing nodes table schema
- Handle tags as JSON array
- Store unknown properties in node_properties

### Bridge Requirements (BRIDGE)

**BRIDGE-01: Swift ETL Bridge**
Delegate file processing to JS via WKWebView.
- File: `native/Sources/Isometry/Bridge/ETLBridge.swift`
- Method: importFile(url) -> [CanonicalNode]
- Base64 encode file data for JS

**BRIDGE-02: Native Adapters**
Swift-native adapters for system frameworks.
- EventKit adapter (calendar events)
- Contacts adapter (address book)
- Notes live sync (Apple Notes)
- HealthKit adapter (health data)

### Quality Requirements (QUAL)

**QUAL-01: Test Coverage**
>80% test coverage for ETL module.

**QUAL-02: Schema Validation**
Every import validates against CanonicalNodeSchema.

**QUAL-03: Error Handling**
Graceful failure with detailed error messages for malformed files.

## Phases

| Phase | Name | Requirements | Depends On |
|-------|------|--------------|------------|
| 67 | Canonical Schema | SCHEMA-01, SCHEMA-02, SCHEMA-03 | v4.7 complete |
| 68 | Import Coordinator | COORD-01, COORD-02, COORD-03 | Phase 67 |
| 69 | File Importers | IMP-01 through IMP-06 | Phase 68 |
| 70 | Integration | INT-01, INT-02, INT-03 | Phase 69 |
| 71 | Swift Bridge | BRIDGE-01, BRIDGE-02 | Phase 70 |
| 72 | Quality & Docs | QUAL-01, QUAL-02, QUAL-03 | Phase 71 |

## Dependencies to Add

```json
{
  "dependencies": {
    "zod": "^3.22.4",
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

Note: gray-matter and yaml already installed in v4.7.

## Success Criteria

1. All existing alto-index imports work unchanged
2. New formats import correctly: MD, XLSX, DOCX, JSON, HTML, CSV
3. Swift bridge successfully delegates to JS
4. Schema validated at every import
5. Test coverage >80% for ETL module
6. No regression in import performance

---
*Created: 2026-02-12*
*Source: etl-consolidation-plan.md*
