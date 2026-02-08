import { useState, useEffect, useCallback, useRef } from 'react';
import type { HistoryEntry } from '../../types/shell';
import {
  saveHistory,
  loadHistory,
  clearHistory as clearStoredHistory,
  searchHistory,
  compressHistory,
  pruneHistory,
  exportHistory
} from '../../utils/commandHistory';
import { MAX_HISTORY_ENTRIES } from '../../types/shell';

interface UseCommandHistoryReturn {
  addHistoryEntry: (entry: HistoryEntry) => void;
  getHistory: () => HistoryEntry[];
  searchHistory: (query: string) => void;
  navigateHistory: (direction: 'up' | 'down') => string | null;
  clearHistory: () => void;
  exportHistory: (format: 'json' | 'text') => string;
  currentHistoryIndex: number;
  searchResults: HistoryEntry[];
  isSearching: boolean;
}

/**
 * Command history management hook with persistence and navigation
 */
export function useCommandHistory(): UseCommandHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [searchResults, setSearchResults] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load history on mount
  useEffect(() => {
    const loadedHistory = loadHistory();
    setEntries(loadedHistory);
    setSearchResults(loadedHistory);
  }, []);

  // Auto-save when history changes
  useEffect(() => {
    if (entries.length > 0) {
      // Debounce saving to prevent excessive writes
      const saveTimeout = setTimeout(() => {
        saveHistory(entries);
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [entries]);

  // Add new entry to history
  const addHistoryEntry = useCallback((entry: HistoryEntry) => {
    setEntries(prevEntries => {
      const updated = [entry, ...prevEntries];

      // Compress consecutive duplicates and prune
      const compressed = compressHistory(updated);
      const pruned = pruneHistory(compressed, MAX_HISTORY_ENTRIES);

      return pruned;
    });

    // Reset navigation index when new command is added
    setCurrentHistoryIndex(-1);

    // Update search results if not actively searching
    if (!isSearching) {
      setSearchResults(prevResults => [entry, ...prevResults]);
    }
  }, [isSearching]);

  // Get current history entries
  const getHistory = useCallback((): HistoryEntry[] => {
    return [...entries];
  }, [entries]);

  // Debounced search function
  const performSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (!query.trim()) {
        setSearchResults(entries);
        setIsSearching(false);
      } else {
        const results = searchHistory(entries, query);
        setSearchResults(results);
        setIsSearching(true);
      }
      searchTimeoutRef.current = null;
    }, 300); // Debounce delay
  }, [entries]);

  // Navigate through command history for arrow key support
  const navigateHistory = useCallback((direction: 'up' | 'down'): string | null => {
    const historyList = searchResults.length > 0 ? searchResults : entries;

    if (historyList.length === 0) {
      return null;
    }

    let newIndex = currentHistoryIndex;

    if (direction === 'up') {
      // Move to previous command (higher index)
      newIndex = Math.min(currentHistoryIndex + 1, historyList.length - 1);
    } else {
      // Move to next command (lower index) or -1 for new command
      newIndex = Math.max(currentHistoryIndex - 1, -1);
    }

    setCurrentHistoryIndex(newIndex);

    // Return command string or null for new command
    if (newIndex === -1) {
      return ''; // Empty command for new input
    }

    return historyList[newIndex].command;
  }, [currentHistoryIndex, searchResults, entries]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setEntries([]);
    setSearchResults([]);
    setCurrentHistoryIndex(-1);
    setIsSearching(false);
    clearStoredHistory();
  }, []);

  // Export history data
  const exportHistoryData = useCallback((format: 'json' | 'text'): string => {
    return exportHistory(entries, format);
  }, [entries]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    addHistoryEntry,
    getHistory,
    searchHistory: performSearch,
    navigateHistory,
    clearHistory,
    exportHistory: exportHistoryData,
    currentHistoryIndex,
    searchResults,
    isSearching
  };
}