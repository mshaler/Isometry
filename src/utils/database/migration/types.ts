/**
 * Types for Migration Validation System
 */

// Local enum definition to avoid context imports from utils
export enum DatabaseMode {
  HTTP_API = 'http-api',
  WEBVIEW_BRIDGE = 'webview-bridge',
  FALLBACK = 'fallback',
  AUTO = 'auto'
}

export interface ValidationResult {
  success: boolean;
  validationsPassed: number;
  validationsFailed: number;
  details: ValidationDetail[];
  recommendations: string[];
  canProceed: boolean;
}

export interface ValidationDetail {
  check: string;
  category: 'data-integrity' | 'performance' | 'security' | 'compatibility';
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  remediation?: string;
}

export interface RollbackResult {
  success: boolean;
  strategy: RollbackStrategy;
  dataPreserved: boolean;
  performanceRestored: boolean;
  errors: string[];
  duration: number;
  checkpointRestored?: string;
}

export interface RollbackStrategy {
  type: 'checkpoint-restore' | 'provider-switch' | 'data-restore' | 'configuration-reset';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  prerequisites: string[];
  successCriteria: string[];
}

export interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  provider: DatabaseMode;
  dataSnapshot: DataSnapshot;
  configurationSnapshot: ConfigurationSnapshot;
  metadata: CheckpointMetadata;
}

export interface DataSnapshot {
  size: number;
  checksum: string;
  compressionRatio: number;
  tables: Record<string, number>;
  indices: string[];
}

export interface ConfigurationSnapshot {
  settings: Record<string, any>;
  environment: string;
  version: string;
}

export interface CheckpointMetadata {
  createdBy: string;
  reason: string;
  tags: string[];
}

export interface RestoreResult {
  success: boolean;
  checkpointId: string;
  dataRestored: boolean;
  configurationRestored: boolean;
  errors: string[];
  warnings: string[];
  performanceMetrics: {
    restoreDuration: number;
    dataTransferRate: number;
  };
}

export interface RollbackScenario {
  reason: 'migration-failure' | 'performance-degradation' | 'data-corruption' | 'user-request';
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetProvider?: DatabaseMode;
  preserveData: boolean;
  timeConstraint?: number; // Maximum rollback duration in ms
  userConfirmed: boolean;
  additionalContext?: Record<string, any>;
}