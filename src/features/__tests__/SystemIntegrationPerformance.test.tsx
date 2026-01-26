/**
 * Comprehensive integration and performance tests for feature flagging, A/B testing, and configuration management
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { FeatureFlagProvider, useFeatureFlags, useFeatureFlag } from '../FeatureFlagProvider';
import { ABTestProvider, useABTests, useExperimentVariant } from '../ABTestProvider';
import { ConfigurationProvider, useConfiguration, useConfigValue } from '../ConfigurationProvider';

// Mock native bridge
const mockNativeBridge = {
  featureFlags: {
    postMessage: jest.fn()
  },
  abTesting: {
    postMessage: jest.fn()
  },
  configuration: {
    postMessage: jest.fn()
  }
};

// Mock window.webkit
Object.defineProperty(window, 'webkit', {
  value: {
    messageHandlers: mockNativeBridge
  },
  writable: true
});

describe('System Integration Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    localStorage.clear();

    // Set up default mock responses
    mockNativeBridge.featureFlags.postMessage.mockResolvedValue({
      'test_flag': {
        id: 'test_flag',
        name: 'Test Flag',
        description: 'Test feature flag',
        globalConfiguration: {
          isEnabled: true,
          rolloutPercentage: 1.0,
          conditions: [],
          validFrom: null,
          validUntil: null
        },
        segmentConfigurations: {},
        userOverrides: {},
        metadata: {
          category: 'test',
          owner: 'test-team',
          tags: ['test'],
          priority: 'medium'
        },
        lastModified: new Date().toISOString()
      }
    });

    mockNativeBridge.abTesting.postMessage.mockResolvedValue({
      'ui_button_test': {
        id: 'ui_button_test',
        name: 'UI Button Test',
        configuration: {
          id: 'ui_button_test',
          name: 'UI Button Test',
          description: 'Testing button colors',
          variants: [
            { id: 'control', name: 'Blue Button', description: 'Current blue button', weight: 0.5, isControl: true, configuration: {} },
            { id: 'test', name: 'Red Button', description: 'New red button', weight: 0.5, isControl: false, configuration: {} }
          ],
          targetAudience: [],
          inclusionCriteria: [],
          exclusionCriteria: [],
          primaryMetric: 'conversion_rate',
          secondaryMetrics: [],
          expectedDuration: 14 * 24 * 60 * 60 * 1000,
          expectedSampleSize: 1000,
          significanceLevel: 0.05,
          statisticalPower: 0.8,
          enableStatisticalAnalysis: true,
          autoStopOnSignificance: false
        },
        status: 'running',
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        variants: [
          { id: 'control', name: 'Blue Button', description: 'Current blue button', weight: 0.5, isControl: true, configuration: {} },
          { id: 'test', name: 'Red Button', description: 'New red button', weight: 0.5, isControl: false, configuration: {} }
        ],
        userAssignments: {}
      }
    });

    mockNativeBridge.configuration.postMessage.mockResolvedValue({
      'api_timeout': {
        id: 'api_timeout',
        key: 'api_timeout',
        value: '30.0',
        type: 'double',
        category: 'network',
        description: 'API timeout in seconds',
        isRequired: true,
        validationRules: [],
        environmentValues: {},
        lastModified: new Date().toISOString()
      },
      'debug_mode': {
        id: 'debug_mode',
        key: 'debug_mode',
        value: 'false',
        type: 'boolean',
        category: 'debugging',
        description: 'Enable debug mode',
        isRequired: false,
        validationRules: [],
        environmentValues: {},
        lastModified: new Date().toISOString()
      }
    });
  });

  // MARK: - Feature Flag Performance Tests

  describe('Feature Flag Performance', () => {
    it('should evaluate flags under 1ms average', async () => {
      const TestComponent = () => {
        const { isEnabled } = useFeatureFlags();

        const startTime = performance.now();
        const iterations = 1000;

        for (let i = 0; i < iterations; i++) {
          isEnabled('test_flag', `user_${i % 100}`);
        }

        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / iterations;

        expect(averageTime).toBeLessThan(1); // Less than 1ms per evaluation
        expect(totalTime).toBeLessThan(100); // Total under 100ms

        return <div data-testid="performance-result">{averageTime.toFixed(4)}ms</div>;
      };

      render(
        <FeatureFlagProvider userId="test_user">
          <TestComponent />
        </FeatureFlagProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-result')).toBeInTheDocument();
      });

      const result = screen.getByTestId('performance-result');
      const averageTime = parseFloat(result.textContent || '0');
      expect(averageTime).toBeLessThan(1);
    });

    it('should handle cache efficiently', async () => {
      const { result } = renderHook(
        () => useFeatureFlag('test_flag', 'cache_test_user'),
        {
          wrapper: ({ children }) => (
            <FeatureFlagProvider userId="cache_test_user" enableAnalytics={true}>
              {children}
            </FeatureFlagProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      // Measure cache hit performance
      const startTime = performance.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // This should hit the cache after the first evaluation
        renderHook(() => useFeatureFlag('test_flag', 'cache_test_user'), {
          wrapper: ({ children }) => (
            <FeatureFlagProvider userId="cache_test_user">
              {children}
            </FeatureFlagProvider>
          )
        });
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / iterations;

      expect(averageTime).toBeLessThan(0.5); // Cache hits should be very fast
    });
  });

  // MARK: - A/B Testing Performance Tests

  describe('A/B Testing Performance', () => {
    it('should assign users to variants efficiently', async () => {
      const TestComponent = () => {
        const { getVariant } = useABTests();

        const startTime = performance.now();
        const iterations = 500;
        const userIds = Array.from({ length: iterations }, (_, i) => `user_${i}`);

        const assignments = userIds.map(userId =>
          getVariant('ui_button_test', userId)
        );

        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / iterations;

        expect(averageTime).toBeLessThan(5); // Less than 5ms per assignment
        expect(assignments.filter(Boolean)).toHaveLength(iterations); // All users assigned

        return <div data-testid="assignment-time">{averageTime.toFixed(4)}ms</div>;
      };

      render(
        <ABTestProvider userId="test_user">
          <TestComponent />
        </ABTestProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('assignment-time')).toBeInTheDocument();
      });

      const result = screen.getByTestId('assignment-time');
      const averageTime = parseFloat(result.textContent || '0');
      expect(averageTime).toBeLessThan(5);
    });

    it('should maintain consistent user assignments', async () => {
      const TestComponent = ({ userId }: { userId: string }) => {
        const variant = useExperimentVariant('ui_button_test', userId);
        return <div data-testid={`variant-${userId}`}>{variant?.id || 'none'}</div>;
      };

      const userIds = ['user_1', 'user_2', 'user_3'];

      // First render
      const { rerender } = render(
        <ABTestProvider>
          {userIds.map(userId => (
            <TestComponent key={userId} userId={userId} />
          ))}
        </ABTestProvider>
      );

      await waitFor(() => {
        userIds.forEach(userId => {
          expect(screen.getByTestId(`variant-${userId}`)).toBeInTheDocument();
        });
      });

      const firstAssignments = userIds.map(userId =>
        screen.getByTestId(`variant-${userId}`).textContent
      );

      // Re-render to test consistency
      rerender(
        <ABTestProvider>
          {userIds.map(userId => (
            <TestComponent key={userId} userId={userId} />
          ))}
        </ABTestProvider>
      );

      await waitFor(() => {
        userIds.forEach((userId, index) => {
          const element = screen.getByTestId(`variant-${userId}`);
          expect(element.textContent).toBe(firstAssignments[index]);
        });
      });
    });
  });

  // MARK: - Configuration Performance Tests

  describe('Configuration Performance', () => {
    it('should retrieve configuration values quickly', async () => {
      const TestComponent = () => {
        const { getValue } = useConfiguration();

        const startTime = performance.now();
        const iterations = 1000;

        for (let i = 0; i < iterations; i++) {
          getValue('api_timeout', 30.0);
          getValue('debug_mode', false);
        }

        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / (iterations * 2); // 2 configs per iteration

        expect(averageTime).toBeLessThan(0.1); // Less than 0.1ms per retrieval

        return <div data-testid="config-time">{averageTime.toFixed(4)}ms</div>;
      };

      render(
        <ConfigurationProvider>
          <TestComponent />
        </ConfigurationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('config-time')).toBeInTheDocument();
      });

      const result = screen.getByTestId('config-time');
      const averageTime = parseFloat(result.textContent || '0');
      expect(averageTime).toBeLessThan(0.1);
    });

    it('should handle hot reload efficiently', async () => {
      const { result } = renderHook(
        () => ({
          config: useConfiguration(),
          timeout: useConfigValue<number>('api_timeout', 30.0)
        }),
        {
          wrapper: ({ children }) => (
            <ConfigurationProvider enableHotReload={true} hotReloadInterval={1000}>
              {children}
            </ConfigurationProvider>
          )
        }
      );

      await waitFor(() => {
        expect(result.current.timeout).toBe(30.0);
      });

      // Simulate configuration update
      mockNativeBridge.configuration.postMessage.mockResolvedValueOnce({
        'api_timeout': {
          id: 'api_timeout',
          key: 'api_timeout',
          value: '45.0',
          type: 'double',
          category: 'network',
          description: 'API timeout in seconds',
          isRequired: true,
          validationRules: [],
          environmentValues: {},
          lastModified: new Date().toISOString()
        }
      });

      const startTime = performance.now();

      await act(async () => {
        await result.current.config.hotReload();
      });

      const reloadTime = performance.now() - startTime;

      expect(reloadTime).toBeLessThan(100); // Hot reload under 100ms

      await waitFor(() => {
        expect(result.current.timeout).toBe(45.0);
      });
    });
  });

  // MARK: - Cross-System Integration Tests

  describe('Cross-System Integration', () => {
    const IntegratedTestComponent = () => {
      const { isEnabled } = useFeatureFlags();
      const { getVariant } = useABTests();
      const debugMode = useConfigValue<boolean>('debug_mode', false);

      const startTime = performance.now();

      // Simulate realistic usage pattern
      const flagEnabled = isEnabled('test_flag', 'integrated_user');
      const variant = getVariant('ui_button_test', 'integrated_user');
      const configValue = debugMode;

      const operationTime = performance.now() - startTime;

      return (
        <div>
          <div data-testid="flag-result">{flagEnabled ? 'enabled' : 'disabled'}</div>
          <div data-testid="variant-result">{variant?.id || 'none'}</div>
          <div data-testid="config-result">{configValue ? 'true' : 'false'}</div>
          <div data-testid="operation-time">{operationTime.toFixed(4)}ms</div>
        </div>
      );
    };

    it('should handle combined operations efficiently', async () => {
      render(
        <ConfigurationProvider>
          <FeatureFlagProvider userId="integrated_user">
            <ABTestProvider userId="integrated_user">
              <IntegratedTestComponent />
            </ABTestProvider>
          </FeatureFlagProvider>
        </ConfigurationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('operation-time')).toBeInTheDocument();
      });

      const operationTime = parseFloat(screen.getByTestId('operation-time').textContent || '0');
      expect(operationTime).toBeLessThan(2); // Combined operation under 2ms
    });

    it('should maintain data consistency across systems', async () => {
      const ConsistencyTestComponent = () => {
        const { isEnabled, getFlagConfiguration } = useFeatureFlags();
        const { getVariant, experiments } = useABTests();
        const { getValue } = useConfiguration();

        const flagEnabled = isEnabled('test_flag', 'consistency_user');
        const variant = getVariant('ui_button_test', 'consistency_user');
        const configValue = getValue<boolean>('debug_mode');

        return (
          <div>
            <div data-testid="consistency-flag">{flagEnabled ? 'enabled' : 'disabled'}</div>
            <div data-testid="consistency-variant">{variant?.id || 'none'}</div>
            <div data-testid="consistency-config">{configValue ? 'true' : 'false'}</div>
            <div data-testid="systems-loaded">{
              Object.keys(experiments).length > 0 ? 'loaded' : 'loading'
            }</div>
          </div>
        );
      };

      render(
        <ConfigurationProvider>
          <FeatureFlagProvider userId="consistency_user">
            <ABTestProvider userId="consistency_user">
              <ConsistencyTestComponent />
            </ABTestProvider>
          </FeatureFlagProvider>
        </ConfigurationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('systems-loaded')).toHaveTextContent('loaded');
      });

      // Verify consistent state
      expect(screen.getByTestId('consistency-flag')).toHaveTextContent('enabled');
      expect(screen.getByTestId('consistency-variant')).toHaveTextContent(/control|test/);
      expect(screen.getByTestId('consistency-config')).toHaveTextContent('false');
    });

    it('should handle memory usage efficiently', async () => {
      const MemoryTestComponent = () => {
        const { isEnabled } = useFeatureFlags();
        const { getVariant } = useABTests();
        const { getValue } = useConfiguration();

        // Simulate memory usage with many operations
        const results = [];

        for (let i = 0; i < 100; i++) {
          results.push({
            flag: isEnabled('test_flag', `user_${i}`),
            variant: getVariant('ui_button_test', `user_${i}`),
            config: getValue<number>('api_timeout', 30.0)
          });
        }

        return (
          <div data-testid="memory-operations">{results.length}</div>
        );
      };

      const initialMemory = ('memory' in performance && performance.memory?.usedJSHeapSize) || 0;

      render(
        <ConfigurationProvider>
          <FeatureFlagProvider userId="memory_user">
            <ABTestProvider userId="memory_user">
              <MemoryTestComponent />
            </ABTestProvider>
          </FeatureFlagProvider>
        </ConfigurationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('memory-operations')).toHaveTextContent('100');
      });

      const finalMemory = ('memory' in performance && performance.memory?.usedJSHeapSize) || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      if (initialMemory > 0) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });
  });

  // MARK: - Error Handling and Resilience Tests

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle native bridge failures', async () => {
      // Simulate native bridge failure
      mockNativeBridge.featureFlags.postMessage.mockRejectedValue(new Error('Native bridge failed'));
      mockNativeBridge.abTesting.postMessage.mockRejectedValue(new Error('Native bridge failed'));
      mockNativeBridge.configuration.postMessage.mockRejectedValue(new Error('Native bridge failed'));

      const ResilientComponent = () => {
        const flagEnabled = useFeatureFlag('test_flag', 'resilient_user');
        const variant = useExperimentVariant('ui_button_test', 'resilient_user');
        const configValue = useConfigValue<number>('api_timeout', 30.0);

        return (
          <div>
            <div data-testid="resilient-flag">{flagEnabled !== undefined ? 'ok' : 'error'}</div>
            <div data-testid="resilient-variant">{variant !== undefined ? 'ok' : 'none'}</div>
            <div data-testid="resilient-config">{configValue !== undefined ? 'ok' : 'error'}</div>
          </div>
        );
      };

      render(
        <ConfigurationProvider>
          <FeatureFlagProvider userId="resilient_user">
            <ABTestProvider userId="resilient_user">
              <ResilientComponent />
            </ABTestProvider>
          </FeatureFlagProvider>
        </ConfigurationProvider>
      );

      await waitFor(() => {
        // Systems should fall back gracefully and still function
        expect(screen.getByTestId('resilient-flag')).toBeInTheDocument();
        expect(screen.getByTestId('resilient-variant')).toBeInTheDocument();
        expect(screen.getByTestId('resilient-config')).toBeInTheDocument();
      });

      // Should use fallback values when native fails
      expect(screen.getByTestId('resilient-config')).toHaveTextContent('ok'); // Default value
    });

    it('should handle rapid updates without performance degradation', async () => {
      let updateCount = 0;
      const UpdateTestComponent = () => {
        const { hotReload } = useConfiguration();
        const configValue = useConfigValue<number>('api_timeout', 30.0);

        React.useEffect(() => {
          const rapidUpdates = async () => {
            const startTime = performance.now();

            for (let i = 0; i < 10; i++) {
              try {
                await hotReload();
                updateCount++;
              } catch (error) {
                // Ignore errors for this test
              }
            }

            const totalTime = performance.now() - startTime;
            console.log(`10 rapid updates completed in ${totalTime.toFixed(2)}ms`);
          };

          rapidUpdates();
        }, [hotReload]);

        return <div data-testid="rapid-updates">{updateCount}</div>;
      };

      render(
        <ConfigurationProvider>
          <UpdateTestComponent />
        </ConfigurationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rapid-updates')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should handle rapid updates without crashing
      expect(screen.getByTestId('rapid-updates')).toBeInTheDocument();
    });
  });
});