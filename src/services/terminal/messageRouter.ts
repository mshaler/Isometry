/**
 * Message Router - Type guards and routing logic for WebSocket messages
 *
 * Discriminates between terminal, command, file-monitoring, and ping messages
 * for proper routing in the WebSocket server.
 */

import type { TerminalClientMessage } from './terminalTypes';

/**
 * Message categories for WebSocket routing
 */
export type MessageCategory = 'terminal' | 'command' | 'file-monitoring' | 'unknown';

/**
 * Command message structure (for type guard - matches ServerMessage from claudeCodeServer)
 * Defined here to avoid circular dependency
 */
interface CommandMessage {
  type: 'command' | 'cancel' | 'input';
}

/**
 * Type guard: Is this a terminal message?
 */
export function isTerminalMessage(message: unknown): message is TerminalClientMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;

  if (typeof msg.type !== 'string') return false;

  const terminalTypes = [
    'terminal:spawn',
    'terminal:input',
    'terminal:resize',
    'terminal:kill',
    'terminal:replay'
  ];

  return terminalTypes.includes(msg.type);
}

/**
 * Type guard: Is this a command execution message?
 */
export function isCommandMessage(message: unknown): message is CommandMessage {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;

  return msg.type === 'command' ||
         msg.type === 'cancel' ||
         msg.type === 'input';
}

/**
 * Type guard: Is this a file monitoring message?
 */
export function isFileMonitoringMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;

  return msg.type === 'start_file_monitoring' ||
         msg.type === 'stop_file_monitoring';
}

/**
 * Type guard: Is this a ping message (heartbeat)?
 */
export function isPingMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) return false;
  const msg = message as Record<string, unknown>;
  return msg.type === 'ping';
}

/**
 * Categorize a message for routing
 */
export function categorizeMessage(message: unknown): MessageCategory {
  if (isTerminalMessage(message)) return 'terminal';
  if (isCommandMessage(message)) return 'command';
  if (isFileMonitoringMessage(message)) return 'file-monitoring';
  return 'unknown';
}
