// Isometry v5 -- Phase 47 ETL Validation Helpers
// Shared fixture loading, database setup, and card query helpers.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from '../../src/database/Database';
import { DedupEngine } from '../../src/etl/DedupEngine';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';
import type { CanonicalCard, ImportResult, SourceType } from '../../src/etl/types';
import { toCardDatum } from '../../src/views/types';
import type { CardDatum } from '../../src/views/types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

/**
 * Load a fixture file as a raw string.
 */
export function loadFixture(name: string): string {
	return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/**
 * Load a fixture file and parse it as JSON.
 */
export function loadFixtureJSON<T>(name: string): T {
	return JSON.parse(loadFixture(name)) as T;
}

/**
 * Create a fresh in-memory Database with schema applied.
 */
export async function createTestDb(): Promise<Database> {
	const db = new Database();
	await db.initialize();
	return db;
}

/**
 * Import a file-based source through ImportOrchestrator.
 * Supports: apple_notes, markdown, csv, json, excel, html
 */
export async function importFileSource(
	db: Database,
	source: SourceType,
	data: string | ArrayBuffer,
): Promise<ImportResult> {
	const orchestrator = new ImportOrchestrator(db);
	return orchestrator.import(source, data);
}

/**
 * Import a native source through DedupEngine + SQLiteWriter.
 * Matches the etl-import-native.handler.ts code path.
 * Supports: native_reminders, native_calendar, native_notes
 */
export async function importNativeSource(
	db: Database,
	sourceType: SourceType,
	cards: CanonicalCard[],
): Promise<ImportResult> {
	const dedup = new DedupEngine(db);
	const writer = new SQLiteWriter(db);
	const dedupResult = dedup.process(cards, [], sourceType);
	await writer.writeCards(dedupResult.toInsert, false);
	await writer.updateCards(dedupResult.toUpdate);
	await writer.writeConnections(dedupResult.connections);
	return {
		inserted: dedupResult.toInsert.length,
		updated: dedupResult.toUpdate.length,
		unchanged: dedupResult.toSkip.length,
		skipped: 0,
		errors: 0,
		connections_created: dedupResult.connections.length,
		insertedIds: dedupResult.toInsert.map((c) => c.id),
		updatedIds: dedupResult.toUpdate.map((c) => c.id),
		deletedIds: dedupResult.deletedIds,
		errors_detail: [],
	};
}

/**
 * Query all cards from the database for a given source type.
 * Returns CardDatum[] for view-level assertions.
 */
export function queryCardsForSource(db: Database, source: string): CardDatum[] {
	const stmt = db.prepare<Record<string, unknown>>(
		`SELECT id, name, folder, status, card_type, created_at, modified_at,
            priority, sort_order, due_at, content as body_text, source
     FROM cards WHERE source = ? AND deleted_at IS NULL ORDER BY name`,
	);
	const rows = stmt.all(source);
	stmt.free();
	return rows.map(toCardDatum);
}

/**
 * Count cards in the database for a given source type.
 */
export function queryCardCount(db: Database, source: string): number {
	const stmt = db.prepare<{ count: number }>(
		'SELECT COUNT(*) as count FROM cards WHERE source = ? AND deleted_at IS NULL',
	);
	const rows = stmt.all(source);
	stmt.free();
	return rows[0]?.count ?? 0;
}

/**
 * Count connections in the database.
 */
export function queryConnectionCount(db: Database): number {
	const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM connections');
	const rows = stmt.all();
	stmt.free();
	return rows[0]?.count ?? 0;
}

/**
 * Generate an Excel ArrayBuffer fixture from row data using SheetJS.
 * Creates a proper .xlsx in-memory for ExcelParser consumption.
 */
export async function generateExcelBuffer(
	rows: Array<Record<string, unknown>>,
): Promise<ArrayBuffer> {
	const XLSX = await import('xlsx');
	const workbook = XLSX.utils.book_new();

	// Extract headers from first row
	const headers = Object.keys(rows[0] ?? {});
	const data: unknown[][] = [headers];

	for (const row of rows) {
		const values = headers.map((h) => row[h] ?? '');
		data.push(values);
	}

	const sheet = XLSX.utils.aoa_to_sheet(data);
	XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');

	const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
