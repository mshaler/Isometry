// Isometry v5 — Phase 33+34+36 Native ETL Worker Handler
// Handles pre-parsed CanonicalCard[] from Swift native adapters.
// Bypasses the parse step entirely — uses DedupEngine + SQLiteWriter directly.
//
// Phase 34 addition: Auto-creates attendee connections for calendar imports.
// Person cards with source_url starting with "attendee-of:" get a connection
// linking them to the referenced event card.
//
// Phase 36 addition: Auto-creates bidirectional note-to-note link connections.
// Link cards with source_url "note-link:{targetZID}" and colon-delimited
// source_id "notelink:{sourceZID}:{targetZID}" get forward (links_to, 0.5)
// and backward (linked_from, 0.3) connections between the actual note cards.

import type { Database } from '../../database/Database';
import { CatalogWriter } from '../../etl/CatalogWriter';
import { DedupEngine } from '../../etl/DedupEngine';
import { SQLiteWriter } from '../../etl/SQLiteWriter';
import type { CanonicalConnection, ImportResult } from '../../etl/types';
import type { WorkerNotification, WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Source name mapping for native adapter source types.
 */
const NATIVE_SOURCE_NAMES: Record<string, string> = {
	native_reminders: 'Native Reminders',
	native_calendar: 'Native Calendar',
	native_notes: 'Native Notes',
	alto_index: 'Alto Index',
};

/**
 * Handle etl:import-native requests.
 * Cards arrive pre-parsed from Swift adapters — no parsing step needed.
 * Uses DedupEngine + SQLiteWriter directly for dedup and persistence.
 *
 * Progress notifications are posted to main thread at batch boundaries.
 */
export async function handleETLImportNative(
	db: Database,
	payload: WorkerPayloads['etl:import-native'],
): Promise<WorkerResponses['etl:import-native']> {
	const startTime = new Date().toISOString();

	// Step 1: Deduplicate against existing cards
	const dedup = new DedupEngine(db);
	const dedupResult = dedup.process(payload.cards, [], payload.sourceType);

	// Step 2: Determine bulk import optimization
	const totalCards = dedupResult.toInsert.length + dedupResult.toUpdate.length;
	const isBulkImport = totalCards > 500;

	// Step 3: Write to database with progress reporting
	const writer = new SQLiteWriter(db);

	const progressCallback = (processed: number, _total: number, rate: number) => {
		const notification: WorkerNotification = {
			type: 'import_progress',
			payload: {
				processed,
				total: totalCards,
				rate,
				source: payload.sourceType as WorkerNotification['payload']['source'],
				filename: payload.sourceType,
			},
		};
		self.postMessage(notification);
	};

	await writer.writeCards(dedupResult.toInsert, isBulkImport, progressCallback);
	await writer.updateCards(dedupResult.toUpdate);
	await writer.writeConnections(dedupResult.connections);

	// Phase 34 (CALR-02): Auto-create attendee connections for calendar imports.
	// Person cards with source_url "attendee-of:{eventSourceId}" get a connection
	// linking the person card to the referenced event card via sourceIdMap.
	const autoConnections: CanonicalConnection[] = [];
	const allProcessed = [...dedupResult.toInsert, ...dedupResult.toUpdate];
	for (const card of allProcessed) {
		if (card.source_url?.startsWith('attendee-of:')) {
			const eventSourceId = card.source_url.replace('attendee-of:', '');
			const eventUUID = dedupResult.sourceIdMap.get(eventSourceId);
			const personUUID = dedupResult.sourceIdMap.get(card.source_id);
			if (eventUUID && personUUID) {
				autoConnections.push({
					id: crypto.randomUUID(),
					source_id: personUUID,
					target_id: eventUUID,
					via_card_id: null,
					label: 'attendee',
					weight: 1,
					created_at: new Date().toISOString(),
				});
			}
		}

		// Phase 36 (BODY-04): Auto-create note-to-note link connections.
		// Link cards have source_url "note-link:{targetZID}" and
		// source_id "notelink:{sourceZID}:{targetZID}" (colon-delimited).
		if (card.source_url?.startsWith('note-link:')) {
			const targetSourceId = card.source_url.replace('note-link:', '');
			const targetUUID = dedupResult.sourceIdMap.get(targetSourceId);

			// Extract source note ZIDENTIFIER from colon-delimited source_id
			// Format: "notelink:{sourceZID}:{targetZID}"
			const parts = card.source_id.split(':');
			// parts[0] = 'notelink', parts[1] = sourceZID, parts[2] = targetZID
			if (parts.length === 3 && parts[0] === 'notelink') {
				const sourceZID = parts[1]!;
				const sourceNoteUUID = dedupResult.sourceIdMap.get(sourceZID);

				if (sourceNoteUUID && targetUUID) {
					// Forward: source note -> target note (links_to, weight 0.5)
					autoConnections.push({
						id: crypto.randomUUID(),
						source_id: sourceNoteUUID,
						target_id: targetUUID,
						via_card_id: null,
						label: 'links_to',
						weight: 0.5,
						created_at: new Date().toISOString(),
					});
					// Backlink: target note -> source note (linked_from, weight 0.3)
					autoConnections.push({
						id: crypto.randomUUID(),
						source_id: targetUUID,
						target_id: sourceNoteUUID,
						via_card_id: null,
						label: 'linked_from',
						weight: 0.3,
						created_at: new Date().toISOString(),
					});
				}
			}
		}
	}
	if (autoConnections.length > 0) {
		await writer.writeConnections(autoConnections);
	}

	const totalConnections = dedupResult.connections.length + autoConnections.length;

	// FTS optimize for incremental imports (>100 inserts, non-bulk path)
	if (!isBulkImport && dedupResult.toInsert.length > 100) {
		writer.optimizeFTS();
	}

	// Step 4: Build result
	const result: ImportResult = {
		inserted: dedupResult.toInsert.length,
		updated: dedupResult.toUpdate.length,
		unchanged: dedupResult.toSkip.length,
		skipped: 0,
		errors: 0,
		connections_created: totalConnections,
		insertedIds: dedupResult.toInsert.map((c) => c.id),
		updatedIds: dedupResult.toUpdate.map((c) => c.id),
		deletedIds: dedupResult.deletedIds,
		errors_detail: [],
	};

	// Step 5: Record in catalog
	const catalog = new CatalogWriter(db);
	const sourceName = NATIVE_SOURCE_NAMES[payload.sourceType] ?? payload.sourceType;
	catalog.recordImportRun({
		source: payload.sourceType,
		sourceName,
		started_at: startTime,
		completed_at: new Date().toISOString(),
		result,
	});

	return result;
}
