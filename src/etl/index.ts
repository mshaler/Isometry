/**
 * ETL Module Index
 *
 * Exports for ETL functionality:
 * - alto-index parsing and importing
 * - Canonical schema and validation
 * - Import coordinator and file importers
 * - Database insertion utilities
 * - Window bridge API
 */

// Alto-index parser (legacy)
export {
  parseAltoFile,
  parseFrontmatter,
  extractTags,
  detectDataType,
  generateSourceId,
  type ParsedAltoFile,
  type AltoFrontmatter,
  type AltoDataType,
  type AltoAttachment,
  type AltoLink,
  type AltoAttendee,
  type AltoAlarm,
} from './alto-parser';

export {
  importAltoFiles,
  mapToNodeRecord,
  getImportStats,
  clearAltoIndexData,
  type ImportOptions,
  type ImportResult,
  type NodeRecord,
} from './alto-importer';

// Canonical schema and types
export {
  CanonicalNodeSchema,
  CanonicalNodeInputSchema,
  SQL_COLUMN_MAP,
  toSQLRecord,
  fromSQLRecord,
  type CanonicalNode,
  type CanonicalNodeInput,
} from './types/canonical';

// Import coordinator
export { ImportCoordinator } from './coordinator/ImportCoordinator';

// Database insertion
export { insertCanonicalNodes, type InsertResult, type InsertOptions } from './database/insertion';

// Window bridge API
export {
  initializeETLBridge,
  cleanupETLBridge,
  isETLBridgeInitialized,
} from './bridge/window-export';
