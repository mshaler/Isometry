/**
 * Data Integrity Validation Test Suite
 *
 * Comprehensive data validation leveraging established sync and security infrastructure
 * Ensures zero corruption across migration path with safe rollback procedures
 */

// Re-export types and utilities from split modules
export type {
  ConsistencyReport,
  ConsistencyCheck,
  IntegrityReport,
  MigrationPath,
  DataLossAnalysis,
  CorruptionAnalysis,
  CorruptionDetail,
  RelationshipIntegrity,
  ConcurrencyReport,
  ConflictResolution,
  TestNode,
  TestNotebookCard,
  TestEdge,
  ConflictData,
  ConcurrencyOperation,
  TestDataset,
  DatasetMetadata
} from './types/integrity-types';

export {
  validateDataConsistency,
  validateDataIntegrity,
  validateConcurrency,
  checkNodeCorruption,
  checkNotebookCardCorruption,
  checkEdgeCorruption
} from './utils/integrity-validation';

export {
  getNodeFromProvider,
  getEdgeFromProvider,
  getNotebookCardFromProvider,
  generateTestDataset
} from './mocks/data-providers';