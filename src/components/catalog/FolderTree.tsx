/**
 * FolderTree Component
 *
 * Hierarchical folder tree with expand/collapse functionality.
 * Builds a tree structure from flat folder paths (e.g., "work/projects/alpha" becomes nested hierarchy).
 *
 * Phase 79-02: Catalog Browser UI components
 */

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FacetCount } from '../../hooks/data/useFacetAggregates';

interface FolderTreeProps {
  folders: FacetCount[];
  activeFolder: string | null;
  onFolderClick: (folder: string) => void;
}

interface FolderNode {
  name: string;
  path: string;
  count: number;
  children: FolderNode[];
}

/**
 * Build tree structure from flat folder paths.
 * e.g., "work/projects/alpha" becomes nested hierarchy
 */
function buildTree(folders: FacetCount[]): FolderNode[] {
  const root: FolderNode[] = [];
  const map = new Map<string, FolderNode>();

  folders.forEach(({ value, count }) => {
    const parts = value.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const node: FolderNode = {
          name: part,
          path: currentPath,
          count: index === parts.length - 1 ? count : 0,
          children: [],
        };
        map.set(currentPath, node);

        if (parentPath) {
          map.get(parentPath)?.children.push(node);
        } else {
          root.push(node);
        }
      } else if (index === parts.length - 1) {
        // Update count for existing node
        const existingNode = map.get(currentPath);
        if (existingNode) {
          existingNode.count += count;
        }
      }
    });
  });

  return root;
}

export function FolderTree({
  folders,
  activeFolder,
  onFolderClick,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tree = buildTree(folders);

  const toggleExpand = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const renderNode = (node: FolderNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.path);
    const isActive = activeFolder === node.path;

    return (
      <div key={node.path}>
        <button
          onClick={() => onFolderClick(node.path)}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-gray-100 dark:hover:bg-gray-800',
            isActive &&
              'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => toggleExpand(node.path, e)}
              className="p-0.5 cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleExpand(node.path, e as unknown as React.MouseEvent);
                }
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          ) : (
            <span className="w-5" />
          )}
          <Folder className="w-4 h-4 text-gray-500" />
          <span className="flex-1 truncate">{node.name}</span>
          {node.count > 0 && (
            <span className="text-xs text-gray-400">{node.count}</span>
          )}
        </button>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (folders.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic px-2 py-4">
        No folders found
      </div>
    );
  }

  return (
    <div className="space-y-0.5">{tree.map((node) => renderNode(node))}</div>
  );
}

export default FolderTree;
