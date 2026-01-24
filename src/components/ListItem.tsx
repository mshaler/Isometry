import { memo } from 'react';
import { Calendar, Tag, Folder } from 'lucide-react';
import type { Node } from '../types/node';

interface ListItemProps {
  node: Node;
  onClick?: (node: Node) => void;
  isSelected?: boolean;
}

/**
 * Individual list item component for ListView.
 *
 * Features:
 * - Displays node title, body snippet (first 100 chars), created date, tags
 * - Click handler opens Card Overlay (via SelectionContext)
 * - Hover state (subtle background color change)
 * - Compact layout: single line for small items, multi-line for rich content
 */
export const ListItem = memo(function ListItem({
  node,
  onClick,
  isSelected = false,
}: ListItemProps) {
  const handleClick = () => {
    onClick?.(node);
  };

  // Get body snippet (first 100 chars)
  const bodySnippet = node.content
    ? node.content.substring(0, 100) + (node.content.length > 100 ? '...' : '')
    : node.summary
    ? node.summary.substring(0, 100) + (node.summary.length > 100 ? '...' : '')
    : '';

  // Format created date
  const createdDate = new Date(node.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      onClick={handleClick}
      className={`
        list-item
        px-4 py-3
        border-b border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-800
        cursor-pointer
        transition-colors
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}
      `}
      role="button"
      tabIndex={0}
      aria-label={`Open ${node.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
          {node.name}
        </h3>

        {/* Created Date */}
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <Calendar size={12} />
          <span>{createdDate}</span>
        </div>
      </div>

      {/* Body Snippet (if available) */}
      {bodySnippet && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {bodySnippet}
        </p>
      )}

      {/* Metadata Row */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        {/* Folder */}
        {node.folder && (
          <div className="flex items-center gap-1">
            <Folder size={12} />
            <span>{node.folder}</span>
          </div>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag size={12} />
            <span>{node.tags.slice(0, 3).join(', ')}</span>
            {node.tags.length > 3 && <span>+{node.tags.length - 3}</span>}
          </div>
        )}

        {/* Priority (if set) */}
        {node.priority > 0 && (
          <div className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-medium">
            P{node.priority}
          </div>
        )}

        {/* Status (if set) */}
        {node.status && (
          <div
            className={`
              px-1.5 py-0.5 rounded text-xs font-medium
              ${
                node.status === 'completed'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : node.status === 'active'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }
            `}
          >
            {node.status}
          </div>
        )}
      </div>
    </div>
  );
});
