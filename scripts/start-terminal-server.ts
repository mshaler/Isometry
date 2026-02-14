/**
 * Terminal Server Startup Script
 *
 * Starts the ClaudeCodeServer which provides WebSocket-based terminal access
 * with PTY support via node-pty.
 *
 * Usage: npm run start:terminal-server
 * Or: npx tsx scripts/start-terminal-server.ts
 */

import { ClaudeCodeServer } from '../src/services/claude-code/claudeCodeServer';

const PORT = parseInt(process.env.TERMINAL_PORT || '8080', 10);

console.log(`Starting terminal server on port ${PORT}...`);

const server = new ClaudeCodeServer(PORT);
server.start();

console.log(`Terminal WebSocket server listening on ws://localhost:${PORT}`);
console.log('Press Ctrl+C to stop');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down terminal server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down terminal server...');
  server.stop();
  process.exit(0);
});
