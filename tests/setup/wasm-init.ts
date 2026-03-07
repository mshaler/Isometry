import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export async function setup() {
	// First try custom FTS5 build in src/assets/
	const customWasmPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets/sql-wasm-fts5.wasm');

	if (existsSync(customWasmPath)) {
		process.env['SQL_WASM_PATH'] = customWasmPath;
		return;
	}

	// Fallback to default sql.js dist (no FTS5, but tests can still run for config validation)
	const defaultWasmPath = resolve(
		dirname(fileURLToPath(import.meta.url)),
		'../../node_modules/sql.js/dist/sql-wasm.wasm',
	);

	if (existsSync(defaultWasmPath)) {
		process.env['SQL_WASM_PATH'] = defaultWasmPath;
		return;
	}

	throw new Error('No sql.js WASM file found. Run the custom FTS5 build first or ensure sql.js is installed.');
}
