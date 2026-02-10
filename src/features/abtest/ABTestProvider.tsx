/**
 * A/B Test Provider Implementation
 *
 * Main provider component for A/B testing
 */

import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { ABTestContext } from './context';
import { devLogger } from '../../utils/logging/dev-logger';
import type {
  ABTest,
  ABTestConfiguration,
  ABTestVariant,
  UserAssignment,
  TestMetrics,
  ExperimentAnalysis,
  ConversionEvent
} from './types';

interface ABTestProviderProps {
  children: ReactNode;
  userId?: string;
  enableAnalytics?: boolean;
}

export const ABTestProvider: React.FC<ABTestProviderProps> = ({
  children,
  userId = 'default-user',
  enableAnalytics = true
}) => {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  // Core operations
  const createTest = useCallback(async (config: ABTestConfiguration): Promise<ABTest> => {
    const newTest: ABTest = {
      id: `test-${Date.now()}`,
      name: config.name,
      configuration: config,
      status: 'draft',
      createdAt: new Date(),
      variants: config.variants,
      userAssignments: {}
    };
    
    setTests(prev => [...prev, newTest]);
    devLogger.info('Created A/B test:', newTest.id);
    
    return newTest;
  }, []);

  const startTest = useCallback(async (testId: string) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status: 'active', startedAt: new Date() }
        : test
    ));
    devLogger.info('Started A/B test:', testId);
  }, []);

  const stopTest = useCallback(async (testId: string) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status: 'stopped', stoppedAt: new Date() }
        : test
    ));
    devLogger.info('Stopped A/B test:', testId);
  }, []);

  const deleteTest = useCallback(async (testId: string) => {
    setTests(prev => prev.filter(test => test.id !== testId));
    devLogger.info('Deleted A/B test:', testId);
  }, []);

  // User assignment
  const getUserAssignment = useCallback((testId: string, userId: string): UserAssignment | null => {
    const test = tests.find(t => t.id === testId);
    return test?.userAssignments[userId] || null;
  }, [tests]);

  const assignUser = useCallback(async (testId: string, userId: string): Promise<UserAssignment> => {
    const test = tests.find(t => t.id === testId);
    if (!test) {
      throw new Error('Test not found');
    }

    // Simple random assignment (in real implementation, use proper assignment logic)
    const variants = test.variants.filter(v => !v.isControl);
    const selectedVariant = variants[Math.floor(Math.random() * variants.length)];

    const assignment: UserAssignment = {
      userId,
      testId,
      variantId: selectedVariant.id,
      assignedAt: new Date(),
      conversionEvents: []
    };

    setTests(prev => prev.map(t => 
      t.id === testId 
        ? { ...t, userAssignments: { ...t.userAssignments, [userId]: assignment } }
        : t
    ));

    return assignment;
  }, [tests]);

  // Variant selection
  const getVariantForUser = useCallback((testId: string, userId: string): ABTestVariant | null => {
    const assignment = getUserAssignment(testId, userId);
    if (!assignment) return null;

    const test = tests.find(t => t.id === testId);
    return test?.variants.find(v => v.id === assignment.variantId) || null;
  }, [tests, getUserAssignment]);

  const isUserInTest = useCallback((testId: string, userId: string): boolean => {
    return getUserAssignment(testId, userId) !== null;
  }, [getUserAssignment]);

  // Metrics
  const recordConversion = useCallback(async (
    testId: string, 
    userId: string, 
    eventType: string, 
    value: number = 1
  ) => {
    const assignment = getUserAssignment(testId, userId);
    if (!assignment) return;

    const event: ConversionEvent = {
      eventType,
      timestamp: new Date(),
      value,
      metadata: {}
    };

    setTests(prev => prev.map(t => 
      t.id === testId 
        ? {
            ...t,
            userAssignments: {
              ...t.userAssignments,
              [userId]: {
                ...assignment,
                conversionEvents: [...assignment.conversionEvents, event]
              }
            }
          }
        : t
    ));

    devLogger.info('Recorded conversion:', { testId, userId, eventType, value });
  }, [getUserAssignment]);

  const getTestMetrics = useCallback(async (testId: string): Promise<TestMetrics[]> => {
    // Mock implementation - real version would calculate actual metrics
    const test = tests.find(t => t.id === testId);
    if (!test) return [];

    return test.variants.map(variant => ({
      testId,
      variant,
      participants: 0,
      conversions: 0,
      conversionRate: 0,
      confidence: 0,
      significance: false,
      lift: 0,
      sampleSize: 0,
      metrics: {}
    }));
  }, [tests]);

  const getTestAnalysis = useCallback(async (testId: string): Promise<ExperimentAnalysis> => {
    // Mock implementation
    return {
      testId,
      status: 'pending',
      results: [],
      recommendations: [],
      riskAssessment: 'low',
      nextSteps: []
    };
  }, []);

  // Configuration
  const updateTestConfiguration = useCallback(async (
    testId: string, 
    updates: Partial<ABTestConfiguration>
  ) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, configuration: { ...test.configuration, ...updates } }
        : test
    ));
  }, []);

  const duplicateTest = useCallback(async (testId: string, newName: string): Promise<ABTest> => {
    const originalTest = tests.find(t => t.id === testId);
    if (!originalTest) {
      throw new Error('Test not found');
    }

    return createTest({
      ...originalTest.configuration,
      name: newName
    });
  }, [tests, createTest]);

  // Context value
  const contextValue = useMemo(() => ({
    tests,
    isLoading,
    error,
    createTest,
    startTest,
    stopTest,
    deleteTest,
    getUserAssignment,
    assignUser,
    getVariantForUser,
    isUserInTest,
    recordConversion,
    getTestMetrics,
    getTestAnalysis,
    updateTestConfiguration,
    duplicateTest
  }), [
    tests,
    isLoading,
    error,
    createTest,
    startTest,
    stopTest,
    deleteTest,
    getUserAssignment,
    assignUser,
    getVariantForUser,
    isUserInTest,
    recordConversion,
    getTestMetrics,
    getTestAnalysis,
    updateTestConfiguration,
    duplicateTest
  ]);

  return (
    <ABTestContext.Provider value={contextValue}>
      {children}
    </ABTestContext.Provider>
  );
};
