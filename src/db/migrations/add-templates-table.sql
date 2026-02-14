-- Migration: Add templates table for /template slash command
-- Phase: 95-data-layer-backlinks
-- Plan: 95-01 Templates Data Layer

-- ============================================================================
-- Templates: Saved content templates for /template slash command
-- ============================================================================

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- 'meeting', 'project', 'note', 'daily', 'custom'
    content TEXT NOT NULL,  -- Markdown content
    variables TEXT,  -- JSON array of variable placeholders
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);

-- FTS5 for template search
CREATE VIRTUAL TABLE IF NOT EXISTS templates_fts USING fts5(
    name,
    description,
    content,
    content='templates',
    content_rowid='rowid'
);

-- FTS5 triggers for templates
CREATE TRIGGER IF NOT EXISTS trg_templates_fts_insert AFTER INSERT ON templates BEGIN
    INSERT INTO templates_fts(rowid, name, description, content)
    VALUES (NEW.rowid, NEW.name, NEW.description, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_fts_delete AFTER DELETE ON templates BEGIN
    INSERT INTO templates_fts(templates_fts, rowid, name, description, content)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_fts_update AFTER UPDATE ON templates BEGIN
    INSERT INTO templates_fts(templates_fts, rowid, name, description, content)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.content);
    INSERT INTO templates_fts(rowid, name, description, content)
    VALUES (NEW.rowid, NEW.name, NEW.description, NEW.content);
END;
