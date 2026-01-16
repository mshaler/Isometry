import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useURLState<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = (searchParams.get(key) as T) ?? defaultValue;

  const setValue = useCallback((newValue: T) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newValue === defaultValue) {
        next.delete(key);
      } else {
        next.set(key, newValue);
      }
      return next;
    }, { replace: true });
  }, [key, defaultValue, setSearchParams]);

  return [value, setValue];
}
