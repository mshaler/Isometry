---
phase: 86-claude-ai-integration
plan: 04
subsystem: claude-code
tags: [terminal-mode, auto-spawn, ui-indicator]

# Dependency graph
requires:
  - Terminal infrastructure (86-03)
provides:
  - Claude CLI auto-spawns on mode switch
  - Clear mode indication in Terminal UI
  - Graceful fallback if claude CLI missing
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [command-detection, mode-switching, fallback-handling]

key-files:
  created: []
  modified:
    - src/services/terminal/terminalPTYServer.ts
    - src/components/shell/Terminal.tsx
    - src/hooks/system/useTerminal.ts

key-decisions:
  - "Auto-spawn claude CLI with --continue flag for conversation persistence"
  - "Fallback to shell mode with installation instructions if claude CLI missing"
  - "Mode indicator with animation in header, color-coded badge in footer"
  - "Server-side mode switch confirmation via onTerminalModeSwitched callback"

patterns-established:
  - "commandExists() helper for checking CLI availability"
  - "Mode-specific spawn logic in both spawnSession and handleModeSwitch"
  - "Optimistic UI update with server confirmation"

# Metrics
duration: ~5 min
completed: 2026-02-15
---

# Phase 86 Plan 04: Claude Code Auto-Spawn Summary

**Auto-spawn Claude CLI when switching to Claude Code mode**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-02-15
- **Completed:** 2026-02-15
- **Tasks:** 4 automated (all complete)
- **Files created:** 0
- **Files modified:** 3

## Accomplishments

- terminalPTYServer.ts: Auto-spawn claude CLI in claude-code mode with fallback
- Terminal.tsx: Enhanced mode indicator UI with animation and color coding
- useTerminal.ts: Mode-switched callback handler for server confirmation

## Files Modified

### src/services/terminal/terminalPTYServer.ts

- Added `commandExists()` helper to check if CLI is available
- Updated `spawnSession()` to spawn `claude --continue` for claude-code mode
- Updated `handleModeSwitch()` with same auto-spawn logic
- Added fallback message if claude CLI not found with installation instructions

### src/components/shell/Terminal.tsx

- Enhanced mode toggle button with icon animation
- Added mode-specific hint text ("AI-assisted mode" vs "Standard terminal")
- Updated footer with color-coded mode badge

### src/hooks/system/useTerminal.ts

- Added `handleTerminalModeSwitched` callback handler
- Registered callback with dispatcher
- Writes mode switch confirmation to terminal

## Mode Switching Flow

```
User clicks mode toggle
        ↓
useTerminal.switchMode()
        ↓
dispatcher.switchTerminalMode()
        ↓
terminalPTYServer.handleModeSwitch()
        ↓
Check if claude CLI exists (commandExists)
        ↓
   ┌────┴────┐
   ↓         ↓
claude    fallback
found     to shell
   ↓         ↓
spawn     show message
claude    spawn shell
--continue
   ↓         ↓
   └────┬────┘
        ↓
Send terminal:mode-switched
        ↓
useTerminal.handleTerminalModeSwitched()
        ↓
Update UI state + confirmation message
```

## Deviations from Plan

- None - implementation matched plan exactly

## Issues Encountered

- None

## Testing Points

1. Click mode toggle to switch to Claude Code mode
2. Verify claude CLI spawns automatically (if installed)
3. If claude CLI not installed, verify fallback message appears
4. Click mode toggle to switch back to Shell mode
5. Verify shell spawns correctly
6. Verify mode indicator updates in header and footer

## Success Criteria Met

- CLAI-15: Claude Code mode auto-spawns claude CLI
- CLAI-16: Mode toggle works bidirectionally
- CLAI-17: Graceful fallback for missing CLI
- CLAI-18: Clear mode indication in UI

---
*Phase: 86-claude-ai-integration*
*Status: COMPLETE*
