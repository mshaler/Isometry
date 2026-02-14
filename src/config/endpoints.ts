/**
 * API Endpoints Configuration
 *
 * Centralizes all API endpoint URLs, building on environment configuration.
 * Eliminates hardcoded localhost URLs scattered across the codebase.
 */

import { getEnvironmentConfig } from './environment';

/**
 * Port configuration for different services
 */
const PORTS = {
  /** Main API server port */
  API: 8080,
  /** Development server port (Vite) */
  DEV: 3000,
  /** WebSocket server port */
  WS: 8080,
} as const;

/**
 * Gets the base HTTP URL for API requests
 * Uses environment config in production, falls back to localhost in dev
 */
export function getAPIBaseURL(): string {
  const config = getEnvironmentConfig();

  // In production/staging, use the configured API URL
  if (!config.isDevelopment) {
    return config.apiBaseURL;
  }

  // In development, check for environment variable override
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Default development URL
  return `http://localhost:${PORTS.API}`;
}

/**
 * Gets the WebSocket URL for real-time connections
 * Derives from API base URL, converting http(s) to ws(s)
 */
export function getWebSocketURL(): string {
  const config = getEnvironmentConfig();

  // Check for explicit WebSocket URL override
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // In development, use localhost WebSocket
  if (config.isDevelopment) {
    return `ws://localhost:${PORTS.WS}`;
  }

  // In production, derive from API URL
  const apiURL = config.apiBaseURL;
  return apiURL
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');
}

/**
 * Gets the health check endpoint URL
 */
export function getHealthCheckURL(): string {
  return `${getAPIBaseURL()}/health`;
}

/**
 * Build a full API URL from a path
 */
export function buildAPIURL(path: string): string {
  const base = getAPIBaseURL();
  // Ensure no double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Export port constants for direct use if needed
 */
export { PORTS };
