/**
 * useGSDTerminalIntegration Hook
 *
 * Integrates GSD workflow with terminal output by:
 * - Monitoring terminal output for Claude Code patterns
 * - Parsing output using claudeCodeParser
 * - Updating GSD session state automatically
 * - Handling phase transitions and choice prompts
 */

import { useEffect, useCallback, useRef } from 'react';
import { claudeCodeParser, ParsedOutput } from '../services/claudeCodeParser';
import { GSDService } from '../services/gsdService';
import { GSDSessionState } from '../types/gsd';

export interface GSDTerminalIntegrationOptions {
  gsdService: GSDService | null;
  sessionId: string | null;
  enabled?: boolean;
  onStateUpdate?: (state: GSDSessionState) => void;
  onChoicePrompt?: (choices: any[]) => void;
  onError?: (error: string) => void;
}

export interface GSDTerminalIntegration {
  processTerminalOutput: (output: string) => void;
  isMonitoring: boolean;
  lastProcessedOutput: string | null;
}

/**
 * Hook for integrating GSD workflow with terminal output
 */
export function useGSDTerminalIntegration(
  options: GSDTerminalIntegrationOptions
): GSDTerminalIntegration {
  const {
    gsdService,
    sessionId,
    enabled = true,
    onStateUpdate,
    onChoicePrompt,
    onError
  } = options;

  const lastOutputRef = useRef<string>('');
  const outputBufferRef = useRef<string[]>([]);
  const isProcessingRef = useRef<boolean>(false);

  /**
   * Process a chunk of terminal output and update GSD state accordingly
   */
  const processTerminalOutput = useCallback((output: string) => {
    if (!enabled || !gsdService || !sessionId || isProcessingRef.current) {
      return;
    }

    try {
      isProcessingRef.current = true;

      // Add to output buffer for context
      outputBufferRef.current.push(output);

      // Keep only recent output (last 100 lines for context)
      if (outputBufferRef.current.length > 100) {
        outputBufferRef.current = outputBufferRef.current.slice(-100);
      }

      // Parse the output
      const parsed = claudeCodeParser.parseOutput(output);

      // Only process if we found meaningful information
      if (Object.keys(parsed).length === 0) {
        return;
      }

      // Handle parsed output
      handleParsedOutput(parsed);

      lastOutputRef.current = output;
    } catch (error) {
      console.error('Error processing terminal output:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown parsing error');
    } finally {
      isProcessingRef.current = false;
    }
  }, [enabled, gsdService, sessionId, onStateUpdate, onChoicePrompt, onError]);

  /**
   * Handle the parsed output by updating GSD state
   */
  const handleParsedOutput = useCallback((parsed: ParsedOutput) => {
    if (!gsdService || !sessionId) return;

    try {
      // Update session state based on parsed information
      const updates: Partial<GSDSessionState> = {};

      // Handle phase transitions
      if (parsed.phase && parsed.status) {
        updates.phase = parsed.phase;
        updates.status = parsed.status;

        // Add phase event to tracking
        gsdService.addPhaseEvent(sessionId, parsed.phase,
          parsed.status === 'executing' ? 'active' :
          parsed.status === 'complete' ? 'completed' : 'error'
        );
      }

      // Handle status changes
      if (parsed.status && !parsed.phase) {
        updates.status = parsed.status;
      }

      // Handle choice prompts
      if (parsed.choices && parsed.choices.length > 0) {
        updates.pendingChoices = parsed.choices;
        updates.pendingInputType = 'choice';
        updates.status = 'waiting-input';

        // Notify parent component about choices
        onChoicePrompt?.(parsed.choices);
      }

      // Handle file changes
      if (parsed.fileChanges) {
        for (const fileChange of parsed.fileChanges) {
          gsdService.addFileChange(sessionId, fileChange);
        }
      }

      // Handle token usage updates
      if (parsed.tokenUsage) {
        const currentState = gsdService.getSessionState(sessionId);
        if (currentState) {
          updates.tokenUsage = {
            ...currentState.tokenUsage,
            ...parsed.tokenUsage
          };
        }
      }

      // Handle errors
      if (parsed.error) {
        updates.status = 'error';

        // Add error message
        gsdService.addMessage(sessionId, {
          timestamp: new Date(),
          type: 'error',
          content: parsed.error,
          phase: updates.phase || gsdService.getSessionState(sessionId)?.phase
        });
      }

      // Handle completion
      if (parsed.isComplete) {
        updates.status = 'complete';
        gsdService.completeSession(sessionId);
      }

      // Apply updates if we have any
      if (Object.keys(updates).length > 0) {
        gsdService.updateSessionState(sessionId, updates);

        // Get updated state and notify
        const updatedState = gsdService.getSessionState(sessionId);
        if (updatedState) {
          onStateUpdate?.(updatedState);
        }
      }

      // Add activity message for tool use
      if (parsed.activeToolUse) {
        gsdService.addMessage(sessionId, {
          timestamp: new Date(),
          type: 'tool_use',
          content: `Using tool: ${parsed.activeToolUse}`,
          phase: updates.phase || gsdService.getSessionState(sessionId)?.phase
        });
      }

    } catch (error) {
      console.error('Error handling parsed output:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown state update error');
    }
  }, [gsdService, sessionId, onStateUpdate, onChoicePrompt, onError]);

  /**
   * Initialize monitoring when dependencies change
   */
  useEffect(() => {
    if (enabled && gsdService && sessionId) {
      // Reset output buffer when session changes
      outputBufferRef.current = [];
      lastOutputRef.current = '';
    }
  }, [enabled, gsdService, sessionId]);

  return {
    processTerminalOutput,
    isMonitoring: enabled && Boolean(gsdService && sessionId),
    lastProcessedOutput: lastOutputRef.current || null
  };
}

/**
 * Utility hook for connecting GSD integration to terminal context
 */
export function useGSDTerminalConnector(
  gsdService: GSDService | null,
  sessionId: string | null,
  terminalContext: any, // Replace with proper terminal context type
  options?: {
    onStateUpdate?: (state: GSDSessionState) => void;
    onChoicePrompt?: (choices: any[]) => void;
    onError?: (error: string) => void;
  }
) {
  const integration = useGSDTerminalIntegration({
    gsdService,
    sessionId,
    enabled: Boolean(gsdService && sessionId),
    ...options
  });

  // Connect to terminal output when available
  useEffect(() => {
    if (!integration.isMonitoring || !terminalContext) {
      return;
    }

    // TODO: Connect to actual terminal output stream
    // This would depend on the terminal implementation
    // For now, this is a placeholder for the integration point

    const handleTerminalData = (data: string) => {
      integration.processTerminalOutput(data);
    };

    // Example connection (adjust based on actual terminal context API)
    if (terminalContext.onData) {
      terminalContext.onData(handleTerminalData);

      return () => {
        terminalContext.offData?.(handleTerminalData);
      };
    }
  }, [integration, terminalContext]);

  return integration;
}