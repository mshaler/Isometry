/**
 * Data Integrity Test Types
 *
 * Type definitions for data validation and integrity testing
 */

import { DatabaseMode } from '../../contexts/EnvironmentContext';

export interface ConsistencyReport {
  provider: DatabaseMode;
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  consistencyScore: number; // 0-100
  details: ConsistencyCheck[];
  summary: string;
}

export interface ConsistencyCheck {
  name: string;
  type: 'field-comparison' | 'relationship-integrity' | 'schema-compliance' | 'data-type-validation';
  passed: boolean;
  expected: unknown;
  actual: unknown;
  deviation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface IntegrityReport {
  migrationPath: MigrationPath;
  timestamp: string;
  preMigrationChecksum: string;
  postMigrationChecksum: string;
  checksumMatch: boolean;
  dataLoss: DataLossAnalysis;
  corruption: CorruptionAnalysis;
  relationships: RelationshipIntegrity;
  passed: boolean;
}

export interface MigrationPath {
  source: DatabaseMode;
  target: DatabaseMode;
  strategy: 'direct' | 'staged' | 'parallel';
}

export interface DataLossAnalysis {
  recordsLost: number;
  fieldsCorrupted: number;
  relationshipsBroken: number;
  summary: string;
}

export interface CorruptionAnalysis {
  totalIssues: number;
  criticalIssues: number;
  details: CorruptionDetail[];
  resolvable: boolean;
}

export interface CorruptionDetail {
  table: string;
  recordId: string;
  field: string;
  issue: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface RelationshipIntegrity {
  totalRelationships: number;
  validRelationships: number;
  brokenRelationships: string[];
  orphanedRecords: string[];
}

export interface ConcurrencyReport {
  conflictsDetected: number;
  conflictsResolved: number;
  unresolvedConflicts: ConflictData[];
  resolutionStrategies: ConflictResolution[];
  integrity: boolean;
}

export interface ConflictResolution {
  type: 'last-write-wins' | 'merge' | 'manual' | 'reject';
  description: string;
  success: boolean;
}

export interface TestNode {
  id: string;
  name: string;
  content: string;
  nodeType: string;
  tags: string[];
  folder: string;
}

export interface TestNotebookCard {
  id: string;
  nodeId: string;
  cardType: 'capture' | 'shell' | 'preview';
  markdownContent: string;
  renderedContent: string;
}

export interface TestEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
}

export interface ConflictData {
  recordId: string;
  table: string;
  conflictingFields: string[];
}

export interface ConcurrencyOperation {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId: string;
}

export interface TestDataset {
  nodes: TestNode[];
  edges: TestEdge[];
  notebookCards: TestNotebookCard[];
  metadata: DatasetMetadata;
}

export interface DatasetMetadata {
  totalRecords: number;
  createdAt: string;
  checksum: string;
}
