-- Minimal schema for testing
CREATE TABLE IF NOT EXISTS test_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

INSERT OR IGNORE INTO test_nodes (id, name, content) VALUES
('test-1', 'Test Node 1', 'This is test content'),
('test-2', 'Test Node 2', 'More test content'),
('test-3', 'Test Node 3', 'Even more test content');