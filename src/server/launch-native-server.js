#!/usr/bin/env node

/* eslint-env node */
/* eslint no-console: "off" */

/**
 * Launch script for native API server
 *
 * Usage:
 *   node launch-native-server.js [--port PORT] [--database PATH]
 *
 * Environment Variables:
 *   NATIVE_API_PORT - Port for native server (default: 8080)
 *   NATIVE_API_DATABASE - Database file path (default: isometry-dev.db)
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const nativeDir = join(projectRoot, 'native');

// Parse command line arguments
const args = process.argv.slice(2);
let port = process.env.NATIVE_API_PORT || '8080';
let database = process.env.NATIVE_API_DATABASE || 'isometry-dev.db';

for (let i = 0; i < args.length; i += 2) {
  switch (args[i]) {
    case '--port':
    case '-p':
      port = args[i + 1];
      break;
    case '--database':
    case '-d':
      database = args[i + 1];
      break;
    case '--help':
    case '-h':
      console.log(`
Launch Native API Server

Usage: node launch-native-server.js [options]

Options:
  --port, -p PORT        Server port (default: 8080)
  --database, -d PATH    Database file path (default: isometry-dev.db)
  --help, -h            Show this help

Environment Variables:
  NATIVE_API_PORT       Server port
  NATIVE_API_DATABASE   Database file path

Examples:
  node launch-native-server.js
  node launch-native-server.js --port 3001
  NATIVE_API_PORT=9000 node launch-native-server.js
`);
      process.exit(0);
      break;
    default:
      console.error(`Unknown option: ${args[i]}`);
      process.exit(1);
  }
}

async function buildNativeServer() {
  console.log('🔨 Building native API server...');

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('swift', ['build', '--target', 'IsometryAPIServer'], {
      cwd: nativeDir,
      stdio: 'inherit'
    });

    buildProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Native server built successfully');
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });

    buildProcess.on('error', (error) => {
      reject(new Error(`Build process failed: ${error.message}`));
    });
  });
}

async function startNativeServer() {
  console.log(`🚀 Starting native API server on port ${port}...`);

  const serverProcess = spawn('swift', ['run', 'IsometryAPIServer', '--port', port, '--database', database], {
    cwd: nativeDir,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverStarted = false;
  let actualPort = port;

  serverProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server] ${output.trim()}`);

    // Look for port confirmation and export it
    const portMatch = output.match(/Server ready at http:\/\/127\.0\.0\.1:(\d+)/);
    if (portMatch && !serverStarted) {
      actualPort = portMatch[1];
      serverStarted = true;
      console.log(`✅ Native API server running on port ${actualPort}`);
      console.log(`🔗 Health check: http://127.0.0.1:${actualPort}/health`);
      console.log(`📡 API endpoints: http://127.0.0.1:${actualPort}/api/*`);

      // Export port for other scripts to use
      process.stdout.write(`NATIVE_API_PORT=${actualPort}\n`);
    }
  });

  serverProcess.stderr?.on('data', (data) => {
    const error = data.toString().trim();
    if (error) {
      console.error(`[Server Error] ${error}`);
    }
  });

  serverProcess.on('error', (error) => {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Server exited with code ${code}`);
      process.exit(code);
    } else {
      console.log('✅ Server stopped gracefully');
    }
  });

  // Handle graceful shutdown
  const cleanup = () => {
    console.log('\n🛑 Shutting down native API server...');
    serverProcess.kill('SIGTERM');

    setTimeout(() => {
      console.log('🔥 Force killing server...');
      serverProcess.kill('SIGKILL');
    }, 5000);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  return serverProcess;
}

async function main() {
  try {
    // Check if we're in the right directory
    try {
      await fs.access(nativeDir);
    } catch {
      console.error('❌ Native directory not found. Are you in the project root?');
      process.exit(1);
    }

    // Build the server
    await buildNativeServer();

    // Start the server
    await startNativeServer();

  } catch (error) {
    console.error(`❌ Failed to launch native server: ${error.message}`);
    process.exit(1);
  }
}

// Only run if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}