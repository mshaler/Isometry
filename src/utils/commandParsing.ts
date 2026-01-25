import type { CommandType } from '../types/shell';

export interface ParsedCommand {
  type: CommandType;
  command?: string;
  prompt?: string;
  originalInput: string;
}

const CLAUDE_PREFIXES = ['claude', 'ai', 'ask'];

/**
 * Parse raw terminal input into structured command
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (trimmed === '') {
    return {
      type: 'system',
      command: '',
      originalInput: input
    };
  }

  const commandType = detectCommandType(trimmed);

  if (commandType === 'claude') {
    return {
      type: 'claude',
      prompt: extractClaudePrompt(trimmed),
      originalInput: input
    };
  }

  return {
    type: 'system',
    command: formatSystemCommand(trimmed),
    originalInput: input
  };
}

/**
 * Determine if command is system or Claude command
 */
export function detectCommandType(command: string): CommandType {
  const trimmed = command.trim().toLowerCase();

  // Check for Claude command prefixes
  for (const prefix of CLAUDE_PREFIXES) {
    if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
      return 'claude';
    }
  }

  return 'system';
}

/**
 * Extract Claude prompt from prefixed commands
 */
export function extractClaudePrompt(input: string): string {
  const trimmed = input.trim();

  for (const prefix of CLAUDE_PREFIXES) {
    const lowerInput = trimmed.toLowerCase();
    const lowerPrefix = prefix.toLowerCase();

    if (lowerInput === lowerPrefix) {
      // Just the prefix, return generic help prompt
      return 'help';
    }

    if (lowerInput.startsWith(`${lowerPrefix} `)) {
      // Extract everything after the prefix
      const promptStart = trimmed.indexOf(' ') + 1;
      return trimmed.substring(promptStart).trim();
    }
  }

  // Fallback: return original input if no prefix found
  return trimmed;
}

/**
 * Prepare system commands for execution
 */
export function formatSystemCommand(command: string): string {
  return sanitizeInput(command);
}

/**
 * Security validation for command input
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes and other problematic characters
  let sanitized = input.replace(/\0/g, '');

  // Limit command length to prevent abuse
  const MAX_COMMAND_LENGTH = 2000;
  if (sanitized.length > MAX_COMMAND_LENGTH) {
    sanitized = sanitized.substring(0, MAX_COMMAND_LENGTH);
  }

  return sanitized;
}

/**
 * Check if input is a help command for Claude
 */
export function isClaudeHelp(input: string): boolean {
  const trimmed = input.trim().toLowerCase();

  return (
    trimmed === 'help claude' ||
    trimmed === 'claude help' ||
    trimmed === 'claude' ||
    trimmed === 'ai help' ||
    trimmed === 'ai' ||
    trimmed === 'ask help' ||
    trimmed === 'ask'
  );
}

/**
 * Generate help text for Claude commands
 */
export function getClaudeHelpText(): string {
  return `🤖 Claude AI Commands

Usage:
  claude <prompt>    - Ask Claude a question
  ai <prompt>        - Alias for claude
  ask <prompt>       - Another alias for claude

Examples:
  claude explain this code
  ai what is this error
  ask help with debugging

Context:
• Claude automatically includes your current notebook card content
• Project context is included for relevant development questions
• Use regular shell commands (ls, pwd, git, etc.) without prefixes

Type 'claude help' or 'claude' for this help message.`;
}