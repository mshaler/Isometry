// ============================================================================
// Cache Invalidation System Tests
// ============================================================================
// Tests for cache invalidation with dependency tracking and tagging
// ============================================================================

import { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  CacheInvalidationProvider,
  useCacheInvalidation,
  useQueryCacheRegistration,
  CacheTags
} from '../useCacheInvalidation';

// Test wrapper component
function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <CacheInvalidationProvider>
      {children}
    </CacheInvalidationProvider>
  );
}

describe('CacheInvalidationProvider', () => {
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('should provide cache invalidation context', () => {
    const { result } = renderHook(() => useCacheInvalidation(), { wrapper });

    expect(result.current).toBeDefined();
    expect(typeof result.current.invalidate).toBe('function');
    expect(typeof result.current.register).toBe('function');
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useCacheInvalidation());
    }).toThrow('useCacheInvalidation must be used within CacheInvalidationProvider');
  });
});

describe('Cache Registration and Invalidation', () => {
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('should register and call refetch functions for matching tags', () => {
    const refetch1 = vi.fn();
    const refetch2 = vi.fn();
    const refetch3 = vi.fn();

    const { result } = renderHook(() => {
      const { invalidate } = useCacheInvalidation();

      // Register all three in the same hook
      useQueryCacheRegistration(['nodes'], refetch1);
      useQueryCacheRegistration(['nodes', 'search'], refetch2);
      useQueryCacheRegistration(['notebook_cards'], refetch3);

      return { invalidate };
    }, { wrapper });

    // Invalidate 'nodes' tag
    act(() => {
      result.current.invalidate(['nodes']);
    });

    // Should call refetch1 and refetch2, but not refetch3
    expect(refetch1).toHaveBeenCalledTimes(1);
    expect(refetch2).toHaveBeenCalledTimes(1);
    expect(refetch3).toHaveBeenCalledTimes(0);

    // Reset and invalidate 'search' tag
    refetch1.mockClear();
    refetch2.mockClear();
    refetch3.mockClear();

    act(() => {
      result.current.invalidate(['search']);
    });

    // Should only call refetch2
    expect(refetch1).toHaveBeenCalledTimes(0);
    expect(refetch2).toHaveBeenCalledTimes(1);
    expect(refetch3).toHaveBeenCalledTimes(0);
  });

  it('should handle multiple tag invalidation', () => {
    const refetch1 = vi.fn();
    const refetch2 = vi.fn();

    const { result } = renderHook(() => {
      const { invalidate } = useCacheInvalidation();

      useQueryCacheRegistration(['nodes'], refetch1);
      useQueryCacheRegistration(['notebook_cards'], refetch2);

      return { invalidate };
    }, { wrapper });

    act(() => {
      result.current.invalidate(['nodes', 'notebook_cards']);
    });

    expect(refetch1).toHaveBeenCalledTimes(1);
    expect(refetch2).toHaveBeenCalledTimes(1);
  });

  it('should not call same refetch function multiple times for overlapping tags', () => {
    const refetch = vi.fn();

    const { result } = renderHook(() => {
      const { invalidate } = useCacheInvalidation();

      useQueryCacheRegistration(['nodes', 'search'], refetch);

      return { invalidate };
    }, { wrapper });

    act(() => {
      result.current.invalidate(['nodes', 'search']);
    });

    // Should only be called once despite matching both tags
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup when component unmounts', () => {
    const refetch = vi.fn();

    const { result: invalidationResult } = renderHook(() => useCacheInvalidation(), { wrapper });
    const { unmount } = renderHook(() => useQueryCacheRegistration(['nodes'], refetch), { wrapper });

    // Unmount the registration hook
    unmount();

    act(() => {
      invalidationResult.current.invalidate(['nodes']);
    });

    // Should not be called after unmount
    expect(refetch).toHaveBeenCalledTimes(0);
  });

  it('should handle empty tags array', () => {
    const refetch = vi.fn();

    const { result: invalidationResult } = renderHook(() => useCacheInvalidation(), { wrapper });
    renderHook(() => useQueryCacheRegistration([], refetch), { wrapper });

    act(() => {
      invalidationResult.current.invalidate(['nodes']);
    });

    // Should not be called when registered with empty tags
    expect(refetch).toHaveBeenCalledTimes(0);
  });

  it('should handle errors in refetch functions gracefully', () => {
    const refetchError = vi.fn(() => { throw new Error('Refetch failed'); });
    const refetchSuccess = vi.fn();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => {
      const { invalidate } = useCacheInvalidation();

      useQueryCacheRegistration(['nodes'], refetchError);
      useQueryCacheRegistration(['nodes'], refetchSuccess);

      return { invalidate };
    }, { wrapper });

    act(() => {
      result.current.invalidate(['nodes']);
    });

    expect(refetchError).toHaveBeenCalledTimes(1);
    expect(refetchSuccess).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Error during cache invalidation:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

describe('CacheTags utility functions', () => {
  it('should generate correct tags for common patterns', () => {
    expect(CacheTags.allNodes()).toEqual(['nodes']);
    expect(CacheTags.allCards()).toEqual(['notebook_cards']);
    expect(CacheTags.allSearch()).toEqual(['search']);
    expect(CacheTags.allMetadata()).toEqual(['metadata']);
  });

  it('should generate folder-specific node tags', () => {
    expect(CacheTags.nodesByFolder('inbox')).toEqual(['nodes', 'nodes:inbox']);
    expect(CacheTags.nodesByFolder()).toEqual(['nodes']);
  });

  it('should generate specific entity tags', () => {
    expect(CacheTags.specificNode('node123')).toEqual(['nodes', 'node:node123']);
    expect(CacheTags.specificCard('card456')).toEqual(['notebook_cards', 'card:card456']);
  });

  it('should generate mutation invalidation tags', () => {
    expect(CacheTags.nodeCreated('inbox')).toEqual(['nodes', 'search', 'nodes:inbox']);
    expect(CacheTags.nodeCreated()).toEqual(['nodes', 'search']);

    expect(CacheTags.nodeUpdated('node123', 'inbox')).toEqual(['nodes', 'search', 'node:node123', 'nodes:inbox']);
    expect(CacheTags.nodeUpdated('node123')).toEqual(['nodes', 'search', 'node:node123']);

    expect(CacheTags.nodeDeleted('node123', 'inbox')).toEqual(['nodes', 'search', 'node:node123', 'nodes:inbox']);

    expect(CacheTags.cardCreated()).toEqual(['notebook_cards', 'search']);
    expect(CacheTags.cardUpdated('card456')).toEqual(['notebook_cards', 'search', 'card:card456']);
    expect(CacheTags.cardDeleted('card456')).toEqual(['notebook_cards', 'search', 'card:card456']);
  });

  it('should generate search result tags', () => {
    expect(CacheTags.searchResults('test query')).toEqual(['search', 'search:test query']);
    expect(CacheTags.searchResults()).toEqual(['search']);
  });
});