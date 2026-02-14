/**
 * Claude Code WebSocket Dispatcher
 *
 * Browser-side dispatcher that communicates with the Claude Code server
 * via WebSocket to execute real CLI commands from the GUI.
 *
 * Features:
 * - Heartbeat mechanism (30s ping, 60s timeout)
 * - Exponential backoff reconnection (1s-30s)
 * - Connection status events
 * - Message queuing during reconnection
 */

import {
  ClaudeCodeCommand,
  CommandExecution,
  ClaudeCodeDispatcher,
  ClaudeCodeDispatcherOptions,
  GSDCommands
} from './claudeCodeDispatcher';
import { ServerMessage, ClientMessage, FileChangeEvent } from './claudeCodeServer';
import { devLogger } from '../../utils/logging';
import { ReconnectionService } from '../../utils/webview/reconnection-service';
import type { ReconnectionConfig } from '../../utils/webview/connection-types';
import { getWebSocketURL } from '../../config/endpoints';

// Re-export GSDCommands for convenience
export { GSDCommands };

/** Connection status for the WebSocket dispatcher */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/** Extended options with status change callback */
export interface WebSocketDispatcherOptions extends ClaudeCodeDispatcherOptions {
  onStatusChange?: (status: ConnectionStatus, attemptNumber?: number) => void;
  // Terminal callbacks
  onTerminalOutput?: (sessionId: string, data: string) => void;
  onTerminalSpawned?: (sessionId: string, pid: number) => void;
  onTerminalExit?: (sessionId: string, exitCode: number, signal?: number) => void;
  onTerminalError?: (sessionId: string, error: string) => void;
  onTerminalReplayData?: (sessionId: string, data: string) => void;
}

/** Default reconnection configuration */
const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  enabled: true,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitterRange: 0.1,
  maxAttempts: 10
};

/** Heartbeat configuration */
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

/**
 * WebSocket-based Claude Code dispatcher for browser environments
 *
 * Production-ready with:
 * - Heartbeat monitoring (30s ping, 60s pong timeout)
 * - Automatic reconnection with exponential backoff
 * - Connection status events
 * - Message queuing during reconnection
 */
export class WebSocketClaudeCodeDispatcher implements ClaudeCodeDispatcher {
  private ws: WebSocket | null = null;
  private executions = new Map<string, CommandExecution>();
  private options: WebSocketDispatcherOptions;
  private serverUrl: string;
  private connectionPromise: Promise<void> | null = null;
  private messageQueue: ServerMessage[] = [];
  private pendingMessages: ServerMessage[] = []; // Messages queued during reconnection
  private fileMonitoringCallbacks = new Map<string, (fileChange: FileChangeEvent) => void>();

  // Connection state management
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectionService: ReconnectionService;

  // Heartbeat tracking
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPongReceived: number = 0;
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    serverUrl: string = getWebSocketURL(),
    options: WebSocketDispatcherOptions = {}
  ) {
    this.serverUrl = serverUrl;
    this.options = options;
    this.reconnectionService = new ReconnectionService(DEFAULT_RECONNECTION_CONFIG);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectAttemptCount(): number {
    return this.reconnectionService.getAttemptCount();
  }

  /**
   * Get max reconnection attempts
   */
  getMaxReconnectAttempts(): number {
    return DEFAULT_RECONNECTION_CONFIG.maxAttempts;
  }

  /**
   * Update connection status and notify listeners
   */
  private setConnectionStatus(status: ConnectionStatus, attemptNumber?: number): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      devLogger.debug('Connection status changed', {
        component: 'WebSocketClaudeCodeDispatcher',
        status,
        attemptNumber
      });
      this.options.onStatusChange?.(status, attemptNumber);
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongReceived = Date.now();

    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Check for pong timeout every 10 seconds
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastPong = Date.now() - this.lastPongReceived;
      if (timeSinceLastPong > HEARTBEAT_TIMEOUT_MS) {
        devLogger.warn('Heartbeat timeout - connection appears dead', {
          component: 'WebSocketClaudeCodeDispatcher',
          timeSinceLastPong
        });
        this.handleConnectionLost();
      }
    }, 10000);

    devLogger.debug('Heartbeat started', { component: 'WebSocketClaudeCodeDispatcher' });
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  /**
   * Send ping message
   */
  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pingMessage: ServerMessage = { type: 'ping' as any };
      this.ws.send(JSON.stringify(pingMessage));
      devLogger.debug('Ping sent', { component: 'WebSocketClaudeCodeDispatcher' });
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    this.lastPongReceived = Date.now();
    devLogger.debug('Pong received', { component: 'WebSocketClaudeCodeDispatcher' });
  }

  /**
   * Handle connection lost (timeout or close)
   */
  private handleConnectionLost(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
    this.attemptReconnection();
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnection(): Promise<void> {
    if (this.connectionStatus === 'reconnecting') {
      return; // Already reconnecting
    }

    this.setConnectionStatus('reconnecting', this.reconnectionService.getAttemptCount() + 1);

    const success = await this.reconnectionService.attemptReconnection(async () => {
      await this.connectInternal();
    });

    if (!success) {
      this.setConnectionStatus('disconnected');
      devLogger.error('All reconnection attempts failed', {
        component: 'WebSocketClaudeCodeDispatcher'
      });
    }
  }

  /**
   * Flush pending messages after reconnection
   */
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
    devLogger.debug('Pending messages flushed', {
      component: 'WebSocketClaudeCodeDispatcher',
      count: this.pendingMessages.length
    });
  }

  /**
   * Connect to the Claude Code server
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.setConnectionStatus('connecting');
    this.connectionPromise = this.connectInternal();
    return this.connectionPromise;
  }

  /**
   * Internal connection logic (used for initial connect and reconnection)
   */
  private async connectInternal(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          devLogger.debug('Connected to Claude Code server', {
            component: 'WebSocketClaudeCodeDispatcher',
            serverUrl: this.serverUrl
          });

          // Reset reconnection state on successful connect
          this.reconnectionService.reset();
          this.setConnectionStatus('connected');

          // Start heartbeat
          this.startHeartbeat();

          // Send any queued messages from initial connection
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
              this.sendMessage(message);
            }
          }

          // Flush pending messages from reconnection
          this.flushPendingMessages();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ClientMessage = JSON.parse(event.data);

            // Handle pong messages for heartbeat
            if ((message as any).type === 'pong') {
              this.handlePong();
              return;
            }

            this.handleServerMessage(message);
          } catch (error) {
            devLogger.error('Error parsing server message', {
              component: 'WebSocketClaudeCodeDispatcher',
              error,
              eventData: event.data
            });
          }
        };

        this.ws.onclose = (event) => {
          devLogger.debug('Disconnected from Claude Code server', {
            component: 'WebSocketClaudeCodeDispatcher',
            code: event.code,
            reason: event.reason
          });

          this.stopHeartbeat();
          this.ws = null;
          this.connectionPromise = null;

          // Only attempt reconnection if we were previously connected
          // and didn't intentionally disconnect
          if (this.connectionStatus === 'connected') {
            this.attemptReconnection();
          } else if (this.connectionStatus !== 'reconnecting') {
            this.setConnectionStatus('disconnected');
          }
        };

        this.ws.onerror = (error) => {
          devLogger.error('WebSocket error', {
            component: 'WebSocketClaudeCodeDispatcher',
            error
          });
          reject(new Error('Failed to connect to Claude Code server'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the server
   */
  private handleServerMessage(message: ClientMessage): void {
    // Handle terminal messages
    if (message.type?.startsWith('terminal:')) {
      this.handleTerminalMessage(message);
      return;
    }

    // Handle messages that don't require an execution (file monitoring, etc.)
    if (message.type === 'file_change' || message.type === 'monitoring_started' || message.type === 'monitoring_stopped') {
      this.handleNonExecutionMessage(message);
      return;
    }

    // Handle execution-related messages
    if (!message.executionId) {
      devLogger.debug('Received execution message without executionId', { component: 'WebSocketClaudeCodeDispatcher', messageType: message.type });
      return;
    }

    const execution = this.executions.get(message.executionId);
    if (!execution) {
      devLogger.debug('Received message for unknown execution', { component: 'WebSocketClaudeCodeDispatcher', executionId: message.executionId });
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
        devLogger.debug('Unknown message type', { component: 'WebSocketClaudeCodeDispatcher', messageType: message.type });
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
        devLogger.inspect('File monitoring started for session', { component: 'WebSocketClaudeCodeDispatcher', sessionId: message.sessionId });
        break;

      case 'monitoring_stopped':
        devLogger.inspect('File monitoring stopped for session', { component: 'WebSocketClaudeCodeDispatcher', sessionId: message.sessionId });
        break;

      default:
        devLogger.debug('Unknown non-execution message type', { component: 'WebSocketClaudeCodeDispatcher', messageType: message.type });
    }
  }

  /**
   * Send a message to the server
   * Messages are queued during reconnection and flushed when connection re-establishes
   */
  private sendMessage(message: ServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else if (this.connectionStatus === 'reconnecting') {
      // Queue messages during reconnection
      this.pendingMessages.push(message);
      devLogger.debug('Message queued during reconnection', {
        component: 'WebSocketClaudeCodeDispatcher',
        messageType: message.type,
        queueSize: this.pendingMessages.length
      });
    } else {
      // Queue message for when connection is established (initial connect)
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
    // Cancel any pending reconnection attempts
    this.reconnectionService.cancel();

    // Stop heartbeat
    this.stopHeartbeat();

    // Set status before closing to prevent reconnection attempt
    this.setConnectionStatus('disconnected');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;

    // Clear pending messages
    this.pendingMessages = [];
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send terminal spawn request
   */
  spawnTerminal(sessionId: string, config: {
    shell?: string;
    cwd?: string;
    cols?: number;
    rows?: number;
  }): void {
    this.sendMessage({
      type: 'terminal:spawn',
      sessionId,
      config: {
        shell: config.shell || '/bin/zsh',
        cwd: config.cwd || process.cwd(),
        cols: config.cols || 80,
        rows: config.rows || 24
      },
      mode: 'shell'
    } as unknown as ServerMessage);
  }

  /**
   * Send terminal input (keystrokes)
   */
  sendTerminalInput(sessionId: string, data: string): void {
    this.sendMessage({
      type: 'terminal:input',
      sessionId,
      data
    } as unknown as ServerMessage);
  }

  /**
   * Resize terminal
   */
  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.sendMessage({
      type: 'terminal:resize',
      sessionId,
      cols,
      rows
    } as unknown as ServerMessage);
  }

  /**
   * Kill terminal session
   */
  killTerminal(sessionId: string, signal?: string): void {
    this.sendMessage({
      type: 'terminal:kill',
      sessionId,
      signal
    } as unknown as ServerMessage);
  }

  /**
   * Request replay of buffered output (for reconnection)
   */
  requestTerminalReplay(sessionId: string): void {
    this.sendMessage({
      type: 'terminal:replay',
      sessionId
    } as unknown as ServerMessage);
  }

  /**
   * Handle terminal-specific server messages
   */
  private handleTerminalMessage(message: ClientMessage): void {
    const msgData = message as unknown as Record<string, unknown>;
    const sessionId = msgData.sessionId as string | undefined;
    if (!sessionId) return;

    const msgType = message.type as string;

    switch (msgType) {
      case 'terminal:output':
        this.options.onTerminalOutput?.(sessionId, msgData.data as string);
        break;
      case 'terminal:spawned':
        this.options.onTerminalSpawned?.(sessionId, msgData.pid as number);
        break;
      case 'terminal:exit':
        this.options.onTerminalExit?.(sessionId, msgData.exitCode as number, msgData.signal as number | undefined);
        break;
      case 'terminal:error':
        this.options.onTerminalError?.(sessionId, msgData.error as string);
        break;
      case 'terminal:replay-data':
        this.options.onTerminalReplayData?.(sessionId, msgData.data as string);
        break;
    }
  }
}

/**
 * Create a WebSocket dispatcher with server detection
 */
export async function createClaudeCodeDispatcher(
  options: WebSocketDispatcherOptions = {}
): Promise<ClaudeCodeDispatcher> {
  // Try to connect to WebSocket server first
  const wsDispatcher = new WebSocketClaudeCodeDispatcher(getWebSocketURL(), options);

  try {
    // Try connecting with a short timeout
    await Promise.race([
      wsDispatcher.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 2000)
      )
    ]);

    devLogger.inspect('Connected to Claude Code server - real CLI execution available', { component: 'WebSocketClaudeCodeDispatcher' });
    return wsDispatcher;

  } catch (error) {
    devLogger.inspect('Claude Code server not available - falling back to simulation', { component: 'WebSocketClaudeCodeDispatcher', error });
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
    devLogger.error('Failed to initialize Claude Code dispatcher', { component: 'WebSocketClaudeCodeDispatcher', error });
    _dispatcherInitialization = null;
    throw error;
  });

  return _dispatcherInitialization;
}

// Removed unused resetClaudeCodeDispatcher function