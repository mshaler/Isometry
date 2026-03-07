// Isometry v5 — Phase 8 ETL Worker Handler
// Thin delegation to ImportOrchestrator with progress notification wiring.

import type { Database } from '../../database/Database';
import { ImportOrchestrator } from '../../etl/ImportOrchestrator';
import type { WorkerNotification, WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Handle etl:import requests.
 * Delegates to ImportOrchestrator for the actual work.
 * Wires onProgress to post WorkerNotification messages to main thread.
 */
export async function handleETLImport(
	db: Database,
	payload: WorkerPayloads['etl:import'],
): Promise<WorkerResponses['etl:import']> {
	const orchestrator = new ImportOrchestrator(db);

	// Wire progress emission to main thread via self.postMessage
	orchestrator.onProgress = (processed, total, rate) => {
		const notification: WorkerNotification = {
			type: 'import_progress',
			payload: {
				processed,
				total,
				rate,
				source: payload.source,
				filename: payload.options?.filename,
			},
		};
		self.postMessage(notification);
	};

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
