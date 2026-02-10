-- GSD (Getting Shit Done) SQLite Schema
-- Integrates with existing Isometry LPG schema using nodes/edges pattern

-- GSD Sessions stored as nodes with type 'gsd_session'
-- This means they appear in CardBoard views, are searchable via FTS5,
-- and maintain GRAPH relationships to projects/tasks

-- Example GSD session node:
-- INSERT INTO nodes (id, node_type, name, content, folder, status, tags, metadata)
-- VALUES (
--   'gsd-session-' || hex(randomblob(8)),
--   'gsd_session',
--   'Implement SuperGrid rendering',
--   '{"description": "Phase 2 implementation of SuperGrid with D3 rendering"}',
--   'GSD Sessions',
--   'active',
--   '["cardboard", "supergrid", "d3"]',
--   json_object(
--     'phase', 'implement',
--     'status', 'executing',
--     'startedAt', datetime('now'),
--     'projectPath', '/Users/mshaler/Developer/Projects/Isometry',
--     'sessionData', json_object(
--       'currentPhase', 'implement',
--       'pendingChoices', null,
--       'tokenUsage', json_object('input', 0, 'output', 0, 'cost', 0),
--       'executionTime', 0
--     )
--   )
-- );

-- Phase history events as separate nodes linked via edges
CREATE TABLE IF NOT EXISTS gsd_phase_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('idle', 'spec', 'plan', 'implement', 'test', 'commit', 'error')),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'error')),
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration_ms INTEGER,
  metadata TEXT, -- JSON
  FOREIGN KEY (session_id) REFERENCES nodes(id)
);

-- GSD Messages log (stdout parsing results)
CREATE TABLE IF NOT EXISTS gsd_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('text', 'tool_use', 'choice', 'phase', 'result', 'error')),
  content TEXT NOT NULL,
  choices TEXT, -- JSON array of choice objects
  phase TEXT,
  metadata TEXT, -- JSON for additional data
  FOREIGN KEY (session_id) REFERENCES nodes(id)
);

-- File changes tracked during GSD execution
CREATE TABLE IF NOT EXISTS gsd_file_changes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'modify', 'delete')),
  diff_content TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tool_use_id TEXT, -- Links to the tool use that made this change
  FOREIGN KEY (session_id) REFERENCES nodes(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gsd_phase_events_session ON gsd_phase_events(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_gsd_messages_session ON gsd_messages(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_gsd_file_changes_session ON gsd_file_changes(session_id, timestamp);

-- FTS5 for searching GSD content
CREATE VIRTUAL TABLE IF NOT EXISTS gsd_search USING fts5(
  session_name,
  message_content,
  file_paths,
  content='',
  contentless_delete=1
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS gsd_search_insert AFTER INSERT ON gsd_messages
BEGIN
  INSERT INTO gsd_search(rowid, session_name, message_content, file_paths)
  SELECT NEW.session_id,
         (SELECT name FROM nodes WHERE id = NEW.session_id),
         NEW.content,
         (SELECT group_concat(path, ' ') FROM gsd_file_changes WHERE session_id = NEW.session_id);
END;

-- Views for easy querying
CREATE VIEW IF NOT EXISTS gsd_active_sessions AS
SELECT
  n.id as session_id,
  n.name as session_name,
  n.status,
  json_extract(n.metadata, '$.sessionData.currentPhase') as current_phase,
  json_extract(n.metadata, '$.sessionData.status') as session_status,
  n.created_at as started_at,
  json_extract(n.metadata, '$.projectPath') as project_path,
  json_extract(n.metadata, '$.sessionData.tokenUsage') as token_usage,
  (SELECT COUNT(*) FROM gsd_file_changes WHERE session_id = n.id) as file_changes_count,
  (SELECT COUNT(*) FROM gsd_messages WHERE session_id = n.id AND type = 'error') as error_count
FROM nodes n
WHERE n.node_type = 'gsd_session'
  AND n.status IN ('active', 'executing', 'waiting-input');

CREATE VIEW IF NOT EXISTS gsd_session_summary AS
SELECT
  n.id as session_id,
  n.name as session_name,
  n.status,
  n.created_at as started_at,
  n.modified_at as last_activity,
  json_extract(n.metadata, '$.sessionData.currentPhase') as current_phase,
  json_extract(n.metadata, '$.sessionData.status') as session_status,
  json_extract(n.metadata, '$.projectPath') as project_path,
  (SELECT COUNT(*) FROM gsd_phase_events WHERE session_id = n.id AND status = 'completed') as completed_phases,
  (SELECT COUNT(*) FROM gsd_file_changes WHERE session_id = n.id) as total_file_changes,
  (SELECT COUNT(*) FROM gsd_file_changes WHERE session_id = n.id AND change_type = 'create') as files_created,
  (SELECT COUNT(*) FROM gsd_file_changes WHERE session_id = n.id AND change_type = 'modify') as files_modified,
  (SELECT COUNT(*) FROM gsd_file_changes WHERE session_id = n.id AND change_type = 'delete') as files_deleted,
  json_extract(n.metadata, '$.sessionData.tokenUsage.input') as tokens_input,
  json_extract(n.metadata, '$.sessionData.tokenUsage.output') as tokens_output,
  json_extract(n.metadata, '$.sessionData.tokenUsage.cost') as estimated_cost
FROM nodes n
WHERE n.node_type = 'gsd_session'
ORDER BY n.modified_at DESC;