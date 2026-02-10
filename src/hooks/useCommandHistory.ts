import { useState, useCallback, useEffect, useRef } from 'react';

const HISTORY_STORAGE_KEY = 'isometry-command-history';
const MAX_HISTORY_ENTRIES = 1000;
const SAVE_DEBOUNCE_MS = 1000;

export interface UseCommandHistoryResult {
  history: string[];
  currentIndex: number;
  isSearchMode: boolean;
  searchQuery: string;
  searchMatch: string | null;

  addEntry: (command: string) => void;
  navigateUp: () => string | null;
  navigateDown: () => string | null;

  enterSearchMode: () => void;
  exitSearchMode: () => void;
  searchHistory: (query: string) => string | null;
  appendSearchChar: (char: string) => string | null;
  removeSearchChar: () => string | null;

  resetNavigation: () => void;
}

/**
 * Load command history from localStorage
 */
function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry: unknown): entry is string => typeof entry === 'string');
  } catch (error) {
    console.warn('Failed to load command history:', error);
    return [];
  }
}

/**
 * Save command history to localStorage
 */
function saveHistory(entries: string[]): void {
  try {
    // Prune to max entries
    const prunedEntries = entries.slice(-MAX_HISTORY_ENTRIES);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(prunedEntries));
  } catch (error) {
    console.warn('Failed to save command history:', error);
  }
}

/**
 * Remove consecutive duplicate commands
 */
function compressHistory(entries: string[]): string[] {
  if (entries.length === 0) return entries;

  const compressed: string[] = [];
  let lastCommand = '';

  for (const entry of entries) {
    if (entry !== lastCommand) {
      compressed.push(entry);
      lastCommand = entry;
    }
  }

  return compressed;
}

/**
 * Hook for managing command history with up/down navigation and Ctrl+R reverse search
 */
export function useCommandHistory(): UseCommandHistoryResult {
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatch, setSearchMatch] = useState<string | null>(null);

  // Debounce timer for saving
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save history with debounce
  const debouncedSave = useCallback((entries: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveHistory(entries);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Add a new command to history
   */
  const addEntry = useCallback((command: string) => {
    if (!command.trim()) return;

    setHistory(prev => {
      // Don't add if it's the same as the last command
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }

      const newHistory = [...prev, command];
      const compressed = compressHistory(newHistory);
      const pruned = compressed.slice(-MAX_HISTORY_ENTRIES);

      debouncedSave(pruned);
      return pruned;
    });

    // Reset navigation index when adding new command
    setCurrentIndex(-1);
  }, [debouncedSave]);

  /**
   * Navigate up through history (older commands)
   */
  const navigateUp = useCallback((): string | null => {
    if (history.length === 0) return null;

    const newIndex = currentIndex + 1;
    if (newIndex >= history.length) {
      return null; // At the beginning of history
    }

    setCurrentIndex(newIndex);
    return history[history.length - 1 - newIndex];
  }, [history, currentIndex]);

  /**
   * Navigate down through history (newer commands)
   */
  const navigateDown = useCallback((): string | null => {
    if (currentIndex <= -1) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    if (newIndex === -1) {
      return ''; // Return to empty line
    }

    return history[history.length - 1 - newIndex];
  }, [history, currentIndex]);

  /**
   * Reset navigation to initial state
   */
  const resetNavigation = useCallback(() => {
    setCurrentIndex(-1);
  }, []);

  /**
   * Enter reverse search mode (Ctrl+R)
   */
  const enterSearchMode = useCallback(() => {
    setIsSearchMode(true);
    setSearchQuery('');
    setSearchMatch(null);
  }, []);

  /**
   * Exit reverse search mode
   */
  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery('');
    // Keep searchMatch for the command line to use
  }, []);

  /**
   * Search history for commands matching the query
   * Returns the most recent match (fuzzy/substring search)
   */
  const searchHistory = useCallback((query: string): string | null => {
    if (!query.trim()) {
      setSearchMatch(null);
      return null;
    }

    const lowerQuery = query.toLowerCase();

    // Search from most recent to oldest
    for (let i = history.length - 1; i >= 0; i--) {
      const command = history[i];
      if (command.toLowerCase().includes(lowerQuery)) {
        setSearchMatch(command);
        return command;
      }
    }

    setSearchMatch(null);
    return null;
  }, [history]);

  /**
   * Append a character to search query and update match
   */
  const appendSearchChar = useCallback((char: string): string | null => {
    const newQuery = searchQuery + char;
    setSearchQuery(newQuery);
    return searchHistory(newQuery);
  }, [searchQuery, searchHistory]);

  /**
   * Remove last character from search query and update match
   */
  const removeSearchChar = useCallback((): string | null => {
    if (searchQuery.length === 0) return searchMatch;

    const newQuery = searchQuery.slice(0, -1);
    setSearchQuery(newQuery);
    return searchHistory(newQuery);
  }, [searchQuery, searchMatch, searchHistory]);

  return {
    history,
    currentIndex,
    isSearchMode,
    searchQuery,
    searchMatch,

    addEntry,
    navigateUp,
    navigateDown,

    enterSearchMode,
    exitSearchMode,
    searchHistory,
    appendSearchChar,
    removeSearchChar,

    resetNavigation
  };
}
