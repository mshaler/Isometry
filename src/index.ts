// Isometry v5 — Application Entry Point
//
// Phase 3+: WorkerBridge is the primary API for all database operations.
// Direct Database access is preserved for testing and advanced use cases.

// ---------------------------------------------------------------------------
// Primary API: WorkerBridge (Phase 3+)
// ---------------------------------------------------------------------------
// All database operations should go through the WorkerBridge to keep the
// main thread responsive. The worker handles sql.js WASM execution.

export {
  WorkerBridge,
  getWorkerBridge,
  createWorkerBridge,
  resetWorkerBridge,
} from './worker';

// Re-export types from worker module
export type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  WorkerError,
  WorkerErrorCode,
  WorkerBridgeConfig,
} from './worker';

// ---------------------------------------------------------------------------
// Data Types (shared between worker and main thread)
// ---------------------------------------------------------------------------

export type {
  Card,
  CardInput,
  CardListOptions,
  CardType,
  Connection,
  ConnectionInput,
  ConnectionDirection,
  SearchResult,
  CardWithDepth,
} from './worker';

// ---------------------------------------------------------------------------
// Internal/Testing API: Direct Database Access
// ---------------------------------------------------------------------------
// @internal — Prefer WorkerBridge for all production use.
// Direct Database access is useful for:
//   - Unit testing query modules without worker overhead
//   - Debugging database issues
//   - Advanced scenarios requiring synchronous access
//
// Note: Direct Database operations block the main thread during WASM execution.

export { Database } from './database/Database';
export { patchFetchForWasm } from './database/wasm-compat';

// Query module exports (used by worker handlers, also available for testing)
export * as cardQueries from './database/queries/cards';
export * as connectionQueries from './database/queries/connections';
export * as searchQueries from './database/queries/search';
export * as graphQueries from './database/queries/graph';

// ---------------------------------------------------------------------------
// Providers (Phase 4)
// ---------------------------------------------------------------------------
export {
  FilterProvider,
  PAFVProvider,
  SelectionProvider,
  DensityProvider,
  StateCoordinator,
  StateManager,
  QueryBuilder,
  ALLOWED_FILTER_FIELDS,
  ALLOWED_OPERATORS,
  ALLOWED_AXIS_FIELDS,
  isValidFilterField,
  isValidOperator,
  isValidAxisField,
  validateFilterField,
  validateOperator,
  validateAxisField,
} from './providers';
export type {
  FilterField,
  FilterOperator,
  AxisField,
  SortDirection,
  TimeGranularity,
  ViewType,
  ViewFamily,
  Filter,
  AxisMapping,
  CompiledFilter,
  CompiledAxis,
  CompiledDensity,
  PersistableProvider,
  CompiledQuery,
  CardQueryOptions,
} from './providers';

// ---------------------------------------------------------------------------
// Mutations (Phase 4)
// ---------------------------------------------------------------------------
export {
  MutationManager,
  setupMutationShortcuts,
  createCardMutation,
  updateCardMutation,
  deleteCardMutation,
  createConnectionMutation,
  deleteConnectionMutation,
  batchMutation,
} from './mutations';
export type { MutationCommand, Mutation, MutationBridge } from './mutations';
