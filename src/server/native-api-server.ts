import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { devLogger" from "../utils/logging/dev-logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const nativeDir = join(projectRoot, 'native');

// Type definitions for native API responses
export interface APINode {
  id: string;
  nodeType: string;
  name: string;
  folder?: string;
  content?: string;
  summary?: string;
  sourceId?: string;
  source?: string;
  sortOrder: number;
  tags: string[];
  priority: number;
  importance: number;
  status?: string;
  createdAt: string;
  modifiedAt: string;
  deletedAt?: string;
  version: number;
  syncVersion: number;
  lastSyncedAt?: string;
}

export interface APINotebookCard {
  id: string;
  nodeId?: string;
  title: string;
  markdownContent?: string;
  properties?: Record<string, string>;
  templateId?: string;
  folder?: string;
  tags?: string[];
  createdAt: string;
  modifiedAt: string;
  deletedAt?: string;
  syncVersion: number;
  lastSyncedAt?: string;
}

export interface SQLExecuteRequest {
  sql: string;
  params?: Array<string | number | boolean | null>;
}

export interface NativeAPIServerConfig {
  port?: number;
  database?: string;
  timeout?: number;
}

export interface NativeAPIServerInstance {
  port: number;
  stop: () => Promise<void>;
  isRunning: boolean;
}

/**
 * Launches the native IsometryAPIServer for React prototype development
 *
 * @param config Server configuration options
 * @returns Promise that resolves to server instance with port and stop method
 */
export async function startNativeAPIServer(
  config: NativeAPIServerConfig = {}
): Promise<NativeAPIServerInstance> {
  const {
    port = 8080,
    database = 'isometry-dev.db',
    timeout = 30000
  } = config;

  devLogger.inspect('Building native API server...');

  // Build native server first
  await buildNativeServer();

  devLogger.inspect('Starting native API server...');

  // Spawn the native server process
  const serverProcess = spawn('swift', ['run', 'IsometryAPIServer', '--port', port.toString(), '--database', database], {
    cwd: nativeDir,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverStarted = false;
  let actualPort = port;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill();
        reject(new Error(`Native API server failed to start within ${timeout}ms`));
      }
    }, timeout);

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      devLogger.debug('Native server output', { output: output.trim() });

      // Look for port confirmation
      const portMatch = output.match(/Server ready at http:\/\/127\.0\.0\.1:(\d+)/);
      if (portMatch) {
        actualPort = parseInt(portMatch[1]);
        serverStarted = true;
        clearTimeout(timeoutId);

        const instance: NativeAPIServerInstance = {
          port: actualPort,
          isRunning: true,
          stop: async () => {
            devLogger.inspect('Stopping native API server...');
            serverProcess.kill();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for graceful shutdown
          }
        };

        resolve(instance);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      devLogger.error('Native server error', { error: error.trim() });
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      if (!serverStarted) {
        reject(new Error(`Failed to start native server process: ${error.message}`));
      }
    });

    serverProcess.on('exit', (code) => {
      if (!serverStarted) {
        clearTimeout(timeoutId);
        reject(new Error(`Native server process exited with code ${code}`));
      }
    });
  });
}

/**
 * Stops a running native API server instance
 */
export async function stopNativeAPIServer(instance: NativeAPIServerInstance): Promise<void> {
  if (instance.isRunning) {
    await instance.stop();
  }
}

/**
 * Checks if the native server binary exists and builds it if needed
 */
async function buildNativeServer(): Promise<void> {
  try {
    // Check if IsometryAPIServer exists
    const buildPath = join(nativeDir, '.build/debug/IsometryAPIServer');

    try {
      await fs.access(buildPath);
      devLogger.debug('Native server binary found');
      return;
    } catch {
      // Binary doesn't exist, need to build
    }

    devLogger.inspect('Building native server (this may take a moment)...');

    return new Promise((resolve, reject) => {
      const buildProcess = spawn('swift', ['build', '--target', 'IsometryAPIServer'], {
        cwd: nativeDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      buildProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        // Only show important build messages
        if (output.includes('error') || output.includes('complete')) {
          devLogger.debug('Build output', { output: output.trim() });
        }
      });

      buildProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        devLogger.error('Build error', { error: error.trim() });
      });

      buildProcess.on('exit', (code) => {
        if (code === 0) {
          devLogger.debug('Native server built successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        reject(new Error(`Build process failed: ${error.message}`));
      });
    });

  } catch (error) {
    throw new Error(`Failed to build native server: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Finds an available port starting from the given port
 */
export async function findAvailablePort(startPort: number = 8080): Promise<number> {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      const port = (server.address() as { port?: number })?.port;
      server.close(() => {
        resolve(port || startPort);
      });
    });

    server.on('error', () => {
      // Port is busy, try next one
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

/**
 * Tests if the native API server is responding
 */
export async function testNativeAPIServer(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}