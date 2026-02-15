---
status: verifying
trigger: "Multiple terminal prompts appearing on startup"
created: 2026-02-14T00:00:00Z
updated: 2026-02-14T00:15:00Z
---

## Current Focus

hypothesis: The guards are not working because attachToProcess is recreated on each render due to dependency array changes, and both StrictMode invocations get past the guards before either sets them
test: Add logging to trace exact timing of guard checks vs flag sets
expecting: Logs will show both invocations checking guards before either sets isConnected=true via setState
next_action: Add debug logging to trace execution flow

## Symptoms

expected: Single "%" prompt on terminal startup
actual: Multiple "%" prompts appearing (zsh's PROMPT_SP indicator)
errors: None visible
reproduction: Start the app with React dev mode (StrictMode enabled)
started: Unknown - reported as current behavior

## Eliminated

(none yet)

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

The fix I've already added to terminalPTYServer.ts checks for existing session and rejects duplicate spawns. This is the correct fix but need to also ensure the client-side guards work properly.

Client-side issue: The globalTerminalSpawned guard should prevent duplicate spawns, but need to verify it's working.

fix: Server-side fix implemented with three changes:
1. Added `isKilled` flag to PTYSessionState to track sessions that have been killed but not yet cleaned up
2. In spawnSession: Check for existing session - if alive and not killed, reconnect; if killed/dying, delete and spawn fresh
3. In onData handlers: Check if session is still active in map and not killed before broadcasting output

This prevents:
- Old dying PTY from broadcasting to new session's clients
- Race condition between kill and spawn during StrictMode remount
- Duplicate PTY spawns for the same sessionId

verification: Types pass. Need manual testing to verify no duplicate prompts appear.
files_changed:
- /Users/mshaler/Developer/Projects/Isometry/src/services/terminal/terminalPTYServer.ts
