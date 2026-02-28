// Isometry v5 — Application Entry Point
// Re-export core database module for use by downstream consumers

export { Database } from './database/Database';
export { patchFetchForWasm } from './database/wasm-compat';

// Phase 2: Query modules
// NOTE: connections, search, and graph exports will fail typecheck until Plans 02-02,
// 02-03, and 02-04 create those files. This is intentional — Plan 02-01 owns index.ts
// for the entire phase. Plans 02-02 through 02-04 do NOT modify index.ts.
export * from './database/queries/types';
export * from './database/queries/cards';
export * from './database/queries/connections';
export * from './database/queries/search';
export * from './database/queries/graph';
