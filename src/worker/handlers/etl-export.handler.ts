// Isometry v5 — Phase 9 ETL Export Worker Handler
// Thin delegation to ExportOrchestrator.

import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';
import { ExportOrchestrator } from '../../etl/ExportOrchestrator';

/**
 * Handle etl:export requests.
 * Delegates to ExportOrchestrator for the actual work.
 */
export async function handleETLExport(
  db: Database,
  payload: WorkerPayloads['etl:export']
): Promise<WorkerResponses['etl:export']> {
  const orchestrator = new ExportOrchestrator(db);

  const result = orchestrator.export(payload.format, {
    cardIds: payload.cardIds,
    excludeDeleted: true,
  });

  return {
    data: result.data,
    filename: result.filename,
  };
}
