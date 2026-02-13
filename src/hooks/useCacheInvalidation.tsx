/**
 * useCacheInvalidation - Re-export for backward compatibility
 *
 * The actual implementation lives in ./database/useCacheInvalidation.tsx
 */

export {
  CacheInvalidationProvider,
  useCacheInvalidation,
  useQueryCacheRegistration,
  CacheTags,
  type CacheTag,
} from './database/useCacheInvalidation';
