/**
 * GSD Database Service
 *
 * Provides high-level database operations for GSD functionality
 * Integrates with existing Isometry SQLite infrastructure
 */

import type {
  GSDProject,
  GSDSession,
  GSDPhase,
  GSDDecision,
  GSDCommand,
  GSDTemplate,
  GSDAnalytics,
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
  GSDSessionAnalytics,
} from '../../types/gsd/database';

import { v4 as uuidv4 } from 'uuid';

// Database interface that can work with both sql.js and native SQLite
interface DatabaseConnection {
  exec(sql: string, params?: unknown[]): unknown[];
  prepare(sql: string): DatabaseStatement;
  transaction<T>(fn: () => T): T;
}

interface DatabaseStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  finalize(): void;
}

export class GSDDatabase {
  private db: DatabaseConnection;

  constructor(database: DatabaseConnection) {
    this.db = database;
  }

  // ============================================================================
  // Schema Management
  // ============================================================================

  async initializeGSDSchema(): Promise<void> {
    const schemaSQL = await fetch('/src/db/gsd-schema.sql').then(r => r.text());
    this.db.exec(schemaSQL);
  }

  async migrateGSDSchema(fromVersion: number, toVersion: number): Promise<void> {
    // Implement schema migration logic as needed
    console.log(`Migrating GSD schema from ${fromVersion} to ${toVersion}`);
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  async createProject(params: CreateGSDProjectParams): Promise<GSDProject> {
    const projectId = uuidv4();
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      // Create node in main nodes table
      const nodeStmt = this.db.prepare(`
        INSERT INTO nodes (
          id, node_type, name, content, tags, priority, created_at, modified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      nodeStmt.run(
        projectId,
        'gsd-project',
        params.name,
        params.description || '',
        JSON.stringify(params.tags || []),
        params.priority || 0,
        now,
        now
      );

      nodeStmt.finalize();

      // Return the created project
      const project = this.getProject(projectId);
      if (!project) {
        throw new Error('Failed to create GSD project');
      }
      return project;
    });
  }

  getProject(projectId: string): GSDProject | null {
    const stmt = this.db.prepare(`
      SELECT id, name, content, summary, created_at, modified_at, tags, status, priority
      FROM nodes
      WHERE id = ? AND node_type = 'gsd-project' AND deleted_at IS NULL
    `);

    const row = stmt.get(projectId) as any;
    stmt.finalize();

    if (!row) return null;

    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
    };
  }

  getActiveProjects(): GSDActiveProject[] {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_active_projects
      ORDER BY last_activity DESC NULLS LAST, project_created DESC
    `);

    const rows = stmt.all() as any[];
    stmt.finalize();

    return rows;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async createSession(params: CreateGSDSessionParams): Promise<GSDSession> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO gsd_sessions (
        id, project_node_id, session_name, session_type, context, configuration,
        started_at, last_activity_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      params.project_node_id,
      params.session_name,
      params.session_type || 'standard',
      params.context ? JSON.stringify(params.context) : null,
      params.configuration ? JSON.stringify(params.configuration) : null,
      now,
      now,
      params.created_by
    );

    stmt.finalize();

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Failed to create GSD session');
    }
    return session;
  }

  getSession(sessionId: string): GSDSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_sessions WHERE id = ?
    `);

    const row = stmt.get(sessionId) as any;
    stmt.finalize();

    if (!row) return null;

    return {
      ...row,
      context: row.context ? JSON.parse(row.context) : undefined,
      configuration: row.configuration ? JSON.parse(row.configuration) : undefined,
    };
  }

  getSessionsByProject(projectId: string, filter?: GSDSessionFilter): GSDSession[] {
    let whereClause = 'project_node_id = ?';
    const params: unknown[] = [projectId];

    if (filter?.status?.length) {
      whereClause += ` AND status IN (${filter.status.map(() => '?').join(', ')})`;
      params.push(...filter.status);
    }

    if (filter?.session_type?.length) {
      whereClause += ` AND session_type IN (${filter.session_type.map(() => '?').join(', ')})`;
      params.push(...filter.session_type);
    }

    if (filter?.start_date) {
      whereClause += ' AND started_at >= ?';
      params.push(filter.start_date);
    }

    if (filter?.end_date) {
      whereClause += ' AND started_at <= ?';
      params.push(filter.end_date);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM gsd_sessions
      WHERE ${whereClause}
      ORDER BY last_activity_at DESC
    `);

    const rows = stmt.all(...params) as any[];
    stmt.finalize();

    return rows.map(row => ({
      ...row,
      context: row.context ? JSON.parse(row.context) : undefined,
      configuration: row.configuration ? JSON.parse(row.configuration) : undefined,
    }));
  }

  getSessionProgress(): GSDSessionProgress[] {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_session_progress
      ORDER BY last_activity_at DESC
    `);

    const rows = stmt.all() as any[];
    stmt.finalize();
    return rows;
  }

  updateSessionStatus(sessionId: string, status: GSDSession['status']): void {
    const stmt = this.db.prepare(`
      UPDATE gsd_sessions
      SET status = ?, last_activity_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(status, sessionId);
    stmt.finalize();
  }

  // ============================================================================
  // Phase Management
  // ============================================================================

  async createPhase(params: CreateGSDPhaseParams): Promise<GSDPhase> {
    const phaseId = uuidv4();

    const stmt = this.db.prepare(`
      INSERT INTO gsd_phases (
        id, session_id, phase_number, phase_name, phase_type, description,
        goals, acceptance_criteria, estimated_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      phaseId,
      params.session_id,
      params.phase_number,
      params.phase_name,
      params.phase_type,
      params.description,
      params.goals ? JSON.stringify(params.goals) : null,
      params.acceptance_criteria ? JSON.stringify(params.acceptance_criteria) : null,
      params.estimated_duration_minutes
    );

    stmt.finalize();

    const phase = this.getPhase(phaseId);
    if (!phase) {
      throw new Error('Failed to create GSD phase');
    }
    return phase;
  }

  getPhase(phaseId: string): GSDPhase | null {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_phases WHERE id = ?
    `);

    const row = stmt.get(phaseId) as any;
    stmt.finalize();

    if (!row) return null;

    return {
      ...row,
      goals: row.goals ? JSON.parse(row.goals) : undefined,
      acceptance_criteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria) : undefined,
      artifacts: row.artifacts ? JSON.parse(row.artifacts) : undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      results: row.results ? JSON.parse(row.results) : undefined,
      artifacts_produced: row.artifacts_produced ? JSON.parse(row.artifacts_produced) : undefined,
    };
  }

  getPhasesBySession(sessionId: string, filter?: GSDPhaseFilter): GSDPhase[] {
    let whereClause = 'session_id = ?';
    const params: unknown[] = [sessionId];

    if (filter?.status?.length) {
      whereClause += ` AND status IN (${filter.status.map(() => '?').join(', ')})`;
      params.push(...filter.status);
    }

    if (filter?.phase_type?.length) {
      whereClause += ` AND phase_type IN (${filter.phase_type.map(() => '?').join(', ')})`;
      params.push(...filter.phase_type);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM gsd_phases
      WHERE ${whereClause}
      ORDER BY phase_number ASC
    `);

    const rows = stmt.all(...params) as any[];
    stmt.finalize();

    return rows.map(row => ({
      ...row,
      goals: row.goals ? JSON.parse(row.goals) : undefined,
      acceptance_criteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria) : undefined,
      artifacts: row.artifacts ? JSON.parse(row.artifacts) : undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      results: row.results ? JSON.parse(row.results) : undefined,
      artifacts_produced: row.artifacts_produced ? JSON.parse(row.artifacts_produced) : undefined,
    }));
  }

  updatePhaseProgress(params: UpdateGSDPhaseProgressParams): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);

      if (params.status === 'active' && !this.getPhase(params.phase_id)?.started_at) {
        updates.push('started_at = datetime(\'now\')');
      }

      if (params.status === 'completed') {
        updates.push('completed_at = datetime(\'now\')');
        updates.push('progress_percentage = 100.0');
      }
    }

    if (params.progress_percentage !== undefined) {
      updates.push('progress_percentage = ?');
      values.push(params.progress_percentage);
    }

    if (params.results !== undefined) {
      updates.push('results = ?');
      values.push(JSON.stringify(params.results));
    }

    if (params.artifacts_produced !== undefined) {
      updates.push('artifacts_produced = ?');
      values.push(JSON.stringify(params.artifacts_produced));
    }

    if (params.notes !== undefined) {
      updates.push('notes = ?');
      values.push(params.notes);
    }

    if (updates.length === 0) return;

    values.push(params.phase_id);

    const stmt = this.db.prepare(`
      UPDATE gsd_phases
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    stmt.finalize();
  }

  // ============================================================================
  // Decision Management
  // ============================================================================

  async createDecision(params: CreateGSDDecisionParams): Promise<GSDDecision> {
    const decisionId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO gsd_decisions (
        id, session_id, phase_id, decision_point, decision_type, options_presented,
        choice_made, choice_reasoning, presented_at, decided_at, auto_decided,
        confidence_score, decision_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      decisionId,
      params.session_id,
      params.phase_id,
      params.decision_point,
      params.decision_type,
      params.options_presented ? JSON.stringify(params.options_presented) : null,
      params.choice_made,
      params.choice_reasoning,
      now,
      now,
      0, // auto_decided = false by default
      params.confidence_score,
      params.decision_source || 'user'
    );

    stmt.finalize();

    const decision = this.getDecision(decisionId);
    if (!decision) {
      throw new Error('Failed to create GSD decision');
    }
    return decision;
  }

  getDecision(decisionId: string): GSDDecision | null {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_decisions WHERE id = ?
    `);

    const row = stmt.get(decisionId) as any;
    stmt.finalize();

    if (!row) return null;

    return {
      ...row,
      auto_decided: Boolean(row.auto_decided),
      decision_context: row.decision_context ? JSON.parse(row.decision_context) : undefined,
      options_presented: row.options_presented ? JSON.parse(row.options_presented) : undefined,
      impact_on_workflow: row.impact_on_workflow ? JSON.parse(row.impact_on_workflow) : undefined,
      alternative_paths: row.alternative_paths ? JSON.parse(row.alternative_paths) : undefined,
    };
  }

  getDecisionHistory(filter?: GSDDecisionFilter): GSDDecisionHistory[] {
    let whereClause = '1=1';
    const params: unknown[] = [];

    if (filter?.session_id) {
      whereClause += ' AND d.session_id = ?';
      params.push(filter.session_id);
    }

    if (filter?.phase_id) {
      whereClause += ' AND d.phase_id = ?';
      params.push(filter.phase_id);
    }

    if (filter?.decision_type?.length) {
      whereClause += ` AND d.decision_type IN (${filter.decision_type.map(() => '?').join(', ')})`;
      params.push(...filter.decision_type);
    }

    if (filter?.confidence_min) {
      whereClause += ' AND d.confidence_score >= ?';
      params.push(filter.confidence_min);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM gsd_decision_history
      WHERE ${whereClause}
      ORDER BY decided_at DESC
      LIMIT 100
    `);

    const rows = stmt.all(...params) as any[];
    stmt.finalize();
    return rows;
  }

  // ============================================================================
  // Command Management
  // ============================================================================

  async createCommand(params: CreateGSDCommandParams): Promise<GSDCommand> {
    const commandId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO gsd_commands (
        id, session_id, phase_id, command_type, command_label, slash_command,
        input_data, parent_command_id, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      commandId,
      params.session_id,
      params.phase_id,
      params.command_type,
      params.command_label,
      params.slash_command,
      params.input_data ? JSON.stringify(params.input_data) : null,
      params.parent_command_id,
      now
    );

    stmt.finalize();

    const command = this.getCommand(commandId);
    if (!command) {
      throw new Error('Failed to create GSD command');
    }
    return command;
  }

  getCommand(commandId: string): GSDCommand | null {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_commands WHERE id = ?
    `);

    const row = stmt.get(commandId) as any;
    stmt.finalize();

    if (!row) return null;

    return {
      ...row,
      input_data: row.input_data ? JSON.parse(row.input_data) : undefined,
      output_data: row.output_data ? JSON.parse(row.output_data) : undefined,
      error_data: row.error_data ? JSON.parse(row.error_data) : undefined,
    };
  }

  getCommandsBySession(sessionId: string): GSDCommand[] {
    const stmt = this.db.prepare(`
      SELECT * FROM gsd_commands
      WHERE session_id = ?
      ORDER BY started_at ASC
    `);

    const rows = stmt.all(sessionId) as any[];
    stmt.finalize();

    return rows.map(row => ({
      ...row,
      input_data: row.input_data ? JSON.parse(row.input_data) : undefined,
      output_data: row.output_data ? JSON.parse(row.output_data) : undefined,
      error_data: row.error_data ? JSON.parse(row.error_data) : undefined,
    }));
  }

  updateCommand(params: UpdateGSDCommandParams): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);

      if (params.status === 'completed' || params.status === 'failed') {
        updates.push('completed_at = datetime(\'now\')');
      }
    }

    if (params.progress_percentage !== undefined) {
      updates.push('progress_percentage = ?');
      values.push(params.progress_percentage);
    }

    if (params.output_data !== undefined) {
      updates.push('output_data = ?');
      values.push(JSON.stringify(params.output_data));
    }

    if (params.error_data !== undefined) {
      updates.push('error_data = ?');
      values.push(JSON.stringify(params.error_data));
    }

    if (params.claude_command_id !== undefined) {
      updates.push('claude_command_id = ?');
      values.push(params.claude_command_id);
    }

    if (params.backend_response !== undefined) {
      updates.push('backend_response = ?');
      values.push(params.backend_response);
    }

    if (updates.length === 0) return;

    values.push(params.command_id);

    const stmt = this.db.prepare(`
      UPDATE gsd_commands
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    stmt.finalize();
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  getTemplates(category?: string): GSDTemplate[] {
    let whereClause = '1=1';
    const params: unknown[] = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM gsd_templates
      WHERE ${whereClause}
      ORDER BY usage_count DESC, template_name ASC
    `);

    const rows = stmt.all(...params) as any[];
    stmt.finalize();

    return rows.map(row => ({
      ...row,
      template_data: JSON.parse(row.template_data),
      default_configuration: row.default_configuration ? JSON.parse(row.default_configuration) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      is_public: Boolean(row.is_public),
      is_system: Boolean(row.is_system),
    }));
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  getProductivityMetrics(days = 30): GSDProductivityMetrics {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString();

    // This would involve multiple queries - simplified for now
    return {
      avg_session_duration_hours: 2.5,
      avg_phases_per_session: 4.2,
      phase_completion_rate: 0.87,
      decision_speed_avg_minutes: 3.2,
      most_used_templates: [],
      productivity_trend: [],
    };
  }

  // ============================================================================
  // Cleanup and Maintenance
  // ============================================================================

  archiveCompletedSessions(daysOld = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoff = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      UPDATE gsd_sessions
      SET status = 'archived', archived_at = datetime('now')
      WHERE status = 'completed' AND completed_at < ?
    `);

    const result = stmt.run(cutoff);
    stmt.finalize();
    return result.changes;
  }

  purgeOldAnalytics(daysOld = 365): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoff = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM gsd_analytics
      WHERE recorded_at < ?
    `);

    const result = stmt.run(cutoff);
    stmt.finalize();
    return result.changes;
  }
}