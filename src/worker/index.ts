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

// Main exports
export {
  WorkerBridge,
  getWorkerBridge,
  createWorkerBridge,
  resetWorkerBridge,
} from './WorkerBridge';

// Re-export types for consumers
export type {
  // Protocol types
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  WorkerPayloads,
  WorkerResponses,
  WorkerError,
  WorkerErrorCode,
  WorkerBridgeConfig,
  // Data types (from v0.1)
  Card,
  CardInput,
  CardListOptions,
  CardType,
  Connection,
  ConnectionInput,
  ConnectionDirection,
  SearchResult,
  CardWithDepth,
} from './protocol';

// Re-export type guards for advanced usage
export {
  isReadyMessage,
  isInitErrorMessage,
  isResponse,
  isSuccessResponse,
  isErrorResponse,
  DEFAULT_WORKER_CONFIG,
} from './protocol';
