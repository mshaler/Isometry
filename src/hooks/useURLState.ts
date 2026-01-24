import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

/**
 * Generic hook for synchronizing state with URL query parameters
 * @param key - Query parameter key
 * @param defaultValue - Default value if not present in URL
 * @param serialize - Function to serialize value to URL-safe string
 * @param deserialize - Function to deserialize URL string to value
 * @returns [value, setValue] tuple
 */
export function useURLState<T>(
  key: string,
  defaultValue: T,
  serialize: (value: T) => string,
  deserialize: (urlString: string) => T
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial value from URL or use default
  const urlValue = searchParams.get(key);
  const [value, setValueInternal] = useState<T>(() => {
    if (urlValue) {
      try {
        return deserialize(urlValue);
      } catch (error) {
        console.warn(`Failed to deserialize URL param "${key}":`, error);
        return defaultValue;
      }
    }
    return defaultValue;
  });

  // Update URL when value changes
  const setValue = useCallback((newValue: T) => {
    setValueInternal(newValue);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      try {
        const serialized = serialize(newValue);
        // Only set if different from default to keep URLs clean
        if (serialized === serialize(defaultValue)) {
          next.delete(key);
        } else {
          next.set(key, serialized);
        }
      } catch (error) {
        console.warn(`Failed to serialize value for "${key}":`, error);
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [key, defaultValue, serialize, setSearchParams]);

  // Handle browser back/forward (popstate event)
  useEffect(() => {
    const currentUrlValue = searchParams.get(key);
    if (currentUrlValue) {
      try {
        const deserialized = deserialize(currentUrlValue);
        setValueInternal(deserialized);
      } catch (error) {
        console.warn(`Failed to deserialize URL param "${key}" on popstate:`, error);
        setValueInternal(defaultValue);
      }
    } else {
      setValueInternal(defaultValue);
    }
  }, [searchParams, key, defaultValue, deserialize]);

  return [value, setValue];
}

/**
 * Simple string-based URL state hook (legacy compatibility)
 */
export function useURLStateString<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  return useURLState(
    key,
    defaultValue,
    (v) => v,
    (s) => s as T
  );
}
