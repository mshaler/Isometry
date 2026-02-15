---
status: diagnosed
trigger: "Debug the terminal:error being logged in the Shell component. The error occurs when trying to use the Terminal tab."
created: 2026-02-15T10:00:00Z
updated: 2026-02-15T10:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - System PTY/tty limit exhausted
test: Checked kern.tty.ptmx_max vs actual tty count
expecting: tty count exceeds limit
next_action: User needs to close terminal processes or increase limit with sudo

## Symptoms

expected: Terminal tab should work and show a functional terminal
actual: terminal:error is being logged when trying to use the Terminal tab
errors: |
  dev-logger.ts:64 Terminal error
  Object
  error@dev-logger.ts:64
  (anonymous)@useTerminal.ts:106
  handleTerminalMessage@claudeCodeWebSocketDispatcher.ts:792
  handleServerMessage@claudeCodeWebSocketDispatcher.ts:357
  ws.onmessage@claudeCodeWebSocketDispatcher.ts:307
reproduction: Open Terminal tab in Shell component
started: Unknown

## Eliminated

- hypothesis: Server not running on port 8080
  evidence: lsof showed node process 62107 listening on port 8080 with established connections
  timestamp: 2026-02-15T10:10:00Z

- hypothesis: node-pty package not installed
  evidence: npm ls showed node-pty@1.1.0 installed
  timestamp: 2026-02-15T10:12:00Z

- hypothesis: node-pty native bindings need rebuild
  evidence: npm rebuild node-pty completed but error persisted
  timestamp: 2026-02-15T10:15:00Z

## Evidence

- timestamp: 2026-02-15T10:10:00Z
  checked: Port 8080 server status
  found: ClaudeCodeServer running (node process 62107) with WebSocket connections
  implication: Server infrastructure is working

- timestamp: 2026-02-15T10:15:00Z
  checked: node-pty spawn test
  found: Error "posix_spawnp failed." when trying to spawn PTY
  implication: PTY creation is failing at OS level

- timestamp: 2026-02-15T10:20:00Z
  checked: spawn-helper binary execution
  found: Exit code 139 (segfault) when running spawn-helper directly
  implication: Native binary failing - likely resource exhaustion

- timestamp: 2026-02-15T10:25:00Z
  checked: System tty limits
  found: kern.tty.ptmx_max=511, but 527 tty devices exist in /dev/ttys*
  implication: System has exceeded PTY limit - cannot create new terminals

- timestamp: 2026-02-15T10:26:00Z
  checked: Terminal process count
  found: ~271 terminal-related processes running (zsh, bash, Terminal, iTerm)
  implication: Many terminal processes consuming PTY resources

## Resolution

root_cause: |
  System PTY/tty limit exhausted. The macOS kern.tty.ptmx_max limit is 511,
  but there are 527 tty devices in /dev/ttys*. node-pty spawn fails with
  "posix_spawnp failed." because the OS cannot allocate a new PTY.

  This is NOT a code bug - it's a system resource exhaustion issue.

fix: |
  Option 1 (temporary): Run `sudo sysctl -w kern.tty.ptmx_max=999` to increase limit
  Option 2 (recommended): Close unused terminal windows/tabs across all apps
  Option 3: Reboot to clear all zombie PTY allocations

verification: |
  After fix, test with:
  node -e "const pty = require('node-pty'); const p = pty.spawn('/bin/zsh', [], { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd() }); console.log('PTY spawned with pid:', p.pid); p.kill();"

files_changed: []
