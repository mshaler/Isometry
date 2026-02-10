/**
 * Re-export from claude-code folder for backwards compatibility
 * This file exists to maintain import paths used by existing code
 */
export {
  WebSocketClaudeCodeDispatcher,
  createClaudeCodeDispatcher,
  getClaudeCodeDispatcher,
  resetClaudeCodeDispatcher,
  GSDCommands
} from './claude-code/claudeCodeWebSocketDispatcher';

export type {
  ConnectionStatus,
  WebSocketDispatcherOptions
} from './claude-code/claudeCodeWebSocketDispatcher';
