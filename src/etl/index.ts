// Isometry v5 — Phase 8 ETL Module
// Public exports for import/export pipeline

export type {
  SourceType,
  CanonicalCard,
  CanonicalConnection,
  ParseError,
  ImportResult,
  AltoAttachment,
  AltoNoteFrontmatter,
} from './types';

// Deduplication (ETL-10)
export { DedupEngine } from './DedupEngine';
export type { DedupResult } from './DedupEngine';

// Database Writer (ETL-11)
export { SQLiteWriter } from './SQLiteWriter';

// Parsers (all sources)
export { AppleNotesParser } from './parsers/AppleNotesParser';
export type { ParsedFile, AppleNotesParseResult } from './parsers/AppleNotesParser';
export { MarkdownParser } from './parsers/MarkdownParser';
export { CSVParser } from './parsers/CSVParser';
export { JSONParser } from './parsers/JSONParser';
export { ExcelParser } from './parsers/ExcelParser';
export { HTMLParser } from './parsers/HTMLParser';

// Catalog (ETL-13)
export { CatalogWriter } from './CatalogWriter';
export type { ImportRunRecord } from './CatalogWriter';

// Import Orchestrator (ETL-12)
export { ImportOrchestrator } from './ImportOrchestrator';
export type { ImportOptions } from './ImportOrchestrator';

// Exporters (ETL-14, ETL-15, ETL-16)
export { MarkdownExporter } from './exporters/MarkdownExporter';
export { JSONExporter, type JSONExportData } from './exporters/JSONExporter';
export { CSVExporter } from './exporters/CSVExporter';

// Export Orchestrator (ETL-17)
export { ExportOrchestrator } from './ExportOrchestrator';
export type { ExportFormat, ExportOptions, ExportResult } from './ExportOrchestrator';
