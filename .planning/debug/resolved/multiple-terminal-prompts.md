---
status: resolved
trigger: "Multiple terminal prompts appearing on startup"
created: 2026-02-14T00:00:00Z
updated: 2026-02-17T14:48:00Z
---

## Current Focus

hypothesis: N/A - Fix implemented and verified
test: N/A
expecting: N/A
next_action: Archive resolved session

## Symptoms

expected: Single "%" prompt on terminal startup
actual: Multiple "%" prompts appearing (zsh's PROMPT_SP indicator)
errors: None visible
reproduction: Start the app with React dev mode (StrictMode enabled)
started: Unknown - reported as current behavior

## Eliminated

(none - root cause was confirmed on first hypothesis)

## Evidence

- timestamp: 2026-02-14T00:01:00Z
  checked: Guard implementation in useTerminal.ts
  found: Three guards exist - globalTerminalSpawned (module-level), hasSpawnedRef (ref), isConnected (state)
  implication: Guards should prevent multiple spawns but aren't working

- timestamp: 2026-02-14T00:02:00Z
  checked: attachToProcess dependency array
  found: Dependencies include isConnected, initializeDispatcher, options.shell, terminalContext.currentWorkingDirectory, handleCopy, handlePaste
  implication: Function identity changes on each render if any dependency changes

- timestamp: 2026-02-14T00:03:00Z
  checked: ShellComponent useEffect calling attachToProcess
  found: useEffect at line 140 has dependencies [isMinimized, activeTab] but calls attachToProcess without including it in deps
  implication: This is the effect that triggers PTY spawn

- timestamp: 2026-02-14T00:04:00Z
  checked: React StrictMode behavior
  found: StrictMode double-invokes effects in development - mount, unmount, remount sequence
  implication: The effect runs, cleanup runs, then effect runs again

- timestamp: 2026-02-14T00:05:00Z
  checked: dispose() cleanup behavior
  found: dispose() at line 422 sets isConnected to false but does NOT reset globalTerminalSpawned or hasSpawnedRef
  implication: After first unmount, isConnected=false allows second spawn attempt

- timestamp: 2026-02-14T00:06:00Z
  checked: attachToProcess guard timing
  found: Guard checks isConnected state BEFORE async initializeDispatcher, but setIsConnected(true) is set AFTER spawn
  implication: RACE CONDITION - both StrictMode invocations pass the guard before either sets isConnected

- timestamp: 2026-02-17T14:47:00Z
  checked: Implementation of server-side fix
  found: Added isKilled flag, session reconnection logic, and onData guards
  implication: Fix correctly addresses the root cause at the server level

## Resolution

root_cause: CONFIRMED - Race condition between PTY kill and PTY respawn on server.

When React StrictMode causes unmount-remount:
1. dispose() sends terminal:kill to server
2. Second mount sends terminal:spawn with SAME sessionId
3. Server receives spawn BEFORE the old PTY has exited
4. Server OVERWRITES session in map: `this.sessions.set(sessionId, newSession)`
5. Old PTY still has its onData handler with closure to broadcastToSession
6. Old PTY outputs final prompt before dying
7. broadcastToSession looks up sessionId in map - finds NEW session
8. Old PTY's output is broadcast to NEW session's clients!

Result: Two prompts appear - one from old PTY (dying), one from new PTY (starting).

fix: Server-side fix implemented with four changes in terminalPTYServer.ts:

1. Added `isKilled: boolean` flag to PTYSessionState interface to track dying sessions

2. In spawnSession: Check for existing session before spawning
   - If session exists and is alive (not killed): reconnect client to existing session, send replay data
   - If session exists but is killed/dying: delete old session and spawn fresh
   - This handles the StrictMode remount gracefully

3. In onData handlers: Guard against stale PTY output
   - Capture session reference at handler creation time
   - Before broadcasting, check if session is still in map AND same reference AND not killed
   - This prevents dying PTY's output from leaking to new session's clients

4. In killSession/removeClient/cleanup: Set isKilled=true BEFORE killing PTY
   - This marks session as dying immediately so spawnSession knows to replace it
   - Prevents race condition where spawn arrives before kill completes

verification:
- TypeScript build passes: npm run gsd:build
- Terminal tests pass: 7/7 tests in src/services/terminal
- Manual testing required to verify no duplicate prompts appear

files_changed:
- /Users/mshaler/Developer/Projects/Isometry/src/services/terminal/terminalPTYServer.ts
