import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ListGroupProps {
  label: string;
  count: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * Collapsible group header for grouped list views.
 *
 * Features:
 * - Click to expand/collapse group
 * - Shows facet value + count (e.g., "2024 (143 notes)")
 * - Animated expansion via CSS max-height transition
 * - Chevron icon indicates expanded/collapsed state
 */
export function ListGroup({
  label,
  count,
  defaultExpanded = true,
  children,
}: ListGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = () => setIsExpanded(!isExpanded);

  return (
    <div className="list-group">
      {/* Group Header */}
      <button
        onClick={toggle}
        className="list-group-header w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`group-${label}`}
      >
        {/* Chevron Icon */}
        <span className="flex-shrink-0 text-gray-500">
          {isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </span>

        {/* Label */}
        <span className="flex-1 text-gray-900 dark:text-gray-100">
          {label}
        </span>

        {/* Count Badge */}
        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded">
          {count}
        </span>
      </button>

      {/* Group Content (Children) */}
      <div
        id={`group-${label}`}
        className="list-group-content overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? '100000px' : '0',
        }}
      >
        {children}
      </div>
    </div>
  );
}
