# Phase 43: Shell Integration Completion - Research

**Researched:** 2026-02-10
**Domain:** WebSocket Terminal Integration with Claude Code CLI
**Confidence:** HIGH

## Summary

Phase 43 completes the Shell pane from 35% to functional by integrating real Claude Code CLI via WebSocket, implementing interactive terminal with xterm.js, and connecting the GSD command palette to actual command execution. The codebase already has substantial foundation: xterm.js v5.5.0 + addons installed, WebSocket infrastructure with claudeCodeServer.ts/claudeCodeWebSocketDispatcher.ts, command history utilities, and GSD slash command DSL. The primary work is connecting existing pieces and implementing production-ready error handling, not building from scratch.

**Key finding:** Existing WebSocket architecture follows industry patterns with exponential backoff already implemented (ReconnectionService.ts). Terminal foundation exists (Terminal.tsx, useTerminal.ts) but needs completion. GSD command palette (CommandPalette.tsx) and slash commands (gsdSlashCommands.ts) are operational but need live execution wiring.

**Primary recommendation:** Focus on production-ready connection management (heartbeats, state restoration), terminal UX polish (auto-scroll, copy/paste), and GSD command execution flow rather than rebuilding existing infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claude Code Output:**
- Auto-scroll follows output until user scrolls up, then holds position (resume when scrolling to bottom)
- Activity indicated by both animated cursor at current position AND status text in toolbar/status bar
- Task completion shown via toast notification (brief overlay)
- Tool calls (file reads, edits, bash commands) displayed collapsed by default — click to expand details

**Command Builder UX:**
- GSD commands invoked via both slash prefix (`/gsd:`) inline AND Cmd+K keyboard shortcut for full palette
- Command descriptions shown on hover/focus, not always visible
- Command history: Up/Down arrows for recent commands, Ctrl+R for reverse search through history

**Error Handling:**
- WebSocket connection failures: auto-retry with exponential backoff, show reconnecting status immediately
- Command timeout/failure: toast notification plus error details inline in terminal
- Failed commands: load into input for editing before retry (not one-click retry)

### Claude's Discretion

- Autocomplete suggestion count (based on available space)
- Rate limit (429) handling — queue/retry logic implementation details
- ANSI color handling and markdown rendering in output
- Specific timeout durations and retry intervals
- Terminal font, colors, and scrollback buffer size

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | ^5.5.0 | Terminal emulator core | Modern industry standard, VT100 compatible, maintained by VS Code team |
| @xterm/addon-fit | ^0.10.0 | Responsive terminal sizing | Essential for auto-fitting terminal to container |
| @xterm/addon-web-links | ^0.11.0 | URL detection in terminal | Standard UX for clickable URLs |
| ws | ^8.19.0 | WebSocket server (Node.js) | Most popular WebSocket library, 4M+ weekly downloads |
| node-pty | ^1.1.0 | Pseudo-terminal for shell spawning | Native process spawning with PTY support |
| exponential-backoff | ^3.1.3 | Retry logic with backoff | Already installed, prevents custom implementation bugs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-search | latest | Terminal text search | If Ctrl+F search needed (optional enhancement) |
| ansi-to-html | latest | Convert ANSI to HTML | If rendering collapsed tool calls as HTML |
| cmdk | latest | Command palette UI | If upgrading CommandPalette.tsx (already has custom implementation) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws | socket.io | socket.io adds overhead; ws is lightweight and sufficient |
| Custom reconnection | Built-in ws reconnect | Already have ReconnectionService.ts with jitter |
| node-pty | child_process.spawn | node-pty provides proper PTY; spawn lacks terminal features |

**Installation:**
```bash
# All dependencies already installed in package.json
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/claude-code/
│   ├── claudeCodeServer.ts              # Node.js WebSocket server (existing)
│   ├── claudeCodeWebSocketDispatcher.ts # Browser WebSocket client (existing)
│   ├── claudeCodeParser.ts              # Parse Claude output (existing)
│   └── gsdSlashCommands.ts              # GSD command DSL (existing)
├── components/
│   ├── shell/Terminal.tsx               # xterm.js wrapper (existing, needs completion)
│   └── gsd/CommandPalette.tsx           # Command palette UI (existing)
├── hooks/
│   ├── useTerminal.ts                   # Terminal state management (existing)
│   └── useGSDTerminalIntegration.ts     # GSD + terminal bridge (existing)
├── utils/
│   ├── commandHistory.ts                # History utilities (existing)
│   └── webview/reconnection-service.ts  # Exponential backoff (existing)
```

### Pattern 1: WebSocket Connection with Exponential Backoff
**What:** Auto-reconnect WebSocket with exponential backoff + jitter to prevent thundering herds
**When to use:** All WebSocket connections requiring resilience
**Example:**
```typescript
// Source: Existing ReconnectionService.ts + industry pattern
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectionService: ReconnectionService;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    this.reconnectionService = new ReconnectionService({
      enabled: true,
      maxAttempts: 10,
      baseDelay: 1000,    // 1s initial
      maxDelay: 30000,    // 30s max
      backoffFactor: 2,   // exponential
      jitterRange: 0.1    // 10% randomization
    });
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.serverUrl);
      this.setupEventHandlers();
      this.startHeartbeat(); // Application-level keepalive
      this.reconnectionService.reset();
    } catch (error) {
      await this.reconnectionService.attemptReconnection(() => this.connect());
    }
  }

  private startHeartbeat(): void {
    // Send ping every 30s to detect silent failures
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private setupEventHandlers(): void {
    this.ws!.onclose = () => {
      this.stopHeartbeat();
      this.reconnectionService.attemptReconnection(() => this.connect());
    };
  }
}
```

### Pattern 2: Terminal Auto-Scroll with User Scroll Detection
**What:** Auto-scroll to bottom on new output UNLESS user has scrolled up (sticky scroll)
**When to use:** All terminal output scenarios
**Example:**
```typescript
// Source: xterm.js best practices + user requirements
import { Terminal } from '@xterm/xterm';

class TerminalManager {
  private terminal: Terminal;
  private isUserScrolledUp = false;

  constructor(terminal: Terminal) {
    this.terminal = terminal;

    // Detect user scroll
    terminal.onScroll(() => {
      const { buffer, rows } = terminal;
      const scrollPosition = buffer.active.viewportY;
      const totalRows = buffer.active.length;

      // User scrolled up if not at bottom
      this.isUserScrolledUp = scrollPosition < (totalRows - rows);
    });
  }

  writeOutput(data: string): void {
    this.terminal.write(data);

    // Only auto-scroll if user hasn't scrolled up
    if (!this.isUserScrolledUp) {
      this.terminal.scrollToBottom();
    }
  }

  // Resume auto-scroll when user scrolls to bottom manually
  private checkResumeAutoScroll(): void {
    const { buffer, rows } = this.terminal;
    const scrollPosition = buffer.active.viewportY;
    const totalRows = buffer.active.length;

    if (scrollPosition >= (totalRows - rows)) {
      this.isUserScrolledUp = false; // Resume auto-scroll
    }
  }
}
```

### Pattern 3: GSD Command Execution Flow
**What:** Slash command → WebSocket dispatch → Terminal output → Status update
**When to use:** All GSD command executions
**Example:**
```typescript
// Source: Existing gsdSlashCommands.ts + WebSocketDispatcher pattern
async function executeGSDCommand(command: string, args: string[]): Promise<void> {
  const dispatcher = await getClaudeCodeDispatcher();

  // 1. Show immediate status
  setStatus({ phase: 'executing', message: `Running ${command}...` });

  try {
    // 2. Dispatch to Claude Code via WebSocket
    const execution = await dispatcher.executeAsync({
      command: `claude ${command}`,
      args,
      cwd: currentDirectory
    });

    // 3. Stream output to terminal
    dispatcher.onOutput((chunk, execId) => {
      if (execId === execution.id) {
        terminal.writeOutput(chunk);
      }
    });

    // 4. Handle completion
    dispatcher.onComplete((execId) => {
      if (execId === execution.id) {
        showToast({ type: 'success', message: `${command} completed` });
        setStatus({ phase: 'idle' });
      }
    });

  } catch (error) {
    // 5. Error handling per user requirements
    showToast({ type: 'error', message: error.message });
    terminal.writeOutput(`\x1b[31mError: ${error.message}\x1b[0m\n`);
    // Load failed command into input for retry
    setCommandInput(`${command} ${args.join(' ')}`);
  }
}
```

### Pattern 4: Command History with Ctrl+R Reverse Search
**What:** Up/Down arrow navigation + Ctrl+R fuzzy search through history
**When to use:** Terminal command input
**Example:**
```typescript
// Source: Terminal best practices + existing commandHistory.ts
class CommandHistoryManager {
  private history: string[] = [];
  private currentIndex = -1;
  private searchMode = false;
  private searchQuery = '';

  onKeyPress(key: string, modifiers: { ctrl?: boolean }): string | null {
    if (modifiers.ctrl && key === 'r') {
      // Enter reverse search mode
      this.searchMode = true;
      this.searchQuery = '';
      return this.showSearchPrompt();
    }

    if (this.searchMode) {
      return this.handleSearchMode(key);
    }

    // Standard arrow navigation
    if (key === 'ArrowUp') {
      return this.navigateHistory('up');
    }
    if (key === 'ArrowDown') {
      return this.navigateHistory('down');
    }

    return null;
  }

  private handleSearchMode(key: string): string | null {
    if (key === 'Escape') {
      this.exitSearchMode();
      return null;
    }

    this.searchQuery += key;
    // Fuzzy search through history
    const matches = this.history.filter(cmd =>
      cmd.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    return matches[0] || null;
  }
}
```

### Anti-Patterns to Avoid
- **No heartbeat mechanism:** Silent failures won't be detected; use application-level pings
- **Synchronous reconnection:** Blocks UI; always async with exponential backoff
- **Missing ANSI escape handling:** Raw escape codes break terminal; use xterm.js built-in parser
- **Infinite scroll buffer:** Memory leak on long sessions; cap scrollback at 1000-2000 lines

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal emulation | Custom ANSI parser | @xterm/xterm | Handles cursor control, colors, box drawing, selection edge cases |
| WebSocket reconnection | Custom retry logic | exponential-backoff + ReconnectionService | Prevents thundering herds, tested jitter implementation |
| PTY spawning | child_process + manual tty | node-pty | Proper PTY allocation, handles terminal resize, line discipline |
| Command palette | Custom fuzzy search | cmdk or existing CommandPalette | Keyboard navigation, ARIA, performance optimization |
| ANSI to HTML | Regex parsing | ansi-to-html | Handles nested codes, 256-color palettes, edge cases |

**Key insight:** Terminal emulation has decades of edge cases (cursor positioning, alternate screen buffer, SGR codes). Using xterm.js saves months of debugging obscure VT100 sequences.

## Common Pitfalls

### Pitfall 1: WebSocket Connection Without Heartbeat
**What goes wrong:** Connection appears open but is actually dead (silent failure)
**Why it happens:** TCP keepalive insufficient; NAT/firewalls drop idle connections
**How to avoid:** Implement application-level ping/pong every 30s, reconnect on missed pong
**Warning signs:** Users report "terminal frozen" but WebSocket.readyState === OPEN

### Pitfall 2: Auto-Scroll Race Condition
**What goes wrong:** Terminal scrolls to bottom mid-user-scroll, jarring UX
**Why it happens:** Output arrives while user actively scrolling
**How to avoid:** Check scroll position before auto-scroll, debounce scroll detection
**Warning signs:** Users complain terminal "jumps around" or "won't let me scroll"

### Pitfall 3: Command History Memory Leak
**What goes wrong:** localStorage quota exceeded or memory growth over time
**Why it happens:** Unbounded history array, storing full output in history
**How to avoid:** Cap history at 1000 entries, truncate large outputs, prune old entries
**Warning signs:** localStorage errors, slow history search, increasing memory usage

### Pitfall 4: ANSI Escape Code Injection
**What goes wrong:** Malicious output breaks terminal or leaks data
**Why it happens:** Untrusted command output contains control sequences
**How to avoid:** Let xterm.js handle all ANSI parsing (it's sandboxed), don't inject raw HTML
**Warning signs:** Terminal displays garbled text, cursor disappears, colors broken

### Pitfall 5: GSD Command Timeout Handling
**What goes wrong:** Claude Code hangs indefinitely, UI stuck in "executing" state
**Why it happens:** No timeout on command execution, no cancel mechanism
**How to avoid:** Set 5-minute timeout, provide Cancel button, handle WebSocket close during execution
**Warning signs:** "Cancel" button doesn't work, terminal unresponsive after error

## Code Examples

### WebSocket Terminal Integration (Full Pattern)
```typescript
// Source: Industry best practices + existing claudeCodeWebSocketDispatcher.ts
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebSocketClaudeCodeDispatcher } from './claudeCodeWebSocketDispatcher';

class TerminalWithWebSocket {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private dispatcher: WebSocketClaudeCodeDispatcher;
  private currentExecution?: string;

  async initialize(containerId: string): Promise<void> {
    // 1. Create terminal
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 2000, // Cap at 2000 lines
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff'
      }
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const container = document.getElementById(containerId);
    this.terminal.open(container!);
    this.fitAddon.fit();

    // 2. Connect WebSocket with auto-reconnect
    this.dispatcher = new WebSocketClaudeCodeDispatcher('ws://localhost:8080', {
      onOutput: (chunk, execId) => {
        if (execId === this.currentExecution) {
          this.terminal.write(chunk);
        }
      },
      onError: (error, execId) => {
        this.terminal.write(`\x1b[31mError: ${error}\x1b[0m\r\n`);
      },
      onComplete: (execId) => {
        this.terminal.write('\r\n$ '); // Show prompt
        this.currentExecution = undefined;
      }
    });

    await this.dispatcher.connect();

    // 3. Handle terminal input
    this.terminal.onData((data) => {
      if (data === '\r') { // Enter key
        this.handleCommandSubmit();
      } else {
        this.terminal.write(data);
      }
    });

    // 4. Handle resize
    new ResizeObserver(() => this.fitAddon.fit()).observe(container!);
  }

  private async handleCommandSubmit(): Promise<void> {
    const command = this.getCurrentLine();
    this.terminal.write('\r\n');

    try {
      const execution = await this.dispatcher.executeAsync({
        command: command,
        args: [],
        cwd: process.cwd()
      });
      this.currentExecution = execution.id;
    } catch (error) {
      this.terminal.write(`\x1b[31mFailed to execute: ${error.message}\x1b[0m\r\n`);
    }
  }
}
```

### GSD Command Palette with Cmd+K
```typescript
// Source: react-cmdk patterns + existing CommandPalette.tsx
import { useEffect, useState, useCallback } from 'react';

function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const executeCommand = useCallback(async (command: string) => {
    setIsOpen(false);

    // Dispatch to GSD slash command processor
    await gsdSlashCommands.executeCommand(command, [], {
      projectPath: currentProjectPath
    });
  }, []);

  return { isOpen, setIsOpen, executeCommand };
}
```

### Collapsed Tool Calls with Click-to-Expand
```typescript
// Source: User requirements + terminal output patterns
interface ToolCall {
  type: 'read' | 'edit' | 'bash';
  path?: string;
  command?: string;
  output?: string;
  collapsed: boolean;
}

function ToolCallRenderer({ toolCall }: { toolCall: ToolCall }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="tool-call border-l-2 border-blue-500 pl-2 my-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
      >
        <ChevronRight className={collapsed ? '' : 'rotate-90'} size={16} />
        <span className="font-mono text-sm">
          {toolCall.type === 'read' && `Read ${toolCall.path}`}
          {toolCall.type === 'edit' && `Edit ${toolCall.path}`}
          {toolCall.type === 'bash' && `$ ${toolCall.command}`}
        </span>
      </button>

      {!collapsed && (
        <pre className="mt-1 text-xs text-gray-400 whitespace-pre-wrap">
          {toolCall.output}
        </pre>
      )}
    </div>
  );
}
```

### Command History with localStorage Persistence
```typescript
// Source: Existing commandHistory.ts enhanced with persistence
import { loadHistory, saveHistory, compressHistory } from './commandHistory';

class PersistentCommandHistory {
  private entries: HistoryEntry[] = [];
  private currentIndex = -1;
  private saveDebounceTimer?: NodeJS.Timeout;

  constructor() {
    this.entries = loadHistory(); // Load from localStorage
  }

  addEntry(command: string, type: CommandType): void {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      command,
      type,
      timestamp: new Date(),
      cwd: process.cwd()
    };

    this.entries.unshift(entry); // Add to front

    // Compress duplicates and cap at 1000
    this.entries = compressHistory(this.entries).slice(0, 1000);

    // Debounced save to localStorage
    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      saveHistory(this.entries);
    }, 1000);
  }

  navigate(direction: 'up' | 'down'): string | null {
    if (direction === 'up') {
      this.currentIndex = Math.min(this.currentIndex + 1, this.entries.length - 1);
    } else {
      this.currentIndex = Math.max(this.currentIndex - 1, -1);
    }

    return this.currentIndex >= 0 ? this.entries[this.currentIndex].command : null;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates | WebSocket streaming | 2020+ | Real-time output without latency |
| Manual reconnection | Exponential backoff with jitter | 2022+ | Prevents thundering herds |
| TCP keepalive only | Application-level heartbeat | 2023+ | Detects silent failures |
| Fixed scroll buffer | Capped + virtual scrolling | 2024+ | Prevents memory leaks |
| @xterm/xterm v4 | @xterm/xterm v5 | Dec 2023 | Better performance, TypeScript types |

**Deprecated/outdated:**
- **socket.io**: Overhead unnecessary for simple WebSocket needs; ws library sufficient
- **Custom ANSI parsers**: xterm.js handles all escape codes correctly
- **Infinite retry loops**: Modern approach uses capped exponential backoff (10 attempts max)

## Open Questions

1. **Claude Code CLI Output Format**
   - What we know: Outputs via stdout/stderr with ANSI codes
   - What's unclear: Specific format for tool calls (JSON? Markdown? Plain text?)
   - Recommendation: Parse as plain text initially, enhance with structured parsing if available

2. **Rate Limit (429) Handling Strategy**
   - What we know: Claude Code may hit rate limits
   - What's unclear: Does CLI handle retry internally or should UI handle it?
   - Recommendation: Implement UI-side queue with exponential backoff, show "Rate limited, retrying..." status

3. **Terminal Copy/Paste Keyboard Shortcuts**
   - What we know: User requires Cmd+C/Cmd+V support
   - What's unclear: Conflict with Ctrl+C (SIGINT) in terminal
   - Recommendation: Use selection-aware logic (Cmd+C copies if text selected, otherwise sends SIGINT)

4. **GSD Command Timeout Duration**
   - What we know: Need timeout to prevent hung commands
   - What's unclear: Appropriate timeout for different command types
   - Recommendation: 5 minutes default, configurable per command type (quick commands 30s, complex workflows 10m)

## Sources

### Primary (HIGH confidence)
- Isometry codebase: src/services/claude-code/*, src/components/shell/*, src/hooks/useTerminal.ts, src/utils/commandHistory.ts, src/utils/webview/reconnection-service.ts
- Phase 3 Shell Integration Research: .planning/phases/03-shell-integration/03-RESEARCH.md
- [How to Handle WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view) - Recent 2026 best practices
- [Building a Browser-based Terminal using Docker and XtermJS](https://www.presidio.com/technical-blog/building-a-browser-based-terminal-using-docker-and-xtermjs/) - Production patterns

### Secondary (MEDIUM confidence)
- [xterm.js Security Guide](https://xtermjs.org/docs/guides/security/) - Official security considerations
- [Web Terminal with Xterm.JS, node-pty and web sockets](https://ashishpoudel.substack.com/p/web-terminal-with-xtermjs-node-pty) - Integration patterns
- [react-cmdk](https://react-cmdk.com/) - Command palette best practices
- [Claude Code Web Interface](https://github.com/vultuk/claude-code-web) - WebSocket integration example

### Tertiary (LOW confidence)
- [ANSI escape codes terminal output parsing](https://github.com/jonm/term2md) - Markdown rendering approaches
- [JavaScript Scroll Detection](https://copyprogramming.com/howto/detect-if-user-is-scrolling) - Auto-scroll patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, production-proven
- Architecture patterns: HIGH - Existing codebase demonstrates patterns, verified with 2026 sources
- WebSocket reconnection: HIGH - ReconnectionService.ts exists, aligns with industry best practices
- Terminal integration: HIGH - xterm.js patterns well-documented, existing useTerminal.ts foundation
- Claude Code CLI specifics: MEDIUM - Some assumptions about output format need validation

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days for stable infrastructure patterns)
**Next research needed:** Phase 44+ requirements (if any extend Shell functionality beyond v4.2 scope)
