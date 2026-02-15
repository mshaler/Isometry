# Phase 88: Integration & Polish - Research

**Researched:** 2026-02-15
**Domain:** System integration verification and cross-component polish
**Confidence:** HIGH

## Summary

Phase 88 is a verification and polish phase for the completed Interactive Shell (v6.0). It validates that the three Shell tabs (Terminal/Claude AI/GSD) work together seamlessly without state loss, data flow issues, or user friction. This is NOT a feature implementation phase — it's an integration checkpoint before moving to the next milestone.

The research reveals this is a **lightweight verification phase** with three focused success criteria:
1. Tab switching preserves state (no data loss)
2. Terminal output can be saved as cards via Claude AI
3. GSD phase execution triggers correctly from Terminal

**Primary recommendation:** Focus on end-to-end integration tests, state preservation verification, and cross-tab data flow smoke tests rather than building new features.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | Latest | Integration testing framework | Already established in project for testing |
| React Testing Library | Latest | Component integration testing | Standard for React component testing |
| WebSocket mocking | Manual/vitest | Mock WebSocket connections | No external library needed, simple mocks work |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xterm.js | 5.x | Terminal emulator | Already integrated in Phase 85 |
| @testing-library/user-event | Latest | Simulate user interactions | For testing tab switches, clicks |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Integration tests | E2E tests (Playwright) | Integration tests are faster, sufficient for internal state verification |
| Manual testing | Automated smoke tests | Manual testing acceptable for Phase 88 due to small scope |

**Installation:**
```bash
# Already installed - no new dependencies needed
npm run test
```

## Architecture Patterns

### Recommended Project Structure

Integration tests should live near the components they integrate:

```
src/
├── components/
│   └── notebook/
│       ├── ShellComponent.tsx
│       └── __tests__/
│           └── ShellComponent.integration.test.tsx  # NEW
├── hooks/
│   ├── useTerminal.ts
│   ├── useGSDTerminalIntegration.ts
│   └── __tests__/
│       └── shell-integration.test.ts  # NEW
└── services/
    └── claude-code/
        └── __tests__/
            └── cross-tab-integration.test.ts  # NEW
```

### Pattern 1: State Preservation Verification

**What:** Verify that switching tabs doesn't lose terminal session, Claude AI conversation, or GSD progress
**When to use:** For all tab switch scenarios (Terminal→Claude AI, Claude AI→GSD, etc.)
**Example:**

```typescript
// Source: Established React testing pattern
describe('ShellComponent - Tab Switching', () => {
  it('preserves terminal session when switching tabs', async () => {
    const { getByRole, getByText } = render(<ShellComponent />);

    // Start terminal session
    const terminalTab = getByRole('button', { name: /terminal/i });
    await userEvent.click(terminalTab);

    // Simulate terminal output
    const terminal = getTerminalInstance();
    terminal.write('some output');

    // Switch to Claude AI tab
    const claudeTab = getByRole('button', { name: /claude ai/i });
    await userEvent.click(claudeTab);

    // Switch back to terminal
    await userEvent.click(terminalTab);

    // Verify terminal output is still present
    expect(terminal.buffer.active.getLine(0)?.translateToString()).toContain('some output');
  });
});
```

### Pattern 2: Cross-Tab Data Flow

**What:** Verify that terminal output can be passed to Claude AI, and GSD commands trigger in terminal
**When to use:** For success criteria 2 and 3
**Example:**

```typescript
// Source: Integration testing best practice
describe('Cross-Tab Integration', () => {
  it('saves terminal output as card via Claude AI', async () => {
    const { getByRole, getByPlaceholderText } = render(<ShellComponent />);

    // Capture terminal output
    const terminalOutput = 'npm run test -- passed';

    // Switch to Claude AI tab
    const claudeTab = getByRole('button', { name: /claude ai/i });
    await userEvent.click(claudeTab);

    // Send command to save terminal output
    const input = getByPlaceholderText(/type a message/i);
    await userEvent.type(input, `/save-card ${terminalOutput}`);
    await userEvent.keyboard('{Enter}');

    // Verify card was created (mock check)
    expect(mockSaveCard).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining(terminalOutput)
    }));
  });
});
```

### Pattern 3: State Isolation

**What:** Each tab maintains its own state without polluting other tabs
**When to use:** Verify in integration tests that terminal PTY, Claude conversation, and GSD session are independent
**Example:**

```typescript
// Source: Component isolation testing
describe('State Isolation', () => {
  it('terminal PTY does not affect Claude AI state', async () => {
    const { getByRole } = render(<ShellComponent />);

    // Start terminal session
    const terminalTab = getByRole('button', { name: /terminal/i });
    await userEvent.click(terminalTab);
    await spawnTerminalSession();

    // Switch to Claude AI
    const claudeTab = getByRole('button', { name: /claude ai/i });
    await userEvent.click(claudeTab);

    // Verify Claude AI has fresh state (no terminal noise)
    const messages = getClaudeMessages();
    expect(messages).toHaveLength(0);
  });
});
```

### Anti-Patterns to Avoid

- **Shared state mutation:** Don't let terminal output leak into Claude AI message history
- **Missing cleanup:** Terminal PTY sessions must be disposed when component unmounts
- **Race conditions:** Tab switches during async operations (e.g., Claude streaming) should queue, not cancel
- **Hardcoded timeouts:** Use React Testing Library's `waitFor` with conditions, not fixed delays

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket testing | Custom WS server mock | Simple vitest mock with `vi.fn()` | WebSocket integration already tested in Phase 85/86/87 |
| Terminal state capture | Custom terminal buffer reader | xterm.js API (`buffer.active.getLine()`) | xterm provides full buffer API |
| Async test synchronization | Manual Promise chains | `@testing-library/react`'s `waitFor` | Handles retries, timeouts, better error messages |
| Component mounting | Manual DOM manipulation | React Testing Library's `render()` | Handles cleanup, provider wrapping |

**Key insight:** Phase 88 is verification, not new feature work. Reuse existing APIs (xterm.js, React Testing Library) rather than building custom test infrastructure.

## Common Pitfalls

### Pitfall 1: Testing Implementation Instead of Behavior

**What goes wrong:** Tests check internal state (e.g., `activeTab === 'terminal'`) instead of user-visible behavior
**Why it happens:** Easy to test component props, hard to verify visual state
**How to avoid:** Test what user sees — "terminal output is visible", not "activeTab state variable equals 'terminal'"
**Warning signs:** Tests break when refactoring without changing behavior

### Pitfall 2: Not Cleaning Up PTY Sessions

**What goes wrong:** Terminal PTY processes leak between tests, causing port conflicts and zombie processes
**Why it happens:** Terminal sessions spawn real OS processes that outlive component lifecycle
**How to avoid:** Call `dispose()` in `afterEach`, verify with `lsof` that no orphan PTYs exist
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 3: Race Conditions During Tab Switches

**What goes wrong:** User switches tabs while Claude AI is streaming a response, causing partial state corruption
**Why it happens:** Async operations (WebSocket streaming) don't cancel when tab switches
**How to avoid:**
- Terminal: Keep PTY mounted but hidden (already implemented in ShellComponent.tsx line 277-280)
- Claude AI: Continue streaming in background, don't cancel
- GSD: Queue tab switches if phase transition is in progress
**Warning signs:** Flaky tests, state corruption reports from users

### Pitfall 4: Missing Context Providers in Tests

**What goes wrong:** Components fail to render in tests because they depend on context (SQLiteContext, TerminalContext)
**Why it happens:** Tests render components in isolation without provider tree
**How to avoid:** Wrap `render()` calls with all required providers or use custom `renderWithProviders()` helper
**Warning signs:** "Cannot read property 'db' of undefined" errors in tests

### Pitfall 5: Over-Testing Internal Implementation

**What goes wrong:** Brittle tests that break on every refactor
**Why it happens:** Testing internal hooks, state variables, or component structure instead of user-facing behavior
**How to avoid:** Follow React Testing Library principle: "Test what users see, not implementation details"
**Warning signs:** Tests require updating when renaming variables or refactoring component structure

## Code Examples

Verified patterns from completed phases:

### Tab Switch Without State Loss

```typescript
// Source: Phase 85-03 xterm.js integration pattern
// ShellComponent.tsx lines 277-280
<div
  ref={terminalContainerRef}
  className={`absolute inset-0 bg-[#111827] ${activeTab === 'claude-code' ? 'visible' : 'invisible'}`}
/>
```

**Key insight:** Terminal container stays mounted with `invisible` class rather than conditional rendering. This preserves xterm.js instance and PTY session state.

### Terminal Output to Card Workflow

```typescript
// Source: Phase 94 TipTap slash commands
// slash-commands.ts - /save-card pattern
editor.commands.insertContent({
  type: 'paragraph',
  content: [{ type: 'text', text: terminalOutput }]
});

// Save to database
await db.execute(
  `INSERT INTO notebook_cards (card_type, markdown_content, node_id)
   VALUES (?, ?, ?)`,
  ['capture', editorContent, nodeId]
);
```

### GSD Trigger from Terminal

```typescript
// Source: Phase 87-02 GSD file watcher integration
// useGSDTerminalIntegration.ts lines 54-91
const processTerminalOutput = useCallback((output: string) => {
  if (!enabled || !gsdService || !sessionId) return;

  const parsed = claudeCodeParser.parseOutput(output);

  if (parsed.phase && parsed.status) {
    gsdService.updateSessionState(sessionId, {
      phase: parsed.phase,
      status: parsed.status
    });
  }
}, [enabled, gsdService, sessionId]);
```

### Integration Test Template

```typescript
// Source: Standard Vitest + React Testing Library pattern
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShellComponent } from '../ShellComponent';
import { SQLiteProvider } from '@/db/SQLiteProvider';
import { TerminalProvider } from '@/context/TerminalContext';

describe('ShellComponent Integration', () => {
  const renderShell = () => {
    return render(
      <SQLiteProvider>
        <TerminalProvider>
          <ShellComponent />
        </TerminalProvider>
      </SQLiteProvider>
    );
  };

  afterEach(() => {
    // Clean up any spawned terminal sessions
    vi.clearAllMocks();
  });

  it('preserves state when switching between tabs', async () => {
    const { getByRole } = renderShell();

    // Interact with Terminal tab
    const terminalTab = getByRole('button', { name: /terminal/i });
    await userEvent.click(terminalTab);

    // Switch to Claude AI
    const claudeTab = getByRole('button', { name: /claude ai/i });
    await userEvent.click(claudeTab);

    // Switch back to Terminal
    await userEvent.click(terminalTab);

    // Verify terminal is still connected
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conditional rendering of tabs | Mounted + hidden with CSS | Phase 85 (2026-02-14) | No state loss on tab switch |
| Manual WebSocket message handling | Dispatcher pattern with typed methods | Phase 85-86 | Type-safe, easier to test |
| Mock data in GSD UI | Live file sync with conflict detection | Phase 87 (2026-02-15) | Real-time updates from .planning/ |
| Separate terminal instances per tab | Single PTY session, tab just changes visibility | Phase 85 | Consistent session across tabs |

**Deprecated/outdated:**
- **Direct WebSocket send/receive:** Use dispatcher methods (spawnTerminal, sendMessage, etc.)
- **Unmounting tabs on switch:** Keep mounted, toggle visibility
- **Global state for tab selection:** Local useState in ShellComponent is sufficient

## Open Questions

1. **Save-as-Card UX Flow**
   - What we know: TipTap has slash commands, Claude AI has chat interface, terminal has output buffer
   - What's unclear: How does user invoke "save terminal output as card"? Is it a button in Terminal tab? A Claude AI slash command? A context menu?
   - Recommendation: Defer UX details to planning phase — research phase should note this as "needs user flow definition" not prescribe implementation

2. **GSD Trigger Mechanism**
   - What we know: GSD commands can be sent via `gsdSlashCommands.executeCommand()`, terminal output is parsed by `claudeCodeParser`
   - What's unclear: Does "GSD phase execution triggers correctly in Terminal tab" mean (a) user types `/gsd:new-milestone` in Terminal, or (b) Terminal tab has a button that opens GSD GUI?
   - Recommendation: Success criteria is ambiguous — clarify in planning whether this is command-line trigger or UI button trigger

3. **State Persistence Across Sessions**
   - What we know: ShellComponent uses local useState, no persistence layer currently
   - What's unclear: Should tab state (which tab was active) persist across app restarts?
   - Recommendation: Phase 88 scope is session-only (no cross-session persistence). Note as potential future enhancement.

## Sources

### Primary (HIGH confidence)

- **ShellComponent.tsx** (src/components/notebook/ShellComponent.tsx) - Tab structure, state management, terminal mounting pattern
- **Phase 85 SUMMARY docs** (.planning/phases/85-backend-terminal/85-0[1-5]-SUMMARY.md) - Terminal integration patterns
- **Phase 86 SUMMARY docs** (.planning/phases/86-claude-ai-integration/86-0[1-4]-SUMMARY.md) - Claude AI chat implementation
- **Phase 87 SUMMARY docs** (.planning/phases/87-gsd-file-synchronization/87-0[1-5]-SUMMARY.md) - GSD file sync and conflict resolution

### Secondary (MEDIUM confidence)

- **useGSDTerminalIntegration.ts** (src/hooks/useGSDTerminalIntegration.ts) - Terminal output parsing patterns
- **ClaudeAIChat.tsx** (src/components/claude-ai/ClaudeAIChat.tsx) - Chat interface and message handling
- **GSDInterface.tsx** (src/components/gsd/GSDInterface.tsx) - GSD UI tab implementation

### Tertiary (LOW confidence)

- General React Testing Library documentation (not project-specific)
- Vitest integration testing patterns (standard practices, not Isometry-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, using existing Vitest + RTL
- Architecture: HIGH - All three tabs fully implemented in Phases 85-87
- Pitfalls: HIGH - Based on actual implementation patterns from completed phases

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days for stable verification phase)

---

## Key Findings for Planner

### Critical Context

Phase 88 is **verification-only, not feature implementation**. All three Shell tabs are complete:
- **Terminal (Phase 85):** PTY spawn, xterm.js integration, mode switching
- **Claude AI (Phase 86):** Chat interface, MCP tools, project context
- **GSD (Phase 87):** File sync, conflict resolution, progress display

### Success Criteria Interpretation

1. **"User can switch between tabs without state loss"**
   - Terminal: Already handled via mounted-but-hidden pattern (ShellComponent.tsx line 277)
   - Claude AI: Verify conversation history persists when tab switches
   - GSD: Verify progress/phase state survives tab switches
   - **Test approach:** Integration tests for each tab pair (Terminal↔Claude, Claude↔GSD, GSD↔Terminal)

2. **"Terminal output can be saved as cards via Claude AI chat"**
   - **Ambiguity:** UX flow not defined. Is this (a) user copies output manually, or (b) integrated save button?
   - **Recommendation:** Minimal implementation — verify that terminal output is accessible to Claude AI tab (shared context), defer UX polish
   - **Test approach:** Smoke test that terminal output state is readable from Claude AI component

3. **"GSD phase execution triggers correctly in Terminal tab"**
   - **Ambiguity:** Does this mean `/gsd:*` commands work in Terminal, or GSD GUI can trigger terminal commands?
   - **Recommendation:** Verify `useGSDTerminalIntegration` hook correctly parses terminal output and updates GSD state
   - **Test approach:** Mock terminal output, verify GSD service receives phase updates

### Scope Boundaries

**IN SCOPE:**
- State preservation verification (no data loss on tab switch)
- Cross-tab data flow smoke tests
- Integration test coverage for success criteria
- Bug fixes for state leaks or race conditions
- Polish for tab switch transitions (if visual glitches exist)

**OUT OF SCOPE:**
- New features (save-as-card button, GSD command palette, etc.)
- Performance optimization (unless state loss is caused by performance issue)
- Extensive E2E testing (integration tests are sufficient)
- Cross-session persistence (localStorage, IndexedDB)
- UI redesign or visual polish beyond fixing glitches

### Estimated Effort

Based on completed phase metrics (Phase 85-87 averaged 4-5 min per plan):
- **Integration tests:** 1 plan (~5 min) - 3 test files covering success criteria
- **State preservation fixes:** 0-1 plan (~5 min) - Only if bugs found during testing
- **Cross-tab data flow:** 1 plan (~5 min) - Verify terminal→Claude and GSD↔Terminal
- **Polish & verification:** 1 plan (~5 min) - Manual smoke tests, edge case fixes

**Total estimate:** 2-4 plans, 10-20 minutes if no major issues found.

### Planning Recommendations

1. **Start with integration tests** — Write failing tests for success criteria first (TDD)
2. **Manual verification checklist** — Create step-by-step user flow checklist for QA
3. **Defer ambiguous features** — Don't implement undefined UX (save-as-card button) without user decision
4. **Focus on regression prevention** — Tests should catch future tab switch bugs
5. **Keep scope tight** — This is a verification checkpoint, not a feature sprint
