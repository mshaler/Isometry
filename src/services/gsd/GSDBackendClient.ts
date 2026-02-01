import { EventEmitter } from '../../utils/EventEmitter';
import type {
  GSDSession,
  GSDCommand,
  GSDExecutionStream,
  GSDUpdate,
  GSDContext,
  GSDChoice,
  GSDProgressState,
  GSDChoicePrompt,
  GSDExecutionResult,
  GSDError,
  GSDPhase,
  GSDSubTask,
} from '../../types/gsd';

// Happy-inspired backend communication
interface HappyConnectionConfig {
  apiEndpoint?: string;
  encryption: boolean;
  realtimeSync: boolean;
  pushNotifications?: boolean;
  deviceId?: string;
}

interface GSDBackendMessage {
  id: string;
  type: 'command' | 'choice' | 'input' | 'cancel' | 'status';
  sessionId: string;
  data: unknown;
  timestamp: Date;
}

interface GSDBackendResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: Date;
}

export class GSDBackendClient extends EventEmitter {
  private config: HappyConnectionConfig;
  private isConnected = false;
  private activeSessions = new Map<string, GSDSession>();
  private executionStreams = new Map<string, GSDExecutionStream>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<HappyConnectionConfig> = {}) {
    super();
    this.config = {
      encryption: true,
      realtimeSync: true,
      pushNotifications: false,
      deviceId: this.generateDeviceId(),
      ...config,
    };
  }

  // Connection Management
  async connect(): Promise<void> {
    try {
      // In a real implementation, this would connect to Happy's backend
      // For now, we'll simulate the connection
      await this.simulateConnection();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');
    } catch (error) {
      this.emit('error', new Error(`Failed to connect: ${error}`));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.stopHeartbeat();

    // Cancel all active executions
    this.executionStreams.forEach(stream => {
      stream.cancel();
    });

    this.activeSessions.clear();
    this.executionStreams.clear();
    this.emit('disconnected');
  }

  isConnectedToBackend(): boolean {
    return this.isConnected;
  }

  // Session Management
  async startGSDSession(projectName: string, workingDirectory?: string): Promise<GSDSession> {
    if (!this.isConnected) {
      throw new Error('Not connected to backend');
    }

    const session: GSDSession = {
      id: crypto.randomUUID(),
      projectName,
      currentPhase: 'idle',
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
      context: {
        currentPhase: 'idle',
        activeProject: projectName,
        workingDirectory: workingDirectory || '/default/path',
        chatHistory: [],
        variables: {},
      },
      history: [],
    };

    this.activeSessions.set(session.id, session);
    this.emit('sessionStarted', session);

    return session;
  }

  async resumeSession(sessionId: string): Promise<GSDSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.isActive = true;
    session.lastActivity = new Date();
    this.emit('sessionResumed', session);

    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);

      // Cancel any active execution for this session
      const stream = this.executionStreams.get(sessionId);
      if (stream) {
        stream.cancel();
        this.executionStreams.delete(sessionId);
      }

      this.emit('sessionEnded', sessionId);
    }
  }

  // Command Execution
  async executeGSDCommand(
    sessionId: string,
    command: GSDCommand,
    input?: string,
    context?: GSDContext
  ): Promise<GSDExecutionStream> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!this.isConnected) {
      throw new Error('Not connected to backend');
    }

    // Cancel any existing execution for this session
    const existingStream = this.executionStreams.get(sessionId);
    if (existingStream) {
      existingStream.cancel();
    }

    const stream = this.createExecutionStream(sessionId, command, input, context);
    this.executionStreams.set(sessionId, stream);

    // Start execution simulation
    setTimeout(() => this.simulateExecution(stream, command), 100);

    return stream;
  }

  async cancelExecution(sessionId: string): Promise<void> {
    const stream = this.executionStreams.get(sessionId);
    if (stream) {
      stream.cancel();
      this.executionStreams.delete(sessionId);
    }
  }

  // Choice Handling
  async submitChoice(sessionId: string, choices: GSDChoice[]): Promise<void> {
    const stream = this.executionStreams.get(sessionId);
    if (!stream) {
      throw new Error(`No active execution for session ${sessionId}`);
    }

    // In a real implementation, this would send choices to Claude Code
    await this.sendMessage({
      id: crypto.randomUUID(),
      type: 'choice',
      sessionId,
      data: { choices },
      timestamp: new Date(),
    });
  }

  async submitLongFormInput(sessionId: string, input: string): Promise<void> {
    const stream = this.executionStreams.get(sessionId);
    if (!stream) {
      throw new Error(`No active execution for session ${sessionId}`);
    }

    await this.sendMessage({
      id: crypto.randomUUID(),
      type: 'input',
      sessionId,
      data: { input },
      timestamp: new Date(),
    });
  }

  // State Synchronization
  subscribeToUpdates(callback: (update: GSDUpdate) => void): () => void {
    const listener = (update: GSDUpdate) => callback(update);
    this.on('update', listener);

    return () => this.off('update', listener);
  }

  // Private Methods
  private createExecutionStream(
    sessionId: string,
    command: GSDCommand,
    input?: string,
    context?: GSDContext
  ): GSDExecutionStream {
    let isCancelled = false;

    return {
      sessionId,
      phase: 'planning',
      onProgress: () => {}, // Will be set by caller
      onChoice: () => {},   // Will be set by caller
      onComplete: () => {}, // Will be set by caller
      onError: () => {},    // Will be set by caller
      cancel: () => {
        isCancelled = true;
        this.executionStreams.delete(sessionId);
        this.emit('executionCancelled', sessionId);
      },
    };
  }

  private async simulateExecution(stream: GSDExecutionStream, command: GSDCommand): Promise<void> {
    // This is a simulation - in real implementation, this would interface with Claude Code
    const phases: GSDPhase[] = ['planning', 'executing', 'testing', 'committing'];
    let currentPhaseIndex = 0;
    let progress = 0;

    const updateProgress = (phase: GSDPhase, task: string, progressPercent: number) => {
      const progressState: GSDProgressState = {
        phase,
        currentTask: task,
        progress: progressPercent,
        startTime: new Date(Date.now() - 30000), // 30 seconds ago
        estimatedTimeRemaining: Math.max(0, (100 - progressPercent) * 2), // 2 seconds per percent
        totalTasks: 5,
        completedTasks: Math.floor(progressPercent / 20),
        subTasks: this.generateMockSubTasks(phase),
      };

      stream.onProgress(progressState);

      this.emit('update', {
        type: 'progress',
        sessionId: stream.sessionId,
        data: progressState,
        timestamp: new Date(),
      });
    };

    // Simulate command execution phases
    for (const phase of phases) {
      stream.phase = phase;

      // Show choice dialog for planning phase
      if (phase === 'planning' && command.category === 'planning') {
        const choicePrompt: GSDChoicePrompt = {
          id: crypto.randomUUID(),
          title: 'Implementation Approach',
          message: `How should we approach: ${command.description}?`,
          choices: [
            {
              id: 'iterative',
              label: 'Iterative Development',
              description: 'Build incrementally with frequent testing',
              action: 'continue',
              isDefault: true,
            },
            {
              id: 'comprehensive',
              label: 'Comprehensive Implementation',
              description: 'Build the complete solution in one go',
              action: 'continue',
            },
            {
              id: 'research',
              label: 'Research First',
              description: 'Do more research before implementing',
              action: 'modify',
            },
          ],
          allowMultiSelect: false,
        };

        stream.onChoice(choicePrompt);

        // Wait for choice (simulated)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Simulate progress through phase
      for (let i = 0; i <= 100; i += 20) {
        if (currentPhaseIndex * 25 + (i / 4) > 100) break;

        updateProgress(
          phase,
          `${this.getPhaseTask(phase)} (${i}%)`,
          Math.min(100, currentPhaseIndex * 25 + (i / 4))
        );

        await new Promise(resolve => setTimeout(resolve, 500));
        progress = Math.min(100, currentPhaseIndex * 25 + (i / 4));
      }

      currentPhaseIndex++;

      if (progress >= 100) break;
    }

    // Complete execution
    const result: GSDExecutionResult = {
      success: true,
      phase: 'committing',
      output: `Successfully executed ${command.label}`,
      filesChanged: ['src/example.ts', 'src/types.ts'],
      testsRun: 15,
      testsPassed: 15,
      commitHash: 'abc123def456',
      duration: 30.5,
    };

    stream.onComplete(result);

    this.emit('update', {
      type: 'complete',
      sessionId: stream.sessionId,
      data: result,
      timestamp: new Date(),
    });

    this.executionStreams.delete(stream.sessionId);
  }

  private generateMockSubTasks(phase: GSDPhase): GSDSubTask[] {
    const taskTemplates = {
      planning: [
        'Analyze requirements',
        'Create implementation plan',
        'Identify dependencies',
        'Design architecture',
      ],
      executing: [
        'Write core logic',
        'Implement interfaces',
        'Add error handling',
        'Update documentation',
      ],
      testing: [
        'Run unit tests',
        'Execute integration tests',
        'Verify functionality',
        'Check code coverage',
      ],
      committing: [
        'Review changes',
        'Update commit message',
        'Push to repository',
      ],
    };

    const templates = taskTemplates[phase] || ['Processing...'];

    return templates.map((name, index) => ({
      id: crypto.randomUUID(),
      name,
      status: index < 2 ? 'completed' : index === 2 ? 'in-progress' : 'pending',
      startTime: index < 3 ? new Date(Date.now() - (3 - index) * 5000) : undefined,
      endTime: index < 2 ? new Date(Date.now() - (2 - index) * 5000) : undefined,
      output: index < 2 ? 'Task completed successfully' : undefined,
    }));
  }

  private getPhaseTask(phase: GSDPhase): string {
    switch (phase) {
      case 'planning': return 'Creating implementation plan';
      case 'executing': return 'Writing code and tests';
      case 'testing': return 'Running test suite';
      case 'committing': return 'Committing changes';
      case 'debugging': return 'Investigating issues';
      default: return 'Processing';
    }
  }

  private async simulateConnection(): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In real implementation, this would:
    // 1. Connect to Happy's backend service
    // 2. Authenticate device
    // 3. Establish encrypted WebSocket connection
    // 4. Register for push notifications
  }

  private async sendMessage(message: GSDBackendMessage): Promise<GSDBackendResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected to backend');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      id: crypto.randomUUID(),
      success: true,
      timestamp: new Date(),
    };
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        // Send heartbeat to maintain connection
        this.sendMessage({
          id: crypto.randomUUID(),
          type: 'status',
          sessionId: 'heartbeat',
          data: { alive: true },
          timestamp: new Date(),
        }).catch(() => {
          // Connection lost, attempt to reconnect
          this.handleConnectionLoss();
        });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleConnectionLoss(): Promise<void> {
    this.isConnected = false;
    this.emit('disconnected');

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      setTimeout(async () => {
        try {
          await this.connect();
          this.emit('reconnected');
        } catch (error) {
          this.emit('error', error);
        }
      }, delay);
    } else {
      this.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  private generateDeviceId(): string {
    return `gsd-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility Methods
  getActiveSessions(): GSDSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSession(sessionId: string): GSDSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  isExecuting(sessionId: string): boolean {
    return this.executionStreams.has(sessionId);
  }
}

// Singleton instance
let gsdBackendClient: GSDBackendClient | null = null;

export function getGSDBackendClient(): GSDBackendClient {
  if (!gsdBackendClient) {
    gsdBackendClient = new GSDBackendClient();
  }
  return gsdBackendClient;
}

export function resetGSDBackendClient(): void {
  if (gsdBackendClient) {
    gsdBackendClient.disconnect();
    gsdBackendClient = null;
  }
}