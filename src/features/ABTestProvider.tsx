import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { useFeatureFlags } from './FeatureFlagProvider';

// Types for A/B testing system
export interface ABTest {
  id: string;
  name: string;
  configuration: ABTestConfiguration;
  status: ExperimentStatus;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  variants: ABTestVariant[];
  userAssignments: Record<string, UserAssignment>;
}

export interface ABTestConfiguration {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  targetAudience: string[];
  inclusionCriteria: UserCriteria[];
  exclusionCriteria: UserCriteria[];
  primaryMetric: string;
  secondaryMetrics: string[];
  expectedDuration: number;
  expectedSampleSize: number;
  significanceLevel: number;
  statisticalPower: number;
  enableStatisticalAnalysis: boolean;
  autoStopOnSignificance: boolean;
  linkedFeatureFlag?: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  weight: number;
  isControl: boolean;
  configuration: Record<string, string>;
}

export interface UserAssignment {
  userId: string;
  variantId: string;
  assignedAt: Date;
}

export interface UserCriteria {
  property: string;
  operator: string;
  value: string;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';

export interface ABTestEvent {
  id: string;
  experimentId: string;
  userId: string;
  variantId: string;
  eventType: ABTestEventType;
  value: number;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export type ABTestEventType = 'user_assigned' | 'page_view' | 'click' | 'conversion' | 'goal' | 'custom';

export interface ExperimentResults {
  experimentId: string;
  startDate: Date;
  endDate?: Date;
  status: 'running' | 'completed' | 'error';
  variantMetrics: Record<string, VariantMetrics>;
  statisticalAnalysis?: StatisticalAnalysis;
  summary?: ExperimentSummary;
  lastUpdated: Date;
}

export interface VariantMetrics {
  variantId: string;
  userCount: number;
  eventCount: number;
  totalValue: number;
  conversionRate: number;
  eventTypeMetrics: Record<string, EventTypeMetrics>;
  lastEvent?: Date;
}

export interface EventTypeMetrics {
  count: number;
  totalValue: number;
  conversionRate: number;
}

export interface StatisticalAnalysis {
  hasStatisticalSignificance: boolean;
  confidence: number;
  pValue: number;
  winningVariant?: string;
  effectSize: number;
  recommendedAction: 'continue' | 'declare_winner' | 'stop_inconclusive' | 'need_more_data';
  analysisDate: Date;
}

export interface ExperimentSummary {
  totalParticipants: number;
  totalEvents: number;
  duration: number;
  winningVariant?: string;
  confidence: number;
  stopReason: string;
}

// A/B test context
interface ABTestContextValue {
  experiments: Record<string, ABTest>;
  userAssignments: Record<string, string>;
  results: Record<string, ExperimentResults>;
  isLoading: boolean;
  error?: string;
  getVariant: (experimentId: string, userId?: string) => ABTestVariant | null;
  trackEvent: (eventType: ABTestEventType, experimentId: string, value?: number, metadata?: Record<string, unknown>) => void;
  getExperimentResults: (experimentId: string) => ExperimentResults | undefined;
  createExperiment: (config: ABTestConfiguration) => Promise<ABTest>;
  startExperiment: (experimentId: string) => Promise<void>;
  stopExperiment: (experimentId: string, reason?: string) => Promise<ExperimentResults>;
}

const ABTestContext = createContext<ABTestContextValue | undefined>(undefined);

// A/B test provider component
interface ABTestProviderProps {
  children: ReactNode;
  userId?: string;
  enableAnalytics?: boolean;
}

export const ABTestProvider: React.FC<ABTestProviderProps> = ({
  children,
  userId = 'anonymous',
  enableAnalytics = true
}) => {
  const [experiments, setExperiments] = useState<Record<string, ABTest>>({});
  const [userAssignments, setUserAssignments] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ExperimentResults>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const { isEnabled: isFeatureFlagEnabled } = useFeatureFlags();

  // Bridge communication for native integration
  const communicateWithNative = async (method: string, params: unknown = {}) => {
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.abTesting) {
      try {
        return await window.webkit.messageHandlers.abTesting.postMessage({
          method,
          params
        });
      } catch (error) {
        console.warn('Native A/B testing communication failed:', error);
        return null;
      }
    }
    return null;
  };

  // Load experiments and assignments
  const loadExperiments = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Try to get data from native first
      let experimentsData = await communicateWithNative('getExperiments');
      let assignmentsData = await communicateWithNative('getUserAssignments', { userId });
      let resultsData = await communicateWithNative('getExperimentResults');

      // Fallback to local storage if native unavailable
      if (!experimentsData && typeof window !== 'undefined') {
        const stored = localStorage.getItem('ab_test_experiments');
        if (stored) {
          experimentsData = JSON.parse(stored);
        }

        const storedAssignments = localStorage.getItem('ab_test_assignments');
        if (storedAssignments) {
          assignmentsData = JSON.parse(storedAssignments);
        }

        const storedResults = localStorage.getItem('ab_test_results');
        if (storedResults) {
          resultsData = JSON.parse(storedResults);
        }
      }

      // Use default experiments if nothing available
      if (!experimentsData) {
        experimentsData = getDefaultExperiments();
      }

      // Process and set data
      const processedExperiments = processExperiments(experimentsData || {});
      setExperiments(processedExperiments);
      setUserAssignments(assignmentsData || {});
      setResults(processResults(resultsData || {}));

      // Cache in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('ab_test_experiments', JSON.stringify(experimentsData));
        localStorage.setItem('ab_test_assignments', JSON.stringify(assignmentsData || {}));
        localStorage.setItem('ab_test_results', JSON.stringify(resultsData || {}));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load A/B test data';
      setError(errorMessage);
      console.error('Error loading A/B test data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Process experiments data to ensure proper typing
  const processExperiments = (data: unknown): Record<string, ABTest> => {
    if (!data || typeof data !== 'object') return {};

    const processed: Record<string, ABTest> = {};
    for (const [id, experiment] of Object.entries(data as Record<string, unknown>)) {
      if (isValidExperiment(experiment)) {
        processed[id] = {
          ...experiment as ABTest,
          createdAt: new Date(experiment.createdAt),
          startedAt: experiment.startedAt ? new Date(experiment.startedAt) : undefined,
          stoppedAt: experiment.stoppedAt ? new Date(experiment.stoppedAt) : undefined
        };
      }
    }
    return processed;
  };

  // Process results data
  const processResults = (data: unknown): Record<string, ExperimentResults> => {
    if (!data || typeof data !== 'object') return {};

    const processed: Record<string, ExperimentResults> = {};
    for (const [id, result] of Object.entries(data as Record<string, unknown>)) {
      if (isValidExperimentResults(result)) {
        processed[id] = {
          ...result as ExperimentResults,
          startDate: new Date(result.startDate),
          endDate: result.endDate ? new Date(result.endDate) : undefined,
          lastUpdated: new Date(result.lastUpdated)
        };
      }
    }
    return processed;
  };

  // Validation functions
  const isValidExperiment = (experiment: unknown): experiment is ABTest => {
    if (!experiment || typeof experiment !== 'object') return false;
    const e = experiment as Partial<ABTest>;
    return !!(e.id && e.name && e.configuration && e.variants && Array.isArray(e.variants));
  };

  const isValidExperimentResults = (result: unknown): result is ExperimentResults => {
    if (!result || typeof result !== 'object') return false;
    const r = result as Partial<ExperimentResults>;
    return !!(r.experimentId && r.startDate && r.status);
  };

  // Get variant assignment for user
  const getVariant = useMemo(() => {
    return (experimentId: string, targetUserId?: string): ABTestVariant | null => {
      const currentUserId = targetUserId || userId;
      const experiment = experiments[experimentId];

      if (!experiment || experiment.status !== 'running') {
        return null;
      }

      // Check if already assigned
      if (userAssignments[currentUserId] === experimentId) {
        const assignment = experiment.userAssignments[currentUserId];
        if (assignment) {
          return experiment.variants.find(v => v.id === assignment.variantId) || null;
        }
      }

      // Check eligibility
      if (!isUserEligible(currentUserId, experiment)) {
        return null;
      }

      // Assign user to variant
      const variant = assignUserToVariant(currentUserId, experiment);
      if (variant) {
        // Update assignments
        setUserAssignments(prev => ({ ...prev, [currentUserId]: experimentId }));

        // Update experiment with user assignment
        const assignment: UserAssignment = {
          userId: currentUserId,
          variantId: variant.id,
          assignedAt: new Date()
        };

        setExperiments(prev => ({
          ...prev,
          [experimentId]: {
            ...experiment,
            userAssignments: {
              ...experiment.userAssignments,
              [currentUserId]: assignment
            }
          }
        }));

        // Track assignment event
        trackEvent('user_assigned', experimentId, 1.0, { variant: variant.id });

        // Sync with native
        communicateWithNative('updateUserAssignment', {
          userId: currentUserId,
          experimentId,
          variantId: variant.id
        });
      }

      return variant;
    };
  }, [experiments, userAssignments, userId]);

  // Track experiment events
  const trackEvent = (
    eventType: ABTestEventType,
    experimentId: string,
    value: number = 1.0,
    metadata: Record<string, unknown> = {}
  ) => {
    const experiment = experiments[experimentId];
    if (!experiment || !userAssignments[userId]) {
      return;
    }

    const assignment = experiment.userAssignments[userId];
    if (!assignment) {
      return;
    }

    const event: ABTestEvent = {
      id: generateEventId(),
      experimentId,
      userId,
      variantId: assignment.variantId,
      eventType,
      value,
      metadata,
      timestamp: new Date()
    };

    // Send to native for processing
    communicateWithNative('trackEvent', event);

    // Update local results
    updateLocalResults(event);

    if (enableAnalytics) {
      console.log('A/B Test Event:', event);
    }
  };

  // Update local experiment results
  const updateLocalResults = (event: ABTestEvent) => {
    setResults(prev => {
      const existing = prev[event.experimentId] || {
        experimentId: event.experimentId,
        startDate: new Date(),
        status: 'running' as const,
        variantMetrics: {},
        lastUpdated: new Date()
      };

      const variantMetrics = { ...existing.variantMetrics };
      const variant = variantMetrics[event.variantId] || {
        variantId: event.variantId,
        userCount: 0,
        eventCount: 0,
        totalValue: 0,
        conversionRate: 0,
        eventTypeMetrics: {}
      };

      variant.eventCount += 1;
      variant.totalValue += event.value;
      variant.lastEvent = event.timestamp;

      // Update event type metrics
      const eventTypeMetrics = variant.eventTypeMetrics[event.eventType] || {
        count: 0,
        totalValue: 0,
        conversionRate: 0
      };
      eventTypeMetrics.count += 1;
      eventTypeMetrics.totalValue += event.value;
      variant.eventTypeMetrics[event.eventType] = eventTypeMetrics;

      variantMetrics[event.variantId] = variant;

      return {
        ...prev,
        [event.experimentId]: {
          ...existing,
          variantMetrics,
          lastUpdated: new Date()
        }
      };
    });
  };

  // User eligibility check
  const isUserEligible = (userId: string, experiment: ABTest): boolean => {
    const config = experiment.configuration;

    // Check feature flag if linked
    if (config.linkedFeatureFlag) {
      if (!isFeatureFlagEnabled(config.linkedFeatureFlag, userId)) {
        return false;
      }
    }

    // Check exclusion criteria
    for (const criteria of config.exclusionCriteria) {
      if (evaluateUserCriteria(userId, criteria)) {
        return false;
      }
    }

    // Check inclusion criteria
    if (config.inclusionCriteria.length > 0) {
      return config.inclusionCriteria.every(criteria =>
        evaluateUserCriteria(userId, criteria)
      );
    }

    return true;
  };

  // Evaluate user criteria
  const evaluateUserCriteria = (_userId: string, criteria: UserCriteria): boolean => {
    // This would typically integrate with user profile system
    // For demo purposes, simplified implementation
    switch (criteria.property) {
      case 'user_type':
        return criteria.value === 'beta'; // Assume beta users for testing
      case 'platform':
        return criteria.value === 'web'; // Assume web platform
      default:
        return false;
    }
  };

  // Assign user to variant
  const assignUserToVariant = (userId: string, experiment: ABTest): ABTestVariant | null => {
    // Use deterministic hash-based assignment for consistency
    const hash = simpleHash(userId + experiment.id);
    const weights = experiment.variants.map(v => v.weight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const threshold = (hash % 10000) / 10000 * totalWeight;
    let currentWeight = 0;

    for (const variant of experiment.variants) {
      currentWeight += variant.weight;
      if (threshold <= currentWeight) {
        return variant;
      }
    }

    // Fallback to control
    return experiment.variants.find(v => v.isControl) || experiment.variants[0];
  };

  // Simple hash function for consistent assignment
  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  // Generate unique event ID
  const generateEventId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Get experiment results
  const getExperimentResults = (experimentId: string): ExperimentResults | undefined => {
    return results[experimentId];
  };

  // Create new experiment
  const createExperiment = async (config: ABTestConfiguration): Promise<ABTest> => {
    const experiment: ABTest = {
      id: config.id,
      name: config.name,
      configuration: config,
      status: 'draft',
      createdAt: new Date(),
      variants: config.variants,
      userAssignments: {}
    };

    setExperiments(prev => ({ ...prev, [experiment.id]: experiment }));

    // Sync with native
    await communicateWithNative('createExperiment', experiment);

    return experiment;
  };

  // Start experiment
  const startExperiment = async (experimentId: string): Promise<void> => {
    const experiment = experiments[experimentId];
    if (!experiment || experiment.status !== 'draft') {
      throw new Error('Cannot start experiment');
    }

    const updatedExperiment: ABTest = {
      ...experiment,
      status: 'running',
      startedAt: new Date()
    };

    setExperiments(prev => ({ ...prev, [experimentId]: updatedExperiment }));

    // Sync with native
    await communicateWithNative('startExperiment', { experimentId });
  };

  // Stop experiment
  const stopExperiment = async (experimentId: string, reason = 'Manual stop'): Promise<ExperimentResults> => {
    const experiment = experiments[experimentId];
    if (!experiment || experiment.status !== 'running') {
      throw new Error('Cannot stop experiment');
    }

    const updatedExperiment: ABTest = {
      ...experiment,
      status: 'stopped',
      stoppedAt: new Date()
    };

    setExperiments(prev => ({ ...prev, [experimentId]: updatedExperiment }));

    // Generate final results
    const finalResults: ExperimentResults = {
      experimentId,
      startDate: experiment.startedAt || experiment.createdAt,
      endDate: new Date(),
      status: 'completed',
      variantMetrics: results[experimentId]?.variantMetrics || {},
      summary: {
        totalParticipants: Object.keys(experiment.userAssignments).length,
        totalEvents: 0, // Would be calculated from stored events
        duration: Date.now() - (experiment.startedAt || experiment.createdAt).getTime(),
        winningVariant: undefined, // Would be determined by analysis
        confidence: 0,
        stopReason: reason
      },
      lastUpdated: new Date()
    };

    setResults(prev => ({ ...prev, [experimentId]: finalResults }));

    // Sync with native
    await communicateWithNative('stopExperiment', { experimentId, reason });

    return finalResults;
  };

  // Default experiments for demo
  const getDefaultExperiments = (): Record<string, ABTest> => {
    const now = new Date();
    return {
      'ui_button_test': {
        id: 'ui_button_test',
        name: 'UI Button Color Test',
        configuration: {
          id: 'ui_button_test',
          name: 'UI Button Color Test',
          description: 'Testing different button colors for conversion rate',
          variants: [
            {
              id: 'control',
              name: 'Blue Button',
              description: 'Current blue button',
              weight: 0.5,
              isControl: true,
              configuration: { button_color: 'blue' }
            },
            {
              id: 'test',
              name: 'Red Button',
              description: 'New red button',
              weight: 0.5,
              isControl: false,
              configuration: { button_color: 'red' }
            }
          ],
          targetAudience: [],
          inclusionCriteria: [],
          exclusionCriteria: [],
          primaryMetric: 'conversion_rate',
          secondaryMetrics: ['click_through_rate'],
          expectedDuration: 14 * 24 * 60 * 60 * 1000,
          expectedSampleSize: 1000,
          significanceLevel: 0.05,
          statisticalPower: 0.8,
          enableStatisticalAnalysis: true,
          autoStopOnSignificance: false
        },
        status: 'running',
        createdAt: now,
        startedAt: now,
        variants: [
          {
            id: 'control',
            name: 'Blue Button',
            description: 'Current blue button',
            weight: 0.5,
            isControl: true,
            configuration: { button_color: 'blue' }
          },
          {
            id: 'test',
            name: 'Red Button',
            description: 'New red button',
            weight: 0.5,
            isControl: false,
            configuration: { button_color: 'red' }
          }
        ],
        userAssignments: {}
      }
    };
  };

  // Initialize experiments on mount
  useEffect(() => {
    loadExperiments();
  }, []);

  // Set up native bridge listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleNativeMessage = (event: MessageEvent) => {
        if (event.data?.type === 'abTestUpdate') {
          const updatedExperiments = processExperiments(event.data.experiments);
          setExperiments(updatedExperiments);
        }
      };

      window.addEventListener('message', handleNativeMessage);
      return () => window.removeEventListener('message', handleNativeMessage);
    }
  }, []);

  const contextValue: ABTestContextValue = {
    experiments,
    userAssignments,
    results,
    isLoading,
    error,
    getVariant,
    trackEvent,
    getExperimentResults,
    createExperiment,
    startExperiment,
    stopExperiment
  };

  return (
    <ABTestContext.Provider value={contextValue}>
      {children}
    </ABTestContext.Provider>
  );
};

// Hook for using A/B tests
export const useABTests = (): ABTestContextValue => {
  const context = useContext(ABTestContext);
  if (!context) {
    throw new Error('useABTests must be used within an ABTestProvider');
  }
  return context;
};

// Hook for specific experiment variant
export const useExperimentVariant = (experimentId: string, userId?: string): ABTestVariant | null => {
  const { getVariant } = useABTests();
  return getVariant(experimentId, userId);
};

// Hook for tracking experiment events
export const useExperimentTracking = () => {
  const { trackEvent } = useABTests();
  return trackEvent;
};

// Conditional rendering component based on A/B test
interface ABTestWrapperProps {
  experimentId: string;
  variantId: string;
  children: ReactNode;
  fallback?: ReactNode;
  userId?: string;
}

export const ABTestWrapper: React.FC<ABTestWrapperProps> = ({
  experimentId,
  variantId,
  children,
  fallback = null,
  userId
}) => {
  const variant = useExperimentVariant(experimentId, userId);

  if (variant && variant.id === variantId) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

// Higher-order component for A/B testing
export function withABTest<P extends object>(
  experimentId: string,
  variantId: string,
  WrappedComponent: React.ComponentType<P>
) {
  return function ABTestHOC(props: P) {
    const variant = useExperimentVariant(experimentId);

    if (variant && variant.id === variantId) {
      return <WrappedComponent {...props} />;
    }

    return null;
  };
}

// Declare global types for native bridge
// Window interface extension moved to browser-bridge.d.ts to avoid conflicts

export default ABTestProvider;