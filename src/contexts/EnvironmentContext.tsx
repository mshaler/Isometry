/**
 * Environment Context
 *
 * Provides comprehensive environment detection and automatic database provider selection
 * Handles WebView and HTTP API providers
 */

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
// Bridge eliminated in v4 - sql.js direct access
// import { Environment, postMessage } from '../utils/webview/webview-bridge';
// import { bridgeLogger } from '../utils/logging/logger';
// import { waitForWebViewBridge } from '../utils/webview-bridge-waiter';

// Stub implementations for bridge elimination
const Environment = {
  isWebView: () => false,
  info: () => ({ platform: 'browser', version: '4.0', isNative: false })
};
const bridgeLogger = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};
const waitForWebViewBridge = async () => false;

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
        bridgeLogger.debug('Environment: Using forced mode', { forcedMode });
        return forcedMode;
      }

      // Debug environment detection
      bridgeLogger.debug('Environment: Starting detection', {
        webkitAvailable: typeof window !== 'undefined' && typeof window.webkit !== 'undefined',
        messageHandlersAvailable: typeof window !== 'undefined' && typeof window.webkit?.messageHandlers !== 'undefined',
        userAgent: navigator.userAgent
      });

      // Check for immediate WebView indicators
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const isIsometryNative = userAgent.includes('IsometryNative');
      const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';

      // Quick browser check - if no WebKit and not IsometryNative, skip bridge detection
      if (!isIsometryNative && !hasWebKit) {
        bridgeLogger.debug('Environment: Standard browser detected - skipping WebView bridge detection', {
          userAgent: userAgent.substring(0, 60) + '...'
        });
        return DatabaseMode.FALLBACK;
      }

      if (isIsometryNative) {
        bridgeLogger.debug('Environment: IsometryNative user agent detected - forcing WebView mode', {
          fullUserAgent: userAgent
        });
        bridgeLogger.info('IsometryNative user agent detected, using WebView mode');
        return DatabaseMode.WEBVIEW_BRIDGE;
      }

      // ROBUST BRIDGE DETECTION: Wait for WebView bridge to be fully ready
      bridgeLogger.debug('Environment: Waiting for WebView bridge initialization', {});
      const bridgeReady = await waitForWebViewBridge(1000); // 1 second timeout for faster browser fallback

      if (bridgeReady) {
        bridgeLogger.debug('Environment: WebView bridge detected after waiting', {});
        bridgeLogger.info('WebView bridge detected');
        return DatabaseMode.WEBVIEW_BRIDGE;
      }

      // Fallback: Check for any WebKit indicators immediately
      if (typeof window !== 'undefined' && typeof window.webkit !== 'undefined') {
        bridgeLogger.warn('Environment: WebKit detected but bridge not ready, forcing WebView mode', {});
        bridgeLogger.info('WebKit available but bridge not ready, using WebView mode anyway');
        return DatabaseMode.WEBVIEW_BRIDGE;
      }

      // PRIORITY 3: Check for HTTP API availability (lowest priority)
      // Only test if we're definitely NOT in a WebView environment
      bridgeLogger.debug('Environment: No WebKit or IsometryNative detected, testing HTTP API', {});
      if (await testHTTPAPIConnection()) {
        bridgeLogger.debug('Environment: HTTP API detected', {});
        bridgeLogger.info('HTTP API detected');
        return DatabaseMode.HTTP_API;
      }

      // Fall back to FALLBACK mode (no backend required)
      bridgeLogger.warn('Environment: No backend available, using fallback mode', {});
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
    console.log('🧪 Testing WebView bridge...');

    // First check if we have webkit object
    if (typeof window.webkit === 'undefined') {
      console.log('❌ WebView bridge: window.webkit not available');
      return false;
    }

    bridgeLogger.debug('WebView bridge: window.webkit available', {});

    // Check if messageHandlers is available
    if (typeof window.webkit.messageHandlers === 'undefined') {
      console.log('❌ WebView bridge: messageHandlers not available');
      return false;
    }

    bridgeLogger.debug('WebView bridge: messageHandlers available', {
      availableHandlers: Object.keys(window.webkit.messageHandlers)
    });

    // Check if database handler exists
    if (typeof window.webkit.messageHandlers.database === 'undefined') {
      console.log('❌ WebView bridge: database handler not available');
      return false;
    }

    bridgeLogger.debug('WebView bridge: database handler available, testing ping', {});

    try {
      // Bridge eliminated - sql.js direct access
      // const response = await postMessage('database', 'ping', {});
      bridgeLogger.debug('WebView bridge: Ping simulated (bridge eliminated)');
      return false; // Bridge no longer exists
    } catch (error) {
      console.log('❌ WebView bridge: Ping failed:', error);
      bridgeLogger.debug('WebView bridge test failed', { error: error as Error });
      return false;
    }
  };

  /**
   * Test HTTP API connection
   */
  const testHTTPAPIConnection = async (): Promise<boolean> => {
    // Only test HTTP API if we're definitely NOT in a WebView environment
    // Check both the user agent and webkit object
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
    const isNativeUserAgent = userAgent.includes('IsometryNative');
    const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';
    const envIsWebView = Environment.isWebView();

    if (isNativeUserAgent || hasWebKit || envIsWebView) {
      bridgeLogger.debug('HTTP API test skipped: WebView environment detected', {});
      console.log(`  - IsometryNative user agent: ${isNativeUserAgent}`);
      console.log(`  - Has WebKit: ${hasWebKit}`);
      console.log(`  - Environment.isWebView(): ${envIsWebView}`);
      return false;
    }

    console.log('🧪 HTTP API test starting (no WebView indicators found)...');

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
