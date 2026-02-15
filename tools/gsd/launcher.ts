/**
 * GSD Launcher Module
 * 
 * Manages dev server lifecycle - start, stop, health check.
 */

import { spawn, ChildProcess } from 'child_process';
import { GSDConfig, LaunchResult } from './config.js';

export class Launcher {
  private process: ChildProcess | null = null;
  
  constructor(private config: GSDConfig) {}

  async start(): Promise<LaunchResult> {
    // First check if server is already running
    if (await this.isRunning()) {
      return {
        success: true,
        url: `http://localhost:${this.config.port}`,
      };
    }

    return new Promise((resolve) => {
      const [cmd, ...args] = this.config.devCommand.split(' ');
      
      this.process = spawn(cmd, args, {
        cwd: this.config.projectRoot,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '0', // Disable colors for easier parsing
        },
      });

      let started = false;
      let output = '';

      const onData = (data: Buffer) => {
        output += data.toString();
        
        // Look for Vite's ready message
        if (output.includes('Local:') && output.includes(String(this.config.port))) {
          if (!started) {
            started = true;
            resolve({
              success: true,
              pid: this.process?.pid,
              url: `http://localhost:${this.config.port}`,
            });
          }
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData);

      this.process.on('error', (error) => {
        if (!started) {
          resolve({
            success: false,
            error: error.message,
          });
        }
      });

      this.process.on('close', (code) => {
        if (!started) {
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
          });
        }
      });

      // Timeout
      setTimeout(() => {
        if (!started) {
          this.stop();
          resolve({
            success: false,
            error: 'Dev server startup timeout',
          });
        }
      }, this.config.timeout);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    // Also kill any process on the port
    try {
      const { exec } = await import('child_process');
      await new Promise<void>((resolve) => {
        exec(`lsof -ti:${this.config.port} | xargs kill -9 2>/dev/null || true`, () => {
          resolve();
        });
      });
    } catch {
      // Ignore errors
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok || response.status === 304;
    } catch {
      return false;
    }
  }

  async waitForReady(timeout: number = 30000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await this.isRunning()) {
        return true;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    
    return false;
  }
}
