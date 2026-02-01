// GSD Frontend Types
export type GSDPhase = 'idle' | 'planning' | 'executing' | 'testing' | 'committing' | 'debugging';
export type GSDCommandCategory = 'planning' | 'execution' | 'research' | 'debug' | 'workflow';

export interface GSDCommand {
  id: string;
  label: string;
  description: string;
  slashCommand: string;
  category: GSDCommandCategory;
  icon: string;
  shortcut?: string;
  requiresInput?: boolean;
  dangerLevel?: 'safe' | 'warning' | 'danger';
}

export interface GSDProgressState {
  phase: GSDPhase;
  currentTask: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
  startTime: Date;
  subTasks: GSDSubTask[];
  totalTasks: number;
  completedTasks: number;
}

export interface GSDSubTask {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

export interface GSDChoice {
  id: string;
  label: string;
  description?: string;
  action: 'continue' | 'modify' | 'abort' | 'custom';
  payload?: Record<string, unknown>;
  isDefault?: boolean;
  shortcut?: string;
}

export interface GSDChoicePrompt {
  id: string;
  title: string;
  message: string;
  choices: GSDChoice[];
  allowMultiSelect: boolean;
  timeout?: number;
  context?: Record<string, unknown>;
}

export interface GSDSession {
  id: string;
  projectName: string;
  currentPhase: GSDPhase;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  context: GSDContext;
  history: GSDHistoryEntry[];
}

export interface GSDContext {
  currentPhase: GSDPhase;
  activeProject: string;
  workingDirectory: string;
  pendingQuestion?: string;
  chatHistory: GSDChatMessage[];
  variables: Record<string, unknown>;
}

export interface GSDChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'command' | 'response' | 'choice' | 'progress';
  metadata?: Record<string, unknown>;
}

export interface GSDHistoryEntry {
  id: string;
  timestamp: Date;
  type: 'command' | 'choice' | 'input' | 'result';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GSDExecutionStream {
  sessionId: string;
  phase: GSDPhase;
  onProgress: (progress: GSDProgressState) => void;
  onChoice: (prompt: GSDChoicePrompt) => void;
  onComplete: (result: GSDExecutionResult) => void;
  onError: (error: GSDError) => void;
  cancel: () => void;
}

export interface GSDExecutionResult {
  success: boolean;
  phase: GSDPhase;
  output: string;
  filesChanged: string[];
  testsRun?: number;
  testsPassed?: number;
  commitHash?: string;
  duration: number;
}

export interface GSDError {
  code: string;
  message: string;
  phase: GSDPhase;
  recoverable: boolean;
  suggestions?: string[];
  context?: Record<string, unknown>;
}

export interface GSDUpdate {
  type: 'progress' | 'choice' | 'complete' | 'error' | 'phase-change';
  sessionId: string;
  data: GSDProgressState | GSDChoicePrompt | GSDExecutionResult | GSDError;
  timestamp: Date;
}

// Built-in GSD Commands
export const DEFAULT_GSD_COMMANDS: GSDCommand[] = [
  {
    id: 'gsd:new-project',
    label: 'New Project',
    description: 'Start a new GSD project with research and planning',
    slashCommand: '/gsd:new-project',
    category: 'planning',
    icon: '📋',
    shortcut: 'Cmd+N',
    requiresInput: true,
  },
  {
    id: 'gsd:plan-phase',
    label: 'Plan Phase',
    description: 'Create detailed implementation plan for current phase',
    slashCommand: '/gsd:plan-phase',
    category: 'planning',
    icon: '🎯',
    requiresInput: true,
  },
  {
    id: 'gsd:execute-plan',
    label: 'Execute Plan',
    description: 'Execute the current phase plan with TDD',
    slashCommand: '/gsd:execute-plan',
    category: 'execution',
    icon: '⚡',
    dangerLevel: 'warning',
  },
  {
    id: 'gsd:debug',
    label: 'Debug Issues',
    description: 'Investigate and debug current issues',
    slashCommand: '/gsd:debug',
    category: 'debug',
    icon: '🔍',
    requiresInput: true,
  },
  {
    id: 'gsd:test',
    label: 'Run Tests',
    description: 'Execute test suite and analyze results',
    slashCommand: '/gsd:test',
    category: 'execution',
    icon: '🧪',
  },
  {
    id: 'gsd:commit',
    label: 'Commit Changes',
    description: 'Review and commit current changes',
    slashCommand: '/gsd:commit',
    category: 'workflow',
    icon: '💾',
    dangerLevel: 'warning',
  },
  {
    id: 'gsd:research',
    label: 'Research',
    description: 'Research topic with web search and documentation',
    slashCommand: '/gsd:research',
    category: 'research',
    icon: '📚',
    requiresInput: true,
  },
  {
    id: 'gsd:review',
    label: 'Code Review',
    description: 'Review recent changes for quality and issues',
    slashCommand: '/gsd:review',
    category: 'workflow',
    icon: '👁️',
  },
];

// Utility type guards
export function isGSDCommand(obj: unknown): obj is GSDCommand {
  return typeof obj === 'object' && obj !== null && 'slashCommand' in obj;
}

export function isGSDSession(obj: unknown): obj is GSDSession {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'isActive' in obj;
}

export function isValidGSDPhase(phase: string): phase is GSDPhase {
  return ['idle', 'planning', 'executing', 'testing', 'committing', 'debugging'].includes(phase);
}