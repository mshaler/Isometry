/**
 * Claude Code WebSocket Dispatcher
 *
 * Browser-side dispatcher that communicates with the Claude Code server
 * via WebSocket to execute real CLI commands from the GUI.
 */

import {
  ClaudeCodeCommand,
  CommandExecution,
  ClaudeCodeDispatcher,
  ClaudeCodeDispatcherOptions,
  GSDCommands
} from './claudeCodeDispatcher';
import { ServerMessage, ClientMessage, FileChangeEvent } from './claudeCodeServer';

// Re-export GSDCommands for convenience
export { GSDCommands };

/**
 * WebSocket-based Claude Code dispatcher for browser environments
 */
export class WebSocketClaudeCodeDispatcher implements ClaudeCodeDispatcher {
  private ws: WebSocket | null = null;
  private executions = new Map<string, CommandExecution>();
  private options: ClaudeCodeDispatcherOptions;
  private serverUrl: string;
  private connectionPromise: Promise<void> | null = null;
  private messageQueue: ServerMessage[] = [];
  private fileMonitoringCallbacks = new Map<string, (fileChange: FileChangeEvent) => void>(); // sessionId -> callback

  constructor(serverUrl: string = 'ws://localhost:8080', options: ClaudeCodeDispatcherOptions = {}) {
    this.serverUrl = serverUrl;
    this.options = options;
  }

  /**
   * Connect to the Claude Code server
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to Claude Code server');

          // Send any queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
              this.sendMessage(message);
            }
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ClientMessage = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from Claude Code server');
          this.ws = null;
          this.connectionPromise = null;
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('Failed to connect to Claude Code server'));
        };

      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle messages from the server
   */
  private handleServerMessage(message: ClientMessage): void {
    // Handle messages that don't require an execution (file monitoring, etc.)
    if (message.type === 'file_change' || message.type === 'monitoring_started' || message.type === 'monitoring_stopped') {
      this.handleNonExecutionMessage(message);
      return;
    }

    // Handle execution-related messages
    if (!message.executionId) {
      console.warn('Received execution message without executionId:', message.type);
      return;
    }

    const execution = this.executions.get(message.executionId);
    if (!execution) {
      console.warn('Received message for unknown execution:', message.executionId);
      return;
    }

    switch (message.type) {
      case 'execution_started':
        if (message.execution) {
          // Update our local execution with server data
          Object.assign(execution, message.execution);
        }
        break;

      case 'output':
        if (message.data) {
          execution.output.push(message.data);
          this.options.onOutput?.(message.data, execution.id);
        }
        break;

      case 'error':
        execution.status = 'error';
        execution.endTime = new Date();
        execution.error = message.data || 'Unknown error';
        this.options.onError?.(execution.error, execution.id);
        break;

      case 'completed':
        execution.status = 'completed';
        execution.endTime = new Date();
        this.options.onComplete?.(execution.id);
        break;

      case 'cancelled':
        execution.status = 'cancelled';
        execution.endTime = new Date();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle non-execution messages (file monitoring, etc.)
   */
  private handleNonExecutionMessage(message: ClientMessage): void {
    switch (message.type) {
      case 'file_change':
        if (message.fileChange && message.sessionId) {
          const callback = this.fileMonitoringCallbacks.get(message.sessionId);
          if (callback) {
            callback(message.fileChange);
          }
        }
        break;

      case 'monitoring_started':
        console.log(`📁 File monitoring started for session ${message.sessionId}`);
        break;

      case 'monitoring_stopped':
        console.log(`🛑 File monitoring stopped for session ${message.sessionId}`);
        break;

      default:
        console.warn('Unknown non-execution message type:', message.type);
    }
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: ServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
    }
  }

  /**
   * Execute a Claude Code command and wait for completion
   */
  async execute(command: ClaudeCodeCommand): Promise<string> {
    const execution = await this.executeAsync(command);

    // Wait for completion
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const current = this.executions.get(execution.id);
        if (!current) {
          reject(new Error('Execution not found'));
          return;
        }

        if (current.status === 'completed') {
          resolve(current.output.join('\n'));
        } else if (current.status === 'error') {
          reject(new Error(current.error || 'Command execution failed'));
        } else if (current.status === 'cancelled') {
          reject(new Error('Command execution was cancelled'));
        } else {
          // Still running, check again
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  /**
   * Execute a Claude Code command asynchronously
   */
  async executeAsync(command: ClaudeCodeCommand): Promise<CommandExecution> {
    // Ensure we're connected
    await this.connect();

    const executionId = this.generateExecutionId();

    const execution: CommandExecution = {
      id: executionId,
      command,
      status: 'pending',
      startTime: new Date(),
      output: []
    };

    this.executions.set(executionId, execution);

    // Send command to server
    const message: ServerMessage = {
      type: 'command',
      executionId,
      command
    };

    this.sendMessage(message);

    return execution;
  }

  /**
   * Cancel a running command execution
   */
  async cancel(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.status === 'running' || execution.status === 'pending') {
      // Send cancel message to server
      const message: ServerMessage = {
        type: 'cancel',
        executionId
      };

      this.sendMessage(message);
      return true;
    }

    return false;
  }

  /**
   * Send input to a running process
   */
  async sendInput(executionId: string, input: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status === 'running') {
      const message: ServerMessage = {
        type: 'input',
        executionId,
        input
      };

      this.sendMessage(message);
    }
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): CommandExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): CommandExecution[] {
    return Array.from(this.executions.values()).filter(
      exec => exec.status === 'pending' || exec.status === 'running'
    );
  }

  /**
   * Start file monitoring for a GSD session
   */
  async startFileMonitoring(
    sessionId: string,
    projectPath: string,
    onFileChange: (fileChange: FileChangeEvent) => void
  ): Promise<void> {
    // Ensure we're connected
    await this.connect();

    // Store the callback
    this.fileMonitoringCallbacks.set(sessionId, onFileChange);

    // Send monitoring request
    const message: ServerMessage = {
      type: 'start_file_monitoring',
      sessionId,
      projectPath
    };

    this.sendMessage(message);
  }

  /**
   * Stop file monitoring for a session
   */
  async stopFileMonitoring(sessionId: string): Promise<void> {
    // Remove callback
    this.fileMonitoringCallbacks.delete(sessionId);

    // Send stop monitoring request if connected
    if (this.isConnected()) {
      const message: ServerMessage = {
        type: 'stop_file_monitoring',
        sessionId
      };

      this.sendMessage(message);
    }
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a WebSocket dispatcher with server detection
 */
export async function createClaudeCodeDispatcher(
  options: ClaudeCodeDispatcherOptions = {}
): Promise<ClaudeCodeDispatcher> {
  // Try to connect to WebSocket server first
  const wsDispatcher = new WebSocketClaudeCodeDispatcher('ws://localhost:8080', options);

  try {
    // Try connecting with a short timeout
    await Promise.race([
      wsDispatcher.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 2000)
      )
    ]);

    console.log('✅ Connected to Claude Code server - real CLI execution available');
    return wsDispatcher;

  } catch (error) {
    console.log('⚠️ Claude Code server not available - falling back to simulation');
    wsDispatcher.disconnect();

    // Fall back to the default dispatcher (simulation)
    const { DefaultClaudeCodeDispatcher } = await import('./claudeCodeDispatcher');
    return new DefaultClaudeCodeDispatcher(options);
  }
}

/**
 * Singleton dispatcher instance with server detection
 */
let _claudeCodeDispatcher: ClaudeCodeDispatcher | null = null;
let _dispatcherInitialization: Promise<ClaudeCodeDispatcher> | null = null;

/**
 * Get the singleton Claude Code dispatcher instance
 */
export async function getClaudeCodeDispatcher(): Promise<ClaudeCodeDispatcher> {
  if (_claudeCodeDispatcher) {
    return _claudeCodeDispatcher;
  }

  if (_dispatcherInitialization) {
    return _dispatcherInitialization;
  }

  _dispatcherInitialization = createClaudeCodeDispatcher().then(dispatcher => {
    _claudeCodeDispatcher = dispatcher;
    return dispatcher;
  }).catch(error => {
    console.error('Failed to initialize Claude Code dispatcher:', error);
    _dispatcherInitialization = null;
    throw error;
  });

  return _dispatcherInitialization;
}

/**
 * Reset the singleton (for testing purposes)
 */
export function resetClaudeCodeDispatcher(): void {
  if (_claudeCodeDispatcher) {
    if ('disconnect' in _claudeCodeDispatcher) {
      (_claudeCodeDispatcher as any).disconnect();
    }
    _claudeCodeDispatcher = null;
  }
  _dispatcherInitialization = null;
}