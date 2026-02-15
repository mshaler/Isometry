/**
 * useSettings - React hook for type-safe settings access
 *
 * Provides reactive access to user preferences with TanStack Query caching.
 * Settings are persisted in SQLite and cached for performance.
 *
 * Phase 100-01: Settings Registry
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { createSettingsService } from '../db/settings';

/**
 * Hook for accessing a single setting with type safety and caching.
 * Returns a tuple of [value, setValue] similar to useState.
 *
 * @param key - Setting key (e.g., 'theme', 'sidebar_collapsed')
 * @param defaultValue - Default value if setting doesn't exist
 * @returns Tuple of [current value, setter function]
 *
 * @example
 * const [theme, setTheme] = useSetting('theme', 'NeXTSTEP');
 * const [collapsed, setCollapsed] = useSetting('sidebar_collapsed', false);
 *
 * // Update setting
 * setTheme('Modern');
 */
export function useSetting<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const { db, dataVersion } = useSQLite();
  const queryClient = useQueryClient();

  // Query for getting the setting value
  const { data } = useQuery({
    queryKey: ['setting', key, dataVersion],
    queryFn: () => {
      if (!db) return defaultValue;

      const service = createSettingsService(db);
      const value = service.getSetting<T>(key);
      return value ?? defaultValue;
    },
    enabled: !!db,
    staleTime: Infinity, // Settings rarely change externally
  });

  // Mutation for setting the value
  const mutation = useMutation({
    mutationFn: async (newValue: T) => {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const service = createSettingsService(db);
      service.setSetting(key, newValue);
    },
    onSuccess: (_, newValue) => {
      // Optimistically update the cache
      queryClient.setQueryData(['setting', key, dataVersion], newValue);
    },
    onError: (error) => {
      console.error(`[useSetting] Failed to set "${key}":`, error);
    },
  });

  const setValue = useCallback(
    (newValue: T) => {
      mutation.mutate(newValue);
    },
    [mutation]
  );

  return [data ?? defaultValue, setValue];
}

/**
 * Hook for accessing all settings as a key-value object.
 * Useful for debugging, settings inspector UI, or batch operations.
 *
 * @returns Object with all settings as key-value pairs
 *
 * @example
 * const allSettings = useAllSettings();
 * console.log(allSettings); // { theme: 'NeXTSTEP', sidebar_collapsed: false, ... }
 */
export function useAllSettings(): Record<string, unknown> {
  const { db, dataVersion } = useSQLite();

  const { data } = useQuery({
    queryKey: ['settings', 'all', dataVersion],
    queryFn: () => {
      if (!db) return {};

      const service = createSettingsService(db);
      return service.getAllSettings();
    },
    enabled: !!db,
    staleTime: Infinity,
  });

  return data ?? {};
}
