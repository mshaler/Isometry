import type { HistoryEntry, HistoryFilter } from '../types/shell';
import { HISTORY_STORAGE_KEY, MAX_HISTORY_ENTRIES } from '../types/shell';

/**
 * Save history to localStorage with compression
 */
export function saveHistory(entries: HistoryEntry[]): void {
  try {
    // Prune history before saving
    const prunedEntries = pruneHistory(entries, MAX_HISTORY_ENTRIES);

    // Convert to storage format (serialize dates)
    const storageEntries = prunedEntries.map(entry => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
      response: entry.response ? {
        ...entry.response,
        // Don't store large outputs in localStorage
        output: entry.response.output.length > 1000
          ? entry.response.output.substring(0, 1000) + '...[truncated]'
          : entry.response.output
      } : undefined
    }));

    const compressed = JSON.stringify(storageEntries);
    localStorage.setItem(HISTORY_STORAGE_KEY, compressed);
  } catch (error) {
    console.warn('Failed to save command history:', error);
  }
}

/**
 * Load and validate history from localStorage
 */
export function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Convert back from storage format (parse dates)
    const entries = parsed.map((entry: unknown) => ({
      ...entry,
      timestamp: new Date(entry.timestamp)
    } as HistoryEntry)).filter((entry: HistoryEntry) =>
      // Validate entry structure
      entry.id &&
      entry.command !== undefined &&
      entry.type &&
      entry.timestamp instanceof Date &&
      !isNaN(entry.timestamp.getTime())
    );

    return entries;
  } catch (error) {
    console.warn('Failed to load command history:', error);
    return [];
  }
}

/**
 * Clear stored history data
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear command history:', error);
  }
}

/**
 * Handle version migrations for stored data
 */
export function migrateHistoryFormat(): void {
  try {
    const history = loadHistory();
    if (history.length > 0) {
      // If we successfully loaded history, save it back to ensure format consistency
      saveHistory(history);
    }
  } catch (error) {
    console.warn('Failed to migrate history format:', error);
    // If migration fails, clear corrupted data
    clearHistory();
  }
}

/**
 * Fuzzy search implementation for command history
 */
export function searchHistory(entries: HistoryEntry[], query: string): HistoryEntry[] {
  if (!query.trim()) {
    return entries;
  }

  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

  return entries.filter(entry => {
    const searchText = [
      entry.command.toLowerCase(),
      entry.type.toLowerCase(),
      entry.context?.cardTitle?.toLowerCase() || '',
      entry.response?.output?.toLowerCase() || ''
    ].join(' ');

    // All search terms must be found somewhere in the entry
    return searchTerms.every(term => searchText.includes(term));
  });
}

/**
 * Apply filters to history entries
 */
export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  let filtered = entries;

  // Filter by type
  if (filter.type) {
    filtered = filtered.filter(entry => entry.type === filter.type);
  }

  // Filter by date range
  if (filter.dateRange) {
    filtered = filtered.filter(entry =>
      entry.timestamp >= filter.dateRange!.start &&
      entry.timestamp <= filter.dateRange!.end
    );
  }

  // Filter by search query
  if (filter.searchQuery) {
    filtered = searchHistory(filtered, filter.searchQuery);
  }

  // Filter by success status
  if (filter.success !== undefined) {
    filtered = filtered.filter(entry => entry.response?.success === filter.success);
  }

  return filtered;
}

/**
 * Sort history entries
 */
export function sortHistory(
  entries: HistoryEntry[],
  sortBy: 'timestamp' | 'type' | 'duration'
): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    switch (sortBy) {
      case 'timestamp':
        return b.timestamp.getTime() - a.timestamp.getTime(); // Most recent first
      case 'type':
        return a.type.localeCompare(b.type);
      case 'duration': {
        const aDuration = a.duration || 0;
        const bDuration = b.duration || 0;
        return bDuration - aDuration; // Longest first
      }
      default:
        return 0;
    }
  });
}

/**
 * Remove old entries to prevent unlimited growth
 */
export function pruneHistory(entries: HistoryEntry[], maxEntries: number): HistoryEntry[] {
  if (entries.length <= maxEntries) {
    return entries;
  }

  // Sort by timestamp (most recent first) and take the first maxEntries
  const sorted = sortHistory(entries, 'timestamp');
  return sorted.slice(0, maxEntries);
}

/**
 * Remove duplicate consecutive commands
 */
export function compressHistory(entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length === 0) {
    return entries;
  }

  const compressed: HistoryEntry[] = [];
  let lastCommand = '';

  for (const entry of entries) {
    // Skip if it's the same command as the previous one (but keep Claude commands)
    if (entry.command !== lastCommand || entry.type === 'claude') {
      compressed.push(entry);
      lastCommand = entry.command;
    }
  }

  return compressed;
}

/**
 * Export history data
 */
export function exportHistory(
  entries: HistoryEntry[],
  format: 'json' | 'text'
): string {
  if (format === 'json') {
    return JSON.stringify(entries, null, 2);
  }

  // Text format
  let text = '# Isometry Shell Command History\n\n';

  for (const entry of entries) {
    const date = entry.timestamp.toLocaleString();
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    const context = entry.context?.cardTitle ? ` [${entry.context.cardTitle}]` : '';

    text += `## ${date}${duration}${context}\n`;
    text += `**Type:** ${entry.type}\n`;
    text += `**Command:** \`${entry.command}\`\n`;

    if (entry.response?.output) {
      text += `**Output:**\n\`\`\`\n${entry.response.output}\n\`\`\`\n`;
    }

    if (entry.response?.error) {
      text += `**Error:** ${entry.response.error}\n`;
    }

    text += '\n---\n\n';
  }

  return text;
}

/**
 * Get storage size information
 */
export function getHistoryStorageInfo(): {
  entryCount: number;
  storageSize: number;
  maxSize: number;
} {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const storageSize = stored ? new Blob([stored]).size : 0;
    const maxSize = 5 * 1024 * 1024; // 5MB reasonable limit
    const entries = loadHistory();

    return {
      entryCount: entries.length,
      storageSize,
      maxSize
    };
  } catch {
    return {
      entryCount: 0,
      storageSize: 0,
      maxSize: 5 * 1024 * 1024
    };
  }
}