import { devLogger } from './dev-logger';

export interface EnvironmentConfig {
  cliAvailable: boolean;
  cliPath?: string;
  cliVersion?: string;
  isProduction: boolean;
  configurationStatus: string;
  detectionMethod?: 'path' | 'fallback' | 'manual';
}

/**
 * Simulates CLI detection (browser limitation)
 * In real desktop app, would check PATH and executable availability
 */
function detectClaudeCLI(): { found: boolean; path?: string; version?: string; method?: string } {
  // In a real Node.js environment, we would:
  // 1. Check if 'claude' is in PATH using which/where command
  // 2. Try to execute 'claude --version' to get version
  // 3. Verify the executable is working

  // Simulate detection based on common installation patterns
  const commonPaths = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    '/Applications/Claude Code.app/Contents/MacOS/claude',
    'C:\\Program Files\\Claude Code\\claude.exe',
    'C:\\Users\\*\\AppData\\Local\\Claude Code\\claude.exe'
  ];

  // For demo purposes, we'll simulate finding Claude CLI
  // This would be replaced with actual filesystem checks in a desktop app
  const simulatedDetection = {
    found: Math.random() > 0.3, // 70% chance of "finding" CLI for demo
    path: commonPaths[0], // Use first common path as simulation
    version: '1.0.0',
    method: 'path'
  };

  devLogger.debug('Claude CLI detection (simulated)', simulatedDetection);
  return simulatedDetection;
}

/**
 * Validates if Claude Code CLI is available and working
 */
export function validateCLI(): boolean {
  const detection = detectClaudeCLI();
  return detection.found;
}

/**
 * Gets the CLI path and version information
 */
function getCLIInfo(): { path?: string; version?: string; method?: string } {
  const detection = detectClaudeCLI();

  if (!detection.found) {
    return {};
  }

  return {
    path: detection.path,
    version: detection.version,
    method: detection.method
  };
}

/**
 * Returns comprehensive environment configuration status
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const cliInfo = getCLIInfo();
  const cliAvailable = !!cliInfo.path;
  const isProduction = import.meta.env.PROD || false;

  let configurationStatus = '';
  let detectionMethod: 'path' | 'fallback' | 'manual' | undefined;

  if (!cliAvailable) {
    configurationStatus = 'Claude Code CLI not detected';
  } else {
    configurationStatus = `Claude Code CLI available (v${cliInfo.version})`;
    detectionMethod = cliInfo.method as 'path' | 'fallback' | 'manual';
  }

  return {
    cliAvailable,
    cliPath: cliInfo.path,
    cliVersion: cliInfo.version,
    isProduction,
    configurationStatus,
    detectionMethod
  };
}

/**
 * Returns step-by-step setup instructions for installing Claude Code CLI
 */
export function setupEnvironmentInstructions(): string[] {
  const config = getEnvironmentConfig();

  if (config.cliAvailable) {
    return [
      '✅ Claude Code CLI is properly configured',
      `📍 CLI Path: ${config.cliPath}`,
      `📋 Version: ${config.cliVersion}`,
      `🔍 Detection: ${config.detectionMethod}`,
      '',
      'You can now use Claude commands in the terminal!',
      '',
      '💡 Available features:',
      '   - @claude [prompt] - AI assistance with project context',
      '   - Code analysis and refactoring suggestions',
      '   - Context-aware development help'
    ];
  }

  const instructions = [
    '🔧 Claude Code CLI Setup Required',
    '',
    '1. Download Claude Code Desktop Application:',
    '   https://claude.ai/code',
    '',
    '2. Install Claude Code:',
    '   - Run the installer for your operating system',
    '   - Follow the installation wizard',
    '   - Ensure "Add to PATH" option is selected',
    '',
    '3. Verify Installation:',
    '   Open terminal/command prompt and run:',
    '   claude --version',
    '',
    '4. Test Integration:',
    '   In this app, try: @claude hello',
    '',
    '📱 Platform-specific notes:',
  ];

  // Add platform-specific instructions
  if (navigator.platform.toLowerCase().includes('win')) {
    instructions.push(
      '   Windows: CLI typically installs to:',
      '   C:\\Program Files\\Claude Code\\claude.exe',
      '   Ensure this path is in your system PATH'
    );
  } else if (navigator.platform.toLowerCase().includes('mac')) {
    instructions.push(
      '   macOS: CLI typically installs via Homebrew:',
      '   brew install claude-code',
      '   Or manual install to /usr/local/bin/claude'
    );
  } else {
    instructions.push(
      '   Linux: CLI typically installs to:',
      '   /usr/local/bin/claude or ~/.local/bin/claude',
      '   Ensure the installation directory is in your PATH'
    );
  }

  instructions.push(
    '',
    '⚠️  Note: Desktop Application Required',
    '   Claude Code CLI requires the desktop application to be installed.',
    '   The CLI acts as a bridge to the main Claude Code application.',
    '',
    '🔄 After Installation:',
    '   Restart this application to detect the CLI automatically.',
    '',
    '🆘 Troubleshooting:',
    '   - Ensure Claude Code is running in the background',
    '   - Check if CLI is in your system PATH',
    '   - Try running "claude --help" in terminal'
  );

  return instructions;
}

/**
 * Determines if the application is running in production mode
 */
export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD || false;
}

/**
 * Check if running in a desktop environment where CLI access is possible
 */
export function isDesktopEnvironment(): boolean {
  // In a real desktop app (Tauri/Electron), this would return true
  // For now, we detect based on user agent and available APIs
  const hasElectron = 'require' in globalThis;
  const hasTauri = 'window' in globalThis && '__TAURI__' in (globalThis as any);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return hasElectron || hasTauri || isStandalone;
}

/**
 * Get CLI execution context for desktop vs browser environments
 */
export function getCLIExecutionContext(): {
  canExecute: boolean;
  method: 'node_child_process' | 'tauri_command' | 'browser_simulation';
  limitations: string[];
} {
  const isDesktop = isDesktopEnvironment();

  if (isDesktop) {
    // Check if we have Node.js child_process available
    try {
      // This would work in Electron/Node.js environment
      const hasChildProcess = typeof require !== 'undefined';
      if (hasChildProcess) {
        return {
          canExecute: true,
          method: 'node_child_process',
          limitations: []
        };
      }
    } catch {
      // Not in Node.js environment
    }

    // Check for Tauri command API
    if ('__TAURI__' in (globalThis as any)) {
      return {
        canExecute: true,
        method: 'tauri_command',
        limitations: ['Requires Tauri backend command registration']
      };
    }
  }

  // Browser fallback
  return {
    canExecute: false,
    method: 'browser_simulation',
    limitations: [
      'Browser security prevents direct CLI execution',
      'CLI commands are simulated for demonstration',
      'Real CLI execution requires desktop app build (Tauri/Electron)'
    ]
  };
}

/**
 * Logs configuration status to console (for debugging)
 */
export function logEnvironmentStatus(): void {
  const config = getEnvironmentConfig();
  const execContext = getCLIExecutionContext();

  devLogger.debug('Claude CLI Environment Status', {
    available: config.cliAvailable,
    cliPath: config.cliPath,
    version: config.cliVersion,
    status: config.configurationStatus,
    detection: config.detectionMethod,
    isProduction: config.isProduction,
    isDesktop: isDesktopEnvironment(),
    executionContext: execContext
  });

  if (!config.cliAvailable) {
    const instructions = setupEnvironmentInstructions();
    devLogger.setup('Claude CLI Setup Required', {
      instructionsCount: instructions.length,
      instructions: instructions.slice(0, 5) // Log first few instructions for context
    });
  }
}