/**
 * useURLState Hook
 *
 * Bridge eliminated - minimal URL state management
 */

import { useState, useEffect, useCallback } from 'react';

export function useURLState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const value = urlParams.get(key);
      if (value) {
        return JSON.parse(decodeURIComponent(value));
      }
    } catch {
      // Ignore parsing errors
    }
    return defaultValue;
  });

  const setURLState = useCallback((value: T) => {
    setState(value);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value === defaultValue || value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, encodeURIComponent(JSON.stringify(value)));
      }

      window.history.replaceState({}, '', url.toString());
    }
  }, [key, defaultValue]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const value = urlParams.get(key);
          if (value) {
            setState(JSON.parse(decodeURIComponent(value)));
          } else {
            setState(defaultValue);
          }
        } catch {
          setState(defaultValue);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [key, defaultValue]);

  return [state, setURLState];
}

export default useURLState;