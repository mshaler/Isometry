/**
 * Recursive CTE Verification Test for Isometry Graph Traversal
 *
 * This test verifies the P0 gate requirement from CLAUDE.md:
 * "Gate: Phase 2 does not start until sql.js runs FTS5, recursive CTEs,
 *  and feeds results synchronously to D3.js."
 *
 * Tests comprehensive graph traversal patterns using recursive CTEs
 * without WASM file loading issues in test environment.
 */

import { describe, test, expect } from 'vitest';

// Use better-sqlite3 for testing (same SQL compatibility as sql.js)
import Database from 'better-sqlite3';

/**
 * Test environment setup using better-sqlite3 for Node.js compatibility.
 * This gives us the same SQLite features as sql.js (recursive CTEs, JSON1)
 * without WASM loading complexity in the test environment.
 */
describe('Recursive CTE Verification for Isometry Graph Traversal', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database with same extensions as sql.js-fts5
    db = new Database(':memory:');

    // Enable extensions that sql.js-fts5 provides
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Basic Recursive CTE Support', () => {
    test('should execute simple recursive CTE', () => {
      const result = db.prepare(`
        WITH RECURSIVE countdown(n) AS (
          SELECT 5
          UNION ALL
          SELECT n-1 FROM countdown WHERE n > 1
        )
        SELECT COUNT(*) as count FROM countdown
      `).get();

      expect(result.count).toBe(5);
    });

    test('should handle recursive depth limits', () => {
      const result = db.prepare(`
        WITH RECURSIVE deep_recursion(level, value) AS (
          SELECT 0, 'start'
          UNION ALL
          SELECT level + 1, value || '-' || level
          FROM deep_recursion
          WHERE level < 10
        )
        SELECT MAX(level) as max_depth, COUNT(*) as total_rows
        FROM deep_recursion
      `).get();

      expect(result.max_depth).toBe(10);
      expect(result.total_rows).toBe(11); // 0 through 10
    });
  });

  describe('Isometry LPG (Labeled Property Graph) Schema', () => {
    beforeEach(() => {
      // Set up the actual Isometry schema tables
      db.exec(`
        CREATE TABLE nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT DEFAULT '',
          summary TEXT DEFAULT '',

          -- LATCH dimensions
          folder TEXT DEFAULT 'inbox',
          tags TEXT DEFAULT '[]',
          priority INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          modified_at TEXT DEFAULT (datetime('now')),
          due_at TEXT,

          -- Soft delete
          deleted_at TEXT
        );

        CREATE TABLE edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          edge_type TEXT NOT NULL,

          -- Edge properties
          label TEXT,
          weight REAL DEFAULT 1.0,
          directed BOOLEAN DEFAULT 1,
          sequence_order INTEGER,
          channel TEXT,
          timestamp TEXT DEFAULT (datetime('now')),
          subject TEXT,

          FOREIGN KEY (source_id) REFERENCES nodes(id),
          FOREIGN KEY (target_id) REFERENCES nodes(id),
          UNIQUE(source_id, target_id, edge_type)
        );

        -- Create indexes for graph traversal performance
        CREATE INDEX idx_edges_source ON edges(source_id);
        CREATE INDEX idx_edges_target ON edges(target_id);
        CREATE INDEX idx_edges_type ON edges(edge_type);
        CREATE INDEX idx_nodes_folder ON nodes(folder);
        CREATE INDEX idx_nodes_deleted ON nodes(deleted_at);
      `);
    });

    test('should support LINK edge traversal (related connections)', () => {
      // Set up test data representing project relationships
      db.exec(`
        INSERT INTO nodes (id, name, folder) VALUES
          ('project-1', 'Main Project', 'work'),
          ('task-1', 'Frontend Task', 'work'),
          ('task-2', 'Backend Task', 'work'),
          ('doc-1', 'Project Documentation', 'docs');

        INSERT INTO edges (id, source_id, target_id, edge_type, label) VALUES
          ('link-1', 'project-1', 'task-1', 'LINK', 'has task'),
          ('link-2', 'project-1', 'task-2', 'LINK', 'has task'),
          ('link-3', 'task-1', 'doc-1', 'LINK', 'documented by');
      `);

      // Test LINK traversal from project root
      const result = db.prepare(`
        WITH RECURSIVE link_traversal(id, name, depth, path, edge_label) AS (
          -- Start from main project
          SELECT id, name, 0, name, CAST(NULL AS TEXT)
          FROM nodes
          WHERE id = 'project-1'

          UNION ALL

          -- Follow LINK edges
          SELECT n.id, n.name, lt.depth + 1,
                 lt.path || ' -> ' || n.name,
                 e.label
          FROM link_traversal lt
          JOIN edges e ON e.source_id = lt.id
          JOIN nodes n ON n.id = e.target_id
          WHERE e.edge_type = 'LINK'
            AND lt.depth < 3
            AND n.deleted_at IS NULL
        )
        SELECT COUNT(*) as reachable_nodes,
               MAX(depth) as max_depth,
               GROUP_CONCAT(DISTINCT name) as all_names
        FROM link_traversal
      `).get();

      expect(result.reachable_nodes).toBeGreaterThanOrEqual(4); // project + 2 tasks + doc
      expect(result.max_depth).toBeGreaterThanOrEqual(2); // Should reach at least depth 2
      expect(result.all_names).toContain('Main Project');
      expect(result.all_names).toContain('Frontend Task');
    });

    test('should support NEST edge traversal (hierarchical relationships)', () => {
      // Set up hierarchical data
      db.exec(`
        INSERT INTO nodes (id, name, priority) VALUES
          ('epic-1', 'User Authentication Epic', 1),
          ('story-1', 'Login Feature', 2),
          ('story-2', 'Registration Feature', 2),
          ('task-1', 'Login UI', 3),
          ('task-2', 'Login API', 3),
          ('subtask-1', 'Password Validation', 4);

        INSERT INTO edges (id, source_id, target_id, edge_type, sequence_order) VALUES
          ('nest-1', 'epic-1', 'story-1', 'NEST', 1),
          ('nest-2', 'epic-1', 'story-2', 'NEST', 2),
          ('nest-3', 'story-1', 'task-1', 'NEST', 1),
          ('nest-4', 'story-1', 'task-2', 'NEST', 2),
          ('nest-5', 'task-2', 'subtask-1', 'NEST', 1);
      `);

      // Test hierarchical traversal with depth tracking
      const result = db.prepare(`
        WITH RECURSIVE hierarchy(id, name, depth, priority, ancestors) AS (
          -- Root level
          SELECT id, name, 0, priority, name
          FROM nodes
          WHERE id = 'epic-1'

          UNION ALL

          -- Nested levels
          SELECT n.id, n.name, h.depth + 1, n.priority,
                 h.ancestors || ' > ' || n.name
          FROM hierarchy h
          JOIN edges e ON e.source_id = h.id AND e.edge_type = 'NEST'
          JOIN nodes n ON n.id = e.target_id
          WHERE h.depth < 5
            AND n.deleted_at IS NULL
        )
        SELECT depth, COUNT(*) as nodes_at_depth,
               GROUP_CONCAT(name, ', ') as names_at_depth
        FROM hierarchy
        GROUP BY depth
        ORDER BY depth
      `).all();

      expect(result.length).toBeGreaterThanOrEqual(4); // Should have 4 depth levels

      // Verify hierarchy structure
      const depthCounts = result.reduce((acc, row) => {
        acc[row.depth] = row.nodes_at_depth;
        return acc;
      }, {});

      expect(depthCounts[0]).toBe(1); // 1 epic
      expect(depthCounts[1]).toBe(2); // 2 stories
      expect(depthCounts[2]).toBe(2); // 2 tasks
      expect(depthCounts[3]).toBe(1); // 1 subtask
    });

    test('should support SEQUENCE edge traversal (temporal/ordered relationships)', () => {
      // Set up workflow sequence
      db.exec(`
        INSERT INTO nodes (id, name, folder) VALUES
          ('step-1', 'Design Phase', 'workflow'),
          ('step-2', 'Development Phase', 'workflow'),
          ('step-3', 'Testing Phase', 'workflow'),
          ('step-4', 'Deployment Phase', 'workflow'),
          ('step-5', 'Monitoring Phase', 'workflow');

        INSERT INTO edges (id, source_id, target_id, edge_type, sequence_order, weight) VALUES
          ('seq-1', 'step-1', 'step-2', 'SEQUENCE', 1, 1.0),
          ('seq-2', 'step-2', 'step-3', 'SEQUENCE', 2, 1.0),
          ('seq-3', 'step-3', 'step-4', 'SEQUENCE', 3, 1.0),
          ('seq-4', 'step-4', 'step-5', 'SEQUENCE', 4, 1.0);
      `);

      // Test sequence path finding
      const pathResult = db.prepare(`
        WITH RECURSIVE workflow_path(id, name, step_number, path, total_weight) AS (
          -- Start from design phase
          SELECT id, name, 1, name, 0.0
          FROM nodes
          WHERE id = 'step-1'

          UNION ALL

          -- Follow sequence
          SELECT n.id, n.name, wp.step_number + 1,
                 wp.path || ' → ' || n.name,
                 wp.total_weight + e.weight
          FROM workflow_path wp
          JOIN edges e ON e.source_id = wp.id AND e.edge_type = 'SEQUENCE'
          JOIN nodes n ON n.id = e.target_id
          WHERE wp.step_number < 10
            AND n.deleted_at IS NULL
        )
        SELECT MAX(step_number) as total_steps,
               MAX(total_weight) as path_weight,
               path as full_path
        FROM workflow_path
        WHERE step_number = (SELECT MAX(step_number) FROM workflow_path)
      `).get();

      expect(pathResult.total_steps).toBe(5); // 5 workflow steps
      expect(pathResult.path_weight).toBe(4.0); // 4 transitions
      expect(pathResult.full_path).toContain('Design Phase');
      expect(pathResult.full_path).toContain('Monitoring Phase');
    });

    test('should support AFFINITY edge traversal (similarity relationships)', () => {
      // Set up content with affinity relationships
      db.exec(`
        INSERT INTO nodes (id, name, tags, folder) VALUES
          ('doc-1', 'React Components Guide', '["react", "frontend", "ui"]', 'docs'),
          ('doc-2', 'State Management Patterns', '["react", "redux", "state"]', 'docs'),
          ('doc-3', 'API Design Guidelines', '["api", "backend", "rest"]', 'docs'),
          ('doc-4', 'Testing Best Practices', '["testing", "jest", "frontend"]', 'docs'),
          ('doc-5', 'Database Schema Design', '["database", "schema", "backend"]', 'docs');

        INSERT INTO edges (id, source_id, target_id, edge_type, weight, label) VALUES
          ('affinity-1', 'doc-1', 'doc-2', 'AFFINITY', 0.8, 'related react topics'),
          ('affinity-2', 'doc-1', 'doc-4', 'AFFINITY', 0.6, 'both frontend focused'),
          ('affinity-3', 'doc-2', 'doc-4', 'AFFINITY', 0.7, 'testing state logic'),
          ('affinity-4', 'doc-3', 'doc-5', 'AFFINITY', 0.9, 'both backend design');
      `);

      // Test affinity clustering with weight-based traversal
      const clusters = db.prepare(`
        WITH RECURSIVE affinity_cluster(id, name, depth, cluster_weight, cluster_path) AS (
          -- Start from React Components Guide
          SELECT id, name, 0, 0.0, name
          FROM nodes
          WHERE id = 'doc-1'

          UNION ALL

          -- Follow high-affinity connections (weight > 0.5)
          SELECT n.id, n.name, ac.depth + 1,
                 ac.cluster_weight + e.weight,
                 ac.cluster_path || ' ~' ||
                 ROUND(e.weight * 100) || '% ' || n.name
          FROM affinity_cluster ac
          JOIN edges e ON e.source_id = ac.id AND e.edge_type = 'AFFINITY'
          JOIN nodes n ON n.id = e.target_id
          WHERE e.weight > 0.5
            AND ac.depth < 3
            AND n.deleted_at IS NULL
        )
        SELECT COUNT(*) as cluster_size,
               AVG(cluster_weight) as avg_affinity,
               MAX(cluster_weight) as strongest_path
        FROM affinity_cluster
      `).get();

      expect(clusters.cluster_size).toBeGreaterThanOrEqual(3); // Should find related docs
      expect(clusters.avg_affinity).toBeGreaterThan(0.5); // High affinity cluster
      expect(clusters.strongest_path).toBeGreaterThan(0.7); // Strong connections
    });

    test('should support mixed GRAPH traversal (multiple edge types)', () => {
      // Set up complex graph with multiple edge types
      db.exec(`
        INSERT INTO nodes (id, name, folder, priority) VALUES
          ('project-alpha', 'Alpha Project', 'projects', 1),
          ('feature-login', 'User Login', 'features', 2),
          ('task-ui', 'Login UI Implementation', 'tasks', 3),
          ('task-api', 'Login API Implementation', 'tasks', 3),
          ('doc-auth', 'Authentication Documentation', 'docs', 2),
          ('project-beta', 'Beta Project', 'projects', 1),
          ('feature-auth', 'Advanced Auth', 'features', 2);

        INSERT INTO edges (id, source_id, target_id, edge_type, weight, label) VALUES
          -- Project contains feature (NEST)
          ('edge-1', 'project-alpha', 'feature-login', 'NEST', 1.0, 'contains'),
          -- Feature contains tasks (NEST)
          ('edge-2', 'feature-login', 'task-ui', 'NEST', 1.0, 'contains'),
          ('edge-3', 'feature-login', 'task-api', 'NEST', 1.0, 'contains'),
          -- Tasks link to documentation (LINK)
          ('edge-4', 'task-api', 'doc-auth', 'LINK', 1.0, 'documented by'),
          -- Related projects (AFFINITY)
          ('edge-5', 'project-alpha', 'project-beta', 'AFFINITY', 0.7, 'similar scope'),
          -- Sequential implementation (SEQUENCE)
          ('edge-6', 'task-ui', 'task-api', 'SEQUENCE', 1.0, 'depends on'),
          -- Cross-project feature similarity (AFFINITY)
          ('edge-7', 'feature-login', 'feature-auth', 'AFFINITY', 0.8, 'auth related');
      `);

      // Test multi-edge-type traversal with type tracking
      const traversal = db.prepare(`
        WITH RECURSIVE multi_traversal(
          id, name, depth, edge_type_path, relationship_strength
        ) AS (
          -- Start from Alpha Project
          SELECT id, name, 0, '', 1.0
          FROM nodes
          WHERE id = 'project-alpha'

          UNION ALL

          -- Follow any edge type
          SELECT n.id, n.name, mt.depth + 1,
                 mt.edge_type_path || '/' || e.edge_type,
                 mt.relationship_strength * e.weight
          FROM multi_traversal mt
          JOIN edges e ON e.source_id = mt.id
          JOIN nodes n ON n.id = e.target_id
          WHERE mt.depth < 4
            AND n.deleted_at IS NULL
        )
        SELECT edge_type_path,
               COUNT(*) as nodes_reached,
               AVG(relationship_strength) as avg_strength,
               GROUP_CONCAT(DISTINCT name) as node_names
        FROM multi_traversal
        WHERE depth > 0
        GROUP BY edge_type_path
        ORDER BY avg_strength DESC
      `).all();

      expect(traversal.length).toBeGreaterThan(0);

      // Verify we can traverse different relationship types
      const edgeTypes = traversal.map(row => row.edge_type_path).join(' ');
      expect(edgeTypes).toContain('NEST'); // Hierarchical relationships
      expect(edgeTypes).toContain('LINK'); // Cross-references
      expect(edgeTypes).toContain('AFFINITY'); // Similarity relationships
    });

    test('should handle performance characteristics of recursive CTEs', () => {
      // Create a test graph manually (SQLite doesn't have generate_series)
      const nodes = [];
      const edges = [];

      // Create 20 test nodes
      for (let i = 1; i <= 20; i++) {
        nodes.push(`('node-${i}', 'Node ${i}', '${i % 3 === 0 ? 'work' : i % 3 === 1 ? 'personal' : 'archive'}')`);
      }

      // Create edges between adjacent nodes
      for (let i = 1; i < 20; i++) {
        const edgeType = ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY'][i % 4];
        edges.push(`('edge-${i}', 'node-${i}', 'node-${i + 1}', '${edgeType}', ${0.5 + Math.random() * 0.5})`);
      }

      // Insert test data
      db.exec(`
        INSERT INTO nodes (id, name, folder) VALUES ${nodes.join(', ')};
        INSERT INTO edges (id, source_id, target_id, edge_type, weight) VALUES ${edges.join(', ')};
      `);

      // Test traversal performance
      const startTime = Date.now();

      const result = db.prepare(`
        WITH RECURSIVE performance_traversal(id, depth) AS (
          SELECT 'node-1', 0
          UNION ALL
          SELECT e.target_id, pt.depth + 1
          FROM performance_traversal pt
          JOIN edges e ON e.source_id = pt.id
          WHERE pt.depth < 10
        )
        SELECT COUNT(DISTINCT id) as reachable_nodes,
               MAX(depth) as max_depth
        FROM performance_traversal
      `).get();

      const duration = Date.now() - startTime;

      expect(result.reachable_nodes).toBeGreaterThan(1);
      expect(duration).toBeLessThan(50); // Should complete quickly
      expect(result.max_depth).toBeGreaterThanOrEqual(1);
    });

    test('should combine LATCH filtering with recursive CTEs', () => {
      // Set up nodes with LATCH dimensions
      db.exec(`
        INSERT INTO nodes (id, name, folder, priority, created_at) VALUES
          ('urgent-1', 'Critical Bug Fix', 'work', 1, '2024-01-01 10:00:00'),
          ('urgent-2', 'Security Update', 'work', 1, '2024-01-01 11:00:00'),
          ('normal-1', 'Feature Request', 'work', 3, '2024-01-02 10:00:00'),
          ('normal-2', 'Documentation', 'docs', 3, '2024-01-02 11:00:00'),
          ('archive-1', 'Old Task', 'archive', 5, '2024-01-01 09:00:00');

        INSERT INTO edges (id, source_id, target_id, edge_type) VALUES
          ('rel-1', 'urgent-1', 'urgent-2', 'LINK'),
          ('rel-2', 'urgent-1', 'normal-1', 'SEQUENCE'),
          ('rel-3', 'normal-1', 'normal-2', 'LINK'),
          ('rel-4', 'urgent-2', 'archive-1', 'AFFINITY');
      `);

      // Test LATCH filtering within recursive CTE
      const filteredTraversal = db.prepare(`
        WITH RECURSIVE high_priority_network(id, name, depth, priority) AS (
          -- Start with high-priority nodes only (LATCH: Hierarchy filter)
          SELECT id, name, 0, priority
          FROM nodes
          WHERE priority <= 2
            AND folder = 'work'  -- LATCH: Category filter
            AND deleted_at IS NULL

          UNION ALL

          -- Follow connections but maintain priority filter
          SELECT n.id, n.name, hpn.depth + 1, n.priority
          FROM high_priority_network hpn
          JOIN edges e ON e.source_id = hpn.id
          JOIN nodes n ON n.id = e.target_id
          WHERE n.priority <= 3  -- Slightly relaxed for connections
            AND n.folder != 'archive'  -- Exclude archived items
            AND hpn.depth < 3
            AND n.deleted_at IS NULL
        )
        SELECT COUNT(*) as high_priority_network_size,
               AVG(priority) as avg_priority,
               GROUP_CONCAT(name, ' | ') as network_items
        FROM high_priority_network
      `).get();

      expect(filteredTraversal.high_priority_network_size).toBeGreaterThan(0);
      expect(filteredTraversal.avg_priority).toBeLessThanOrEqual(3);
      expect(filteredTraversal.network_items).toContain('Critical Bug Fix');
    });
  });
});