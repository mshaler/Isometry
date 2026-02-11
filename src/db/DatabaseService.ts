/**
 * Database Service
 *
 * Main entry point for database operations
 * Split into focused service modules by concern
 */

// Re-export services split by concern
export { DatabaseQueryService } from './services/query-service';
export { DatabaseSchemaService } from './services/schema-service';
export { DatabaseMigrationService } from './services/migration-service';
export { DatabaseTransactionService } from './services/transaction-service';
export { DatabaseCacheService } from './services/cache-service';

// Re-export types
export type {
  DatabaseConfig,
  QueryOptions,
  TransactionOptions,
  MigrationOptions,
  CacheOptions
} from './types/service-types';

// Main database service aggregator
import { DatabaseQueryService } from './services/query-service';
import { DatabaseSchemaService } from './services/schema-service';
import { DatabaseMigrationService } from './services/migration-service';
import { DatabaseTransactionService } from './services/transaction-service';
import { DatabaseCacheService } from './services/cache-service';
import type { Database } from 'sql.js-fts5';

export class DatabaseService {
  private db: Database;
  public query: DatabaseQueryService;
  public schema: DatabaseSchemaService;
  public migration: DatabaseMigrationService;
  public transaction: DatabaseTransactionService;
  public cache: DatabaseCacheService;

  constructor(db: Database) {
    this.db = db;
    this.query = new DatabaseQueryService(db);
    this.schema = new DatabaseSchemaService(db);
    this.migration = new DatabaseMigrationService(db);
    this.transaction = new DatabaseTransactionService(db);
    this.cache = new DatabaseCacheService(db);
  }

  async execute(sql: string, params?: unknown[]): Promise<any[]> {
    return this.query.execute(sql, params as import('sql.js').BindParams);
  }

  close(): void {
    this.db.close();
  }
}