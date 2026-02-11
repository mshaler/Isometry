/**
 * Test Fixtures for LPG Data
 *
 * Comprehensive test data fixtures for the Labeled Property Graph model
 * supporting TDD workflows for SuperGrid and PAFV projection testing.
 */

import type { Database } from 'sql.js-fts5';

// Simple interfaces for test data
interface TestLPGNode {
  id: string;
  name: string;
  content?: string;
  summary?: string;
  folder?: string;
  tags?: string;
  status?: string;
  priority?: number;
  importance?: number;
  grid_x?: number;
  grid_y?: number;
  created_at?: string;
  modified_at?: string;
  completed_at?: string;
  due_at?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
}

interface TestLPGEdge {
  id: string;
  edge_type: string;
  source_id: string;
  target_id: string;
  label?: string;
  weight?: number;
  directed?: number;
  sequence_order?: number;
  channel?: string;
  subject?: string;
  timestamp?: string;
}

interface TestLPGFacet {
  id: string;
  name: string;
  facet_type: string;
  axis: string;
  source_column: string;
  options?: string;
  icon?: string;
  color?: string;
  enabled?: boolean;
  sort_order?: number;
}

interface TestNotebookCard {
  id: string;
  node_id: string;
  card_type: string;
  markdown_content?: string;
  properties?: string;
}

/**
 * Test Node Fixtures
 */
export const TEST_NODES: Partial<TestLPGNode>[] = [
  // SuperGrid projection test data with varied LATCH attributes
  {
    id: 'fixture-node-1',
    name: 'SuperGrid Feature Planning',
    content: 'Planning and architecture for the SuperGrid implementation with PAFV projection system.',
    summary: 'SuperGrid planning with PAFV',
    folder: 'work',
    tags: '["supergrid", "pafv", "architecture"]',
    status: 'in_progress',
    priority: 5,
    importance: 5,
    grid_x: 100,
    grid_y: 50,
    created_at: '2024-01-15 09:00:00',
    modified_at: '2024-01-15 10:30:00',
    location_name: 'San Francisco Office',
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    id: 'fixture-node-2',
    name: 'Janus Density Controls',
    content: 'Implementation of the four-level Janus model: Value zoom, Extent pan, View, Region.',
    summary: 'Janus density model implementation',
    folder: 'work',
    tags: '["supergrid", "janus", "density", "zoom", "pan"]',
    status: 'active',
    priority: 4,
    importance: 4,
    grid_x: 250,
    grid_y: 50,
    created_at: '2024-01-16 11:00:00',
    modified_at: '2024-01-16 15:45:00',
    location_name: 'Home Office',
    latitude: 37.8049,
    longitude: -122.4094,
  },
  {
    id: 'fixture-node-3',
    name: 'LATCH Filter Integration',
    content: 'Integration of Location, Alphabet, Time, Category, Hierarchy filtering with SQL.js.',
    summary: 'LATCH filtering with sql.js',
    folder: 'work',
    tags: '["latch", "filters", "sqljs"]',
    status: 'completed',
    priority: 3,
    importance: 3,
    grid_x: 400,
    grid_y: 50,
    created_at: '2024-01-10 14:00:00',
    modified_at: '2024-01-12 16:20:00',
    completed_at: '2024-01-12 16:20:00',
  },
  {
    id: 'fixture-node-4',
    name: 'Personal Learning Notes',
    content: 'Notes on D3.js data binding patterns and sql.js optimization techniques.',
    summary: 'Learning D3 and sql.js patterns',
    folder: 'personal',
    tags: '["learning", "d3js", "sqljs"]',
    status: 'active',
    priority: 2,
    importance: 2,
    grid_x: 100,
    grid_y: 150,
    created_at: '2024-01-18 20:00:00',
    modified_at: '2024-01-18 21:30:00',
    due_at: '2024-01-25 23:59:00',
  },
  {
    id: 'fixture-node-5',
    name: 'Graph Traversal Algorithms',
    content: 'Research on recursive CTE patterns for efficient graph traversal in SQLite.',
    summary: 'Graph traversal with recursive CTEs',
    folder: 'research',
    tags: '["graph", "cte", "algorithms", "sqlite"]',
    status: 'active',
    priority: 4,
    importance: 5,
    grid_x: 250,
    grid_y: 150,
    created_at: '2024-01-17 13:00:00',
    modified_at: '2024-01-17 17:45:00',
  },
  {
    id: 'fixture-node-6',
    name: 'Weekend Project Ideas',
    content: 'Collection of side project ideas for exploring new technologies.',
    summary: 'Side project brainstorming',
    folder: 'personal',
    tags: '["projects", "ideas", "weekend"]',
    status: 'active',
    priority: 1,
    importance: 1,
    grid_x: 400,
    grid_y: 150,
    created_at: '2024-01-19 19:00:00',
    modified_at: '2024-01-19 19:30:00',
  },
  {
    id: 'fixture-node-7',
    name: 'TDD Testing Strategy',
    content: 'Comprehensive testing strategy for Phase 2 SuperGrid implementation using Vitest.',
    summary: 'TDD for SuperGrid development',
    folder: 'work',
    tags: '["tdd", "testing", "vitest", "supergrid"]',
    status: 'in_progress',
    priority: 5,
    importance: 4,
    grid_x: 100,
    grid_y: 250,
    created_at: '2024-01-20 08:00:00',
    modified_at: '2024-01-20 12:15:00',
  },
  {
    id: 'fixture-node-8',
    name: 'Architecture Documentation',
    content: 'Documentation of the bridge elimination architecture and sql.js integration.',
    summary: 'Architecture docs for v4',
    folder: 'work',
    tags: '["documentation", "architecture", "sqljs"]',
    status: 'blocked',
    priority: 3,
    importance: 3,
    grid_x: 250,
    grid_y: 250,
    created_at: '2024-01-14 16:00:00',
    modified_at: '2024-01-16 09:30:00',
  },
];

/**
 * Test Edge Fixtures
 */
export const TEST_EDGES: Partial<TestLPGEdge>[] = [
  // LINK relationships
  {
    id: 'fixture-edge-1',
    edge_type: 'LINK',
    source_id: 'fixture-node-1',
    target_id: 'fixture-node-2',
    label: 'depends_on',
    weight: 0.8,
    directed: 1,
  },
  {
    id: 'fixture-edge-2',
    edge_type: 'LINK',
    source_id: 'fixture-node-1',
    target_id: 'fixture-node-3',
    label: 'builds_on',
    weight: 0.9,
    directed: 1,
  },
  // SEQUENCE relationships
  {
    id: 'fixture-edge-3',
    edge_type: 'SEQUENCE',
    source_id: 'fixture-node-3',
    target_id: 'fixture-node-1',
    label: 'precedes',
    weight: 1.0,
    directed: 1,
    sequence_order: 1,
  },
  {
    id: 'fixture-edge-4',
    edge_type: 'SEQUENCE',
    source_id: 'fixture-node-1',
    target_id: 'fixture-node-7',
    label: 'enables',
    weight: 1.0,
    directed: 1,
    sequence_order: 2,
  },
  // NEST relationships
  {
    id: 'fixture-edge-5',
    edge_type: 'NEST',
    source_id: 'fixture-node-1',
    target_id: 'fixture-node-5',
    label: 'contains',
    weight: 1.0,
    directed: 1,
  },
  {
    id: 'fixture-edge-6',
    edge_type: 'NEST',
    source_id: 'fixture-node-1',
    target_id: 'fixture-node-8',
    label: 'includes',
    weight: 1.0,
    directed: 1,
  },
  // AFFINITY relationships (bidirectional)
  {
    id: 'fixture-edge-7',
    edge_type: 'AFFINITY',
    source_id: 'fixture-node-4',
    target_id: 'fixture-node-5',
    label: 'related_learning',
    weight: 0.6,
    directed: 0,
  },
  {
    id: 'fixture-edge-8',
    edge_type: 'AFFINITY',
    source_id: 'fixture-node-4',
    target_id: 'fixture-node-6',
    label: 'similar_context',
    weight: 0.4,
    directed: 0,
  },
];

/**
 * Test Facet Fixtures
 */
export const TEST_FACETS: Partial<TestLPGFacet>[] = [
  {
    id: 'test-facet-folder',
    name: 'Folder',
    facet_type: 'select',
    axis: 'C',
    source_column: 'folder',
    options: '["work", "personal", "research", "projects"]',
    icon: 'folder',
    color: '#4F46E5',
    enabled: true,
    sort_order: 1,
  },
  {
    id: 'test-facet-status',
    name: 'Status',
    facet_type: 'select',
    axis: 'C',
    source_column: 'status',
    options: '["active", "in_progress", "completed", "blocked", "cancelled"]',
    icon: 'status',
    color: '#10B981',
    enabled: true,
    sort_order: 2,
  },
  {
    id: 'test-facet-priority',
    name: 'Priority',
    facet_type: 'range',
    axis: 'H',
    source_column: 'priority',
    options: '{"min": 1, "max": 5, "step": 1}',
    icon: 'priority',
    color: '#F59E0B',
    enabled: true,
    sort_order: 3,
  },
  {
    id: 'test-facet-created',
    name: 'Created Date',
    facet_type: 'date_range',
    axis: 'T',
    source_column: 'created_at',
    options: '{"format": "YYYY-MM-DD"}',
    icon: 'calendar',
    color: '#8B5CF6',
    enabled: true,
    sort_order: 4,
  },
  {
    id: 'test-facet-location',
    name: 'Location',
    facet_type: 'location',
    axis: 'L',
    source_column: 'location_name',
    options: '{"map_enabled": true}',
    icon: 'map-pin',
    color: '#EF4444',
    enabled: true,
    sort_order: 5,
  },
];

/**
 * Test Notebook Card Fixtures
 */
export const TEST_NOTEBOOK_CARDS: Partial<TestNotebookCard>[] = [
  {
    id: 'fixture-nb-1',
    node_id: 'fixture-node-1',
    card_type: 'capture',
    markdown_content: `# SuperGrid Feature Planning

This card captures the initial planning and architecture thoughts for the SuperGrid implementation.

## Key Features

- PAFV projection system
- Nested dimensional headers
- Janus density controls
- Direct sql.js → D3.js rendering

## Next Steps

- [ ] Complete architecture documentation
- [ ] Set up TDD workflow
- [ ] Implement basic grid structure`,
    properties: '{"color": "blue", "pinned": true, "priority": "high"}',
  },
  {
    id: 'fixture-nb-2',
    node_id: 'fixture-node-7',
    card_type: 'shell',
    markdown_content: `# TDD Testing Commands

\`\`\`bash
# Run specific test suite
npm run test -- supergrid

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test -- --watch
\`\`\`

\`\`\`typescript
// Example test pattern
describe('SuperGrid PAFV Projection', () => {
  test('should map LATCH dimensions to PAFV axes', () => {
    // Implementation
  });
});
\`\`\``,
    properties: '{"language": "bash", "executable": true, "template": "development"}',
  },
  {
    id: 'fixture-nb-3',
    node_id: 'fixture-node-5',
    card_type: 'preview',
    markdown_content: `## Graph Traversal Results

Current research on recursive CTE patterns shows significant performance improvements:

- **Depth-first traversal**: 95% faster than JavaScript iteration
- **Breadth-first traversal**: 87% faster with proper indexing
- **Path finding**: Optimal for graphs < 1000 nodes

### Performance Metrics

| Algorithm | SQLite CTE | JavaScript | Improvement |
|-----------|------------|------------|-------------|
| DFS       | 2.3ms      | 45.7ms     | 95.0%       |
| BFS       | 3.1ms      | 23.8ms     | 87.0%       |
| Paths     | 5.2ms      | 67.1ms     | 92.3%       |`,
    properties: '{"chart_type": "performance", "data_source": "benchmark_results"}',
  },
];

/**
 * Load fixtures into a test database
 */
export async function loadTestFixtures(db: Database, options: {
  nodes?: boolean;
  edges?: boolean;
  facets?: boolean;
  notebookCards?: boolean;
} = {}): Promise<void> {
  const {
    nodes = true,
    edges = true,
    facets = true,
    notebookCards = true,
  } = options;

  try {
    // Load nodes
    if (nodes) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nodes (
          id, name, content, summary, folder, tags, status, priority, importance,
          grid_x, grid_y, created_at, modified_at, completed_at, due_at,
          location_name, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const node of TEST_NODES) {
        stmt.run([
          node.id || '',
          node.name || '',
          node.content || '',
          node.summary || '',
          node.folder || '',
          node.tags || '',
          node.status || '',
          node.priority || 0,
          node.importance || 0,
          node.grid_x || 0,
          node.grid_y || 0,
          node.created_at || new Date().toISOString(),
          node.modified_at || new Date().toISOString(),
          node.completed_at || null,
          node.due_at || null,
          node.location_name || null,
          node.latitude || null,
          node.longitude || null,
        ]);
      }
      stmt.free();
    }

    // Load edges
    if (edges) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO edges (
          id, edge_type, source_id, target_id, label, weight, directed, sequence_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const edge of TEST_EDGES) {
        stmt.run([
          edge.id || '',
          edge.edge_type || 'LINK',
          edge.source_id || '',
          edge.target_id || '',
          edge.label || '',
          edge.weight || 1,
          edge.directed ? 1 : 0,
          edge.sequence_order || null,
        ]);
      }
      stmt.free();
    }

    // Load facets
    if (facets) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO facets (
          id, name, facet_type, axis, source_column, options, icon, color, enabled, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const facet of TEST_FACETS) {
        stmt.run([
          facet.id || '',
          facet.name || '',
          facet.facet_type || 'text',
          facet.axis || 'C',
          facet.source_column || '',
          facet.options || null,
          facet.icon || null,
          facet.color || null,
          facet.enabled ? 1 : 0,
          facet.sort_order || 0,
        ]);
      }
      stmt.free();
    }

    // Load notebook cards
    if (notebookCards) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO notebook_cards (
          id, node_id, card_type, markdown_content, properties
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const card of TEST_NOTEBOOK_CARDS) {
        stmt.run([
          card.id || '',
          card.node_id || '',
          card.card_type || 'capture',
          card.markdown_content || '',
          card.properties || '{}',
        ]);
      }
      stmt.free();
    }

  } catch (error) {
    console.error('[Test] Error loading fixtures:', error);
    throw error;
  }
}

/**
 * Create specific test scenarios
 */
export const TEST_SCENARIOS = {
  // SuperGrid projection scenarios
  SUPERGRID_BASIC: {
    description: 'Basic SuperGrid with work and personal folders',
    nodes: TEST_NODES.filter(n => n.folder && ['work', 'personal'].includes(n.folder)),
    edges: TEST_EDGES.filter(e =>
      TEST_NODES.some(n => n.id === e.source_id && n.folder && ['work', 'personal'].includes(n.folder))
    ),
  },

  // LATCH filtering scenarios
  LATCH_TIME_RANGE: {
    description: 'Time-based filtering for recent items',
    nodes: TEST_NODES.filter(n =>
      n.created_at && new Date(n.created_at) >= new Date('2024-01-15')
    ),
    edges: [],
  },

  // GRAPH traversal scenarios
  GRAPH_COMPLEX: {
    description: 'Complex graph with all edge types',
    nodes: TEST_NODES.slice(0, 5), // First 5 nodes
    edges: TEST_EDGES, // All edges
  },

  // Performance testing scenarios
  PERFORMANCE_LARGE: {
    description: 'Large dataset for performance testing',
    generateNodes: (count: number) => {
      const nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          id: `perf-node-${i}`,
          name: `Performance Test Node ${i}`,
          content: `Generated content for performance testing node ${i}`,
          folder: ['work', 'personal', 'research'][i % 3],
          status: ['active', 'completed', 'in_progress'][i % 3],
          priority: (i % 5) + 1,
          grid_x: (i % 10) * 100,
          grid_y: Math.floor(i / 10) * 100,
          created_at: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
        });
      }
      return nodes;
    },
  },
};

/**
 * Load a specific test scenario into database
 */
export async function loadTestScenario(
  db: Database,
  scenario: keyof typeof TEST_SCENARIOS,
  options?: unknown
): Promise<void> {
  const scenarioData = TEST_SCENARIOS[scenario];

  if ('generateNodes' in scenarioData) {
    // Handle generated scenarios like PERFORMANCE_LARGE
    const count = (options as { nodeCount?: number } | undefined)?.nodeCount || 100;
    const nodes = scenarioData.generateNodes(count);

    const stmt = db.prepare(`
      INSERT INTO nodes (id, name, content, folder, status, priority, grid_x, grid_y, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const node of nodes) {
      stmt.run([
        node.id, node.name, node.content, node.folder, node.status,
        node.priority, node.grid_x, node.grid_y, node.created_at
      ]);
    }
    stmt.free();
  } else {
    // Handle predefined scenarios
    await loadTestFixtures(db, {
      nodes: false,
      edges: false,
      facets: true,
      notebookCards: false,
    });

    // Load scenario-specific nodes and edges
    if (scenarioData.nodes?.length) {
      const stmt = db.prepare(`
        INSERT INTO nodes (id, name, content, summary, folder, tags, status, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const node of scenarioData.nodes) {
        stmt.run([
          node.id || '', node.name || '', node.content || '', node.summary || '', node.folder || '',
          node.tags || '', node.status || '', node.priority || 0, node.created_at || new Date().toISOString()
        ]);
      }
      stmt.free();
    }

    if (scenarioData.edges?.length) {
      const stmt = db.prepare(`
        INSERT INTO edges (id, edge_type, source_id, target_id, label, weight, directed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const edge of scenarioData.edges) {
        stmt.run([
          edge.id || '', edge.edge_type || 'LINK', edge.source_id || '', edge.target_id || '',
          edge.label || '', edge.weight || 1, edge.directed ? 1 : 0
        ]);
      }
      stmt.free();
    }
  }
}