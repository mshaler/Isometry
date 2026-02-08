import { useState, useRef, useCallback } from 'react';

export interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  exitCode?: number;
  isComplete: boolean;
}

export interface TerminalState {
  commands: TerminalCommand[];
  currentDirectory: string;
  isConnected: boolean;
  isProcessing: boolean;
}

/**
 * Hook for managing terminal state and command execution
 * Bridge eliminated - minimal terminal functionality for shell component
 */
export function useTerminal() {
  const [state, setState] = useState<TerminalState>({
    commands: [],
    currentDirectory: '~',
    isConnected: true,
    isProcessing: false
  });

  const commandIdRef = useRef(0);

  const executeCommand = useCallback(async (commandText: string) => {
    const commandId = `cmd_${++commandIdRef.current}`;

    // Add command to history
    const newCommand: TerminalCommand = {
      id: commandId,
      command: commandText,
      output: '',
      timestamp: new Date(),
      isComplete: false
    };

    setState(prev => ({
      ...prev,
      commands: [...prev.commands, newCommand],
      isProcessing: true
    }));

    // Simulate command execution
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        commands: prev.commands.map(cmd =>
          cmd.id === commandId
            ? {
                ...cmd,
                output: `Executed: ${commandText}\n[Bridge eliminated - command execution disabled]`,
                exitCode: 0,
                isComplete: true
              }
            : cmd
        ),
        isProcessing: false
      }));
    }, 500);

    return commandId;
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      commands: []
    }));
  }, []);

  const getLastCommand = useCallback(() => {
    return state.commands[state.commands.length - 1];
  }, [state.commands]);

  return {
    ...state,
    executeCommand,
    clearHistory,
    getLastCommand
  };
}