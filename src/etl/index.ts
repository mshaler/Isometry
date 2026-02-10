/**
 * ETL Module Index
 *
 * Exports for alto-index parsing and importing functionality.
 */

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
