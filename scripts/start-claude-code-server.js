#!/usr/bin/env node

/**
 * Start Claude Code GSD Server
 *
 * Node.js script to start the WebSocket server that bridges
 * the browser GSD GUI with the real Claude Code CLI.
 */

import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the TypeScript server file
const serverPath = path.join(__dirname, '../src/services/claudeCodeServer.ts');

// Start the server using tsx to run TypeScript directly
console.log('🚀 Starting Claude Code GSD Server...');
console.log(`📁 Server file: ${serverPath}`);

// Check if tsx is available
let runCommand = 'npx';
let runArgs = ['tsx', serverPath];

// Try to run with tsx
const serverProcess = spawn(runCommand, runArgs, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start Claude Code server:', error.message);

  if (error.message.includes('tsx')) {
    console.log('💡 Installing tsx...');
    const installProcess = spawn('npm', ['install', '-g', 'tsx'], { stdio: 'inherit' });

    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ tsx installed. Restarting server...');
        // Restart this script
        spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
      } else {
        console.error('❌ Failed to install tsx');
        process.exit(1);
      }
    });
  } else {
    process.exit(1);
  }
});

serverProcess.on('close', (code) => {
  console.log(`📴 Claude Code server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Claude Code server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Claude Code server...');
  serverProcess.kill('SIGTERM');
});