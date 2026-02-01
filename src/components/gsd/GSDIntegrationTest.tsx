/**
 * GSD Integration Test Component
 *
 * Test component to validate the complete GSD → Isometry card creation workflow
 * This component tests the three-tier integration hooks
 */

import React, { useCallback, useState } from 'react';
import { useGSDShellTestHelpers } from '../../hooks/gsd/useGSDShellIntegration';
import { useGSDCardCreation } from '../../hooks/gsd/useGSDCardCreation';
import { createMockCardData } from '../../utils/createTestGSDCard';
import type { GSDExecutionResult } from '../../types/gsd';

export function GSDIntegrationTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const {
    runQuickTest,
    testCardCreation,
    getIntegrationStatus,
    gsd,
    isReady
  } = useGSDShellTestHelpers();

  const addResult = useCallback((message: string) => {
    console.log(`[GSD Test] ${message}`);
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const runFullIntegrationTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setTestResults([]);

    try {
      addResult('🧪 Starting complete GSD-Isometry integration test...');

      // Step 1: Check integration status
      const status = getIntegrationStatus();
      addResult(`📊 Integration Status: GSD=${status.gsdReady}, Cards=${status.cardIntegrationReady}, Ready=${status.canCreateCards}`);

      if (!status.canCreateCards) {
        addResult('❌ Integration not ready - cannot proceed with test');
        return;
      }

      // Step 2: Run quick test (migration and stats)
      addResult('🔄 Running quick test (migration and stats)...');
      const quickTestSuccess = await runQuickTest();
      addResult(quickTestSuccess ? '✅ Quick test passed' : '❌ Quick test failed');

      // Step 3: Test card creation if we have an active session
      if (gsd.activeSession) {
        addResult('🧪 Testing card creation with mock execution...');
        const cardTestSuccess = await testCardCreation();
        addResult(cardTestSuccess ? '✅ Card creation test passed' : '❌ Card creation test failed');
      } else {
        addResult('ℹ️ No active session - skipping card creation test');
      }

      // Step 4: Test manual card creation with mock data
      addResult('🧪 Testing manual card creation workflow...');
      await testMockCardCreation();

      addResult('✅ Complete integration test finished');
    } catch (error) {
      addResult(`❌ Integration test failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addResult, runQuickTest, testCardCreation, getIntegrationStatus, gsd.activeSession]);

  const { createCardFromSession } = useGSDCardCreation();

  const testMockCardCreation = useCallback(async () => {
    try {
      addResult('📝 Creating real test card with mock data...');

      const { session, execution } = createMockCardData();

      const cardId = await createCardFromSession({
        session,
        executionResult: execution,
        additionalTags: ['integration-test', 'mock-card']
      });

      if (cardId) {
        addResult(`✅ Successfully created test card: ${cardId}`);
        addResult(`📍 Card should now be visible in main ListView/GridView!`);
        addResult(`🔍 Use Source filter = 'gsd' to find it easily`);
      } else {
        addResult('❌ Card creation returned null');
      }
    } catch (error) {
      addResult(`❌ Mock card creation failed: ${error}`);
    }
  }, [addResult, createCardFromSession]);

  const clearResults = useCallback(() => {
    setTestResults([]);
  }, []);

  if (!isReady) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-medium text-yellow-800 mb-2">GSD Integration Test</h3>
        <p className="text-yellow-700">⏳ Waiting for GSD integration to be ready...</p>
        <p className="text-sm text-yellow-600 mt-1">
          GSD Connected: {gsd.isConnected ? '✅' : '❌'} |
          Active Session: {gsd.activeSession ? '✅' : '❌'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="font-medium text-gray-800 mb-4">🧪 GSD Integration Test</h3>

      <div className="space-y-3">
        {/* Status Display */}
        <div className="text-sm">
          <span className="font-medium">Status:</span> Ready ✅ |
          <span className="ml-1">GSD: {gsd.isConnected ? '🟢' : '🔴'}</span> |
          <span className="ml-1">Session: {gsd.activeSession?.id || 'None'}</span>
        </div>

        {/* Test Controls */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runFullIntegrationTest}
            disabled={isRunning}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {isRunning ? '⏳ Running...' : '🚀 Run Full Test'}
          </button>
          <button
            onClick={testMockCardCreation}
            disabled={isRunning}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            📝 Create Test Card
          </button>
          <button
            onClick={clearResults}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">Test Results:</h4>
            <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index}>{result}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}