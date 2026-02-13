/**
 * enhanced-sync - Re-export for backward compatibility
 *
 * The actual implementation lives in ./database/enhanced-sync.ts
 */

export {
  EnhancedSyncManager,
  enhancedSyncManager,
  type SyncStatus,
  type SyncDevice,
  type SyncSession,
} from './database/enhanced-sync';
