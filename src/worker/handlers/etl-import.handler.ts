// Isometry v5 — Phase 8 ETL Worker Handlers
// Thin delegation to ImportOrchestrator.
//
// Note: Export handler is a stub for Phase 9.

import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';
import { ImportOrchestrator } from '../../etl/ImportOrchestrator';

/**
 * Handle etl:import requests.
 * Delegates to ImportOrchestrator for the actual work.
 */
export async function handleETLImport(
  db: Database,
  payload: WorkerPayloads['etl:import']
): Promise<WorkerResponses['etl:import']> {
  const orchestrator = new ImportOrchestrator(db);

  // Build options object, only including defined properties
  const options: { isBulkImport?: boolean; filename?: string } = {};
  if (payload.options?.isBulkImport !== undefined) {
    options.isBulkImport = payload.options.isBulkImport;
  }
  if (payload.options?.filename !== undefined) {
    options.filename = payload.options.filename;
  }

  return orchestrator.import(payload.source, payload.data, options);
}

/**
 * Handle etl:export requests.
 * Stub for Phase 9 implementation.
 */
export async function handleETLExport(
  _db: Database,
  _payload: WorkerPayloads['etl:export']
): Promise<WorkerResponses['etl:export']> {
  // Phase 9 will implement export functionality
  throw new Error('Export not yet implemented (Phase 9)');
}
