/**
 * Isometry v5 — Playwright Test Helpers
 *
 * Wraps window.__isometry API for programmatic control of:
 *   - Data import (JSON, CSV, Markdown fixtures)
 *   - View switching (list → supergrid)
 *   - Axis configuration (PAFV col/row axes)
 *   - Filter management
 *   - Zoom, density, sort
 *   - Screenshot capture with named stages
 */

import { type Page, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Screenshot directory
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

export async function screenshot(page: Page, name: string): Promise<string> {
	const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
	await page.screenshot({ path: filePath, fullPage: false });
	return filePath;
}

// ---------------------------------------------------------------------------
// Bootstrap: wait for app ready
// ---------------------------------------------------------------------------

export async function waitForAppReady(page: Page): Promise<void> {
	await page.goto('/');
	// Wait for __isometry to be exposed (main.ts sets it after bootstrap)
	await page.waitForFunction(() => {
		const iso = (window as any).__isometry;
		return iso && iso.bridge && iso.viewManager;
	}, { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Import: load fixture data into sql.js via bridge.importFile()
// ---------------------------------------------------------------------------

export type FixtureSource = 'apple_notes' | 'json' | 'csv' | 'markdown' | 'html';

/**
 * Import a fixture file by reading it from disk and sending it through
 * bridge.importFile() — same path as a user drag-dropping a file.
 */
export async function importFixture(
	page: Page,
	fixturePath: string,
	source: FixtureSource,
	filename?: string,
): Promise<{ inserted: number; updated: number; errors: number }> {
	const absolutePath = path.resolve(fixturePath);
	const content = fs.readFileSync(absolutePath, 'utf-8');
	const fname = filename ?? path.basename(absolutePath);

	const result = await page.evaluate(
		async ({ data, source, filename }) => {
			const { bridge, coordinator } = (window as any).__isometry;
			const result = await bridge.importFile(source, data, { filename });
			coordinator.scheduleUpdate();
			return { inserted: result.inserted, updated: result.updated, errors: result.errors };
		},
		{ data: content, source, filename: fname },
	);

	// Wait for view to re-render after coordinator scheduleUpdate
	await page.waitForTimeout(500);
	return result;
}

/**
 * Import the alto-100.json dataset (100 Apple Notes).
 * This is the primary dataset shipped in public/.
 * Data format: JSON array of {path, content} with YAML frontmatter → apple_notes parser.
 */
export async function importAltoNotes(page: Page): Promise<{ inserted: number; updated: number; errors: number }> {
	const altoPath = path.resolve(__dirname, '..', '..', 'public', 'alto-100.json');
	return importFixture(page, altoPath, 'apple_notes', 'alto-100.json');
}

/**
 * Import an ETL validation snapshot fixture using the correct source type.
 *
 * Fixture formats vary by source:
 *   apple-notes: JSON array of {path, content} → source 'apple_notes'
 *   csv:         JSON array of {path, content} → source 'csv'
 *   markdown:    JSON array of {path, content} → source 'markdown'
 *   json:        JSON array of {title, body, ...} → source 'json'
 *   html:        JSON array of HTML strings → source 'html' (imported one-by-one)
 */
export async function importSnapshot(
	page: Page,
	name: 'apple-notes' | 'csv' | 'json' | 'markdown' | 'html' | 'excel-rows',
): Promise<{ inserted: number; updated: number; errors: number }> {
	const fixturePath = path.resolve(
		__dirname, '..', '..', 'tests', 'etl-validation', 'fixtures', `${name}-snapshot.json`,
	);
	const content = fs.readFileSync(fixturePath, 'utf-8');

	// Route to correct source type based on fixture format
	switch (name) {
		case 'apple-notes':
			// {path, content}[] → apple_notes parser reads YAML frontmatter
			return importFixture(page, fixturePath, 'apple_notes', `${name}-snapshot.json`);

		case 'csv':
			// {path, content}[] → csv parser reads CSV text from content
			return importFixture(page, fixturePath, 'csv', `${name}-snapshot.json`);

		case 'markdown':
			// {path, content}[] → markdown parser reads frontmatter from content
			return importFixture(page, fixturePath, 'markdown', `${name}-snapshot.json`);

		case 'json':
			// [{title, body, tags, ...}] → json parser reads raw JSON
			return importFixture(page, fixturePath, 'json', `${name}-snapshot.json`);

		case 'html': {
			// string[] — each item is an HTML document. Import all at once via evaluate.
			const htmlStrings = JSON.parse(content) as string[];
			const result = await page.evaluate(
				async ({ htmlArray, filename }) => {
					const { bridge, coordinator } = (window as any).__isometry;
					let totalInserted = 0;
					let totalUpdated = 0;
					let totalErrors = 0;
					// Import all HTML strings in a single batch
					for (const html of htmlArray) {
						const r = await bridge.importFile('html', html, { filename });
						totalInserted += r.inserted;
						totalUpdated += r.updated;
						totalErrors += r.errors;
					}
					coordinator.scheduleUpdate();
					return { inserted: totalInserted, updated: totalUpdated, errors: totalErrors };
				},
				{ htmlArray: htmlStrings, filename: `${name}-snapshot.json` },
			);
			await page.waitForTimeout(500);
			return result;
		}

		default:
			return importFixture(page, fixturePath, 'json', `${name}-snapshot.json`);
	}
}

// ---------------------------------------------------------------------------
// View switching
// ---------------------------------------------------------------------------

export async function switchToView(page: Page, viewType: string): Promise<void> {
	await page.evaluate(async (vt) => {
		const { viewManager, viewFactory } = (window as any).__isometry;
		await viewManager.switchTo(vt, () => viewFactory[vt]());
	}, viewType);
	// Wait for render to settle
	await page.waitForTimeout(800);
}

export async function switchToSuperGrid(page: Page): Promise<void> {
	await switchToView(page, 'supergrid');
	// SuperGrid container exists in DOM after mount, but may be hidden if no data (empty state).
	// Wait for either: visible grid (has data) OR empty state panel (no data).
	const gridOrEmpty = page.locator('.supergrid-container:visible, .view-empty:visible, .view-empty-panel:visible, .supergrid-view');
	await expect(gridOrEmpty.first()).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// SuperGrid assertions
// ---------------------------------------------------------------------------

export async function getDataCellCount(page: Page): Promise<number> {
	return page.locator('.data-cell').count();
}

export async function getNonEmptyCellCount(page: Page): Promise<number> {
	return page.locator('.data-cell:not(.empty-cell)').count();
}

export async function getColHeaderCount(page: Page): Promise<number> {
	return page.locator('.col-header').count();
}

export async function getRowHeaderCount(page: Page): Promise<number> {
	return page.locator('.row-header').count();
}

export async function getSelectedCellCount(page: Page): Promise<number> {
	return page.locator('.data-cell.sg-selected').count();
}

// ---------------------------------------------------------------------------
// Axis configuration
// ---------------------------------------------------------------------------

export interface AxisMapping {
	field: string;
	direction: 'asc' | 'desc';
}

export async function setColAxes(page: Page, axes: AxisMapping[]): Promise<void> {
	await page.evaluate(async (a) => {
		const { pafv, coordinator } = (window as any).__isometry;
		pafv.setColAxes(a);
		coordinator.scheduleUpdate();
	}, axes);
	await page.waitForTimeout(800);
}

export async function setRowAxes(page: Page, axes: AxisMapping[]): Promise<void> {
	await page.evaluate(async (a) => {
		const { pafv, coordinator } = (window as any).__isometry;
		pafv.setRowAxes(a);
		coordinator.scheduleUpdate();
	}, axes);
	await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export async function addFilter(page: Page, filterField: string, filterValue: string): Promise<void> {
	await page.evaluate(
		({ field, value }) => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.addFilter({ field, operator: 'eq', value });
			coordinator.scheduleUpdate();
		},
		{ field: filterField, value: filterValue },
	);
	await page.waitForTimeout(500);
}

export async function clearFilters(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const { filter, coordinator } = (window as any).__isometry;
		filter.resetToDefaults();
		coordinator.scheduleUpdate();
	});
	await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Click a column header to cycle sort. Uses the header's text content to find it.
 */
export async function clickColHeader(page: Page, headerText: string): Promise<void> {
	const header = page.locator('.col-header').filter({ hasText: headerText }).first();
	await header.click();
	await page.waitForTimeout(300);
}

/**
 * Cmd+Click a column header for multi-sort.
 */
export async function cmdClickColHeader(page: Page, headerText: string): Promise<void> {
	const header = page.locator('.col-header').filter({ hasText: headerText }).first();
	await header.click({ modifiers: ['Meta'] });
	await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

export async function zoomIn(page: Page, steps = 3): Promise<void> {
	const grid = page.locator('.supergrid-container');
	for (let i = 0; i < steps; i++) {
		await grid.dispatchEvent('wheel', {
			deltaY: -50,
			ctrlKey: true,
			metaKey: true,
		});
	}
	await page.waitForTimeout(300);
}

export async function zoomOut(page: Page, steps = 3): Promise<void> {
	const grid = page.locator('.supergrid-container');
	for (let i = 0; i < steps; i++) {
		await grid.dispatchEvent('wheel', {
			deltaY: 50,
			ctrlKey: true,
			metaKey: true,
		});
	}
	await page.waitForTimeout(300);
}

export async function resetZoom(page: Page): Promise<void> {
	await page.keyboard.press('Meta+0');
	await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export async function clickDataCell(page: Page, index = 0): Promise<void> {
	const cell = page.locator('.data-cell:not(.empty-cell)').nth(index);
	await cell.click();
	await page.waitForTimeout(200);
}

export async function cmdClickDataCell(page: Page, index: number): Promise<void> {
	const cell = page.locator('.data-cell:not(.empty-cell)').nth(index);
	await cell.click({ modifiers: ['Meta'] });
	await page.waitForTimeout(200);
}

export async function clearSelection(page: Page): Promise<void> {
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Density / Granularity
// ---------------------------------------------------------------------------

export async function setGranularity(page: Page, granularity: string | null): Promise<void> {
	await page.evaluate(async (g) => {
		const { superDensity, coordinator } = (window as any).__isometry;
		superDensity.setGranularity(g);
		coordinator.scheduleUpdate();
	}, granularity);
	await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------
// Search (FTS5)
// ---------------------------------------------------------------------------

export async function setSearchTerm(page: Page, term: string): Promise<void> {
	await page.evaluate(async (t) => {
		const { filter, coordinator } = (window as any).__isometry;
		filter.setSearchQuery(t);
		coordinator.scheduleUpdate();
	}, term);
	await page.waitForTimeout(500);
}

export async function clearSearch(page: Page): Promise<void> {
	await setSearchTerm(page, '');
}

export async function clearSearchQuery(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const { filter, coordinator } = (window as any).__isometry;
		filter.setSearchQuery(null);
		coordinator.scheduleUpdate();
	});
	await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Audit overlay
// ---------------------------------------------------------------------------

export async function toggleAuditOverlay(page: Page): Promise<void> {
	const toggle = page.locator('.audit-toggle-btn');
	if (await toggle.count() > 0) {
		await toggle.click();
		await page.waitForTimeout(300);
	}
}

// ---------------------------------------------------------------------------
// Card count from database
// ---------------------------------------------------------------------------

export async function getCardCount(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const { bridge } = (window as any).__isometry;
		const result = await bridge.send('db:query', {
			sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
			params: [],
		});
		return result.rows[0]?.cnt ?? 0;
	});
}

// ---------------------------------------------------------------------------
// Grid metrics
// ---------------------------------------------------------------------------

export async function getGridMetrics(page: Page): Promise<{
	dataCells: number;
	nonEmptyCells: number;
	colHeaders: number;
	rowHeaders: number;
	selectedCells: number;
	gridTemplateColumns: string;
}> {
	return page.evaluate(() => {
		const grid = document.querySelector('.supergrid-container') as HTMLElement | null;
		return {
			dataCells: document.querySelectorAll('.data-cell').length,
			nonEmptyCells: document.querySelectorAll('.data-cell:not(.empty-cell)').length,
			colHeaders: document.querySelectorAll('.col-header').length,
			rowHeaders: document.querySelectorAll('.row-header').length,
			selectedCells: document.querySelectorAll('.data-cell.sg-selected').length,
			gridTemplateColumns: grid?.style.gridTemplateColumns ?? '',
		};
	});
}
