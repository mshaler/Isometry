import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// Override global testTimeout (10s) for this file — vite build takes ~5-10 seconds.
// Vitest respects the top-level timeout setter called before describe().
const LONG_TIMEOUT = 60000;

describe('Production Build Verification', () => {
	const projectRoot = resolve(__dirname, '../..');
	const distDir = resolve(projectRoot, 'dist');
	const distAssetsDir = resolve(distDir, 'assets');

	it('DB-05: vite build completes without errors', { timeout: LONG_TIMEOUT }, () => {
		// Run vite build and capture output
		const result = execSync('npx vite build', {
			cwd: projectRoot,
			encoding: 'utf-8',
			timeout: 30000,
		});
		expect(result).toBeDefined();
	});

	it('DB-05: WASM file is present in dist/assets/', () => {
		expect(existsSync(distAssetsDir)).toBe(true);
		const files = readdirSync(distAssetsDir);
		const wasmFile = files.find((f) => f.includes('sql-wasm') && f.endsWith('.wasm'));
		expect(wasmFile).toBeDefined();
	});

	it('DB-05: WASM file is correctly sized (500KB-2MB)', () => {
		const files = readdirSync(distAssetsDir);
		const wasmFile = files.find((f) => f.includes('sql-wasm') && f.endsWith('.wasm'));
		expect(wasmFile).toBeDefined();
		const stats = statSync(resolve(distAssetsDir, wasmFile!));
		expect(stats.size).toBeGreaterThan(500 * 1024); // > 500KB
		expect(stats.size).toBeLessThan(2 * 1024 * 1024); // < 2MB
	});

	it('DB-05: WASM is NOT inlined as base64 in any JS chunk', () => {
		const files = readdirSync(distAssetsDir);
		const jsFiles = files.filter((f) => f.endsWith('.js'));
		for (const jsFile of jsFiles) {
			const content = readFileSync(resolve(distAssetsDir, jsFile), 'utf-8');
			// Base64-encoded WASM would contain this data URI prefix
			expect(content).not.toContain('data:application/wasm;base64,');
		}
	});
});
