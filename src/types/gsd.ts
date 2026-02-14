/**
 * GSD (Getting Shit Done) Type Definitions
 *
 * Types for the GSD GUI interface that wraps Claude Code CLI
 * with rich visual components and workflow management.
 */

export interface GSDChoice {
  id: string;
  index: number;
  text: string;
  shortcut?: string; // e.g., "1", "2", etc.
}

export interface GSDMessage {
  id: string;
  timestamp: Date;
  type: 'text' | 'tool_use' | 'choice' | 'phase' | 'result' | 'error' | 'system' | 'activity';
  content: string;
  choices?: GSDChoice[];
  phase?: GSDPhase;
}

export type GSDPhase = 'idle' | 'spec' | 'plan' | 'implement' | 'test' | 'commit' | 'error';

export type GSDStatus = 'waiting-input' | 'executing' | 'paused' | 'complete' | 'error';

export interface PhaseEvent {
  phase: GSDPhase;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  status: 'active' | 'completed' | 'error';
}

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  diff?: string;
  timestamp: Date;
}

export interface TokenUsage {
  input: number;
  output: number;
  cost?: number;
}

export interface GSDSessionState {
  // Session identity
  sessionId: string;
  projectPath: string;
  startedAt: Date;

  // Current state
  phase: GSDPhase;
  status: GSDStatus;

  // Pending interaction
  pendingChoices: GSDChoice[] | null;
  pendingInputType: 'choice' | 'freeform' | 'confirm' | null;

  // History
  phaseHistory: PhaseEvent[];
  messageLog: GSDMessage[];
  fileChanges: FileChange[];

  // Metrics
  tokenUsage: TokenUsage;
  executionTime: number;

  // UI State
  isCollapsed: boolean;
  showDetails: boolean;
}

export interface ChoicePromptProps {
  choices: GSDChoice[];
  multiSelect: boolean;
  onSelect: (indices: number[]) => void;
  onFreeformInput: () => void;
  disabled?: boolean;
}

export interface ExecutionProgressProps {
  currentPhase: GSDPhase;
  phaseHistory: PhaseEvent[];
  activeToolUse: string | null;
  fileChanges: { created: number; modified: number; deleted: number };
  tokenUsage: TokenUsage;
  status: GSDStatus;
}

/**
 * Output parsing patterns for detecting GSD structures in Claude Code stdout
 */
export interface GSDOutputPattern {
  type: 'choice' | 'phase' | 'tool_use' | 'complete' | 'error';
  regex: RegExp;
  extract: (match: RegExpMatchArray) => any;
}

export const GSD_PATTERNS: GSDOutputPattern[] = [
  // Choice patterns: "1. Option A", "2. Option B"
  {
    type: 'choice',
    regex: /^\s*(\d+)\.\s+(.+)$/gm,
    extract: (match) => ({
      index: parseInt(match[1]),
      text: match[2].trim()
    })
  },

  // Phase transitions: "Phase: implement" or "Starting implementation phase"
  {
    type: 'phase',
    regex: /(?:Phase:|Starting|Beginning)\s+(spec|plan|implement|test|commit)/i,
    extract: (match) => ({
      phase: match[1].toLowerCase() as GSDPhase
    })
  },

  // Tool use: "[tool_use: write_file] src/components/Grid.tsx"
  {
    type: 'tool_use',
    regex: /\[tool_use:\s*(\w+)\]\s*(.+)/,
    extract: (match) => ({
      tool: match[1],
      target: match[2].trim()
    })
  },

  // Completion: "Phase complete" or "Implementation finished"
  {
    type: 'complete',
    regex: /(?:Phase\s+complete|finished|done)/i,
    extract: () => ({})
  }
];