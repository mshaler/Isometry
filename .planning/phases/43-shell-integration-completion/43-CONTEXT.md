# Phase 43: Shell Integration Completion - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete Shell pane from 35% to functional with real Claude Code integration and interactive terminal. This includes WebSocket connection to Claude Code, xterm.js terminal, GSD command palette, and command history. Creating new AI capabilities or expanding shell to handle non-Claude Code operations are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Claude Code Output
- Auto-scroll follows output until user scrolls up, then holds position (resume when scrolling to bottom)
- Activity indicated by both animated cursor at current position AND status text in toolbar/status bar
- Task completion shown via toast notification (brief overlay)
- Tool calls (file reads, edits, bash commands) displayed collapsed by default — click to expand details

### Command Builder UX
- GSD commands invoked via both slash prefix (`/gsd:`) inline AND Cmd+K keyboard shortcut for full palette
- Command descriptions shown on hover/focus, not always visible
- Command history: Up/Down arrows for recent commands, Ctrl+R for reverse search through history

### Error Handling
- WebSocket connection failures: auto-retry with exponential backoff, show reconnecting status immediately
- Command timeout/failure: toast notification plus error details inline in terminal
- Failed commands: load into input for editing before retry (not one-click retry)

### Claude's Discretion
- Autocomplete suggestion count (based on available space)
- Rate limit (429) handling — queue/retry logic implementation details
- ANSI color handling and markdown rendering in output
- Specific timeout durations and retry intervals
- Terminal font, colors, and scrollback buffer size

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches for terminal UX.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-shell-integration-completion*
*Context gathered: 2026-02-10*
