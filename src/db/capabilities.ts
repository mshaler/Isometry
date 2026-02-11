/**
 * SQLite capability testing and telemetry
 */

import type { Database } from 'sql.js';
import type { SQLiteCapabilityError } from './types';
import { devLogger } from '../utils/dev-logger';

export interface DatabaseCapabilities {
  fts5: boolean;
  json1: boolean;
  recursiveCte: boolean;
}

export interface CapabilityTestResult {
  capabilities: DatabaseCapabilities;
  telemetryErrors: SQLiteCapabilityError[];
}

/**
 * Test database capabilities and collect telemetry
 */
export function testDatabaseCapabilities(db: Database): CapabilityTestResult {
  const capabilities: DatabaseCapabilities = {
    fts5: false,
    json1: false,
    recursiveCte: false
  };

  const telemetryErrors: SQLiteCapabilityError[] = [];

  const logCapabilityError = (
    capability: SQLiteCapabilityError['capability'],
    error: Error | string,
    testQuery?: string
  ) => {
    const errorMessage = error instanceof Error ? error.message : error;

    const telemetryError: SQLiteCapabilityError = {
      capability,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      context: {
        testQuery,
        userAgent: navigator.userAgent,
        webWorkerSupport: typeof Worker !== 'undefined',
        indexedDBSupport: typeof indexedDB !== 'undefined'
      }
    };

    telemetryErrors.push(telemetryError);
    devLogger.warn(`SQLite ${capability} capability test failed`, { error: errorMessage, testQuery });
  };

  // Test FTS5
  try {
    const testQuery = "CREATE VIRTUAL TABLE test_fts USING fts5(content)";
    db.exec(testQuery);
    db.exec("DROP TABLE test_fts");
    capabilities.fts5 = true;
    devLogger.setup('SQLite FTS5 capability confirmed', {});
  } catch (error) {
    logCapabilityError('fts5', error as Error, "CREATE VIRTUAL TABLE test_fts USING fts5(content)");
  }

  // Test JSON1
  try {
    const testQuery = "SELECT json('{}') as test";
    db.exec(testQuery);
    capabilities.json1 = true;
    devLogger.setup('SQLite JSON1 capability confirmed', {});
  } catch (error) {
    logCapabilityError('json1', error as Error, "SELECT json('{}') as test");
  }

  // Test Recursive CTEs
  {
    const cteTestQuery = `
      WITH RECURSIVE test_cte(n) AS (
        SELECT 1
        UNION ALL
        SELECT n+1 FROM test_cte WHERE n < 3
      )
      SELECT COUNT(*) FROM test_cte
    `;
    try {
      db.exec(cteTestQuery);
      capabilities.recursiveCte = true;
      devLogger.setup('SQLite Recursive CTE capability confirmed', {});
    } catch (error) {
      logCapabilityError('recursive_cte', error as Error, cteTestQuery);
    }
  }

  return { capabilities, telemetryErrors };
}