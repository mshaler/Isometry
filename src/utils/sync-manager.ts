/**
 * sync-manager - Re-export for backward compatibility
 *
 * The actual implementation lives in ./database/sync-manager.ts
 */

export {
  SyncManager,
  syncManager,
  type SyncConfig,
  type DataChange,
} from './database/sync-manager';
