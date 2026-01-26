/**
 * Workflow Scenarios for Migration Testing
 *
 * Reusable test data and scenarios for comprehensive migration validation
 * Supports various complexity levels and edge cases
 */

export interface TestScenario {
  name: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  data: TestDataSet;
  expectedBehavior: ExpectedBehavior;
}

export interface TestDataSet {
  nodes: TestNode[];
  notebookCards: TestNotebookCard[];
  edges: TestEdge[];
  metadata: TestMetadata;
}

export interface TestNode {
  id: string;
  name: string;
  content: string;
  nodeType: string;
  tags?: string[];
  folder?: string;
  priority?: number;
  x?: number;
  y?: number;
  source?: string;
  sourceId?: string;
}

export interface TestNotebookCard {
  id?: string;
  title: string;
  markdownContent: string;
  properties: Record<string, string>;
  tags: string[];
  folder?: string;
}

export interface TestEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  properties?: Record<string, string>;
}

export interface TestMetadata {
  totalNodes: number;
  totalCards: number;
  totalEdges: number;
  dataSize: number; // in bytes
  complexity: string;
}

export interface ExpectedBehavior {
  migrationTime: number; // max milliseconds
  dataIntegrityCheck: boolean;
  performanceTargets: {
    throughput: number; // ops/sec
    latency: number; // ms
  };
  crossPlatformSupport: boolean;
  rollbackSupported: boolean;
}

/**
 * Simple test scenario - basic functionality validation
 */
export const SIMPLE_SCENARIO: TestScenario = {
  name: 'Simple Basic Operations',
  description: 'Basic CRUD operations with minimal data set',
  complexity: 'simple',
  data: {
    nodes: [
      {
        id: 'node-1',
        name: 'Welcome Note',
        content: 'Welcome to Isometry! This is your first note.',
        nodeType: 'note',
        tags: ['welcome', 'getting-started'],
        folder: 'inbox',
        priority: 1,
        x: 100,
        y: 100,
        source: 'manual'
      },
      {
        id: 'node-2',
        name: 'Project Ideas',
        content: 'A collection of project ideas:\n\n1. Mobile app\n2. Web platform\n3. Desktop tool',
        nodeType: 'note',
        tags: ['projects', 'ideas'],
        folder: 'projects',
        priority: 2,
        x: 200,
        y: 150,
        source: 'manual'
      },
      {
        id: 'node-3',
        name: 'Meeting Notes',
        content: 'Team meeting notes from 2026-01-26',
        nodeType: 'meeting',
        tags: ['meetings', 'team'],
        folder: 'meetings',
        priority: 3,
        x: 150,
        y: 200,
        source: 'import'
      }
    ],
    notebookCards: [
      {
        id: 'card-1',
        title: 'Daily Journal - Jan 26',
        markdownContent: '# Daily Journal\n\n## Today\'s Goals\n- Complete migration testing\n- Review performance metrics\n\n## Progress\n- ✅ Started migration tests\n- 🔄 Working on validation\n\n## Notes\nThe migration is proceeding smoothly.',
        properties: {
          category: 'journal',
          date: '2026-01-26',
          mood: 'productive'
        },
        tags: ['journal', 'daily', 'migration'],
        folder: 'personal'
      },
      {
        id: 'card-2',
        title: 'Migration Test Plan',
        markdownContent: '# Migration Test Plan\n\n## Objectives\n1. Validate data integrity\n2. Ensure performance targets\n3. Test rollback procedures\n\n## Test Cases\n- Basic CRUD operations\n- Real-time sync\n- Cross-platform compatibility\n\n## Success Criteria\n- 100% data preservation\n- Performance within targets\n- Successful rollback',
        properties: {
          category: 'technical',
          status: 'in-progress',
          priority: 'high'
        },
        tags: ['migration', 'testing', 'technical'],
        folder: 'projects'
      }
    ],
    edges: [
      {
        id: 'edge-1',
        sourceId: 'node-1',
        targetId: 'node-2',
        edgeType: 'references',
        properties: {
          context: 'project-planning'
        }
      },
      {
        id: 'edge-2',
        sourceId: 'card-1',
        targetId: 'node-1',
        edgeType: 'mentions',
        properties: {
          context: 'daily-review'
        }
      }
    ],
    metadata: {
      totalNodes: 3,
      totalCards: 2,
      totalEdges: 2,
      dataSize: 2500, // approximate bytes
      complexity: 'simple'
    }
  },
  expectedBehavior: {
    migrationTime: 1000, // 1 second max
    dataIntegrityCheck: true,
    performanceTargets: {
      throughput: 50, // 50 ops/sec minimum
      latency: 100 // 100ms max
    },
    crossPlatformSupport: true,
    rollbackSupported: true
  }
};

/**
 * Medium complexity scenario - realistic usage patterns
 */
export const MEDIUM_SCENARIO: TestScenario = {
  name: 'Medium Realistic Usage',
  description: 'Realistic usage with moderate data volume and relationships',
  complexity: 'medium',
  data: generateMediumDataSet(),
  expectedBehavior: {
    migrationTime: 5000, // 5 seconds max
    dataIntegrityCheck: true,
    performanceTargets: {
      throughput: 75, // 75 ops/sec minimum
      latency: 75 // 75ms max
    },
    crossPlatformSupport: true,
    rollbackSupported: true
  }
};

/**
 * Complex scenario - stress testing with large dataset
 */
export const COMPLEX_SCENARIO: TestScenario = {
  name: 'Complex Stress Test',
  description: 'Large dataset with complex relationships and edge cases',
  complexity: 'complex',
  data: generateComplexDataSet(),
  expectedBehavior: {
    migrationTime: 15000, // 15 seconds max
    dataIntegrityCheck: true,
    performanceTargets: {
      throughput: 100, // 100 ops/sec minimum
      latency: 50 // 50ms max
    },
    crossPlatformSupport: true,
    rollbackSupported: true
  }
};

/**
 * Concurrent operations scenario
 */
export const CONCURRENT_SCENARIO: TestScenario = {
  name: 'Concurrent Operations',
  description: 'Multiple simultaneous operations testing race conditions',
  complexity: 'complex',
  data: generateConcurrentDataSet(),
  expectedBehavior: {
    migrationTime: 8000, // 8 seconds max
    dataIntegrityCheck: true,
    performanceTargets: {
      throughput: 80, // 80 ops/sec minimum
      latency: 60 // 60ms max
    },
    crossPlatformSupport: true,
    rollbackSupported: true
  }
};

/**
 * Error condition scenario
 */
export const ERROR_SCENARIO: TestScenario = {
  name: 'Error Conditions',
  description: 'Testing error handling and recovery',
  complexity: 'medium',
  data: generateErrorConditionDataSet(),
  expectedBehavior: {
    migrationTime: 3000, // 3 seconds max (with retries)
    dataIntegrityCheck: true,
    performanceTargets: {
      throughput: 30, // 30 ops/sec minimum (degraded)
      latency: 150 // 150ms max (with error handling)
    },
    crossPlatformSupport: true,
    rollbackSupported: true
  }
};

/**
 * All test scenarios available
 */
export const ALL_SCENARIOS: TestScenario[] = [
  SIMPLE_SCENARIO,
  MEDIUM_SCENARIO,
  COMPLEX_SCENARIO,
  CONCURRENT_SCENARIO,
  ERROR_SCENARIO
];

/**
 * Get scenarios by complexity level
 */
export function getScenariosByComplexity(complexity: 'simple' | 'medium' | 'complex'): TestScenario[] {
  return ALL_SCENARIOS.filter(scenario => scenario.complexity === complexity);
}

/**
 * Get scenario by name
 */
export function getScenarioByName(name: string): TestScenario | undefined {
  return ALL_SCENARIOS.find(scenario => scenario.name === name);
}

// =============================================================================
// Data Set Generators
// =============================================================================

function generateMediumDataSet(): TestDataSet {
  const nodes: TestNode[] = [];
  const cards: TestNotebookCard[] = [];
  const edges: TestEdge[] = [];

  // Generate 50 nodes across different categories
  const categories = ['notes', 'projects', 'meetings', 'ideas', 'research'];
  for (let i = 0; i < 50; i++) {
    const category = categories[i % categories.length];
    nodes.push({
      id: `node-medium-${i}`,
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} Item ${i + 1}`,
      content: generateRandomContent(category, 200 + Math.random() * 500),
      nodeType: category.slice(0, -1), // Remove 's' to make singular
      tags: [category, `item-${i}`, Math.random() > 0.5 ? 'important' : 'normal'],
      folder: category,
      priority: Math.floor(Math.random() * 5) + 1,
      x: Math.random() * 800,
      y: Math.random() * 600,
      source: Math.random() > 0.5 ? 'manual' : 'import'
    });
  }

  // Generate 20 notebook cards
  for (let i = 0; i < 20; i++) {
    cards.push({
      id: `card-medium-${i}`,
      title: `Notebook Entry ${i + 1}`,
      markdownContent: generateMarkdownContent(500 + Math.random() * 1000),
      properties: {
        category: categories[i % categories.length],
        priority: Math.random() > 0.5 ? 'high' : 'normal',
        status: ['draft', 'review', 'complete'][Math.floor(Math.random() * 3)]
      },
      tags: generateRandomTags(),
      folder: categories[i % categories.length]
    });
  }

  // Generate 30 edges creating realistic relationships
  for (let i = 0; i < 30; i++) {
    const sourceIndex = Math.floor(Math.random() * nodes.length);
    const targetIndex = Math.floor(Math.random() * nodes.length);
    if (sourceIndex !== targetIndex) {
      edges.push({
        id: `edge-medium-${i}`,
        sourceId: nodes[sourceIndex].id,
        targetId: nodes[targetIndex].id,
        edgeType: ['references', 'similar-to', 'depends-on', 'part-of'][Math.floor(Math.random() * 4)],
        properties: {
          strength: Math.random().toFixed(2),
          context: 'auto-generated'
        }
      });
    }
  }

  return {
    nodes,
    notebookCards: cards,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalCards: cards.length,
      totalEdges: edges.length,
      dataSize: estimateDataSize(nodes, cards, edges),
      complexity: 'medium'
    }
  };
}

function generateComplexDataSet(): TestDataSet {
  const nodes: TestNode[] = [];
  const cards: TestNotebookCard[] = [];
  const edges: TestEdge[] = [];

  // Generate 500 nodes - stress test
  const categories = ['notes', 'projects', 'meetings', 'ideas', 'research', 'documents', 'tasks', 'contacts'];
  for (let i = 0; i < 500; i++) {
    const category = categories[i % categories.length];
    nodes.push({
      id: `node-complex-${i}`,
      name: `Complex ${category.charAt(0).toUpperCase() + category.slice(1)} ${i + 1}`,
      content: generateRandomContent(category, 500 + Math.random() * 2000), // Larger content
      nodeType: category.slice(0, -1),
      tags: generateRandomTags(3 + Math.floor(Math.random() * 3)), // More tags
      folder: `${category}/${Math.floor(i / 50) + 1}`, // Nested folders
      priority: Math.floor(Math.random() * 10) + 1,
      x: Math.random() * 2000,
      y: Math.random() * 1500,
      source: ['manual', 'import', 'sync', 'api'][Math.floor(Math.random() * 4)],
      sourceId: Math.random() > 0.7 ? `external-${i}` : undefined
    });
  }

  // Generate 200 notebook cards with complex content
  for (let i = 0; i < 200; i++) {
    cards.push({
      id: `card-complex-${i}`,
      title: `Complex Notebook ${i + 1}`,
      markdownContent: generateComplexMarkdownContent(),
      properties: {
        category: categories[i % categories.length],
        priority: ['low', 'normal', 'high', 'critical'][Math.floor(Math.random() * 4)],
        status: ['draft', 'review', 'complete', 'archived'][Math.floor(Math.random() * 4)],
        author: `user-${Math.floor(i / 20)}`,
        version: Math.floor(Math.random() * 10) + 1,
        lastModified: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30).toISOString()
      },
      tags: generateRandomTags(2 + Math.floor(Math.random() * 5)),
      folder: `${categories[i % categories.length]}/${Math.floor(i / 25) + 1}`
    });
  }

  // Generate 800 edges for complex relationships
  for (let i = 0; i < 800; i++) {
    const sourceIndex = Math.floor(Math.random() * nodes.length);
    const targetIndex = Math.floor(Math.random() * nodes.length);
    if (sourceIndex !== targetIndex) {
      edges.push({
        id: `edge-complex-${i}`,
        sourceId: nodes[sourceIndex].id,
        targetId: nodes[targetIndex].id,
        edgeType: ['references', 'similar-to', 'depends-on', 'part-of', 'blocks', 'implements'][Math.floor(Math.random() * 6)],
        properties: {
          strength: Math.random().toFixed(3),
          weight: Math.floor(Math.random() * 100),
          context: 'complex-generation',
          bidirectional: Math.random() > 0.5 ? 'true' : 'false'
        }
      });
    }
  }

  return {
    nodes,
    notebookCards: cards,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalCards: cards.length,
      totalEdges: edges.length,
      dataSize: estimateDataSize(nodes, cards, edges),
      complexity: 'complex'
    }
  };
}

function generateConcurrentDataSet(): TestDataSet {
  // Smaller dataset designed for concurrent operations testing
  const nodes: TestNode[] = [];
  const cards: TestNotebookCard[] = [];
  const edges: TestEdge[] = [];

  // Generate 100 nodes with predictable IDs for concurrent testing
  for (let i = 0; i < 100; i++) {
    nodes.push({
      id: `concurrent-node-${String(i).padStart(3, '0')}`,
      name: `Concurrent Node ${i + 1}`,
      content: `Content for concurrent testing node ${i + 1}`,
      nodeType: 'test',
      tags: ['concurrent', 'test', `batch-${Math.floor(i / 10)}`],
      folder: `concurrent/batch-${Math.floor(i / 10)}`,
      priority: i % 5 + 1,
      x: (i % 10) * 100,
      y: Math.floor(i / 10) * 100,
      source: 'concurrent-test'
    });
  }

  // Generate 50 cards for concurrent operations
  for (let i = 0; i < 50; i++) {
    cards.push({
      id: `concurrent-card-${String(i).padStart(3, '0')}`,
      title: `Concurrent Card ${i + 1}`,
      markdownContent: `# Concurrent Card ${i + 1}\n\nTesting concurrent operations.`,
      properties: {
        category: 'concurrent-test',
        batchId: Math.floor(i / 10).toString()
      },
      tags: ['concurrent', 'test'],
      folder: `concurrent/cards`
    });
  }

  // Generate edges for predictable relationship testing
  for (let i = 0; i < 50; i++) {
    if (i + 1 < nodes.length) {
      edges.push({
        id: `concurrent-edge-${String(i).padStart(3, '0')}`,
        sourceId: nodes[i].id,
        targetId: nodes[i + 1].id,
        edgeType: 'sequence',
        properties: {
          order: i.toString()
        }
      });
    }
  }

  return {
    nodes,
    notebookCards: cards,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalCards: cards.length,
      totalEdges: edges.length,
      dataSize: estimateDataSize(nodes, cards, edges),
      complexity: 'concurrent'
    }
  };
}

function generateErrorConditionDataSet(): TestDataSet {
  const nodes: TestNode[] = [];
  const cards: TestNotebookCard[] = [];
  const edges: TestEdge[] = [];

  // Generate nodes with various error conditions for testing
  const errorConditions = [
    'missing-required-field',
    'invalid-characters',
    'oversized-content',
    'circular-reference',
    'invalid-type',
    'encoding-issues'
  ];

  for (let i = 0; i < 30; i++) {
    const condition = errorConditions[i % errorConditions.length];

    nodes.push({
      id: `error-node-${i}`,
      name: `Error Test ${condition} ${i + 1}`,
      content: generateErrorContent(condition),
      nodeType: condition.includes('type') ? 'invalid-type' : 'test',
      tags: ['error-test', condition],
      folder: 'error-conditions',
      priority: 1,
      x: Math.random() * 400,
      y: Math.random() * 300,
      source: 'error-test'
    });
  }

  // Generate cards with error conditions
  for (let i = 0; i < 15; i++) {
    const condition = errorConditions[i % errorConditions.length];

    cards.push({
      id: `error-card-${i}`,
      title: `Error Card ${condition}`,
      markdownContent: generateErrorMarkdown(condition),
      properties: {
        errorType: condition,
        testCase: i.toString()
      },
      tags: ['error-test'],
      folder: 'error-conditions'
    });
  }

  // Generate edges with potential circular references
  for (let i = 0; i < 20; i++) {
    edges.push({
      id: `error-edge-${i}`,
      sourceId: nodes[i % nodes.length].id,
      targetId: nodes[(i + 1) % nodes.length].id, // Potential circular reference
      edgeType: 'error-test',
      properties: {
        errorCondition: 'potential-circular'
      }
    });
  }

  return {
    nodes,
    notebookCards: cards,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalCards: cards.length,
      totalEdges: edges.length,
      dataSize: estimateDataSize(nodes, cards, edges),
      complexity: 'error-conditions'
    }
  };
}

// =============================================================================
// Content Generators
// =============================================================================

function generateRandomContent(category: string, targetLength: number): string {
  const templates = {
    notes: 'Personal note about {{topic}}. Contains thoughts and observations.',
    projects: 'Project documentation for {{topic}}. Includes requirements and specifications.',
    meetings: 'Meeting notes for {{topic}}. Attendees discussed key points.',
    ideas: 'Creative idea about {{topic}}. Potential for future development.',
    research: 'Research findings on {{topic}}. Data analysis and conclusions.'
  };

  const topics = [
    'data migration', 'performance optimization', 'user experience', 'system architecture',
    'testing strategies', 'deployment processes', 'security measures', 'scalability'
  ];

  const template = templates[category as keyof typeof templates] || templates.notes;
  const topic = topics[Math.floor(Math.random() * topics.length)];
  let content = template.replace('{{topic}}', topic);

  // Pad content to reach target length
  while (content.length < targetLength) {
    content += ` Additional details about ${topic} and related concepts.`;
  }

  return content.substring(0, targetLength);
}

function generateMarkdownContent(targetLength: number): string {
  const sections = [
    '# Main Heading\n\nIntroduction paragraph.',
    '## Section 1\n\nContent for section 1.',
    '### Subsection\n\n- List item 1\n- List item 2\n- List item 3',
    '## Section 2\n\n```javascript\nconst example = "code";\n```',
    '### Notes\n\n> Blockquote with important information.',
    '## Conclusion\n\nSummary of key points.'
  ];

  let content = '';
  while (content.length < targetLength) {
    content += sections[Math.floor(Math.random() * sections.length)] + '\n\n';
  }

  return content.substring(0, targetLength);
}

function generateComplexMarkdownContent(): string {
  return `# Complex Document

## Overview
This document contains complex markdown with various elements.

### Code Blocks
\`\`\`typescript
interface ComplexType {
  id: string;
  data: Record<string, unknown>;
  nested: {
    values: number[];
    metadata: Map<string, string>;
  };
}
\`\`\`

### Tables
| Feature | Status | Priority |
|---------|--------|----------|
| Migration | ✅ Complete | High |
| Testing | 🔄 In Progress | High |
| Documentation | 📝 Planned | Medium |

### Lists
1. **Primary objectives**
   - Data integrity preservation
   - Performance optimization
   - Cross-platform compatibility
2. **Secondary goals**
   - User experience improvement
   - Code maintainability
   - Test coverage

### Mathematical Expressions
Performance improvement: Δ = (T₁ - T₀) / T₀ × 100%

### Images and Links
![Architecture Diagram](data:image/svg+xml;base64,PHN2Zy...)
[Documentation](https://docs.example.com)

### Complex Formatting
**Bold** and *italic* text with ~~strikethrough~~ and \`inline code\`.

> **Important Note:** This is a complex blockquote with **nested formatting** and [links](https://example.com).

---

## Appendix
Additional content that makes this document substantially larger and more complex for testing purposes.`;
}

function generateErrorContent(condition: string): string {
  switch (condition) {
    case 'oversized-content':
      return 'x'.repeat(100000); // Very large content
    case 'invalid-characters':
      return 'Content with invalid chars: \x00\x01\x02';
    case 'encoding-issues':
      return 'Content with encoding: 🚀📱💻🌟✨🎯📊🔧⚡️🎨';
    case 'missing-required-field':
      return ''; // Empty content
    default:
      return `Content designed to test ${condition}`;
  }
}

function generateErrorMarkdown(condition: string): string {
  switch (condition) {
    case 'invalid-characters':
      return '# Title\n\nContent with \x00 null bytes';
    case 'oversized-content':
      return '# Large Content\n\n' + 'Content '.repeat(10000);
    case 'encoding-issues':
      return '# Emoji Test 🚀\n\n💻📱🌟✨🎯📊🔧⚡️🎨🚀💻📱🌟✨🎯📊🔧⚡️🎨';
    default:
      return `# Error Test\n\nTesting ${condition}`;
  }
}

function generateRandomTags(count: number = 3): string[] {
  const availableTags = [
    'important', 'urgent', 'review', 'todo', 'done', 'project',
    'personal', 'work', 'idea', 'reference', 'archive', 'draft'
  ];

  const tags: string[] = [];
  for (let i = 0; i < count && i < availableTags.length; i++) {
    const tag = availableTags[Math.floor(Math.random() * availableTags.length)];
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

function estimateDataSize(nodes: TestNode[], cards: TestNotebookCard[], edges: TestEdge[]): number {
  const nodeSize = nodes.reduce((sum, node) => sum + JSON.stringify(node).length, 0);
  const cardSize = cards.reduce((sum, card) => sum + JSON.stringify(card).length, 0);
  const edgeSize = edges.reduce((sum, edge) => sum + JSON.stringify(edge).length, 0);

  return nodeSize + cardSize + edgeSize;
}