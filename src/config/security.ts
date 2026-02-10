/**
 * Security Configuration and API Proxy Setup
 *
 * This module provides secure API configuration with environment-based
 * routing for production vs development environments.
 */

import { devLogger } from '../utils/logging/logger';

export interface APIProxyConfig {
  endpoint: string;
  timeout: number;
  maxRetries: number;
  rateLimitPerHour: number;
}

export interface SecurityConfig {
  useProxy: boolean;
  isProduction: boolean;
  apiProxy: APIProxyConfig;
  allowedOrigins: string[];
}

/**
 * Production-ready security configuration
 * In production, all API calls are routed through secure backend proxy
 */
export function getSecurityConfig(): SecurityConfig {
  const isProduction = import.meta.env.PROD || false;

  // In production, ALWAYS use proxy to protect API keys
  const useProxy = isProduction || import.meta.env.VITE_USE_API_PROXY === 'true';

  return {
    useProxy,
    isProduction,
    apiProxy: {
      endpoint: import.meta.env.VITE_API_PROXY_ENDPOINT || '/api/claude',
      timeout: 30000,
      maxRetries: 3,
      rateLimitPerHour: 1000
    },
    allowedOrigins: [
      'https://isometry.app',
      'https://*.isometry.app',
      ...(isProduction ? [] : ['http://localhost:3000', 'http://localhost:5173'])
    ]
  };
}

/**
 * Validates security configuration
 */
export function validateSecurityConfig(): { valid: boolean; errors: string[] } {
  const config = getSecurityConfig();
  const errors: string[] = [];

  if (config.isProduction && !config.useProxy) {
    errors.push('Production environment must use API proxy');
  }

  if (config.useProxy && !config.apiProxy.endpoint) {
    errors.push('API proxy endpoint not configured');
  }

  if (config.apiProxy.timeout < 5000) {
    errors.push('API proxy timeout too low (minimum 5 seconds)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Determines if API calls should be routed through secure proxy
 */
export function shouldUseAPIProxy(): boolean {
  const config = getSecurityConfig();
  return config.useProxy;
}

/**
 * Gets the secure API endpoint for Claude requests
 */
export function getSecureAPIEndpoint(): string {
  const config = getSecurityConfig();

  if (config.useProxy) {
    return config.apiProxy.endpoint;
  }

  // Development fallback - direct API access (with warning)
  devLogger.warn('Security Warning: Using direct API access in development', {
    message: 'API key will be exposed in browser. Use proxy in production.'
  });

  return 'https://api.anthropic.com';
}

/**
 * Security headers for API requests
 */
export function getSecurityHeaders(): Record<string, string> {
  const config = getSecurityConfig();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Version': import.meta.env.PACKAGE_VERSION || '1.0.0',
    'X-Environment': config.isProduction ? 'production' : 'development'
  };

  // Add CSRF protection in production
  if (config.isProduction) {
    headers['X-Requested-With'] = 'XMLHttpRequest';

    // Add origin validation
    const origin = window.location.origin;
    if (config.allowedOrigins.some(allowed =>
      origin === allowed ||
      (allowed.includes('*') && origin.endsWith(allowed.replace('*', '')))
    )) {
      headers['Origin'] = origin;
    } else {
      throw new Error(`Unauthorized origin: ${origin}`);
    }
  }

  return headers;
}

/**
 * Rate limiting configuration for API requests
 */
export function getRateLimitConfig() {
  const config = getSecurityConfig();

  return {
    maxRequestsPerHour: config.apiProxy.rateLimitPerHour,
    windowMs: 60 * 60 * 1000, // 1 hour
    retryAfter: 60 * 1000, // 1 minute
    skipSuccessfulRequests: false
  };
}