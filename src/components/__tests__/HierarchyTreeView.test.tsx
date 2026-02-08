import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HierarchyTreeView } from '../HierarchyTreeView';
import type { Tree, TreeNode } from '@/hooks/visualization/useNodeTree';
import type { Node } from '@/types/node';

// Helper to create mock Node
function createMockNode(id: string, name: string, priority: number): Node {
  return {
    id,
    nodeType: 'note',
    name,
    content: null,
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: null,
    tags: [],
    status: null,
    priority,
    importance: 0,
    sortOrder: 0,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  };
}

// Helper to create TreeNode
function createTreeNode(id: string, name: string, priority: number, children: TreeNode[] = []): TreeNode {
  return {
    id,
    name,
    priority,
    folder: null,
    children,
    node: createMockNode(id, name, priority),
  };
}

describe('HierarchyTreeView', () => {
  it('renders tree with correct structure', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Root Node', 5, [
          createTreeNode('2', 'Child Node', 3),
        ]),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Root Node', 5)],
        ['2', createTreeNode('2', 'Child Node', 3)],
      ]),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Root should be visible
    expect(screen.getByText('Root Node')).toBeInTheDocument();

    // Child is initially collapsed (not visible)
    expect(screen.queryByText('Child Node')).not.toBeInTheDocument();
  });

  it('toggles expand/collapse on chevron click', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Parent', 5, [
          createTreeNode('2', 'Child', 3),
        ]),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Parent', 5)],
        ['2', createTreeNode('2', 'Child', 3)],
      ]),
    };

    const mockOnChange = vi.fn();

    const { container } = render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Initially collapsed (child not visible)
    expect(screen.queryByText('Child')).not.toBeInTheDocument();

    // Find and click chevron button
    const chevronButton = container.querySelector('button[class*="flex-shrink-0"]');
    expect(chevronButton).toBeInTheDocument();

    if (chevronButton) {
      fireEvent.click(chevronButton);
    }

    // After expand, child should be visible
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('selects node and all descendants when checkbox clicked', () => {
    const child1 = createTreeNode('2', 'Child 1', 3);
    const child2 = createTreeNode('3', 'Child 2', 4);
    const parent = createTreeNode('1', 'Parent', 5, [child1, child2]);

    const tree: Tree = {
      roots: [parent],
      nodeMap: new Map([
        ['1', parent],
        ['2', child1],
        ['3', child2],
      ]),
    };

    const mockOnChange = vi.fn();

    const { container } = render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Find and click parent checkbox
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const parentCheckbox = checkboxes[0]; // First checkbox is parent

    if (parentCheckbox) {
      fireEvent.click(parentCheckbox);
    }

    // Should call onChange with parent + all children IDs
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining(['1', '2', '3'])
    );
  });

  it('filters tree by priority range', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'High Priority', 8),
        createTreeNode('2', 'Medium Priority', 5),
        createTreeNode('3', 'Low Priority', 2),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'High Priority', 8)],
        ['2', createTreeNode('2', 'Medium Priority', 5)],
        ['3', createTreeNode('3', 'Low Priority', 2)],
      ]),
    };

    const mockOnChange = vi.fn();
    const mockRangeChange = vi.fn();

    const { rerender } = render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
        priorityRange={[1, 10]}
        onPriorityRangeChange={mockRangeChange}
      />
    );

    // All nodes visible
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    expect(screen.getByText('Low Priority')).toBeInTheDocument();

    // Change priority range to 5-10
    rerender(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
        priorityRange={[5, 10]}
        onPriorityRangeChange={mockRangeChange}
      />
    );

    // Only high and medium priority visible
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority')).toBeInTheDocument();
    expect(screen.queryByText('Low Priority')).not.toBeInTheDocument();
  });

  it('searches and highlights matching nodes', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Project Alpha', 5),
        createTreeNode('2', 'Project Beta', 5),
        createTreeNode('3', 'Task Gamma', 5),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Project Alpha', 5)],
        ['2', createTreeNode('2', 'Project Beta', 5)],
        ['3', createTreeNode('3', 'Task Gamma', 5)],
      ]),
    };

    const mockOnChange = vi.fn();

    const { container } = render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Find search input
    const searchInput = screen.getByPlaceholderText('Search tree...');
    expect(searchInput).toBeInTheDocument();

    // Type search term
    fireEvent.change(searchInput, { target: { value: 'Project' } });

    // Should show matching nodes (with highlighted text using <mark>)
    const alphaText = container.querySelector('span.truncate');
    expect(alphaText).toBeInTheDocument();
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();

    // Task Gamma should not be visible
    expect(screen.queryByText(/Gamma/)).not.toBeInTheDocument();
  });

  it('expands all nodes on "Expand All" button click', async () => {
    const child2 = createTreeNode('3', 'Grandchild', 2);
    const child1 = createTreeNode('2', 'Child 1', 3, [child2]);
    const root = createTreeNode('1', 'Root', 5, [child1]);

    const tree: Tree = {
      roots: [root],
      nodeMap: new Map([
        ['1', root],
        ['2', child1],
        ['3', child2],
      ]),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Initially collapsed (children not visible)
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Grandchild')).not.toBeInTheDocument();

    // Click "Expand All"
    const expandAllButton = screen.getByText('Expand All');
    fireEvent.click(expandAllButton);

    // All nodes should be visible after expand
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Grandchild')).toBeInTheDocument();
  });

  it('collapses all nodes on "Collapse All" button click', () => {
    const child = createTreeNode('2', 'Child', 3);
    const root = createTreeNode('1', 'Root', 5, [child]);

    const tree: Tree = {
      roots: [root],
      nodeMap: new Map([
        ['1', root],
        ['2', child],
      ]),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Expand first
    const expandAllButton = screen.getByText('Expand All');
    fireEvent.click(expandAllButton);

    // After expand, child should be visible
    expect(screen.getByText('Child')).toBeInTheDocument();

    // Then collapse
    const collapseAllButton = screen.getByText('Collapse All');
    fireEvent.click(collapseAllButton);

    // After collapse, child should not be visible
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
  });

  it('selects all visible nodes on "Select All" button click', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Node 1', 5),
        createTreeNode('2', 'Node 2', 5),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Node 1', 5)],
        ['2', createTreeNode('2', 'Node 2', 5)],
      ]),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    const selectAllButton = screen.getByText('Select All');
    fireEvent.click(selectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining(['1', '2'])
    );
  });

  it('deselects all nodes on "Deselect All" button click', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Node 1', 5),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Node 1', 5)],
      ]),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={['1']}
        onSelectionChange={mockOnChange}
      />
    );

    const deselectAllButton = screen.getByText('Deselect All');
    fireEvent.click(deselectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('shows empty state when no nodes match filters', () => {
    const tree: Tree = {
      roots: [],
      nodeMap: new Map(),
    };

    const mockOnChange = vi.fn();

    render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    expect(screen.getByText('No nodes match the current filters')).toBeInTheDocument();
  });

  it('displays selection count correctly', () => {
    const tree: Tree = {
      roots: [
        createTreeNode('1', 'Node 1', 5),
        createTreeNode('2', 'Node 2', 5),
      ],
      nodeMap: new Map([
        ['1', createTreeNode('1', 'Node 1', 5)],
        ['2', createTreeNode('2', 'Node 2', 5)],
      ]),
    };

    const mockOnChange = vi.fn();

    const { rerender } = render(
      <HierarchyTreeView
        tree={tree}
        selectedIds={[]}
        onSelectionChange={mockOnChange}
      />
    );

    // Check for selection count in stats text
    expect(screen.getByText(/0 node.*selected/i)).toBeInTheDocument();

    rerender(
      <HierarchyTreeView
        tree={tree}
        selectedIds={['1']}
        onSelectionChange={mockOnChange}
      />
    );

    expect(screen.getByText(/1 node selected/i)).toBeInTheDocument();

    rerender(
      <HierarchyTreeView
        tree={tree}
        selectedIds={['1', '2']}
        onSelectionChange={mockOnChange}
      />
    );

    expect(screen.getByText(/2 node.*selected/i)).toBeInTheDocument();
  });
});
