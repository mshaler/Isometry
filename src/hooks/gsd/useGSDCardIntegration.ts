/**
 * GSD Card Integration Hook
 *
 * High-level integration between GSD sessions and Isometry cards
 * Uses existing GSD database infrastructure and card creation hook
 */

import { useCallback, useEffect } from 'react';
import { useGSDDatabase } from './useGSDDatabase';
import { useGSDCardCreation } from './useGSDCardCreation';
import type {
  GSDSession,
  GSDExecutionResult
} from '../../types/gsd';
import type {
  GSDProject,
  GSDSession as GSDDbSession,
  GSDPhase
} from '../../types/gsd/database';

// ============================================================================
// Integration Configuration
// ============================================================================

export interface GSDCardIntegrationOptions {
  autoCreateCards?: boolean;
  autoCreateSessionSummaries?: boolean;
  includeExecutionDetails?: boolean;
  customTagPrefix?: string;
  folderPrefix?: string;
}

export interface GSDCardCreatedEvent {
  cardId: string;
  sessionId: string;
  type: 'execution' | 'session_summary' | 'phase_complete';
  metadata: {
    session: GSDDbSession;
    project?: GSDProject;
    execution?: GSDExecutionResult;
    phase?: GSDPhase;
  };
}

// ============================================================================
// Main Integration Hook
// ============================================================================

export function useGSDCardIntegration(
  options: GSDCardIntegrationOptions = {}
) {
  const {
    autoCreateCards = true,
    autoCreateSessionSummaries = true,
    includeExecutionDetails = true,
    customTagPrefix = 'gsd',
    folderPrefix = 'GSD'
  } = options;

  const gsdDb = useGSDDatabase();
  const {
    createCardFromSession,
    createCardFromExecution,
    createSessionSummaryCard
  } = useGSDCardCreation();

  // ========================================================================
  // Card Creation Functions
  // ========================================================================

  const createCardForExecution = useCallback(async (
    sessionId: string,
    executionResult: GSDExecutionResult
  ): Promise<string | null> => {
    if (!gsdDb) return null;

    try {
      // Get session and project data
      const session = gsdDb.getSession(sessionId);
      if (!session) {
        console.error('Session not found:', sessionId);
        return null;
      }

      const project = session.project_node_id
        ? gsdDb.getProject(session.project_node_id)
        : undefined;

      // Create card with execution details
      const cardId = await createCardFromExecution(
        session,
        executionResult,
        {
          project,
          additionalTags: [customTagPrefix, 'execution']
        }
      );

      console.log('✅ Created GSD execution card:', cardId);
      return cardId;
    } catch (error) {
      console.error('Failed to create execution card:', error);
      return null;
    }
  }, [gsdDb, createCardFromExecution, customTagPrefix]);

  const createCardForSessionComplete = useCallback(async (
    sessionId: string
  ): Promise<string | null> => {
    if (!gsdDb || !autoCreateSessionSummaries) return null;

    try {
      const session = gsdDb.getSession(sessionId);
      if (!session) return null;

      const project = session.project_node_id
        ? gsdDb.getProject(session.project_node_id)
        : undefined;

      // Get all commands executed in this session for summary
      const commands = gsdDb.getCommandsBySession(sessionId);
      const executionResults: GSDExecutionResult[] = commands
        .filter(cmd => cmd.results)
        .map(cmd => cmd.results as any)
        .filter(Boolean);

      const cardId = await createSessionSummaryCard(
        session,
        project,
        executionResults
      );

      console.log('✅ Created GSD session summary card:', cardId);
      return cardId;
    } catch (error) {
      console.error('Failed to create session summary card:', error);
      return null;
    }
  }, [gsdDb, autoCreateSessionSummaries, createSessionSummaryCard]);

  const createCardForPhaseComplete = useCallback(async (
    sessionId: string,
    phaseId: string
  ): Promise<string | null> => {
    if (!gsdDb) return null;

    try {
      const session = gsdDb.getSession(sessionId);
      const phase = gsdDb.getPhase(phaseId);

      if (!session || !phase) return null;

      const project = session.project_node_id
        ? gsdDb.getProject(session.project_node_id)
        : undefined;

      const cardId = await createCardFromSession({
        session,
        project,
        phase,
        customTitle: `📋 Phase Complete: ${phase.phase_name}`,
        additionalTags: [customTagPrefix, 'phase-complete']
      });

      console.log('✅ Created GSD phase completion card:', cardId);
      return cardId;
    } catch (error) {
      console.error('Failed to create phase completion card:', error);
      return null;
    }
  }, [gsdDb, createCardFromSession, customTagPrefix]);

  // ========================================================================
  // Batch Operations
  // ========================================================================

  const createCardsForAllCompletedSessions = useCallback(async (): Promise<string[]> => {
    if (!gsdDb) return [];

    try {
      const completedSessions = gsdDb.getSessionProgress()
        .filter(s => s.status === 'completed')
        .map(s => gsdDb.getSession(s.session_id))
        .filter(Boolean) as GSDDbSession[];

      const cardIds: string[] = [];

      for (const session of completedSessions) {
        const cardId = await createCardForSessionComplete(session.id);
        if (cardId) {
          cardIds.push(cardId);
        }
      }

      console.log(`✅ Created ${cardIds.length} cards from completed sessions`);
      return cardIds;
    } catch (error) {
      console.error('Failed to create cards for completed sessions:', error);
      return [];
    }
  }, [gsdDb, createCardForSessionComplete]);

  const migrateExistingGSDData = useCallback(async (): Promise<{
    sessions: number;
    executions: number;
    phases: number;
  }> => {
    if (!gsdDb) return { sessions: 0, executions: 0, phases: 0 };

    console.log('🔄 Migrating existing GSD data to cards...');

    let sessionCards = 0;
    let executionCards = 0;
    let phaseCards = 0;

    try {
      // Migrate completed sessions
      const completedSessions = await createCardsForAllCompletedSessions();
      sessionCards = completedSessions.length;

      // Migrate completed phases
      // Note: This would require enhancing the GSD database to track individual executions
      // For now, we'll track this as a placeholder for future enhancement

      console.log(`✅ Migration complete: ${sessionCards} session cards created`);

      return {
        sessions: sessionCards,
        executions: executionCards,
        phases: phaseCards
      };
    } catch (error) {
      console.error('Migration failed:', error);
      return { sessions: 0, executions: 0, phases: 0 };
    }
  }, [gsdDb, createCardsForAllCompletedSessions]);

  // ========================================================================
  // Query Functions
  // ========================================================================

  const getCardsForSession = useCallback(async (sessionId: string) => {
    // This would query the Isometry database for cards with source='gsd' and source_id=sessionId
    // Using the existing useSQLiteQuery infrastructure
    return [];
  }, []);

  const getGSDCardStats = useCallback(async () => {
    if (!gsdDb) return null;

    try {
      // Get stats about GSD cards created
      const activeProjects = gsdDb.getActiveProjects();
      const sessionProgress = gsdDb.getSessionProgress();

      return {
        totalProjects: activeProjects.length,
        totalSessions: sessionProgress.length,
        completedSessions: sessionProgress.filter(s => s.status === 'completed').length,
        activeSessions: sessionProgress.filter(s => s.status === 'active').length,
        // Would need to query actual card count from nodes table
        estimatedCards: sessionProgress.filter(s => s.status === 'completed').length
      };
    } catch (error) {
      console.error('Failed to get GSD card stats:', error);
      return null;
    }
  }, [gsdDb]);

  // ========================================================================
  // Event Handlers (Future Enhancement)
  // ========================================================================

  // These would be called by the GSD execution system
  const handleExecutionComplete = useCallback(async (
    sessionId: string,
    executionResult: GSDExecutionResult
  ) => {
    if (autoCreateCards && includeExecutionDetails) {
      return await createCardForExecution(sessionId, executionResult);
    }
    return null;
  }, [autoCreateCards, includeExecutionDetails, createCardForExecution]);

  const handleSessionComplete = useCallback(async (sessionId: string) => {
    if (autoCreateSessionSummaries) {
      return await createCardForSessionComplete(sessionId);
    }
    return null;
  }, [autoCreateSessionSummaries, createCardForSessionComplete]);

  const handlePhaseComplete = useCallback(async (
    sessionId: string,
    phaseId: string
  ) => {
    return await createCardForPhaseComplete(sessionId, phaseId);
  }, [createCardForPhaseComplete]);

  return {
    // Card creation functions
    createCardForExecution,
    createCardForSessionComplete,
    createCardForPhaseComplete,

    // Batch operations
    createCardsForAllCompletedSessions,
    migrateExistingGSDData,

    // Query functions
    getCardsForSession,
    getGSDCardStats,

    // Event handlers
    handleExecutionComplete,
    handleSessionComplete,
    handlePhaseComplete,

    // Status
    isReady: gsdDb !== null,
    options
  };
}

// ============================================================================
// React Component Integration Helper
// ============================================================================

export function useGSDCardAutoSync(sessionId?: string) {
  const integration = useGSDCardIntegration({
    autoCreateCards: true,
    autoCreateSessionSummaries: true
  });

  const gsdDb = useGSDDatabase();

  useEffect(() => {
    if (!sessionId || !gsdDb) return;

    // Monitor session for completion
    const session = gsdDb.getSession(sessionId);
    if (session?.status === 'completed') {
      integration.handleSessionComplete(sessionId);
    }
  }, [sessionId, gsdDb, integration]);

  return integration;
}