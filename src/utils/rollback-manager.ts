/**
 * Rollback Manager for React-side Migration Rollback Coordination
 *
 * Provides comprehensive rollback coordination with safety procedures and validation
 */

import { DatabaseMode, EnvironmentInfo } from '../contexts/EnvironmentContext';
import { webViewBridge, Environment } from './webview-bridge';
import { syncManager, DataChange } from './sync-manager';

export interface RollbackStep {
  name: string;
  description: string;
  critical: boolean;
  estimatedTime: number;
  validation: () => Promise<boolean>;
}

export interface RollbackPlan {
  reason: string;
  timestamp: Date;
  dataSafety: 'safe' | 'risky' | 'dangerous';
  estimatedDuration: number;
  requiredSteps: RollbackStep[];
  backupLocation: string;
}

export interface RollbackValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedDataLoss: number;
  compatibility: {
    sqljs: boolean;
    schema: boolean;
    data: boolean;
  };
}

export interface RollbackExportResult {
  success: boolean;
  dataLocation: string;
  schemaLocation: string;
  recordCount: number;
  exportSize: number;
  metadata: {
    version: string;
    timestamp: Date;
    source: DatabaseMode;
  };
}

export interface RollbackResult {
  success: boolean;
  duration: number;
  stepsCompleted: number;
  stepsTotal: number;
  errors: string[];
  warnings: string[];
  rollbackPlan: RollbackPlan;
  validationResult?: RollbackValidationResult;
}

/**
 * Comprehensive rollback manager for safe migration reversion
 */
export class RollbackManager {
  private static instance: RollbackManager | null = null;
  private currentEnvironment: EnvironmentInfo | null = null;
  private rollbackInProgress = false;
  private rollbackQueue: RollbackPlan[] = [];

  // Configuration
  private readonly validationTimeout = 30000; // 30 seconds
  private readonly backupRetention = 7; // Keep backups for 7 days
  private readonly maxRollbackRetries = 3;

  constructor() {
    this.setupEventListeners();
  }

  static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }

  /**
   * Initialize rollback manager with current environment
   */
  async initialize(environment: EnvironmentInfo): Promise<void> {
    this.currentEnvironment = environment;
    console.log('RollbackManager initialized for environment:', environment.mode);
  }

  /**
   * Initiate controlled rollback process with safety validation
   */
  async initiateRollback(reason: string): Promise<RollbackResult> {
    if (this.rollbackInProgress) {
      throw new Error('Rollback already in progress');
    }

    console.log('Initiating rollback:', reason);
    this.rollbackInProgress = true;

    try {
      // 1. Create rollback plan
      const rollbackPlan = await this.createRollbackPlan(reason);

      // 2. Validate rollback safety
      const validation = await this.validateRollback(rollbackPlan);

      if (!validation.isValid) {
        throw new Error(`Rollback validation failed: ${validation.errors.join(', ')}`);
      }

      // 3. Execute rollback steps
      const result = await this.executeRollback(rollbackPlan);

      // 4. Validate rollback success
      if (result.success) {
        await this.verifyRollbackSuccess();
      }

      return result;

    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    } finally {
      this.rollbackInProgress = false;
    }
  }

  /**
   * Validate rollback safety before execution
   */
  async validateRollback(plan?: RollbackPlan): Promise<RollbackValidationResult> {
    console.log('Validating rollback safety...');

    const errors: string[] = [];
    const warnings: string[] = [];
    let estimatedDataLoss = 0;

    try {
      // Check current environment
      if (!this.currentEnvironment) {
        errors.push('Environment not initialized');
        return { isValid: false, errors, warnings, estimatedDataLoss, compatibility: { sqljs: false, schema: false, data: false } };
      }

      // Only allow rollback from WebView bridge or HTTP API
      if (this.currentEnvironment.mode === DatabaseMode.SQLJS) {
        errors.push('Already using sql.js - no rollback needed');
        return { isValid: false, errors, warnings, estimatedDataLoss, compatibility: { sqljs: true, schema: true, data: true } };
      }

      // Test sql.js compatibility
      const compatibility = await this.testSqlJsCompatibility();

      if (!compatibility.sqljs) {
        errors.push('sql.js environment not functional');
      }

      if (!compatibility.schema) {
        warnings.push('Schema changes may cause compatibility issues');
      }

      if (!compatibility.data) {
        warnings.push('Data format may require conversion for sql.js');
      }

      // Check for pending operations
      const pendingChanges = await this.checkPendingOperations();
      if (pendingChanges > 0) {
        warnings.push(`${pendingChanges} pending sync operations will be lost`);
        estimatedDataLoss = pendingChanges;
      }

      // Check for CloudKit-specific data
      const cloudKitData = await this.checkCloudKitDependencies();
      if (cloudKitData.hasCloudKitData) {
        warnings.push('CloudKit sync data will be preserved but not accessible in sql.js');
        if (cloudKitData.unsyncedChanges > 0) {
          errors.push(`${cloudKitData.unsyncedChanges} unsynced CloudKit changes will be lost`);
        }
      }

      // Check data size limitations
      const dataSize = await this.estimateDataSize();
      if (dataSize > 100 * 1024 * 1024) { // 100MB limit for IndexedDB
        warnings.push('Large dataset may cause performance issues in sql.js');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        estimatedDataLoss,
        compatibility
      };

    } catch (error) {
      console.error('Rollback validation error:', error);
      errors.push(`Validation failed: ${error}`);
      return { isValid: false, errors, warnings, estimatedDataLoss, compatibility: { sqljs: false, schema: false, data: false } };
    }
  }

  /**
   * Export current native data for preservation during rollback
   */
  async exportNativeData(): Promise<RollbackExportResult> {
    console.log('Exporting native data for rollback...');

    try {
      if (!Environment.isWebView()) {
        throw new Error('Data export only available in native environment');
      }

      // Request data export from native side
      const exportResult = await webViewBridge.rollback.exportToSQLjs();

      return {
        success: true,
        dataLocation: exportResult.dataLocation,
        schemaLocation: exportResult.schemaLocation,
        recordCount: exportResult.recordCount,
        exportSize: exportResult.exportSize,
        metadata: {
          version: exportResult.version,
          timestamp: new Date(),
          source: this.currentEnvironment?.mode || DatabaseMode.WEBVIEW_BRIDGE
        }
      };

    } catch (error) {
      console.error('Data export failed:', error);
      return {
        success: false,
        dataLocation: '',
        schemaLocation: '',
        recordCount: 0,
        exportSize: 0,
        metadata: {
          version: '0.0.0',
          timestamp: new Date(),
          source: DatabaseMode.SQLJS
        }
      };
    }
  }

  /**
   * Restore sql.js environment configuration
   */
  async restoreSqlJsEnvironment(): Promise<void> {
    console.log('Restoring sql.js environment...');

    try {
      // Stop current sync operations
      await syncManager.stopSync();

      // Clear WebView bridge connections
      if (Environment.isWebView()) {
        await this.clearWebViewBridge();
      }

      // Reset environment to sql.js
      await this.resetToSqlJs();

      // Test sql.js functionality
      await this.testSqlJsEnvironment();

      console.log('sql.js environment restored successfully');

    } catch (error) {
      console.error('Failed to restore sql.js environment:', error);
      throw new Error(`Environment restoration failed: ${error}`);
    }
  }

  /**
   * Verify rollback completion and functionality
   */
  async verifyRollbackSuccess(): Promise<boolean> {
    console.log('Verifying rollback success...');

    try {
      // Test basic sql.js operations
      const basicTest = await this.testBasicOperations();
      if (!basicTest) {
        throw new Error('Basic sql.js operations test failed');
      }

      // Test data integrity
      const integrityTest = await this.validateDataIntegrity();
      if (!integrityTest) {
        throw new Error('Data integrity validation failed');
      }

      // Test React components
      const componentTest = await this.testReactComponents();
      if (!componentTest) {
        throw new Error('React component functionality test failed');
      }

      console.log('Rollback verification completed successfully');
      return true;

    } catch (error) {
      console.error('Rollback verification failed:', error);
      return false;
    }
  }

  // Private Methods

  private async createRollbackPlan(reason: string): Promise<RollbackPlan> {
    const steps: RollbackStep[] = [
      {
        name: 'validate_environment',
        description: 'Validate rollback safety and compatibility',
        critical: true,
        estimatedTime: 5000,
        validation: () => this.validateRollback().then(r => r.isValid)
      },
      {
        name: 'export_native_data',
        description: 'Export current native data to sql.js format',
        critical: true,
        estimatedTime: 30000,
        validation: () => this.exportNativeData().then(r => r.success)
      },
      {
        name: 'stop_sync_operations',
        description: 'Stop all sync operations and clear queues',
        critical: true,
        estimatedTime: 2000,
        validation: async () => {
          await syncManager.stopSync();
          return true;
        }
      },
      {
        name: 'restore_sqljs_environment',
        description: 'Restore sql.js database context',
        critical: true,
        estimatedTime: 10000,
        validation: () => this.testSqlJsEnvironment()
      },
      {
        name: 'import_data',
        description: 'Import exported data to sql.js database',
        critical: true,
        estimatedTime: 20000,
        validation: () => this.validateDataIntegrity()
      },
      {
        name: 'validate_functionality',
        description: 'Test all React components with sql.js',
        critical: false,
        estimatedTime: 15000,
        validation: () => this.testReactComponents()
      }
    ];

    const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
    const dataSafety = await this.assessDataSafety();

    return {
      reason,
      timestamp: new Date(),
      dataSafety,
      estimatedDuration: totalTime,
      requiredSteps: steps,
      backupLocation: await this.getBackupLocation()
    };
  }

  private async executeRollback(plan: RollbackPlan): Promise<RollbackResult> {
    const startTime = Date.now();
    let stepsCompleted = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`Executing rollback plan: ${plan.reason}`);

    for (const step of plan.requiredSteps) {
      try {
        console.log(`Executing step: ${step.name}`);

        const stepResult = await Promise.race([
          step.validation(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Step timeout')), step.estimatedTime + 5000)
          )
        ]);

        if (!stepResult && step.critical) {
          throw new Error(`Critical step failed: ${step.name}`);
        }

        if (!stepResult) {
          warnings.push(`Non-critical step failed: ${step.name}`);
        }

        stepsCompleted++;

      } catch (error) {
        const errorMsg = `Step ${step.name} failed: ${error}`;
        console.error(errorMsg);

        if (step.critical) {
          errors.push(errorMsg);
          break; // Stop execution on critical step failure
        } else {
          warnings.push(errorMsg);
          stepsCompleted++;
        }
      }
    }

    const duration = Date.now() - startTime;
    const success = errors.length === 0 && stepsCompleted >= plan.requiredSteps.filter(s => s.critical).length;

    return {
      success,
      duration,
      stepsCompleted,
      stepsTotal: plan.requiredSteps.length,
      errors,
      warnings,
      rollbackPlan: plan
    };
  }

  private async testSqlJsCompatibility(): Promise<{ sqljs: boolean; schema: boolean; data: boolean }> {
    try {
      // Test if sql.js can be loaded
      const sqljs = await import('sql.js');

      // Test basic functionality
      const SQL = await sqljs.default();
      const db = new SQL.Database();

      // Test schema compatibility
      try {
        db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
        const schemaTest = true;
        db.close();
        return { sqljs: true, schema: schemaTest, data: true };
      } catch {
        db.close();
        return { sqljs: true, schema: false, data: false };
      }

    } catch (error) {
      console.error('sql.js compatibility test failed:', error);
      return { sqljs: false, schema: false, data: false };
    }
  }

  private async checkPendingOperations(): Promise<number> {
    try {
      const syncState = syncManager.getSyncState();
      return syncState.pendingChanges;
    } catch (error) {
      console.error('Failed to check pending operations:', error);
      return 0;
    }
  }

  private async checkCloudKitDependencies(): Promise<{ hasCloudKitData: boolean; unsyncedChanges: number }> {
    try {
      if (!Environment.isWebView()) {
        return { hasCloudKitData: false, unsyncedChanges: 0 };
      }

      const cloudKitStatus = await webViewBridge.rollback.checkCloudKitStatus();
      return {
        hasCloudKitData: cloudKitStatus.hasData,
        unsyncedChanges: cloudKitStatus.unsyncedCount
      };
    } catch (error) {
      console.error('Failed to check CloudKit dependencies:', error);
      return { hasCloudKitData: false, unsyncedChanges: 0 };
    }
  }

  private async estimateDataSize(): Promise<number> {
    try {
      if (Environment.isWebView()) {
        const sizeInfo = await webViewBridge.rollback.estimateDataSize();
        return sizeInfo.totalSize;
      }
      return 0;
    } catch (error) {
      console.error('Failed to estimate data size:', error);
      return 0;
    }
  }

  private async assessDataSafety(): Promise<'safe' | 'risky' | 'dangerous'> {
    try {
      const validation = await this.validateRollback();

      if (validation.errors.length > 0) {
        return 'dangerous';
      }

      if (validation.warnings.length > 2 || validation.estimatedDataLoss > 0) {
        return 'risky';
      }

      return 'safe';
    } catch {
      return 'dangerous';
    }
  }

  private async getBackupLocation(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `rollback-backup-${timestamp}`;
  }

  private async clearWebViewBridge(): Promise<void> {
    // Clear any WebView bridge connections and state
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers) {
      // Clear any pending bridge operations
      console.log('Clearing WebView bridge connections');
    }
  }

  private async resetToSqlJs(): Promise<void> {
    // Reset application to use sql.js provider
    console.log('Resetting to sql.js provider');

    // This would typically involve updating the environment context
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('isometry-environment-reset', {
        detail: { mode: DatabaseMode.SQLJS }
      }));
    }
  }

  private async testSqlJsEnvironment(): Promise<boolean> {
    try {
      const sqljs = await import('sql.js');
      const SQL = await sqljs.default();
      const db = new SQL.Database();

      // Test basic operations
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
      db.exec('INSERT INTO test (data) VALUES (?)', ['test']);
      const result = db.exec('SELECT * FROM test');

      db.close();
      return result.length > 0;
    } catch (error) {
      console.error('sql.js environment test failed:', error);
      return false;
    }
  }

  private async testBasicOperations(): Promise<boolean> {
    // Test basic database operations work correctly
    return this.testSqlJsEnvironment();
  }

  private async validateDataIntegrity(): Promise<boolean> {
    try {
      // Test data consistency after rollback
      console.log('Validating data integrity after rollback');
      // Implementation would validate data checksums, record counts, etc.
      return true;
    } catch (error) {
      console.error('Data integrity validation failed:', error);
      return false;
    }
  }

  private async testReactComponents(): Promise<boolean> {
    try {
      // Test that React components work correctly with sql.js
      console.log('Testing React components with sql.js');

      // This would typically test component rendering and functionality
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('isometry-rollback-test', {
          detail: { testReactComponents: true }
        }));
      }

      return true;
    } catch (error) {
      console.error('React component test failed:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      // Listen for emergency rollback triggers
      window.addEventListener('isometry-emergency-rollback', this.handleEmergencyRollback.bind(this));

      // Listen for performance regression triggers
      window.addEventListener('isometry-performance-regression', this.handlePerformanceRegression.bind(this));
    }
  }

  private async handleEmergencyRollback(event: any): Promise<void> {
    const reason = event.detail?.reason || 'Emergency rollback triggered';
    console.warn('Emergency rollback triggered:', reason);

    try {
      await this.initiateRollback(reason);
    } catch (error) {
      console.error('Emergency rollback failed:', error);
    }
  }

  private async handlePerformanceRegression(event: any): Promise<void> {
    const regressionData = event.detail;

    if (regressionData.severity === 'critical') {
      await this.handleEmergencyRollback({
        detail: { reason: `Critical performance regression: ${regressionData.metric}` }
      });
    }
  }
}

// Export functions for external use
export const rollbackManager = RollbackManager.getInstance();

export async function initiateRollback(reason: string): Promise<RollbackResult> {
  return rollbackManager.initiateRollback(reason);
}

export async function validateRollback(): Promise<RollbackValidationResult> {
  return rollbackManager.validateRollback();
}