/**
 * Mock Data Providers for Testing
 *
 * Mock implementations for testing data provider access
 */

import { DatabaseMode } from '../../contexts/EnvironmentContext';
import type {
  TestNode,
  TestEdge,
  TestNotebookCard,
  TestDataset
} from '../types/integrity-types';

/**
 * Mock provider access functions
 */
export async function getNodeFromProvider(_provider: DatabaseMode, id: string): Promise<TestNode> {
  return {
    id,
    name: 'Test Node',
    content: 'Test content',
    nodeType: 'test',
    tags: [],
    folder: 'test'
  };
}

export async function getEdgeFromProvider(_provider: DatabaseMode, id: string): Promise<TestEdge> {
  return {
    id,
    sourceId: 'node-1',
    targetId: 'node-2',
    edgeType: 'references'
  };
}

export async function getNotebookCardFromProvider(_provider: DatabaseMode, id: string): Promise<TestNotebookCard> {
  return {
    id,
    nodeId: 'node-1',
    cardType: 'capture',
    markdownContent: '# Test Card',
    renderedContent: '<h1>Test Card</h1>'
  };
}

/**
 * Generate test datasets
 */
export function generateTestDataset(size: number = 100): TestDataset {
  const nodes: TestNode[] = [];
  const edges: TestEdge[] = [];
  const notebookCards: TestNotebookCard[] = [];

  for (let i = 0; i < size; i++) {
    nodes.push({
      id: `node-${i}`,
      name: `Test Node ${i}`,
      content: `Test content for node ${i}`,
      nodeType: 'test',
      tags: [`tag-${i % 5}`],
      folder: `folder-${i % 3}`
    });

    if (i > 0) {
      edges.push({
        id: `edge-${i}`,
        sourceId: `node-${i - 1}`,
        targetId: `node-${i}`,
        edgeType: 'sequence'
      });
    }

    if (i % 3 === 0) {
      notebookCards.push({
        id: `card-${i}`,
        nodeId: `node-${i}`,
        cardType: 'capture',
        markdownContent: `# Card ${i}\n\nContent for card ${i}`,
        renderedContent: `<h1>Card ${i}</h1><p>Content for card ${i}</p>`
      });
    }
  }

  return {
    nodes,
    edges,
    notebookCards,
    metadata: {
      totalRecords: nodes.length + edges.length + notebookCards.length,
      createdAt: new Date().toISOString(),
      checksum: 'test-checksum'
    }
  };
}
