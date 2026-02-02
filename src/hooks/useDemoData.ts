/**
 * Demo Data Provider for SuperGrid
 *
 * Provides diverse sample datasets to demonstrate SuperGrid's generalized
 * LATCH axis capabilities across different data schemas.
 */

import { useMemo } from 'react';
import type { Node } from '@/types/node';

interface DemoDataset {
  name: string;
  description: string;
  nodes: Node[];
  suggestedAxisMapping: {
    x: { axis: string; facet: string };
    y: { axis: string; facet: string };
  };
}

/**
 * Apple Notes Sample Data
 */
function generateAppleNotesData(): Node[] {
  const folders = ['Work', 'Projects', 'Personal', 'Ideas', 'Research'];
  const priorities = [1, 2, 3, 4, 5];
  const tags = ['urgent', 'planning', 'reference', 'draft', 'important', 'meetings'];

  return Array.from({ length: 25 }, (_, i) => ({
    id: `apple_${i + 1}`,
    name: `Note ${i + 1}: ${['Meeting Notes', 'Project Plan', 'Ideas', 'Research', 'Tasks'][i % 5]}`,
    content: `Sample content for note ${i + 1}`,
    nodeType: 'note' as const,
    folder: folders[i % folders.length],
    tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
    priority: priorities[i % priorities.length],
    createdAt: new Date(2024, 0, 1 + i * 3).toISOString(),
    modifiedAt: new Date(2024, 0, 1 + i * 3 + Math.floor(Math.random() * 10)).toISOString(),
  }));
}

/**
 * Project Management Sample Data
 */
function generateProjectData(): Node[] {
  const statuses = ['Todo', 'In Progress', 'Review', 'Done', 'Blocked'];
  const teams = ['Frontend', 'Backend', 'DevOps', 'Design', 'QA'];
  const priorities = [1, 2, 3, 4, 5];

  return Array.from({ length: 30 }, (_, i) => ({
    id: `proj_${i + 1}`,
    name: `Task ${i + 1}: ${['Implement API', 'Fix Bug', 'Update UI', 'Deploy Service', 'Write Tests'][i % 5]}`,
    content: `Task description for item ${i + 1}`,
    nodeType: 'task' as const,
    folder: teams[i % teams.length],
    tags: [statuses[i % statuses.length]],
    priority: priorities[i % priorities.length],
    createdAt: new Date(2024, 1, 1 + i * 2).toISOString(),
    modifiedAt: new Date(2024, 1, 1 + i * 2 + Math.floor(Math.random() * 5)).toISOString(),
  }));
}

/**
 * Customer Data Sample
 */
function generateCustomerData(): Node[] {
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const segments = ['Enterprise', 'SMB', 'Startup', 'Government', 'Education'];
  const priorities = [1, 2, 3, 4, 5];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `cust_${i + 1}`,
    name: `Customer ${i + 1}: ${['Acme Corp', 'Tech Solutions', 'Global Inc', 'Innovation Ltd', 'Future Systems'][i % 5]}`,
    content: `Customer profile for account ${i + 1}`,
    nodeType: 'customer' as const,
    folder: regions[i % regions.length],
    tags: [segments[i % segments.length]],
    priority: priorities[i % priorities.length],
    createdAt: new Date(2024, 2, 1 + i * 4).toISOString(),
    modifiedAt: new Date(2024, 2, 1 + i * 4 + Math.floor(Math.random() * 7)).toISOString(),
  }));
}

/**
 * Content Management Sample Data
 */
function generateContentData(): Node[] {
  const categories = ['Blog', 'Documentation', 'Marketing', 'Legal', 'Product'];
  const statuses = ['Draft', 'Review', 'Published', 'Archived', 'Updated'];
  const priorities = [1, 2, 3, 4, 5];

  return Array.from({ length: 35 }, (_, i) => ({
    id: `cont_${i + 1}`,
    name: `${['Guide', 'Article', 'Tutorial', 'Policy', 'Announcement'][i % 5]} ${i + 1}`,
    content: `Content body for document ${i + 1}`,
    nodeType: 'document' as const,
    folder: categories[i % categories.length],
    tags: [statuses[i % statuses.length]],
    priority: priorities[i % priorities.length],
    createdAt: new Date(2024, 3, 1 + i).toISOString(),
    modifiedAt: new Date(2024, 3, 1 + i + Math.floor(Math.random() * 3)).toISOString(),
  }));
}

/**
 * Demo datasets showcasing SuperGrid's generalized architecture
 */
export const DEMO_DATASETS: DemoDataset[] = [
  {
    name: 'Apple Notes',
    description: 'Personal note-taking with folders, tags, and priorities',
    nodes: generateAppleNotesData(),
    suggestedAxisMapping: {
      x: { axis: 'time', facet: 'month' },
      y: { axis: 'category', facet: 'folder' }
    }
  },
  {
    name: 'Project Management',
    description: 'Task tracking with teams, status, and deadlines',
    nodes: generateProjectData(),
    suggestedAxisMapping: {
      x: { axis: 'time', facet: 'day' },
      y: { axis: 'hierarchy', facet: 'level' }
    }
  },
  {
    name: 'Customer Database',
    description: 'Customer profiles with regions and segments',
    nodes: generateCustomerData(),
    suggestedAxisMapping: {
      x: { axis: 'category', facet: 'folder' },
      y: { axis: 'category', facet: 'tag' }
    }
  },
  {
    name: 'Content Management',
    description: 'Document library with categories and publication status',
    nodes: generateContentData(),
    suggestedAxisMapping: {
      x: { axis: 'alphabet', facet: 'letter' },
      y: { axis: 'category', facet: 'folder' }
    }
  }
];

/**
 * Hook to access demo datasets for SuperGrid
 */
export function useDemoDatasets() {
  return useMemo(() => DEMO_DATASETS, []);
}

/**
 * Hook to get a specific demo dataset by name
 */
export function useDemoDataset(datasetName: string): DemoDataset | null {
  const datasets = useDemoDatasets();
  return useMemo(() =>
    datasets.find(dataset => dataset.name === datasetName) || null,
    [datasets, datasetName]
  );
}

/**
 * Hook to get all demo nodes combined (for fallback mode)
 */
export function useAllDemoNodes(): Node[] {
  const datasets = useDemoDatasets();
  const allNodes = useMemo(() => {
    return datasets.flatMap(dataset => dataset.nodes);
  }, [datasets]);

  return allNodes;
}