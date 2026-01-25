export type CommandType = 'system' | 'claude';

export interface ShellCommand {
  id: string;
  type: CommandType;
  command: string;
  timestamp: Date;
  cwd?: string;
}

export interface CommandResponse {
  id: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  type: CommandType;
}

export interface ClaudeAPIConfig {
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}