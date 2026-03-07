// Isometry v5 — Phase 46 ErrorBanner Tests
// TDD tests for error categorization and banner DOM rendering
//
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { categorizeError, createErrorBanner } from '../../src/ui/ErrorBanner';
import type { CategorizedError, ErrorCategory } from '../../src/ui/ErrorBanner';

describe('categorizeError', () => {
	// Parse errors
	it('categorizes JSON parse errors', () => {
		const result = categorizeError('JSON.parse: unexpected token');
		expect(result.category).toBe('parse');
		expect(result.title).toBe('Could not read data');
		expect(result.recovery).toBe('Check file is valid JSON/CSV');
		expect(result.detail).toBe('JSON.parse: unexpected token');
	});

	it('categorizes CSV parse errors', () => {
		const result = categorizeError('CSV parse error on line 5');
		expect(result.category).toBe('parse');
		expect(result.title).toBe('Could not read data');
	});

	it('categorizes syntax errors', () => {
		const result = categorizeError('SyntaxError: unexpected token');
		expect(result.category).toBe('parse');
	});

	it('categorizes XML errors', () => {
		const result = categorizeError('Invalid XML document');
		expect(result.category).toBe('parse');
	});

	// Database errors
	it('categorizes SQLITE errors', () => {
		const result = categorizeError('SQLITE_ERROR: no such table');
		expect(result.category).toBe('database');
		expect(result.title).toBe('Database error');
		expect(result.recovery).toBe('Reload the app');
	});

	it('categorizes database column errors', () => {
		const result = categorizeError('no such column: foo');
		expect(result.category).toBe('database');
	});

	it('categorizes DB connection errors', () => {
		const result = categorizeError('db: connection failed');
		expect(result.category).toBe('database');
	});

	// Network errors
	it('categorizes WASM fetch errors', () => {
		const result = categorizeError('Failed to fetch WASM');
		expect(result.category).toBe('network');
		expect(result.title).toBe('Connection error');
		expect(result.recovery).toBe('Retry');
	});

	it('categorizes network errors', () => {
		const result = categorizeError('NetworkError: failed to connect');
		expect(result.category).toBe('network');
	});

	it('categorizes worker errors', () => {
		const result = categorizeError('Worker failed to load');
		expect(result.category).toBe('network');
	});

	// Import errors
	it('categorizes import errors', () => {
		const result = categorizeError('Import failed: unsupported format');
		expect(result.category).toBe('import');
		expect(result.title).toBe('Import failed');
		expect(result.recovery).toBe('Try a different file');
	});

	it('categorizes unsupported format errors', () => {
		const result = categorizeError('unsupported file format');
		expect(result.category).toBe('import');
	});

	// Unknown errors
	it('categorizes unknown errors with fallback', () => {
		const result = categorizeError('something random');
		expect(result.category).toBe('unknown');
		expect(result.title).toBe('Something went wrong');
		expect(result.recovery).toBe('Retry');
		expect(result.detail).toBe('something random');
	});

	// Case insensitivity
	it('matches patterns case-insensitively', () => {
		expect(categorizeError('SQLITE_ERROR').category).toBe('database');
		expect(categorizeError('json parse failed').category).toBe('parse');
		expect(categorizeError('IMPORT failed').category).toBe('import');
	});
});

describe('createErrorBanner', () => {
	it('returns element with view-error-banner class', () => {
		const error = categorizeError('test error');
		const el = createErrorBanner(error, () => {});
		expect(el.className).toBe('view-error-banner');
	});

	it('shows category title in error-category span', () => {
		const error = categorizeError('SQLITE_ERROR: no such table');
		const el = createErrorBanner(error, () => {});
		const categoryEl = el.querySelector('.error-category');
		expect(categoryEl).not.toBeNull();
		expect(categoryEl!.textContent).toBe('Database error');
	});

	it('shows original message in error-detail span', () => {
		const error = categorizeError('SQLITE_ERROR: no such table');
		const el = createErrorBanner(error, () => {});
		const detailEl = el.querySelector('.error-detail');
		expect(detailEl).not.toBeNull();
		expect(detailEl!.textContent).toBe('SQLITE_ERROR: no such table');
	});

	it('shows recovery text on retry button', () => {
		const error = categorizeError('SQLITE_ERROR: no such table');
		const el = createErrorBanner(error, () => {});
		const btn = el.querySelector('.retry-btn') as HTMLButtonElement;
		expect(btn).not.toBeNull();
		expect(btn.textContent).toBe('Reload the app');
	});

	it('calls onRetry when retry button is clicked', () => {
		const onRetry = vi.fn();
		const error = categorizeError('test error');
		const el = createErrorBanner(error, onRetry);
		const btn = el.querySelector('.retry-btn') as HTMLButtonElement;
		btn.click();
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it('renders different recovery text per category', () => {
		const parseError = categorizeError('JSON parse failed');
		const parseEl = createErrorBanner(parseError, () => {});
		expect((parseEl.querySelector('.retry-btn') as HTMLButtonElement).textContent).toBe('Check file is valid JSON/CSV');

		const networkError = categorizeError('Failed to fetch WASM');
		const networkEl = createErrorBanner(networkError, () => {});
		expect((networkEl.querySelector('.retry-btn') as HTMLButtonElement).textContent).toBe('Retry');
	});
});
