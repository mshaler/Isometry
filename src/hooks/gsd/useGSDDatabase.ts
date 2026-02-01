/**
 * GSD Database Hooks
 *
 * React hooks for GSD database operations
 * Integrates with existing Isometry database context
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useDatabase } from '../../db/DatabaseContext';
import { GSDDatabase } from '../../services/gsd/GSDDatabase';
import type {
  GSDProject,
  GSDSession,
  GSDPhase,
  GSDDecision,
  GSDCommand,
  GSDTemplate,
  GSDActiveProject,
  GSDSessionProgress,
  GSDDecisionHistory,
  CreateGSDProjectParams,
  CreateGSDSessionParams,
  CreateGSDPhaseParams,
  UpdateGSDPhaseProgressParams,
  CreateGSDDecisionParams,
  CreateGSDCommandParams,
  UpdateGSDCommandParams,
  GSDSessionFilter,
  GSDPhaseFilter,
  GSDDecisionFilter,
  GSDProductivityMetrics,
} from '../../types/gsd/database';

// ============================================================================
// Core GSD Database Hook
// ============================================================================

export function useGSDDatabase() {
  const { database } = useDatabase();

  const gsdDb = useMemo(() => {
    if (!database) return null;
    return new GSDDatabase(database as any);
  }, [database]);

  return gsdDb;
}

// ============================================================================
// Project Management Hooks
// ============================================================================

export function useGSDProjects() {
  const gsdDb = useGSDDatabase();

  const createProject = useCallback(async (params: CreateGSDProjectParams): Promise<GSDProject> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    return gsdDb.createProject(params);
  }, [gsdDb]);

  const getProject = useCallback((projectId: string): GSDProject | null => {
    if (!gsdDb) return null;
    return gsdDb.getProject(projectId);
  }, [gsdDb]);

  const getActiveProjects = useCallback((): GSDActiveProject[] => {
    if (!gsdDb) return [];
    return gsdDb.getActiveProjects();
  }, [gsdDb]);

  return {
    createProject,
    getProject,
    getActiveProjects,
  };
}

// ============================================================================
// Session Management Hooks
// ============================================================================

export function useGSDSessions() {
  const gsdDb = useGSDDatabase();

  const createSession = useCallback(async (params: CreateGSDSessionParams): Promise<GSDSession> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    return gsdDb.createSession(params);
  }, [gsdDb]);

  const getSession = useCallback((sessionId: string): GSDSession | null => {
    if (!gsdDb) return null;
    return gsdDb.getSession(sessionId);
  }, [gsdDb]);

  const getSessionsByProject = useCallback((projectId: string, filter?: GSDSessionFilter): GSDSession[] => {
    if (!gsdDb) return [];
    return gsdDb.getSessionsByProject(projectId, filter);
  }, [gsdDb]);

  const getSessionProgress = useCallback((): GSDSessionProgress[] => {
    if (!gsdDb) return [];
    return gsdDb.getSessionProgress();
  }, [gsdDb]);

  const updateSessionStatus = useCallback((sessionId: string, status: GSDSession['status']): void => {
    if (!gsdDb) return;
    gsdDb.updateSessionStatus(sessionId, status);
  }, [gsdDb]);

  return {
    createSession,
    getSession,
    getSessionsByProject,
    getSessionProgress,
    updateSessionStatus,
  };
}

// ============================================================================
// Phase Management Hooks
// ============================================================================

export function useGSDPhases() {
  const gsdDb = useGSDDatabase();

  const createPhase = useCallback(async (params: CreateGSDPhaseParams): Promise<GSDPhase> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    return gsdDb.createPhase(params);
  }, [gsdDb]);

  const getPhase = useCallback((phaseId: string): GSDPhase | null => {
    if (!gsdDb) return null;
    return gsdDb.getPhase(phaseId);
  }, [gsdDb]);

  const getPhasesBySession = useCallback((sessionId: string, filter?: GSDPhaseFilter): GSDPhase[] => {
    if (!gsdDb) return [];
    return gsdDb.getPhasesBySession(sessionId, filter);
  }, [gsdDb]);

  const updatePhaseProgress = useCallback((params: UpdateGSDPhaseProgressParams): void => {
    if (!gsdDb) return;
    gsdDb.updatePhaseProgress(params);
  }, [gsdDb]);

  return {
    createPhase,
    getPhase,
    getPhasesBySession,
    updatePhaseProgress,
  };
}

// ============================================================================
// Decision Management Hooks
// ============================================================================

export function useGSDDecisions() {
  const gsdDb = useGSDDatabase();

  const createDecision = useCallback(async (params: CreateGSDDecisionParams): Promise<GSDDecision> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    return gsdDb.createDecision(params);
  }, [gsdDb]);

  const getDecision = useCallback((decisionId: string): GSDDecision | null => {
    if (!gsdDb) return null;
    return gsdDb.getDecision(decisionId);
  }, [gsdDb]);

  const getDecisionHistory = useCallback((filter?: GSDDecisionFilter): GSDDecisionHistory[] => {
    if (!gsdDb) return [];
    return gsdDb.getDecisionHistory(filter);
  }, [gsdDb]);

  return {
    createDecision,
    getDecision,
    getDecisionHistory,
  };
}

// ============================================================================
// Command Management Hooks
// ============================================================================

export function useGSDCommands() {
  const gsdDb = useGSDDatabase();

  const createCommand = useCallback(async (params: CreateGSDCommandParams): Promise<GSDCommand> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    return gsdDb.createCommand(params);
  }, [gsdDb]);

  const getCommand = useCallback((commandId: string): GSDCommand | null => {
    if (!gsdDb) return null;
    return gsdDb.getCommand(commandId);
  }, [gsdDb]);

  const getCommandsBySession = useCallback((sessionId: string): GSDCommand[] => {
    if (!gsdDb) return [];
    return gsdDb.getCommandsBySession(sessionId);
  }, [gsdDb]);

  const updateCommand = useCallback((params: UpdateGSDCommandParams): void => {
    if (!gsdDb) return;
    gsdDb.updateCommand(params);
  }, [gsdDb]);

  return {
    createCommand,
    getCommand,
    getCommandsBySession,
    updateCommand,
  };
}

// ============================================================================
// Template Management Hooks
// ============================================================================

export function useGSDTemplates() {
  const gsdDb = useGSDDatabase();

  const getTemplates = useCallback((category?: string): GSDTemplate[] => {
    if (!gsdDb) return [];
    return gsdDb.getTemplates(category);
  }, [gsdDb]);

  return {
    getTemplates,
  };
}

// ============================================================================
// Analytics Hooks
// ============================================================================

export function useGSDAnalytics() {
  const gsdDb = useGSDDatabase();

  const getProductivityMetrics = useCallback((days?: number): GSDProductivityMetrics => {
    if (!gsdDb) {
      return {
        avg_session_duration_hours: 0,
        avg_phases_per_session: 0,
        phase_completion_rate: 0,
        decision_speed_avg_minutes: 0,
        most_used_templates: [],
        productivity_trend: [],
      };
    }
    return gsdDb.getProductivityMetrics(days);
  }, [gsdDb]);

  return {
    getProductivityMetrics,
  };
}

// ============================================================================
// Initialization and Schema Management Hooks
// ============================================================================

export function useGSDSchemaInitialization() {
  const gsdDb = useGSDDatabase();

  const initializeSchema = useCallback(async (): Promise<void> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    await gsdDb.initializeGSDSchema();
  }, [gsdDb]);

  const migrateSchema = useCallback(async (fromVersion: number, toVersion: number): Promise<void> => {
    if (!gsdDb) throw new Error('GSD Database not available');
    await gsdDb.migrateGSDSchema(fromVersion, toVersion);
  }, [gsdDb]);

  return {
    initializeSchema,
    migrateSchema,
  };
}

// ============================================================================
// Maintenance Hooks
// ============================================================================

export function useGSDMaintenance() {
  const gsdDb = useGSDDatabase();

  const archiveCompletedSessions = useCallback((daysOld?: number): number => {
    if (!gsdDb) return 0;
    return gsdDb.archiveCompletedSessions(daysOld);
  }, [gsdDb]);

  const purgeOldAnalytics = useCallback((daysOld?: number): number => {
    if (!gsdDb) return 0;
    return gsdDb.purgeOldAnalytics(daysOld);
  }, [gsdDb]);

  return {
    archiveCompletedSessions,
    purgeOldAnalytics,
  };
}

// ============================================================================
// Reactive Query Hook (using existing useSQLiteQuery pattern)
// ============================================================================

export function useGSDQuery<T>(
  query: string,
  params: unknown[] = [],
  dependencies: React.DependencyList = []
): {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const gsdDb = useGSDDatabase();

  const executeQuery = useCallback(() => {
    if (!gsdDb || !gsdDb) {
      return [];
    }

    try {
      const stmt = (gsdDb as any).db.prepare(query);
      const results = stmt.all(...params) as T[];
      stmt.finalize();
      return results;
    } catch (error) {
      console.error('GSD Query failed:', error);
      throw error;
    }
  }, [gsdDb, query, ...params, ...dependencies]);

  // This is a simplified implementation - in a real app you'd want to use
  // the existing reactive query infrastructure from Isometry
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const results = executeQuery();
      setData(results);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [executeQuery]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================================================
// High-Level Workflow Hooks
// ============================================================================

export function useGSDWorkflow() {
  const { createProject } = useGSDProjects();
  const { createSession, updateSessionStatus } = useGSDSessions();
  const { createPhase, updatePhaseProgress } = useGSDPhases();
  const { createDecision } = useGSDDecisions();
  const { createCommand, updateCommand } = useGSDCommands();

  const startNewProject = useCallback(async (
    projectParams: CreateGSDProjectParams,
    sessionParams: Omit<CreateGSDSessionParams, 'project_node_id'>,
    initialPhases: Omit<CreateGSDPhaseParams, 'session_id'>[]
  ) => {
    // Create project
    const project = await createProject(projectParams);

    // Create initial session
    const session = await createSession({
      ...sessionParams,
      project_node_id: project.id,
    });

    // Create phases
    const phases = await Promise.all(
      initialPhases.map((phaseParams, index) =>
        createPhase({
          ...phaseParams,
          session_id: session.id,
          phase_number: index + 1,
        })
      )
    );

    return { project, session, phases };
  }, [createProject, createSession, createPhase]);

  const completePhase = useCallback(async (
    phaseId: string,
    results?: Record<string, unknown>,
    artifacts?: string[]
  ) => {
    updatePhaseProgress({
      phase_id: phaseId,
      status: 'completed',
      progress_percentage: 100,
      results,
      artifacts_produced: artifacts,
    });
  }, [updatePhaseProgress]);

  const makeDecisionAndProceed = useCallback(async (
    sessionId: string,
    phaseId: string,
    decisionPoint: string,
    choice: string,
    options?: string[]
  ) => {
    const decision = await createDecision({
      session_id: sessionId,
      phase_id: phaseId,
      decision_point: decisionPoint,
      decision_type: 'choice',
      options_presented: options,
      choice_made: choice,
      decision_source: 'user',
    });

    return decision;
  }, [createDecision]);

  return {
    startNewProject,
    completePhase,
    makeDecisionAndProceed,
  };
}