/**
 * GSD Card Creation Hook
 *
 * Bridges GSD sessions and execution results into Isometry cards
 * Follows GSD executor pattern for consistent data flow
 */

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useSQLiteQuery } from '../useSQLiteQuery';
import type {
  GSDSession,
  GSDExecutionResult,
  GSDPhase,
  GSDCommand
} from '../../types/gsd';
import type {
  GSDProject,
  GSDSession as GSDDbSession
} from '../../types/gsd/database';

// ============================================================================
// Card Creation Types
// ============================================================================

export interface GSDCardCreationParams {
  session: GSDDbSession;
  project?: GSDProject;
  executionResult?: GSDExecutionResult;
  phase?: GSDPhase;
  command?: GSDCommand;
  customTitle?: string;
  customContent?: string;
  additionalTags?: string[];
}

export interface GSDCardMetadata {
  gsd_session_id: string;
  gsd_project_id?: string;
  gsd_phase?: string;
  gsd_command?: string;
  execution_success?: boolean;
  files_changed?: string[];
  tests_run?: number;
  tests_passed?: number;
  commit_hash?: string;
  duration_seconds?: number;
}

// ============================================================================
// GSD Card Creation Hook
// ============================================================================

export function useGSDCardCreation() {
  // Use existing SQLite infrastructure for card creation
  const { executeQuery } = useSQLiteQuery<any>('SELECT 1', [], []);

  // Create card from GSD session - main executor function
  const createCardFromSession = useCallback(async (
    params: GSDCardCreationParams
  ): Promise<string> => {
    const {
      session,
      project,
      executionResult,
      phase,
      command,
      customTitle,
      customContent,
      additionalTags = []
    } = params;

    const cardId = nanoid();
    const now = new Date().toISOString();

    // Build card title with GSD executor pattern
    const title = customTitle || buildCardTitle({
      session,
      project,
      command,
      phase,
      executionResult
    });

    // Build comprehensive card content
    const content = customContent || buildCardContent({
      session,
      project,
      executionResult,
      phase,
      command
    });

    // Build card summary for quick overview
    const summary = buildCardSummary({
      session,
      executionResult,
      command
    });

    // Build GSD metadata for traceability
    const gsdMetadata: GSDCardMetadata = {
      gsd_session_id: session.id,
      gsd_project_id: project?.id,
      gsd_phase: phase?.phase_name,
      gsd_command: command?.slashCommand,
      execution_success: executionResult?.success,
      files_changed: executionResult?.filesChanged,
      tests_run: executionResult?.testsRun,
      tests_passed: executionResult?.testsPassed,
      commit_hash: executionResult?.commitHash,
      duration_seconds: executionResult?.duration
    };

    // Build comprehensive tag set
    const tags = buildCardTags({
      session,
      project,
      command,
      executionResult,
      additionalTags
    });

    // Determine folder based on GSD context
    const folder = determineCardFolder({
      session,
      project,
      command
    });

    try {
      // Insert card into Isometry nodes table using existing infrastructure
      await executeQuery(
        `INSERT INTO nodes (
          id, node_type, name, content, summary,
          created_at, modified_at,
          folder, tags, status, priority,
          source, source_id, source_url,
          version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cardId,
          'note',
          title,
          content,
          summary,
          now,
          now,
          folder,
          JSON.stringify(tags),
          session.status === 'completed' ? 'completed' : 'active',
          determinePriority(session, command),
          'gsd',
          session.id,
          `gsd://session/${session.id}`,
          1
        ]
      );

      // Store GSD-specific metadata in a separate table for detailed queries
      await executeQuery(
        `INSERT OR REPLACE INTO gsd_card_metadata (
          card_id, gsd_session_id, gsd_project_id, gsd_phase, gsd_command,
          execution_success, files_changed, tests_run, tests_passed,
          commit_hash, duration_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cardId,
          gsdMetadata.gsd_session_id,
          gsdMetadata.gsd_project_id,
          gsdMetadata.gsd_phase,
          gsdMetadata.gsd_command,
          gsdMetadata.execution_success,
          JSON.stringify(gsdMetadata.files_changed || []),
          gsdMetadata.tests_run,
          gsdMetadata.tests_passed,
          gsdMetadata.commit_hash,
          gsdMetadata.duration_seconds,
          now
        ]
      );

      return cardId;
    } catch (error) {
      console.error('Failed to create GSD card:', error);
      throw new Error(`GSD card creation failed: ${error}`);
    }
  }, [executeQuery]);

  // Create card from execution result - convenience executor
  const createCardFromExecution = useCallback(async (
    session: GSDDbSession,
    executionResult: GSDExecutionResult,
    options: {
      project?: GSDProject;
      customTitle?: string;
      additionalTags?: string[];
    } = {}
  ): Promise<string> => {
    return createCardFromSession({
      session,
      executionResult,
      project: options.project,
      customTitle: options.customTitle,
      additionalTags: options.additionalTags
    });
  }, [createCardFromSession]);

  // Create session summary card - batch executor
  const createSessionSummaryCard = useCallback(async (
    session: GSDDbSession,
    project?: GSDProject,
    executionResults: GSDExecutionResult[] = []
  ): Promise<string> => {
    const successfulExecutions = executionResults.filter(r => r.success);
    const failedExecutions = executionResults.filter(r => !r.success);

    const summaryContent = buildSessionSummaryContent({
      session,
      project,
      executionResults,
      successfulExecutions,
      failedExecutions
    });

    return createCardFromSession({
      session,
      project,
      customTitle: `${session.session_name} - Session Summary`,
      customContent: summaryContent,
      additionalTags: ['session-summary', 'gsd-meta']
    });
  }, [createCardFromSession]);

  return {
    createCardFromSession,
    createCardFromExecution,
    createSessionSummaryCard,
  };
}

// ============================================================================
// Helper Functions - GSD Data Processing
// ============================================================================

function buildCardTitle({
  session,
  project,
  command,
  phase,
  executionResult
}: {
  session: GSDDbSession;
  project?: GSDProject;
  command?: GSDCommand;
  phase?: GSDPhase;
  executionResult?: GSDExecutionResult;
}): string {
  // GSD executor pattern: build hierarchical title
  if (executionResult && command) {
    const status = executionResult.success ? '✅' : '❌';
    return `${status} ${command.label} - ${session.session_name}`;
  }

  if (phase) {
    return `📋 ${phase.phase_name} - ${session.session_name}`;
  }

  if (command) {
    return `⚡ ${command.label} - ${session.session_name}`;
  }

  // Default session-based title
  const projectPrefix = project ? `${project.name} / ` : '';
  return `${projectPrefix}${session.session_name}`;
}

function buildCardContent({
  session,
  project,
  executionResult,
  phase,
  command
}: {
  session: GSDDbSession;
  project?: GSDProject;
  executionResult?: GSDExecutionResult;
  phase?: GSDPhase;
  command?: GSDCommand;
}): string {
  let content = '';

  // Session context
  content += `# GSD Session: ${session.session_name}\n\n`;

  if (project) {
    content += `**Project:** ${project.name}\n`;
    if (project.summary) {
      content += `**Project Summary:** ${project.summary}\n`;
    }
  }

  content += `**Session Type:** ${session.session_type}\n`;
  content += `**Status:** ${session.status}\n`;
  content += `**Started:** ${new Date(session.started_at).toLocaleString()}\n`;

  if (session.completed_at) {
    content += `**Completed:** ${new Date(session.completed_at).toLocaleString()}\n`;
  }

  content += '\n---\n\n';

  // Command/Phase context
  if (command) {
    content += `## Command: ${command.label}\n`;
    content += `**Description:** ${command.description}\n`;
    content += `**Category:** ${command.category}\n`;
    content += `**Slash Command:** \`${command.slashCommand}\`\n\n`;
  }

  if (phase) {
    content += `## Phase: ${phase.phase_name}\n`;
    content += `**Type:** ${phase.phase_type}\n`;
    content += `**Status:** ${phase.status}\n`;
    if (phase.description) {
      content += `**Description:** ${phase.description}\n`;
    }
    content += '\n';
  }

  // Execution results
  if (executionResult) {
    content += `## Execution Results\n`;
    content += `**Success:** ${executionResult.success ? 'Yes' : 'No'}\n`;
    content += `**Duration:** ${executionResult.duration}s\n`;

    if (executionResult.filesChanged.length > 0) {
      content += `**Files Changed:** ${executionResult.filesChanged.length}\n`;
      content += executionResult.filesChanged.map(f => `- \`${f}\``).join('\n') + '\n';
    }

    if (executionResult.testsRun) {
      content += `**Tests:** ${executionResult.testsPassed}/${executionResult.testsRun} passed\n`;
    }

    if (executionResult.commitHash) {
      content += `**Commit:** \`${executionResult.commitHash}\`\n`;
    }

    if (executionResult.output) {
      content += '\n### Output\n```\n' + executionResult.output + '\n```\n';
    }
  }

  return content;
}

function buildCardSummary({
  session,
  executionResult,
  command
}: {
  session: GSDDbSession;
  executionResult?: GSDExecutionResult;
  command?: GSDCommand;
}): string {
  if (executionResult && command) {
    const status = executionResult.success ? 'successfully executed' : 'failed execution';
    const duration = executionResult.duration ? ` in ${executionResult.duration}s` : '';
    return `${command.label} ${status}${duration} for session ${session.session_name}`;
  }

  return `GSD session ${session.session_name} (${session.session_type})`;
}

function buildCardTags({
  session,
  project,
  command,
  executionResult,
  additionalTags
}: {
  session: GSDDbSession;
  project?: GSDProject;
  command?: GSDCommand;
  executionResult?: GSDExecutionResult;
  additionalTags: string[];
}): string[] {
  const tags = new Set<string>();

  // Core GSD tags
  tags.add('gsd');
  tags.add('notebook');
  tags.add(`session:${session.session_type}`);
  tags.add(`status:${session.status}`);

  // Project tags
  if (project?.tags) {
    project.tags.forEach(tag => tags.add(`project:${tag}`));
  }

  // Command tags
  if (command) {
    tags.add(`command:${command.category}`);
    tags.add(`tool:${command.id}`);
  }

  // Execution tags
  if (executionResult) {
    tags.add(executionResult.success ? 'execution:success' : 'execution:failed');

    if (executionResult.testsRun) {
      const testStatus = executionResult.testsPassed === executionResult.testsRun ? 'tests:passing' : 'tests:failing';
      tags.add(testStatus);
    }

    if (executionResult.commitHash) {
      tags.add('git:committed');
    }
  }

  // Additional tags
  additionalTags.forEach(tag => tags.add(tag));

  return Array.from(tags);
}

function determineCardFolder({
  session,
  project,
  command
}: {
  session: GSDDbSession;
  project?: GSDProject;
  command?: GSDCommand;
}): string {
  // GSD executor pattern: organize by project then session type
  if (project) {
    return `GSD/${project.name}`;
  }

  // Fallback to session type organization
  const sessionTypeMap: Record<string, string> = {
    'research': 'GSD/Research',
    'planning': 'GSD/Planning',
    'execution': 'GSD/Execution',
    'standard': 'GSD/General'
  };

  return sessionTypeMap[session.session_type] || 'GSD/General';
}

function determinePriority(
  session: GSDDbSession,
  command?: GSDCommand
): number {
  // Higher priority for critical commands and completed sessions
  if (session.status === 'completed') return 3;
  if (command?.dangerLevel === 'danger') return 3;
  if (command?.dangerLevel === 'warning') return 2;
  if (session.status === 'active') return 2;
  return 1;
}

function buildSessionSummaryContent({
  session,
  project,
  executionResults,
  successfulExecutions,
  failedExecutions
}: {
  session: GSDDbSession;
  project?: GSDProject;
  executionResults: GSDExecutionResult[];
  successfulExecutions: GSDExecutionResult[];
  failedExecutions: GSDExecutionResult[];
}): string {
  let content = `# Session Summary: ${session.session_name}\n\n`;

  if (project) {
    content += `**Project:** ${project.name}\n\n`;
  }

  content += `**Session Duration:** ${session.started_at} to ${session.completed_at || 'ongoing'}\n`;
  content += `**Total Executions:** ${executionResults.length}\n`;
  content += `**Successful:** ${successfulExecutions.length}\n`;
  content += `**Failed:** ${failedExecutions.length}\n\n`;

  if (successfulExecutions.length > 0) {
    content += `## ✅ Successful Executions\n`;
    successfulExecutions.forEach(result => {
      content += `- ${result.output.split('\n')[0] || 'Execution'} (${result.duration}s)\n`;
    });
    content += '\n';
  }

  if (failedExecutions.length > 0) {
    content += `## ❌ Failed Executions\n`;
    failedExecutions.forEach(result => {
      content += `- ${result.output.split('\n')[0] || 'Execution'} (${result.duration}s)\n`;
    });
    content += '\n';
  }

  return content;
}

// ============================================================================
// SQL Schema Extension for GSD Metadata
// ============================================================================

export const GSD_CARD_METADATA_SCHEMA = `
CREATE TABLE IF NOT EXISTS gsd_card_metadata (
  card_id TEXT PRIMARY KEY,
  gsd_session_id TEXT NOT NULL,
  gsd_project_id TEXT,
  gsd_phase TEXT,
  gsd_command TEXT,
  execution_success BOOLEAN,
  files_changed TEXT, -- JSON array
  tests_run INTEGER,
  tests_passed INTEGER,
  commit_hash TEXT,
  duration_seconds REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (card_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gsd_metadata_session ON gsd_card_metadata(gsd_session_id);
CREATE INDEX IF NOT EXISTS idx_gsd_metadata_project ON gsd_card_metadata(gsd_project_id);
CREATE INDEX IF NOT EXISTS idx_gsd_metadata_success ON gsd_card_metadata(execution_success);
`;