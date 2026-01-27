/**
 * TagColorContext - Manages tag-to-color mappings with localStorage persistence
 *
 * Provides global state for assigning colors to category tags.
 * Colors persist across sessions via localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPaletteColor } from '../utils/tag-colors';

/**
 * Map of tag names to hex color strings
 */
export type TagColorMap = Map<string, string>;

/**
 * Context value shape
 */
interface TagColorContextValue {
  /** Current tag-to-color mappings */
  tagColors: TagColorMap;

  /** Assign a color to a tag */
  setTagColor: (tag: string, _color: string) => void;

  /** Get color for a tag (with auto-assignment if missing) */
  getTagColor: (tag: string) => string;

  /** Remove color assignment for a tag */
  removeTagColor: (tag: string) => void;

  /** Clear all tag color assignments */
  clearAllColors: () => void;
}

const TagColorContext = createContext<TagColorContextValue | undefined>(undefined);

/**
 * localStorage key for persisting tag colors
 */
const STORAGE_KEY = 'isometry:tag-colors';

/**
 * Debounce delay for localStorage writes (ms)
 */
const SAVE_DEBOUNCE_MS = 300;

/**
 * Load tag colors from localStorage
 */
function loadTagColors(): TagColorMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return new Map();
    }

    const parsed = JSON.parse(stored);
    // Convert object to Map
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error('Failed to load tag colors from localStorage:', error);
    return new Map();
  }
}

/**
 * Save tag colors to localStorage (debounced)
 */
function saveTagColors(tagColors: TagColorMap): void {
  try {
    // Convert Map to plain object for JSON serialization
    const obj = Object.fromEntries(tagColors.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Failed to save tag colors to localStorage:', error);
  }
}

/**
 * TagColorProvider - Wraps application to provide tag color state
 */
export function TagColorProvider({ children }: { children: React.ReactNode }) {
  const [tagColors, setTagColors] = useState<TagColorMap>(loadTagColors);
  const [saveTimeout, setSaveTimeout] = useState<number | null>(null);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeout !== null) {
      window.clearTimeout(saveTimeout);
    }

    // Schedule save
    const timeout = window.setTimeout(() => {
      saveTagColors(tagColors);
    }, SAVE_DEBOUNCE_MS);

    setSaveTimeout(timeout);

    // Cleanup on unmount
    return () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [tagColors]);

  /**
   * Assign a color to a tag
   */
  const setTagColor = useCallback((tag: string, color: string) => {
    setTagColors((prev) => {
      const next = new Map(prev);
      next.set(tag, color);
      return next;
    });
  }, []);

  /**
   * Get color for a tag, assigning default if not set
   */
  const getTagColor = useCallback(
    (tag: string): string => {
      const existing = tagColors.get(tag);
      if (existing) {
        return existing;
      }

      // Auto-assign color from palette (round-robin based on tag count)
      const colorIndex = tagColors.size;
      const color = getPaletteColor(colorIndex);

      // Persist assignment
      setTagColor(tag, color);

      return color;
    },
    [tagColors, setTagColor]
  );

  /**
   * Remove color assignment for a tag
   */
  const removeTagColor = useCallback((tag: string) => {
    setTagColors((prev) => {
      const next = new Map(prev);
      next.delete(tag);
      return next;
    });
  }, []);

  /**
   * Clear all tag color assignments
   */
  const clearAllColors = useCallback(() => {
    setTagColors(new Map());
  }, []);

  const value: TagColorContextValue = {
    tagColors,
    setTagColor,
    getTagColor,
    removeTagColor,
    clearAllColors,
  };

  return <TagColorContext.Provider value={value}>{children}</TagColorContext.Provider>;
}

/**
 * Hook to access tag color context
 * Must be used within TagColorProvider
 */
export function useTagColors(): TagColorContextValue {
  const context = useContext(TagColorContext);
  if (!context) {
    throw new Error('useTagColors must be used within TagColorProvider');
  }
  return context;
}
