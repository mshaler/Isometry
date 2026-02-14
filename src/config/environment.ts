/**
 * Environment Configuration Management
 *
 * Centralizes environment-based configuration with secure defaults,
 * replacing hardcoded development paths with environment variables.
 */

import { devLogger } from "../utils/logging/dev-logger";

/**
 * Environment types
 */
export type EnvironmentType = 'development' | 'staging' | 'production';

/**
 * Security levels for different environments
 */
export type SecurityLevel = 'minimal' | 'standard' | 'strict';

/**
 * Application environment configuration
 */
interface EnvironmentConfig {
  // Environment identification
  type: EnvironmentType;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;

  // Security configuration
  securityLevel: SecurityLevel;
  enableEncryption: boolean;
  enableAPIProxy: boolean;
  enableCSRFProtection: boolean;

  // API configuration
  apiBaseURL: string;
  claudeAPIEndpoint: string;
  timeoutMs: number;
  maxRetries: number;

  // Storage configuration
  storagePrefix: string;
  enableLocalStorage: boolean;
  enableSessionStorage: boolean;

  // Debug and logging
  enableDebugLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableErrorReporting: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';

  // File system paths (secure)
  workingDirectory?: string;
  tempDirectory?: string;
  cacheDirectory?: string;

  // Feature flags
  enableNotebookMode: boolean;
  enableClaudeIntegration: boolean;
  enableOfflineMode: boolean;
  enableExperimentalFeatures: boolean;
}

/**
 * Default configurations for each environment
 */
const ENVIRONMENT_DEFAULTS: Record<EnvironmentType, Partial<EnvironmentConfig>> = {
  development: {
    securityLevel: 'minimal',
    enableEncryption: false,
    enableAPIProxy: false,
    enableCSRFProtection: false,
    enableDebugLogging: true,
    enablePerformanceMonitoring: true,
    enableErrorReporting: false,
    logLevel: 'debug',
    enableExperimentalFeatures: true,
    apiBaseURL: 'http://localhost:3000',
    timeoutMs: 30000,
    maxRetries: 3
  },

  staging: {
    securityLevel: 'standard',
    enableEncryption: true,
    enableAPIProxy: true,
    enableCSRFProtection: true,
    enableDebugLogging: true,
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
    logLevel: 'info',
    enableExperimentalFeatures: true,
    apiBaseURL: 'https://staging-api.isometry.app',
    timeoutMs: 15000,
    maxRetries: 2
  },

  production: {
    securityLevel: 'strict',
    enableEncryption: true,
    enableAPIProxy: true,
    enableCSRFProtection: true,
    enableDebugLogging: false,
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
    logLevel: 'error',
    enableExperimentalFeatures: false,
    apiBaseURL: 'https://api.isometry.app',
    timeoutMs: 10000,
    maxRetries: 1
  }
};

/**
 * Detects the current environment type
 */
function detectEnvironment(): EnvironmentType {
  // Check Vite environment first
  if (import.meta.env.PROD) {
    return 'production';
  }

  if (import.meta.env.DEV) {
    // Check for staging environment
    if (import.meta.env.VITE_ENVIRONMENT === 'staging') {
      return 'staging';
    }
    return 'development';
  }

  // Fallback environment detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname.includes('staging')) {
      return 'staging';
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
  }

  // Default to production for safety
  return 'production';
}

/**
 * Gets environment variable with fallback
 */
function getEnvVar(key: string, fallback?: string): string | undefined {
  // Try Vite environment variables first
  const viteKey = `VITE_${key}`;
  if (import.meta.env[viteKey]) {
    return import.meta.env[viteKey];
  }

  // Try process environment (if available)
  try {
    interface GlobalWithProcess {
      process?: {
        env?: Record<string, string>;
      };
    }
    const globalThis_process = (globalThis as GlobalWithProcess).process;
    if (globalThis_process?.env?.[key]) {
      return globalThis_process.env[key];
    }
  } catch {
    // process not available in browser
  }

  return fallback;
}

/**
 * Builds complete environment configuration
 */
function buildEnvironmentConfig(envType: EnvironmentType): EnvironmentConfig {
  const defaults = ENVIRONMENT_DEFAULTS[envType];

  return {
    // Environment identification
    type: envType,
    isProduction: envType === 'production',
    isDevelopment: envType === 'development',
    isStaging: envType === 'staging',

    // Merge with environment-specific defaults
    securityLevel: defaults.securityLevel || 'standard',
    enableEncryption: defaults.enableEncryption ?? true,
    enableAPIProxy: defaults.enableAPIProxy ?? true,
    enableCSRFProtection: defaults.enableCSRFProtection ?? true,

    // API configuration from environment variables
    apiBaseURL: getEnvVar('API_BASE_URL') || defaults.apiBaseURL || 'https://api.isometry.app',
    claudeAPIEndpoint: getEnvVar('CLAUDE_API_ENDPOINT') || 'https://api.anthropic.com',
    timeoutMs: Number(getEnvVar('API_TIMEOUT_MS')) || defaults.timeoutMs || 10000,
    maxRetries: Number(getEnvVar('API_MAX_RETRIES')) || defaults.maxRetries || 1,

    // Storage configuration
    storagePrefix: getEnvVar('STORAGE_PREFIX') || 'isometry',
    enableLocalStorage: getEnvVar('ENABLE_LOCAL_STORAGE') !== 'false',
    enableSessionStorage: getEnvVar('ENABLE_SESSION_STORAGE') !== 'false',

    // Debug and logging
    enableDebugLogging: getEnvVar('ENABLE_DEBUG_LOGGING') === 'true' || defaults.enableDebugLogging || false,
    enablePerformanceMonitoring: getEnvVar('ENABLE_PERFORMANCE_MONITORING') !== 'false' && (defaults.enablePerformanceMonitoring ?? true),
    enableErrorReporting: getEnvVar('ENABLE_ERROR_REPORTING') === 'true' || defaults.enableErrorReporting || false,
    logLevel: (getEnvVar('LOG_LEVEL') as EnvironmentConfig['logLevel']) || defaults.logLevel || 'error',

    // Secure file system paths
    workingDirectory: getEnvVar('WORKING_DIRECTORY'), // No default for security
    tempDirectory: getEnvVar('TEMP_DIRECTORY'), // No default for security
    cacheDirectory: getEnvVar('CACHE_DIRECTORY'), // No default for security

    // Feature flags from environment
    enableNotebookMode: getEnvVar('ENABLE_NOTEBOOK_MODE') !== 'false',
    enableClaudeIntegration: getEnvVar('ENABLE_CLAUDE_INTEGRATION') !== 'false',
    enableOfflineMode: getEnvVar('ENABLE_OFFLINE_MODE') !== 'false',
    enableExperimentalFeatures: getEnvVar('ENABLE_EXPERIMENTAL_FEATURES') === 'true' || defaults.enableExperimentalFeatures || false
  };
}

// Cache the configuration to avoid repeated environment detection
let cachedConfig: EnvironmentConfig | null = null;

/**
 * Gets the current environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    const envType = detectEnvironment();
    cachedConfig = buildEnvironmentConfig(envType);

    // Log configuration in development
    if (cachedConfig.enableDebugLogging) {
      devLogger.inspect('Environment Configuration', {
        type: cachedConfig.type,
        securityLevel: cachedConfig.securityLevel,
        apiBaseURL: cachedConfig.apiBaseURL,
        enableEncryption: cachedConfig.enableEncryption,
        enableAPIProxy: cachedConfig.enableAPIProxy
      });
    }
  }

  return cachedConfig;
}

/**
 * Gets secure working directory path
 */
export function getSecureWorkingDirectory(): string {
  const config = getEnvironmentConfig();

  if (config.workingDirectory) {
    return config.workingDirectory;
  }

  // Secure fallbacks based on environment
  if (config.isDevelopment) {
    // In development, use current directory or temp
    return getEnvVar('PWD') || '/tmp/isometry-dev';
  }

  // In production, require explicit configuration
  throw new Error(
    'Working directory not configured. Set VITE_WORKING_DIRECTORY or WORKING_DIRECTORY environment variable.'
  );
}

