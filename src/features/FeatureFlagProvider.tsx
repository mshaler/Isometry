import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useMemo } from 'react';

// Types for feature flag system
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  globalConfiguration: FlagConfiguration;
  segmentConfigurations: Record<string, FlagConfiguration>;
  userOverrides: Record<string, FlagConfiguration>;
  metadata: FlagMetadata;
  lastModified: Date;
}

export interface FlagConfiguration {
  isEnabled: boolean;
  rolloutPercentage: number;
  conditions: FlagCondition[];
  validFrom?: Date;
  validUntil?: Date;
}

export interface FlagCondition {
  type: 'appVersion' | 'osVersion' | 'deviceModel' | 'userProperty' | 'timeWindow';
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'matches';
  value: string;
}

export interface FlagMetadata {
  category: string;
  owner: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  abTestId?: string;
}

export interface UserSegment {
  id: string;
  name: string;
  criteria: SegmentCriterion[];
}

export interface SegmentCriterion {
  property: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'matches';
  value: string;
}

// Feature flag context
interface FeatureFlagContextValue {
  flags: Record<string, FeatureFlag>;
  isLoading: boolean;
  error?: string;
  isEnabled: (flagName: string, userId?: string, userSegment?: UserSegment) => boolean;
  getFlagConfiguration: (flagName: string) => FeatureFlag | undefined;
  refresh: () => Promise<void>;
  evaluationMetrics: EvaluationMetrics;
}

interface EvaluationMetrics {
  totalEvaluations: number;
  averageEvaluationTime: number;
  cacheHitRate: number;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

// Feature flag provider component
interface FeatureFlagProviderProps {
  children: ReactNode;
  userId?: string;
  userSegment?: UserSegment;
  enableAnalytics?: boolean;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({
  children,
  userId,
  userSegment,
  enableAnalytics = true
}) => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics>({
    totalEvaluations: 0,
    averageEvaluationTime: 0,
    cacheHitRate: 0
  });
  const isMountedRef = useRef(true);

  // Evaluation cache for performance
  const [evaluationCache, setEvaluationCache] = useState<
    Map<string, { result: boolean; timestamp: number }>
  >(new Map());
  const cacheValidityMs = 30000; // 30 seconds

  // Bridge communication for native integration
  const communicateWithNative = async (method: string, params: unknown = {}) => {
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.featureFlags) {
      try {
        return await window.webkit.messageHandlers.featureFlags.postMessage({
          method,
          params
        });
      } catch (error) {
        console.warn('Native communication failed, falling back to local storage:', error);
        return null;
      }
    }
    return null;
  };

  // Load flags from native or local storage
  const loadFlags = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Try to get flags from native first
      let flagsData = await communicateWithNative('getFlags');

      // Fallback to local storage if native unavailable
      if (!flagsData && typeof window !== 'undefined') {
        const stored = localStorage.getItem('feature_flags');
        if (stored) {
          flagsData = JSON.parse(stored);
        }
      }

      // Use default flags if nothing available
      if (!flagsData) {
        flagsData = getDefaultFlags();
      }

      // Convert dates from strings if needed
      const processedFlags = processFlags(flagsData);
      setFlags(processedFlags);

      // Cache in local storage for offline access
      if (typeof window !== 'undefined') {
        localStorage.setItem('feature_flags', JSON.stringify(flagsData));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load feature flags';
      setError(errorMessage);
      console.error('Error loading feature flags:', err);

      // Load cached flags as fallback
      try {
        const cached = localStorage.getItem('feature_flags');
        if (cached) {
          const cachedFlags = processFlags(JSON.parse(cached));
          setFlags(cachedFlags);
        }
      } catch (cacheError) {
        console.error('Failed to load cached flags:', cacheError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Process flag data to ensure proper typing
  const processFlags = (flagsData: unknown): Record<string, FeatureFlag> => {
    if (!flagsData || typeof flagsData !== 'object') {
      return {};
    }

    const processed: Record<string, FeatureFlag> = {};

    for (const [name, flagData] of Object.entries(flagsData as Record<string, unknown>)) {
      if (isValidFlag(flagData)) {
        processed[name] = {
          ...flagData as FeatureFlag,
          lastModified: new Date(flagData.lastModified)
        };
      }
    }

    return processed;
  };

  // Validate flag structure
  const isValidFlag = (flag: unknown): flag is FeatureFlag => {
    if (!flag || typeof flag !== 'object') return false;

    const f = flag as Partial<FeatureFlag>;
    return !!(
      f.id &&
      f.name &&
      f.description &&
      f.globalConfiguration &&
      f.metadata
    );
  };

  // Use ref for cache to avoid dependency array issues
  const evaluationCacheRef = useRef(evaluationCache);
  evaluationCacheRef.current = evaluationCache;

  // Flag evaluation with caching and analytics
  const isEnabled = useMemo(() => {
    return (flagName: string, targetUserId?: string, targetUserSegment?: UserSegment): boolean => {
      const startTime = performance.now();
      const currentUserId = targetUserId || userId;
      const currentUserSegment = targetUserSegment || userSegment;

      // Check cache first
      const cacheKey = `${flagName}:${currentUserId || 'anonymous'}:${currentUserSegment?.id || 'none'}`;
      const cached = evaluationCacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < cacheValidityMs) {
        // Update metrics for cache hit
        if (enableAnalytics) {
          setEvaluationMetrics(prev => ({
            ...prev,
            totalEvaluations: prev.totalEvaluations + 1,
            cacheHitRate: (prev.cacheHitRate * prev.totalEvaluations + 1) / (prev.totalEvaluations + 1)
          }));
        }
        return cached.result;
      }

      // Evaluate flag
      const flag = flags[flagName];
      if (!flag) {
        console.warn(`Feature flag not found: ${flagName}`);
        return false;
      }

      let result = false;

      try {
        // Hierarchical evaluation: user override → segment → global
        if (currentUserId && flag.userOverrides[currentUserId]) {
          result = evaluateConfiguration(flag.userOverrides[currentUserId]);
        } else if (currentUserSegment && flag.segmentConfigurations[currentUserSegment.id]) {
          result = evaluateConfiguration(flag.segmentConfigurations[currentUserSegment.id]);
        } else {
          result = evaluateConfiguration(flag.globalConfiguration);
        }

        // Cache result
        evaluationCacheRef.current.set(cacheKey, { result, timestamp: now });

        // Update analytics
        if (enableAnalytics) {
          const evaluationTime = performance.now() - startTime;
          setEvaluationMetrics(prev => ({
            totalEvaluations: prev.totalEvaluations + 1,
            averageEvaluationTime:
              (prev.averageEvaluationTime * prev.totalEvaluations + evaluationTime) /
              (prev.totalEvaluations + 1),
            cacheHitRate: (prev.cacheHitRate * prev.totalEvaluations) / (prev.totalEvaluations + 1)
          }));

          // Send analytics to native if available
          communicateWithNative('trackEvaluation', {
            flagName,
            evaluationTime,
            userId,
            result
          });
        }
      } catch (error) {
        console.error(`Error evaluating feature flag ${flagName}:`, error);
        return false;
      }

      return result;
    };
  }, [flags, userId, userSegment, enableAnalytics]);

  // Evaluate individual flag configuration
  const evaluateConfiguration = (config: FlagConfiguration): boolean => {
    if (!config.isEnabled) return false;

    // Check time window
    const now = new Date();
    if (config.validFrom && now < config.validFrom) return false;
    if (config.validUntil && now > config.validUntil) return false;

    // Check rollout percentage (simple hash-based distribution)
    if (config.rolloutPercentage < 1.0) {
      const hash = simpleHash(`${userId || 'anonymous'}`);
      const threshold = config.rolloutPercentage * 100;
      if ((hash % 100) >= threshold) return false;
    }

    // Check conditions
    for (const condition of config.conditions || []) {
      if (!evaluateCondition(condition)) return false;
    }

    return true;
  };

  // Evaluate individual condition
  const evaluateCondition = (condition: FlagCondition): boolean => {
    let actualValue: string;

    switch (condition.type) {
      case 'appVersion':
        actualValue = getAppVersion();
        break;
      case 'osVersion':
        actualValue = getOSVersion();
        break;
      case 'deviceModel':
        actualValue = getDeviceModel();
        break;
      case 'userProperty':
        actualValue = getUserProperty(condition.value.split('=')[0]);
        break;
      case 'timeWindow':
        actualValue = new Date().toISOString();
        break;
      default:
        return false;
    }

    return compareValues(actualValue, condition.operator, condition.value);
  };

  // Value comparison based on operator
  const compareValues = (actual: string, operator: string, expected: string): boolean => {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'greaterThan':
        return actual > expected;
      case 'lessThan':
        return actual < expected;
      case 'contains':
        return actual.includes(expected);
      case 'matches':
        try {
          return new RegExp(expected).test(actual);
        } catch {
          return false;
        }
      default:
        return false;
    }
  };

  // Helper functions for environment detection
  const getAppVersion = (): string => {
    return process.env.REACT_APP_VERSION || '1.0.0';
  };

  const getOSVersion = (): string => {
    if (typeof navigator !== 'undefined') {
      return navigator.platform || 'unknown';
    }
    return 'unknown';
  };

  const getDeviceModel = (): string => {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent || 'unknown';
    }
    return 'unknown';
  };

  const getUserProperty = (property: string): string => {
    // This would typically come from user context or props
    if (property === 'beta_user') {
      return 'true'; // For demo purposes
    }
    return '';
  };

  // Simple hash function for consistent rollout distribution
  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  // Get flag configuration
  const getFlagConfiguration = (flagName: string): FeatureFlag | undefined => {
    return flags[flagName];
  };

  // Refresh flags from source
  const refresh = async (): Promise<void> => {
    await loadFlags();
  };

  // Default flags for fallback
  const getDefaultFlags = (): Record<string, FeatureFlag> => {
    const now = new Date();
    return {
      'advanced_analytics': {
        id: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Enable ML-powered analytics and insights',
        globalConfiguration: {
          isEnabled: false,
          rolloutPercentage: 0.0,
          conditions: []
        },
        segmentConfigurations: {},
        userOverrides: {},
        metadata: {
          category: 'analytics',
          owner: 'beta-team',
          tags: ['ml', 'analytics', 'beta'],
          priority: 'high'
        },
        lastModified: now
      },
      'adaptive_ui': {
        id: 'adaptive_ui',
        name: 'Adaptive UI',
        description: 'Enable ML-powered adaptive user interfaces',
        globalConfiguration: {
          isEnabled: false,
          rolloutPercentage: 0.1,
          conditions: []
        },
        segmentConfigurations: {},
        userOverrides: {},
        metadata: {
          category: 'user-experience',
          owner: 'ui-team',
          tags: ['ml', 'ui', 'personalization'],
          priority: 'medium'
        },
        lastModified: now
      }
    };
  };

  // Initialize flags on mount
  useEffect(() => {
    loadFlags();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Set up native bridge listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Listen for flag updates from native
      const handleNativeMessage = (event: MessageEvent) => {
        if (event.data?.type === 'featureFlagUpdate') {
          const updatedFlags = processFlags(event.data.flags);
          setFlags(updatedFlags);

          // Clear cache when flags update
          setEvaluationCache(new Map());
        }
      };

      window.addEventListener('message', handleNativeMessage);
      return () => window.removeEventListener('message', handleNativeMessage);
    }
  }, []);

  // Clean up old cache entries periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentCache = evaluationCacheRef.current;
      const newCache = new Map();

      for (const [key, value] of currentCache) {
        if ((now - value.timestamp) < cacheValidityMs) {
          newCache.set(key, value);
        }
      }

      setEvaluationCache(newCache);
    }, cacheValidityMs);

    return () => clearInterval(interval);
  }, []); // Empty dependency array - uses ref for current cache

  const contextValue: FeatureFlagContextValue = {
    flags,
    isLoading,
    error,
    isEnabled,
    getFlagConfiguration,
    refresh,
    evaluationMetrics
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

// Hook for using feature flags
export const useFeatureFlags = (): FeatureFlagContextValue => {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
};

// Hook for individual flag evaluation
export const useFeatureFlag = (flagName: string, userId?: string, userSegment?: UserSegment): boolean => {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagName, userId, userSegment);
};

// Hook for flag metadata
export const useFlagMetadata = (flagName: string): FlagMetadata | undefined => {
  const { getFlagConfiguration } = useFeatureFlags();
  return getFlagConfiguration(flagName)?.metadata;
};

// Conditional rendering component
interface FeatureFlagWrapperProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
  userId?: string;
  userSegment?: UserSegment;
}

export const FeatureFlagWrapper: React.FC<FeatureFlagWrapperProps> = ({
  flag,
  children,
  fallback = null,
  userId,
  userSegment
}) => {
  const isEnabled = useFeatureFlag(flag, userId, userSegment);
  return <>{isEnabled ? children : fallback}</>;
};

// Declare global types for native bridge
// Window interface extension moved to browser-bridge.d.ts to avoid conflicts

export default FeatureFlagProvider;