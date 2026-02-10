/**
 * Migration Validator
 *
 * Provides migration validation utilities and rollback procedures
 * Leverages sync infrastructure for comprehensive migration safety
 */

import { devLogger } from '../logging/dev-logger';

// Import extracted modules
import type {
  DatabaseMode,
  ValidationResult,
  ValidationDetail,
  RollbackResult,
  RollbackScenario
} from './migration/types';

import { MigrationValidationService } from './migration/validator';
import { CheckpointManager } from './migration/checkpointManager';
import { RollbackManager } from './migration/rollbackManager';

export class MigrationValidator {
  private validationService: MigrationValidationService;
  private checkpointManager: CheckpointManager;
  private rollbackManager: RollbackManager;

  constructor() {
    this.validationService = new MigrationValidationService();
    this.checkpointManager = new CheckpointManager();
    this.rollbackManager = new RollbackManager();
  }

  /**
   * Validate migration path from one provider to another
   */
  async validateMigrationPath(from: DatabaseMode, to: DatabaseMode): Promise<ValidationResult> {
    devLogger.inspect('Validating migration path', { from, to });

    const details: ValidationDetail[] = [];
    let validationsPassed = 0;
    let validationsFailed = 0;

    try {
      // Data integrity validation
      const dataIntegrityChecks = await this.validationService.validateDataIntegrity(from);
      details.push(...dataIntegrityChecks);
      validationsPassed += dataIntegrityChecks.filter(c => c.passed).length;
      validationsFailed += dataIntegrityChecks.filter(c => !c.passed).length;

      // Performance readiness validation
      const performanceChecks = await this.validationService.validatePerformanceReadiness(from, to);
      details.push(...performanceChecks);
      validationsPassed += performanceChecks.filter(c => c.passed).length;
      validationsFailed += performanceChecks.filter(c => !c.passed).length;

      // Security compliance validation
      const securityChecks = await this.validationService.validateSecurityCompliance(to);
      details.push(...securityChecks);
      validationsPassed += securityChecks.filter(c => c.passed).length;
      validationsFailed += securityChecks.filter(c => !c.passed).length;

      // Compatibility validation
      const compatibilityChecks = await this.validationService.validateCompatibility(from, to);
      details.push(...compatibilityChecks);
      validationsPassed += compatibilityChecks.filter(c => c.passed).length;
      validationsFailed += compatibilityChecks.filter(c => !c.passed).length;

      // Environment readiness validation
      const environmentChecks = await this.validationService.validateEnvironmentReadiness(to);
      details.push(...environmentChecks);
      validationsPassed += environmentChecks.filter(c => c.passed).length;
      validationsFailed += environmentChecks.filter(c => !c.passed).length;

      // Determine if migration can proceed
      const criticalFailures = details.filter(d => d.severity === 'critical' && !d.passed);
      const canProceed = criticalFailures.length === 0;

      // Generate recommendations
      const recommendations = this.validationService.generateValidationRecommendations(details, canProceed);

      const result: ValidationResult = {
        success: canProceed,
        validationsPassed,
        validationsFailed,
        details,
        recommendations,
        canProceed
      };

      devLogger.setup('Migration validation completed', {
        from,
        to,
        passed: validationsPassed,
        failed: validationsFailed,
        canProceed
      });

      return result;

    } catch (error) {
      devLogger.error('Migration validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        validationsPassed,
        validationsFailed: validationsFailed + 1,
        details: [...details, {
          check: 'validation-execution',
          category: 'data-integrity',
          passed: false,
          message: `Validation execution failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'critical'
        }],
        recommendations: ['🚫 Migration validation failed - resolve technical issues before proceeding'],
        canProceed: false
      };
    }
  }

  /**
   * Execute rollback strategy
   */
  async executeRollback(scenario: RollbackScenario): Promise<RollbackResult> {
    return this.rollbackManager.executeRollback(
      scenario,
      (rollbackScenario) => this.checkpointManager.restoreFromCheckpoint(rollbackScenario)
    );
  }

  /**
   * Create migration checkpoint
   */
  async createMigrationCheckpoint(
    reason: string = 'pre-migration',
    description: string = 'Automated checkpoint before migration'
  ) {
    return this.checkpointManager.createMigrationCheckpoint(reason as any, description);
  }

  /**
   * Get available checkpoints
   */
  getAvailableCheckpoints() {
    return this.checkpointManager.getAvailableCheckpoints();
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): boolean {
    return this.checkpointManager.deleteCheckpoint(checkpointId);
  }

  /**
   * Select rollback strategy for scenario
   */
  selectRollbackStrategy(scenario: RollbackScenario) {
    return this.rollbackManager.selectRollbackStrategy(scenario);
  }
}

// Export types for external use
export type {
  DatabaseMode,
  ValidationResult,
  ValidationDetail,
  RollbackResult,
  RollbackScenario
} from './migration/types';

// Create singleton instance
export const migrationValidator = new MigrationValidator();

// Convenience functions
export async function validateMigrationPath(from: DatabaseMode, to: DatabaseMode): Promise<ValidationResult> {
  return migrationValidator.validateMigrationPath(from, to);
}

export async function executeRollback(scenario: RollbackScenario): Promise<RollbackResult> {
  return migrationValidator.executeRollback(scenario);
}