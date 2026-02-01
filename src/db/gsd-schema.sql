-- ============================================================================
-- GSD (Get Shit Done) Schema Extension for Isometry
-- ============================================================================
-- Extends existing nodes/edges schema with GSD-specific functionality
-- Maintains compatibility with LATCH filtering and GRAPH traversal
-- ============================================================================

-- GSD Projects: High-level project containers (stored as nodes with node_type='gsd-project')
-- Projects leverage existing nodes table but add GSD-specific metadata

-- GSD Sessions: Individual execution sessions within projects
CREATE TABLE IF NOT EXISTS gsd_sessions (
    id TEXT PRIMARY KEY,
    project_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'standard' CHECK (session_type IN ('standard', 'research', 'planning', 'execution')),

    -- Session state
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'archived')),
    current_phase INTEGER DEFAULT 0,
    total_phases INTEGER DEFAULT 0,
    progress_percentage REAL DEFAULT 0.0,

    -- Session context and configuration
    context TEXT,  -- JSON object with session-specific context
    configuration TEXT,  -- JSON object with session settings
    claude_session_id TEXT,  -- Reference to Claude Code backend session

    -- Timestamps
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    archived_at TEXT,

    -- Metadata
    created_by TEXT,
    notes TEXT,
    version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_gsd_sessions_project ON gsd_sessions(project_node_id);
CREATE INDEX IF NOT EXISTS idx_gsd_sessions_status ON gsd_sessions(status);
CREATE INDEX IF NOT EXISTS idx_gsd_sessions_activity ON gsd_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsd_sessions_claude ON gsd_sessions(claude_session_id) WHERE claude_session_id IS NOT NULL;

-- GSD Phases: Individual phases within sessions
CREATE TABLE IF NOT EXISTS gsd_phases (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES gsd_sessions(id) ON DELETE CASCADE,
    phase_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,  -- Optional link to node for artifacts

    -- Phase identification
    phase_number INTEGER NOT NULL,
    phase_name TEXT NOT NULL,
    phase_type TEXT NOT NULL DEFAULT 'task' CHECK (phase_type IN ('research', 'planning', 'implementation', 'testing', 'documentation', 'review')),

    -- Phase state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'blocked')),
    progress_percentage REAL DEFAULT 0.0,

    -- Phase content
    description TEXT,
    goals TEXT,  -- JSON array of goal strings
    acceptance_criteria TEXT,  -- JSON array of criteria
    artifacts TEXT,  -- JSON array of expected artifacts
    dependencies TEXT,  -- JSON array of dependency phase IDs

    -- Execution tracking
    started_at TEXT,
    completed_at TEXT,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,

    -- Results and output
    results TEXT,  -- JSON object with phase results
    artifacts_produced TEXT,  -- JSON array of actual artifacts created
    notes TEXT,

    UNIQUE(session_id, phase_number)
);

CREATE INDEX IF NOT EXISTS idx_gsd_phases_session ON gsd_phases(session_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_gsd_phases_status ON gsd_phases(status);
CREATE INDEX IF NOT EXISTS idx_gsd_phases_node ON gsd_phases(phase_node_id) WHERE phase_node_id IS NOT NULL;

-- GSD Decisions: Choices made during execution (decision trees)
CREATE TABLE IF NOT EXISTS gsd_decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES gsd_sessions(id) ON DELETE CASCADE,
    phase_id TEXT REFERENCES gsd_phases(id) ON DELETE SET NULL,

    -- Decision context
    decision_point TEXT NOT NULL,  -- Description of what decision was needed
    decision_type TEXT NOT NULL DEFAULT 'choice' CHECK (decision_type IN ('choice', 'input', 'confirmation', 'branch')),
    decision_context TEXT,  -- JSON object with context at time of decision

    -- Options and choice
    options_presented TEXT,  -- JSON array of available options
    choice_made TEXT NOT NULL,  -- Selected option or input provided
    choice_reasoning TEXT,  -- Why this choice was made

    -- Execution impact
    impact_on_workflow TEXT,  -- JSON object describing how choice affected execution
    alternative_paths TEXT,  -- JSON object with paths not taken

    -- Timestamps
    presented_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Metadata
    auto_decided INTEGER DEFAULT 0,  -- 1 if automatically decided, 0 if user choice
    confidence_score REAL,  -- 0.0-1.0 confidence in decision
    decision_source TEXT  -- 'user', 'auto', 'claude', 'template'
);

CREATE INDEX IF NOT EXISTS idx_gsd_decisions_session ON gsd_decisions(session_id, decided_at);
CREATE INDEX IF NOT EXISTS idx_gsd_decisions_phase ON gsd_decisions(phase_id) WHERE phase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gsd_decisions_type ON gsd_decisions(decision_type);

-- GSD Commands: Individual commands executed within phases
CREATE TABLE IF NOT EXISTS gsd_commands (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES gsd_sessions(id) ON DELETE CASCADE,
    phase_id TEXT REFERENCES gsd_phases(id) ON DELETE CASCADE,

    -- Command identification
    command_type TEXT NOT NULL,  -- 'new-project', 'plan-phase', 'execute-plan', etc.
    command_label TEXT NOT NULL,
    slash_command TEXT,  -- Equivalent slash command representation

    -- Command state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage REAL DEFAULT 0.0,

    -- Command data
    input_data TEXT,  -- JSON object with command input
    output_data TEXT,  -- JSON object with command output
    error_data TEXT,  -- JSON object with error information if failed

    -- Execution tracking
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,

    -- Backend tracking
    claude_command_id TEXT,  -- Reference to Claude Code backend command
    backend_response TEXT,  -- Raw backend response for debugging

    -- Parent/child relationships for command decomposition
    parent_command_id TEXT REFERENCES gsd_commands(id) ON DELETE CASCADE,
    sequence_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gsd_commands_session ON gsd_commands(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_gsd_commands_phase ON gsd_commands(phase_id) WHERE phase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gsd_commands_status ON gsd_commands(status);
CREATE INDEX IF NOT EXISTS idx_gsd_commands_parent ON gsd_commands(parent_command_id) WHERE parent_command_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gsd_commands_claude ON gsd_commands(claude_command_id) WHERE claude_command_id IS NOT NULL;

-- GSD Templates: Reusable project and workflow templates
CREATE TABLE IF NOT EXISTS gsd_templates (
    id TEXT PRIMARY KEY,
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'project' CHECK (template_type IN ('project', 'phase', 'workflow', 'decision-tree')),

    -- Template content
    description TEXT,
    template_data TEXT NOT NULL,  -- JSON object with template structure
    default_configuration TEXT,  -- JSON object with default settings

    -- Template metadata
    category TEXT,
    tags TEXT,  -- JSON array of tags
    complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('simple', 'medium', 'complex')),
    estimated_duration_minutes INTEGER,

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,

    -- Versioning and sharing
    version TEXT DEFAULT '1.0.0',
    author TEXT,
    is_public INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gsd_templates_type ON gsd_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_gsd_templates_category ON gsd_templates(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gsd_templates_public ON gsd_templates(is_public) WHERE is_public = 1;
CREATE INDEX IF NOT EXISTS idx_gsd_templates_usage ON gsd_templates(usage_count DESC);

-- GSD Analytics: Performance and productivity tracking
CREATE TABLE IF NOT EXISTS gsd_analytics (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES gsd_sessions(id) ON DELETE CASCADE,

    -- Analytics type and scope
    metric_type TEXT NOT NULL,  -- 'session_duration', 'phase_completion', 'decision_speed', etc.
    metric_scope TEXT NOT NULL DEFAULT 'session' CHECK (metric_scope IN ('session', 'phase', 'command', 'decision', 'global')),

    -- Metric data
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL,  -- 'seconds', 'count', 'percentage', etc.
    metric_context TEXT,  -- JSON object with additional context

    -- Timestamps
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    period_start TEXT,
    period_end TEXT,

    -- Metadata
    tags TEXT,  -- JSON array for filtering/grouping
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_gsd_analytics_session ON gsd_analytics(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gsd_analytics_type ON gsd_analytics(metric_type, recorded_at);
CREATE INDEX IF NOT EXISTS idx_gsd_analytics_scope ON gsd_analytics(metric_scope);

-- ============================================================================
-- GSD Integration Views: Convenient queries for common operations
-- ============================================================================

-- Active GSD Projects with session summary
CREATE VIEW IF NOT EXISTS gsd_active_projects AS
SELECT
    n.id as project_id,
    n.name as project_name,
    n.content as project_description,
    n.created_at as project_created,
    COUNT(s.id) as total_sessions,
    COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_sessions,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
    MAX(s.last_activity_at) as last_activity,
    AVG(s.progress_percentage) as avg_progress
FROM nodes n
LEFT JOIN gsd_sessions s ON n.id = s.project_node_id
WHERE n.node_type = 'gsd-project'
  AND n.deleted_at IS NULL
GROUP BY n.id, n.name, n.content, n.created_at;

-- Session progress with phase breakdown
CREATE VIEW IF NOT EXISTS gsd_session_progress AS
SELECT
    s.id as session_id,
    s.session_name,
    s.status as session_status,
    s.progress_percentage as session_progress,
    COUNT(p.id) as total_phases,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_phases,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_phases,
    COUNT(CASE WHEN p.status = 'blocked' THEN 1 END) as blocked_phases,
    s.started_at,
    s.last_activity_at
FROM gsd_sessions s
LEFT JOIN gsd_phases p ON s.id = p.session_id
GROUP BY s.id, s.session_name, s.status, s.progress_percentage, s.started_at, s.last_activity_at;

-- Decision history with context
CREATE VIEW IF NOT EXISTS gsd_decision_history AS
SELECT
    d.id as decision_id,
    d.decision_point,
    d.decision_type,
    d.choice_made,
    d.decided_at,
    s.session_name,
    p.phase_name,
    d.confidence_score,
    d.decision_source
FROM gsd_decisions d
JOIN gsd_sessions s ON d.session_id = s.id
LEFT JOIN gsd_phases p ON d.phase_id = p.id
ORDER BY d.decided_at DESC;

-- ============================================================================
-- GSD Triggers: Maintain data consistency and update timestamps
-- ============================================================================

-- Update session progress when phases change
CREATE TRIGGER IF NOT EXISTS gsd_update_session_progress AFTER UPDATE OF status ON gsd_phases
BEGIN
    UPDATE gsd_sessions
    SET
        progress_percentage = (
            SELECT CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS REAL) * 100.0 / COUNT(*)
            FROM gsd_phases
            WHERE session_id = NEW.session_id
        ),
        last_activity_at = datetime('now')
    WHERE id = NEW.session_id;
END;

-- Update session activity timestamp on any session-related activity
CREATE TRIGGER IF NOT EXISTS gsd_update_session_activity_decisions AFTER INSERT ON gsd_decisions
BEGIN
    UPDATE gsd_sessions
    SET last_activity_at = datetime('now')
    WHERE id = NEW.session_id;
END;

CREATE TRIGGER IF NOT EXISTS gsd_update_session_activity_commands AFTER INSERT ON gsd_commands
BEGIN
    UPDATE gsd_sessions
    SET last_activity_at = datetime('now')
    WHERE id = NEW.session_id;
END;

-- Update template usage statistics
CREATE TRIGGER IF NOT EXISTS gsd_update_template_usage AFTER INSERT ON gsd_sessions
WHEN NEW.configuration IS NOT NULL AND json_extract(NEW.configuration, '$.template_id') IS NOT NULL
BEGIN
    UPDATE gsd_templates
    SET
        usage_count = usage_count + 1,
        last_used_at = datetime('now')
    WHERE id = json_extract(NEW.configuration, '$.template_id');
END;

-- ============================================================================
-- GSD Default Templates: Built-in templates for common workflows
-- ============================================================================

INSERT OR IGNORE INTO gsd_templates (id, template_name, template_type, description, template_data, category, tags, complexity_level, estimated_duration_minutes, is_system) VALUES
('basic-project', 'Basic Project', 'project', 'Standard project workflow with research, planning, and implementation phases',
 '{"phases": [{"name": "Research & Discovery", "type": "research", "description": "Gather requirements and understand the problem space"}, {"name": "Planning & Design", "type": "planning", "description": "Create detailed implementation plan"}, {"name": "Implementation", "type": "implementation", "description": "Execute the plan and build solution"}, {"name": "Testing & Review", "type": "testing", "description": "Validate solution meets requirements"}]}',
 'general', '["project", "standard", "beginner"]', 'simple', 120, 1),

('research-deep-dive', 'Research Deep Dive', 'workflow', 'Comprehensive research workflow for complex topics',
 '{"phases": [{"name": "Topic Scoping", "type": "planning", "description": "Define research scope and questions"}, {"name": "Source Discovery", "type": "research", "description": "Find and evaluate information sources"}, {"name": "Data Collection", "type": "research", "description": "Gather and organize research data"}, {"name": "Analysis & Synthesis", "type": "review", "description": "Analyze findings and create insights"}, {"name": "Documentation", "type": "documentation", "description": "Document research findings and recommendations"}]}',
 'research', '["research", "analysis", "comprehensive"]', 'complex', 240, 1),

('quick-implementation', 'Quick Implementation', 'project', 'Fast-track implementation for well-defined tasks',
 '{"phases": [{"name": "Quick Plan", "type": "planning", "description": "Create minimal viable plan"}, {"name": "Build", "type": "implementation", "description": "Implement solution quickly"}, {"name": "Test", "type": "testing", "description": "Basic testing and validation"}]}',
 'development', '["quick", "implementation", "agile"]', 'simple', 60, 1);

-- ============================================================================
-- GSD Facets: Register GSD-specific facets for LATCH filtering
-- ============================================================================

INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column, options) VALUES
('gsd_session_status', 'GSD Session Status', 'select', 'C', 'status', '["active", "paused", "completed", "cancelled", "archived"]'),
('gsd_phase_type', 'GSD Phase Type', 'select', 'C', 'phase_type', '["research", "planning", "implementation", "testing", "documentation", "review"]'),
('gsd_template', 'GSD Template', 'select', 'C', 'template_id', null),
('gsd_progress', 'GSD Progress', 'number', 'H', 'progress_percentage', '{"min": 0, "max": 100, "step": 5}');