/**
 * Terminal Service - PTY backend infrastructure
 *
 * Provides real shell process execution with node-pty,
 * WebSocket protocol types, and output buffering for reconnection.
 */

export { TerminalPTYServer } from './terminalPTYServer';
export type { PTYSessionState } from './terminalPTYServer';
export { OutputBuffer } from './outputBuffer';
export * from './terminalTypes';
