/**
 * Query Executor Service - Re-export for backward compatibility
 *
 * The actual implementation lives in ./query/query-executor.ts
 */

export {
  validateQuery,
  executeQuery,
  exportToCSV,
  exportToJSON,
  type QueryResult,
  type DatabaseExecutor,
} from './query/query-executor';
