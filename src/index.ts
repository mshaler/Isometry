// Isometry v5 — Application Entry Point
//
// Phase 3+: WorkerBridge is the primary API for all database operations.
// Direct Database access is preserved for testing and advanced use cases.

// ---------------------------------------------------------------------------
// Primary API: WorkerBridge (Phase 3+)
// ---------------------------------------------------------------------------
// All database operations should go through the WorkerBridge to keep the
// main thread responsive. The worker handles sql.js WASM execution.

// Re-export types from worker module
export type {
	WorkerBridgeConfig,
	WorkerError,
	WorkerErrorCode,
	WorkerRequest,
	WorkerRequestType,
	WorkerResponse,
} from './worker';
export {
	createWorkerBridge,
	getWorkerBridge,
	resetWorkerBridge,
	WorkerBridge,
} from './worker';

// ---------------------------------------------------------------------------
// Data Types (shared between worker and main thread)
// ---------------------------------------------------------------------------

export type {
	Card,
	CardInput,
	CardListOptions,
	CardType,
	CardWithDepth,
	Connection,
	ConnectionDirection,
	ConnectionInput,
	SearchResult,
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
// Query module exports (used by worker handlers, also available for testing)
export * as cardQueries from './database/queries/cards';
export * as connectionQueries from './database/queries/connections';
export * as graphQueries from './database/queries/graph';
export * as searchQueries from './database/queries/search';
export { patchFetchForWasm } from './database/wasm-compat';
// ---------------------------------------------------------------------------
// ETL Pipeline (Phase 8)
// ---------------------------------------------------------------------------
export * from './etl';
export type { Mutation, MutationBridge, MutationCommand } from './mutations';

// ---------------------------------------------------------------------------
// Mutations (Phase 4)
// ---------------------------------------------------------------------------
export {
	batchMutation,
	createCardMutation,
	createConnectionMutation,
	deleteCardMutation,
	deleteConnectionMutation,
	MutationManager,
	setupMutationShortcuts,
	updateCardMutation,
} from './mutations';
export type {
	AxisField,
	AxisMapping,
	CardQueryOptions,
	CompiledAxis,
	CompiledDensity,
	CompiledFilter,
	CompiledQuery,
	Filter,
	FilterField,
	FilterOperator,
	PersistableProvider,
	SortDirection,
	TimeGranularity,
	ViewFamily,
	ViewType,
} from './providers';
// ---------------------------------------------------------------------------
// Providers (Phase 4)
// ---------------------------------------------------------------------------
export {
	ALLOWED_AXIS_FIELDS,
	ALLOWED_FILTER_FIELDS,
	ALLOWED_OPERATORS,
	DensityProvider,
	FilterProvider,
	isValidAxisField,
	isValidFilterField,
	isValidOperator,
	PAFVProvider,
	QueryBuilder,
	SelectionProvider,
	StateCoordinator,
	StateManager,
	validateAxisField,
	validateFilterField,
	validateOperator,
} from './providers';
// ---------------------------------------------------------------------------
// UI Components (Phase 10)
// ---------------------------------------------------------------------------
export { ImportToast } from './ui/ImportToast';
export type { CardDatum, IView, ViewConfig } from './views';
// ---------------------------------------------------------------------------
// Views (Phase 5)
// ---------------------------------------------------------------------------
export {
	CARD_DIMENSIONS,
	CARD_TYPE_ICONS,
	CalendarView,
	crossfadeTransition,
	GalleryView,
	GridView,
	KanbanView,
	ListView,
	morphTransition,
	renderHtmlCard,
	renderSvgCard,
	shouldUseMorph,
	TimelineView,
	toCardDatum,
	ViewManager,
} from './views';

// Re-export notification types for wiring
export type {
	ImportProgressPayload,
	WorkerNotification,
} from './worker/protocol';
