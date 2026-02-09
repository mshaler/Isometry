import { useCallback, useEffect, useState } from 'react';

/**
 * Generic hook for synchronizing state with URL query parameters (router-independent)
 * Uses native browser URL API instead of react-router-dom to avoid Router context dependency
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
  // Get initial value from URL or use default
  const [value, setValueInternal] = useState<T>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlValue = urlParams.get(key);
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

    // Update URL using native browser API
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);

    try {
      const serialized = serialize(newValue);
      // Only set if different from default to keep URLs clean
      if (serialized === serialize(defaultValue)) {
        params.delete(key);
      } else {
        params.set(key, serialized);
      }

      // Update browser URL without page reload
      const newUrl = `${url.pathname}?${params.toString()}${url.hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch (error) {
      console.warn(`Failed to serialize value for "${key}":`, error);
      params.delete(key);
      const newUrl = `${url.pathname}?${params.toString()}${url.hash}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [key, defaultValue, serialize]);

  // Handle browser back/forward (popstate event)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentUrlValue = urlParams.get(key);
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
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [key, defaultValue, deserialize]);

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
