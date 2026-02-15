/**
 * Claude Code Server
 *
 * Node.js server that handles Claude Code CLI execution and provides a WebSocket API
 * for the browser-based GSD interface to communicate with the real Claude Code CLI.
 */

import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { watch, FSWatcher } from 'fs';
import { stat } from 'fs/promises';
import { join, relative } from 'path';
import { ClaudeCodeCommand, CommandExecution } from './claudeCodeDispatcher';
import { devLogger } from '../../utils/logging';
import { TerminalPTYServer } from '../terminal/terminalPTYServer';
import {
  isTerminalMessage,
  isCommandMessage,
  isFileMonitoringMessage,
  isPingMessage,
  isGSDFileMessage,
} from '../terminal/messageRouter';
import type { TerminalClientMessage } from '../terminal/terminalTypes';
import { GSDFileSyncService, type GSDSyncMessage } from '../gsd';

export interface ServerMessage {
  type: 'command' | 'cancel' | 'input' | 'start_file_monitoring' | 'stop_file_monitoring';
  executionId?: string;
  command?: ClaudeCodeCommand;
  input?: string;
  projectPath?: string;
  sessionId?: string;
}

export interface FileChangeEvent {
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  timestamp: string;
  sessionId?: string;
}

export interface ClientMessage {
  type: 'execution_started' | 'output' | 'error' | 'completed' | 'cancelled' | 'file_change' | 'monitoring_started' | 'monitoring_stopped';
  executionId?: string;
  sessionId?: string;
  data?: string;
  execution?: CommandExecution;
  fileChange?: FileChangeEvent;
}

/**
 * Claude Code server that spawns real CLI processes
 */
export class ClaudeCodeServer {
  private wss: WebSocketServer;
  private executions = new Map<string, CommandExecution & { process?: ChildProcess }>();
  private fileWatchers = new Map<string, FSWatcher>(); // sessionId -> watcher
  private monitoredPaths = new Map<string, { path: string; sessionId: string }>(); // sessionId -> monitoring info
  private port: number;
  private terminalServer: TerminalPTYServer;
  private gsdSyncService: GSDFileSyncService;

  constructor(port: number = 8080) {
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.terminalServer = new TerminalPTYServer();
    this.gsdSyncService = new GSDFileSyncService(process.cwd());
    this.setupWebSocketHandlers();
  }

  /**
   * Set up WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws) => {
      devLogger.debug('GSD client connected', { component: 'ClaudeCodeServer' });

      ws.on('message', async (data) => {
        try {
          const message: ServerMessage = JSON.parse(data.toString());
          devLogger.debug('Received message', { component: 'ClaudeCodeServer', messageType: message.type, executionId: message.executionId || 'none' });
          await this.handleMessage(ws, message);
        } catch (error) {
          devLogger.error('Error handling message', { component: 'ClaudeCodeServer', error });
          ws.send(JSON.stringify({
            type: 'error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });

      ws.on('close', () => {
        devLogger.debug('GSD client disconnected', { component: 'ClaudeCodeServer' });
        this.terminalServer.removeClient(ws);
      });

      ws.on('error', (error) => {
        devLogger.error('WebSocket error', { component: 'ClaudeCodeServer', error });
      });
    });

    devLogger.debug('Claude Code server listening', { component: 'ClaudeCodeServer', port: this.port });
  }

  /**
   * Handle incoming WebSocket messages
   * Routes messages to appropriate handler based on message type
   */
  private async handleMessage(ws: WebSocket, message: unknown): Promise<void> {
    devLogger.debug('Processing message', {
      component: 'ClaudeCodeServer',
      type: (message as Record<string, unknown>)?.type || 'unknown'
    });

    // Handle ping (heartbeat) first
    if (isPingMessage(message)) {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    // Route terminal messages to PTY server
    if (isTerminalMessage(message)) {
      await this.terminalServer.handleMessage(ws, message as TerminalClientMessage);
      return;
    }

    // Route file monitoring messages
    if (isFileMonitoringMessage(message)) {
      const msg = message as ServerMessage;
      if (msg.type === 'start_file_monitoring' && msg.projectPath && msg.sessionId) {
        await this.startFileMonitoring(ws, msg.sessionId, msg.projectPath);
      } else if (msg.type === 'stop_file_monitoring' && msg.sessionId) {
        await this.stopFileMonitoring(ws, msg.sessionId);
      }
      return;
    }

    // Route GSD file sync messages
    if (isGSDFileMessage(message)) {
      await this.gsdSyncService.handleMessage(ws, message as GSDSyncMessage);
      return;
    }

    // Route command messages (existing behavior)
    if (isCommandMessage(message)) {
      const msg = message as ServerMessage;
      switch (msg.type) {
        case 'command':
          if (msg.command) {
            devLogger.debug('Executing command', {
              component: 'ClaudeCodeServer',
              command: msg.command.command,
              args: msg.command.args
            });
            await this.executeCommand(ws, msg.command);
          }
          break;
        case 'cancel':
          if (msg.executionId) {
            await this.cancelExecution(ws, msg.executionId);
          }
          break;
        case 'input':
          if (msg.executionId && msg.input) {
            await this.sendInput(ws, msg.executionId, msg.input);
          }
          break;
      }
      return;
    }

    // Unknown message type
    ws.send(JSON.stringify({
      type: 'error',
      data: `Unknown message type: ${(message as Record<string, unknown>)?.type}`
    }));
  }

  /**
   * Execute a Claude Code command
   */
  private async executeCommand(ws: WebSocket, command: ClaudeCodeCommand): Promise<void> {
    const executionId = this.generateExecutionId();

    const execution: CommandExecution & { process?: ChildProcess } = {
      id: executionId,
      command,
      status: 'pending',
      startTime: new Date(),
      output: []
    };

    this.executions.set(executionId, execution);

    // Notify client that execution started
    ws.send(JSON.stringify({
      type: 'execution_started',
      executionId,
      execution: {
        id: execution.id,
        command: execution.command,
        status: execution.status,
        startTime: execution.startTime,
        output: execution.output
      }
    } as ClientMessage));

    try {
      await this.spawnClaudeProcess(ws, execution);
    } catch (error) {
      execution.status = 'error';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.endTime = new Date();

      ws.send(JSON.stringify({
        type: 'error',
        executionId,
        data: execution.error
      } as ClientMessage));
    }
  }

  /**
   * Spawn the actual process (Claude Code or other commands)
   */
  private async spawnClaudeProcess(
    ws: WebSocket,
    execution: CommandExecution & { process?: ChildProcess }
  ): Promise<void> {
    const { command, args = [], input, workingDirectory } = execution.command;

    // Prepare command execution
    const executablePath: string = process.env.SHELL || '/bin/zsh';
    let spawnArgs: string[] = [];

    // Use the user's shell for all commands to get aliases, history, etc.
    spawnArgs = ['-c', `${command} ${args.join(' ')}`];

    execution.status = 'running';

    devLogger.debug('Spawning process', { component: 'ClaudeCodeServer', executablePath, spawnArgs });

    // Spawn the process using the user's shell to get aliases, history, etc.
    const child = spawn(executablePath, spawnArgs, {
      cwd: workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure we get an interactive shell with all user settings
        TERM: 'xterm-256color',
        CLAUDE_CODE_INTERACTIVE: 'true'
      }
    });

    devLogger.debug('Child process spawned', { component: 'ClaudeCodeServer', pid: child.pid });

    execution.process = child;

    // Handle stdout
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      devLogger.debug('Process STDOUT', { component: 'ClaudeCodeServer', output: output.trim() });
      execution.output.push(output);

      ws.send(JSON.stringify({
        type: 'output',
        executionId: execution.id,
        data: output
      } as ClientMessage));
    });

    // Handle stderr
    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      devLogger.debug('Process STDERR', { component: 'ClaudeCodeServer', output: output.trim() });
      execution.output.push(`STDERR: ${output}`);

      ws.send(JSON.stringify({
        type: 'output',
        executionId: execution.id,
        data: `STDERR: ${output}`
      } as ClientMessage));
    });

    // Send input if provided
    if (input && child.stdin) {
      devLogger.debug('Sending input to process', { component: 'ClaudeCodeServer', input });
      child.stdin.write(input + '\n');
    }

    // Handle process completion
    child.on('close', (code) => {
      devLogger.debug('Process closed', { component: 'ClaudeCodeServer', exitCode: code });
      execution.status = code === 0 ? 'completed' : 'error';
      execution.endTime = new Date();

      if (code !== 0) {
        execution.error = `Process exited with code ${code}`;
      }

      ws.send(JSON.stringify({
        type: execution.status,
        executionId: execution.id,
        data: execution.error
      } as ClientMessage));

      // Clean up
      this.executions.delete(execution.id);
    });

    // Handle process errors
    child.on('error', (error) => {
      devLogger.error('Process error', { component: 'ClaudeCodeServer', error: error.message });
      execution.status = 'error';
      execution.error = error.message;
      execution.endTime = new Date();

      ws.send(JSON.stringify({
        type: 'error',
        executionId: execution.id,
        data: error.message
      } as ClientMessage));

      // Clean up
      this.executions.delete(execution.id);
    });

    // Handle timeout
    if (execution.command.timeout) {
      setTimeout(() => {
        if (execution.status === 'running' && child.pid) {
          child.kill('SIGTERM');
          execution.status = 'error';
          execution.error = `Command timed out after ${execution.command.timeout}ms`;

          ws.send(JSON.stringify({
            type: 'error',
            executionId: execution.id,
            data: execution.error
          } as ClientMessage));
        }
      }, execution.command.timeout);
    }
  }

  /**
   * Cancel a running execution
   */
  private async cancelExecution(ws: WebSocket, executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);

    if (!execution) {
      ws.send(JSON.stringify({
        type: 'error',
        executionId,
        data: 'Execution not found'
      } as ClientMessage));
      return;
    }

    if (execution.status === 'running' && execution.process) {
      try {
        execution.process.kill('SIGTERM');
        execution.status = 'cancelled';
        execution.endTime = new Date();

        ws.send(JSON.stringify({
          type: 'cancelled',
          executionId
        } as ClientMessage));

        this.executions.delete(executionId);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          executionId,
          data: error instanceof Error ? error.message : 'Failed to cancel execution'
        } as ClientMessage));
      }
    }
  }

  /**
   * Send input to a running process
   */
  private async sendInput(ws: WebSocket, executionId: string, input: string): Promise<void> {
    const execution = this.executions.get(executionId);

    if (!execution) {
      ws.send(JSON.stringify({
        type: 'error',
        executionId,
        data: 'Execution not found'
      } as ClientMessage));
      return;
    }

    if (execution.status === 'running' && execution.process?.stdin) {
      try {
        execution.process.stdin.write(input + '\n');
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          executionId,
          data: error instanceof Error ? error.message : 'Failed to send input'
        } as ClientMessage));
      }
    }
  }

  // TODO: Implement Claude Code executable finding when needed
  /*
  private async findClaudeCodeExecutable(): Promise<string> {
    const { execSync } = await import('child_process');

    // Common paths where Claude Code might be installed
    const possiblePaths = [
      'claude',
      'claude-code',
      '/usr/local/bin/claude',
      '/usr/local/bin/claude-code',
      '/opt/homebrew/bin/claude',
      '/opt/homebrew/bin/claude-code',
      // Happy Engineering paths
      'happy-claude',
      '/usr/local/bin/happy-claude'
    ];

    // Try to find the executable
    for (const path of possiblePaths) {
      try {
        execSync(`which ${path}`, { stdio: 'ignore' });
        devLogger.debug('Found Claude Code executable', { component: 'ClaudeCodeServer', path });
        return path;
      } catch (error) {
        // Continue trying
      }
    }

    // Default to 'claude' and let the system PATH handle it
    devLogger.debug('Using default Claude Code command', { component: 'ClaudeCodeServer', command: 'claude' });
    return 'claude';
  }
  */

  /**
   * Start file monitoring for a GSD session
   */
  private async startFileMonitoring(ws: WebSocket, sessionId: string, projectPath: string): Promise<void> {
    try {
      // Stop any existing monitoring for this session
      if (this.fileWatchers.has(sessionId)) {
        await this.stopFileMonitoring(ws, sessionId);
      }

      devLogger.debug('Starting file monitoring for session', { component: 'ClaudeCodeServer', sessionId, projectPath });

      // Store monitoring info
      this.monitoredPaths.set(sessionId, { path: projectPath, sessionId });

      // Create file watcher
      const watcher = watch(projectPath, { recursive: true }, async (eventType, filename) => {
        if (filename) {
          const fullPath = join(projectPath, filename);
          const relativePath = relative(projectPath, fullPath);

          // Filter out unwanted files
          if (this.shouldIgnoreFile(relativePath)) {
            return;
          }

          devLogger.inspect('File change detected', { component: 'ClaudeCodeServer', eventType, relativePath, sessionId });

          try {
            let changeType: 'create' | 'modify' | 'delete';

            // Determine change type by checking if file exists
            try {
              await stat(fullPath);
              changeType = eventType === 'rename' ? 'create' : 'modify';
            } catch {
              changeType = 'delete';
            }

            const fileChange: FileChangeEvent = {
              path: relativePath,
              changeType,
              timestamp: new Date().toISOString(),
              sessionId
            };

            // Send file change notification
            ws.send(JSON.stringify({
              type: 'file_change',
              sessionId,
              fileChange
            } as ClientMessage));

          } catch (error) {
            devLogger.error('Error processing file change', { component: 'ClaudeCodeServer', error, relativePath, sessionId });
          }
        }
      });

      this.fileWatchers.set(sessionId, watcher);

      // Notify client that monitoring started
      ws.send(JSON.stringify({
        type: 'monitoring_started',
        sessionId,
        data: projectPath
      } as ClientMessage));

    } catch (error) {
      devLogger.error('Failed to start file monitoring', { component: 'ClaudeCodeServer', error, sessionId });
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        data: error instanceof Error ? error.message : 'Failed to start file monitoring'
      } as ClientMessage));
    }
  }

  /**
   * Stop file monitoring for a session
   */
  private async stopFileMonitoring(ws: WebSocket, sessionId: string): Promise<void> {
    try {
      const watcher = this.fileWatchers.get(sessionId);
      if (watcher) {
        watcher.close();
        this.fileWatchers.delete(sessionId);
        devLogger.debug('Stopped file monitoring for session', { component: 'ClaudeCodeServer', sessionId });
      }

      this.monitoredPaths.delete(sessionId);

      // Notify client that monitoring stopped
      ws.send(JSON.stringify({
        type: 'monitoring_stopped',
        sessionId
      } as ClientMessage));

    } catch (error) {
      devLogger.error('Failed to stop file monitoring', { component: 'ClaudeCodeServer', error, sessionId });
      ws.send(JSON.stringify({
        type: 'error',
        sessionId,
        data: error instanceof Error ? error.message : 'Failed to stop file monitoring'
      } as ClientMessage));
    }
  }

  /**
   * Check if a file should be ignored for monitoring
   */
  private shouldIgnoreFile(relativePath: string): boolean {
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /\.vscode/,
      /\.idea/,
      /dist/,
      /build/,
      /coverage/,
      /\.nyc_output/,
      /\.temp/,
      /\.tmp/,
      /\.cache/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.log$/,
      /\.lock$/,
      /\.swp$/,
      /\.swo$/,
      /~$/
    ];

    return ignoredPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the server
   */
  start(): void {
    devLogger.inspect('Claude Code GSD Server started', { component: 'ClaudeCodeServer', port: this.port });
    devLogger.inspect('Ready to execute Claude Code commands from GSD GUI', { component: 'ClaudeCodeServer' });
  }

  /**
   * Stop the server
   */
  stop(): void {
    // Cancel all running executions
    for (const [, execution] of this.executions) {
      if (execution.status === 'running' && execution.process) {
        execution.process.kill('SIGTERM');
      }
    }

    // Cleanup terminal sessions
    this.terminalServer.cleanup();

    // Cleanup GSD sync service
    this.gsdSyncService.cleanup();

    // Close all file watchers
    for (const [sessionId, watcher] of this.fileWatchers) {
      try {
        watcher.close();
        devLogger.debug('Closed file watcher for session', { component: 'ClaudeCodeServer', sessionId });
      } catch (error) {
        devLogger.error('Error closing file watcher for session', { component: 'ClaudeCodeServer', sessionId, error });
      }
    }
    this.fileWatchers.clear();
    this.monitoredPaths.clear();

    this.wss.close();
    devLogger.debug('Claude Code server stopped', { component: 'ClaudeCodeServer' });
  }
}

// Create and start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ClaudeCodeServer(8080);
  server.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    devLogger.debug('Shutting down Claude Code server...', { component: 'ClaudeCodeServer', signal: 'SIGINT' });
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    devLogger.debug('Shutting down Claude Code server...', { component: 'ClaudeCodeServer', signal: 'SIGTERM' });
    server.stop();
    process.exit(0);
  });
}