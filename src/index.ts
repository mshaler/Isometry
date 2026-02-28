// Isometry v5 — Application Entry Point
// Re-export core database module for use by downstream consumers

export { Database } from './database/Database';
export { patchFetchForWasm } from './database/wasm-compat';
