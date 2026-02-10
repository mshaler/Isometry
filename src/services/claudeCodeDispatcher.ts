/**
 * Claude Code Dispatcher
 *
 * Handles sending commands to Claude Code CLI and managing the execution lifecycle.
 * Bridges between the GSD GUI and the terminal where Claude Code runs.
 */

import { devLogger } from '../utils/logging';

export interface ClaudeCodeCommand {
  command: string;
  args?: string[];
  input?: string;
  workingDirectory?: string;
  timeout?: number;
}

export interface CommandExecution {
  id: string;
  command: ClaudeCodeCommand;
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  output: string[];
  error?: string;
}

export interface ClaudeCodeDispatcherOptions {
  onOutput?: (output: string, executionId: string) => void;
  onError?: (error: string, executionId: string) => void;
  onComplete?: (executionId: string) => void;
  defaultWorkingDirectory?: string;
}

/**
 * Interface for Claude Code CLI command dispatcher
 */
export interface ClaudeCodeDispatcher {
  execute(command: ClaudeCodeCommand): Promise<string>;
  executeAsync(command: ClaudeCodeCommand): Promise<CommandExecution>;
  cancel(executionId: string): Promise<boolean>;
  getExecution(executionId: string): CommandExecution | null;
  getActiveExecutions(): CommandExecution[];
}

/**
 * Default implementation that sends commands to the terminal
 */
export class DefaultClaudeCodeDispatcher implements ClaudeCodeDispatcher {
  private executions = new Map<string, CommandExecution>();
  private options: ClaudeCodeDispatcherOptions;

  constructor(options: ClaudeCodeDispatcherOptions = {}) {
    this.options = options;
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
    const executionId = this.generateExecutionId();

    const execution: CommandExecution = {
      id: executionId,
      command,
      status: 'pending',
      output: []
    };

    this.executions.set(executionId, execution);

    try {
      await this.runCommand(execution);
    } catch (error) {
      execution.status = 'error';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      this.options.onError?.(execution.error, executionId);
    }

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

    if (execution.status === 'running') {
      // Terminate the child process if it exists
      const childProcess = (execution as any).__process;
      if (childProcess) {
        try {
          childProcess.kill('SIGTERM');
          // Give it a moment to terminate gracefully
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        } catch (error) {
          devLogger.debug('Error terminating child process', { component: 'ClaudeCodeDispatcher', error });
        }
      }

      execution.status = 'cancelled';
      execution.endTime = new Date();
      return true;
    }

    return false;
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
   * Actually run the command using Node.js child_process
   */
  private async runCommand(execution: CommandExecution): Promise<void> {
    execution.status = 'running';
    execution.startTime = new Date();

    const { args = [], input, workingDirectory } = execution.command;

    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Browser environment - fall back to simulation
        await this.simulateClaudeCommand(execution, args, input);
        execution.status = 'completed';
        execution.endTime = new Date();
        this.options.onComplete?.(execution.id);
        return;
      }

      // Node.js environment - use real child_process
      const { spawn } = await import('child_process');

      // Determine the actual Claude Code CLI command
      const claudeCodePath = await this.findClaudeCodeExecutable();
      const fullArgs = [...args];

      // Spawn the child process
      const child = spawn(claudeCodePath, fullArgs, {
        cwd: workingDirectory || this.options.defaultWorkingDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store process reference for cancellation
      (execution as any).__process = child;

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.addOutput(execution, output);
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.addOutput(execution, output);
      });

      // Send input if provided
      if (input && child.stdin) {
        child.stdin.write(input + '\n');
      }

      // Wait for completion
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on('close', (code) => {
          resolve(code || 0);
        });

        child.on('error', (error) => {
          reject(error);
        });

        // Handle timeout
        if (execution.command.timeout) {
          setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${execution.command.timeout}ms`));
          }, execution.command.timeout);
        }
      });

      if (exitCode === 0) {
        execution.status = 'completed';
        this.options.onComplete?.(execution.id);
      } else {
        execution.status = 'error';
        execution.error = `Command exited with code ${exitCode}`;
        this.options.onError?.(execution.error, execution.id);
      }

      execution.endTime = new Date();

    } catch (error) {
      execution.status = 'error';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.endTime = new Date();
      this.options.onError?.(execution.error, execution.id);
    }
  }

  /**
   * Find the Claude Code CLI executable
   */
  private async findClaudeCodeExecutable(): Promise<string> {
    // Common paths where Claude Code might be installed
    const possiblePaths = [
      'claude',
      'claude-code',
      '/usr/local/bin/claude',
      '/usr/local/bin/claude-code',
      '/opt/homebrew/bin/claude',
      '/opt/homebrew/bin/claude-code'
    ];

    // Try to find the executable
    for (const path of possiblePaths) {
      try {
        const { execSync } = await import('child_process');
        execSync(`which ${path}`, { stdio: 'ignore' });
        return path;
      } catch (error) {
        // Continue trying
      }
    }

    // Default to 'claude' and let the system PATH handle it
    return 'claude';
  }

  /**
   * Simulate Claude Code command execution
   */
  private async simulateClaudeCommand(
    execution: CommandExecution,
    args: string[],
    input?: string
  ): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Simulate different Claude Code workflows
    if (args.includes('--help') || args.includes('-h')) {
      this.addOutput(execution, 'Claude Code CLI v1.0.0');
      this.addOutput(execution, 'Available commands:');
      this.addOutput(execution, '  spec     - Generate requirements specification');
      this.addOutput(execution, '  plan     - Create implementation plan');
      this.addOutput(execution, '  implement- Execute implementation');
      this.addOutput(execution, '  test     - Run tests and validation');
      this.addOutput(execution, '  commit   - Commit changes');
      await delay(100);
      return;
    }

    // Simulate GSD workflow commands
    if (args.includes('spec')) {
      this.addOutput(execution, 'Starting specification phase...');
      await delay(500);
      this.addOutput(execution, 'Analyzing requirements...');
      await delay(1000);
      this.addOutput(execution, 'Specification complete');
    } else if (args.includes('plan')) {
      this.addOutput(execution, 'Starting planning phase...');
      await delay(500);
      this.addOutput(execution, 'Creating implementation plan...');
      await delay(1000);
      this.addOutput(execution, 'Plan complete');
    } else if (args.includes('implement')) {
      this.addOutput(execution, 'Starting implementation phase...');
      await delay(500);
      this.addOutput(execution, 'Creating components/MyComponent.tsx');
      await delay(300);
      this.addOutput(execution, 'Modified src/types/index.ts');
      await delay(300);
      this.addOutput(execution, 'Implementation complete');
    } else if (args.includes('test')) {
      this.addOutput(execution, 'Starting test phase...');
      await delay(500);
      this.addOutput(execution, 'Running tests...');
      await delay(800);
      this.addOutput(execution, 'All tests passed');
      this.addOutput(execution, 'Test phase complete');
    } else if (args.includes('commit')) {
      this.addOutput(execution, 'Starting commit phase...');
      await delay(300);
      this.addOutput(execution, 'Staging changes...');
      await delay(200);
      this.addOutput(execution, 'Creating commit...');
      await delay(300);
      this.addOutput(execution, 'Commit complete');
    } else {
      // Default Claude Code interaction
      this.addOutput(execution, 'Claude is thinking...');
      await delay(800);

      if (input) {
        this.addOutput(execution, `Processing: ${input}`);
        await delay(500);
      }

      // Simulate a choice prompt
      this.addOutput(execution, 'I have several approaches for this task:');
      this.addOutput(execution, '1. Quick implementation with basic features');
      this.addOutput(execution, '2. Comprehensive solution with full testing');
      this.addOutput(execution, '3. Minimal viable product approach');
      this.addOutput(execution, '');
      this.addOutput(execution, 'Please select an option (1-3):');
    }
  }


  /**
   * Add output to execution and notify listeners
   */
  private addOutput(execution: CommandExecution, output: string): void {
    execution.output.push(output);
    this.options.onOutput?.(output, execution.id);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Common GSD command builders
 */
export const GSDCommands = {
  /**
   * Start a new GSD workflow
   */
  startWorkflow(task: string, workingDirectory?: string): ClaudeCodeCommand {
    return {
      command: 'claude',
      args: ['--gsd'],
      input: task,
      workingDirectory
    };
  },

  /**
   * Execute specific GSD phase
   */
  executePhase(phase: 'spec' | 'plan' | 'implement' | 'test' | 'commit', workingDirectory?: string): ClaudeCodeCommand {
    return {
      command: 'claude',
      args: [phase],
      workingDirectory
    };
  },

  /**
   * Send choice selection to Claude
   */
  selectChoice(choiceIndex: number): ClaudeCodeCommand {
    return {
      command: 'claude',
      input: choiceIndex.toString()
    };
  },

  /**
   * Send custom input to Claude
   */
  sendInput(input: string): ClaudeCodeCommand {
    return {
      command: 'claude',
      input
    };
  },

  /**
   * Cancel current operation
   */
  cancel(): ClaudeCodeCommand {
    return {
      command: 'claude',
      args: ['--cancel']
    };
  }
};

/**
 * Default dispatcher instance
 */
export const claudeCodeDispatcher = new DefaultClaudeCodeDispatcher();