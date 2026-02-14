/**
 * Terminal Service - PTY backend infrastructure
 *
 * Provides real shell process execution with node-pty,
 * WebSocket protocol types, output buffering for reconnection,
 * and message routing for WebSocket dispatch.
 */

export { TerminalPTYServer } from './terminalPTYServer';
export type { PTYSessionState } from './terminalPTYServer';
export { OutputBuffer, sanitizeAnsiEscapes } from './outputBuffer';
export * from './terminalTypes';
export {
  isTerminalMessage,
  isCommandMessage,
  isFileMonitoringMessage,
  isPingMessage,
  categorizeMessage,
  type MessageCategory
} from './messageRouter';
