/**
 * Claude Code Terminal
 *
 * Enhanced terminal tab specifically for Claude Code with:
 * - Syntax highlighting for Claude Code output
 * - Real-time output parsing and structured display
 * - Interactive choice selection
 * - Command suggestions and autocompletion
 * - Progress visualization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Square,
  Copy,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Code,
  ArrowDown,
  ChevronRight,
  FileText,
  Edit3,
  TerminalSquare,
  Wrench
} from 'lucide-react';
import {
  claudeCodeOutputParser,
  ClaudeCodeParseResult,
  ClaudeCodeChoice,
  ClaudeCodeParserUtils
} from '../../services/claudeCodeOutputParser';

interface ClaudeCodeTerminalProps {
  sessionId?: string;
  onChoiceSelect?: (choices: number[]) => void;
  onCommandExecute?: (command: string) => void;
  className?: string;
}

interface TerminalLine {
  id: string;
  content: string;
  parseResult: ClaudeCodeParseResult;
  timestamp: Date;
}

interface ChoiceGroup {
  id: string;
  choices: ClaudeCodeChoice[];
  timestamp: Date;
  selected?: number[];
}

/** Tool call data structure for collapsed display */
interface ToolCall {
  id: string;
  type: 'Read' | 'Write' | 'Bash' | 'Grep' | 'Glob' | 'Edit';
  path?: string;
  command?: string;
  output: string;
  timestamp: Date;
  status: 'started' | 'in_progress' | 'completed' | 'error';
}

/** Collapsed tool call renderer component */
function ToolCallRenderer({ toolCall }: { toolCall: ToolCall }) {
  const [collapsed, setCollapsed] = useState(true);

  const getToolIcon = () => {
    switch (toolCall.type) {
      case 'Read':
        return <FileText size={14} className="text-blue-400" />;
      case 'Write':
      case 'Edit':
        return <Edit3 size={14} className="text-green-400" />;
      case 'Bash':
        return <TerminalSquare size={14} className="text-yellow-400" />;
      case 'Grep':
      case 'Glob':
        return <Code size={14} className="text-purple-400" />;
      default:
        return <Code size={14} className="text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (toolCall.status) {
      case 'completed':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'in_progress':
        return 'border-blue-500';
      default:
        return 'border-yellow-500';
    }
  };

  const getSummary = () => {
    if (toolCall.path) {
      return toolCall.path.length > 50
        ? `...${toolCall.path.slice(-47)}`
        : toolCall.path;
    }
    if (toolCall.command) {
      return toolCall.command.length > 50
        ? `${toolCall.command.slice(0, 47)}...`
        : toolCall.command;
    }
    return 'Processing...';
  };

  return (
    <div className={`border-l-2 ${getStatusColor()} pl-2 my-1`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left hover:bg-gray-700/30 px-1 py-0.5 rounded transition-colors"
      >
        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-90'
          }`}
        />
        {getToolIcon()}
        <span className="text-gray-200 font-medium text-sm">{toolCall.type}</span>
        <span className="text-gray-400 text-sm truncate flex-1">{getSummary()}</span>
        {toolCall.status === 'in_progress' && (
          <RefreshCw size={12} className="text-blue-400 animate-spin" />
        )}
        {toolCall.status === 'completed' && (
          <CheckCircle size={12} className="text-green-400" />
        )}
        {toolCall.status === 'error' && (
          <AlertCircle size={12} className="text-red-400" />
        )}
      </button>
      {!collapsed && toolCall.output && (
        <pre className="mt-1 p-2 bg-gray-800 rounded text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
          {toolCall.output}
        </pre>
      )}
    </div>
  );
}

export function ClaudeCodeTerminal({
  sessionId,
  onChoiceSelect,
  onCommandExecute,
  className
}: ClaudeCodeTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentChoices, setCurrentChoices] = useState<ChoiceGroup | null>(null);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [currentToolUse, setCurrentToolUse] = useState<string | null>(null);
  const [showStructured, setShowStructured] = useState(true);
  // Track if user has scrolled up from bottom
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  // Track tool calls for collapsed display
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unique counter for React keys to prevent duplication
  const lineIdCounterRef = useRef(0);

  // Detect user scroll - check if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = terminalRef.current;
    if (!el) return;
    // Consider "at bottom" if within 10px of the bottom
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
    setIsUserScrolledUp(!isAtBottom);
  }, []);

  // Auto-scroll on new output (unless user has scrolled up)
  useEffect(() => {
    if (!isUserScrolledUp && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, isUserScrolledUp]);

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const addOutput = useCallback((output: string) => {
    const outputLines = output.split('\n');
    const newLines: TerminalLine[] = [];

    outputLines.forEach((lineContent, index) => {
      if (index === 0 && lineContent === '') return; // Skip empty first line

      const parseResult = claudeCodeOutputParser.parseLine(lineContent);
      const line: TerminalLine = {
        id: `line-${++lineIdCounterRef.current}`,
        content: lineContent,
        parseResult,
        timestamp: new Date()
      };
      newLines.push(line);
    });

    setLines(prev => [...prev, ...newLines]);

    // Update current state based on parsed output
    const allParseResults = newLines.map(l => l.parseResult);

    // Check for phase changes
    const phase = claudeCodeOutputParser.getCurrentPhase(allParseResults);
    if (phase) {
      setCurrentPhase(phase);
    }

    // Check for tool use and track tool calls for collapsed display
    const toolUse = claudeCodeOutputParser.getCurrentToolUse(allParseResults);
    if (toolUse) {
      setCurrentToolUse(ClaudeCodeParserUtils.formatToolUse(toolUse));

      // Add or update tool call for collapsed display
      const toolCallType = toolUse.toolName as ToolCall['type'];
      const toolCallId = `tool-${toolUse.toolName}-${Date.now()}`;

      setToolCalls(prev => {
        // Check if we have an in-progress tool call of this type
        const existingIndex = prev.findIndex(
          tc => tc.type === toolCallType && tc.status === 'in_progress'
        );

        if (existingIndex >= 0) {
          // Update existing tool call
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            output: updated[existingIndex].output + '\n' + (toolUse.action || ''),
            status: toolUse.status === 'completed' ? 'completed' : 'in_progress'
          };
          return updated;
        } else {
          // Add new tool call
          return [...prev, {
            id: toolCallId,
            type: toolCallType,
            path: toolUse.action,
            output: toolUse.action || '',
            timestamp: new Date(),
            status: toolUse.status === 'completed' ? 'completed' : 'in_progress'
          }];
        }
      });
    }

    // Check for choices
    const choices = claudeCodeOutputParser.extractChoices(allParseResults);
    if (choices.length > 0) {
      setCurrentChoices({
        id: `choices-${Date.now()}`,
        choices,
        timestamp: new Date()
      });
      setIsExecuting(false);
    }

    // Check if execution completed
    const hasCompletion = allParseResults.some(r => r.type === 'completion');
    if (hasCompletion) {
      setIsExecuting(false);
      setCurrentToolUse(null);
    }
  }, []);

  const handleCommand = useCallback((command: string) => {
    if (!command.trim()) return;

    // Add command to history
    setCommandHistory(prev => {
      const filtered = prev.filter(cmd => cmd !== command);
      return [...filtered, command].slice(-50); // Keep last 50 commands
    });
    setHistoryIndex(-1);

    // Add command line to terminal
    const commandLine: TerminalLine = {
      id: `cmd-${Date.now()}`,
      content: `> ${command}`,
      parseResult: {
        type: 'text',
        content: `> ${command}`,
        timestamp: new Date()
      },
      timestamp: new Date()
    };
    setLines(prev => [...prev, commandLine]);

    // Clear current choices and set executing state
    setCurrentChoices(null);
    setIsExecuting(true);

    // Execute command
    onCommandExecute?.(command);
    setInput('');
  }, [onCommandExecute]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        handleCommand(input);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
        }
        break;

      case 'Tab':
        e.preventDefault();
        // TODO: Command completion
        break;
    }
  }, [input, commandHistory, historyIndex, handleCommand]);

  const handleChoiceSelect = useCallback((choiceIndex: number) => {
    if (currentChoices) {
      const selected = [choiceIndex];
      setCurrentChoices({
        ...currentChoices,
        selected
      });
      onChoiceSelect?.(selected);
      setIsExecuting(true);
    }
  }, [currentChoices, onChoiceSelect]);

  const copyTerminalOutput = useCallback(() => {
    const output = lines.map(line => line.content).join('\n');
    navigator.clipboard.writeText(output);
  }, [lines]);

  const clearTerminal = useCallback(() => {
    setLines([]);
    setCurrentChoices(null);
    setCurrentPhase(null);
    setCurrentToolUse(null);
    setToolCalls([]);
  }, []);

  const renderLine = useCallback((line: TerminalLine) => {
    const { parseResult } = line;

    // For structured view, render enhanced output
    if (showStructured && parseResult.structured) {
      switch (parseResult.type) {
        case 'phase_transition':
          return (
            <div className="flex items-center gap-2 py-1 px-2 bg-blue-900/30 border-l-2 border-blue-400 my-1">
              <RefreshCw size={14} className="text-blue-400" />
              <span className="text-blue-200 font-medium">
                Phase: {parseResult.structured.phaseTransition?.toPhase}
              </span>
              <span className="text-gray-400 text-xs">
                {parseResult.timestamp.toLocaleTimeString()}
              </span>
            </div>
          );

        case 'tool_use': {
          const toolUse = parseResult.structured.toolUse!;
          // Use ToolCallRenderer for collapsed display (default collapsed)
          const toolCall: ToolCall = {
            id: `tool-${toolUse.toolName}-${line.id}`,
            type: toolUse.toolName as ToolCall['type'],
            path: toolUse.action,
            output: toolUse.action || '',
            timestamp: parseResult.timestamp,
            status: toolUse.status as ToolCall['status']
          };
          return <ToolCallRenderer toolCall={toolCall} />;
        }

        case 'progress': {
          const progress = parseResult.structured.progress!;
          const percent = progress.totalSteps
            ? Math.round((progress.completedSteps! / progress.totalSteps) * 100)
            : 0;

          return (
            <div className="py-1 px-2 bg-green-900/30 border-l-2 border-green-400 my-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-green-400" />
                <span className="text-green-200 text-sm">{progress.currentStep}</span>
                {progress.totalSteps && (
                  <span className="text-gray-400 text-xs">
                    {progress.completedSteps}/{progress.totalSteps} ({percent}%)
                  </span>
                )}
              </div>
              {progress.totalSteps && (
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>
          );
        }

        case 'error': {
          const error = parseResult.structured.error!;
          return (
            <div className="py-2 px-3 bg-red-900/30 border-l-2 border-red-400 my-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-red-200 font-medium">
                  {error.errorType.charAt(0).toUpperCase() + error.errorType.slice(1)} Error
                </span>
                {error.file && error.line && (
                  <span className="text-gray-400 text-xs">
                    {error.file}:{error.line}
                  </span>
                )}
              </div>
              <div className="text-red-100 text-sm mb-2">
                {error.message}
              </div>
              {error.suggestions.length > 0 && (
                <div className="text-yellow-200 text-xs">
                  <div className="font-medium mb-1">Suggestions:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {error.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }
      }
    }

    // Default rendering for text lines
    const isCommand = line.content.startsWith('> ');
    const isChoice = /^\d+[.)]\s+/.test(line.content.trim());

    return (
      <div className={`py-0.5 ${isCommand ? 'text-blue-300 font-medium' : ''}`}>
        {isChoice ? (
          <button
            onClick={() => {
              const match = line.content.match(/^(\d+)[.)]/);
              if (match) {
                handleChoiceSelect(parseInt(match[1], 10));
              }
            }}
            className="text-left w-full hover:bg-gray-700/50 px-1 rounded transition-colors"
          >
            <span className="text-yellow-400 font-medium">{line.content.match(/^\d+/)?.[0]}.</span>
            <span className="text-gray-200 ml-1">
              {line.content.replace(/^\d+[.)]\s*/, '')}
            </span>
          </button>
        ) : (
          <span className={`${
            isCommand ? 'text-blue-300' :
            line.content.includes('Error') || line.content.includes('Failed') ? 'text-red-300' :
            line.content.includes('Success') || line.content.includes('✓') ? 'text-green-300' :
            'text-gray-200'
          }`}>
            {line.content}
          </span>
        )}
        <span className="text-gray-500 text-xs ml-2">
          {line.timestamp.toLocaleTimeString()}
        </span>
      </div>
    );
  }, [showStructured, handleChoiceSelect]);

  // Mock output for demonstration
  useEffect(() => {
    const mockOutput = `Starting Claude Code session...
Analyzing project structure...
Found TypeScript configuration
Starting implementation phase...

I need to implement the requested feature. I have several approaches:

1. Quick implementation with basic features
2. Comprehensive solution with full testing
3. Minimal viable product approach

Please select an option (1-3):`;

    // Simulate receiving this output
    setTimeout(() => addOutput(mockOutput), 1000);
  }, [addOutput]);

  return (
    <div className={`${className} h-full flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-green-400" />
          <span className="font-medium text-gray-200">Claude Code Terminal</span>
          {sessionId && (
            <span className="text-xs text-gray-500">({sessionId.slice(0, 8)})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentPhase && (
            <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
              {currentPhase}
            </span>
          )}

          {/* Tool calls summary */}
          {toolCalls.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded" title={`${toolCalls.length} tool calls`}>
              <Wrench size={12} />
              {toolCalls.length}
            </span>
          )}

          <button
            onClick={() => setShowStructured(!showStructured)}
            className={`px-2 py-1 text-xs rounded ${
              showStructured ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
            }`}
            title="Toggle structured view"
          >
            Enhanced
          </button>

          <button
            onClick={copyTerminalOutput}
            className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
          >
            <Copy size={12} />
          </button>

          <button
            onClick={clearTerminal}
            className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {(currentToolUse || isExecuting) && (
        <div className="px-3 py-2 bg-yellow-900/30 border-b border-yellow-600/30 text-yellow-200 text-sm">
          {isExecuting && !currentToolUse && (
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" />
              Claude is processing...
            </div>
          )}
          {currentToolUse && (
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" />
              {currentToolUse}
            </div>
          )}
        </div>
      )}

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
        style={{
          scrollBehavior: 'smooth',
          fontFamily: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace'
        }}
      >
        {lines.map(line => (
          <div key={line.id} className="leading-relaxed">
            {renderLine(line)}
          </div>
        ))}

        {/* Scroll to bottom indicator (when user has scrolled up) */}
        {isUserScrolledUp && (
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-2">
            <button
              onClick={() => {
                if (terminalRef.current) {
                  terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                }
              }}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDown size={12} />
              Scroll to bottom
            </button>
          </div>
        )}

        {/* Choice Selection Interface */}
        {currentChoices && showStructured && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/50 rounded">
            <div className="text-blue-300 font-medium mb-2 text-sm">
              Please select an option:
            </div>
            <div className="space-y-1">
              {currentChoices.choices.map(choice => (
                <button
                  key={choice.index}
                  onClick={() => handleChoiceSelect(choice.index)}
                  disabled={currentChoices.selected?.includes(choice.index)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    currentChoices.selected?.includes(choice.index)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-200'
                  }`}
                >
                  <span className="text-yellow-400 font-medium mr-2">{choice.index}.</span>
                  {choice.text}
                  {choice.category && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({choice.category})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter Claude Code command..."
            disabled={isExecuting}
            className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none font-mono"
          />
          {isExecuting && (
            <button
              onClick={() => {
                setIsExecuting(false);
                setCurrentToolUse(null);
              }}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              <Square size={12} />
            </button>
          )}
        </div>
        {commandHistory.length > 0 && historyIndex >= 0 && (
          <div className="text-xs text-gray-500 mt-1">
            History: {historyIndex + 1}/{commandHistory.length}
          </div>
        )}
      </div>
    </div>
  );
}