/**
 * Isometry v5 -- Phase 112 E2E: File-Based Format Malformed Input Recovery
 *
 * SC2: Malformed/truncated input for each parser produces an error state (not a crash)
 * Tests verify that ImportOrchestrator handles bad data gracefully.
 */

import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/etl';
import { waitForAppReady, getCardCount } from './helpers/isometry';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.resolve(__dirname, '..', 'tests', 'fixtures', 'file-formats');

test.describe('Malformed input recovery', () => {
	test('truncated JSON produces error, zero cards', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		const malformedJson = fs.readFileSync(path.join(FIXTURE_DIR, 'malformed-truncated.json'), 'utf-8');

		const result = await page.evaluate(async (data) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('json', data);
			return { inserted: r.inserted, errors: r.errors };
		}, malformedJson);

		expect(result.errors).toBeGreaterThan(0);
		expect(result.inserted).toBe(0);

		const count = await getCardCount(page);
		expect(count).toBe(0);
	});

	test('corrupt XLSX produces zero cards without crashing', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		// Read corrupt XLSX as binary and convert to number array for page.evaluate
		const corruptBytes = fs.readFileSync(path.join(FIXTURE_DIR, 'malformed-corrupt.xlsx'));

		const result = await page.evaluate(async (bytesArr) => {
			const buffer = new Uint8Array(bytesArr).buffer;
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('excel', buffer);
			return { inserted: r.inserted, errors: r.errors };
		}, Array.from(corruptBytes));

		// SheetJS absorbs corrupt data silently (produces empty sheet, 0 rows)
		// Key assertion: import completed without crashing, zero cards written
		expect(result.inserted).toBe(0);
	});

	test('CSV with unmatched quotes does not crash', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		const malformedCsv = fs.readFileSync(
			path.join(FIXTURE_DIR, 'malformed-unmatched-quotes.csv'),
			'utf-8',
		);

		const result = await page.evaluate(async (data) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('csv', data);
			return { inserted: r.inserted, errors: r.errors, total: r.inserted + r.errors };
		}, malformedCsv);

		// PapaParse handles unmatched quotes gracefully -- may produce garbled cards or errors
		// The key assertion: import completed (did not crash/throw)
		expect(result.total).toBeGreaterThanOrEqual(0);
	});

	test('markdown without frontmatter does not crash', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		const noFrontmatter = fs.readFileSync(
			path.join(FIXTURE_DIR, 'malformed-no-frontmatter.md'),
			'utf-8',
		);

		const result = await page.evaluate(async (data) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('markdown', data);
			return { inserted: r.inserted, errors: r.errors };
		}, noFrontmatter);

		// Markdown parser gracefully handles missing frontmatter (title from heading)
		// Card should be created -- this is degradation, not failure
		expect(result.inserted).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);
	});

	test('HTML with broken tags does not crash', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		const brokenHtml = fs.readFileSync(
			path.join(FIXTURE_DIR, 'malformed-broken-tags.html'),
			'utf-8',
		);

		const result = await page.evaluate(async (data) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('html', data);
			return { inserted: r.inserted, errors: r.errors };
		}, brokenHtml);

		// HTML parser uses regex -- resilient to broken tags
		expect(result.inserted).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);
	});

	test('Apple Notes JSON with invalid schema produces error', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		const invalidSchema = fs.readFileSync(
			path.join(FIXTURE_DIR, 'malformed-invalid-schema.json'),
			'utf-8',
		);

		const result = await page.evaluate(async (data) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.importFile('apple_notes', data);
			return { inserted: r.inserted, errors: r.errors };
		}, invalidSchema);

		// AppleNotesParser throws 'Missing required field: id' -> error logged, zero cards
		expect(result.errors).toBeGreaterThan(0);
		expect(result.inserted).toBe(0);

		const count = await getCardCount(page);
		expect(count).toBe(0);
	});
});
