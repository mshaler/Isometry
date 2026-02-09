/**
 * Claude Code Server
 *
 * Node.js server that handles Claude Code CLI execution and provides a WebSocket API
 * for the browser-based GSD interface to communicate with the real Claude Code CLI.
 */

import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer } from 'ws';
import { watch, FSWatcher } from 'fs';
import { stat } from 'fs/promises';
import { join, relative } from 'path';
import { ClaudeCodeCommand, CommandExecution } from './claudeCodeDispatcher';

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

  constructor(port: number = 8080) {
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketHandlers();
  }

  /**
   * Set up WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws) => {
      console.log('GSD client connected');

      ws.on('message', async (data) => {
        try {
          const message: ServerMessage = JSON.parse(data.toString());
          console.log(`📨 Received message: ${message.type}, executionId: ${message.executionId || 'none'}`);
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });

      ws.on('close', () => {
        console.log('GSD client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log(`Claude Code server listening on port ${this.port}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(ws: any, message: ServerMessage): Promise<void> {
    console.log(`🔄 Processing message type: ${message.type}`);
    switch (message.type) {
      case 'command':
        if (message.command) {
          console.log(`🚀 Executing command: ${message.command.command} ${message.command.args?.join(' ') || ''}`);
          await this.executeCommand(ws, message.command);
        } else {
          console.log('❌ No command in message');
        }
        break;

      case 'cancel':
        if (message.executionId) {
          await this.cancelExecution(ws, message.executionId);
        }
        break;

      case 'input':
        if (message.executionId && message.input) {
          await this.sendInput(ws, message.executionId, message.input);
        }
        break;

      case 'start_file_monitoring':
        if (message.projectPath && message.sessionId) {
          await this.startFileMonitoring(ws, message.sessionId, message.projectPath);
        }
        break;

      case 'stop_file_monitoring':
        if (message.sessionId) {
          await this.stopFileMonitoring(ws, message.sessionId);
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: `Unknown message type: ${message.type}`
        }));
    }
  }

  /**
   * Execute a Claude Code command
   */
  private async executeCommand(ws: any, command: ClaudeCodeCommand): Promise<void> {
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
    ws: any,
    execution: CommandExecution & { process?: ChildProcess }
  ): Promise<void> {
    const { command, args = [], input, workingDirectory } = execution.command;

    // Prepare command execution
    let executablePath: string;
    let spawnArgs: string[] = [];

    // Use the user's shell for all commands to get aliases, history, etc.
    executablePath = process.env.SHELL || '/bin/zsh';
    spawnArgs = ['-c', `${command} ${args.join(' ')}`];

    execution.status = 'running';

    console.log(`💻 Spawning: ${executablePath} with args: [${spawnArgs.join(', ')}]`);

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

    console.log(`🔧 Child process spawned with PID: ${child.pid}`);

    execution.process = child;

    // Handle stdout
    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`📤 STDOUT: ${output.trim()}`);
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
      console.log(`📥 STDERR: ${output.trim()}`);
      execution.output.push(`STDERR: ${output}`);

      ws.send(JSON.stringify({
        type: 'output',
        executionId: execution.id,
        data: `STDERR: ${output}`
      } as ClientMessage));
    });

    // Send input if provided
    if (input && child.stdin) {
      console.log(`📝 Sending input: ${input}`);
      child.stdin.write(input + '\n');
    }

    // Handle process completion
    child.on('close', (code) => {
      console.log(`🏁 Process closed with code: ${code}`);
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
      console.log(`❌ Process error: ${error.message}`);
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
  private async cancelExecution(ws: any, executionId: string): Promise<void> {
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
  private async sendInput(ws: any, executionId: string, input: string): Promise<void> {
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
        console.log(`Found Claude Code executable at: ${path}`);
        return path;
      } catch (error) {
        // Continue trying
      }
    }

    // Default to 'claude' and let the system PATH handle it
    console.log('Using default Claude Code command: claude');
    return 'claude';
  }
  */

  /**
   * Start file monitoring for a GSD session
   */
  private async startFileMonitoring(ws: any, sessionId: string, projectPath: string): Promise<void> {
    try {
      // Stop any existing monitoring for this session
      if (this.fileWatchers.has(sessionId)) {
        await this.stopFileMonitoring(ws, sessionId);
      }

      console.log(`🔍 Starting file monitoring for session ${sessionId} at ${projectPath}`);

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

          console.log(`📁 File change detected: ${eventType} ${relativePath}`);

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
            console.error('Error processing file change:', error);
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
      console.error('Failed to start file monitoring:', error);
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
  private async stopFileMonitoring(ws: any, sessionId: string): Promise<void> {
    try {
      const watcher = this.fileWatchers.get(sessionId);
      if (watcher) {
        watcher.close();
        this.fileWatchers.delete(sessionId);
        console.log(`🛑 Stopped file monitoring for session ${sessionId}`);
      }

      this.monitoredPaths.delete(sessionId);

      // Notify client that monitoring stopped
      ws.send(JSON.stringify({
        type: 'monitoring_stopped',
        sessionId
      } as ClientMessage));

    } catch (error) {
      console.error('Failed to stop file monitoring:', error);
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
    console.log(`🚀 Claude Code GSD Server started on port ${this.port}`);
    console.log('Ready to execute Claude Code commands from GSD GUI');
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

    // Close all file watchers
    for (const [sessionId, watcher] of this.fileWatchers) {
      try {
        watcher.close();
        console.log(`🛑 Closed file watcher for session ${sessionId}`);
      } catch (error) {
        console.error(`Error closing file watcher for session ${sessionId}:`, error);
      }
    }
    this.fileWatchers.clear();
    this.monitoredPaths.clear();

    this.wss.close();
    console.log('Claude Code server stopped');
  }
}

// Create and start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ClaudeCodeServer(8080);
  server.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down Claude Code server...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down Claude Code server...');
    server.stop();
    process.exit(0);
  });
}