/**
 * Claude Code Output Parser
 *
 * Parses Claude Code terminal output to extract:
 * - Phase transitions (spec → plan → implement → test → commit)
 * - Choice prompts and options
 * - Tool use indicators and progress
 * - Error states and completion status
 * - File change events
 * - Token usage and cost tracking
 */

import { GSDPhase, GSDStatus, GSDChoice, FileChange, TokenUsage } from '../../types/gsd';

export interface ParsedOutput {
  phase?: GSDPhase;
  status?: GSDStatus;
  choices?: GSDChoice[];
  activeToolUse?: string;
  fileChanges?: FileChange[];
  tokenUsage?: Partial<TokenUsage>;
  error?: string;
  isComplete?: boolean;
}

export interface ClaudeCodeOutputParser {
  parseOutput(output: string): ParsedOutput;
  extractPhaseTransition(line: string): { phase: GSDPhase; status: GSDStatus } | null;
  extractChoices(output: string): GSDChoice[] | null;
  extractToolUse(line: string): string | null;
  extractFileChange(line: string): FileChange | null;
  extractTokenUsage(output: string): Partial<TokenUsage> | null;
  extractError(line: string): string | null;
}

/**
 * Default Claude Code output parser implementation
 */
export class DefaultClaudeCodeParser implements ClaudeCodeOutputParser {

  /**
   * Parse a chunk of Claude Code output and extract structured information
   */
  parseOutput(output: string): ParsedOutput {
    const lines = output.split('\n');
    const result: ParsedOutput = {};

    // Process each line for different patterns
    for (const line of lines) {
      // Check for phase transitions
      const phaseTransition = this.extractPhaseTransition(line);
      if (phaseTransition) {
        result.phase = phaseTransition.phase;
        result.status = phaseTransition.status;
      }

      // Check for tool use indicators
      const toolUse = this.extractToolUse(line);
      if (toolUse) {
        result.activeToolUse = toolUse;
        result.status = 'executing';
      }

      // Check for file changes
      const fileChange = this.extractFileChange(line);
      if (fileChange) {
        if (!result.fileChanges) result.fileChanges = [];
        result.fileChanges.push(fileChange);
      }

      // Check for errors
      const error = this.extractError(line);
      if (error) {
        result.error = error;
        result.status = 'error';
      }
    }

    // Extract multi-line patterns
    const choices = this.extractChoices(output);
    if (choices) {
      result.choices = choices;
      result.status = 'waiting-input';
    }

    const tokenUsage = this.extractTokenUsage(output);
    if (tokenUsage) {
      result.tokenUsage = tokenUsage;
    }

    // Check for completion patterns
    if (this.isCompleteOutput(output)) {
      result.isComplete = true;
      result.status = 'complete';
    }

    return result;
  }

  /**
   * Extract phase transitions from Claude Code output
   */
  extractPhaseTransition(line: string): { phase: GSDPhase; status: GSDStatus } | null {
    const cleanLine = line.trim().toLowerCase();

    // Phase start patterns
    const phaseStartPatterns = [
      { pattern: /starting.*spec/, phase: 'spec' as GSDPhase },
      { pattern: /beginning.*specification/, phase: 'spec' as GSDPhase },
      { pattern: /starting.*plan/, phase: 'plan' as GSDPhase },
      { pattern: /beginning.*planning/, phase: 'plan' as GSDPhase },
      { pattern: /starting.*implement/, phase: 'implement' as GSDPhase },
      { pattern: /beginning.*implementation/, phase: 'implement' as GSDPhase },
      { pattern: /starting.*test/, phase: 'test' as GSDPhase },
      { pattern: /beginning.*testing/, phase: 'test' as GSDPhase },
      { pattern: /starting.*commit/, phase: 'commit' as GSDPhase },
      { pattern: /beginning.*commit/, phase: 'commit' as GSDPhase }
    ];

    // Phase completion patterns
    const phaseCompletePatterns = [
      { pattern: /spec.*complete/, phase: 'spec' as GSDPhase },
      { pattern: /specification.*done/, phase: 'spec' as GSDPhase },
      { pattern: /plan.*complete/, phase: 'plan' as GSDPhase },
      { pattern: /planning.*done/, phase: 'plan' as GSDPhase },
      { pattern: /implement.*complete/, phase: 'implement' as GSDPhase },
      { pattern: /implementation.*done/, phase: 'implement' as GSDPhase },
      { pattern: /test.*complete/, phase: 'test' as GSDPhase },
      { pattern: /testing.*done/, phase: 'test' as GSDPhase },
      { pattern: /commit.*complete/, phase: 'commit' as GSDPhase },
      { pattern: /committed.*successfully/, phase: 'commit' as GSDPhase }
    ];

    // Check for phase starts
    for (const { pattern, phase } of phaseStartPatterns) {
      if (pattern.test(cleanLine)) {
        return { phase, status: 'executing' };
      }
    }

    // Check for phase completions
    for (const { pattern, phase } of phaseCompletePatterns) {
      if (pattern.test(cleanLine)) {
        return { phase, status: 'complete' };
      }
    }

    return null;
  }

  /**
   * Extract choice prompts from Claude Code output
   */
  extractChoices(output: string): GSDChoice[] | null {
    const lines = output.split('\n');
    const choices: GSDChoice[] = [];

    // Look for numbered choice patterns
    const choicePattern = /^\s*(\d+)[.)]\s+(.+)$/;
    let choiceId = 0;

    for (const line of lines) {
      const match = line.match(choicePattern);
      if (match) {
        const [, indexStr, text] = match;
        const index = parseInt(indexStr) - 1; // Convert to 0-based index

        choices.push({
          id: `choice-${choiceId++}`,
          index,
          text: text.trim()
        });
      }
    }

    // Also look for bullet point choices
    const bulletPattern = /^\s*[-•*]\s+(.+)$/;
    for (const line of lines) {
      const match = line.match(bulletPattern);
      if (match && choices.length === 0) { // Only if we haven't found numbered choices
        choices.push({
          id: `choice-${choiceId++}`,
          index: choices.length,
          text: match[1].trim()
        });
      }
    }

    return choices.length > 0 ? choices : null;
  }

  /**
   * Extract active tool use from Claude Code output
   */
  extractToolUse(line: string): string | null {
    const cleanLine = line.trim();

    // Tool use patterns
    const toolPatterns = [
      /using\s+(\w+)\s+tool/i,
      /calling\s+(\w+)/i,
      /executing\s+(.+)/i,
      /running\s+(.+)/i,
      /\[tool:\s*(\w+)\]/i,
      />\s*(\w+)\s*\(/i // Function call pattern
    ];

    for (const pattern of toolPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Generic activity patterns
    const activityPatterns = [
      /writing\s+(.+)/i,
      /creating\s+(.+)/i,
      /editing\s+(.+)/i,
      /searching\s+(.+)/i,
      /analyzing\s+(.+)/i,
      /building\s+(.+)/i
    ];

    for (const pattern of activityPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        return `${pattern.source.split('\\')[0]}${match[1]}`;
      }
    }

    return null;
  }

  /**
   * Extract file changes from Claude Code output
   */
  extractFileChange(line: string): FileChange | null {
    const cleanLine = line.trim();

    // File operation patterns
    const patterns = [
      { pattern: /created?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'create' as const },
      { pattern: /modified?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'modify' as const },
      { pattern: /edited?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'modify' as const },
      { pattern: /updated?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'modify' as const },
      { pattern: /deleted?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'delete' as const },
      { pattern: /removed?\s+(.+\.(ts|tsx|js|jsx|json|md|sql))/i, type: 'delete' as const }
    ];

    for (const { pattern, type } of patterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        return {
          path: match[1],
          type,
          timestamp: new Date()
        };
      }
    }

    return null;
  }

  /**
   * Extract token usage information from Claude Code output
   */
  extractTokenUsage(output: string): Partial<TokenUsage> | null {
    // Look for token usage patterns
    const tokenPatterns = [
      /input.*tokens?:\s*(\d+)/i,
      /output.*tokens?:\s*(\d+)/i,
      /total.*tokens?:\s*(\d+)/i,
      /cost.*\$?([\d.]+)/i
    ];

    const usage: Partial<TokenUsage> = {};

    for (const line of output.split('\n')) {
      for (const pattern of tokenPatterns) {
        const match = line.match(pattern);
        if (match) {
          const value = parseInt(match[1]) || parseFloat(match[1]);

          if (pattern.source.includes('input')) {
            usage.input = value;
          } else if (pattern.source.includes('output')) {
            usage.output = value;
          } else if (pattern.source.includes('total')) {
            usage.input = usage.input || 0;
            usage.output = usage.output || 0;
            // If we have a total but not input/output, split evenly
            if (!usage.input && !usage.output) {
              usage.input = Math.floor(value / 2);
              usage.output = Math.ceil(value / 2);
            }
          } else if (pattern.source.includes('cost')) {
            usage.cost = value;
          }
        }
      }
    }

    return Object.keys(usage).length > 0 ? usage : null;
  }

  /**
   * Extract error messages from Claude Code output
   */
  extractError(line: string): string | null {
    const cleanLine = line.trim();

    // Error patterns
    const errorPatterns = [
      /error:\s*(.+)/i,
      /failed:\s*(.+)/i,
      /exception:\s*(.+)/i,
      /❌\s*(.+)/i,
      /✗\s*(.+)/i
    ];

    for (const pattern of errorPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if output indicates completion
   */
  private isCompleteOutput(output: string): boolean {
    const completionPatterns = [
      /task.*complete/i,
      /session.*complete/i,
      /all.*done/i,
      /✅.*complete/i,
      /successfully.*finished/i,
      /execution.*finished/i
    ];

    return completionPatterns.some(pattern => pattern.test(output));
  }
}

/**
 * Default parser instance
 */
export const claudeCodeParser = new DefaultClaudeCodeParser();