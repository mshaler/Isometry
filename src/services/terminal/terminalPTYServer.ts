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
  TerminalReplayDataMessage
} from './terminalTypes';
import { devLogger } from '../../utils/logging/dev-logger';

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

    // Create session state
    const session: PTYSessionState = {
      id: sessionId,
      mode,
      config: { ...config, shell },
      createdAt: new Date(),
      pty: null,
      outputBuffer: new OutputBuffer(),
      clients: new Set([ws])
    };

    try {
      // Spawn PTY process - args array, not string concatenation
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols: config.cols || 80,
        rows: config.rows || 24,
        cwd: config.cwd || process.cwd(),
        env: {
          ...process.env,
          ...config.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
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

  // Helper methods
  private sendToClient(
    ws: WebSocket,
    message: TerminalSpawnedMessage | TerminalExitMessage | TerminalErrorMessage | TerminalReplayDataMessage
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
