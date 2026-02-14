/**
 * Terminal Service Type Definitions
 *
 * Defines the WebSocket message protocol for PTY communication.
 * Security: Types enforce structured messages - no command string interpolation.
 */

export interface PTYConfig {
  shell: string;           // '/bin/zsh' or '/bin/bash'
  cwd: string;             // Working directory
  cols: number;            // Terminal columns (default: 80)
  rows: number;            // Terminal rows (default: 24)
  env?: Record<string, string>; // Additional env vars
}

export type TerminalMode = 'shell' | 'claude-code';

export interface TerminalSession {
  id: string;
  mode: TerminalMode;
  config: PTYConfig;
  createdAt: Date;
}

// Client -> Server messages
export interface TerminalInputMessage {
  type: 'terminal:input';
  sessionId: string;
  data: string;           // Raw input data (keystrokes)
}

export interface TerminalResizeMessage {
  type: 'terminal:resize';
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalSpawnMessage {
  type: 'terminal:spawn';
  sessionId: string;
  config: PTYConfig;
  mode: TerminalMode;
}

export interface TerminalKillMessage {
  type: 'terminal:kill';
  sessionId: string;
  signal?: string;        // 'SIGTERM', 'SIGKILL', 'SIGINT'
}

export interface TerminalReplayMessage {
  type: 'terminal:replay';
  sessionId: string;
}

export type TerminalClientMessage =
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalSpawnMessage
  | TerminalKillMessage
  | TerminalReplayMessage;

// Server -> Client messages
export interface TerminalOutputMessage {
  type: 'terminal:output';
  sessionId: string;
  data: string;           // PTY output data
}

export interface TerminalSpawnedMessage {
  type: 'terminal:spawned';
  sessionId: string;
  pid: number;
}

export interface TerminalExitMessage {
  type: 'terminal:exit';
  sessionId: string;
  exitCode: number;
  signal?: number;
}

export interface TerminalErrorMessage {
  type: 'terminal:error';
  sessionId: string;
  error: string;
}

export interface TerminalReplayDataMessage {
  type: 'terminal:replay-data';
  sessionId: string;
  data: string;           // Buffered output for replay
}

export type TerminalServerMessage =
  | TerminalOutputMessage
  | TerminalSpawnedMessage
  | TerminalExitMessage
  | TerminalErrorMessage
  | TerminalReplayDataMessage;
