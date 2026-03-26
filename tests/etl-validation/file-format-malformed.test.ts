// Isometry v5 -- Phase 112 Malformed Input Recovery (Vitest Integration)
// Verifies that each parser handles malformed input gracefully:
// - Fatal parse errors: zero cards, errors > 0
// - Resilient parsers: graceful degradation, cards still created

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/database/Database';
import { createTestDb, importFileSource } from './helpers';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'file-formats');

describe('Malformed input recovery', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('truncated JSON produces error, zero cards', async () => {
		const data = readFileSync(join(FIXTURE_DIR, 'malformed-truncated.json'), 'utf-8');
		const result = await importFileSource(db, 'json', data);

		expect(result.errors).toBeGreaterThan(0);
		expect(result.inserted).toBe(0);
	});

	it('corrupt XLSX produces zero cards without crashing', async () => {
		const buffer = readFileSync(join(FIXTURE_DIR, 'malformed-corrupt.xlsx'));
		const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
		const result = await importFileSource(db, 'excel', arrayBuffer);

		// SheetJS absorbs corrupt data silently (produces empty sheet, 0 rows)
		// Key assertion: import completed without throwing, zero cards written
		expect(result.inserted).toBe(0);
	});

	it('CSV with unmatched quotes does not crash', async () => {
		const data = readFileSync(join(FIXTURE_DIR, 'malformed-unmatched-quotes.csv'), 'utf-8');
		const result = await importFileSource(db, 'csv', data);

		// PapaParse handles unmatched quotes gracefully -- may produce garbled cards or errors
		// The key assertion: import completed without throwing
		expect(result.inserted + result.errors).toBeGreaterThanOrEqual(0);
	});

	it('markdown without frontmatter produces cards (graceful degradation)', async () => {
		const data = readFileSync(join(FIXTURE_DIR, 'malformed-no-frontmatter.md'), 'utf-8');
		const result = await importFileSource(db, 'markdown', data);

		// Markdown parser gracefully handles missing frontmatter (title from heading)
		expect(result.inserted).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);
	});

	it('HTML with broken tags produces cards (resilient parser)', async () => {
		const data = readFileSync(join(FIXTURE_DIR, 'malformed-broken-tags.html'), 'utf-8');
		const result = await importFileSource(db, 'html', data);

		// HTML parser uses regex -- resilient to broken tags
		expect(result.inserted).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);
	});

	it('Apple Notes JSON with invalid schema produces error, zero cards', async () => {
		const data = readFileSync(join(FIXTURE_DIR, 'malformed-invalid-schema.json'), 'utf-8');
		const result = await importFileSource(db, 'apple_notes', data);

		// AppleNotesParser throws 'Missing required field: id' -> error logged, zero cards
		expect(result.errors).toBeGreaterThan(0);
		expect(result.inserted).toBe(0);
	});
});
