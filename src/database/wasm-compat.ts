/**
 * WKWebView WASM MIME type compatibility patch.
 *
 * Background (DB-01 / Phase 1 integration spike):
 *   WKWebView's fetch() enforces strict MIME type validation for WASM files loaded
 *   from local file:// URLs. The OS returns a generic MIME type; fetch() rejects it
 *   with "Unexpected response MIME type. Expected 'application/wasm'".
 *   XMLHttpRequest does NOT apply the same validation, so we use XHR for WASM URLs.
 *
 * Scope:
 *   - Only patches in WKWebView context (gated by __WKWebViewHandler detection)
 *   - Only intercepts requests matching sql-wasm*.wasm URLs
 *   - All other fetch() calls are passed through unchanged
 *
 * Phase 7 replacement:
 *   This is a Phase 1 integration spike. Phase 7 (Native Shell) will replace this
 *   with a Swift WKURLSchemeHandler serving files via a custom app:// scheme with
 *   the correct Content-Type: application/wasm header.
 *
 * Reference: .planning/phases/01-database-foundation/01-RESEARCH.md Pattern 6, Approach A
 */

/**
 * Patch window.fetch() to use XHR for WASM files in WKWebView.
 * Call this before initSqlJs() in browser context.
 * Safe to call in non-WKWebView contexts — returns immediately.
 */
export function patchFetchForWasm(): void {
	// Guard: Only patch in browser environments
	if (typeof window === 'undefined') return;

	// Guard: Only patch in WKWebView (detected by __WKWebViewHandler presence)
	// This avoids affecting Chrome/Safari desktop dev testing
	const isWKWebView =
		/iPhone|iPad|Mac/.test(navigator.userAgent) &&
		typeof (window as unknown as Record<string, unknown>)['__WKWebViewHandler'] !== 'undefined';

	if (!isWKWebView) return;

	const originalFetch = window.fetch;

	window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);

		// Only intercept WASM requests for sql.js
		if (url.includes('sql-wasm') && url.endsWith('.wasm')) {
			return new Promise((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('GET', url);
				xhr.responseType = 'arraybuffer';

				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve(
							new Response(xhr.response as ArrayBuffer, {
								status: xhr.status,
								headers: { 'Content-Type': 'application/wasm' },
							}),
						);
					} else {
						reject(new Error(`WASM load failed: HTTP ${xhr.status} for ${url}`));
					}
				};

				xhr.onerror = () => reject(new Error(`WASM load network error for ${url}`));
				xhr.send();
			});
		}

		// Pass through all non-WASM requests
		return originalFetch.call(window, input, init);
	};
}
