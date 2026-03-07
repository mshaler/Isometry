// Isometry v5 — Phase 3 Worker Module Exports
// Public API for the Worker Bridge system.
//
// Usage:
// ```typescript
// import { getWorkerBridge } from './worker';
//
// const bridge = getWorkerBridge();
// await bridge.isReady;
// const card = await bridge.createCard({ name: 'My Card' });
// ```

// Re-export types for consumers
export type {
	// Data types (from v0.1)
	Card,
	CardInput,
	CardListOptions,
	CardType,
	CardWithDepth,
	Connection,
	ConnectionDirection,
	ConnectionInput,
	SearchResult,
	WorkerBridgeConfig,
	WorkerError,
	WorkerErrorCode,
	WorkerPayloads,
	// Protocol types
	WorkerRequest,
	WorkerRequestType,
	WorkerResponse,
	WorkerResponses,
} from './protocol';
// Re-export type guards for advanced usage
export {
	DEFAULT_WORKER_CONFIG,
	isErrorResponse,
	isInitErrorMessage,
	isReadyMessage,
	isResponse,
	isSuccessResponse,
} from './protocol';
// Main exports
export {
	createWorkerBridge,
	getWorkerBridge,
	resetWorkerBridge,
	WorkerBridge,
} from './WorkerBridge';
