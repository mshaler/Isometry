/**
 * Database Transaction Service
 */

import type { Database } from 'sql.js-fts5';
import type { TransactionOptions } from '../types/service-types';

export class DatabaseTransactionService {
  constructor(private db: Database) {}

  async begin(options?: TransactionOptions): Promise<void> {
    this.db.run('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    this.db.run('COMMIT');
  }

  async rollback(): Promise<void> {
    this.db.run('ROLLBACK');
  }
}
