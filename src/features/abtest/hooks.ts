/**
 * A/B Testing Hooks
 *
 * React hooks for A/B testing functionality
 */

import { useContext } from 'react';
import { ABTestContext } from './context';
import type { ABTestContextValue, ABTestVariant } from './types';

/**
 * Main A/B testing hook
 */
export const useABTest = (): ABTestContextValue => {
  const context = useContext(ABTestContext);
  if (!context) {
    throw new Error('useABTest must be used within an ABTestProvider');
  }
  return context;
};

/**
 * Hook to get variant for a specific test
 */
export const useABTestVariant = (testId: string, userId?: string): ABTestVariant | null => {
  const { getVariantForUser } = useABTest();
  
  if (!userId) {
    // Use current user ID from auth context if available
    userId = 'current-user'; // This would come from auth context
  }
  
  return getVariantForUser(testId, userId);
};

/**
 * Hook to check if user is in a test
 */
export const useIsInABTest = (testId: string, userId?: string): boolean => {
  const { isUserInTest } = useABTest();
  
  if (!userId) {
    userId = 'current-user'; // This would come from auth context
  }
  
  return isUserInTest(testId, userId);
};

/**
 * Hook for recording conversions
 */
export const useABTestConversion = () => {
  const { recordConversion } = useABTest();
  
  return {
    recordConversion: (testId: string, eventType: string, value?: number) => {
      const userId = 'current-user'; // This would come from auth context
      return recordConversion(testId, userId, eventType, value);
    }
  };
};

/**
 * Hook for test management
 */
export const useABTestManagement = () => {
  const {
    createTest,
    startTest,
    stopTest,
    deleteTest,
    updateTestConfiguration,
    duplicateTest
  } = useABTest();
  
  return {
    createTest,
    startTest,
    stopTest,
    deleteTest,
    updateTestConfiguration,
    duplicateTest
  };
};

/**
 * Hook for test analytics
 */
export const useABTestAnalytics = () => {
  const {
    getTestMetrics,
    getTestAnalysis
  } = useABTest();
  
  return {
    getTestMetrics,
    getTestAnalysis
  };
};
