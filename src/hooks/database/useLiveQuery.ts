/**
 * React hook for live database queries with automatic UI updates
 *
 * Integrates with ChangeNotificationBridge for real-time change notifications
 * through the optimized WebView bridge infrastructure with sequence tracking
 * for race condition prevention.
 *
 * Enhanced with TanStack Query intelligent caching for stale-while-revalidate
 * patterns and instant cached responses.
 */

// Re-export types
export type {
  LiveQueryOptions,
  LiveQueryResult,
  QueryCacheInfo,
  BackgroundSyncConfig,
  ConnectionStateConfig,
  ConnectionState,
  SyncStatus
} from './types';

// Re-export core hook
export { useLiveQuery } from './useLiveQueryCore';

// Re-export specialized variants
export {
  useLiveNodes,
  useLiveQueryManual,
  useLiveQueryLegacy,
  useLiveQueryOptimized,
  useLiveQueryOffline,
  useLiveQueryReadOnly
} from './useLiveQueryVariants';