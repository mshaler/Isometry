/**
 * Environment Context
 *
 * Provides comprehensive environment detection and automatic database provider selection
 * Handles WebView and HTTP API providers
 */

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Environment, postMessage } from '../utils/webview-bridge';
import { bridgeLogger } from '../utils/logger';

export enum DatabaseMode {
  HTTP_API = 'http-api',
  WEBVIEW_BRIDGE = 'webview-bridge',
  FALLBACK = 'fallback',
  AUTO = 'auto'
}

export interface EnvironmentCapabilities {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  hasRealTimeSync: boolean;
  supportsOffline: boolean;
  hasNativeExport: boolean;
  hasCloudSync: boolean;
}

export interface EnvironmentInfo {
  mode: DatabaseMode;
  capabilities: EnvironmentCapabilities;
  platform: 'iOS' | 'macOS' | 'browser';
  version: string;
  isNative: boolean;
  performanceProfile: 'fast' | 'medium' | 'slow';
}

interface EnvironmentContextType {
  environment: EnvironmentInfo;
  isLoading: boolean;
  error: string | null;
  forceMode: (mode: DatabaseMode) => void;
  refreshEnvironment: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

interface EnvironmentProviderProps {
  children: ReactNode;
  forcedMode?: DatabaseMode;
  enableAutoDetection?: boolean;
}

/**
 * Environment Provider that automatically detects and configures the optimal database mode
 */
export function EnvironmentProvider({
  children,
  forcedMode,
  enableAutoDetection = true
}: EnvironmentProviderProps) {
  const initialMode =
    forcedMode && forcedMode !== DatabaseMode.AUTO
      ? forcedMode
      : DatabaseMode.HTTP_API;

  const [environment, setEnvironment] = useState<EnvironmentInfo>({
    mode: initialMode,
    capabilities: getCapabilities(initialMode),
    platform: 'browser',
    version: '1.0',
    isNative: false,
    performanceProfile: 'medium'
  });
  const [isLoading, setIsLoading] = useState(
    enableAutoDetection && !(forcedMode && forcedMode !== DatabaseMode.AUTO)
  );
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Detect the optimal database mode based on available features
   */
  const detectEnvironment = async (): Promise<DatabaseMode> => {
    try {
      // If forced mode is specified, use it
      if (forcedMode && forcedMode !== DatabaseMode.AUTO) {
        return forcedMode;
      }

      // Check for WebView MessageHandlers (highest priority)
      if (await testWebViewBridge()) {
        bridgeLogger.info('WebView bridge detected');
        return DatabaseMode.WEBVIEW_BRIDGE;
      }

      // Check for HTTP API availability (medium priority)
      if (await testHTTPAPIConnection()) {
        bridgeLogger.info('HTTP API detected');
        return DatabaseMode.HTTP_API;
      }

      // Fall back to FALLBACK mode (no backend required)
      bridgeLogger.info('No backend available, using fallback mode');
      return DatabaseMode.FALLBACK;

    } catch (error) {
      bridgeLogger.warn('Environment detection failed', { error: error as Error });
      return DatabaseMode.FALLBACK;
    }
  };

  /**
   * Test WebView bridge availability
   */
  const testWebViewBridge = async (): Promise<boolean> => {
    if (!Environment.isWebView()) {
      return false;
    }

    try {
      // Test if bridge is actually functional with a simple ping
      const response = await postMessage('database', 'ping', {});
      return response !== null;
    } catch (error) {
      bridgeLogger.debug('WebView bridge test failed', { error: error as Error });
      return false;
    }
  };

  /**
   * Test HTTP API connection
   */
  const testHTTPAPIConnection = async (): Promise<boolean> => {
    // Only test HTTP API if not in WebView
    if (Environment.isWebView()) {
      return false;
    }

    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

      // Use AbortController for timeout with proper cleanup tracking
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${baseURL}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      return response.ok;
    } catch (error) {
      bridgeLogger.debug('HTTP API test failed', { error: error as Error });
      return false;
    } finally {
      // Ensure timeout is always cleaned up
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  /**
   * Get capabilities for a specific database mode
   */
  function getCapabilities(mode: DatabaseMode): EnvironmentCapabilities {
    switch (mode) {
      case DatabaseMode.WEBVIEW_BRIDGE:
        return {
          canReadFiles: true,
          canWriteFiles: true,
          hasRealTimeSync: true,
          supportsOffline: true,
          hasNativeExport: true,
          hasCloudSync: true
        };

      case DatabaseMode.HTTP_API:
        return {
          canReadFiles: false,
          canWriteFiles: false,
          hasRealTimeSync: false,
          supportsOffline: false,
          hasNativeExport: false,
          hasCloudSync: true
        };

      case DatabaseMode.FALLBACK:
        return {
          canReadFiles: false,
          canWriteFiles: false,
          hasRealTimeSync: false,
          supportsOffline: false,
          hasNativeExport: false,
          hasCloudSync: false
        };

      default:
        return {
          canReadFiles: false,
          canWriteFiles: false,
          hasRealTimeSync: false,
          supportsOffline: false,
          hasNativeExport: false,
          hasCloudSync: false
        };
    }
  }

  /**
   * Get performance profile for a database mode
   */
  function getPerformanceProfile(mode: DatabaseMode): 'fast' | 'medium' | 'slow' {
    switch (mode) {
      case DatabaseMode.WEBVIEW_BRIDGE:
        return 'fast';
      case DatabaseMode.HTTP_API:
      default:
        return 'medium';
    }
  }

  /**
   * Create environment info from detected mode
   */
  const createEnvironmentInfo = (mode: DatabaseMode): EnvironmentInfo => {
    const envInfo = Environment.info();

    return {
      mode,
      capabilities: getCapabilities(mode),
      platform: envInfo.platform as 'iOS' | 'macOS' | 'browser',
      version: envInfo.version,
      isNative: envInfo.isNative,
      performanceProfile: getPerformanceProfile(mode)
    };
  };

  /**
   * Initialize environment detection
   */
  const initializeEnvironment = async (): Promise<void> => {
    if (!enableAutoDetection && forcedMode && forcedMode !== DatabaseMode.AUTO) {
      setEnvironment(createEnvironmentInfo(forcedMode));
      setIsLoading(false);
      return;
    }

    if (!enableAutoDetection && !forcedMode) {
      return;
    }

    // Prevent setState if component unmounted
    if (!isMountedRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detectedMode = await detectEnvironment();
      const envInfo = createEnvironmentInfo(detectedMode);

      // Check mount status before setting state
      if (isMountedRef.current) {
        setEnvironment(envInfo);
        bridgeLogger.info('Environment initialized', {
          mode: detectedMode,
          platform: envInfo.platform,
          isNative: envInfo.isNative,
          capabilities: envInfo.capabilities
        });
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Environment detection failed';
        setError(errorMessage);
        bridgeLogger.error('Environment initialization failed', {}, err as Error);

        // Fall back to FALLBACK mode on error
        setEnvironment(createEnvironmentInfo(DatabaseMode.FALLBACK));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Force a specific database mode
   */
  const forceMode = (mode: DatabaseMode): void => {
    if (mode === DatabaseMode.AUTO) {
      initializeEnvironment();
    } else {
      setEnvironment(createEnvironmentInfo(mode));
    }
  };

  /**
   * Refresh environment detection
   */
  const refreshEnvironment = async (): Promise<void> => {
    await initializeEnvironment();
  };

  /**
   * Test current connection
   */
  const testConnection = async (): Promise<boolean> => {
    switch (environment.mode) {
      case DatabaseMode.WEBVIEW_BRIDGE:
        return testWebViewBridge();
      case DatabaseMode.HTTP_API:
        return testHTTPAPIConnection();
      case DatabaseMode.FALLBACK:
      default:
        return Promise.resolve(true); // Fallback mode always "works"
    }
  };

  // Initialize on mount and when forced mode changes
  useEffect(() => {
    initializeEnvironment();
  }, [forcedMode, enableAutoDetection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const contextValue: EnvironmentContextType = {
    environment,
    isLoading,
    error,
    forceMode,
    refreshEnvironment,
    testConnection
  };

  return (
    <EnvironmentContext.Provider value={contextValue}>
      {children}
    </EnvironmentContext.Provider>
  );
}

/**
 * Hook to access environment context
 */
export function useEnvironment(): EnvironmentContextType {
  const context = useContext(EnvironmentContext);

  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }

  return context;
}

/**
 * Hook for simple environment detection
 */
export function useEnvironmentInfo(): EnvironmentInfo {
  const { environment } = useEnvironment();
  return environment;
}

/**
 * Hook for capabilities checking
 */
export function useCapabilities(): EnvironmentCapabilities {
  const { environment } = useEnvironment();
  return environment.capabilities;
}

/**
 * Component for displaying environment information
 */
export function EnvironmentDebugInfo() {
  const { environment, isLoading, error, testConnection } = useEnvironment();
  const [connectionTest, setConnectionTest] = useState<boolean | null>(null);

  const handleTestConnection = async () => {
    const result = await testConnection();
    setConnectionTest(result);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-sm text-gray-600">Detecting environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded">
        <p className="text-sm text-red-700">Environment Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
      <h3 className="text-sm font-semibold mb-2">Environment Information</h3>
      <div className="text-xs space-y-1">
        <div><strong>Mode:</strong> {environment.mode}</div>
        <div><strong>Platform:</strong> {environment.platform}</div>
        <div><strong>Performance:</strong> {environment.performanceProfile}</div>
        <div><strong>Native:</strong> {environment.isNative ? 'Yes' : 'No'}</div>

        <div className="mt-2">
          <strong>Capabilities:</strong>
          <ul className="ml-4 text-xs">
            <li>Files: {environment.capabilities.canReadFiles ? '✓' : '✗'} Read, {environment.capabilities.canWriteFiles ? '✓' : '✗'} Write</li>
            <li>Sync: {environment.capabilities.hasRealTimeSync ? '✓' : '✗'} Real-time, {environment.capabilities.hasCloudSync ? '✓' : '✗'} Cloud</li>
            <li>Export: {environment.capabilities.hasNativeExport ? '✓' : '✗'} Native</li>
            <li>Offline: {environment.capabilities.supportsOffline ? '✓' : '✗'} Supported</li>
          </ul>
        </div>

        <div className="mt-2">
          <button
            onClick={handleTestConnection}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Connection
          </button>
          {connectionTest !== null && (
            <span className={`ml-2 text-xs ${connectionTest ? 'text-green-600' : 'text-red-600'}`}>
              {connectionTest ? '✓ Connected' : '✗ Failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
