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

// Parsers (ETL-04)
export { AppleNotesParser } from './parsers/AppleNotesParser';
export type { ParsedFile, AppleNotesParseResult } from './parsers/AppleNotesParser';

// Catalog (ETL-13)
export { CatalogWriter } from './CatalogWriter';
export type { ImportRunRecord } from './CatalogWriter';
