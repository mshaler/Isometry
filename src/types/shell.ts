export type CommandType = 'system' | 'claude';

export interface ShellCommand {
  id: string;
  type: CommandType;
  command: string;
  timestamp: Date;
  cwd?: string;
}

export interface CommandResponse {
  id: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  type: CommandType;
}

export interface ClaudeAPIConfig {
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}

export interface HistoryEntry {
  id: string;
  command: string;
  type: CommandType;
  timestamp: Date;
  response?: CommandResponse;
  duration?: number;
  cwd?: string;
  context?: {
    cardId?: string;
    cardTitle?: string;
  };
}

export interface HistoryFilter {
  type?: CommandType;
  dateRange?: { start: Date; end: Date };
  searchQuery?: string;
  success?: boolean;
}

export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
  maxEntries: number;
}

// Constants
export const MAX_HISTORY_ENTRIES = 1000;
export const HISTORY_STORAGE_KEY = 'isometry-shell-history';
export const HISTORY_SEARCH_DEBOUNCE = 300;