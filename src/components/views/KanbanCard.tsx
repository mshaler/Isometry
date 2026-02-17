/**
 * KanbanCard — Draggable card component for Kanban view
 *
 * Uses react-dnd useDrag hook for drag-and-drop functionality.
 * Applies CSS custom properties from primitives-kanban.css.
 */
import { useDrag } from 'react-dnd';
import { cn } from '@/lib/utils';
import type { Card } from '@/types/card';

/** Drag item type constant for react-dnd */
export const KANBAN_CARD_TYPE = 'KANBAN_CARD';

/** Shape of the drag item passed to drop targets */
export interface KanbanDragItem {
  cardId: string;
  sourceColumnId: string;
}

interface KanbanCardProps {
  card: Card;
  columnId: string;
  selected: boolean;
  onClick: () => void;
}

export function KanbanCard({ card, columnId, selected, onClick }: KanbanCardProps) {
  // Use function form for item to avoid stale closure issues
  const [{ isDragging }, dragRef] = useDrag<KanbanDragItem, void, { isDragging: boolean }>(() => ({
    type: KANBAN_CARD_TYPE,
    item: () => ({ cardId: card.id, sourceColumnId: columnId }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [card.id, columnId]);

  const hasTags = card.tags && card.tags.length > 0;
  const visibleTags = card.tags?.slice(0, 3) ?? [];
  const extraTagCount = (card.tags?.length ?? 0) - 3;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={dragRef}
      className={cn(
        'relative cursor-grab transition-all',
        'bg-card border border-border',
        'hover:shadow-md active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
        selected && 'ring-2 ring-blue-500'
      )}
      style={{
        padding: 'var(--iso-kanban-card-pad, 12px)',
        borderRadius: 'var(--iso-kanban-card-radius, 6px)',
      }}
      data-dragging={isDragging || undefined}
      data-selected={selected || undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-grabbed={isDragging}
    >
      {/* Card name/title */}
      <div className="font-medium text-sm text-card-foreground truncate mb-1">
        {card.name}
      </div>

      {/* Folder subtitle */}
      {card.folder && (
        <div className="text-xs text-muted-foreground truncate mb-2">
          {card.folder}
        </div>
      )}

      {/* Tag chips */}
      {hasTags && (
        <div className="flex flex-wrap gap-1 mt-2">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground truncate max-w-[80px]"
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground">
              +{extraTagCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
