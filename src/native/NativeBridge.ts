// Isometry v5 — Phase 12 NativeBridge
// JS-side bridge for WKWebView communication.
//
// Provides bidirectional messaging between the web runtime and Swift shell.
// All JS→Swift messages flow through window.webkit.messageHandlers.nativeBridge.
// All Swift→JS messages arrive via window.__isometry.receive().
//
// Requirements addressed:
//   - BRDG-01: Sends native:ready signal; receives LaunchPayload from Swift
//   - BRDG-02: Converts Uint8Array to base64 before posting checkpoint data
//   - BRDG-03: Forwards native:action messages to appropriate handlers (FILE-03)
//   - BRDG-04: Receives native:sync messages from CloudKit (stub)
//
// CRITICAL: Never post raw Uint8Array via nativeBridge.postMessage —
// WKScriptMessageHandler receives it as { "0": 0, "1": 1, ... } dictionary.
// Always convert to base64 first.

import type { CardType } from '../database/queries/types';
import type { CanonicalCard, SourceType } from '../etl/types';
import type { WorkerBridge } from '../worker/WorkerBridge';

// ---------------------------------------------------------------------------
// WebKit Global Type Declarations
// ---------------------------------------------------------------------------
// These APIs are available at runtime inside WKWebView. TypeScript
// doesn't know about them, so we declare them here.

declare global {
	interface Window {
		webkit?: {
			messageHandlers: {
				nativeBridge: {
					postMessage: (message: unknown) => void;
				};
			};
		};
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** LaunchPayload sent by Swift after receiving native:ready signal */
export interface LaunchPayload {
	/** Base64-encoded SQLite database bytes, or null on first launch */
	dbData: string | null;
	/** Platform: 'ios' | 'macos' */
	platform: string;
	/** Tier: 'free' (TIER-03 fills this in Phase 14) */
	tier: string;
	/** Viewport dimensions */
	viewport: { width: number; height: number };
	/** Safe area insets (iOS only; all zero on macOS) */
	safeAreaInsets: { top: number; right: number; bottom: number; left: number };
}

// ---------------------------------------------------------------------------
// Exported Utility Functions (BRDG-02)
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a base64 string for WKScriptMessageHandler transport.
 *
 * CRITICAL: Never post raw Uint8Array via nativeBridge.postMessage.
 * WKScriptMessageHandler receives it as a dictionary { "0": byte0, ... }.
 * This function ensures binary data survives the JS→Swift bridge intact.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
	if (bytes.byteLength === 0) return '';
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 * Used when receiving dbData from Swift's LaunchPayload.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
	if (base64.length === 0) return new Uint8Array(0);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ---------------------------------------------------------------------------
// Mutating operation types for mutation hook
// ---------------------------------------------------------------------------

/**
 * Set of WorkerRequestType values that mutate database state.
 * The mutation hook posts 'mutated' to nativeBridge after any of these.
 * Read-only operations (db:query, card:get, card:list, search:cards, etc.)
 * are intentionally excluded.
 */
const MUTATING_TYPES = new Set<string>([
	'card:create',
	'card:update',
	'card:delete',
	'card:undelete',
	'connection:create',
	'connection:delete',
	'db:exec',
	'etl:import',
	'etl:import-native', // Native adapter imports (Phase 33)
]);

// ---------------------------------------------------------------------------
// Chunk accumulator for native imports (Phase 33)
// ---------------------------------------------------------------------------

/**
 * Module-level state for accumulating chunked native import cards.
 * Lives for the duration of a single multi-chunk import sequence.
 * Reset on chunkIndex 0 (new import) and after final chunk completes.
 */
let chunkAccumulator: CanonicalCard[] = [];
let activeSourceType: string | null = null;

// ---------------------------------------------------------------------------
// waitForLaunchPayload — Phase 1 of the 2-phase startup flow
// ---------------------------------------------------------------------------

/**
 * Register window.__isometry.receive() and wait for Swift's LaunchPayload.
 *
 * This is the first of two native bridge phases:
 * 1. main.ts calls waitForLaunchPayload() BEFORE creating WorkerBridge
 * 2. On LaunchPayload arrival, returns { dbData, platform, ... }
 * 3. main.ts creates WorkerBridge with the optional dbData bytes
 * 4. main.ts calls initNativeBridge(bridge) for ongoing handlers
 *
 * Guard: only activates when window.location.protocol === 'app:'
 * In browser/test environments, resolves immediately with null dbData.
 */
export function waitForLaunchPayload(): Promise<LaunchPayload> {
	// Guard: non-native environment — resolve with empty payload immediately
	if (window.location.protocol !== 'app:') {
		return Promise.resolve({
			dbData: null,
			platform: 'web',
			tier: 'free',
			viewport: { width: window.innerWidth, height: window.innerHeight },
			safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
		});
	}

	return new Promise<LaunchPayload>((resolve) => {
		// Register the receive callback that Swift will call
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).__isometry = (window as any).__isometry ?? {};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).__isometry.receive = (message: { type: string; payload: unknown }) => {
			if (message.type === 'native:launch') {
				const payload = message.payload as LaunchPayload;
				console.log('[NativeBridge] LaunchPayload received, platform:', payload.platform);
				resolve(payload);
			}
			// Other message types handled by initNativeBridge after bootstrap
		};

		// Signal Swift that JS is ready — Swift responds with LaunchPayload
		window.webkit!.messageHandlers.nativeBridge.postMessage({
			id: crypto.randomUUID(),
			type: 'native:ready',
			payload: {},
			timestamp: Date.now(),
		});

		console.log('[NativeBridge] Sent native:ready, waiting for LaunchPayload');
	});
}

// ---------------------------------------------------------------------------
// initNativeBridge — Phase 2: ongoing handlers after bootstrap
// ---------------------------------------------------------------------------

/**
 * Install ongoing bridge handlers after app bootstrap completes.
 *
 * Called by main.ts AFTER WorkerBridge is ready and all providers are wired.
 * Installs:
 * - Persistent receive handler for native:sync and native:checkpoint-request
 * - Mutation hook on bridge.send() to post 'mutated' after write operations
 * - Exposes sendCheckpoint on window.__isometry for Swift to trigger
 *
 * Guard: no-op when window.location.protocol !== 'app:'
 */
export function initNativeBridge(bridge: WorkerBridge): void {
	// Guard: non-native environment
	if (window.location.protocol !== 'app:') return;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const iso = (window as any).__isometry as Record<string, unknown>;

	// SYNC-01: Save unwrapped bridge.send BEFORE mutation hook wraps it.
	// SyncMerger and exportAllCards use this to bypass the mutation hook,
	// preventing sync echo loops (Pitfall 1 and 6 from research).
	const unwrappedSend = bridge.send.bind(bridge);

	// Install persistent receive handler (replaces the one-time LaunchPayload handler)
	// Use bracket notation to satisfy noUncheckedIndexedAccess strict mode
	iso['receive'] = (message: { type: string; payload: unknown }) => {
		switch (message.type) {
			case 'native:launch':
				// Already handled by waitForLaunchPayload; no-op here
				console.warn('[NativeBridge] Received duplicate native:launch — ignoring');
				break;

			case 'native:sync':
				// SYNC-08: Merge incoming CloudKit records into sql.js via SyncMerger
				// SYNC-01: Pass unwrappedSend to bypass mutation hook (prevents sync echo loops)
				handleNativeSync(
					unwrappedSend,
					message.payload as {
						records: Array<{
							recordType: string;
							recordId: string;
							operation: string;
							fields?: Record<string, unknown>;
						}>;
					},
				).catch((err) => console.error('[NativeBridge] native:sync merge failed:', err));
				break;

			case 'native:checkpoint-request':
				// Swift is explicitly requesting a checkpoint (e.g., before termination)
				sendCheckpoint(bridge).catch((err) => console.error('[NativeBridge] Checkpoint failed:', err));
				break;

			case 'native:action': {
				const payload = message.payload as {
					kind: string;
					data: string;
					source: string;
					filename: string;
				};
				if (payload.kind === 'importFile') {
					handleNativeFileImport(bridge, payload).catch((err) =>
						console.error('[NativeBridge] File import failed:', err),
					);
				} else {
					console.warn('[NativeBridge] Unknown native:action kind:', payload.kind);
				}
				break;
			}

			case 'native:import-chunk': {
				const payload = message.payload as {
					chunkIndex: number;
					isLast: boolean;
					cardsBase64: string;
				};
				handleNativeImportChunk(bridge, payload).catch((err) =>
					console.error('[NativeBridge] native:import-chunk failed:', err),
				);
				break;
			}

			case 'native:alto-discovery': {
				const payload = message.payload as {
					rootPath: string;
					rootName: string;
					subdirectories: Array<{ name: string; cardType: string; path: string }>;
				};
				console.log('[NativeBridge] alto-index discovery:', payload.rootName, payload.subdirectories.length, 'dirs');
				// Dispatch custom event for main.ts to handle
				window.dispatchEvent(new CustomEvent('alto-discovery', { detail: payload }));
				break;
			}

			default:
				console.warn('[NativeBridge] Unknown message type:', message.type);
		}
	};

	// Expose sendCheckpoint on window.__isometry for Swift to trigger via evaluateJavaScript.
	// Phase 77: Checkpoint save cost at 20K cards is ~714ms. Rapid mutations (batch imports,
	// multi-field edits) would queue redundant exports. Use a 100ms trailing debounce to
	// coalesce rapid mutation-triggered autosave calls into a single expensive export.
	//
	// NOTE: native:checkpoint-request handler below calls sendCheckpoint() directly
	// (no debounce) — explicit termination-safety requests must not be delayed.
	const debouncedCheckpoint = makeDebouncedCheckpoint(bridge, 100);
	iso['sendCheckpoint'] = debouncedCheckpoint;

	// SYNC-01, SYNC-02: Export all cards and connections for initial CloudKit upload or encryptedDataReset recovery
	iso['exportAllCards'] = async () => {
		try {
			// SMPL-03: Exclude sample data from CloudKit sync export.
			// NULL != 'sample' evaluates to NULL (falsy) in SQLite, so we need IS NULL guard.
			const rows = await unwrappedSend('db:query' as Parameters<typeof unwrappedSend>[0], {
				sql: "SELECT * FROM cards WHERE deleted_at IS NULL AND (source IS NULL OR source != 'sample')",
				params: [],
			});
			// SYNC-02: Query all connections (including those referencing soft-deleted cards).
			// Connections to soft-deleted cards reference valid CKRecords since soft-deletes
			// don't remove CKRecords. If the user restores a card, the connection is already synced.
			const connections = await unwrappedSend('db:query' as Parameters<typeof unwrappedSend>[0], {
				sql: 'SELECT * FROM connections',
				params: [],
			});
			// Post back to Swift as native:export-all-cards (payload extended with connections)
			window.webkit!.messageHandlers.nativeBridge.postMessage({
				id: crypto.randomUUID(),
				type: 'native:export-all-cards',
				payload: { cards: rows, connections },
				timestamp: Date.now(),
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			console.log(
				'[NativeBridge] exportAllCards: exported',
				(rows as any[])?.length ?? 0,
				'cards,',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(connections as any[])?.length ?? 0,
				'connections',
			);
		} catch (err) {
			console.error('[NativeBridge] exportAllCards failed:', err);
		}
	};

	// Install mutation hook: wrap bridge.send() to post 'mutated' after writes
	// CRITICAL: Must be AFTER unwrappedSend capture above
	installMutationHook(bridge);

	console.log('[NativeBridge] Initialized, ongoing handlers active');
}

// ---------------------------------------------------------------------------
// sendCheckpoint — exported for use by initNativeBridge and direct calls
// ---------------------------------------------------------------------------

/**
 * Export the database and send bytes back to Swift as base64.
 *
 * Called either by the debounced mutation-triggered autosave path or
 * by the explicit checkpoint request via native:checkpoint-request message.
 *
 * Phase 77 measurement: at 20K cards, db.export() + base64 = ~714ms.
 * Debouncing is applied to mutation-triggered calls (via makeDebouncedCheckpoint)
 * to prevent rapid mutations from queuing redundant expensive exports.
 */
export async function sendCheckpoint(bridge: WorkerBridge): Promise<void> {
	const dbBytes = await bridge.exportDatabase();
	const base64 = uint8ArrayToBase64(dbBytes);
	window.webkit!.messageHandlers.nativeBridge.postMessage({
		id: crypto.randomUUID(),
		type: 'checkpoint',
		payload: { dbData: base64 },
		timestamp: Date.now(),
	});
	console.log('[NativeBridge] Checkpoint sent (' + dbBytes.byteLength + ' bytes)');
}

/**
 * Create a debounced wrapper around sendCheckpoint for mutation-triggered autosave.
 *
 * Phase 77: Checkpoint save cost at 20K cards measured at ~714ms (export=2ms + base64=712ms).
 * Rapid mutations (e.g., batch imports, multi-field edits) would queue N redundant exports.
 * A 100ms trailing debounce coalesces rapid mutations into a single checkpoint call,
 * preventing a backlog of expensive 714ms operations.
 *
 * IMPORTANT: Only use this for mutation-triggered autosave calls. Explicit
 * native:checkpoint-request (e.g., before WKWebView termination) must call
 * sendCheckpoint() directly without debouncing to guarantee data integrity.
 *
 * @param bridge WorkerBridge instance
 * @param delayMs Debounce delay in milliseconds (default 100ms)
 * @returns Debounced checkpoint function
 */
export function makeDebouncedCheckpoint(bridge: WorkerBridge, delayMs = 100): () => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return () => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			sendCheckpoint(bridge).catch((err) => console.error('[NativeBridge] Debounced checkpoint failed:', err));
		}, delayMs);
	};
}

// ---------------------------------------------------------------------------
// SyncMerger — incoming CloudKit records to sql.js (SYNC-08)
// ---------------------------------------------------------------------------

/**
 * Merge incoming CloudKit records into the sql.js database.
 *
 * Each record is applied as an INSERT OR REPLACE (for saves) or DELETE (for deletes).
 * Records are processed sequentially via individual db:exec calls.
 * Incoming CloudKit records are authoritative (already conflict-resolved by CKSyncEngine).
 *
 * FTS5 triggers fire automatically on INSERT OR REPLACE (implicit DELETE + INSERT),
 * keeping the search index consistent without additional work.
 */
export async function handleNativeSync(
	dbExec: (type: Parameters<WorkerBridge['send']>[0], payload: { sql: string; params: unknown[] }) => Promise<unknown>,
	payload: {
		records: Array<{
			recordType: string;
			recordId: string;
			operation: string;
			fields?: Record<string, unknown>;
		}>;
	},
): Promise<void> {
	if (!payload.records || payload.records.length === 0) {
		console.log('[NativeBridge] native:sync received with no records');
		return;
	}

	console.log('[NativeBridge] native:sync: merging', payload.records.length, 'records');

	// SYNC-02: Reorder batch -- cards before connections for FK constraint satisfaction.
	// Partition (not sort) for O(n), guaranteed stable, readable.
	// PRAGMA foreign_keys = ON requires referenced cards to exist before connection INSERT.
	const cardRecords = payload.records.filter((r) => r.recordType === 'Card');
	const connectionRecords = payload.records.filter((r) => r.recordType !== 'Card');
	const ordered = [...cardRecords, ...connectionRecords];

	// Build SQL statements for each record
	const statements = ordered.map((rec) => {
		if (rec.operation === 'delete') {
			const table = rec.recordType === 'Card' ? 'cards' : 'connections';
			return { sql: `DELETE FROM ${table} WHERE id = ?`, params: [rec.recordId] as unknown[] };
		}

		// INSERT OR REPLACE for saves -- incoming CloudKit records are authoritative
		if (rec.recordType === 'Card') {
			return buildCardMergeSQL(rec.recordId, rec.fields ?? {});
		} else {
			return buildConnectionMergeSQL(rec.recordId, rec.fields ?? {});
		}
	});

	// Execute each statement sequentially via db:exec
	// db:exec takes a single { sql, params } per call
	// SYNC-01: Uses unwrapped bridge.send (dbExec) to bypass mutation hook.
	// This prevents sync echo loops: incoming records do NOT trigger 'mutated' back to Swift.
	let successCount = 0;
	for (const stmt of statements) {
		try {
			await dbExec('db:exec' as Parameters<WorkerBridge['send']>[0], stmt);
			successCount++;
		} catch (err) {
			console.error('[NativeBridge] native:sync: statement failed:', stmt.sql, err);
		}
	}

	// SYNC-01: JS-internal refresh signal — triggers active view to re-query sql.js
	// CRITICAL: Do NOT post 'mutated' to nativeBridge — prevents sync echo loops
	if (successCount > 0) {
		window.dispatchEvent(
			new CustomEvent('isometry:sync-complete', {
				detail: { recordCount: successCount },
			}),
		);
	}

	console.log('[NativeBridge] native:sync: merged', successCount, '/', statements.length, 'records successfully');
}

/**
 * Build INSERT OR REPLACE SQL for a card record from CloudKit.
 *
 * Per RESEARCH.md: INSERT OR REPLACE is appropriate because:
 * 1. card.id is PRIMARY KEY
 * 2. Incoming CloudKit records are authoritative (already conflict-resolved)
 * 3. FTS5 triggers fire on INSERT (after implicit DELETE), keeping search index consistent
 */
function buildCardMergeSQL(recordId: string, fields: Record<string, unknown>): { sql: string; params: unknown[] } {
	const sql = `INSERT OR REPLACE INTO cards (
    id, card_type, name, content, summary,
    latitude, longitude, location_name,
    created_at, modified_at, due_at, completed_at, event_start, event_end,
    folder, tags, status,
    priority, sort_order,
    url, mime_type, is_collective,
    source, source_id, source_url,
    deleted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

	const params: unknown[] = [
		recordId,
		fields['card_type'] ?? 'note',
		fields['name'] ?? '',
		fields['content'] ?? null,
		fields['summary'] ?? null,
		fields['latitude'] ?? null,
		fields['longitude'] ?? null,
		fields['location_name'] ?? null,
		fields['created_at'] ?? new Date().toISOString(),
		fields['modified_at'] ?? new Date().toISOString(),
		fields['due_at'] ?? null,
		fields['completed_at'] ?? null,
		fields['event_start'] ?? null,
		fields['event_end'] ?? null,
		fields['folder'] ?? null,
		fields['tags'] ?? null,
		fields['status'] ?? null,
		fields['priority'] ?? 0,
		fields['sort_order'] ?? 0,
		fields['url'] ?? null,
		fields['mime_type'] ?? null,
		fields['is_collective'] ?? 0,
		fields['source'] ?? 'cloudkit',
		fields['source_id'] ?? recordId,
		fields['source_url'] ?? null,
		fields['deleted_at'] ?? null,
	];

	return { sql, params };
}

/**
 * Build INSERT OR REPLACE SQL for a connection record from CloudKit.
 */
function buildConnectionMergeSQL(
	recordId: string,
	fields: Record<string, unknown>,
): { sql: string; params: unknown[] } {
	const sql = `INSERT OR REPLACE INTO connections (
    id, source_id, target_id, label, via_card_id, weight, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

	const params: unknown[] = [
		recordId,
		fields['source_id'] ?? '',
		fields['target_id'] ?? '',
		fields['label'] ?? '',
		fields['via_card_id'] ?? null,
		fields['weight'] ?? 1.0,
		fields['created_at'] ?? new Date().toISOString(),
	];

	return { sql, params };
}

/**
 * Extract changeset information from a mutation type and payload.
 *
 * Used by the enhanced mutated message to carry structured change data
 * back to Swift for CKSyncEngine offline queue. Returns undefined for
 * bulk operations (db:exec, etl:import, etl:import-native) that cannot
 * be tracked as individual record changes.
 */
export function extractChangeset(
	type: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	result?: any,
): Array<{ recordType: string; recordId: string; operation: string; fields?: Record<string, unknown> }> | undefined {
	switch (type) {
		case 'card:create':
			// SYNC-02: id is generated by Worker, available in result (not payload)
			if (!result?.id) return undefined;
			return [{ recordType: 'Card', recordId: result.id as string, operation: 'insert' }];
		case 'card:update':
			return [
				{
					recordType: 'Card',
					recordId: payload['id'] as string,
					operation: 'update',
					fields: payload['updates'] as Record<string, unknown>,
				},
			];
		case 'card:delete':
			// SYNC-07: Soft-delete syncs as field UPDATE, NOT CKRecord deletion.
			// Worker runs UPDATE cards SET deleted_at = <timestamp> WHERE id = ?.
			// We sync this as a field update to preserve the CKRecord in CloudKit.
			return [
				{
					recordType: 'Card',
					recordId: payload['id'] as string,
					operation: 'update',
					fields: { deleted_at: new Date().toISOString() },
				},
			];
		case 'card:undelete':
			// SYNC-07: Restore syncs as field update clearing deleted_at
			return [
				{ recordType: 'Card', recordId: payload['id'] as string, operation: 'update', fields: { deleted_at: null } },
			];
		case 'connection:create':
			// SYNC-02: id is generated by Worker; fields from payload.input
			if (!result?.id) return undefined;
			return [
				{
					recordType: 'Connection',
					recordId: result.id as string,
					operation: 'insert',
					fields: {
						source_id: payload['input']?.source_id,
						target_id: payload['input']?.target_id,
						label: payload['input']?.label ?? null,
						weight: payload['input']?.weight ?? 1.0,
						via_card_id: payload['input']?.via_card_id ?? null,
					},
				},
			];
		case 'connection:delete':
			return [{ recordType: 'Connection', recordId: payload['id'] as string, operation: 'delete' }];
		case 'db:exec':
		case 'etl:import':
		case 'etl:import-native':
			// Bulk operations -- Swift cannot queue these individually
			return undefined;
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// handleNativeFileImport — routes native file import to ETL pipeline
// ---------------------------------------------------------------------------

/**
 * Handle file import from native file picker.
 *
 * Swift sends file data through the native:action bridge message.
 * Text formats (json, csv, markdown) arrive as UTF-8 text strings.
 * Binary formats (xlsx) arrive as base64-encoded strings.
 *
 * Routes to WorkerBridge.importFile() which delegates to the
 * existing ETL pipeline (ImportOrchestrator) in the Web Worker.
 */
async function handleNativeFileImport(
	bridge: WorkerBridge,
	payload: { data: string; source: string; filename: string },
): Promise<void> {
	console.log('[NativeBridge] Importing file:', payload.filename, '(source:', payload.source + ')');

	const result = await bridge.importFile(payload.source as SourceType, payload.data, { filename: payload.filename });

	console.log(
		'[NativeBridge] File import complete:',
		result.inserted,
		'inserted,',
		result.updated,
		'updated,',
		result.errors,
		'errors',
	);
}

// ---------------------------------------------------------------------------
// normalizeNativeCard — fix Swift JSONEncoder's encodeIfPresent gap
// ---------------------------------------------------------------------------

/**
 * Swift's auto-synthesized Codable uses `encodeIfPresent` for Optional fields,
 * which OMITS the key when nil (instead of writing null). After JSON.parse,
 * those missing keys produce `undefined` — but sql.js rejects undefined as a
 * bind parameter. This function ensures every CanonicalCard field is present
 * with an explicit `null` for missing optional fields.
 */
function normalizeNativeCard(raw: Record<string, unknown>): CanonicalCard {
	return {
		id: raw['id'] as string,
		card_type: raw['card_type'] as CardType,
		name: raw['name'] as string,
		content: (raw['content'] as string | null) ?? null,
		summary: (raw['summary'] as string | null) ?? null,
		latitude: (raw['latitude'] as number | null) ?? null,
		longitude: (raw['longitude'] as number | null) ?? null,
		location_name: (raw['location_name'] as string | null) ?? null,
		created_at: raw['created_at'] as string,
		modified_at: raw['modified_at'] as string,
		due_at: (raw['due_at'] as string | null) ?? null,
		completed_at: (raw['completed_at'] as string | null) ?? null,
		event_start: (raw['event_start'] as string | null) ?? null,
		event_end: (raw['event_end'] as string | null) ?? null,
		folder: (raw['folder'] as string | null) ?? null,
		tags: (raw['tags'] as string[]) ?? [],
		status: (raw['status'] as string | null) ?? null,
		priority: (raw['priority'] as number) ?? 0,
		sort_order: (raw['sort_order'] as number) ?? 0,
		url: (raw['url'] as string | null) ?? null,
		mime_type: (raw['mime_type'] as string | null) ?? null,
		is_collective: (raw['is_collective'] as boolean) ?? false,
		source: raw['source'] as string,
		source_id: raw['source_id'] as string,
		source_url: (raw['source_url'] as string | null) ?? null,
		deleted_at: (raw['deleted_at'] as string | null) ?? null,
	};
}

// handleNativeImportChunk — accumulates chunked cards from Swift adapters
// ---------------------------------------------------------------------------

/**
 * Handle a single chunk of native import cards from Swift.
 *
 * Swift sends cards in 200-card chunks via native:import-chunk messages.
 * Each chunk contains base64-encoded JSON array of CanonicalCard objects.
 *
 * Flow:
 * 1. Decode base64 → JSON → CanonicalCard[]
 * 2. Accumulate in module-level chunkAccumulator
 * 3. Send ack to Swift IMMEDIATELY (unblocks next chunk send)
 * 4. On final chunk (isLast === true), call bridge.importNative() ONCE
 *    for proper cross-chunk deduplication
 *
 * CRITICAL: Ack is sent BEFORE calling ImportOrchestrator to prevent
 * Swift from timing out during the database write phase.
 *
 * CRITICAL: ImportOrchestrator is called ONCE on the final chunk,
 * not per-chunk, to ensure cross-chunk deduplication works correctly.
 */
async function handleNativeImportChunk(
	bridge: WorkerBridge,
	payload: { chunkIndex: number; isLast: boolean; cardsBase64: string },
): Promise<void> {
	// Decode base64 JSON
	const cardsJson = atob(payload.cardsBase64);
	const rawCards = JSON.parse(cardsJson) as Record<string, unknown>[];

	// Normalize: Swift's JSONEncoder uses encodeIfPresent for optionals,
	// which SKIPS nil keys entirely (doesn't write null). After JSON.parse,
	// those missing keys are `undefined` — but sql.js rejects undefined as
	// a bind parameter. Convert all missing optional fields to explicit null.
	const cards: CanonicalCard[] = rawCards.map(normalizeNativeCard);

	if (payload.chunkIndex === 0) {
		// Reset accumulator for new import
		chunkAccumulator = [];
		activeSourceType = cards[0]?.source ?? null;
	}

	chunkAccumulator.push(...cards);

	console.log(
		'[NativeBridge] Chunk',
		payload.chunkIndex,
		'received:',
		cards.length,
		'cards',
		'(accumulated:',
		chunkAccumulator.length + ')',
		payload.isLast ? '[FINAL]' : '',
	);

	// Send ack to Swift so next chunk is released
	// CRITICAL: Ack BEFORE ImportOrchestrator to prevent Swift timeout
	window.webkit!.messageHandlers.nativeBridge.postMessage({
		id: crypto.randomUUID(),
		type: 'native:import-chunk-ack',
		payload: { chunkIndex: payload.chunkIndex, success: true },
		timestamp: Date.now(),
	});

	if (payload.isLast && activeSourceType) {
		// All chunks received — call ImportOrchestrator ONCE for proper cross-chunk dedup
		const allCards = chunkAccumulator;
		const sourceType = activeSourceType;

		// Reset state before async call
		chunkAccumulator = [];
		activeSourceType = null;

		const result = await bridge.importNative(sourceType, allCards);
		console.log(
			'[NativeBridge] Native import complete:',
			result.inserted,
			'inserted,',
			result.updated,
			'updated,',
			result.unchanged,
			'unchanged,',
			result.errors,
			'errors',
		);
	}
}

// ---------------------------------------------------------------------------
// installMutationHook — wraps bridge.send() to detect writes
// ---------------------------------------------------------------------------

/**
 * Wraps WorkerBridge.send() to post 'mutated' to Swift after any write operation.
 *
 * Only fires for MUTATING_TYPES — read operations are excluded.
 * Enhanced in Phase 39: the mutated message now carries an optional `changes` array
 * with structured changeset data (recordType, recordId, operation, fields) for
 * Swift to queue as PendingChange entries in CKSyncEngine's offline queue.
 *
 * Backward compatible: Swift's existing mutated handler ignores payload (just calls
 * markDirty). The changes array is extracted by the Phase 39 BridgeManager enhancement.
 */
function installMutationHook(bridge: WorkerBridge): void {
	const originalSend = bridge.send.bind(bridge);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(bridge as any).send = async <T extends string>(
		type: T,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		payload: any,
		timeoutOverride?: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): Promise<any> => {
		const result = await originalSend(type as Parameters<typeof originalSend>[0], payload, timeoutOverride);

		// Post 'mutated' after successful write operations only
		if (MUTATING_TYPES.has(type)) {
			try {
				// Phase 39: Enhanced mutated message carries changeset for sync queue
				const changes = extractChangeset(type, payload, result);
				window.webkit!.messageHandlers.nativeBridge.postMessage({
					id: crypto.randomUUID(),
					type: 'mutated',
					payload: changes ? { changes } : {},
					timestamp: Date.now(),
				});
			} catch {
				// Silently swallow — mutation hook failure must not break the operation
			}
		}

		return result;
	};
}
