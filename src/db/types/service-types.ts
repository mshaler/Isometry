/**
 * Database Service Types
 */

export interface DatabaseConfig {
  filename?: string;
  memory?: boolean;
  readonly?: boolean;
}

export interface QueryOptions {
  timeout?: number;
  maxRows?: number;
  cache?: boolean;
}

export interface TransactionOptions {
  isolation?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  timeout?: number;
}

export interface MigrationOptions {
  version?: number;
  dryRun?: boolean;
  force?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  enabled?: boolean;
}
