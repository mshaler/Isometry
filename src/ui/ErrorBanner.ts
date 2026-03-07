// Isometry v5 — Phase 46 ErrorBanner Utility
// Categorizes raw error messages into user-friendly categories with recovery actions.
//
// Design:
//   - categorizeError() pattern-matches error messages (case-insensitive)
//   - createErrorBanner() builds accessible banner DOM with category title + detail
//   - Replaces raw error strings in ViewManager._showError()
//
// Requirements: STAB-01

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Error category for pattern matching */
export type ErrorCategory = 'import' | 'parse' | 'database' | 'network' | 'unknown';

/** Categorized error with user-friendly title and recovery action */
export interface CategorizedError {
	category: ErrorCategory;
	title: string;
	recovery: string;
	detail: string;
}

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
	category: ErrorCategory;
	patterns: RegExp[];
	title: string;
	recovery: string;
}

/**
 * Ordered list of error categories. First match wins.
 * Database checked before network because "connection" could mean DB connection.
 */
const CATEGORIES: CategoryDef[] = [
	{
		category: 'parse',
		patterns: [/json/i, /csv/i, /parse/i, /syntax/i, /unexpected\s+token/i, /xml/i],
		title: 'Could not read data',
		recovery: 'Check file is valid JSON/CSV',
	},
	{
		category: 'database',
		patterns: [/sqlite/i, /database/i, /\bdb:/i, /\btable\b/i, /\bcolumn\b/i],
		title: 'Database error',
		recovery: 'Reload the app',
	},
	{
		category: 'network',
		patterns: [/wasm/i, /\bfetch\b/i, /network/i, /worker/i, /connection/i, /\bload\b/i],
		title: 'Connection error',
		recovery: 'Retry',
	},
	{
		category: 'import',
		patterns: [/import/i, /unsupported/i, /\bformat\b/i, /\bfile\b/i],
		title: 'Import failed',
		recovery: 'Try a different file',
	},
];

// ---------------------------------------------------------------------------
// categorizeError
// ---------------------------------------------------------------------------

/**
 * Categorize an error message into a user-friendly category with recovery action.
 *
 * Pattern matching is case-insensitive. First matching category wins.
 * Unknown errors get a generic "Something went wrong" message.
 *
 * @param message - Raw error message string
 * @returns CategorizedError with title, recovery, and original detail
 */
export function categorizeError(message: string): CategorizedError {
	for (const def of CATEGORIES) {
		for (const pattern of def.patterns) {
			if (pattern.test(message)) {
				return {
					category: def.category,
					title: def.title,
					recovery: def.recovery,
					detail: message,
				};
			}
		}
	}

	return {
		category: 'unknown',
		title: 'Something went wrong',
		recovery: 'Retry',
		detail: message,
	};
}

// ---------------------------------------------------------------------------
// createErrorBanner
// ---------------------------------------------------------------------------

/**
 * Create an error banner DOM element with categorized title, detail, and retry button.
 *
 * Structure:
 *   .view-error-banner
 *     .error-category   — user-friendly title (e.g., "Database error")
 *     .error-detail     — original error message (developer reference)
 *     .retry-btn        — button with recovery text (e.g., "Reload the app")
 *
 * @param error - Categorized error from categorizeError()
 * @param onRetry - Callback invoked when the retry button is clicked
 * @returns HTMLElement ready to append to the container
 */
export function createErrorBanner(error: CategorizedError, onRetry: () => void): HTMLElement {
	const banner = document.createElement('div');
	banner.className = 'view-error-banner';

	const categoryEl = document.createElement('span');
	categoryEl.className = 'error-category';
	categoryEl.textContent = error.title;

	const detailEl = document.createElement('span');
	detailEl.className = 'error-detail';
	detailEl.textContent = error.detail;

	const retryBtn = document.createElement('button');
	retryBtn.className = 'retry-btn';
	retryBtn.textContent = error.recovery;
	retryBtn.addEventListener('click', onRetry);

	banner.appendChild(categoryEl);
	banner.appendChild(detailEl);
	banner.appendChild(retryBtn);

	return banner;
}
