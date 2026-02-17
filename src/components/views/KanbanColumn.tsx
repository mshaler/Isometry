/**
 * KanbanColumn — Column container with drop zone for Kanban view
 *
 * Uses react-dnd useDrop hook to accept card drops and persist
 * facet value changes to SQLite via db.run.
 */
import { useDrop } from 'react-dnd';
import { useSQLite } from '@/db/SQLiteProvider';
import { cn } from '@/lib/utils';
import type { Card } from '@/types/card';
import { KanbanCard, KANBAN_CARD_TYPE, type KanbanDragItem } from './KanbanCard';

interface KanbanColumnProps {
  columnId: string;
  facetValue: string;
  facetColumn: string;
  cards: Card[];
  onCardClick: (cardId: string) => void;
  isCardSelected: (cardId: string) => boolean;
}

export function KanbanColumn({
  columnId,
  facetValue,
  facetColumn,
  cards,
  onCardClick,
  isCardSelected,
}: KanbanColumnProps) {
  const { run } = useSQLite();

  const [{ isOver }, dropRef] = useDrop<KanbanDragItem, void, { isOver: boolean }>(() => ({
    accept: KANBAN_CARD_TYPE,
    drop: (item) => {
      // No-op if dropping into same column
      if (item.sourceColumnId === columnId) {
        return;
      }

      // Update card's facet value in database
      // Note: cards table uses snake_case columns matching the facetColumn value
      const sql = `UPDATE cards SET ${facetColumn} = ?, modified_at = datetime('now') WHERE id = ?`;
      run(sql, [facetValue, item.cardId]);

      // useSQLiteQuery will auto-refetch due to dataVersion increment in run()
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [columnId, facetColumn, facetValue, run]);

  return (
    <div
      ref={dropRef}
      className={cn(
        'flex flex-col shrink-0 rounded-lg',
        'bg-muted/30 border border-border/50',
        isOver && 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
      )}
      style={{
        minWidth: 'var(--iso-kanban-col-min-w, 260px)',
        maxWidth: 'var(--iso-kanban-col-max-w, 320px)',
        padding: 'var(--iso-kanban-col-pad, 8px)',
      }}
      data-column-id={columnId}
      data-is-over={isOver || undefined}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-2 font-medium text-sm text-foreground"
        style={{
          height: 'var(--iso-kanban-col-hdr-h, 42px)',
        }}
      >
        <span className="truncate">{facetValue}</span>
        <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
          {cards.length}
        </span>
      </div>

      {/* Cards container */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iso-kanban-card-gap, 6px)',
        }}
      >
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            columnId={columnId}
            selected={isCardSelected(card.id)}
            onClick={() => onCardClick(card.id)}
          />
        ))}

        {/* Empty state */}
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
            No cards
          </div>
        )}
      </div>
    </div>
  );
}
