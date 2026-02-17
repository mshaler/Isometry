/**
 * ListRow — Individual list row renderer for ListView
 *
 * Renders either a group header (folder) or a card row.
 * Supports WAI-ARIA tree pattern with role="treeitem".
 */
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/types/card';
import '@/styles/primitives-list.css';

interface ListRowProps {
  type: 'group' | 'card';
  card?: Card;
  groupKey?: string;
  groupCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
  selected: boolean;
  onClick: () => void;
  level: number;
  focused: boolean;
  ariaProps: Record<string, unknown>;
}

export function ListRow({
  type,
  card,
  groupKey,
  groupCount,
  expanded,
  onToggle,
  selected,
  onClick,
  level,
  focused,
  ariaProps,
}: ListRowProps) {
  const indent = `calc(${level} * var(--iso-list-indent, 24px))`;

  if (type === 'group') {
    return (
      <div
        role="treeitem"
        aria-expanded={expanded}
        tabIndex={focused ? 0 : -1}
        className={cn('flex items-center cursor-pointer hover:bg-muted/50 select-none')}
        style={{
          height: 'var(--iso-list-group-h, 36px)',
          paddingLeft: indent,
          paddingRight: 'var(--iso-list-row-pad-x, 12px)',
        }}
        onClick={onToggle}
        {...ariaProps}
      >
        {expanded
          ? <ChevronDown size={16} className="flex-shrink-0" />
          : <ChevronRight size={16} className="flex-shrink-0" />
        }
        <span className="ml-2 font-medium truncate">{groupKey}</span>
        <span className="ml-2 text-muted-foreground text-sm flex-shrink-0">({groupCount})</span>
      </div>
    );
  }

  // Card row
  return (
    <div
      role="treeitem"
      tabIndex={focused ? 0 : -1}
      className={cn(
        'flex items-center cursor-pointer hover:bg-muted/50 select-none',
        selected && 'bg-[var(--iso-list-select-bg)] border-l-2 border-[var(--iso-list-select-border)]'
      )}
      style={{
        height: 'var(--iso-list-row-h, 44px)',
        paddingLeft: indent,
        paddingRight: 'var(--iso-list-row-pad-x, 12px)',
      }}
      aria-selected={selected}
      onClick={onClick}
      {...ariaProps}
    >
      <span className="truncate">{card?.name}</span>
    </div>
  );
}
