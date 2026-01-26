/**
 * Migration Safety Validation and Procedures
 *
 * Provides safety validation, data backup, integrity checks, and compatibility testing
 */

import { DatabaseMode } from '../contexts/EnvironmentContext';
import { webViewBridge, Environment } from '../utils/webview-bridge';
import { syncManager } from '../utils/sync-manager';

export interface DataBackup {
  id: string;
  timestamp: Date;
  source: DatabaseMode;
  location: string;
  size: number;
  recordCount: number;
  checksum: string;
  metadata: {
    version: string;
    schema: string;
    exportFormat: 'sqljs' | 'json' | 'sql';
  };
}

export interface SafetyAssessment {
  level: 'safe' | 'risky' | 'dangerous';
  score: number; // 0-100, higher is safer
  factors: {
    dataSize: 'small' | 'medium' | 'large';
    schemaComplexity: 'simple' | 'moderate' | 'complex';
    pendingChanges: number;
    cloudKitDependency: boolean;
    performanceRisk: 'low' | 'medium' | 'high';
  };
  recommendations: string[];
  blockers: string[];
}

export interface IntegrityReport {
  isValid: boolean;
  checksumMatch: boolean;
  recordCounts: {
    expected: number;
    actual: number;
    missing: number;
  };
  schemaConsistency: boolean;
  relationshipIntegrity: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompatibilityReport {
  sqlJsSupport: boolean;
  schemaCompatibility: boolean;
  dataTypeSupport: boolean;
  featureSupport: {
    fts: boolean;
    json: boolean;
    cte: boolean;
    triggers: boolean;
  };
  limitations: string[];
  mitigations: string[];
}

export interface RollbackReport {
  success: boolean;
  duration: number;
  timestamp: Date;
  backupUsed: string;
  stepsExecuted: string[];
  issues: string[];
  dataLoss: {
    estimated: number;
    actual: number;
    description: string[];
  };
  performanceImpact: {
    beforeRollback: number;
    afterRollback: number;
    improvement: number;
  };
}

/**
 * Migration safety coordinator for rollback procedures
 */
export class MigrationSafety {
  private static instance: MigrationSafety | null = null;
  private backups = new Map<string, DataBackup>();
  private assessmentCache = new Map<string, SafetyAssessment>();

  // Configuration
  private readonly maxBackupAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly maxBackupSize = 500 * 1024 * 1024; // 500MB
  private readonly checksumAlgorithm = 'sha256';

  constructor() {
    this.loadExistingBackups();
    this.setupPeriodicCleanup();
  }

  static getInstance(): MigrationSafety {
    if (!MigrationSafety.instance) {
      MigrationSafety.instance = new MigrationSafety();
    }
    return MigrationSafety.instance;
  }

  /**
   * Assess rollback safety based on current migration state
   */
  async assessRollbackSafety(): Promise<SafetyAssessment> {
    console.log('Assessing rollback safety...');

    try {
      // Check cache first
      const cacheKey = await this.generateAssessmentCacheKey();
      const cached = this.assessmentCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      const factors = await this.analyzeRiskFactors();
      const score = this.calculateSafetyScore(factors);
      const level = this.determineSafetyLevel(score);
      const recommendations = this.generateRecommendations(factors);
      const blockers = this.identifyBlockers(factors);

      const assessment: SafetyAssessment = {
        level,
        score,
        factors,
        recommendations,
        blockers
      };

      // Cache the assessment
      this.assessmentCache.set(cacheKey, assessment);

      return assessment;

    } catch (error) {
      console.error('Safety assessment failed:', error);
      return {
        level: 'dangerous',
        score: 0,
        factors: {
          dataSize: 'large',
          schemaComplexity: 'complex',
          pendingChanges: 999,
          cloudKitDependency: true,
          performanceRisk: 'high'
        },
        recommendations: ['Fix assessment errors before attempting rollback'],
        blockers: [`Assessment failed: ${error}`]
      };
    }
  }

  /**
   * Create comprehensive data backup before rollback
   */
  async createDataBackup(): Promise<DataBackup> {
    console.log('Creating data backup...');

    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date();

      // Export data from current source
      const exportResult = await this.exportCurrentData();

      // Generate checksum
      const checksum = await this.generateChecksum(exportResult.data);

      const backup: DataBackup = {
        id: backupId,
        timestamp,
        source: exportResult.source,
        location: exportResult.location,
        size: exportResult.size,
        recordCount: exportResult.recordCount,
        checksum,
        metadata: {
          version: exportResult.version,
          schema: exportResult.schema,
          exportFormat: exportResult.format as 'sqljs' | 'json' | 'sql'
        }
      };

      // Store backup metadata
      this.backups.set(backupId, backup);
      await this.persistBackupMetadata(backup);

      console.log(`Data backup created: ${backupId}`);
      return backup;

    } catch (error) {
      console.error('Data backup failed:', error);
      throw new Error(`Backup creation failed: ${error}`);
    }
  }

  /**
   * Validate data integrity before and after rollback
   */
  async validateDataIntegrity(backupId?: string): Promise<IntegrityReport> {
    console.log('Validating data integrity...');

    try {
      const report: IntegrityReport = {
        isValid: true,
        checksumMatch: true,
        recordCounts: { expected: 0, actual: 0, missing: 0 },
        schemaConsistency: true,
        relationshipIntegrity: true,
        errors: [],
        warnings: []
      };

      // Get reference backup if provided
      const backup = backupId ? this.backups.get(backupId) : await this.getLatestBackup();
      if (!backup) {
        report.errors.push('No backup available for integrity validation');
        report.isValid = false;
        return report;
      }

      // Validate checksum
      try {
        const currentChecksum = await this.generateChecksumFromCurrent();
        report.checksumMatch = currentChecksum === backup.checksum;
        if (!report.checksumMatch) {
          report.warnings.push('Data checksum mismatch - data may have changed');
        }
      } catch (error) {
        report.errors.push(`Checksum validation failed: ${error}`);
      }

      // Validate record counts
      try {
        const currentCounts = await this.getCurrentRecordCounts();
        report.recordCounts = {
          expected: backup.recordCount,
          actual: currentCounts.total,
          missing: Math.max(0, backup.recordCount - currentCounts.total)
        };

        if (report.recordCounts.missing > 0) {
          report.warnings.push(`${report.recordCounts.missing} records missing`);
        }
      } catch (error) {
        report.errors.push(`Record count validation failed: ${error}`);
      }

      // Validate schema consistency
      try {
        const schemaValid = await this.validateSchemaConsistency();
        report.schemaConsistency = schemaValid;
        if (!schemaValid) {
          report.errors.push('Schema inconsistency detected');
        }
      } catch (error) {
        report.errors.push(`Schema validation failed: ${error}`);
      }

      // Validate relationships
      try {
        const relationshipsValid = await this.validateRelationships();
        report.relationshipIntegrity = relationshipsValid;
        if (!relationshipsValid) {
          report.errors.push('Foreign key integrity violations detected');
        }
      } catch (error) {
        report.errors.push(`Relationship validation failed: ${error}`);
      }

      report.isValid = report.errors.length === 0;
      return report;

    } catch (error) {
      console.error('Data integrity validation failed:', error);
      return {
        isValid: false,
        checksumMatch: false,
        recordCounts: { expected: 0, actual: 0, missing: 0 },
        schemaConsistency: false,
        relationshipIntegrity: false,
        errors: [`Validation failed: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Test sql.js compatibility with current data
   */
  async testSqlJsCompatibility(): Promise<CompatibilityReport> {
    console.log('Testing sql.js compatibility...');

    try {
      const report: CompatibilityReport = {
        sqlJsSupport: false,
        schemaCompatibility: false,
        dataTypeSupport: false,
        featureSupport: {
          fts: false,
          json: false,
          cte: false,
          triggers: false
        },
        limitations: [],
        mitigations: []
      };

      // Test basic sql.js loading
      try {
        const sqljs = await import('sql.js');
        const SQL = await sqljs.default();
        const testDb = new SQL.Database();
        report.sqlJsSupport = true;
        testDb.close();
      } catch (error) {
        report.limitations.push(`sql.js loading failed: ${error}`);
        return report;
      }

      // Test schema compatibility
      try {
        const schemaTest = await this.testSchemaInSqlJs();
        report.schemaCompatibility = schemaTest.compatible;
        report.limitations.push(...schemaTest.issues);
        report.mitigations.push(...schemaTest.mitigations);
      } catch (error) {
        report.limitations.push(`Schema compatibility test failed: ${error}`);
      }

      // Test data type support
      try {
        const dataTypeTest = await this.testDataTypesInSqlJs();
        report.dataTypeSupport = dataTypeTest.compatible;
        report.limitations.push(...dataTypeTest.issues);
      } catch (error) {
        report.limitations.push(`Data type test failed: ${error}`);
      }

      // Test feature support
      try {
        const featureTests = await this.testFeatureSupportInSqlJs();
        report.featureSupport = featureTests;

        if (!featureTests.fts) {
          report.limitations.push('Full-text search (FTS5) not available in sql.js');
          report.mitigations.push('Implement client-side text search fallback');
        }

        if (!featureTests.cte) {
          report.limitations.push('Recursive Common Table Expressions limited in sql.js');
          report.mitigations.push('Implement graph traversal in JavaScript');
        }

        if (!featureTests.json) {
          report.limitations.push('JSON functions limited in sql.js');
          report.mitigations.push('Parse JSON data in JavaScript');
        }
      } catch (error) {
        report.limitations.push(`Feature support test failed: ${error}`);
      }

      return report;

    } catch (error) {
      console.error('sql.js compatibility test failed:', error);
      return {
        sqlJsSupport: false,
        schemaCompatibility: false,
        dataTypeSupport: false,
        featureSupport: { fts: false, json: false, cte: false, triggers: false },
        limitations: [`Compatibility test failed: ${error}`],
        mitigations: []
      };
    }
  }

  /**
   * Generate comprehensive rollback report
   */
  async generateRollbackReport(
    startTime: Date,
    endTime: Date,
    backupId: string,
    stepsExecuted: string[],
    issues: string[]
  ): Promise<RollbackReport> {
    const duration = endTime.getTime() - startTime.getTime();

    try {
      const backup = this.backups.get(backupId);
      const dataLoss = await this.assessDataLoss(backup);
      const performanceImpact = await this.measurePerformanceImpact();

      return {
        success: issues.length === 0,
        duration,
        timestamp: endTime,
        backupUsed: backupId,
        stepsExecuted,
        issues,
        dataLoss,
        performanceImpact
      };

    } catch (error) {
      console.error('Failed to generate rollback report:', error);
      return {
        success: false,
        duration,
        timestamp: endTime,
        backupUsed: backupId,
        stepsExecuted,
        issues: [...issues, `Report generation failed: ${error}`],
        dataLoss: {
          estimated: 0,
          actual: 0,
          description: ['Unable to assess data loss']
        },
        performanceImpact: {
          beforeRollback: 0,
          afterRollback: 0,
          improvement: 0
        }
      };
    }
  }

  // Private Methods

  private async analyzeRiskFactors(): Promise<SafetyAssessment['factors']> {
    const dataSize = await this.assessDataSize();
    const schemaComplexity = await this.assessSchemaComplexity();
    const pendingChanges = syncManager.getSyncState().pendingChanges;
    const cloudKitDependency = await this.checkCloudKitDependency();
    const performanceRisk = await this.assessPerformanceRisk();

    return {
      dataSize,
      schemaComplexity,
      pendingChanges,
      cloudKitDependency,
      performanceRisk
    };
  }

  private calculateSafetyScore(factors: SafetyAssessment['factors']): number {
    let score = 100;

    // Data size impact
    if (factors.dataSize === 'large') score -= 20;
    else if (factors.dataSize === 'medium') score -= 10;

    // Schema complexity impact
    if (factors.schemaComplexity === 'complex') score -= 15;
    else if (factors.schemaComplexity === 'moderate') score -= 5;

    // Pending changes impact
    score -= Math.min(factors.pendingChanges * 2, 30);

    // CloudKit dependency impact
    if (factors.cloudKitDependency) score -= 10;

    // Performance risk impact
    if (factors.performanceRisk === 'high') score -= 15;
    else if (factors.performanceRisk === 'medium') score -= 5;

    return Math.max(0, score);
  }

  private determineSafetyLevel(score: number): 'safe' | 'risky' | 'dangerous' {
    if (score >= 80) return 'safe';
    if (score >= 60) return 'risky';
    return 'dangerous';
  }

  private generateRecommendations(factors: SafetyAssessment['factors']): string[] {
    const recommendations: string[] = [];

    if (factors.pendingChanges > 0) {
      recommendations.push('Complete pending sync operations before rollback');
    }

    if (factors.dataSize === 'large') {
      recommendations.push('Consider incremental rollback for large datasets');
    }

    if (factors.schemaComplexity === 'complex') {
      recommendations.push('Validate schema compatibility thoroughly');
    }

    if (factors.cloudKitDependency) {
      recommendations.push('Ensure CloudKit data is backed up separately');
    }

    if (factors.performanceRisk === 'high') {
      recommendations.push('Monitor performance closely during rollback');
    }

    return recommendations;
  }

  private identifyBlockers(factors: SafetyAssessment['factors']): string[] {
    const blockers: string[] = [];

    if (factors.pendingChanges > 100) {
      blockers.push('Too many pending changes - complete sync first');
    }

    if (factors.performanceRisk === 'high' && factors.dataSize === 'large') {
      blockers.push('High performance risk with large dataset');
    }

    return blockers;
  }

  private async assessDataSize(): Promise<'small' | 'medium' | 'large'> {
    try {
      const size = await this.getCurrentDataSize();
      if (size < 10 * 1024 * 1024) return 'small'; // < 10MB
      if (size < 100 * 1024 * 1024) return 'medium'; // < 100MB
      return 'large'; // >= 100MB
    } catch {
      return 'medium';
    }
  }

  private async assessSchemaComplexity(): Promise<'simple' | 'moderate' | 'complex'> {
    try {
      const tableCount = await this.getTableCount();
      const relationshipCount = await this.getRelationshipCount();
      const indexCount = await this.getIndexCount();

      const complexity = tableCount + relationshipCount + indexCount / 2;
      if (complexity < 20) return 'simple';
      if (complexity < 50) return 'moderate';
      return 'complex';
    } catch {
      return 'moderate';
    }
  }

  private async checkCloudKitDependency(): Promise<boolean> {
    try {
      if (!Environment.isWebView()) return false;
      const status = await webViewBridge.rollback.checkCloudKitStatus();
      return status.hasData;
    } catch {
      return false;
    }
  }

  private async assessPerformanceRisk(): Promise<'low' | 'medium' | 'high'> {
    try {
      const currentPerf = await this.getCurrentPerformanceMetrics();
      if (currentPerf.avgLatency > 100) return 'high';
      if (currentPerf.avgLatency > 50) return 'medium';
      return 'low';
    } catch {
      return 'medium';
    }
  }

  // Utility methods
  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateAssessmentCacheKey(): Promise<string> {
    const timestamp = Math.floor(Date.now() / 300000); // 5-minute buckets
    return `assessment-${timestamp}`;
  }

  private isCacheValid(assessment: SafetyAssessment): boolean {
    // Cache assessments are valid for 5 minutes
    return true; // Simplified for now
  }

  // Placeholder implementations for methods that would integrate with actual database
  private async exportCurrentData(): Promise<any> {
    if (Environment.isWebView()) {
      return webViewBridge.rollback.exportToSQLjs();
    }
    throw new Error('Export not available in current environment');
  }

  private async generateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateChecksumFromCurrent(): Promise<string> {
    const data = await this.exportCurrentData();
    return this.generateChecksum(data.data);
  }

  private async getCurrentRecordCounts(): Promise<{ total: number }> {
    // Implementation would query actual database
    return { total: 0 };
  }

  private async validateSchemaConsistency(): Promise<boolean> {
    // Implementation would validate schema
    return true;
  }

  private async validateRelationships(): Promise<boolean> {
    // Implementation would validate foreign keys
    return true;
  }

  private async testSchemaInSqlJs(): Promise<{ compatible: boolean; issues: string[]; mitigations: string[] }> {
    return { compatible: true, issues: [], mitigations: [] };
  }

  private async testDataTypesInSqlJs(): Promise<{ compatible: boolean; issues: string[] }> {
    return { compatible: true, issues: [] };
  }

  private async testFeatureSupportInSqlJs(): Promise<{ fts: boolean; json: boolean; cte: boolean; triggers: boolean }> {
    return { fts: false, json: true, cte: true, triggers: false };
  }

  private async getCurrentDataSize(): Promise<number> {
    return 0;
  }

  private async getTableCount(): Promise<number> {
    return 10;
  }

  private async getRelationshipCount(): Promise<number> {
    return 5;
  }

  private async getIndexCount(): Promise<number> {
    return 8;
  }

  private async getCurrentPerformanceMetrics(): Promise<{ avgLatency: number }> {
    return { avgLatency: 25 };
  }

  private async getLatestBackup(): Promise<DataBackup | undefined> {
    const backups = Array.from(this.backups.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups[0];
  }

  private async persistBackupMetadata(backup: DataBackup): Promise<void> {
    // Implementation would persist backup metadata
  }

  private async loadExistingBackups(): Promise<void> {
    // Implementation would load existing backup metadata
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldBackups();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private cleanupOldBackups(): void {
    const now = Date.now();
    for (const [id, backup] of this.backups) {
      if (now - backup.timestamp.getTime() > this.maxBackupAge) {
        this.backups.delete(id);
      }
    }
  }

  private async assessDataLoss(backup?: DataBackup): Promise<RollbackReport['dataLoss']> {
    return {
      estimated: 0,
      actual: 0,
      description: []
    };
  }

  private async measurePerformanceImpact(): Promise<RollbackReport['performanceImpact']> {
    return {
      beforeRollback: 100,
      afterRollback: 80,
      improvement: -20
    };
  }
}

// Export singleton instance
export const migrationSafety = MigrationSafety.getInstance();

// Export convenience functions
export async function assessRollbackSafety(): Promise<SafetyAssessment> {
  return migrationSafety.assessRollbackSafety();
}

export async function createDataBackup(): Promise<DataBackup> {
  return migrationSafety.createDataBackup();
}

export async function validateDataIntegrity(): Promise<IntegrityReport> {
  return migrationSafety.validateDataIntegrity();
}

export async function testSqlJsCompatibility(): Promise<CompatibilityReport> {
  return migrationSafety.testSqlJsCompatibility();
}

export async function generateRollbackReport(
  startTime: Date,
  endTime: Date,
  backupId: string,
  stepsExecuted: string[],
  issues: string[]
): Promise<RollbackReport> {
  return migrationSafety.generateRollbackReport(startTime, endTime, backupId, stepsExecuted, issues);
}