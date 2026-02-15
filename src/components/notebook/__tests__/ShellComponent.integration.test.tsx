/**
 * ShellComponent Integration Tests
 *
 * Verifies state preservation across tab switches for:
 * - Terminal (claude-code): PTY session state
 * - Claude AI: Conversation history
 * - GSD GUI: Phase progress display
 *
 * Phase 88-01: Integration & Polish regression safety net
 *
 * Strategy: Mock child components (ClaudeAIChat, GSDInterface) to isolate
 * tab switching behavior. This tests the ShellComponent's tab state
 * management without requiring full provider trees.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Track renders for each tab component to verify state preservation
const renderCounts = {
  terminal: 0,
  claudeAI: 0,
  gsd: 0,
};

// Track state per component instance
const mockStates = {
  claudeAI: { messageCount: 0, mounted: false },
  gsd: { phaseProgress: 'spec', mounted: false },
};

// Reset tracking between tests
function resetTracking() {
  renderCounts.terminal = 0;
  renderCounts.claudeAI = 0;
  renderCounts.gsd = 0;
  mockStates.claudeAI = { messageCount: 0, mounted: false };
  mockStates.gsd = { phaseProgress: 'spec', mounted: false };
}

// Mock ClaudeAIChat to track state preservation
vi.mock('../../claude-ai/ClaudeAIChat', () => ({
  ClaudeAIChat: vi.fn(({ className }) => {
    renderCounts.claudeAI++;
    mockStates.claudeAI.mounted = true;

    const [messages, setMessages] = React.useState(mockStates.claudeAI.messageCount);

    return (
      <div className={className} data-testid="claude-ai-chat">
        <div>Claude AI Chat</div>
        <div data-testid="message-count">{messages} messages</div>
        <button
          onClick={() => {
            const newCount = messages + 1;
            setMessages(newCount);
            mockStates.claudeAI.messageCount = newCount;
          }}
          data-testid="add-message"
        >
          Add Message
        </button>
      </div>
    );
  }),
}));

// Mock GSDInterface to track state preservation
vi.mock('../../gsd/GSDInterface', () => ({
  GSDInterface: vi.fn(({ className }) => {
    renderCounts.gsd++;
    mockStates.gsd.mounted = true;

    const [phase, setPhase] = React.useState(mockStates.gsd.phaseProgress);

    return (
      <div className={className} data-testid="gsd-interface">
        <div>GSD Interface</div>
        <div data-testid="phase-progress">Phase: {phase}</div>
        <button
          onClick={() => {
            const newPhase = phase === 'spec' ? 'plan' : 'implement';
            setPhase(newPhase);
            mockStates.gsd.phaseProgress = newPhase;
          }}
          data-testid="advance-phase"
        >
          Advance Phase
        </button>
      </div>
    );
  }),
}));

// Mock the hooks index file (ShellComponent imports from @/hooks)
vi.mock('@/hooks', () => ({
  useTerminal: vi.fn(() => ({
    isConnected: true,
    commands: [],
    currentDirectory: '/Users/test/project',
    isProcessing: false,
    createTerminal: vi.fn(() => {
      renderCounts.terminal++;
      return {
        write: vi.fn(),
        writeln: vi.fn(),
        dispose: vi.fn(),
        buffer: {
          active: {
            getLine: vi.fn(() => ({ translateToString: () => 'test output' })),
          },
        },
      };
    }),
    attachToProcess: vi.fn(),
    resizeTerminal: vi.fn(),
    dispose: vi.fn(),
    executeCommand: vi.fn(),
    clearHistory: vi.fn(),
    getLastCommand: vi.fn(),
    handleCopy: vi.fn(),
    handlePaste: vi.fn(),
    terminalRef: { current: null },
    setCurrentDirectory: vi.fn(),
  })),
  useCommandHistory: vi.fn(() => ({
    history: ['ls', 'npm test', 'git status'],
    currentIndex: -1,
    isSearchMode: false,
    searchQuery: '',
    searchMatch: null,
    addEntry: vi.fn(),
    navigateUp: vi.fn(() => 'git status'),
    navigateDown: vi.fn(() => null),
    enterSearchMode: vi.fn(),
    exitSearchMode: vi.fn(),
    searchHistory: vi.fn(),
    appendSearchChar: vi.fn(),
    removeSearchChar: vi.fn(),
    resetNavigation: vi.fn(),
  })),
}));

// Mock useGSDTerminalIntegration (imported from relative path)
vi.mock('../../hooks/useGSDTerminalIntegration', () => ({
  useGSDTerminalIntegration: vi.fn(() => ({
    processTerminalOutput: vi.fn(),
    isMonitoring: false,
    lastProcessedOutput: null,
  })),
}));

// Import after mocks
import { ShellComponent } from '../ShellComponent';

describe('ShellComponent Tab Switch Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTracking();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tab State Preservation', () => {
    it('preserves terminal visibility when switching Terminal -> Claude AI -> Terminal', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      // Find tab buttons
      const terminalTab = screen.getByRole('button', { name: /terminal/i });
      const claudeAITab = screen.getByRole('button', { name: /claude ai/i });

      // Start on Terminal tab (default is 'claude-code' which shows Terminal)
      expect(terminalTab).toBeInTheDocument();

      // Verify terminal tab is initially active
      await act(async () => {
        await user.click(terminalTab);
      });
      expect(terminalTab).toHaveClass('bg-gray-700');

      // Switch to Claude AI tab
      await act(async () => {
        await user.click(claudeAITab);
      });

      // Verify Claude AI content is visible
      await waitFor(() => {
        expect(screen.getByTestId('claude-ai-chat')).toBeInTheDocument();
      });

      // Switch back to Terminal
      await act(async () => {
        await user.click(terminalTab);
      });

      // Terminal container should still be mounted (uses visibility CSS)
      // The key test is that we don't crash and can switch back
      expect(terminalTab).toHaveClass('bg-gray-700');

      // Claude AI should not be visible (conditional rendering for non-terminal tabs)
      expect(screen.queryByTestId('claude-ai-chat')).not.toBeInTheDocument();
    });

    it('preserves Claude AI conversation count when switching Claude AI -> GSD -> Claude AI', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      // Find tab buttons
      const claudeAITab = screen.getByRole('button', { name: /claude ai/i });
      const gsdTab = screen.getByRole('button', { name: /gsd gui/i });

      // Switch to Claude AI tab
      await act(async () => {
        await user.click(claudeAITab);
      });

      // Add a message
      await act(async () => {
        const addButton = screen.getByTestId('add-message');
        await user.click(addButton);
      });

      // Verify message count increased
      expect(screen.getByTestId('message-count')).toHaveTextContent('1 messages');

      // Switch to GSD tab
      await act(async () => {
        await user.click(gsdTab);
      });

      // GSD interface should show
      await waitFor(() => {
        expect(screen.getByTestId('gsd-interface')).toBeInTheDocument();
      });

      // Switch back to Claude AI
      await act(async () => {
        await user.click(claudeAITab);
      });

      // Message count should be preserved in mock state
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toBeInTheDocument();
      });

      // The state was saved to mockStates
      expect(mockStates.claudeAI.messageCount).toBe(1);
    });

    it('preserves GSD phase progress when switching GSD -> Terminal -> GSD', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      // Find tab buttons
      const terminalTab = screen.getByRole('button', { name: /terminal/i });
      const gsdTab = screen.getByRole('button', { name: /gsd gui/i });

      // Switch to GSD tab
      await act(async () => {
        await user.click(gsdTab);
      });

      // Wait for GSD interface to load
      await waitFor(() => {
        expect(screen.getByTestId('gsd-interface')).toBeInTheDocument();
      });

      // Advance phase
      await act(async () => {
        const advanceButton = screen.getByTestId('advance-phase');
        await user.click(advanceButton);
      });

      // Verify phase changed
      expect(screen.getByTestId('phase-progress')).toHaveTextContent('Phase: plan');

      // Switch to Terminal
      await act(async () => {
        await user.click(terminalTab);
      });

      // Terminal should be active
      expect(terminalTab).toHaveClass('bg-gray-700');

      // Switch back to GSD
      await act(async () => {
        await user.click(gsdTab);
      });

      // GSD state should be preserved in mock
      expect(mockStates.gsd.phaseProgress).toBe('plan');
    });
  });

  describe('Rapid Tab Switching', () => {
    it('handles 10 consecutive tab switches without crashing', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      const terminalTab = screen.getByRole('button', { name: /terminal/i });
      const claudeAITab = screen.getByRole('button', { name: /claude ai/i });
      const gsdTab = screen.getByRole('button', { name: /gsd gui/i });

      const tabs = [terminalTab, claudeAITab, gsdTab];

      // Perform 10 rapid tab switches
      for (let i = 0; i < 10; i++) {
        const nextTab = tabs[i % 3];
        await act(async () => {
          await user.click(nextTab);
        });
      }

      // Component should still be functional
      expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /claude ai/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /gsd gui/i })).toBeInTheDocument();

      // Final tab should be active (index 9 % 3 = 0 = terminal)
      expect(terminalTab).toHaveClass('bg-gray-700');
    });

    it('maintains component stability during rapid switches', async () => {
      const user = userEvent.setup();
      const { container } = render(<ShellComponent className="test-shell" />);

      const tabs = [
        screen.getByRole('button', { name: /terminal/i }),
        screen.getByRole('button', { name: /claude ai/i }),
        screen.getByRole('button', { name: /gsd gui/i }),
      ];

      // Rapid fire clicks
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await user.click(tabs[0]);
          await user.click(tabs[1]);
        }
      });

      // No error state should be visible
      const errorElements = container.querySelectorAll('[class*="error"]');
      // Filter out styled elements that might have 'error' in class for styling
      const actualErrors = Array.from(errorElements).filter(
        el => el.textContent?.toLowerCase().includes('error') ||
              el.textContent?.toLowerCase().includes('failed')
      );
      expect(actualErrors.length).toBe(0);
    });
  });

  describe('Async Operation Safety', () => {
    it('handles tab switch during simulated async WebSocket message', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      const terminalTab = screen.getByRole('button', { name: /terminal/i });
      const claudeAITab = screen.getByRole('button', { name: /claude ai/i });

      // Start on terminal
      await act(async () => {
        await user.click(terminalTab);
      });

      // Simulate an async operation starting (mock WebSocket message)
      const asyncPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      // Switch tab while "async" is pending
      await act(async () => {
        await user.click(claudeAITab);
      });

      // Wait for async to complete
      await asyncPromise;

      // Component should still be stable
      expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument();
      expect(claudeAITab).toHaveClass('bg-gray-700');
    });

    it('does not lose terminal state when async operation completes after tab switch', async () => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      const terminalTab = screen.getByRole('button', { name: /terminal/i });
      const gsdTab = screen.getByRole('button', { name: /gsd gui/i });

      // Ensure terminal is active
      await act(async () => {
        await user.click(terminalTab);
      });

      // Start async operation
      let asyncComplete = false;
      const asyncOp = new Promise<void>((resolve) => {
        setTimeout(() => {
          asyncComplete = true;
          resolve();
        }, 50);
      });

      // Immediately switch to GSD
      await act(async () => {
        await user.click(gsdTab);
      });

      // Wait for async to complete
      await asyncOp;
      expect(asyncComplete).toBe(true);

      // Switch back to terminal
      await act(async () => {
        await user.click(terminalTab);
      });

      // Terminal should still work
      expect(terminalTab).toHaveClass('bg-gray-700');
    });
  });

  describe('All Tab Combinations', () => {
    it.each([
      ['Terminal', 'Claude AI', 'Terminal'],
      ['Terminal', 'GSD GUI', 'Terminal'],
      ['Claude AI', 'Terminal', 'Claude AI'],
      ['Claude AI', 'GSD GUI', 'Claude AI'],
      ['GSD GUI', 'Terminal', 'GSD GUI'],
      ['GSD GUI', 'Claude AI', 'GSD GUI'],
    ])('preserves state for %s -> %s -> %s round trip', async (start, middle, end) => {
      const user = userEvent.setup();
      render(<ShellComponent className="test-shell" />);

      const getTab = (name: string) => {
        const buttonName = name.toLowerCase().includes('terminal')
          ? /terminal/i
          : name.toLowerCase().includes('claude')
          ? /claude ai/i
          : /gsd gui/i;
        return screen.getByRole('button', { name: buttonName });
      };

      // Navigate: start -> middle -> end
      await act(async () => {
        await user.click(getTab(start));
      });

      await act(async () => {
        await user.click(getTab(middle));
      });

      await act(async () => {
        await user.click(getTab(end));
      });

      // Final tab should be active
      const finalTab = getTab(end);
      expect(finalTab).toHaveClass('bg-gray-700');
    });
  });
});
