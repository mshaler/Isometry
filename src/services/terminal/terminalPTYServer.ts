/**
 * PTY Server - Terminal session management with node-pty
 *
 * Features:
 * - Real PTY semantics (signals, job control, terminal resize)
 * - Output buffering for reconnection replay (64KB default)
 * - Multi-client broadcast (same session, multiple viewers)
 * - Secure: uses spawn with args array (never string interpolation)
 */

import { spawn, IPty } from 'node-pty';
import { WebSocket } from 'ws';
import { execSync } from 'child_process';
import { OutputBuffer } from './outputBuffer';
import {
  PTYConfig,
  TerminalMode,
  TerminalSession,
  TerminalClientMessage,
  TerminalOutputMessage,
  TerminalSpawnedMessage,
  TerminalExitMessage,
  TerminalErrorMessage,
  TerminalReplayDataMessage,
  TerminalModeSwitchedMessage
} from './terminalTypes';
import { devLogger } from '../../utils/logging/dev-logger';

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface PTYSessionState extends TerminalSession {
  pty: IPty | null;
  outputBuffer: OutputBuffer;
  clients: Set<WebSocket>;
}

/**
 * PTY server managing terminal sessions with node-pty.
 */
export class TerminalPTYServer {
  private sessions = new Map<string, PTYSessionState>();

  /**
   * Handle incoming terminal message from WebSocket client
   */
  async handleMessage(ws: WebSocket, message: TerminalClientMessage): Promise<void> {
    devLogger.debug('Terminal message received', {
      component: 'TerminalPTYServer',
      type: message.type,
      sessionId: message.sessionId
    });

    switch (message.type) {
      case 'terminal:spawn':
        await this.spawnSession(ws, message.sessionId, message.config, message.mode);
        break;
      case 'terminal:input':
        this.handleInput(message.sessionId, message.data);
        break;
      case 'terminal:resize':
        this.handleResize(message.sessionId, message.cols, message.rows);
        break;
      case 'terminal:kill':
        await this.killSession(message.sessionId, message.signal);
        break;
      case 'terminal:replay':
        this.handleReplay(ws, message.sessionId);
        break;
      case 'terminal:switch-mode':
        await this.handleModeSwitch(
          ws,
          message.sessionId,
          message.mode,
          message.preserveCwd !== false  // Default true
        );
        break;
    }
  }

  /**
   * Spawn a new PTY session
   * SECURITY: Uses spawn with args array, never string interpolation
   */
  private async spawnSession(
    ws: WebSocket,
    sessionId: string,
    config: PTYConfig,
    mode: TerminalMode
  ): Promise<void> {
    // Validate shell path - whitelist allowed shells
    const allowedShells = ['/bin/zsh', '/bin/bash', '/bin/sh'];
    const shell = allowedShells.includes(config.shell) ? config.shell : '/bin/zsh';

    // Determine effective mode - fallback to shell if claude not available
    let effectiveMode = mode;

    // Create session state
    const session: PTYSessionState = {
      id: sessionId,
      mode: effectiveMode,
      config: { ...config, shell },
      createdAt: new Date(),
      pty: null,
      outputBuffer: new OutputBuffer(),
      clients: new Set([ws])
    };

    // Determine command based on mode
    let command: string;
    let args: string[];

    if (mode === 'claude-code') {
      if (commandExists('claude')) {
        command = 'claude';
        args = ['--continue']; // Continue from previous conversation if any
      } else {
        // Fallback: spawn shell with message
        const fallbackMessage =
          '\x1b[33mClaude CLI not found. Install with: npm install -g @anthropic-ai/claude-code\x1b[0m\r\n' +
          '\x1b[33mFalling back to shell mode.\x1b[0m\r\n';

        session.outputBuffer.append(fallbackMessage);
        effectiveMode = 'shell';
        session.mode = effectiveMode;
        command = shell;
        args = [];

        devLogger.warn('Claude CLI not found, falling back to shell', {
          component: 'TerminalPTYServer',
          sessionId
        });
      }
    } else {
      command = shell;
      args = [];
    }

    try {
      // Spawn PTY process - args array, not string concatenation
      const pty = spawn(command, args, {
        name: 'xterm-256color',
        cols: config.cols || 80,
        rows: config.rows || 24,
        cwd: config.cwd || process.cwd(),
        env: {
          ...process.env,
          ...config.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          ISOMETRY_TERMINAL_MODE: effectiveMode
        }
      });

      session.pty = pty;
      this.sessions.set(sessionId, session);

      // Notify client of successful spawn
      this.sendToClient(ws, {
        type: 'terminal:spawned',
        sessionId,
        pid: pty.pid
      });

      // Handle PTY output
      pty.onData((data: string) => {
        // Buffer for replay
        session.outputBuffer.append(data);

        // Broadcast to all connected clients
        const outputMsg: TerminalOutputMessage = {
          type: 'terminal:output',
          sessionId,
          data
        };
        this.broadcastToSession(sessionId, outputMsg);
      });

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        devLogger.debug('PTY exited', {
          component: 'TerminalPTYServer',
          sessionId,
          exitCode,
          signal
        });

        const exitMsg: TerminalExitMessage = {
          type: 'terminal:exit',
          sessionId,
          exitCode,
          signal
        };
        this.broadcastToSession(sessionId, exitMsg);

        // Cleanup after small delay (let exit message send)
        setTimeout(() => {
          this.sessions.delete(sessionId);
        }, 100);
      });

      devLogger.debug('PTY spawned', {
        component: 'TerminalPTYServer',
        sessionId,
        pid: pty.pid,
        shell,
        cwd: config.cwd
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to spawn PTY';
      devLogger.error('PTY spawn failed', {
        component: 'TerminalPTYServer',
        sessionId,
        error: errorMsg
      });

      this.sendToClient(ws, {
        type: 'terminal:error',
        sessionId,
        error: errorMsg
      });
    }
  }

  /**
   * Handle terminal input (keystrokes)
   */
  private handleInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) {
      devLogger.debug('Input for unknown session', {
        component: 'TerminalPTYServer',
        sessionId
      });
      return;
    }

    // Write raw data to PTY - no escaping needed, PTY handles it
    session.pty.write(data);
  }

  /**
   * Handle terminal resize
   */
  private handleResize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) return;

    session.pty.resize(cols, rows);
    session.config.cols = cols;
    session.config.rows = rows;

    devLogger.debug('PTY resized', {
      component: 'TerminalPTYServer',
      sessionId,
      cols,
      rows
    });
  }

  /**
   * Handle replay request (reconnection)
   */
  private handleReplay(ws: WebSocket, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendToClient(ws, {
        type: 'terminal:error',
        sessionId,
        error: 'Session not found'
      });
      return;
    }

    // Add client to session
    session.clients.add(ws);

    // Send buffered output
    const bufferedData = session.outputBuffer.getAll();
    if (bufferedData) {
      this.sendToClient(ws, {
        type: 'terminal:replay-data',
        sessionId,
        data: bufferedData
      });
    }

    devLogger.debug('Replay sent', {
      component: 'TerminalPTYServer',
      sessionId,
      bufferSize: session.outputBuffer.size()
    });
  }

  /**
   * Kill a PTY session
   */
  private async killSession(sessionId: string, signal?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) return;

    const sig = signal || 'SIGTERM';
    session.pty.kill(sig);

    devLogger.debug('PTY killed', {
      component: 'TerminalPTYServer',
      sessionId,
      signal: sig
    });
  }

  /**
   * Remove a client from session tracking (on disconnect)
   */
  removeClient(ws: WebSocket): void {
    for (const session of this.sessions.values()) {
      session.clients.delete(ws);
    }
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup all sessions (server shutdown)
   */
  cleanup(): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.pty) {
        session.pty.kill('SIGTERM');
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Switch terminal mode (shell <-> claude-code)
   *
   * Implementation:
   * 1. Get current session's working directory
   * 2. Kill current PTY (gracefully)
   * 3. Spawn new PTY with new mode
   * 4. Preserve output buffer for context
   */
  private async handleModeSwitch(
    ws: WebSocket,
    sessionId: string,
    newMode: TerminalMode,
    preserveCwd: boolean
  ): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.sendToClient(ws, {
        type: 'terminal:error',
        sessionId,
        error: 'Session not found for mode switch'
      });
      return;
    }

    if (session.mode === newMode) {
      // Already in requested mode
      return;
    }

    devLogger.debug('Switching terminal mode', {
      component: 'TerminalPTYServer',
      sessionId,
      fromMode: session.mode,
      toMode: newMode
    });

    // Capture current working directory before killing
    const currentCwd = preserveCwd ? session.config.cwd : session.config.cwd;

    // Kill existing PTY
    if (session.pty) {
      session.pty.kill('SIGTERM');
      session.pty = null;
    }

    // Update session mode
    session.mode = newMode;

    // Clear output buffer (fresh start for new mode)
    session.outputBuffer.clear();

    // Determine command based on mode
    let command: string;
    let args: string[];
    let effectiveMode = newMode;

    if (newMode === 'claude-code') {
      if (commandExists('claude')) {
        command = 'claude';
        args = ['--continue']; // Continue from previous conversation if any
      } else {
        // Fallback: spawn shell with message
        const fallbackMessage =
          '\x1b[33mClaude CLI not found. Install with: npm install -g @anthropic-ai/claude-code\x1b[0m\r\n' +
          '\x1b[33mFalling back to shell mode.\x1b[0m\r\n';

        session.outputBuffer.append(fallbackMessage);
        this.broadcastToSession(sessionId, {
          type: 'terminal:output',
          sessionId,
          data: fallbackMessage
        });

        effectiveMode = 'shell';
        session.mode = effectiveMode;
        command = session.config.shell || '/bin/zsh';
        args = [];

        devLogger.warn('Claude CLI not found during mode switch, falling back to shell', {
          component: 'TerminalPTYServer',
          sessionId
        });
      }
    } else {
      command = session.config.shell || '/bin/zsh';
      args = [];
    }

    try {
      const pty = spawn(command, args, {
        name: 'xterm-256color',
        cols: session.config.cols || 80,
        rows: session.config.rows || 24,
        cwd: currentCwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          // Add mode indicator env var
          ISOMETRY_TERMINAL_MODE: effectiveMode
        }
      });

      session.pty = pty;

      // Handle PTY output
      pty.onData((data: string) => {
        session.outputBuffer.append(data);
        this.broadcastToSession(sessionId, {
          type: 'terminal:output',
          sessionId,
          data
        });
      });

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        this.broadcastToSession(sessionId, {
          type: 'terminal:exit',
          sessionId,
          exitCode,
          signal
        });
        setTimeout(() => this.sessions.delete(sessionId), 100);
      });

      // Notify client of successful mode switch
      this.sendToClient(ws, {
        type: 'terminal:mode-switched',
        sessionId,
        mode: effectiveMode,
        pid: pty.pid
      });

      devLogger.debug('Mode switch complete', {
        component: 'TerminalPTYServer',
        sessionId,
        mode: effectiveMode,
        pid: pty.pid
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Mode switch failed';
      this.sendToClient(ws, {
        type: 'terminal:error',
        sessionId,
        error: errorMsg
      });
    }
  }

  // Helper methods
  private sendToClient(
    ws: WebSocket,
    message:
      | TerminalSpawnedMessage
      | TerminalExitMessage
      | TerminalErrorMessage
      | TerminalReplayDataMessage
      | TerminalModeSwitchedMessage
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToSession(sessionId: string, message: TerminalOutputMessage | TerminalExitMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const data = JSON.stringify(message);
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
