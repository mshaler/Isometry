/**
 * GSD Service - SQLite-based state management for GSD sessions
 *
 * Manages GSD sessions, messages, file changes, and phase tracking
 * using the existing Isometry SQLite infrastructure.
 */

import { Database } from 'sql.js';
import {
  GSDSessionState,
  GSDMessage,
  PhaseEvent,
  FileChange,
  GSDPhase,
  GSDStatus
} from '../../types/gsd';

export class GSDService {
  constructor(private db: Database) {}

  /**
   * Initialize GSD schema in the database
   */
  async initializeSchema(): Promise<void> {
    // Read and execute the GSD schema SQL
    const schemaSQL = await import('../../db/gsd-schema.sql?raw');
    this.db.exec(schemaSQL.default);
  }

  /**
   * Create a new GSD session
   */
  createSession(projectPath: string, name: string): string {
    const sessionId = `gsd-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const metadata = {
      phase: 'idle' as GSDPhase,
      status: 'waiting-input' as GSDStatus,
      startedAt: now,
      projectPath,
      sessionData: {
        currentPhase: 'idle' as GSDPhase,
        pendingChoices: null,
        tokenUsage: { input: 0, output: 0, cost: 0 },
        executionTime: 0
      }
    };

    this.db.run(`
      INSERT INTO nodes (id, node_type, name, content, folder, status, tags, metadata, created_at)
      VALUES (?, 'gsd_session', ?, ?, 'GSD Sessions', 'active', ?, ?, ?)
    `, [
      sessionId,
      name,
      `GSD session for ${name}`,
      JSON.stringify(['gsd', 'automation']),
      JSON.stringify(metadata),
      now
    ]);

    return sessionId;
  }

  /**
   * Get current session state
   */
  getSessionState(sessionId: string): GSDSessionState | null {
    const result = this.db.exec(`
      SELECT n.*,
             json_extract(n.metadata, '$.sessionData') as session_data,
             json_extract(n.metadata, '$.projectPath') as project_path
      FROM nodes n
      WHERE n.id = ? AND n.node_type = 'gsd_session'
    `, [sessionId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    const sessionData = JSON.parse(row[row.length - 2] as string);
    const projectPath = row[row.length - 1] as string;

    // Get phase history
    const phaseHistory = this.getPhaseHistory(sessionId);

    // Get message log
    const messageLog = this.getMessageLog(sessionId);

    // Get file changes
    const fileChanges = this.getFileChanges(sessionId);

    return {
      sessionId,
      projectPath,
      startedAt: new Date(row[8] as string), // created_at
      phase: sessionData.currentPhase,
      status: sessionData.status,
      pendingChoices: sessionData.pendingChoices,
      pendingInputType: sessionData.pendingInputType || null,
      phaseHistory,
      messageLog,
      fileChanges,
      tokenUsage: sessionData.tokenUsage || { input: 0, output: 0, cost: 0 },
      executionTime: sessionData.executionTime || 0,
      isCollapsed: sessionData.isCollapsed || false,
      showDetails: sessionData.showDetails || false
    };
  }

  /**
   * Update session state
   */
  updateSessionState(sessionId: string, updates: Partial<GSDSessionState>): void {
    // Get current metadata
    const current = this.db.exec(`
      SELECT metadata FROM nodes WHERE id = ? AND node_type = 'gsd_session'
    `, [sessionId]);

    if (current.length === 0 || current[0].values.length === 0) {
      throw new Error(`GSD session ${sessionId} not found`);
    }

    const metadata = JSON.parse(current[0].values[0][0] as string);

    // Update the sessionData portion
    if (updates.phase) metadata.sessionData.currentPhase = updates.phase;
    if (updates.status) metadata.sessionData.status = updates.status;
    if (updates.pendingChoices !== undefined) metadata.sessionData.pendingChoices = updates.pendingChoices;
    if (updates.pendingInputType !== undefined) metadata.sessionData.pendingInputType = updates.pendingInputType;
    if (updates.tokenUsage) metadata.sessionData.tokenUsage = updates.tokenUsage;
    if (updates.executionTime !== undefined) metadata.sessionData.executionTime = updates.executionTime;
    if (updates.isCollapsed !== undefined) metadata.sessionData.isCollapsed = updates.isCollapsed;
    if (updates.showDetails !== undefined) metadata.sessionData.showDetails = updates.showDetails;

    this.db.run(`
      UPDATE nodes
      SET metadata = ?, modified_at = ?
      WHERE id = ? AND node_type = 'gsd_session'
    `, [JSON.stringify(metadata), new Date().toISOString(), sessionId]);
  }

  /**
   * Add a message to the session log
   */
  addMessage(sessionId: string, message: Omit<GSDMessage, 'id'>): string {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.db.run(`
      INSERT INTO gsd_messages (id, session_id, timestamp, type, content, choices, phase, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      messageId,
      sessionId,
      message.timestamp.toISOString(),
      message.type,
      message.content,
      message.choices ? JSON.stringify(message.choices) : null,
      message.phase || null,
      JSON.stringify({})
    ]);

    return messageId;
  }

  /**
   * Add a phase event
   */
  addPhaseEvent(sessionId: string, phase: GSDPhase, status: 'active' | 'completed' | 'error'): string {
    const eventId = `phase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // If starting a new phase, complete the previous active phase
    if (status === 'active') {
      this.db.run(`
        UPDATE gsd_phase_events
        SET status = 'completed', completed_at = ?, duration_ms = (
          (julianday(?) - julianday(started_at)) * 24 * 60 * 60 * 1000
        )
        WHERE session_id = ? AND status = 'active'
      `, [now, now, sessionId]);
    }

    this.db.run(`
      INSERT INTO gsd_phase_events (id, session_id, phase, status, started_at, completed_at, duration_ms, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eventId,
      sessionId,
      phase,
      status,
      now,
      status === 'completed' ? now : null,
      status === 'completed' ? 0 : null,
      JSON.stringify({})
    ]);

    return eventId;
  }

  /**
   * Add a file change record
   */
  addFileChange(sessionId: string, change: Omit<FileChange, 'timestamp'>): string {
    const changeId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.db.run(`
      INSERT INTO gsd_file_changes (id, session_id, path, change_type, diff_content, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      changeId,
      sessionId,
      change.path,
      change.type,
      change.diff || null,
      new Date().toISOString()
    ]);

    return changeId;
  }

  /**
   * Get phase history for a session
   */
  getPhaseHistory(sessionId: string): PhaseEvent[] {
    const result = this.db.exec(`
      SELECT phase, status, started_at, completed_at, duration_ms
      FROM gsd_phase_events
      WHERE session_id = ?
      ORDER BY started_at ASC
    `, [sessionId]);

    if (result.length === 0) return [];

    return result[0].values.map(row => ({
      phase: row[0] as GSDPhase,
      status: row[1] as 'active' | 'completed' | 'error',
      startedAt: new Date(row[2] as string),
      completedAt: row[3] ? new Date(row[3] as string) : undefined,
      duration: row[4] as number || undefined
    }));
  }

  /**
   * Get message log for a session
   */
  getMessageLog(sessionId: string, limit: number = 100): GSDMessage[] {
    const result = this.db.exec(`
      SELECT id, timestamp, type, content, choices, phase
      FROM gsd_messages
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [sessionId, limit]);

    if (result.length === 0) return [];

    return result[0].values.map(row => ({
      id: row[0] as string,
      timestamp: new Date(row[1] as string),
      type: row[2] as GSDMessage['type'],
      content: row[3] as string,
      choices: row[4] ? JSON.parse(row[4] as string) : undefined,
      phase: row[5] as GSDPhase || undefined
    })).reverse(); // Most recent last for display
  }

  /**
   * Get file changes for a session
   */
  getFileChanges(sessionId: string): FileChange[] {
    const result = this.db.exec(`
      SELECT path, change_type, diff_content, timestamp
      FROM gsd_file_changes
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `, [sessionId]);

    if (result.length === 0) return [];

    return result[0].values.map(row => ({
      path: row[0] as string,
      type: row[1] as FileChange['type'],
      diff: row[2] as string || undefined,
      timestamp: new Date(row[3] as string)
    }));
  }

  /**
   * Get file change summary counts
   */
  getFileChangeSummary(sessionId: string): { created: number; modified: number; deleted: number } {
    const result = this.db.exec(`
      SELECT
        COUNT(CASE WHEN change_type = 'create' THEN 1 END) as created,
        COUNT(CASE WHEN change_type = 'modify' THEN 1 END) as modified,
        COUNT(CASE WHEN change_type = 'delete' THEN 1 END) as deleted
      FROM gsd_file_changes
      WHERE session_id = ?
    `, [sessionId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return { created: 0, modified: 0, deleted: 0 };
    }

    const row = result[0].values[0];
    return {
      created: row[0] as number,
      modified: row[1] as number,
      deleted: row[2] as number
    };
  }

  /**
   * Get all active GSD sessions
   */
  getActiveSessions(): Array<{ sessionId: string; name: string; phase: GSDPhase; status: GSDStatus }> {
    const result = this.db.exec(`
      SELECT
        id,
        name,
        json_extract(metadata, '$.sessionData.currentPhase') as phase,
        json_extract(metadata, '$.sessionData.status') as status
      FROM nodes
      WHERE node_type = 'gsd_session' AND status = 'active'
      ORDER BY modified_at DESC
    `);

    if (result.length === 0) return [];

    return result[0].values.map(row => ({
      sessionId: row[0] as string,
      name: row[1] as string,
      phase: row[2] as GSDPhase,
      status: row[3] as GSDStatus
    }));
  }

  /**
   * Complete a session
   */
  completeSession(sessionId: string): void {
    const now = new Date().toISOString();

    // Complete any active phase
    this.db.run(`
      UPDATE gsd_phase_events
      SET status = 'completed', completed_at = ?, duration_ms = (
        (julianday(?) - julianday(started_at)) * 24 * 60 * 60 * 1000
      )
      WHERE session_id = ? AND status = 'active'
    `, [now, now, sessionId]);

    // Mark session as completed
    this.updateSessionState(sessionId, {
      status: 'complete',
      phase: 'idle'
    });

    this.db.run(`
      UPDATE nodes SET status = 'completed', modified_at = ?
      WHERE id = ? AND node_type = 'gsd_session'
    `, [now, sessionId]);
  }

  /**
   * Delete a session and all its data
   */
  deleteSession(sessionId: string): void {
    this.db.run('DELETE FROM gsd_file_changes WHERE session_id = ?', [sessionId]);
    this.db.run('DELETE FROM gsd_messages WHERE session_id = ?', [sessionId]);
    this.db.run('DELETE FROM gsd_phase_events WHERE session_id = ?', [sessionId]);
    this.db.run('DELETE FROM nodes WHERE id = ? AND node_type = "gsd_session"', [sessionId]);
  }
}