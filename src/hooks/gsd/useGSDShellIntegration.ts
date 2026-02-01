/**
 * GSD Shell Integration Hook
 *
 * Connects GSD shell operations with Isometry card creation
 * Provides seamless integration for the EnhancedShellComponentV2
 */

import { useCallback, useEffect, useState } from 'react';
import { useGSDCardIntegration } from './useGSDCardIntegration';
import { useGSDv2 } from './useGSDv2';
import type {
  GSDExecutionResult,
  GSDSession
} from '../../types/gsd';

// ============================================================================
// Shell Integration Hook
// ============================================================================

export function useGSDShellIntegration() {
  const gsd = useGSDv2();
  const cardIntegration = useGSDCardIntegration({
    autoCreateCards: true,
    autoCreateSessionSummaries: true,
    includeExecutionDetails: true
  });

  const [lastCreatedCardId, setLastCreatedCardId] = useState<string | null>(null);
  const [cardCreationStatus, setCardCreationStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');

  // ========================================================================
  // Enhanced Execution Handler
  // ========================================================================

  const executeCommandWithCardCreation = useCallback(async (
    command: any,
    input?: string
  ) => {
    if (!gsd.canExecute) {
      console.warn('Cannot execute command - GSD not ready');
      return null;
    }

    try {
      console.log(`🚀 Executing GSD command: ${command.label}`);

      // Execute the command using existing GSD infrastructure
      const executionStream = await gsd.executeCommand(command, input);

      if (!executionStream) {
        console.error('Failed to start command execution');
        return null;
      }

      // Set up enhanced completion handler with card creation
      executionStream.onComplete(async (result: GSDExecutionResult) => {
        console.log('✅ Command execution completed:', result);

        // Create card from execution if session is active
        if (gsd.activeSession && result.success) {
          try {
            setCardCreationStatus('creating');

            const cardId = await cardIntegration.createCardForExecution(
              gsd.activeSession.id,
              result
            );

            if (cardId) {
              setLastCreatedCardId(cardId);
              setCardCreationStatus('success');
              console.log(`📝 Created Isometry card: ${cardId}`);
            } else {
              setCardCreationStatus('error');
              console.warn('Card creation returned null');
            }
          } catch (error) {
            console.error('Failed to create card:', error);
            setCardCreationStatus('error');
          }
        }
      });

      return executionStream;
    } catch (error) {
      console.error('Command execution failed:', error);
      setCardCreationStatus('error');
      throw error;
    }
  }, [gsd, cardIntegration]);

  // ========================================================================
  // Session Lifecycle Integration
  // ========================================================================

  const handleSessionComplete = useCallback(async (session: GSDSession) => {
    if (!cardIntegration.isReady) return;

    try {
      console.log('📋 Creating session summary card...');
      setCardCreationStatus('creating');

      const cardId = await cardIntegration.createCardForSessionComplete(session.id);

      if (cardId) {
        setLastCreatedCardId(cardId);
        setCardCreationStatus('success');
        console.log(`📝 Created session summary card: ${cardId}`);
      }
    } catch (error) {
      console.error('Failed to create session summary card:', error);
      setCardCreationStatus('error');
    }
  }, [cardIntegration]);

  // ========================================================================
  // Migration and Stats Functions
  // ========================================================================

  const migrateExistingData = useCallback(async () => {
    if (!cardIntegration.isReady) {
      console.warn('Card integration not ready for migration');
      return null;
    }

    try {
      console.log('🔄 Starting GSD data migration...');
      const results = await cardIntegration.migrateExistingGSDData();
      console.log('✅ Migration completed:', results);
      return results;
    } catch (error) {
      console.error('Migration failed:', error);
      return null;
    }
  }, [cardIntegration]);

  const getCardStats = useCallback(async () => {
    return await cardIntegration.getGSDCardStats();
  }, [cardIntegration]);

  // ========================================================================
  // Auto-session completion monitoring
  // ========================================================================

  useEffect(() => {
    // Monitor for session completion to auto-create summary cards
    if (gsd.activeSession && gsd.activeSession.status === 'completed') {
      handleSessionComplete(gsd.activeSession);
    }
  }, [gsd.activeSession?.status, handleSessionComplete]);

  // ========================================================================
  // Status and UI Helpers
  // ========================================================================

  const getIntegrationStatus = useCallback(() => {
    return {
      gsdReady: gsd.isConnected && !!gsd.activeSession,
      cardIntegrationReady: cardIntegration.isReady,
      lastCardCreated: lastCreatedCardId,
      cardCreationStatus,
      canCreateCards: gsd.isConnected && cardIntegration.isReady
    };
  }, [gsd, cardIntegration, lastCreatedCardId, cardCreationStatus]);

  const resetCardCreationStatus = useCallback(() => {
    setCardCreationStatus('idle');
    setLastCreatedCardId(null);
  }, []);

  return {
    // Enhanced execution
    executeCommandWithCardCreation,

    // Session lifecycle
    handleSessionComplete,

    // Migration and stats
    migrateExistingData,
    getCardStats,

    // Status
    getIntegrationStatus,
    resetCardCreationStatus,

    // Direct access to underlying systems
    gsd,
    cardIntegration,

    // Status flags
    isReady: gsd.isConnected && cardIntegration.isReady,
    lastCreatedCardId,
    cardCreationStatus
  };
}

// ============================================================================
// Quick Test Functions
// ============================================================================

export function useGSDShellTestHelpers() {
  const integration = useGSDShellIntegration();

  const runQuickTest = useCallback(async () => {
    if (!integration.isReady) {
      console.log('❌ Integration not ready for testing');
      return false;
    }

    try {
      console.log('🧪 Running GSD→Card integration test...');

      // Get stats before
      const statsBefore = await integration.getCardStats();
      console.log('📊 Stats before test:', statsBefore);

      // Try to migrate existing data
      const migrationResults = await integration.migrateExistingData();
      console.log('🔄 Migration results:', migrationResults);

      // Get stats after
      const statsAfter = await integration.getCardStats();
      console.log('📊 Stats after test:', statsAfter);

      console.log('✅ Quick test completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Quick test failed:', error);
      return false;
    }
  }, [integration]);

  const testCardCreation = useCallback(async () => {
    if (!integration.gsd.activeSession) {
      console.log('❌ No active session for card creation test');
      return false;
    }

    try {
      console.log('🧪 Testing card creation...');

      // Create a mock execution result
      const mockResult: GSDExecutionResult = {
        success: true,
        phase: 'testing' as any,
        output: 'Test execution completed successfully',
        filesChanged: ['test-file.ts'],
        duration: 5,
        testsRun: 3,
        testsPassed: 3
      };

      const cardId = await integration.cardIntegration.createCardForExecution(
        integration.gsd.activeSession.id,
        mockResult
      );

      if (cardId) {
        console.log('✅ Test card created:', cardId);
        return true;
      } else {
        console.log('❌ Test card creation failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Test card creation error:', error);
      return false;
    }
  }, [integration]);

  return {
    ...integration,
    runQuickTest,
    testCardCreation
  };
}